# Setup — IME Congreso

## Requisitos

1. CMS comercial operativo (auth, `admin_profiles`, `comercial-share` desplegada).
2. Puente OCR activo si se usa escaneo de tarjetas (mismo que cotizaciones — ver `docs/cms-commercial-setup.md`).
3. Usuario comercial con `rol` ∈ `ventas` | `admin` | `owner` y `activo = true`.

## Variables

Reutiliza las del CMS comercial. Para OCR de tarjetas:

```env
OCR_BRIDGE_URL=...
OCR_BRIDGE_SECRET=...
OCR_VISION_PROVIDER=ollama
```

Secrets Edge adicionales: ninguno exclusivo de Congreso; despliega las funciones.

## Configurar evento

Editar `src/congreso/events.ts`:

```typescript
export const CONGRESO_EVENTS: CongresoEvent[] = [
  {
    slug: 'acise2026',
    name: 'ACISE2026',
    location: 'ACISE 2026',
  },
];
```

URL de acceso: `https://i-me.com.co/congreso/?evento=acise2026` (slug opcional; default primer evento).

Los mensajes post-registro (copy ACISE) están en `src/congreso/congreso-app.ts` — ajustar por evento requiere cambio de código hasta existir plantilla DB.

## Deploy Edge Functions

```bash
supabase functions deploy congreso-ocr congreso-lead comercial-share
```

## Build frontend

Congreso se incluye en build estático:

```bash
npm run build
# Genera dist/congreso/index.html + assets
```

Deploy Hostinger igual que el resto del sitio (CI FTP).

## Desarrollo local

```bash
npm run dev
# http://localhost:44334/congreso/?evento=acise2026
```

1. Login con usuario comercial.
2. Verificar catálogo filtrado (solo productos elegibles).
3. Probar OCR con foto de tarjeta (requiere puente o Ollama local).
4. Registrar lead de prueba → revisar `leads_comerciales` en Supabase.

## Ocultar producto del evento

En `/admin` → Productos → Atributos JSON:

```json
{ "congreso_habilitado": false }
```

Ver `docs/congreso-admin.md` para plantilla email.

## PWA en evento

1. Abrir `/congreso/` en Chrome móvil (HTTPS).
2. Instalar desde banner o menú «Añadir a pantalla de inicio».
3. Tras deploy frontend: hard refresh de la PWA instalada.

Service worker: `public/congreso-sw.js` (scope `/congreso/`).
