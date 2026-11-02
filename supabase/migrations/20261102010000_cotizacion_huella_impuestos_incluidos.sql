-- Post-#251: la huella de aprobación omitía impuestos_incluidos (y destinatario).
-- Ventas podía PATCH impuestos_incluidos=true tras el OK sin tocar precio/líneas;
-- la marca seguía vigente y enviar-cotizacion cobraba ~19 % menos (precios netos
-- tratados como IVA incluido). Si además se tocaba aprobado_at en el mismo
-- UPDATE, el trigger tampoco invalidaba (exigía aprobado_at sin cambios).
-- Ampliar huella + invalidar siempre que no cuadre + exigir huella vigente al pasar a enviada.
begin;

create or replace function public._cotizacion_huella(r public.solicitudes_cotizacion)
returns text language sql immutable as $$
  select md5(
    coalesce(r.productos::text, '') || '|' ||
    coalesce(r.condiciones, '') || '|' ||
    coalesce(r.condiciones_en, '') || '|' ||
    coalesce(r.precio_total_ofertado::text, '') || '|' ||
    coalesce(r.moneda, '') || '|' ||
    coalesce(r.impuestos_incluidos::text, 'false') || '|' ||
    lower(btrim(coalesce(r.email, ''))) || '|' ||
    btrim(coalesce(r.telefono, '')) || '|' ||
    coalesce(r.validez_hasta::text, '') || '|' ||
    coalesce(r.idioma, '')
  )
$$;

comment on function public._cotizacion_huella(public.solicitudes_cotizacion) is
  'Huella de oferta aprobada: líneas, condiciones, total, moneda, IVA incluido, destinatario y validez.';

create or replace function public.tg_bloquear_envio_sin_aprobacion()
returns trigger language plpgsql as $$
declare txt text;
begin
  -- Cualquier desvío de la huella tumba la marca (aunque intenten refrescar aprobado_at).
  if tg_op = 'UPDATE'
     and new.aprobado_at is not null
     and new.aprobacion_hash is distinct from public._cotizacion_huella(new) then
    new.aprobado_por := null;
    new.aprobado_at := null;
    new.aprobacion_tipo := null;
    new.aprobacion_ref := null;
    new.margen_validado := null;
    new.aprobacion_hash := null;
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

commit;
