# Performance

Evidencia histórica en `PENDIENTES.md`: Lighthouse 0.66–0.79, peso aproximado
3.1 MB y JavaScript no usado aproximado 248 KiB. No se repitió Lighthouse contra
producción en este entorno.

Build local completa 1.642 páginas. Warning Vite: `node:crypto` externalizado en
`cotizacion-oferta.ts`; warning de import dinámico/estático de `pdf-lib`.

Prioridad: medir móvil/desktop con 3 corridas, separar TTFB/LCP/INP/CLS, auditar
chunks por ruta, optimizar PDF code-splitting e imágenes, y establecer budgets CI.
