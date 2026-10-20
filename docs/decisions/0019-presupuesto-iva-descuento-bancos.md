# ADR-0019: IVA unitario, descuento directo/inverso y bancos en presupuesto

- Fecha: 2026-10-20
- Estado: **en espera para producción** — activo solo como herramienta local (`:44339`)
- Rama: `feature/presupuesto-iva-descuento-bancos`
- Uso local: `docs/presupuesto-iva-descuento-bancos.md` · `npm run presupuesto:local`

## Contexto

El presupuesto Salud Trec / Crius V8 pedía bruto, % descuento, neto, IVA por
producto (tarifas distintas), cuentas de recaudo en código y condición 50/50
solo en cotizaciones nuevas. Se implementó en `/comercial` y `/admin`. No se
pone en producción: queda documentado y commiteado en la rama de feature.

## Decisión (cuando se reactive)

1. **IVA unitario** es la fuente de verdad por línea. El sumatorio es
   `Σ (iva_unitario × cantidad)`. Un `0` guardado con tarifa 19 % o 5 % se
   recalcula; un importe > 0 no se pisa. Productos distintos pueden tener
   IVAs distintos. El recuadro de totales se etiqueta **Total IVA:** (nunca
   «IVA 0%»).
2. **Descuento bidireccional.** Si se edita el bruto (o el % con origen bruto),
   neto = bruto × (1 − %). Si se edita el neto (o el % con origen neto),
   bruto = neto ÷ (1 − %).
3. **Bancos** solo en código (`CUENTAS_RECAUDO`: Bancolombia, Davivienda).
4. **Condición de pago** «50 % al formalizar el pedido y 50 % a la entrega
   del mismo.» solo en cotizaciones **nuevas**. Las antiguas conservan lo
   guardado; vacío imprime Contado.
5. **PDF** imprime columnas Bruto, %, Neto, IVA y Total. El espejo Edge
   `supabase/functions/_shared/render-quote-pdf.ts` debe ir en sync.

## Consecuencias

- Campos JSONB de línea: `precio_bruto`, `descuento_pct`, `precio_neto`,
  `iva_unitario`, `iva_total`, `tratamiento_iva`.
- Cotizaciones viejas sin esos campos no inventan IVA 19 % al imprimir.
- Reactivar exige merge de la rama, no un cherry-pick suelto del PDF.
