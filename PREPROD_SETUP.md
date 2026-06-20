# Zona de Preproducción — Setup

## Configuración

La zona de preproducción está configurada en:

- **URL:** `https://i-me.com.co/pre/`
- **Rama Git:** `preprod`
- **Workflow:** `.github/workflows/deploy-preprod.yml`
- **Servidor:** Hostinger (misma instancia que producción, en subdirectorio `/pre/`)

## Características

- ✅ Ambiente separado para testing antes de producción
- ✅ Misma base de datos Supabase (compartida)
- ✅ Mismos Edge Functions (compartidos)
- ✅ Deploy automático al hacer push a rama `preprod`
- ✅ Variables de entorno configuradas automáticamente:
  - `ASTRO_BASE=/pre/`
  - `ASTRO_SITE=https://i-me.com.co/pre/`

## Flujo de Trabajo

### 1. Crear feature desde preprod

```bash
git checkout preprod
git pull origin preprod
git checkout -b feature/tu-feature preprod
```

### 2. Desarrollar y testear

```bash
npm run dev
# Probar cambios en http://localhost:44334/pre/
```

### 3. Hacer commit

```bash
git add .
git commit -m "feat: descripción del cambio"
```

### 4. Hacer push a preprod

```bash
git push origin feature/tu-feature
# Crear Pull Request: feature/tu-feature → preprod
```

### 5. Merge a preprod

Una vez aprobado:

```bash
git checkout preprod
git merge feature/tu-feature
git push origin preprod
```

**El deploy a `/pre/` ocurre automáticamente** ⏳ (3-5 minutos)

### 6. Testing en preprod

- Acceder a: https://i-me.com.co/pre/
- Probar features completamente
- Validar que todo funciona como en producción

### 7. Merge a main (producción)

Cuando preprod está listo:

```bash
git checkout main
git pull origin main
git merge preprod
git push origin main
```

**El deploy a producción ocurre automáticamente** ⏳ (3-5 minutos)

## Configuración de Secrets (GitHub)

Asegúrese de que los siguientes secrets estén configurados en GitHub:

```
HOSTINGER_FTP_HOST        → Host FTP de Hostinger
HOSTINGER_FTP_USER        → Usuario FTP
HOSTINGER_FTP_PASSWORD    → Contraseña FTP
HOSTINGER_PREPROD_PATH    → Ruta donde desplegar /pre/ (ej: /public_html/pre/)
HOSTINGER_PROD_PATH       → Ruta donde desplegar prod (ej: /public_html/)
SUPABASE_URL              → URL de Supabase
SUPABASE_ANON_KEY         → Clave ANON de Supabase
```

## Variables de Entorno Automáticas

El workflow de preprod pasa automáticamente:

```env
ASTRO_BASE=/pre/                          # Ruta base para assets y rutas
ASTRO_SITE=https://i-me.com.co/pre/      # URL base para sitemap y SEO
PUBLIC_SUPABASE_URL=...                   # Del secret SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY=...             # Del secret SUPABASE_ANON_KEY
```

No necesita configurar nada manualmente en `.env` para preprod.

## Estructura de Ramas

```
main (producción)
  ↑
  └─── preprod (preproducción)
         ↑
         └─── feature/* (desarrollo)
```

## Monitorear Deploys

### Preprod

- https://github.com/8picota2025/IMe-Platform/actions
- Busque workflow: "Deploy Preprod"
- Rama: `preprod`

### Producción

- https://github.com/8picota2025/IMe-Platform/actions
- Busque workflow: "Deploy Producción"
- Rama: `main`

## Troubleshooting

### El deploy a preprod falla

1. Verificar que la rama es `preprod`
2. Revisar logs en GitHub Actions
3. Confirmar que `HOSTINGER_PREPROD_PATH` está configurado correctamente en secrets

### Los assets no cargan en /pre/

1. Verificar que `ASTRO_BASE=/pre/` está siendo usado
2. Revisar que `astro.config.mjs` lee la variable correctamente
3. Limpiar caché del navegador

### URLs inconsistentes

- Verificar que `ASTRO_SITE=https://i-me.com.co/pre/` se usa en preprod
- Revisar que los secrets de Supabase son los mismos en prod y preprod

## Notas

- ✅ Base de datos compartida (Supabase es la misma)
- ✅ Edge Functions compartidas (Supabase es la misma)
- ⚠️ Los datos creados en preprod aparecen en producción (misma BD)
- ⚠️ No ideal para testing con datos de prueba destructivos
- 💡 Use preprod para testing de features, no para QA destructivo

---

**Creado:** 2026-06-20  
**Última actualización:** 2026-06-20
