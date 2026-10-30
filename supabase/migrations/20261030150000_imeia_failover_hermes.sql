-- Failover sin tokens IMEia: Grok Bot (push por webhook) <-> Hermes (pull desde srv1715444).
-- Supabase no alcanza la tailnet, por eso Hermes trabaja por cola + RPC con token propio.
-- Rollback (al final, comentado).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.imeia_routing (
  id boolean primary key default true check (id),
  target text not null default 'grokbot' check (target in ('grokbot','hermes')),
  since timestamptz not null default now(),
  hold_until timestamptz,
  motivo text,
  updated_at timestamptz not null default now()
);
insert into public.imeia_routing(id) values (true) on conflict (id) do nothing;

create table if not exists public.imeia_failover_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  desde text,
  hacia text,
  motivo text,
  salud jsonb
);

create table if not exists public.imeia_hermes_queue (
  id bigint generated always as identity primary key,
  canal text not null check (canal in ('whatsapp','web')),
  ref text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','claimed','done','failed')),
  claimed_at timestamptz,
  intentos int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal, ref)
);
create index if not exists idx_imeia_hermes_queue_status on public.imeia_hermes_queue(status, created_at);

create table if not exists public.imeia_worker_tokens (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  token_sha256 text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.imeia_routing enable row level security;
alter table public.imeia_failover_log enable row level security;
alter table public.imeia_hermes_queue enable row level security;
alter table public.imeia_worker_tokens enable row level security;
revoke all on public.imeia_routing, public.imeia_failover_log, public.imeia_hermes_queue, public.imeia_worker_tokens from anon, authenticated;

create or replace function public.imeia_worker_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.imeia_worker_tokens
                  where activo and token_sha256 = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex'));
$$;

-- Salud de Grok Bot medida solo con datos de BD (cero tokens).
create or replace function public.imeia_health()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'at', now(),
    'wa_estancados', (select count(*) from whatsapp_inbound_events
                       where status = 'pending_agent' and agent_claimed_at is not null
                         and agent_claimed_at < now() - interval '4 minutes'
                         and created_at > now() - interval '2 hours'),
    'wa_wake_errores_15m', (select count(*) from whatsapp_inbound_events
                       where updated_at > now() - interval '15 minutes'
                         and last_error ~ '^wake_(http_(4|5)[0-9]{2}|timeout|network_error)$'),
    'wa_respondidos_15m', (select count(*) from whatsapp_inbound_events
                       where status not in ('pending_agent') and updated_at > now() - interval '15 minutes'
                         and agent_claimed_at is not null),
    'web_fallidos_15m', (select count(*) from asesor_agent_turns
                       where status in ('failed','timeout') and updated_at > now() - interval '15 minutes'),
    'web_respondidos_15m', (select count(*) from asesor_agent_turns
                       where status = 'replied' and updated_at > now() - interval '15 minutes'),
    'web_estancados', (select count(*) from asesor_agent_turns
                       where status = 'pending' and created_at < now() - interval '3 minutes'
                         and created_at > now() - interval '2 hours'),
    'cola_hermes_pendiente', (select count(*) from imeia_hermes_queue where status in ('pending','claimed')),
    'ruta', (select to_jsonb(r) from imeia_routing r where id)
  );
$$;

create or replace function public.imeia_set_route(p_token text, p_target text, p_motivo text, p_hold_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev text; v_salud jsonb;
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_target not in ('grokbot','hermes') then raise exception 'target invalido'; end if;
  select target into v_prev from imeia_routing where id for update;
  v_salud := public.imeia_health();
  if v_prev is distinct from p_target then
    update imeia_routing set target = p_target, since = now(), hold_until = p_hold_until,
           motivo = left(p_motivo, 500), updated_at = now() where id;
    insert into imeia_failover_log(desde, hacia, motivo, salud) values (v_prev, p_target, left(p_motivo,500), v_salud);
  end if;
  return jsonb_build_object('previo', v_prev, 'actual', p_target, 'cambio', v_prev is distinct from p_target);
end $$;

-- El worker toma trabajo: WA ya encolado por el dispatch + turnos web pendientes.
create or replace function public.imeia_worker_claim(p_token text, p_limit int default 5)
returns setof public.imeia_hermes_queue language plpgsql security definer set search_path = public as $$
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- Turnos web pendientes (solo con ruta hermes, o estancados >60 s sin respuesta de Grok).
  insert into imeia_hermes_queue(canal, ref, payload)
  select 'web', t.id::text, jsonb_build_object('turn_id', t.id, 'mensaje', t.mensaje, 'historial', t.historial,
         'locale', t.locale, 'navigation_context', t.navigation_context, 'session_id', t.session_id,
         'conversation_id', t.conversation_id, 'received_at', t.created_at)
    from asesor_agent_turns t
   where t.status = 'pending' and t.created_at > now() - interval '170 seconds'
     and (select target from imeia_routing where id) = 'hermes'
  on conflict (canal, ref) do nothing;
  -- Reclamos vencidos vuelven a pendiente.
  update imeia_hermes_queue set status = 'pending', claimed_at = null
   where status = 'claimed' and claimed_at < now() - interval '5 minutes' and intentos < 3;
  return query
  update imeia_hermes_queue q set status = 'claimed', claimed_at = now(), intentos = q.intentos + 1, updated_at = now()
   where q.id in (select id from imeia_hermes_queue where status = 'pending' order by created_at limit greatest(1, least(p_limit, 20))
                  for update skip locked)
  returning q.*;
end $$;

create or replace function public.imeia_worker_done(p_token text, p_id bigint, p_ok boolean, p_reply text default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_q imeia_hermes_queue;
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
  update imeia_hermes_queue set status = case when p_ok then 'done' else 'failed' end,
         error = left(p_error, 500), updated_at = now()
   where id = p_id returning * into v_q;
  if v_q.id is null then return; end if;
  if v_q.canal = 'web' then
    if p_ok and coalesce(btrim(p_reply), '') <> '' then
      update asesor_agent_turns set reply_texto = p_reply, status = 'replied'
       where id = v_q.ref::uuid and status = 'pending';
    else
      update asesor_agent_turns set status = 'failed', error = left(coalesce(p_error,'hermes_failed'), 500)
       where id = v_q.ref::uuid and status = 'pending';
    end if;
  elsif not p_ok then
    perform public.fail_whatsapp_batch((v_q.ref)::uuid, left(coalesce(p_error,'hermes_failed'),500), true);
  end if;
end $$;

-- Búsqueda RAG para el worker (misma función que usa la web, solo lectura).
revoke all on function public.imeia_worker_token_ok(text) from public, anon, authenticated;
revoke all on function public.imeia_health() from public, anon, authenticated;
grant execute on function public.imeia_worker_token_ok(text) to service_role, anon;
grant execute on function public.imeia_health() to service_role;
revoke all on function public.imeia_set_route(text, text, text, timestamptz) from public;
revoke all on function public.imeia_worker_claim(text, int) from public;
revoke all on function public.imeia_worker_done(text, bigint, boolean, text, text) from public;
grant execute on function public.imeia_set_route(text, text, text, timestamptz) to anon, service_role;
grant execute on function public.imeia_worker_claim(text, int) to anon, service_role;
grant execute on function public.imeia_worker_done(text, bigint, boolean, text, text) to anon, service_role;

-- Salud pública mínima para el monitor (requiere token).
create or replace function public.imeia_health_worker(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
  return public.imeia_health();
end $$;
revoke all on function public.imeia_health_worker(text) from public;
grant execute on function public.imeia_health_worker(text) to anon, service_role;

-- Rollback:
-- drop function if exists public.imeia_health_worker(text), public.imeia_worker_done(text,bigint,boolean,text,text),
--   public.imeia_worker_claim(text,int), public.imeia_set_route(text,text,text,timestamptz), public.imeia_health(),
--   public.imeia_worker_token_ok(text);
-- drop table if exists public.imeia_worker_tokens, public.imeia_hermes_queue, public.imeia_failover_log, public.imeia_routing;
