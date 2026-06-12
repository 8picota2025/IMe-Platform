# VALIDACION VISUAL F5

## Estado

NO_EJECUTADO_ENTORNO: no se ejecutó auditoría visual con navegador real en esta pasada.

## Cobertura requerida

- Desktop y mobile: `/es/`, `/en/`, catálogo, landing de producto, contacto, financiación, legales y resultados de pago.
- Drawers: carrito, lista de cotización y asesor.
- Admin: login, dashboard, productos, cotizaciones, pedidos, ingesta PDF y rebuild.

## Hallazgos abiertos

- `[Legales] [Menor]` Las páginas legales usan estilos funcionales y sobrios. Evidencia pendiente con capturas. Fix: revisar spacing/contraste en navegador.
- `[Footer] [Menor]` Footer ahora tiene cinco enlaces legales; revisar wrapping en mobile. Evidencia pendiente con capturas.

## Comandos sugeridos

```bash
npm run dev
# Abrir http://localhost:43421/es/legal/privacidad y http://localhost:43421/en/legal/privacy
```
