-- Registro de lo que hacen la persona y el agente, y confirmaciones
-- para factura, reembolso, precio bajo el piso y afirmaciones INVIMA.
-- No añade dropship_enabled ni lo activa.
-- Lo usa el MCP ime-comercio (src/mcp/ime-comercio-stdio.ts).

CREATE TABLE IF NOT EXISTS public.comercio_confirmaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creada_en timestamptz NOT NULL DEFAULT now(),
  vence_en timestamptz NOT NULL,
  actor text NOT NULL,
  rol text NOT NULL,
  herramienta text NOT NULL,
  entidad text NOT NULL,
  entidad_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  motivo text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'vencida')),
  confirmada_en timestamptz,
  confirmada_por text
);

CREATE TABLE IF NOT EXISTS public.comercio_actuaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  en timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  rol text NOT NULL,
  herramienta text NOT NULL,
  entidad text NOT NULL,
  entidad_id text,
  antes jsonb,
  despues jsonb,
  motivo text,
  confirmacion_id uuid REFERENCES public.comercio_confirmaciones (id)
);

CREATE INDEX IF NOT EXISTS idx_comercio_actuaciones_entidad
  ON public.comercio_actuaciones (entidad, entidad_id, en DESC);

CREATE INDEX IF NOT EXISTS idx_comercio_confirmaciones_pendientes
  ON public.comercio_confirmaciones (herramienta, entidad_id)
  WHERE estado = 'pendiente';

ALTER TABLE public.comercio_confirmaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comercio_actuaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY comercio_confirmaciones_admin
  ON public.comercio_confirmaciones
  FOR ALL
  USING (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']));

CREATE POLICY comercio_actuaciones_admin
  ON public.comercio_actuaciones
  FOR ALL
  USING (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']));

GRANT SELECT, INSERT, UPDATE ON public.comercio_confirmaciones TO authenticated, service_role;
GRANT SELECT, INSERT ON public.comercio_actuaciones TO authenticated, service_role;
