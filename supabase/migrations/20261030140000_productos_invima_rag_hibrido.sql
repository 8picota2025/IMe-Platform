-- RAG IMEia: estado INVIMA por producto, búsqueda híbrida y embeddings nocturnos.
-- Reversible: ver bloque ROLLBACK al final (comentado).

create extension if not exists unaccent with schema extensions;

alter table public.productos
  add column if not exists invima_estado text not null default 'pendiente',
  add column if not exists invima_rs text,
  add column if not exists invima_titular text,
  add column if not exists invima_vigencia date,
  add column if not exists invima_verificado_at timestamptz,
  add column if not exists invima_fuente text;

do $$ begin
  alter table public.productos add constraint productos_invima_estado_check
    check (invima_estado in ('vigente','sin_registro','pendiente','no_aplica'));
exception when duplicate_object then null; end $$;

comment on column public.productos.invima_estado is
  'vigente | sin_registro | pendiente | no_aplica. Solo IMvima lo cambia, con fuente. Nunca inventar.';

-- Zuowei (9 SKU): sin registro INVIMA verificado (IMvima, datos abiertos INVIMA 30-oct-2026).
update public.productos
   set invima_estado = 'sin_registro',
       invima_verificado_at = now(),
       invima_fuente = 'IMvima: datos abiertos INVIMA consultados 2026-10-30; sin registro Zuowei ni que ampare a I-ME'
 where nombre_es ilike '%zuowei%';

-- Si cambia el contenido indexable, el embedding queda obsoleto y el job nocturno lo regenera.
create or replace function public.productos_invalidar_embedding()
returns trigger language plpgsql as $$
begin
  if (new.nombre_es, new.descripcion_corta_es, new.descripcion_larga_es, new.especificaciones::text, new.aplicaciones_es)
     is distinct from
     (old.nombre_es, old.descripcion_corta_es, old.descripcion_larga_es, old.especificaciones::text, old.aplicaciones_es) then
    new.embedding := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_productos_invalidar_embedding on public.productos;
create trigger trg_productos_invalidar_embedding
  before update on public.productos
  for each row execute function public.productos_invalidar_embedding();

-- match_productos: misma lógica, ahora devuelve disponibilidad y estado INVIMA.
drop function if exists public.match_productos(vector, integer, jsonb);
create function public.match_productos(query_embedding vector, match_count integer default 6, filtro jsonb default null)
returns table(id uuid, slug text, nombre_es text, nombre_en text, descripcion_corta_es text, descripcion_corta_en text,
  imagen_principal text, tipo_comercial text, familia_id uuid, tipo_id uuid, score double precision,
  sku text, disponible boolean, stock_estado text, invima_estado text, invima_rs text, invima_vigencia date)
language sql stable as $$
  select p.id, p.slug, p.nombre_es, p.nombre_en, p.descripcion_corta_es, p.descripcion_corta_en,
         p.imagen_principal, p.tipo_comercial, p.familia_id, p.tipo_id,
         1 - (p.embedding <=> query_embedding) as score,
         p.sku, p.disponible, p.stock_estado, p.invima_estado, p.invima_rs, p.invima_vigencia
    from public.productos p
   where p.activo = true and p.embedding is not null
     and (filtro is null or filtro = '{}'::jsonb or (
          (not (filtro ? 'familia_id') or p.familia_id::text = filtro->>'familia_id')
      and (not (filtro ? 'tipo_id') or p.tipo_id::text = filtro->>'tipo_id')
      and (not (filtro ? 'tipo_comercial') or p.tipo_comercial = filtro->>'tipo_comercial')))
   order by p.embedding <=> query_embedding
   limit match_count;
$$;
grant execute on function public.match_productos(vector, integer, jsonb) to anon, authenticated, service_role;

-- Búsqueda híbrida: palabras en OR sin acentos + trigramas + SKU exacto + vector opcional, fusión RRF.
-- Devuelve vacío si ninguna señal supera el umbral ("no lo tenemos").
create or replace function public.buscar_productos_hibrido(
  query_text text, match_count integer default 6, query_embedding vector default null,
  filtro jsonb default null, min_trgm real default 0.6, min_vec double precision default 0.45)
returns table(id uuid, slug text, nombre_es text, nombre_en text, descripcion_corta_es text, descripcion_corta_en text,
  imagen_principal text, tipo_comercial text, familia_id uuid, tipo_id uuid, score double precision,
  sku text, disponible boolean, stock_estado text, invima_estado text, invima_rs text, invima_vigencia date, senal text)
language sql stable set search_path = public, extensions as $$
with q as (
  select lower(extensions.unaccent(coalesce(query_text,''))) as t
), palabras as (
  select w, min(pos) as pos from q, regexp_split_to_table(q.t, '[^a-z0-9\-]+') with ordinality as x(w, pos)
   where length(w) >= 3 and w not in ('para','con','los','las','del','que','una','uno','por','sus','como','tiene','tienen',
     'necesito','busco','quiero','precio','equipo','equipos','the','and','for','with','hay','son','mas','muy','este','esta')
   group by w
), tsq as (
  select case when count(*) = 0 then null else to_tsquery('simple', string_agg(w || ':*', ' | ')) end as tq from palabras
), base as (
  select p.*,
         to_tsvector('simple', lower(extensions.unaccent(coalesce(p.nombre_es,'') || ' ' || coalesce(p.sku,'') || ' ' ||
           coalesce(p.descripcion_corta_es,'') || ' ' || coalesce(array_to_string(p.aplicaciones_es,' '),'')))) as doc,
         lower(extensions.unaccent(p.nombre_es)) as nom
    from public.productos p
   where p.activo = true
     and (filtro is null or filtro = '{}'::jsonb or (
          (not (filtro ? 'familia_id') or p.familia_id::text = filtro->>'familia_id')
      and (not (filtro ? 'tipo_id') or p.tipo_id::text = filtro->>'tipo_id')
      and (not (filtro ? 'tipo_comercial') or p.tipo_comercial = filtro->>'tipo_comercial')))
), senales as (
  select b.id,
         case when tsq.tq is not null and b.doc @@ tsq.tq then ts_rank_cd(b.doc, tsq.tq) else 0 end as kw,
         word_similarity(q.t, b.nom) as tg,
         (select coalesce(sum(case when pa.pos = (select min(pos) from palabras) then 2 else 1 end), 0)
            from palabras pa where b.nom like '%' || pa.w || '%') as nm,
         case when query_embedding is not null and b.embedding is not null then 1 - (b.embedding <=> query_embedding) else 0 end as vec,
         (b.sku is not null and length(b.sku) >= 4 and position(lower(b.sku) in q.t) > 0) as sku_ok
    from base b, q, tsq
), rk as (
  select s.*,
         rank() over (order by kw desc) as r_kw, rank() over (order by nm desc) as r_nm, rank() over (order by tg desc) as r_tg, rank() over (order by vec desc) as r_vec
    from senales s
   where s.sku_ok or s.kw > 0 or s.tg >= min_trgm or s.vec >= min_vec
)
select b.id, b.slug, b.nombre_es, b.nombre_en, b.descripcion_corta_es, b.descripcion_corta_en, b.imagen_principal,
       b.tipo_comercial, b.familia_id, b.tipo_id,
       (case when rk.sku_ok then 1.0 else 0 end)
         + (case when rk.kw > 0 then 1.0/(60 + rk.r_kw) else 0 end)
         + (case when rk.nm > 0 then 2.0/(60 + rk.r_nm) else 0 end)
         + (case when rk.tg >= min_trgm then 1.0/(60 + rk.r_tg) else 0 end)
         + (case when rk.vec >= min_vec then 1.0/(60 + rk.r_vec) else 0 end) as score,
       b.sku, b.disponible, b.stock_estado, b.invima_estado, b.invima_rs, b.invima_vigencia,
       concat_ws('+', case when rk.sku_ok then 'sku' end, case when rk.kw > 0 then 'kw' end, case when rk.nm > 0 then 'nombre' end,
                 case when rk.tg >= min_trgm then 'trgm' end, case when rk.vec >= min_vec then 'vec' end) as senal
  from rk join base b on b.id = rk.id
 order by score desc
 limit match_count;
$$;
grant execute on function public.buscar_productos_hibrido(text, integer, vector, jsonb, real, double precision) to anon, authenticated, service_role;

-- Job nocturno 02:00 COT (07:00 UTC): embeddings faltantes u obsoletos. Sin LLM.
select cron.unschedule('generar-embeddings-nocturno') where exists (select 1 from cron.job where jobname = 'generar-embeddings-nocturno');
select cron.schedule('generar-embeddings-nocturno', '0 7 * * *', $job$
  select net.http_post(
    url := 'https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/generar-embeddings',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'edge_service_key')),
    body := '{"solo_faltantes": true}'::jsonb,
    timeout_milliseconds := 120000);
$job$);

-- ROLLBACK (manual):
-- select cron.unschedule('generar-embeddings-nocturno');
-- drop function public.buscar_productos_hibrido(text, integer, vector, jsonb, real, double precision);
-- drop trigger trg_productos_invalidar_embedding on public.productos; drop function public.productos_invalidar_embedding();
-- (match_productos: recrear la versión de 11 columnas de la migración anterior)
-- alter table public.productos drop column invima_estado, drop column invima_rs, drop column invima_titular,
--   drop column invima_vigencia, drop column invima_verificado_at, drop column invima_fuente;
