-- Respaldo IMEia: latido de Grok y manual con caducidad.
-- No modifica imeia_routing, no inserta tokens y no envía correo.
-- El detector de srv1715444 es quien cambia el modo local. Estas funciones
-- solo guardan el latido, el interruptor y la auditoría para que Grok
-- (sin SSH) y Hermes escriban en el mismo sitio.
-- Aplicar con el workflow manual de migraciones. Rollback al final.

create table if not exists public.imeia_latido (
  id boolean primary key default true check (id),
  estado text not null check (estado in ('ok', 'fallo', 'sin_tokens')),
  utc timestamptz not null,
  quien text not null,
  origen text not null check (origen in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina')),
  detalle text,
  updated_at timestamptz not null default now()
);

create table if not exists public.imeia_respaldo_manual (
  id boolean primary key default true check (id),
  activo boolean not null default false,
  quien text,
  motivo text,
  desde_utc timestamptz,
  expires_at timestamptz,
  origen text check (origen is null or origen in ('grok-tablon', 'hermes', 'telegram', 'cli')),
  updated_at timestamptz not null default now()
);
insert into public.imeia_respaldo_manual (id, activo)
values (true, false)
on conflict (id) do nothing;

create table if not exists public.imeia_modo_reportado (
  id boolean primary key default true check (id),
  modo text not null check (modo in ('normal', 'respaldo')),
  motivo text,
  quien text,
  origen text,
  at timestamptz not null default now()
);

create table if not exists public.imeia_respaldo_auditoria (
  id bigint generated always as identity primary key,
  utc timestamptz not null default now(),
  quien text not null,
  accion text not null,
  origen text not null check (origen in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina')),
  motivo text
);
create index if not exists idx_imeia_respaldo_auditoria_utc
  on public.imeia_respaldo_auditoria (utc desc);

alter table public.imeia_latido enable row level security;
alter table public.imeia_respaldo_manual enable row level security;
alter table public.imeia_modo_reportado enable row level security;
alter table public.imeia_respaldo_auditoria enable row level security;

revoke all on public.imeia_latido, public.imeia_respaldo_manual, public.imeia_modo_reportado, public.imeia_respaldo_auditoria
  from public, anon, authenticated;
revoke all on sequence public.imeia_respaldo_auditoria_id_seq from public, anon, authenticated;

create or replace function public.imeia_respaldo_autorizado(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, extensions
as $$
declare
  v_role text;
begin
  if public.imeia_worker_token_ok(p_token) then
    return true;
  end if;
  begin
    v_role := auth.role();
  exception when others then
    v_role := null;
  end;
  if coalesce(v_role, '') = '' then
    begin
      v_role := nullif(current_setting('request.jwt.claim.role', true), '');
    exception when others then
      v_role := null;
    end;
  end if;
  if coalesce(v_role, '') = '' and coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    begin
      v_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
    exception when others then
      v_role := null;
    end;
  end if;
  return coalesce(v_role = 'service_role', false);
end;
$$;

create or replace function public.imeia_latido_registrar(
  p_token text,
  p_estado text,
  p_quien text,
  p_origen text,
  p_detalle text default null,
  p_utc timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_utc timestamptz;
  v_quien text;
  v_detalle text;
begin
  if not public.imeia_respaldo_autorizado(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_estado not in ('ok', 'fallo', 'sin_tokens') then
    raise exception 'estado invalido';
  end if;
  if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina') then
    raise exception 'origen invalido';
  end if;
  v_quien := left(btrim(coalesce(p_quien, '')), 200);
  if v_quien = '' then
    raise exception 'quien requerido';
  end if;
  v_utc := coalesce(p_utc, now());
  v_detalle := left(nullif(btrim(coalesce(p_detalle, '')), ''), 500);
  if exists (select 1 from public.imeia_latido where id and utc > v_utc) then
    return jsonb_build_object('ignorado', true, 'motivo', 'latido_mas_viejo');
  end if;
  insert into public.imeia_latido (id, estado, utc, quien, origen, detalle, updated_at)
  values (true, p_estado, v_utc, v_quien, p_origen, v_detalle, now())
  on conflict (id) do update set
    estado = excluded.estado,
    utc = excluded.utc,
    quien = excluded.quien,
    origen = excluded.origen,
    detalle = excluded.detalle,
    updated_at = now();
  insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
  values (v_utc, v_quien, 'latido', p_origen, p_estado);
  return jsonb_build_object('estado', p_estado, 'utc', v_utc, 'quien', v_quien, 'origen', p_origen);
end;
$$;

create or replace function public.imeia_respaldo_set(
  p_token text,
  p_accion text,
  p_quien text,
  p_motivo text,
  p_origen text,
  p_horas numeric default 4
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion text;
  v_quien text;
  v_motivo text;
  v_horas numeric;
  v_desde timestamptz;
  v_expira timestamptz;
begin
  if not public.imeia_respaldo_autorizado(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  v_accion := lower(btrim(coalesce(p_accion, '')));
  if v_accion not in ('on', 'off') then
    raise exception 'accion invalida';
  end if;
  if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli') then
    raise exception 'origen invalido';
  end if;
  v_quien := left(btrim(coalesce(p_quien, '')), 200);
  if v_quien = '' then
    raise exception 'quien requerido';
  end if;
  v_motivo := left(btrim(coalesce(p_motivo, '')), 500);
  if v_accion = 'on' then
    v_horas := coalesce(p_horas, 4);
    if v_horas <= 0 or v_horas > 72 then
      raise exception 'horas invalidas';
    end if;
    v_desde := now();
    v_expira := v_desde + make_interval(secs => (v_horas * 3600)::double precision);
    update public.imeia_respaldo_manual set
      activo = true,
      quien = v_quien,
      motivo = v_motivo,
      desde_utc = v_desde,
      expires_at = v_expira,
      origen = p_origen,
      updated_at = v_desde
    where id;
    insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
    values (v_desde, v_quien, 'manual_on', p_origen, v_motivo);
    return jsonb_build_object(
      'accion', 'manual_on',
      'quien', v_quien,
      'motivo', v_motivo,
      'desde_utc', v_desde,
      'expires_at', v_expira,
      'origen', p_origen
    );
  end if;
  v_desde := now();
  update public.imeia_respaldo_manual set
    activo = false,
    quien = v_quien,
    motivo = v_motivo,
    origen = p_origen,
    updated_at = v_desde
  where id;
  insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
  values (v_desde, v_quien, 'manual_off', p_origen, v_motivo);
  return jsonb_build_object('accion', 'manual_off', 'quien', v_quien, 'origen', p_origen, 'utc', v_desde);
end;
$$;

create or replace function public.imeia_respaldo_expirar(p_token text, p_quien text, p_origen text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quien text;
  v_row public.imeia_respaldo_manual;
begin
  if not public.imeia_respaldo_autorizado(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina') then
    raise exception 'origen invalido';
  end if;
  v_quien := left(btrim(coalesce(p_quien, '')), 200);
  if v_quien = '' then
    raise exception 'quien requerido';
  end if;
  select * into v_row from public.imeia_respaldo_manual where id for update;
  if not found or not v_row.activo or v_row.expires_at is null or v_row.expires_at > now() then
    return jsonb_build_object('expirado', false);
  end if;
  update public.imeia_respaldo_manual set activo = false, updated_at = now() where id;
  insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
  values (now(), v_quien, 'manual_expirado', p_origen, left(coalesce(v_row.motivo, ''), 500));
  return jsonb_build_object('expirado', true, 'expires_at', v_row.expires_at);
end;
$$;

create or replace function public.imeia_modo_reportar(
  p_token text,
  p_modo text,
  p_motivo text,
  p_quien text,
  p_origen text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quien text;
  v_motivo text;
  v_prev text;
  v_prev_motivo text;
begin
  if not public.imeia_respaldo_autorizado(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_modo not in ('normal', 'respaldo') then
    raise exception 'modo invalido';
  end if;
  if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina') then
    raise exception 'origen invalido';
  end if;
  v_quien := left(btrim(coalesce(p_quien, '')), 200);
  if v_quien = '' then
    raise exception 'quien requerido';
  end if;
  v_motivo := left(btrim(coalesce(p_motivo, '')), 500);
  select modo, motivo into v_prev, v_prev_motivo from public.imeia_modo_reportado where id;
  if v_prev is not distinct from p_modo and v_prev_motivo is not distinct from v_motivo then
    return jsonb_build_object('cambio', false, 'modo', p_modo);
  end if;
  insert into public.imeia_modo_reportado (id, modo, motivo, quien, origen, at)
  values (true, p_modo, v_motivo, v_quien, p_origen, now())
  on conflict (id) do update set
    modo = excluded.modo,
    motivo = excluded.motivo,
    quien = excluded.quien,
    origen = excluded.origen,
    at = excluded.at;
  insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
  values (now(), v_quien, case when p_modo = 'respaldo' then 'modo_respaldo' else 'modo_normal' end, p_origen, v_motivo);
  return jsonb_build_object('cambio', true, 'modo', p_modo);
end;
$$;

create or replace function public.imeia_respaldo_pull(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_latido public.imeia_latido;
  v_manual public.imeia_respaldo_manual;
  v_modo public.imeia_modo_reportado;
  v_manual_json jsonb;
begin
  if not public.imeia_respaldo_autorizado(p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into v_latido from public.imeia_latido where id;
  if not found then
    v_latido := null;
  end if;
  select * into v_manual from public.imeia_respaldo_manual where id;
  if not found then
    v_manual := null;
  end if;
  select * into v_modo from public.imeia_modo_reportado where id;
  if not found then
    v_modo := null;
  end if;
  if v_manual is null or (v_manual.quien is null and not v_manual.activo) then
    v_manual_json := null;
  else
    v_manual_json := jsonb_build_object(
      'activo', v_manual.activo and v_manual.expires_at is not null and v_manual.expires_at > now(),
      'quien', v_manual.quien,
      'motivo', v_manual.motivo,
      'desde_utc', v_manual.desde_utc,
      'expires_at', v_manual.expires_at,
      'origen', v_manual.origen,
      'updated_at', v_manual.updated_at
    );
  end if;
  return jsonb_build_object(
    'latido', case when v_latido is null then null else jsonb_build_object(
      'estado', v_latido.estado,
      'utc', v_latido.utc,
      'quien', v_latido.quien,
      'origen', v_latido.origen,
      'detalle', v_latido.detalle
    ) end,
    'manual', v_manual_json,
    'manual_caducado', v_manual is not null and coalesce(v_manual.activo, false) and v_manual.expires_at is not null and v_manual.expires_at <= now(),
    'modo', case when v_modo is null then null else jsonb_build_object(
      'modo', v_modo.modo,
      'motivo', v_modo.motivo,
      'quien', v_modo.quien,
      'origen', v_modo.origen,
      'at', v_modo.at
    ) end
  );
end;
$$;

revoke all on function public.imeia_respaldo_autorizado(text) from public, anon, authenticated;
revoke all on function public.imeia_latido_registrar(text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.imeia_respaldo_set(text, text, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.imeia_respaldo_expirar(text, text, text) from public, anon, authenticated;
revoke all on function public.imeia_modo_reportar(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.imeia_respaldo_pull(text) from public, anon, authenticated;

grant execute on function public.imeia_latido_registrar(text, text, text, text, text, timestamptz) to anon, service_role;
grant execute on function public.imeia_respaldo_set(text, text, text, text, text, numeric) to anon, service_role;
grant execute on function public.imeia_respaldo_expirar(text, text, text) to anon, service_role;
grant execute on function public.imeia_modo_reportar(text, text, text, text, text) to anon, service_role;
grant execute on function public.imeia_respaldo_pull(text) to anon, service_role;

-- Rollback (no toca imeia_routing ni la cola Hermes):
-- revoke all on function public.imeia_respaldo_pull(text) from anon, service_role, public;
-- revoke all on function public.imeia_modo_reportar(text, text, text, text, text) from anon, service_role, public;
-- revoke all on function public.imeia_respaldo_expirar(text, text, text) from anon, service_role, public;
-- revoke all on function public.imeia_respaldo_set(text, text, text, text, text, numeric) from anon, service_role, public;
-- revoke all on function public.imeia_latido_registrar(text, text, text, text, text, timestamptz) from anon, service_role, public;
-- drop function if exists public.imeia_respaldo_pull(text);
-- drop function if exists public.imeia_modo_reportar(text, text, text, text, text);
-- drop function if exists public.imeia_respaldo_expirar(text, text, text);
-- drop function if exists public.imeia_respaldo_set(text, text, text, text, text, numeric);
-- drop function if exists public.imeia_latido_registrar(text, text, text, text, text, timestamptz);
-- drop function if exists public.imeia_respaldo_autorizado(text);
-- drop table if exists public.imeia_respaldo_auditoria;
-- drop table if exists public.imeia_modo_reportado;
-- drop table if exists public.imeia_respaldo_manual;
-- drop table if exists public.imeia_latido;
