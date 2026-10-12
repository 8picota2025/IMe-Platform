-- Oportunidades eliminadas desde el admin: salen del tablero y de las estadísticas.
-- Se marcan en lugar de borrarse porque crm_sync_from_cotizacion y crm_sync_from_pedido
-- hacen upsert por (source_table, source_id) y recrearían la fila; esas funciones no
-- tocan estas columnas, así que la marca sobrevive a sus actualizaciones.

ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS eliminada_at timestamptz,
  ADD COLUMN IF NOT EXISTS eliminada_por text,
  ADD COLUMN IF NOT EXISTS eliminada_motivo text;

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_vigentes
  ON public.crm_opportunities (etapa, updated_at DESC)
  WHERE eliminada_at IS NULL;
