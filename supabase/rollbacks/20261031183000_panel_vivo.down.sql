-- Rollback del borrador panel vivo. No aplicar en produccion sin OK de Shoky.
-- No borra solicitudes_cotizacion ni la marca de aprobacion de envio.
-- Si solicitudes_cotizacion ya estaba en supabase_realtime antes de esta
-- migracion, vuelve a publicarla despues de este rollback.
begin;

drop view if exists public.v_panel_tarjetas;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table public.panel_tareas;
    exception when undefined_object or undefined_table then null;
    end;
    begin
      alter publication supabase_realtime drop table public.panel_eventos;
    exception when undefined_object or undefined_table then null;
    end;
    begin
      alter publication supabase_realtime drop table public.solicitudes_cotizacion;
    exception when undefined_object or undefined_table then null;
    end;
  end if;
end $$;

drop trigger if exists panel_eventos_no_update on public.panel_eventos;
drop trigger if exists panel_eventos_no_delete on public.panel_eventos;
drop table if exists public.panel_eventos;
drop table if exists public.panel_tareas;
drop table if exists public.panel_snapshot_twenty;
drop function if exists public.tg_panel_eventos_append_only();
drop function if exists public.panel_marca_no_enviar(text);

commit;
