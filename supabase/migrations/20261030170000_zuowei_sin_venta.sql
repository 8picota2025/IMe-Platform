-- Zuowei (9 SKU): sin registro sanitario INVIMA y no disponibles para venta.
-- Respeta disponible=false. Quita la promesa de precio y cualquier fila de registro.
-- No inventa un número de registro. invima_estado sigue en sin_registro (dato interno).

update public.productos
set
  disponible = false,
  disponible_actualizado_at = now(),
  precio = null,
  precio_regular = null,
  precio_oferta = null,
  descripcion_larga_es = regexp_replace(
    replace(
      descripcion_larga_es,
      'Precio bajo cotización.',
      'Producto sin registro sanitario INVIMA en Colombia; no disponible para venta.'
    ),
    'INVIMA en tr[aá]mite[^.]*\.?',
    '',
    'gi'
  ),
  descripcion_larga_en = regexp_replace(
    replace(
      descripcion_larga_en,
      'Price on request.',
      'This product has no INVIMA health registration in Colombia; not available for sale.'
    ),
    'INVIMA (registration )?pending[^.]*\.?',
    '',
    'gi'
  ),
  descripcion_corta_es = regexp_replace(descripcion_corta_es, 'INVIMA en tr[aá]mite[^.]*\.?', '', 'gi'),
  descripcion_corta_en = regexp_replace(
    descripcion_corta_en,
    'INVIMA (registration )?pending[^.]*\.?',
    '',
    'gi'
  ),
  especificaciones = case
    when jsonb_typeof(especificaciones) = 'array' and especificaciones::text ~* 'invima' then coalesce((
      select jsonb_agg(elem order by ord)
      from jsonb_array_elements(especificaciones) with ordinality as fila(elem, ord)
      where elem::text !~* 'invima'
    ), '[]'::jsonb)
    else especificaciones
  end,
  atributos = case
    when atributos is not null
      and jsonb_typeof(atributos -> 'especificaciones_en') = 'array'
      and (atributos -> 'especificaciones_en')::text ~* 'invima' then
      jsonb_set(
        atributos,
        '{especificaciones_en}',
        coalesce((
          select jsonb_agg(elem order by ord)
          from jsonb_array_elements(atributos -> 'especificaciones_en') with ordinality as fila(elem, ord)
          where elem::text !~* 'invima'
        ), '[]'::jsonb)
      )
    else atributos
  end,
  invima_rs = null,
  invima_titular = null,
  invima_vigencia = null
where sku in (
  'ZW568',
  'ZW598',
  'ZW518',
  'ZW302',
  'ZW365D-2',
  'ZW366S',
  'ZW186',
  'ZW501',
  'ZW502'
);
