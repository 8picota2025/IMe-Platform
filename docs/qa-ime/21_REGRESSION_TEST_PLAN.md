# Plan de regresión

```text
deploy → health → smoke URLs → API contracts → E2E lead/cotización
       → CMS fixture → pagos sandbox → security checks → performance sanity
```

Suite mínima: home ES/EN, catálogo/filtro/paginación, familia/producto, legal,
lead, cotización, carrito, checkout sandbox, webhook replay, admin RBAC, asesor
sin datos privados, sitemap/robots/llms, 404 y restore fixture.

Cada ejecución guarda commit, entorno, conteos HTML, sitemap, tiempos, errores,
artifact de test y resultado. Prohibido usar clientes reales o enviar correo real.
