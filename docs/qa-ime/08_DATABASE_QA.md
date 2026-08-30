# QA base de datos

- Esquema y 38 migraciones presentes.
- RLS se declara estricta y existen migraciones de hardening.
- Migraciones recientes incluyen corrección de familias, disponibilidad y puente CRM.
- No se conectó a Supabase ni se modificaron datos.

No confirmado: migraciones aplicadas en remoto, índices efectivos, huérfanos,
duplicados, N+1, tiempos de consulta, backups y restore.

Contradicción documental: algunos documentos marcan F4.1 aplicada en producción,
mientras pendientes conservan estados históricos de disponibilidad/pagos. El
usuario confirma que pagos fueron probados; resolver el alcance exacto y estado de
migraciones con historial remoto y snapshot solo lectura.
