-- Retira los 3 productos publicados dos veces (auditoría SEO de 2026-10-04, ver seo1026.md).
-- Sustituye a `retirar-duplicados-catalogo.sql` (17 sep), cuyos slugs ya cambiaron: son las
-- mismas filas (mismos id), renombradas después con el patrón `-ref-`.
--
-- Cada producto existe hoy con DOS slugs, ambos 200, indexables y con canonical propio:
--   * el que SE CONSERVA está en el sitemap, recibe más enlaces internos y es el destino de
--     los redirects de slugs antiguos (y de las URLs que Google ya conoce);
--   * el que SE RETIRA está fuera del sitemap y solo se enlaza desde el catálogo y la familia.
--
-- NO se usa DELETE: siete tablas referencian productos(id) ON DELETE CASCADE (reservas de
-- stock, auditoría, ítems de pedido…); borrar la fila arrastraría historial comercial.
-- `activo = false` los saca del build (src/lib/datos.ts filtra por activo) y es reversible.
--
-- ORDEN (importante, para que ninguna URL pase por un 404):
--   1. Desplegar primero estos 301 en public/.htaccess (son inocuos mientras el producto siga activo):
--        RewriteRule ^es/productos/sistema-radiografico-3d-ref-wr-3d-angell/?$ /es/productos/sistema-radiografico-3d-wr-3d-angell-technology-ref-wr-3d-angell/ [R=301,L]
--        RewriteRule ^en/products/sistema-radiografico-3d-ref-wr-3d-angell/?$ /en/products/sistema-radiografico-3d-wr-3d-angell-technology-ref-wr-3d-angell/ [R=301,L]
--        RewriteRule ^es/productos/combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100/?$ /es/productos/combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-25-glucometros-en-obsequio-ref-100/ [R=301,L]
--        RewriteRule ^en/products/combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100/?$ /en/products/combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-25-glucometros-en-obsequio-ref-100/ [R=301,L]
--        RewriteRule ^es/productos/combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200/?$ /es/productos/combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ref-200/ [R=301,L]
--        RewriteRule ^en/products/combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200/?$ /en/products/combo-cajas-de-tirillas-plus-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ref-200/ [R=301,L]
--   2. Ejecutar este script en el editor SQL de Supabase.
--   3. Reconstruir y desplegar (CI): las páginas retiradas dejan de generarse y sus URLs
--      pasan a redirigir con 301 al producto que se conserva.

begin;

-- 1. Revisar qué se va a tocar antes de confirmar (los 3 a retirar y los 3 que se conservan).
select id, slug, sku, nombre_es, activo,
       case when id in (
         '2e41fd47-833f-404e-864e-a5c71c04b04b',
         '75e09b13-8a2a-48e3-97d7-59d6588e47eb',
         'ee958bf4-f926-4d6f-9d89-0a3349ce65a2'
       ) then 'SE RETIRA' else 'se conserva' end as accion
from productos
where id in (
  -- Se retiran:
  '2e41fd47-833f-404e-864e-a5c71c04b04b',
  '75e09b13-8a2a-48e3-97d7-59d6588e47eb',
  'ee958bf4-f926-4d6f-9d89-0a3349ce65a2',
  -- Se conservan (deben seguir con activo = true):
  '0016c354-917d-4bf5-980f-15463b0fbb3b',
  'bb7b987e-d362-44dc-ba7b-80dd14ba987e',
  '2c530091-031e-44f2-a0bd-0b03a06d9754'
)
order by accion desc, slug;

-- 2. Retirar solo los duplicados. Se exige id Y slug para no tocar otra fila si algo cambió.
update productos
set activo = false
where (id, slug) in (
  ('2e41fd47-833f-404e-864e-a5c71c04b04b', 'sistema-radiografico-3d-ref-wr-3d-angell'),
  ('75e09b13-8a2a-48e3-97d7-59d6588e47eb', 'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-7-ref-100'),
  ('ee958bf4-f926-4d6f-9d89-0a3349ce65a2', 'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-e-ref-200')
);

-- Debe devolver 3. Si devuelve otra cosa, ejecutar `rollback;` en lugar de `commit;`.
select count(*) as retirados
from productos
where activo = false
  and id in (
    '2e41fd47-833f-404e-864e-a5c71c04b04b',
    '75e09b13-8a2a-48e3-97d7-59d6588e47eb',
    'ee958bf4-f926-4d6f-9d89-0a3349ce65a2'
  );

-- Debe devolver 3: los que se conservan siguen activos.
select count(*) as conservados_activos
from productos
where activo = true
  and id in (
    '0016c354-917d-4bf5-980f-15463b0fbb3b',
    'bb7b987e-d362-44dc-ba7b-80dd14ba987e',
    '2c530091-031e-44f2-a0bd-0b03a06d9754'
  );

commit;

-- Para revertir:
-- update productos set activo = true where id in (
--   '2e41fd47-833f-404e-864e-a5c71c04b04b',
--   '75e09b13-8a2a-48e3-97d7-59d6588e47eb',
--   'ee958bf4-f926-4d6f-9d89-0a3349ce65a2'
-- );

-- ---------------------------------------------------------------------------------------
-- OPCIONAL — producto de prueba de la pasarela de pagos (slug `test`).
-- Ya no sale en grillas ni enlaces (src/lib/productos-prueba.ts), pero sigue activo en la base.
-- Descomentar SOLO si ya no se necesita para probar Wompi; la producción debe quedar sin
-- datos de prueba. Es reversible (poner activo = true).
-- ---------------------------------------------------------------------------------------
-- begin;
-- select id, slug, nombre_es, activo, precio, stock from productos
--   where id = '81306066-082c-45b3-825e-7879da3c6d3c' and slug = 'test';
-- update productos set activo = false
--   where id = '81306066-082c-45b3-825e-7879da3c6d3c' and slug = 'test';
-- -- Debe devolver 1:
-- select count(*) from productos
--   where id = '81306066-082c-45b3-825e-7879da3c6d3c' and activo = false;
-- commit;
