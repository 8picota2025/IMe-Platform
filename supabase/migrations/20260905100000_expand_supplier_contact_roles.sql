-- Supplier contacts are people, not system users. One supplier can expose
-- independent commercial, ordering, logistics and escalation contacts.
ALTER TABLE proveedor_contactos
  DROP CONSTRAINT IF EXISTS proveedor_contactos_tipo_check;

ALTER TABLE proveedor_contactos
  ADD CONSTRAINT proveedor_contactos_tipo_check
  CHECK (
    tipo IN (
      'comercial', 'ventas', 'pedidos', 'soporte', 'tecnico', 'logistica',
      'finanzas', 'devoluciones', 'regulatorio', 'direccion', 'general'
    )
  );
