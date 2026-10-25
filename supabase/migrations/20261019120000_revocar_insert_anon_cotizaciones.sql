-- P1 seguridad: cerrar INSERT directo de `anon` en solicitudes_cotizacion.
--
-- El alta pública de cotizaciones pasa por la Edge Function
-- `registrar-cotizacion` (service_role, que salta RLS). La política anterior
-- permitía INSERT directo a `anon` con WITH CHECK (true): cualquiera con la
-- anon key podía insertar filas vía PostgREST saltándose validación,
-- consentimiento, notificación y rate-limit.
--
-- El back-office (rol `authenticated`) sí inserta cotizaciones propias desde
-- src/comercial/quote-api.ts, así que se conserva INSERT para authenticated
-- limitado a created_by = auth.uid() o admin.

DROP POLICY IF EXISTS "cotizaciones_ventas_insert_public" ON solicitudes_cotizacion;

CREATE POLICY "cotizaciones_ventas_insert_authenticated"
  ON solicitudes_cotizacion FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR public.is_admin(ARRAY['owner', 'admin'])
  );

-- Cinturón y tirantes: quitar el privilegio de tabla a anon aunque una
-- política futura lo reabriera.
REVOKE INSERT ON TABLE solicitudes_cotizacion FROM anon;
