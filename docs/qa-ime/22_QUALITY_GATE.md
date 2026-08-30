# Quality Gate

Bloquear merge/deploy si:

- lint, typecheck, tests o build fallan;
- aparecen vulnerabilidades Critical/High sin excepción aprobada;
- build usa fallback mock sin señal explícita y aprobación;
- sitemap, robots, noindex privado o canonical audit fallan;
- una URL crítica devuelve 4xx/5xx inesperado;
- formulario no persiste lead/cotización en fixture;
- webhook/pago no es idempotente en sandbox;
- migraciones no coinciden con remoto;
- falla smoke, accesibilidad seria o budget performance;
- no existe rollback probado para release.

Promoción requiere evidencia firmada del entorno, ventana, responsable y rollback.
