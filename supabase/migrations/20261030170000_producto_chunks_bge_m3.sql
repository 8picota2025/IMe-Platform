-- RAG de especificaciones: chunks por producto con embeddings locales bge-m3 (Ollama en srv1715444, 1024 dims).
-- Señal RRF adicional en buscar_productos_hibrido; la ruta Voyage (productos.embedding) no cambia.
-- Si el endpoint local no responde (timeout 1.5 s) la búsqueda sigue sin la señal de chunks.

create extension if not exists http with schema extensions;

create table if not exists public.producto_chunks (
  id bigserial primary key,
  producto_id uuid not null references public.productos(id) on delete cascade,
  sku text,
  orden integer not null,
  nivel text not null default 'L2',
  contenido text not null,
  tokens_aprox integer,
  fuente text not null default 'productos.especificaciones+descripcion',
  fuente_hash text not null,
  modelo text not null default 'bge-m3',
  embedding vector(1024) not null,
  fecha timestamptz not null default now(),
  unique (producto_id, orden)
);
create index if not exists producto_chunks_hnsw on public.producto_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists producto_chunks_producto on public.producto_chunks (producto_id);
alter table public.producto_chunks enable row level security;
revoke all on public.producto_chunks from anon, authenticated;

create table if not exists public.rag_embed_config (
  id integer primary key default 1 check (id = 1),
  url text not null,
  token text not null,
  activo boolean not null default true,
  timeout_ms integer not null default 1500,
  actualizado_at timestamptz not null default now()
);
alter table public.rag_embed_config enable row level security;
revoke all on public.rag_embed_config from anon, authenticated;

-- Hash de la fuente indexada (detecta cambios para el job incremental).
create or replace function public.producto_fuente_hash(p public.productos)
returns text language sql immutable as $$
  select md5(concat_ws('|', p.nombre_es, p.sku, p.descripcion_corta_es, p.descripcion_larga_es,
    array_to_string(p.aplicaciones_es, ';'), p.especificaciones::text, 'v1'));
$$;

-- Configuración del endpoint (la escribe el worker de srv con su token; el valor nunca sale de BD).
create or replace function public.rag_embed_set_endpoint(p_token text, p_url text, p_embed_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'token invalido'; end if;
  insert into public.rag_embed_config (id, url, token) values (1, p_url, p_embed_token)
  on conflict (id) do update set url = excluded.url, token = excluded.token, activo = true, actualizado_at = now();
  return true;
end $$;

-- Embedding de consulta con bge-m3 (síncrono, timeout corto; null si falla).
create or replace function public.rag_embed_local(p_texto text)
returns vector language plpgsql volatile security definer set search_path = public, extensions as $$
declare c public.rag_embed_config; r extensions.http_response; v vector;
begin
  select * into c from public.rag_embed_config where id = 1 and activo;
  if c.url is null or coalesce(trim(p_texto), '') = '' then return null; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', c.timeout_ms::text);
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '800');
  r := extensions.http((
    'POST', c.url, array[extensions.http_header('Authorization', 'Bearer ' || c.token)],
    'application/json', jsonb_build_object('input', left(p_texto, 2000))::text)::extensions.http_request);
  if r.status <> 200 then return null; end if;
  v := ((r.content::jsonb)->'embedding')::text::vector;
  return v;
exception when others then
  return null;
end $$;
revoke all on function public.rag_embed_local(text) from public, anon, authenticated;

-- RPCs del indexador (srv1715444), autorizadas por token de worker.
create or replace function public.rag_chunks_pendientes(p_token text, p_limit integer default 50)
returns table(id uuid, sku text, nombre_es text, descripcion_corta_es text, descripcion_larga_es text,
  aplicaciones_es text[], especificaciones jsonb, fuente_hash text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'token invalido'; end if;
  -- limpiar chunks de productos inactivos
  delete from public.producto_chunks c using public.productos p where p.id = c.producto_id and not p.activo;
  return query
  select p.id, p.sku, p.nombre_es, p.descripcion_corta_es, p.descripcion_larga_es, p.aplicaciones_es, p.especificaciones,
         public.producto_fuente_hash(p)
    from public.productos p
   where p.activo
     and not exists (select 1 from public.producto_chunks c
                      where c.producto_id = p.id and c.fuente_hash = public.producto_fuente_hash(p))
   order by p.updated_at desc
   limit greatest(1, least(p_limit, 500));
end $$;

create or replace function public.rag_chunks_guardar(p_token text, p_producto_id uuid, p_hash text, p_chunks jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'token invalido'; end if;
  delete from public.producto_chunks where producto_id = p_producto_id;
  insert into public.producto_chunks (producto_id, sku, orden, nivel, contenido, tokens_aprox, fuente_hash, modelo, embedding)
  select p_producto_id, p.sku, (e->>'orden')::int, coalesce(e->>'nivel', 'L2'), e->>'contenido', (e->>'tokens')::int,
         p_hash, coalesce(e->>'modelo', 'bge-m3'), (e->'embedding')::text::vector
    from jsonb_array_elements(p_chunks) e, public.productos p where p.id = p_producto_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rag_chunks_pendientes(text, integer) from public;
revoke all on function public.rag_chunks_guardar(text, uuid, text, jsonb) from public;
grant execute on function public.rag_chunks_pendientes(text, integer) to anon, authenticated;
grant execute on function public.rag_chunks_guardar(text, uuid, text, jsonb) to anon, authenticated;
revoke all on function public.rag_embed_set_endpoint(text, text, text) from public;
grant execute on function public.rag_embed_set_endpoint(text, text, text) to anon, authenticated;

-- Búsqueda híbrida v2: misma lógica + señal 'chunk' (bge-m3) + fragmento de especificación.
drop function if exists public.buscar_productos_hibrido(text, integer, vector, jsonb, real, double precision);
create or replace function public.buscar_productos_hibrido(
  query_text text, match_count integer default 6, query_embedding vector default null,
  filtro jsonb default null, min_trgm real default 0.6, min_vec double precision default 0.45,
  query_embedding_local vector default null, min_chunk double precision default 0.55, usar_chunks boolean default true)
returns table(id uuid, slug text, nombre_es text, nombre_en text, descripcion_corta_es text, descripcion_corta_en text,
  imagen_principal text, tipo_comercial text, familia_id uuid, tipo_id uuid, score double precision,
  sku text, disponible boolean, stock_estado text, invima_estado text, invima_rs text, invima_vigencia date, senal text,
  fragmento text)
language plpgsql volatile security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_loc vector;
begin
  if usar_chunks then
    v_loc := coalesce(query_embedding_local, public.rag_embed_local(query_text));
  end if;
  return query
  with q as (
    select lower(extensions.unaccent(coalesce(query_text,''))) as t
  ), palabras as (
    select x.w, min(x.pos) as pos from q, regexp_split_to_table(q.t, '[^a-z0-9\-]+') with ordinality as x(w, pos)
     where length(x.w) >= 3 and x.w not in ('para','con','los','las','del','que','una','uno','por','sus','como','tiene','tienen',
       'necesito','busco','quiero','precio','equipo','equipos','the','and','for','with','hay','son','mas','muy','este','esta')
     group by x.w
  ), tsq as (
    select case when count(*) = 0 then null else to_tsquery('simple', string_agg(palabras.w || ':*', ' | ')) end as tq from palabras
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
  ), top_chunks as (
    select c.producto_id, c.contenido, 1 - (c.embedding <=> v_loc) as sim
      from public.producto_chunks c
     where v_loc is not null
     order by c.embedding <=> v_loc
     limit 40
  ), chunk_best as (
    select distinct on (tc.producto_id) tc.producto_id, tc.sim, tc.contenido
      from top_chunks tc order by tc.producto_id, tc.sim desc
  ), senales as (
    select b.id,
           case when tsq.tq is not null and b.doc @@ tsq.tq then ts_rank_cd(b.doc, tsq.tq) else 0 end as kw,
           word_similarity(q.t, b.nom) as tg,
           (select coalesce(sum(case when pa.pos = (select min(p2.pos) from palabras p2) then 2 else 1 end), 0)
              from palabras pa where b.nom like '%' || pa.w || '%') as nm,
           case when query_embedding is not null and b.embedding is not null then 1 - (b.embedding <=> query_embedding) else 0 end as vec,
           coalesce(cb.sim, 0) as ch, cb.contenido as frag,
           (b.sku is not null and length(b.sku) >= 4 and position(lower(b.sku) in q.t) > 0) as sku_ok
      from base b cross join q cross join tsq left join chunk_best cb on cb.producto_id = b.id
  ), rk as (
    select s.*,
           rank() over (order by s.kw desc) as r_kw, rank() over (order by s.nm desc) as r_nm, rank() over (order by s.tg desc) as r_tg,
           rank() over (order by s.vec desc) as r_vec, rank() over (order by s.ch desc) as r_ch
      from senales s
     where s.sku_ok or s.kw > 0 or s.tg >= min_trgm or s.vec >= min_vec or s.ch >= min_chunk
  )
  select b.id, b.slug, b.nombre_es, b.nombre_en, b.descripcion_corta_es, b.descripcion_corta_en, b.imagen_principal,
         b.tipo_comercial, b.familia_id, b.tipo_id,
         ((case when rk.sku_ok then 1.0 else 0 end)
           + (case when rk.kw > 0 then 1.0/(60 + rk.r_kw) else 0 end)
           + (case when rk.nm > 0 then 2.0/(60 + rk.r_nm) else 0 end)
           + (case when rk.tg >= min_trgm then 1.0/(60 + rk.r_tg) else 0 end)
           + (case when rk.vec >= min_vec then 1.0/(60 + rk.r_vec) else 0 end)
           + (case when rk.ch >= min_chunk then 1.0/(60 + rk.r_ch) else 0 end))::double precision as score,
         b.sku, b.disponible, b.stock_estado, b.invima_estado, b.invima_rs, b.invima_vigencia,
         concat_ws('+', case when rk.sku_ok then 'sku' end, case when rk.kw > 0 then 'kw' end, case when rk.nm > 0 then 'nombre' end,
                   case when rk.tg >= min_trgm then 'trgm' end, case when rk.vec >= min_vec then 'vec' end,
                   case when rk.ch >= min_chunk then 'chunk' end) as senal,
         case when rk.ch >= min_chunk then left(rk.frag, 1200) end as fragmento
    from rk join base b on b.id = rk.id
   order by 11 desc
   limit match_count;
end $$;
grant execute on function public.buscar_productos_hibrido(text, integer, vector, jsonb, real, double precision, vector, double precision, boolean)
  to anon, authenticated, service_role;

-- ROLLBACK (manual):
-- 1) recrear buscar_productos_hibrido de 20261030140000 (drop de la firma de 9 args primero)
-- 2) drop function rag_chunks_guardar, rag_chunks_pendientes, rag_embed_local, rag_embed_set_endpoint, producto_fuente_hash;
-- 3) drop table producto_chunks, rag_embed_config;  (la extensión http puede quedarse)
