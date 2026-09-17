-- Retira los registros duplicados del catálogo detectados en la auditoría SEO
-- de 2026-09-17: tres productos publicados dos veces bajo slugs distintos.
--
-- NO se usa DELETE: siete tablas referencian productos(id) ON DELETE CASCADE
-- (stock_reservas, auditoría, ítems de pedido, etc.), así que borrar la fila
-- arrastraría historial comercial. `activo = false` los saca del build
-- (src/lib/datos.ts filtra por activo) y es reversible.
--
-- Los 301 correspondientes ya están en public/.htaccess, así que las URLs
-- retiradas seguirán resolviendo hacia el producto que se conserva.

begin;

-- 1. Revisar qué se va a tocar antes de confirmar.
select id, slug, sku, nombre_es, activo
from productos
where slug in (
  'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-75e09b13-8a2a-48',
  'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ee958bf4-f926-4d',
  'sistema-radiografico-3d-wr-3d',
  -- Los que se conservan, para confirmar que siguen activos:
  'g-ltd-b10-100',
  'g-ltd-b10-200',
  'sistema-radiografico-3d-wr-3d-angell-technology'
)
order by slug;

-- 2. Retirar solo los duplicados.
update productos
set activo = false
where slug in (
  'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-75e09b13-8a2a-48',
  'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ee958bf4-f926-4d',
  'sistema-radiografico-3d-wr-3d'
);

-- Debe devolver 3. Si devuelve otra cosa, hacer rollback.
select count(*) as retirados
from productos
where activo = false
  and slug in (
    'combo-100-cajas-de-tirillas-plus-100-cajas-de-lancetas-plus-25-glucometros-en-obsequio-75e09b13-8a2a-48',
    'combo-200-cajas-de-tirillas-plus-200-cajas-de-lancetas-plus-67-glucometros-en-obsequio-ee958bf4-f926-4d',
    'sistema-radiografico-3d-wr-3d'
  );

commit;

-- Para revertir:
-- update productos set activo = true where slug in (...);
