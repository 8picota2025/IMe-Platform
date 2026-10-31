-- Alcance minimo de imeia_worker_tokens.
-- Los tokens ya existentes quedan alcance 'worker' (default de la columna):
-- su comportamiento no cambia. No inserta tokens y no modifica imeia_routing.
-- anon y authenticated no leen la tabla ni ejecutan imeia_token_alcance_ok.
-- Aplicar con el workflow manual de migraciones. Rollback al final, comentado.
--
-- worker: todo (latido, pull, ON/OFF, expirar, modo, ruta, cola, RAG).
-- respaldo_lectura: solo imeia_respaldo_pull.
-- respaldo_latido: solo imeia_latido_registrar.
-- imeia_worker_token_ok pasa a significar alcance worker. Un token de otro
-- alcance deja de colar en los caller que solo miraban "token activo".

alter table public.imeia_worker_tokens
  add column if not exists alcance text not null default 'worker';

alter table public.imeia_worker_tokens
  drop constraint if exists imeia_worker_tokens_alcance_chk;

alter table public.imeia_worker_tokens
  add constraint imeia_worker_tokens_alcance_chk
  check (alcance in ('worker', 'respaldo_lectura', 'respaldo_latido'));

comment on column public.imeia_worker_tokens.alcance is
  'worker | respaldo_lectura | respaldo_latido. Default worker para no cambiar tokens ya creados.';

create or replace function public.imeia_token_alcance_ok(p_token text, p_alcance text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.imeia_worker_tokens
     where activo
       and alcance = p_alcance
       and token_sha256 = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  );
$$;

revoke all on function public.imeia_token_alcance_ok(text, text) from public, anon, authenticated;
grant execute on function public.imeia_token_alcance_ok(text, text) to service_role;

-- No devuelve nada si el token esta autorizado. Token activo de otro alcance: forbidden (42501).
-- Token desconocido o inactivo: unauthorized (42501), o p_error_ajeno si no es ese texto.
-- service_role solo cuela con p_token vacio (Bearer secreto en la edge). Un token
-- presentado se juzga por alcance aunque la sesion sea service_role.
create or replace function public.imeia_exige_alcance(
  p_token text,
  p_alcances text[],
  p_service boolean,
  p_error_ajeno text default 'unauthorized'
) returns void
language plpgsql
stable
security definer
set search_path = public, auth, extensions
as $$
declare
  v_role text;
  v_alcance text;
begin
  if p_alcances is not null then
    foreach v_alcance in array p_alcances loop
      if public.imeia_token_alcance_ok(p_token, v_alcance) then
        return;
      end if;
    end loop;
  end if;
  if p_service and btrim(coalesce(p_token, '')) = '' then
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
    if coalesce(v_role = 'service_role', false) then
      return;
    end if;
  end if;
  if exists (
    select 1
      from public.imeia_worker_tokens
     where activo
       and token_sha256 = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_error_ajeno = 'unauthorized' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  raise exception using message = p_error_ajeno, errcode = 'P0001';
end;
$$;

revoke all on function public.imeia_exige_alcance(text, text[], boolean, text) from public, anon, authenticated;

revoke all on public.imeia_worker_tokens from public, anon, authenticated;

create or replace function public.imeia_worker_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.imeia_token_alcance_ok(p_token, 'worker');
$$;

create or replace function public.imeia_respaldo_autorizado(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.imeia_exige_alcance(p_token, array['worker'], true);
  return true;
exception
  when insufficient_privilege then
    return false;
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
  perform public.imeia_exige_alcance(p_token, array['worker', 'respaldo_latido'], true);
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
  perform public.imeia_exige_alcance(p_token, array['worker'], true);
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
  perform public.imeia_exige_alcance(p_token, array['worker'], true);
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
  perform public.imeia_exige_alcance(p_token, array['worker'], true);
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
  perform public.imeia_exige_alcance(p_token, array['worker', 'respaldo_lectura'], true);
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

create or replace function public.imeia_set_route(p_token text, p_target text, p_motivo text, p_hold_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prev text; v_salud jsonb;
begin
  perform public.imeia_exige_alcance(p_token, array['worker'], false);
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

create or replace function public.imeia_worker_claim(p_token text, p_limit int default 5)
returns setof public.imeia_hermes_queue language plpgsql security definer set search_path = public as $$
begin
  perform public.imeia_exige_alcance(p_token, array['worker'], false);
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
  perform public.imeia_exige_alcance(p_token, array['worker'], false);
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

create or replace function public.imeia_health_worker(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.imeia_exige_alcance(p_token, array['worker'], false);
  return public.imeia_health();
end $$;

create or replace function public.rag_embed_set_endpoint(p_token text, p_url text, p_embed_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public.imeia_exige_alcance(p_token, array['worker'], false, 'token invalido');
  insert into public.rag_embed_config (id, url, token) values (1, p_url, p_embed_token)
  on conflict (id) do update set url = excluded.url, token = excluded.token, activo = true, actualizado_at = now();
  return true;
end $$;

create or replace function public.rag_chunks_pendientes(p_token text, p_limit integer default 50)
returns table(id uuid, sku text, nombre_es text, descripcion_corta_es text, descripcion_larga_es text,
  aplicaciones_es text[], especificaciones jsonb, fuente_hash text)
language plpgsql security definer set search_path = public as $$
begin
  perform public.imeia_exige_alcance(p_token, array['worker'], false, 'token invalido');
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
  perform public.imeia_exige_alcance(p_token, array['worker'], false, 'token invalido');
  delete from public.producto_chunks where producto_id = p_producto_id;
  insert into public.producto_chunks (producto_id, sku, orden, nivel, contenido, tokens_aprox, fuente_hash, modelo, embedding)
  select p_producto_id, p.sku, (e->>'orden')::int, coalesce(e->>'nivel', 'L2'), e->>'contenido', (e->>'tokens')::int,
         p_hash, coalesce(e->>'modelo', 'bge-m3'), (e->'embedding')::text::vector
    from jsonb_array_elements(p_chunks) e, public.productos p where p.id = p_producto_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Ejecutar a mano el bloque ROLLBACK_BEGIN, quitando el prefijo '-- ' de cada linea.
-- No toca imeia_routing ni borra filas de imeia_worker_tokens: quita la columna
-- alcance y devuelve las funciones al comportamiento anterior (cualquier token activo).
-- ROLLBACK_BEGIN
-- create or replace function public.imeia_worker_token_ok(p_token text)
-- returns boolean language sql stable security definer set search_path = public, extensions as $$
--   select exists (select 1 from public.imeia_worker_tokens
--                   where activo and token_sha256 = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex'));
-- $$;
--
-- create or replace function public.imeia_respaldo_autorizado(p_token text)
-- returns boolean
-- language plpgsql
-- stable
-- security definer
-- set search_path = public, auth, extensions
-- as $$
-- declare
--   v_role text;
-- begin
--   if public.imeia_worker_token_ok(p_token) then
--     return true;
--   end if;
--   begin
--     v_role := auth.role();
--   exception when others then
--     v_role := null;
--   end;
--   if coalesce(v_role, '') = '' then
--     begin
--       v_role := nullif(current_setting('request.jwt.claim.role', true), '');
--     exception when others then
--       v_role := null;
--     end;
--   end if;
--   if coalesce(v_role, '') = '' and coalesce(current_setting('request.jwt.claims', true), '') <> '' then
--     begin
--       v_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
--     exception when others then
--       v_role := null;
--     end;
--   end if;
--   return coalesce(v_role = 'service_role', false);
-- end;
-- $$;
--
-- create or replace function public.imeia_latido_registrar(
--   p_token text,
--   p_estado text,
--   p_quien text,
--   p_origen text,
--   p_detalle text default null,
--   p_utc timestamptz default null
-- ) returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_utc timestamptz;
--   v_quien text;
--   v_detalle text;
-- begin
--   if not public.imeia_respaldo_autorizado(p_token) then
--     raise exception 'unauthorized' using errcode = '42501';
--   end if;
--   if p_estado not in ('ok', 'fallo', 'sin_tokens') then
--     raise exception 'estado invalido';
--   end if;
--   if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina') then
--     raise exception 'origen invalido';
--   end if;
--   v_quien := left(btrim(coalesce(p_quien, '')), 200);
--   if v_quien = '' then
--     raise exception 'quien requerido';
--   end if;
--   v_utc := coalesce(p_utc, now());
--   v_detalle := left(nullif(btrim(coalesce(p_detalle, '')), ''), 500);
--   if exists (select 1 from public.imeia_latido where id and utc > v_utc) then
--     return jsonb_build_object('ignorado', true, 'motivo', 'latido_mas_viejo');
--   end if;
--   insert into public.imeia_latido (id, estado, utc, quien, origen, detalle, updated_at)
--   values (true, p_estado, v_utc, v_quien, p_origen, v_detalle, now())
--   on conflict (id) do update set
--     estado = excluded.estado,
--     utc = excluded.utc,
--     quien = excluded.quien,
--     origen = excluded.origen,
--     detalle = excluded.detalle,
--     updated_at = now();
--   insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
--   values (v_utc, v_quien, 'latido', p_origen, p_estado);
--   return jsonb_build_object('estado', p_estado, 'utc', v_utc, 'quien', v_quien, 'origen', p_origen);
-- end;
-- $$;
--
-- create or replace function public.imeia_respaldo_set(
--   p_token text,
--   p_accion text,
--   p_quien text,
--   p_motivo text,
--   p_origen text,
--   p_horas numeric default 4
-- ) returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_accion text;
--   v_quien text;
--   v_motivo text;
--   v_horas numeric;
--   v_desde timestamptz;
--   v_expira timestamptz;
-- begin
--   if not public.imeia_respaldo_autorizado(p_token) then
--     raise exception 'unauthorized' using errcode = '42501';
--   end if;
--   v_accion := lower(btrim(coalesce(p_accion, '')));
--   if v_accion not in ('on', 'off') then
--     raise exception 'accion invalida';
--   end if;
--   if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli') then
--     raise exception 'origen invalido';
--   end if;
--   v_quien := left(btrim(coalesce(p_quien, '')), 200);
--   if v_quien = '' then
--     raise exception 'quien requerido';
--   end if;
--   v_motivo := left(btrim(coalesce(p_motivo, '')), 500);
--   if v_accion = 'on' then
--     v_horas := coalesce(p_horas, 4);
--     if v_horas <= 0 or v_horas > 72 then
--       raise exception 'horas invalidas';
--     end if;
--     v_desde := now();
--     v_expira := v_desde + make_interval(secs => (v_horas * 3600)::double precision);
--     update public.imeia_respaldo_manual set
--       activo = true,
--       quien = v_quien,
--       motivo = v_motivo,
--       desde_utc = v_desde,
--       expires_at = v_expira,
--       origen = p_origen,
--       updated_at = v_desde
--     where id;
--     insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
--     values (v_desde, v_quien, 'manual_on', p_origen, v_motivo);
--     return jsonb_build_object(
--       'accion', 'manual_on',
--       'quien', v_quien,
--       'motivo', v_motivo,
--       'desde_utc', v_desde,
--       'expires_at', v_expira,
--       'origen', p_origen
--     );
--   end if;
--   v_desde := now();
--   update public.imeia_respaldo_manual set
--     activo = false,
--     quien = v_quien,
--     motivo = v_motivo,
--     origen = p_origen,
--     updated_at = v_desde
--   where id;
--   insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
--   values (v_desde, v_quien, 'manual_off', p_origen, v_motivo);
--   return jsonb_build_object('accion', 'manual_off', 'quien', v_quien, 'origen', p_origen, 'utc', v_desde);
-- end;
-- $$;
--
-- create or replace function public.imeia_respaldo_expirar(p_token text, p_quien text, p_origen text)
-- returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_quien text;
--   v_row public.imeia_respaldo_manual;
-- begin
--   if not public.imeia_respaldo_autorizado(p_token) then
--     raise exception 'unauthorized' using errcode = '42501';
--   end if;
--   if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina') then
--     raise exception 'origen invalido';
--   end if;
--   v_quien := left(btrim(coalesce(p_quien, '')), 200);
--   if v_quien = '' then
--     raise exception 'quien requerido';
--   end if;
--   select * into v_row from public.imeia_respaldo_manual where id for update;
--   if not found or not v_row.activo or v_row.expires_at is null or v_row.expires_at > now() then
--     return jsonb_build_object('expirado', false);
--   end if;
--   update public.imeia_respaldo_manual set activo = false, updated_at = now() where id;
--   insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
--   values (now(), v_quien, 'manual_expirado', p_origen, left(coalesce(v_row.motivo, ''), 500));
--   return jsonb_build_object('expirado', true, 'expires_at', v_row.expires_at);
-- end;
-- $$;
--
-- create or replace function public.imeia_modo_reportar(
--   p_token text,
--   p_modo text,
--   p_motivo text,
--   p_quien text,
--   p_origen text
-- ) returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_quien text;
--   v_motivo text;
--   v_prev text;
--   v_prev_motivo text;
-- begin
--   if not public.imeia_respaldo_autorizado(p_token) then
--     raise exception 'unauthorized' using errcode = '42501';
--   end if;
--   if p_modo not in ('normal', 'respaldo') then
--     raise exception 'modo invalido';
--   end if;
--   if p_origen not in ('grok-tablon', 'hermes', 'telegram', 'cli', 'emilio', 'rutina') then
--     raise exception 'origen invalido';
--   end if;
--   v_quien := left(btrim(coalesce(p_quien, '')), 200);
--   if v_quien = '' then
--     raise exception 'quien requerido';
--   end if;
--   v_motivo := left(btrim(coalesce(p_motivo, '')), 500);
--   select modo, motivo into v_prev, v_prev_motivo from public.imeia_modo_reportado where id;
--   if v_prev is not distinct from p_modo and v_prev_motivo is not distinct from v_motivo then
--     return jsonb_build_object('cambio', false, 'modo', p_modo);
--   end if;
--   insert into public.imeia_modo_reportado (id, modo, motivo, quien, origen, at)
--   values (true, p_modo, v_motivo, v_quien, p_origen, now())
--   on conflict (id) do update set
--     modo = excluded.modo,
--     motivo = excluded.motivo,
--     quien = excluded.quien,
--     origen = excluded.origen,
--     at = excluded.at;
--   insert into public.imeia_respaldo_auditoria (utc, quien, accion, origen, motivo)
--   values (now(), v_quien, case when p_modo = 'respaldo' then 'modo_respaldo' else 'modo_normal' end, p_origen, v_motivo);
--   return jsonb_build_object('cambio', true, 'modo', p_modo);
-- end;
-- $$;
--
-- create or replace function public.imeia_respaldo_pull(p_token text)
-- returns jsonb
-- language plpgsql
-- stable
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_latido public.imeia_latido;
--   v_manual public.imeia_respaldo_manual;
--   v_modo public.imeia_modo_reportado;
--   v_manual_json jsonb;
-- begin
--   if not public.imeia_respaldo_autorizado(p_token) then
--     raise exception 'unauthorized' using errcode = '42501';
--   end if;
--   select * into v_latido from public.imeia_latido where id;
--   if not found then
--     v_latido := null;
--   end if;
--   select * into v_manual from public.imeia_respaldo_manual where id;
--   if not found then
--     v_manual := null;
--   end if;
--   select * into v_modo from public.imeia_modo_reportado where id;
--   if not found then
--     v_modo := null;
--   end if;
--   if v_manual is null or (v_manual.quien is null and not v_manual.activo) then
--     v_manual_json := null;
--   else
--     v_manual_json := jsonb_build_object(
--       'activo', v_manual.activo and v_manual.expires_at is not null and v_manual.expires_at > now(),
--       'quien', v_manual.quien,
--       'motivo', v_manual.motivo,
--       'desde_utc', v_manual.desde_utc,
--       'expires_at', v_manual.expires_at,
--       'origen', v_manual.origen,
--       'updated_at', v_manual.updated_at
--     );
--   end if;
--   return jsonb_build_object(
--     'latido', case when v_latido is null then null else jsonb_build_object(
--       'estado', v_latido.estado,
--       'utc', v_latido.utc,
--       'quien', v_latido.quien,
--       'origen', v_latido.origen,
--       'detalle', v_latido.detalle
--     ) end,
--     'manual', v_manual_json,
--     'manual_caducado', v_manual is not null and coalesce(v_manual.activo, false) and v_manual.expires_at is not null and v_manual.expires_at <= now(),
--     'modo', case when v_modo is null then null else jsonb_build_object(
--       'modo', v_modo.modo,
--       'motivo', v_modo.motivo,
--       'quien', v_modo.quien,
--       'origen', v_modo.origen,
--       'at', v_modo.at
--     ) end
--   );
-- end;
-- $$;
--
-- create or replace function public.imeia_set_route(p_token text, p_target text, p_motivo text, p_hold_until timestamptz default null)
-- returns jsonb language plpgsql security definer set search_path = public as $$
-- declare v_prev text; v_salud jsonb;
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
--   if p_target not in ('grokbot','hermes') then raise exception 'target invalido'; end if;
--   select target into v_prev from imeia_routing where id for update;
--   v_salud := public.imeia_health();
--   if v_prev is distinct from p_target then
--     update imeia_routing set target = p_target, since = now(), hold_until = p_hold_until,
--            motivo = left(p_motivo, 500), updated_at = now() where id;
--     insert into imeia_failover_log(desde, hacia, motivo, salud) values (v_prev, p_target, left(p_motivo,500), v_salud);
--   end if;
--   return jsonb_build_object('previo', v_prev, 'actual', p_target, 'cambio', v_prev is distinct from p_target);
-- end $$;
--
-- create or replace function public.imeia_worker_claim(p_token text, p_limit int default 5)
-- returns setof public.imeia_hermes_queue language plpgsql security definer set search_path = public as $$
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
--   -- Turnos web pendientes (solo con ruta hermes, o estancados >60 s sin respuesta de Grok).
--   insert into imeia_hermes_queue(canal, ref, payload)
--   select 'web', t.id::text, jsonb_build_object('turn_id', t.id, 'mensaje', t.mensaje, 'historial', t.historial,
--          'locale', t.locale, 'navigation_context', t.navigation_context, 'session_id', t.session_id,
--          'conversation_id', t.conversation_id, 'received_at', t.created_at)
--     from asesor_agent_turns t
--    where t.status = 'pending' and t.created_at > now() - interval '170 seconds'
--      and (select target from imeia_routing where id) = 'hermes'
--   on conflict (canal, ref) do nothing;
--   -- Reclamos vencidos vuelven a pendiente.
--   update imeia_hermes_queue set status = 'pending', claimed_at = null
--    where status = 'claimed' and claimed_at < now() - interval '5 minutes' and intentos < 3;
--   return query
--   update imeia_hermes_queue q set status = 'claimed', claimed_at = now(), intentos = q.intentos + 1, updated_at = now()
--    where q.id in (select id from imeia_hermes_queue where status = 'pending' order by created_at limit greatest(1, least(p_limit, 20))
--                   for update skip locked)
--   returning q.*;
-- end $$;
--
-- create or replace function public.imeia_worker_done(p_token text, p_id bigint, p_ok boolean, p_reply text default null, p_error text default null)
-- returns void language plpgsql security definer set search_path = public as $$
-- declare v_q imeia_hermes_queue;
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
--   update imeia_hermes_queue set status = case when p_ok then 'done' else 'failed' end,
--          error = left(p_error, 500), updated_at = now()
--    where id = p_id returning * into v_q;
--   if v_q.id is null then return; end if;
--   if v_q.canal = 'web' then
--     if p_ok and coalesce(btrim(p_reply), '') <> '' then
--       update asesor_agent_turns set reply_texto = p_reply, status = 'replied'
--        where id = v_q.ref::uuid and status = 'pending';
--     else
--       update asesor_agent_turns set status = 'failed', error = left(coalesce(p_error,'hermes_failed'), 500)
--        where id = v_q.ref::uuid and status = 'pending';
--     end if;
--   elsif not p_ok then
--     perform public.fail_whatsapp_batch((v_q.ref)::uuid, left(coalesce(p_error,'hermes_failed'),500), true);
--   end if;
-- end $$;
--
-- create or replace function public.imeia_health_worker(p_token text)
-- returns jsonb language plpgsql stable security definer set search_path = public as $$
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'unauthorized' using errcode = '42501'; end if;
--   return public.imeia_health();
-- end $$;
--
-- create or replace function public.rag_embed_set_endpoint(p_token text, p_url text, p_embed_token text)
-- returns boolean language plpgsql security definer set search_path = public as $$
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'token invalido'; end if;
--   insert into public.rag_embed_config (id, url, token) values (1, p_url, p_embed_token)
--   on conflict (id) do update set url = excluded.url, token = excluded.token, activo = true, actualizado_at = now();
--   return true;
-- end $$;
--
-- create or replace function public.rag_chunks_pendientes(p_token text, p_limit integer default 50)
-- returns table(id uuid, sku text, nombre_es text, descripcion_corta_es text, descripcion_larga_es text,
--   aplicaciones_es text[], especificaciones jsonb, fuente_hash text)
-- language plpgsql security definer set search_path = public as $$
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'token invalido'; end if;
--   -- limpiar chunks de productos inactivos
--   delete from public.producto_chunks c using public.productos p where p.id = c.producto_id and not p.activo;
--   return query
--   select p.id, p.sku, p.nombre_es, p.descripcion_corta_es, p.descripcion_larga_es, p.aplicaciones_es, p.especificaciones,
--          public.producto_fuente_hash(p)
--     from public.productos p
--    where p.activo
--      and not exists (select 1 from public.producto_chunks c
--                       where c.producto_id = p.id and c.fuente_hash = public.producto_fuente_hash(p))
--    order by p.updated_at desc
--    limit greatest(1, least(p_limit, 500));
-- end $$;
--
-- create or replace function public.rag_chunks_guardar(p_token text, p_producto_id uuid, p_hash text, p_chunks jsonb)
-- returns integer language plpgsql security definer set search_path = public as $$
-- declare n integer;
-- begin
--   if not public.imeia_worker_token_ok(p_token) then raise exception 'token invalido'; end if;
--   delete from public.producto_chunks where producto_id = p_producto_id;
--   insert into public.producto_chunks (producto_id, sku, orden, nivel, contenido, tokens_aprox, fuente_hash, modelo, embedding)
--   select p_producto_id, p.sku, (e->>'orden')::int, coalesce(e->>'nivel', 'L2'), e->>'contenido', (e->>'tokens')::int,
--          p_hash, coalesce(e->>'modelo', 'bge-m3'), (e->'embedding')::text::vector
--     from jsonb_array_elements(p_chunks) e, public.productos p where p.id = p_producto_id;
--   get diagnostics n = row_count;
--   return n;
-- end $$;
--
-- drop function if exists public.imeia_exige_alcance(text, text[], boolean, text);
-- drop function if exists public.imeia_token_alcance_ok(text, text);
-- alter table public.imeia_worker_tokens drop constraint if exists imeia_worker_tokens_alcance_chk;
-- alter table public.imeia_worker_tokens drop column if exists alcance;
-- ROLLBACK_END
