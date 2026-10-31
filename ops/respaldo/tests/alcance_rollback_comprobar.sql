-- Tras el rollback: el esquema vuelve al de antes y cualquier token activo sirve para todo.

do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'imeia_worker_tokens' and column_name = 'alcance'
  ) then
    raise exception 'la columna alcance sigue';
  end if;
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('imeia_token_alcance_ok', 'imeia_exige_alcance')
  ) then
    raise exception 'quedo una funcion de alcance';
  end if;
  if to_regclass('public.imeia_routing') is null or to_regclass('public.imeia_latido') is null then
    raise exception 'el rollback borro tablas que no debia';
  end if;
  if (select count(*) from public.imeia_routing) <> 1 then
    raise exception 'imeia_routing cambio de cardinalidad';
  end if;
  if public.imeia_worker_token_ok('token-lectura-prueba-alcance-0001') is not true then
    raise exception 'tras el rollback un token activo de lectura debio volver a valer';
  end if;
  if public.imeia_respaldo_autorizado('token-lectura-prueba-alcance-0001') is not true then
    raise exception 'autorizado no volvio al criterio de token activo';
  end if;
end $$;

select public.imeia_latido_registrar('token-lectura-prueba-alcance-0001', 'ok', 'tras-rollback', 'cli', null, now());
select public.imeia_respaldo_set('token-lectura-prueba-alcance-0001', 'off', 'tras-rollback', 'fin', 'cli');
select public.imeia_set_route('token-lectura-prueba-alcance-0001', 'grokbot', 'rollback', null);
select public.rag_embed_set_endpoint('token-latido-prueba-alcance-0001', 'http://127.0.0.1/embed', 'otra');

do $$ begin
  set local role anon;
  begin
    perform 1 from public.imeia_worker_tokens;
    raise exception 'anon leyo tokens tras el rollback';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end $$;
