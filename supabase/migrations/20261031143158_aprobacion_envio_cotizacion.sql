-- Aplicada en producción el 2026-10-31 con versión 20261031143158.
-- El archivo nació como 20261031120000; si el nombre no coincide con schema_migrations,
-- el siguiente `supabase db push` aborta ("Remote migration versions not found").
-- El 409 sin aprobación o con NO ENVIAR es intencional: no revertir.
-- Marca de aprobación para enviar cotizaciones (incidente 27-10: 6 envíos sin OK).
begin;

alter table public.solicitudes_cotizacion
  add column if not exists aprobado_por    text,         -- 'shoky' | 'validacion-costeo:<agente>'
  add column if not exists aprobado_at     timestamptz,
  add column if not exists aprobacion_tipo text
    check (aprobacion_tipo in ('ok_shoky','validacion_costeo_margen')),
  add column if not exists aprobacion_ref  text,         -- id de mensaje/chat del OK o id del informe de validación
  add column if not exists margen_validado numeric(6,2), -- % margen validado (solo validacion_costeo_margen)
  add column if not exists aprobacion_hash text;         -- md5(productos||condiciones||precio) al aprobar

-- Huella de lo aprobado: si cambian precio/líneas/condiciones, la aprobación caduca.
create or replace function public._cotizacion_huella(r public.solicitudes_cotizacion)
returns text language sql immutable as $$
  select md5(coalesce(r.productos::text,'') || '|' || coalesce(r.condiciones,'') || '|' ||
             coalesce(r.condiciones_en,'') || '|' || coalesce(r.precio_total_ofertado::text,'') || '|' ||
             coalesce(r.moneda,''))
$$;

-- Única vía para poner la marca (solo service_role: Correo/CRM/agente validador, nunca el navegador).
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
  update public.solicitudes_cotizacion
     set aprobado_por = p_por, aprobado_at = now(), aprobacion_tipo = p_tipo,
         aprobacion_ref = p_ref, margen_validado = p_margen,
         aprobacion_hash = public._cotizacion_huella(r)
   where id = p_id;
end $$;
revoke all on function public.aprobar_cotizacion_envio(uuid,text,text,text,numeric) from public, anon, authenticated;
grant execute on function public.aprobar_cotizacion_envio(uuid,text,text,text,numeric) to service_role;

-- Defensa en profundidad: ninguna vía (edge, SQL, CMS) puede pasar a 'enviada' sin marca vigente
-- ni con "NO ENVIAR" en condiciones/notas.
create or replace function public.tg_bloquear_envio_sin_aprobacion()
returns trigger language plpgsql as $$
declare txt text;
begin
  -- invalidar aprobación si cambió el contenido aprobado
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
    if new.aprobado_por is null or new.aprobado_at is null then
      raise exception using errcode = 'P0409', message = 'SIN_APROBACION';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists bloquear_envio_sin_aprobacion on public.solicitudes_cotizacion;
create trigger bloquear_envio_sin_aprobacion
  before insert or update on public.solicitudes_cotizacion
  for each row execute function public.tg_bloquear_envio_sin_aprobacion();

-- Fuente única de contacto/firma (la leen plantillas y scripts).
create table if not exists public.config_contacto (
  clave text primary key, valor text not null, updated_at timestamptz default now());
insert into public.config_contacto (clave, valor) values
  ('telefono_display', '+57 313 724 7353'),
  ('telefono_e164',    '573137247353'),
  ('firma_root_cargo', 'CTO - Management'),
  ('firma_root_email', 'root@i-me.com.co')
on conflict (clave) do nothing;
alter table public.config_contacto enable row level security;
create policy config_contacto_read on public.config_contacto for select to authenticated using (true);

commit;
-- NOTA: las 23 ya 'enviada' no se tocan (el trigger solo actúa en la transición a 'enviada').
-- Las 36 pendientes quedarán bloqueadas hasta que se apruebe cada una.
