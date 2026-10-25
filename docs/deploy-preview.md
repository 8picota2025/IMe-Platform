# Vistas previas de PR (Hostinger FTP)

Despliegue estático de cada pull request no borrador hacia una carpeta numerada en el
mismo hosting que producción. Sirve para QA visual y Playwright sin indexar la copia.

## Cuándo se ejecuta

| Workflow | Archivo | Disparador |
| -------- | ------- | ---------- |
| Deploy preview | `.github/workflows/deploy-preview.yml` | PR abierto/sincronizado/reabierto/listo para revisión (no draft) |
| Limpieza al cerrar PR | mismo workflow, job `cleanup` | PR `closed` (merge o cierre) |
| Limpieza legacy en prod | `.github/workflows/deploy-prod.yml` paso «Remove legacy PR preview folders» | Tras cada deploy de producción |
| Poda manual one-shot | `.github/workflows/prune-closed-previews.yml` | `workflow_dispatch` (lista fija de PRs a 2026-10-12) |

## URL pública

1. Si existe el secreto `HOSTINGER_PREVIEW_DOMAIN`, el comentario del bot usa  
   `https://preview-<número>.<dominio>/es/`.
2. Si no, la copia vive bajo el dominio de producción:  
   `https://i-me.com.co/<número>/es/`  
   (antes un dominio vacío generaba URLs truncadas).

Los enlaces internos de la preview apuntan a la raíz de producción (assets pesados de
fabricantes no se resuben por PR).

## Secretos GitHub

| Secreto | Uso |
| ------- | --- |
| `HOSTINGER_FTP_HOST`, `HOSTINGER_FTP_USER`, `HOSTINGER_FTP_PASSWORD` | Subida y borrado FTP |
| `HOSTINGER_PREVIEW_PATH` | Ruta **absoluta** en el servidor donde cuelgan las carpetas `<PR>/` |
| `HOSTINGER_PREVIEW_DOMAIN` | Opcional; subdominio `preview-<PR>` |
| `HOSTINGER_PROD_PATH` | Raíz del sitio en FTP (usada solo en la limpieza legacy de prod) |

`HOSTINGER_PREVIEW_PATH` y el número de PR deben validarse en los scripts: nunca borrar
ruta vacía ni la raíz del sitio.

## Build de preview

- `PUBLIC_NOINDEX=1` en el build.
- Tras el build se sobrescribe `dist/robots.txt` con `Disallow: /`.
- `public/.htaccess` (copiado a `dist/`) marca `X-Robots-Tag: noindex` para rutas `/<PR>/`.
- Exclusión FTP igual que prod para `assets/productos/importados/**` (~950 archivos por PR).

## Limpieza y cuota de disco

Las carpetas `<PR>/` comparten cuenta FTP con producción. Cuota llena (`Disk quota exceeded`)
bloqueaba deploys; por eso:

1. **Al cerrar el PR:** job `cleanup` borra `PREVIEW_PATH/<PR>/` con `lftp rm -r`. Falla el
   job si la carpeta sigue listándose.
2. **En cada deploy prod:** Python + `ftplib` lista en `HOSTINGER_PROD_PATH` solo entradas
   cuyo nombre es **solo dígitos** (carpetas preview antiguas en la raíz enjaulada). Cada una
   se elimina con `lftp` en serie. Timeout **18 minutos**; si expira, el deploy **no falla** y
   el siguiente deploy continúa (evita cancelar el smoke por una limpieza larga).
3. **Poda manual:** workflow con lista estática de PRs fusionados; usar `dry_run: true` primero.

### FTP enjaulado (Hostinger)

En producción, `/` en FTP es la raíz del sitio, no el disco completo. La limpieza legacy usa
`cd` a `HOSTINGER_PROD_PATH` (normalmente `/`) y borra subcarpetas numéricas relativas a esa
raíz, no rutas absolutas del sistema de archivos del host.

## Operación para desarrolladores

```bash
# Validar localmente antes de abrir PR
npm run validate

# Tras el comentario del bot en GitHub, probar:
# https://i-me.com.co/<PR>/es/   (o subdominio preview si está configurado)
```

Playwright/QA deben asumir **noindex** y assets de fichas servidos desde producción.

## Referencias

- Infra resumida: `docs/qa-ime/13_INFRASTRUCTURE.md`
- Estado incremental FTP prod: comentarios en `.github/workflows/deploy-prod.yml`
  (`state-name: .ftp-deploy-sync-state-v3.json`)
