-- Orden del dueño (2026-11-20): una cotización en borrador/nueva puede pasar a
-- 'enviada' sin marca de aprobación (aprobado_por / aprobado_at).
-- El trigger anterior anulaba esa marca si el contenido no coincidía con
-- aprobacion_hash y luego lanzaba SIN_APROBACION (HTTP 409) aunque las columnas
-- estuvieran rellenas antes del envío.
-- Se conserva el bloqueo explícito "NO ENVIAR". No toca precios, PDF ni IVA.
-- Las columnas y la RPC aprobar_cotizacion_envio siguen existiendo; ya no bloquean.

create or replace function public.tg_bloquear_envio_sin_aprobacion()
returns trigger
language plpgsql
as $$
declare
  txt text;
begin
  if new.estado = 'enviada' and (tg_op = 'INSERT' or old.estado is distinct from 'enviada') then
    txt := upper(translate(
      coalesce(new.condiciones, '') || ' ' ||
      coalesce(new.condiciones_en, '') || ' ' ||
      coalesce(new.notas_internas, ''),
      'áéíóúÁÉÍÓÚ',
      'aeiouAEIOU'
    ));
    if txt ~ 'NO[[:space:]._:-]*ENVIA' then
      raise exception using errcode = 'P0409', message = 'NO_ENVIAR_MARCADO';
    end if;
  end if;
  return new;
end $$;
