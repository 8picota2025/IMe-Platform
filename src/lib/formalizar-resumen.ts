/**
 * Resumen visible en la página de aceptación.
 * `es-en` muestra etiquetas y textos fijos en castellano e inglés.
 * Los datos del cliente ya vienen saneados (nunca un correo o teléfono de I-ME).
 */

export interface LineaFormalizar {
  nombre: string;
  nombre_en?: string | null;
  notas?: string | null;
  notas_en?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: string;
}

export interface CotizacionFormalizarVista {
  nombre?: string | null;
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
  nit?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  condiciones?: string | null;
  condiciones_en?: string | null;
  validez_hasta?: string | null;
  idioma?: string | null;
  moneda: string;
  total: number;
  iva_resumen?: string | null;
  lineas: LineaFormalizar[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fila(etiqueta: string, valor: string | null | undefined): string {
  const texto = String(valor ?? '').trim();
  if (!texto || texto === '—') return '';
  return `<p><strong>${escapeHtml(etiqueta)}:</strong> ${escapeHtml(texto)}</p>`;
}

export function htmlResumenFormalizar(
  cotizacion: CotizacionFormalizarVista,
  money: (valor: number, moneda: string) => string
): string {
  const bilingue = cotizacion.idioma === 'es-en';
  const et = (es: string, en: string) =>
    cotizacion.idioma === 'en' ? en : bilingue ? `${es} / ${en}` : es;
  const condicionesEn = String(cotizacion.condiciones_en ?? '').trim();
  const lineas = cotizacion.lineas
    .map(linea => {
      const nombreEn = String(linea.nombre_en ?? '').trim();
      const notasEn = String(linea.notas_en ?? '').trim();
      const extra =
        bilingue && nombreEn && nombreEn.toLowerCase() !== linea.nombre.trim().toLowerCase()
          ? `<br><span>${escapeHtml(nombreEn)}</span>`
          : '';
      const notas = String(linea.notas ?? '').trim();
      const notasHtml = notas ? `<br><small>${escapeHtml(notas)}</small>` : '';
      const notasEnHtml =
        bilingue && notasEn && notasEn !== notas ? `<br><small>${escapeHtml(notasEn)}</small>` : '';
      return `<tr>
        <td>${escapeHtml(linea.nombre)}${extra}${notasHtml}${notasEnHtml}</td>
        <td>${linea.cantidad}</td>
        <td>${money(linea.precio_unitario, linea.moneda)}</td>
        <td>${money(linea.subtotal, linea.moneda)}</td>
      </tr>`;
    })
    .join('');
  return `
    ${fila(et('Razón social', 'Company'), cotizacion.empresa)}
    ${fila(et('NIT', 'Tax ID'), cotizacion.nit)}
    ${fila(et('Contacto', 'Contact'), cotizacion.nombre)}
    ${fila(et('Correo', 'Email'), cotizacion.email)}
    ${fila(et('Teléfono', 'Phone'), cotizacion.telefono)}
    ${fila(et('Dirección', 'Address'), cotizacion.direccion)}
    ${fila(et('Ciudad', 'City'), cotizacion.ciudad)}
    ${fila(et('País', 'Country'), cotizacion.pais)}
    ${cotizacion.validez_hasta ? `<p><strong>${et('Validez', 'Valid until')}:</strong> ${escapeHtml(cotizacion.validez_hasta)}</p>` : ''}
    <table class="formalizar__table">
      <thead><tr>
        <th>${et('Producto', 'Product')}</th>
        <th>${et('Cant.', 'Qty')}</th>
        <th>${et('Precio unitario', 'Unit price')}</th>
        <th>${et('Subtotal', 'Subtotal')}</th>
      </tr></thead>
      <tbody>${lineas}</tbody>
    </table>
    <p class="formalizar__total">${et('Total a pagar', 'Amount due')}: ${money(cotizacion.total, cotizacion.moneda)}</p>
    ${cotizacion.iva_resumen ? `<p>${escapeHtml(cotizacion.iva_resumen)}</p>` : ''}
    <h2>${et('Condiciones', 'Terms')}</h2>
    <pre class="formalizar__condiciones">${escapeHtml(cotizacion.condiciones ?? '')}</pre>
    ${
      bilingue && condicionesEn
        ? `<h2>Terms</h2><pre class="formalizar__condiciones">${escapeHtml(condicionesEn)}</pre>`
        : ''
    }
  `;
}

export function saludoFormalizar(nombre: string | null | undefined, idioma: string | null | undefined): string {
  const quien = String(nombre ?? '').trim() || 'cliente';
  if (idioma === 'es-en') {
    return `Hola ${quien}. Revisa la oferta. Puedes pagar por transferencia. Wompi solo aplica a pesos colombianos (COP). / Hello ${quien}. Review the offer. You can pay by bank transfer. Wompi applies to Colombian pesos (COP) only.`;
  }
  return `Hola ${quien}. Revisa la oferta. Puedes pagar por transferencia o con Wompi.`;
}
