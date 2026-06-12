# REMEDIACION F5

Formato: `[ubicación] [severidad] [descripción] [evidencia] [fix concreto] [fase_origen]`

## Abiertos

- `[Legal] [Bloqueante] Textos legales son borrador, no aprobados. Evidencia: páginas marcadas COPY_CLIENTE_REVISAR/BLOQUEANTE_LEGAL. Fix: revisión de abogado y aprobación cliente. [F5]`
- `[Supabase] [Bloqueante] No hay evidencia de migraciones/RLS en proyecto real. Evidencia: PENDIENTES mantiene credenciales y migraciones como faltantes. Fix: crear proyecto, aplicar schema.sql y ejecutar matriz RLS. [F3-F5]`
- `[Pagos] [Bloqueante] Wompi/Stripe no probados en sandbox real. Evidencia: faltan credenciales de pasarela. Fix: configurar sandbox, desplegar Edge Functions y ejecutar pagos/webhooks. [F4-F5]`
- `[Deploy] [Bloqueante] Preprod/producción no desplegados. Evidencia: faltan secretos Hostinger y auditoría humana. Fix: configurar secrets, deploy preprod, auditar, promover build aprobado. [F5]`
- `[Contenido] [Mayor] Traducción EN y textos factuales requieren aprobación. Evidencia: COPY_CLIENTE_REVISAR en i18n. Fix: revisión cliente bilingüe. [F1-F5]`
- `[SEO] [Mayor] Redirecciones 301 no verificadas en hosting real. Evidencia: .htaccess creado pero no desplegado. Fix: deploy y `curl -I` de matriz legacy. [F5]`
- `[A11y/Perf] [Mayor] Lighthouse y navegación por teclado no ejecutados. Evidencia: NO_EJECUTADO_ENTORNO. Fix: ejecutar Lighthouse y prueba manual mobile/desktop. [F5]`

## Cerrados en esta pasada

- `[Legal/Footer] [Mayor] Footer apuntaba legales a "#". Evidencia: Footer actualizado con rutas reales. Fix aplicado. [F5]`
- `[Consentimiento] [Mayor] Contacto indicaba enlace de privacidad pendiente. Evidencia: formularios enlazan política borrador. Fix aplicado. [F5]`
- `[SEO/Legacy] [Mayor] /77 y /1old no tenían reglas 301 documentadas en build. Evidencia: public/.htaccess agregado. Fix aplicado, verificación hosting pendiente. [F5]`
