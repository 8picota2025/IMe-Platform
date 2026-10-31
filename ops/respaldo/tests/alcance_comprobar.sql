-- Comprueba minimo privilegio. Falla con excepcion si algo no cuadra.
-- Tokens de prueba, no son secretos de produccion.

do $$ begin
  if current_setting('server_version_num')::int / 10000 <> 16 then
    raise exception 'postgres %, se esperaba 16', current_setting('server_version');
  end if;
  if encode(extensions.digest('abc', 'sha256'), 'hex')
     <> 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' then
    raise exception 'digest no es sha256';
  end if;
end $$;

insert into public.imeia_worker_tokens (nombre, token_sha256, alcance)
values
  ('lectura', encode(extensions.digest('token-lectura-prueba-alcance-0001', 'sha256'), 'hex'), 'respaldo_lectura'),
  ('latido', encode(extensions.digest('token-latido-prueba-alcance-0001', 'sha256'), 'hex'), 'respaldo_latido');

do $$ begin
  if (select alcance from public.imeia_worker_tokens where nombre = 'legacy') <> 'worker' then
    raise exception 'el token previo no quedo en worker';
  end if;
  if exists (
    select 1 from public.imeia_worker_tokens
     where token_sha256 in (
       'token-legacy-prueba-alcance-0001',
       'token-lectura-prueba-alcance-0001',
       'token-latido-prueba-alcance-0001'
     )
        or length(token_sha256) <> 64
  ) then
    raise exception 'el secreto no debe guardarse en claro';
  end if;
  if public.imeia_worker_token_ok('token-legacy-prueba-alcance-0001') is not true then
    raise exception 'worker_token_ok debio aceptar al worker';
  end if;
  if public.imeia_worker_token_ok('token-lectura-prueba-alcance-0001') then
    raise exception 'worker_token_ok no debe aceptar lectura';
  end if;
  if public.imeia_worker_token_ok('token-latido-prueba-alcance-0001') then
    raise exception 'worker_token_ok no debe aceptar latido';
  end if;
  if public.imeia_respaldo_autorizado('token-lectura-prueba-alcance-0001') then
    raise exception 'autorizado no debe dejar pasar lectura';
  end if;
  if public.imeia_respaldo_autorizado('token-legacy-prueba-alcance-0001') is not true then
    raise exception 'autorizado debio dejar pasar al worker';
  end if;
end $$;

create temp table ruta_antes as table public.imeia_routing;
create temp table log_antes as select count(*)::int as n from public.imeia_failover_log;

create or replace procedure pg_temp.espera(p_sql text, p_like text)
language plpgsql
as $$
declare
  v jsonb;
begin
  execute 'select to_jsonb(s) from (' || p_sql || ') s' into v;
  raise exception 'debio fallar: %', left(p_sql, 180);
exception
  when others then
    if sqlerrm like 'debio fallar:%' then
      raise;
    end if;
    if sqlerrm !~ p_like then
      raise exception 'obtuve [%] y se esperaba [%] en [%]', sqlerrm, p_like, left(p_sql, 180);
    end if;
end;
$$;

create or replace procedure pg_temp.ok(p_sql text)
language plpgsql
as $$
declare
  n int;
begin
  execute 'select count(*)::int from (' || p_sql || ') s' into n;
end;
$$;

do $$ begin
  set local role anon;
  begin
    perform public.imeia_token_alcance_ok('x', 'worker');
    raise exception 'anon ejecuto imeia_token_alcance_ok';
  exception when insufficient_privilege then
    if sqlerrm !~ 'permission denied' then
      raise exception 'anon: %', sqlerrm;
    end if;
  end;
  begin
    perform 1 from public.imeia_worker_tokens;
    raise exception 'anon leyo tokens';
  exception when insufficient_privilege then
    if sqlerrm !~ 'permission denied' then
      raise exception 'anon tabla: %', sqlerrm;
    end if;
  end;
  reset role;

  set local role authenticated;
  begin
    perform public.imeia_token_alcance_ok('x', 'respaldo_latido');
    raise exception 'authenticated ejecuto imeia_token_alcance_ok';
  exception when insufficient_privilege then
    if sqlerrm !~ 'permission denied' then
      raise exception 'authenticated: %', sqlerrm;
    end if;
  end;
  begin
    perform 1 from public.imeia_worker_tokens;
    raise exception 'authenticated leyo tokens';
  exception when insufficient_privilege then
    if sqlerrm !~ 'permission denied' then
      raise exception 'authenticated tabla: %', sqlerrm;
    end if;
  end;
  reset role;
end $$;

do $$ begin
  set local role service_role;
  if public.imeia_token_alcance_ok('token-legacy-prueba-alcance-0001', 'worker') is not true then
    raise exception 'service_role no pudo comprobar alcance worker';
  end if;
  if public.imeia_token_alcance_ok('token-lectura-prueba-alcance-0001', 'worker') then
    raise exception 'lectura no es worker';
  end if;
  if public.imeia_token_alcance_ok('token-lectura-prueba-alcance-0001', 'respaldo_lectura') is not true then
    raise exception 'lectura no coincide con su alcance';
  end if;
  if public.imeia_token_alcance_ok('token-latido-prueba-alcance-0001', 'respaldo_latido') is not true then
    raise exception 'latido no coincide con su alcance';
  end if;
  reset role;
end $$;

call pg_temp.espera(
  $$select public.imeia_respaldo_set('token-lectura-prueba-alcance-0001','on','t','m','cli',1)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_set_route('token-lectura-prueba-alcance-0001','hermes','no',null)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_latido_registrar('token-lectura-prueba-alcance-0001','ok','t','cli',null,null)$$,
  'forbidden');
call pg_temp.espera(
  $$select * from public.imeia_worker_claim('token-lectura-prueba-alcance-0001',1)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_worker_done('token-lectura-prueba-alcance-0001',1,true,null,null)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_health_worker('token-lectura-prueba-alcance-0001')$$,
  'forbidden');
call pg_temp.espera(
  $$select public.rag_embed_set_endpoint('token-lectura-prueba-alcance-0001','http://127.0.0.1/embed','x')$$,
  'forbidden');
call pg_temp.espera(
  $$select * from public.rag_chunks_pendientes('token-lectura-prueba-alcance-0001',1)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.rag_chunks_guardar('token-lectura-prueba-alcance-0001','00000000-0000-0000-0000-000000000001'::uuid,'h','[]'::jsonb)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_respaldo_expirar('token-lectura-prueba-alcance-0001','t','hermes')$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_modo_reportar('token-lectura-prueba-alcance-0001','normal','m','t','hermes')$$,
  'forbidden');

call pg_temp.espera(
  $$select public.imeia_respaldo_pull('token-latido-prueba-alcance-0001')$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_respaldo_set('token-latido-prueba-alcance-0001','off','t','m','cli',1)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_set_route('token-latido-prueba-alcance-0001','grokbot','no',null)$$,
  'forbidden');
call pg_temp.espera(
  $$select * from public.imeia_worker_claim('token-latido-prueba-alcance-0001',1)$$,
  'forbidden');
call pg_temp.espera(
  $$select public.rag_embed_set_endpoint('token-latido-prueba-alcance-0001','http://127.0.0.1/embed','x')$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_respaldo_expirar('token-latido-prueba-alcance-0001','t','hermes')$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_modo_reportar('token-latido-prueba-alcance-0001','respaldo','m','t','cli')$$,
  'forbidden');
call pg_temp.espera(
  $$select public.imeia_respaldo_set('no-es-un-token','on','t','m','cli',1)$$,
  'unauthorized');
call pg_temp.espera(
  $$select public.rag_embed_set_endpoint('no-es-un-token','http://127.0.0.1/embed','x')$$,
  'token invalido');

do $$ begin
  if exists (select * from public.imeia_routing except table ruta_antes) then
    raise exception 'un token sin permiso escribio imeia_routing';
  end if;
  if (select count(*)::int from public.imeia_failover_log) <> (select n from log_antes) then
    raise exception 'un token sin permiso escribio imeia_failover_log';
  end if;
  if (select activo from public.imeia_respaldo_manual where id) then
    raise exception 'el manual no debio encenderse';
  end if;
end $$;

do $$
declare
  v jsonb;
begin
  v := public.imeia_latido_registrar('token-latido-prueba-alcance-0001', 'ok', 'emilio', 'rutina', null, now());
  if v->>'estado' <> 'ok' then
    raise exception 'latido no registro: %', v;
  end if;
  v := public.imeia_respaldo_pull('token-lectura-prueba-alcance-0001');
  if v->'latido'->>'estado' <> 'ok' then
    raise exception 'lectura no vio el latido: %', v;
  end if;
  begin
    set local role anon;
    v := public.imeia_respaldo_pull('token-lectura-prueba-alcance-0001');
    reset role;
  end;
  if v->'latido'->>'estado' <> 'ok' then
    raise exception 'anon no pudo hacer pull con token de lectura';
  end if;
end $$;

call pg_temp.ok($$select public.imeia_latido_registrar('token-legacy-prueba-alcance-0001','fallo','hermes','cli','detalle',null)$$);
call pg_temp.ok($$select public.imeia_respaldo_pull('token-legacy-prueba-alcance-0001')$$);
call pg_temp.ok($$select public.imeia_respaldo_set('token-legacy-prueba-alcance-0001','on','Shoky','motivo','cli')$$);
call pg_temp.ok($$select public.imeia_respaldo_expirar('token-legacy-prueba-alcance-0001','detector','hermes')$$);
call pg_temp.ok($$select public.imeia_modo_reportar('token-legacy-prueba-alcance-0001','respaldo','latido_ok','hermes','hermes')$$);
call pg_temp.ok($$select public.imeia_health_worker('token-legacy-prueba-alcance-0001')$$);
call pg_temp.ok($$select public.imeia_set_route('token-legacy-prueba-alcance-0001','hermes','prueba',null)$$);
call pg_temp.ok($$select * from public.imeia_worker_claim('token-legacy-prueba-alcance-0001',1)$$);
call pg_temp.ok($$select public.rag_embed_set_endpoint('token-legacy-prueba-alcance-0001','http://127.0.0.1/embed','embed-token')$$);
call pg_temp.ok($$select * from public.rag_chunks_pendientes('token-legacy-prueba-alcance-0001',5)$$);
call pg_temp.ok($$select public.rag_chunks_guardar('token-legacy-prueba-alcance-0001','00000000-0000-0000-0000-000000000001'::uuid,'h','[]'::jsonb)$$);

do $do$
declare
  v_id bigint;
  v jsonb;
begin
  insert into public.imeia_hermes_queue (canal, ref, payload, status)
  values ('whatsapp', 'ref-prueba-alcance', '{}'::jsonb, 'claimed')
  returning id into v_id;
  call pg_temp.espera(
    format($q$select public.imeia_worker_done('token-latido-prueba-alcance-0001', %s, true, null, null)$q$, v_id),
    'forbidden');
  if (select status from public.imeia_hermes_queue where id = v_id) <> 'claimed' then
    raise exception 'done de latido cambio la cola';
  end if;
  perform public.imeia_worker_done('token-legacy-prueba-alcance-0001', v_id, true, null, null);
  if (select status from public.imeia_hermes_queue where id = v_id) <> 'done' then
    raise exception 'el worker no cerro la cola';
  end if;
  v := public.imeia_respaldo_set('token-legacy-prueba-alcance-0001', 'on', 'Shoky', 'cuatro', 'cli');
  if (v->>'expires_at')::timestamptz - (v->>'desde_utc')::timestamptz <> interval '4 hours' then
    raise exception 'ON sin horas no caduca a las 4 h: %', v;
  end if;
end $do$;

do $$ begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform public.imeia_respaldo_pull('');
  begin
    perform public.imeia_respaldo_set('token-lectura-prueba-alcance-0001', 'off', 't', 'm', 'cli');
    raise exception 'service_role no debio saltarse el alcance del token';
  exception when insufficient_privilege then
    if sqlerrm !~ 'forbidden' then
      raise exception 'service_role set: %', sqlerrm;
    end if;
  end;
  begin
    perform public.imeia_set_route('', 'grokbot', 'vacio', null);
    raise exception 'token vacio no opera la ruta';
  exception when insufficient_privilege then
    if sqlerrm !~ 'unauthorized' then
      raise exception 'ruta vacia: %', sqlerrm;
    end if;
  end;
  perform set_config('request.jwt.claim.role', '', true);
end $$;

savepoint token_inactivo;
update public.imeia_worker_tokens set activo = false where nombre = 'lectura';
call pg_temp.espera(
  $$select public.imeia_respaldo_pull('token-lectura-prueba-alcance-0001')$$,
  'unauthorized');
rollback to savepoint token_inactivo;

do $$ begin
  if (select activo from public.imeia_worker_tokens where nombre = 'lectura') is not true then
    raise exception 'el savepoint no restituyo el token';
  end if;
  if (select target from public.imeia_routing where id) <> 'hermes' then
    raise exception 'el worker no pudo cambiar la ruta';
  end if;
end $$;
