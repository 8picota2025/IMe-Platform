# Auditoría técnica — Twenty CRM I-ME

- Fecha: 2026-07-26
- Alcance: `commercial-share` y cliente REST de Twenty.
- Validación externa: `GET https://crm.i-me.com.co/rest/people?limit=1` con
  token saneado devolvió HTTP 200. No se leyeron ni modificaron registros.

## Hallazgos cerrados

| Severidad | Hallazgo                                                                      | Corrección                                                             | Impacto comercial                                          |
| --------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Alta      | Listas REST reales vienen en `data.people`; cliente buscaba solo raíz.        | Parser soporta envoltorio `data`.                                      | Deduplicación vuelve funcional; evita contactos repetidos. |
| Alta      | Filtros manuales deforman emails con `+` y caracteres de empresa.             | `URLSearchParams` para cada filtro.                                    | Conserva identidad de lead y atribución.                   |
| Alta      | Error persistido podía incluir URL con email/teléfono y body remoto.          | Errores reducidos a HTTP/conexión; timeout 10 s.                       | Menor exposición PII y fallo controlado.                   |
| Media     | Retry tras fallo de `noteTarget` recreaba nota.                               | Retry repara enlace usando IDs locales.                                | Historial comercial limpio.                                |
| Alta      | Archivo operativo recibido usa comillas tipográficas y variable `TWENTY_URL`. | Usar `TWENTY_BASE_URL` y comillas ASCII al cargar secreto de Supabase. | Evita 401 por token contaminado.                           |

## Estado y pendiente externo

- Código: desplegado el 2026-07-26 en `comercial-share` (función activa,
  versión 11).
- Secretos: `TWENTY_BASE_URL` y `TWENTY_API_KEY` cargados en proyecto I-ME.
- Credencial: token válido contra REST una vez saneado.
- Pendiente: llamar `GET comercial-share?action=status` con un usuario
  comercial autorizado; endpoint conserva JWT y control de rol.
- KPI: `crm_sync_status=failed` debe permanecer en 0; primer contacto de cada
  lead comercial ≤ 5 minutos.
