-- Exact-model policy: SKR058-CT must not keep SKR058-NT brochure
UPDATE public.productos SET ficha_pdf = NULL
WHERE slug = 'carro-de-enfermeria-ref-skr058-ct-saikang';

-- Exact-model policy: SKH041 washing trolley must not keep SKH0411 IV-stand brochure
UPDATE public.productos SET ficha_pdf = NULL
WHERE slug = 'carrito-de-lavado-ref-skh041-saikang';
