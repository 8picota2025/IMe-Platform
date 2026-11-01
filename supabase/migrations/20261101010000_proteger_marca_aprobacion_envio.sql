-- Cierra el bypass de #251: la marca de aprobación solo la escribe
-- aprobar_cotizacion_envio (service_role). authenticated/anon podían
-- forjar aprobado_por/aprobado_at por PostgREST (RLS update_own) y
-- pasar la guarda de enviar-cotizacion + el trigger a 'enviada'.

begin;

-- 1) Única vía de escritura de la marca: GUC de sesión en la RPC.
create or replace function public.aprobar_cotizacion_envio(
  p_id uuid, p_por text, p_tipo text, p_ref text, p_margen numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.solicitudes_cotizacion;
begin
  if p_tipo not in ('ok_shoky','validacion_costeo_margen') then raise exception 'tipo invalido'; end if;
  if coalesce(trim(p_ref),'') = '' then raise exception 'aprobacion_ref requerido'; end if;
  if p_tipo = 'validacion_costeo_margen' and p_margen is null then raise exception 'margen requerido'; end if;
  select * into r from public.solicitudes_cotizacion where id = p_id for update;
  if not found then raise exception 'cotizacion no existe'; end if;
  perform set_config('app.aprobar_cotizacion_envio', '1', true);
  update public.solicitudes_cotizacion
     set aprobado_por = p_por, aprobado_at = now(), aprobacion_tipo = p_tipo,
         aprobacion_ref = p_ref, margen_validado = p_margen,
         aprobacion_hash = public._cotizacion_huella(r)
   where id = p_id;
end $$;
revoke all on function public.aprobar_cotizacion_envio(uuid,text,text,text,numeric) from public, anon, authenticated;
grant execute on function public.aprobar_cotizacion_envio(uuid,text,text,text,numeric) to service_role;

-- 2) Bloquear forja / elevación de la marca fuera de la RPC.
-- Permite limpiar la marca (NULL) cuando el trigger de huella la invalida
-- o cuando un update legítimo la borra. No permite poner o cambiar valores
-- no nulos sin el GUC de aprobar_cotizacion_envio.
create or replace function public.tg_proteger_marca_aprobacion_envio()
returns trigger language plpgsql as $$
declare
  via_rpc boolean;
  eleva boolean;
begin
  via_rpc := coalesce(current_setting('app.aprobar_cotizacion_envio', true), '') = '1';
  if tg_op = 'INSERT' then
    eleva := new.aprobado_por is not null
          or new.aprobado_at is not null
          or new.aprobacion_tipo is not null
          or new.aprobacion_ref is not null
          or new.margen_validado is not null
          or new.aprobacion_hash is not null;
    if eleva and not via_rpc then
      raise exception using errcode = 'P0403',
        message = 'APROBACION_SOLO_RPC';
    end if;
    return new;
  end if;

  eleva := (new.aprobado_por is distinct from old.aprobado_por)
        or (new.aprobado_at is distinct from old.aprobado_at)
        or (new.aprobacion_tipo is distinct from old.aprobacion_tipo)
        or (new.aprobacion_ref is distinct from old.aprobacion_ref)
        or (new.margen_validado is distinct from old.margen_validado)
        or (new.aprobacion_hash is distinct from old.aprobacion_hash);
  if not eleva then
    return new;
  end if;

  -- Solo limpieza (todo NULL) o la RPC.
  if via_rpc
     or (
       new.aprobado_por is null
       and new.aprobado_at is null
       and new.aprobacion_tipo is null
       and new.aprobacion_ref is null
       and new.margen_validado is null
       and new.aprobacion_hash is null
     )
  then
    return new;
  end if;

  raise exception using errcode = 'P0403',
    message = 'APROBACION_SOLO_RPC';
end $$;

drop trigger if exists proteger_marca_aprobacion_envio on public.solicitudes_cotizacion;
-- Tras bloquear_envio_sin_aprobacion (orden alfabético): ese puede poner NULL
-- al invalidar la huella; este permite el NULL y rechaza la forja.
create trigger proteger_marca_aprobacion_envio
  before insert or update on public.solicitudes_cotizacion
  for each row execute function public.tg_proteger_marca_aprobacion_envio();

-- 3) Transición a enviada exige huella vigente (no basta forjar por/at).
create or replace function public.tg_bloquear_envio_sin_aprobacion()
returns trigger language plpgsql as $$
declare txt text;
begin
  if new.aprobado_at is not null and new.aprobacion_hash is distinct from public._cotizacion_huella(new)
     and tg_op = 'UPDATE' and (old.aprobado_at is not distinct from new.aprobado_at) then
    new.aprobado_por := null; new.aprobado_at := null; new.aprobacion_tipo := null;
    new.aprobacion_ref := null; new.margen_validado := null; new.aprobacion_hash := null;
  end if;
  if new.estado = 'enviada' and (tg_op = 'INSERT' or old.estado is distinct from 'enviada') then
    txt := upper(translate(coalesce(new.condiciones,'')||' '||coalesce(new.condiciones_en,'')||' '||
                 coalesce(new.notas_internas,''), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'));
    if txt ~ 'NO[[:space:]._:-]*ENVIA' then
      raise exception using errcode = 'P0409', message = 'NO_ENVIAR_MARCADO';
    end if;
    if new.aprobado_por is null or new.aprobado_at is null
       or new.aprobacion_hash is null
       or new.aprobacion_hash is distinct from public._cotizacion_huella(new) then
      raise exception using errcode = 'P0409', message = 'SIN_APROBACION';
    end if;
  end if;
  return new;
end $$;

-- 4) Defensa en profundidad: authenticated/anon no escriben esas columnas.
revoke update (
  aprobado_por, aprobado_at, aprobacion_tipo, aprobacion_ref, margen_validado, aprobacion_hash
) on public.solicitudes_cotizacion from public, anon, authenticated;
revoke insert (
  aprobado_por, aprobado_at, aprobacion_tipo, aprobacion_ref, margen_validado, aprobacion_hash
) on public.solicitudes_cotizacion from public, anon, authenticated;
grant update (
  aprobado_por, aprobado_at, aprobacion_tipo, aprobacion_ref, margen_validado, aprobacion_hash
) on public.solicitudes_cotizacion to service_role;
grant insert (
  aprobado_por, aprobado_at, aprobacion_tipo, aprobacion_ref, margen_validado, aprobacion_hash
) on public.solicitudes_cotizacion to service_role;

commit;
