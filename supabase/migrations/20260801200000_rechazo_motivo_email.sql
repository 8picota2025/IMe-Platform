-- Incluir {{motivo}} en plantillas de rechazo de comprobante

UPDATE email_templates
SET
  html = '<h2>Hola {{cliente_nombre}}</h2><p>Revisamos el comprobante de transferencia asociado a tu presupuesto <strong>{{referencia}}</strong> y <strong>no pudo ser validado</strong>.</p><p><strong>Motivo:</strong> {{motivo}}</p><p>Por favor vuelve a realizar el pago (si aplica) y carga un comprobante valido para completar la formalizacion.</p><p><strong>Total ofertado:</strong> {{total}} {{moneda}}</p><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Reintentar validacion del presupuesto</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Si tienes dudas, responde a este correo o escribenos a ventas@i-me.com.co.</p><p>Equipo I-ME</p>',
  descripcion = 'Aviso al cliente: comprobante invalido + motivo, reintentar formalizacion'
WHERE clave IN ('transferencia_comprobante_rechazado', 'transferencia_comprobante_rechazado_es');

UPDATE email_templates
SET
  html = '<h2>Hello {{cliente_nombre}}</h2><p>We reviewed the bank transfer receipt for your quote <strong>{{referencia}}</strong> and it <strong>could not be validated</strong>.</p><p><strong>Reason:</strong> {{motivo}}</p><p>Please transfer again if needed and upload a valid receipt to complete formalization.</p><p><strong>Quoted total:</strong> {{total}} {{moneda}}</p><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Retry quote validation</a></p><p>If the button does not work, copy this link:<br>{{formalizar_url}}</p><p>Questions? Reply to this email or write to ventas@i-me.com.co.</p><p>I-ME Team</p>',
  descripcion = 'Client notice (EN): invalid receipt + reason, retry formalization'
WHERE clave = 'transferencia_comprobante_rechazado_en';
