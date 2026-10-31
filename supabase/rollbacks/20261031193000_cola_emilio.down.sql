-- Rollback de la cola de Emilio. No borra cotizaciones ni aprobaciones.
begin;
drop table if exists public.cola_emilio;
commit;
