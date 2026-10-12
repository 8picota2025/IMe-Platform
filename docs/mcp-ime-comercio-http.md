# ime-comercio remoto por HTTPS

Endpoint oficial, independiente del escritorio:

```text
https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/mcp-comercio
```

Supabase Edge Function `mcp-comercio` del proyecto de i-me.com.co. Streamable HTTP
sin sesiones: POST JSON-RPC → JSON; las notificaciones aceptadas devuelven 202.
GET al endpoint MCP devuelve 405 porque no se ofrece un stream SSE independiente.
Versiones HTTP: `2025-11-25`, `2025-06-18`, `2025-03-26`. No se admite el transporte
SSE+POST antiguo. Stdio conserva también la negociación `2024-11-05`.

La misma lista de **36 herramientas**, nombres y esquemas del stdio se obtiene
con `tools/list`; el despacho comercial está en `src/lib/mcp-comercio-core.ts`.
El stdio local sigue disponible con `npm run mcp:comercio` y sus variables de servidor.

## Cursor / agentes

Config de Cursor (`.cursor/mcp.json` o config global); solo contiene una referencia
al secreto, nunca su valor:

```json
{
  "mcpServers": {
    "ime-comercio": {
      "url": "https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/mcp-comercio",
      "headers": {
        "Authorization": "Bearer ${env:IME_MCP_COMERCIO_TOKEN}"
      }
    }
  }
}
```

Cursor resuelve `${env:NAME}` en headers; para servidores remotos no admite
`envFile`. Inyectar el token en el entorno del proceso del agente o en su almacén
de secretos. Para Grok Bot u otro cliente, configurar la misma URL y el header
bearer mediante el mecanismo de secretos de ese cliente; no asumir que todos
resuelven la sintaxis de Cursor. No se ha iniciado una sesión de Cursor/Grok Bot
para la verificación: se ha comprobado el protocolo desde un cliente HTTPS separado.

Fuentes: [configuración oficial de Cursor](https://cursor.com/docs/mcp) y
[Streamable HTTP MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Permisos y restricciones

Quien posee el bearer puede usar **todas** las herramientas comerciales del
stdio: leer cotizaciones/clientes/pedidos/productos/proveedores/CRM, crear
borradores, actualizar ofertas y otras operaciones que ya permite el MCP.
El token otorga acceso a datos comerciales y personales; no es una credencial
para el navegador público. No está limitado a solo lectura.

Los envíos siguen exigiendo `actor_email` de un usuario comercial activo,
`preparar_envio_cotizacion` → aprobación por owner/admin en CMS →
`confirmar_envio_cotizacion`. La huella de oferta y la vigencia se mantienen.
Las demás operaciones sujetas a confirmación siguen usando sus aprobaciones.
Un argumento `rol: owner` no constituye aprobación.

El servidor registra cada intento de herramienta remota en `comercio_actuaciones`
antes de ejecutarlo (sin argumentos ni credenciales). Identidad de plataforma:
`mcp-http:<huella de token de 16 caracteres>`; el cliente no puede sustituirla
con `actor`/`rol`. Las mutaciones mantienen además su auditoría antes/después.
Si falla la auditoría o el límite de peticiones, no se ejecuta la herramienta.

No se devuelve la service role. El envoltorio elimina campos de credenciales,
redacta valores secretos del entorno en respuestas y oculta excepciones internas.
No se permite ningún header `Origin` (403), ni CORS `*`. Es un servicio
server-to-server. Respuestas con `Cache-Control: no-store`.

## Entorno y despliegue

Solo en el servidor Supabase:

- `IME_MCP_COMERCIO_TOKEN`: token opaco aleatorio, mínimo 32 caracteres; generar
  48 bytes aleatorios (64 caracteres base64url).
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: variables ya proporcionadas por
  Supabase. **No entregar estas variables al cliente MCP**.
- `TWENTY_BASE_URL` / `TWENTY_MCP_API_KEY`: opcionales para el borrado CRM aprobado;
  conservar una clave MCP específica con permiso Delete. Nunca usar
  `TWENTY_API_KEY` como sustituto. Sin la clave MCP, esa herramienta devuelve
  error de configuración, como el stdio.

Aplicar `supabase/migrations/20261005140954_mcp_comercio_rate_limit.sql` antes de
habilitar el endpoint. La función SQL es SECURITY INVOKER, con search_path vacío,
EXECUTE solo para service_role, y reutiliza `asesor_rate_limit` con RLS deny-all.
Los incrementos son atómicos entre isolates. Tope: 60 peticiones/minuto por IP
hasheada **y** por token (presupuesto global). Incluye health e inicialización.
Los errores de auth no acceden a la BD; la protección volumétrica anónima
corresponde al gateway de Supabase. Si falta una IP fiable en X-Forwarded-For,
se comparte el bucket `unknown`; el presupuesto global del token siempre aplica.

```sh
supabase secrets set --env-file /ruta/privada/mcp-comercio.env --project-ref nnfbucwiasuggyfoyydo
supabase functions deploy mcp-comercio --project-ref nnfbucwiasuggyfoyydo --use-api --no-verify-jwt
```

`verify_jwt = false` es necesario porque el bearer es opaco y se verifica en el
handler; no es un JWT de Supabase. Sin token configurado, el handler devuelve 503.
La función nueva se despliega de forma independiente: no sustituye
`comercial-cotizacion` ni `enviar-cotizacion`.

El workflow de Edge despliega al cambiar estos módulos compartidos. Puede copiar
los GitHub secrets `IME_MCP_COMERCIO_TOKEN` y `TWENTY_MCP_API_KEY` cuando tienen
valor; si están vacíos, conserva los secretos que ya hay en Supabase. Nunca poner
valores reales en `.env.example` ni en el repo.

## Generación y rotación

Ejemplo de generación sin imprimir el token (Node.js), en una ruta privada:

```sh
node --input-type=module - <<'JS'
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
writeFileSync('/ruta/privada/mcp-comercio.env',
  `IME_MCP_COMERCIO_TOKEN=${randomBytes(48).toString('base64url')}\n`,
  { mode: 0o600, flag: 'wx' });
JS
```

Guardar el mismo valor en Supabase secrets y en el almacén privado de cada agente.
Para rotar: generar otro archivo privado, actualizar Supabase con `secrets set`,
y reemplazar la variable del cliente/reiniciar su conexión. No cambia la URL ni
el código del cliente. La rotación requiere sincronizar el secreto con los
agentes; no hay una tabla de múltiples tokens ni ventana de solapamiento.

Para revocar, reemplazar o eliminar `IME_MCP_COMERCIO_TOKEN` en Supabase.
Si un GitHub secret también lo gestiona, actualizarlo o borrarlo para evitar que
un despliegue posterior restaure un token anterior.

## Health y smoke test

GET `…/mcp-comercio/health` exige bearer y devuelve:

```json
{ "ok": true, "transport": "http", "tools": 36 }
```

Health comprueba autenticación y disponibilidad del limitador; no consulta todas
las tablas comerciales. Verificación real de lectura:

```sh
node --env-file=/ruta/privada/mcp-comercio.env scripts/smoke-mcp-comercio.mjs
```

El script usa únicamente URL + bearer, sin service role ni servidor stdio;
verifica 401 sin token/inválido, 403 con Origin, initialize, tools/list,
notificación 202, health y `buscar_cotizaciones` con límite 1. Imprime solo estados
y cantidades, nunca datos de clientes ni credenciales. URL opcional:
`IME_MCP_COMERCIO_URL`.

## Verificación realizada (2026-10-05)

- Endpoint desplegado: 36 herramientas; health, initialize y tools/list HTTP 200.
- Interoperabilidad: SDK oficial `@modelcontextprotocol/sdk@1.26.0` con
  `StreamableHTTPClientTransport`: conexión, listado de 36 herramientas y lectura
  de una cotización correctos.
- Lectura de cotizaciones por HTTPS: correcta, 1 fila; sin iniciar stdio y sin
  service role en el cliente. No se apagó físicamente el equipo: la prueba no
  depende de ningún proceso local del servidor MCP.
- Sin token/inválido: 401; Origin de navegador: 403; notificación: 202.
- SQL real: 60 peticiones admitidas, 61 rechazada, mediante una transacción de
  prueba revertida. anon/authenticated sin permiso EXECUTE; service_role sí.
- Lint, Astro type-check y Deno check del entrypoint; pruebas HTTP/core con lectura
  y escritura de borrador en Supabase simulado. Sin escrituras de cotizaciones,
  envíos ni pagos reales durante esta verificación.

La función SQL se aplicó para verificar el endpoint con `execute_sql`, sin crear
historial de migración. El archivo versionado es idempotente y debe registrarse
con el flujo habitual de migraciones al integrar el PR. Solo se desplegó
`mcp-comercio`; no se redesplegaron las funciones comerciales existentes.
