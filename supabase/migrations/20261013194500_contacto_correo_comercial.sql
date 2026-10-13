-- Plantillas ya aplicadas siguen firmando con ventas@i-me.com.co.
-- Sustituye solo esa dirección (cotizaciones y ofertas al cliente) por
-- comercial1@i-me.com.co, sin reescribir el resto del HTML editado en el admin.

UPDATE public.email_templates
SET
  html = replace(html, 'ventas@i-me.com.co', 'comercial1@i-me.com.co'),
  asunto = replace(asunto, 'ventas@i-me.com.co', 'comercial1@i-me.com.co'),
  descripcion = replace(descripcion, 'root@ y ventas@', 'root@ y comercial1@')
WHERE html LIKE '%ventas@i-me.com.co%'
   OR asunto LIKE '%ventas@i-me.com.co%'
   OR descripcion LIKE '%root@ y ventas@%';
