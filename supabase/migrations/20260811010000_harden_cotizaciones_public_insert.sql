-- Harden public INSERT on solicitudes_cotizacion.
--
-- History: cotizaciones_insert_public used WITH CHECK (true) so the website
-- form could file quote requests with the anon key. After oferta/formalizar
-- columns landed (token hash, condiciones, precios en productos, estado
-- enviada/respondida), that same policy let an attacker mint a fully
-- formalizable offer and call crear-pago / formalizar-cotizacion for a live
-- Wompi/Stripe checkout (or transferencia pedido) at forged unit prices.
--
-- Legitimate web submissions go through registrar-cotizacion (service_role,
-- bypasses RLS). This policy only keeps a narrow anon/authenticated INSERT
-- for plain "nueva" requests — never a formalizable offer.

DROP POLICY IF EXISTS "cotizaciones_insert_public" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_insert_public"
  ON solicitudes_cotizacion FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    estado = 'nueva'
    AND formalizacion_token_hash IS NULL
    AND formalizacion_token_expira_at IS NULL
    AND condiciones IS NULL
    AND precio_total_ofertado IS NULL
    AND oferta_enviada_at IS NULL
    AND pedido_id IS NULL
    AND validez_hasta IS NULL
    AND notas_internas IS NULL
    AND impuestos_incluidos IS NULL
  );
