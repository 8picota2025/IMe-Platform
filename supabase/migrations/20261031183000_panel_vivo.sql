-- BORRADOR 31-10-2026 — NO APLICADO. Requiere OK de Shoky.
-- Tablero vivo: tareas, auditoria append-only, vista y realtime.
-- No toca las guardas de envio ni el RPC aprobar_cotizacion_envio
-- (sigue siendo solo service_role, llamado desde la Edge Function panel-accion).
begin;

-- Columnas de marca. Si 20261031120000 ya las creo, no se tocan.
-- El RPC y el trigger de esa migracion no se redefinen aqui.
alter table public.solicitudes_cotizacion
  add column if not exists aprobado_por text,
  add column if not exists aprobado_at timestamptz,
  add column if not exists aprobacion_tipo text,
  add column if not exists aprobacion_ref text,
  add column if not exists margen_validado numeric(6,2),
  add column if not exists aprobacion_hash text;

create or replace function public.panel_marca_no_enviar(txt text)
returns boolean
language sql
immutable
as $$
  select upper(translate(coalesce(txt, ''), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'))
    ~ 'NO[[:space:]._:-]*ENVIA';
$$;

create table if not exists public.panel_tareas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (length(btrim(tipo)) > 0),
  titulo text not null,
  ref text,
  cotizacion_id uuid references public.solicitudes_cotizacion (id) on delete set null,
  bot_dueno text,
  columna text not null default 'por_aprobar'
    check (columna in ('por_aprobar', 'aprobado_en_cola', 'en_ejecucion', 'hecho', 'bloqueado')),
  estado text not null default 'abierta',
  payload jsonb not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_panel_tareas_updated_at on public.panel_tareas;
create trigger set_panel_tareas_updated_at
  before update on public.panel_tareas
  for each row execute function public.trigger_set_updated_at();

create index if not exists idx_panel_tareas_columna
  on public.panel_tareas (columna, created_at desc);

create table if not exists public.panel_eventos (
  id uuid primary key default gen_random_uuid(),
  tarjeta_id uuid,
  tarjeta_tipo text not null,
  accion text not null,
  actor text not null,
  actor_id uuid,
  actor_canal text not null default 'admin',
  ts timestamptz not null default now(),
  resultado text,
  detalle jsonb not null default '{}'::jsonb,
  hash text,
  ip text,
  version_tarjeta text
);

create index if not exists idx_panel_eventos_tarjeta
  on public.panel_eventos (tarjeta_id, ts desc);

comment on table public.panel_eventos is
  'Append-only. Ningun rol tiene UPDATE ni DELETE. El trigger rechaza ambos.';

create or replace function public.tg_panel_eventos_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'panel_eventos es append-only' using errcode = '42501';
end;
$$;

drop trigger if exists panel_eventos_no_update on public.panel_eventos;
create trigger panel_eventos_no_update
  before update on public.panel_eventos
  for each row execute function public.tg_panel_eventos_append_only();

drop trigger if exists panel_eventos_no_delete on public.panel_eventos;
create trigger panel_eventos_no_delete
  before delete on public.panel_eventos
  for each row execute function public.tg_panel_eventos_append_only();

create table if not exists public.panel_snapshot_twenty (
  id uuid primary key default gen_random_uuid(),
  oportunidad_ref text not null unique,
  estado text,
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

comment on table public.panel_snapshot_twenty is
  'La llena el bot CRM. El panel y esta migracion no escriben en Twenty.';

create or replace view public.v_panel_tarjetas
with (security_invoker = true) as
select
  c.id,
  'cotizacion'::text as origen,
  'cotizacion'::text as tipo,
  coalesce(nullif(btrim(c.numero), ''), c.id::text) as titulo,
  c.numero as ref,
  c.id as cotizacion_id,
  null::text as bot_dueno,
  case
    when public.panel_marca_no_enviar(c.notas_internas)
      or coalesce(btrim(c.send_error), '') <> '' then 'bloqueado'
    when c.aprobado_at is not null and coalesce(btrim(c.aprobado_por), '') <> '' then 'aprobado_en_cola'
    else 'por_aprobar'
  end as columna,
  c.estado,
  c.precio_total_ofertado as total,
  c.moneda,
  c.aprobado_por,
  c.aprobado_at,
  c.aprobacion_tipo,
  c.validez_hasta,
  c.send_error,
  c.notas_internas,
  c.empresa,
  c.updated_at,
  jsonb_build_object('nombre', c.nombre) as payload
from public.solicitudes_cotizacion c
where c.archived_at is null
  and c.estado not in (
    'enviada', 'aceptada', 'rechazada', 'perdida', 'cerrada',
    'archivada', 'cancelada', 'facturada', 'convertida'
  )
union all
select
  t.id,
  'tarea'::text,
  t.tipo,
  t.titulo,
  t.ref,
  t.cotizacion_id,
  t.bot_dueno,
  t.columna,
  t.estado,
  null::numeric,
  null::text,
  null::text,
  null::timestamptz,
  null::text,
  null::date,
  null::text,
  null::text,
  null::text,
  t.updated_at,
  coalesce(t.payload, '{}'::jsonb)
from public.panel_tareas t
union all
select
  s.id,
  'twenty'::text,
  'oportunidad'::text,
  s.oportunidad_ref,
  s.oportunidad_ref,
  null::uuid,
  'crm'::text,
  'en_ejecucion'::text,
  s.estado,
  null::numeric,
  null::text,
  null::text,
  null::timestamptz,
  null::text,
  null::date,
  null::text,
  null::text,
  null::text,
  s.synced_at,
  coalesce(s.payload, '{}'::jsonb)
from public.panel_snapshot_twenty s;

alter table public.panel_tareas enable row level security;
alter table public.panel_eventos enable row level security;
alter table public.panel_snapshot_twenty enable row level security;
alter table public.panel_eventos force row level security;

revoke all on table public.panel_tareas from public, anon, authenticated, service_role;
revoke all on table public.panel_eventos from public, anon, authenticated, service_role;
revoke all on table public.panel_snapshot_twenty from public, anon, authenticated, service_role;
revoke all on table public.v_panel_tarjetas from public, anon, authenticated, service_role;

grant select on table public.panel_tareas to authenticated, service_role;
grant insert, update on table public.panel_tareas to service_role;
grant select on table public.panel_eventos to authenticated, service_role;
grant insert on table public.panel_eventos to service_role;
revoke update, delete on table public.panel_eventos from public, anon, authenticated, service_role;
grant select, insert, update on table public.panel_snapshot_twenty to service_role;
grant select on table public.panel_snapshot_twenty to authenticated;
grant select on table public.v_panel_tarjetas to authenticated, service_role;

-- Lectura solo owner/admin. No hay politicas de escritura para authenticated:
-- inserta la Edge Function con service_role.
drop policy if exists panel_tareas_select_admin on public.panel_tareas;
create policy panel_tareas_select_admin
  on public.panel_tareas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles ap
      where ap.user_id = (select auth.uid())
        and ap.activo = true
        and ap.rol in ('admin', 'owner')
    )
  );

drop policy if exists panel_eventos_select_admin on public.panel_eventos;
create policy panel_eventos_select_admin
  on public.panel_eventos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles ap
      where ap.user_id = (select auth.uid())
        and ap.activo = true
        and ap.rol in ('admin', 'owner')
    )
  );

drop policy if exists panel_snapshot_twenty_select_admin on public.panel_snapshot_twenty;
create policy panel_snapshot_twenty_select_admin
  on public.panel_snapshot_twenty
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles ap
      where ap.user_id = (select auth.uid())
        and ap.activo = true
        and ap.rol in ('admin', 'owner')
    )
  );

alter table public.panel_tareas replica identity full;
alter table public.panel_eventos replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.panel_tareas;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.panel_eventos;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.solicitudes_cotizacion;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
