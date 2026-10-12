# Despliegues de vista previa (PR)

Copias estáticas de cada pull request no fusionado, desplegadas en Hostinger vía FTP. Sirven para QA visual antes de merge; **no deben indexarse** en buscadores.

## Cuándo se despliega

Workflow: `.github/workflows/deploy-preview.yml`

- Disparadores: PR abierto, sincronizado, reabierto, marcado listo para revisión (`ready_for_review`), o review enviada.
- **No** se despliega si el PR está en borrador (`draft == true`).
- Build: `npm run build` con variables públicas de Supabase/GA (mismas claves anon que producción).
- Destino FTP: `HOSTINGER_PREVIEW_PATH/<número-de-PR>/` (secreto `HOSTINGER_PREVIEW_PATH`).

## URL pública

El bot comenta en el PR con una de estas formas:

| Configuración | URL de entrada |
| ------------- | -------------- |
| `HOSTINGER_PREVIEW_DOMAIN` definido | `https://preview-<PR>.<dominio>/es/` |
| Secreto vacío (producción compartida) | `https://i-me.com.co/<PR>/es/` |

Los enlaces internos del sitio estático siguen apuntando al **dominio de producción** (`i-me.com.co`), no a la carpeta de preview. Es intencional: la preview valida HTML/CSS/JS generado, no un entorno aislado de datos.

## Capas anti-indexación

Tres mecanismos independientes (defensa en profundidad):

1. **Build:** `PUBLIC_NOINDEX=1` en el job de preview. `src/lib/seo.ts` → `resolveRobotsContent()` emite `noindex, nofollow` en **todas** las págenes HTML aunque la ruta no declare `noindex`.
2. **Apache raíz:** `public/.htaccess` (viaja en `dist/.htaccess`) define `SetEnvIf Request_URI "^/[1-9][0-9]*/"` y `Header always set X-Robots-Tag "noindex, nofollow"` para carpetas numéricas `/<PR>/…`. Cubre también PDFs e imágenes bajo esa ruta, incluidas previews antiguas construidas antes de `PUBLIC_NOINDEX`.
3. **robots.txt de la copia:** el workflow sobrescribe `dist/robots.txt` con `Disallow: /` antes del FTP. Los crawlers que lean el robots de la subcarpeta no deberían recorrer la preview; el de la raíz del dominio sigue siendo el de producción.

Prueba unitaria: `src/lib/seo.test.ts` («build de vista previa»).

## Operación y troubleshooting

| Síntoma | Causa probable | Acción |
| ------- | -------------- | ------ |
| Sin comentario de preview | PR en draft o workflow falló en build/FTP | Marcar PR listo para revisión; revisar Actions «Deploy Preview» |
| URL cortada `https://preview-123.` | Bug corregido oct-2026: secreto de dominio vacío | Usar URL `https://i-me.com.co/<PR>/es/` del comentario actualizado |
| Preview indexada en Google | Falta cabecera en subcarpeta o build sin `PUBLIC_NOINDEX` | Verificar `.htaccess` en Hostinger y re-ejecutar workflow |
| Contenido desactualizado vs rama | FTP incremental (`dangerous-clean-slate: false`) | Push nuevo commit al PR o limpiar carpeta `<PR>` en hPanel si hace falta |

## Relación con otros entornos

- **Producción:** `main` → deploy prod (indexable, sin `PUBLIC_NOINDEX`).
- **Preprod:** rama `preprod` (workflow aparte).
- **Local:** `npm run preview` no activa `PUBLIC_NOINDEX` salvo que se exporte en el entorno.

Ver también: `docs/qa-ime/13_INFRASTRUCTURE.md`, `CONTRIBUTING.md` (flujo de PR).
