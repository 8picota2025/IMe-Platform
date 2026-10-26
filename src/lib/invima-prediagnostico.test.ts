import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENTACION_EN,
  DOCUMENTACION_ES,
  EMAIL_REGISTRO_INVIMA,
  REFERENCIAS_EN,
  REFERENCIAS_ES,
  REPRESENTACION_EN,
  REPRESENTACION_ES,
  asuntoCotizacionInvima,
  destinatariosInvimaConocimiento,
  resumenPrediagnostico,
  validarSeleccionPrediagnostico,
} from './invima-prediagnostico';

const NOTA_ES =
  'Nota regulatoria: I-ME presta el servicio técnico de diagnóstico, estructuración, radicación y seguimiento del expediente. El registro sanitario o permiso de comercialización es expedido exclusivamente por el INVIMA a nombre del titular conforme al Decreto 4725 de 2005.';
const NOTA_EN =
  "Regulatory note: I-ME provides technical dossier preparation, filing, requirement response, and regulatory follow-up services. Sanitary registrations and marketing permits are issued exclusively by INVIMA in the holder's name under Decree 4725 of 2005.";

describe('pre-diagnóstico INVIMA', () => {
  it('arma el asunto estructurado y conserva el buzón regulatorio', () => {
    expect(asuntoCotizacionInvima('Acme Medical', 'Germany')).toBe(
      '[Cotización Registro INVIMA - Web] Acme Medical (Germany)'
    );
    expect(asuntoCotizacionInvima('Acme\nMedical', 'Ger{many}')).toBe(
      '[Cotización Registro INVIMA - Web] Acme Medical (Germany)'
    );
    expect(EMAIL_REGISTRO_INVIMA).toBe('registroinvima@i-me.com.co');
    expect(
      destinatariosInvimaConocimiento(['comercial1@i-me.com.co', EMAIL_REGISTRO_INVIMA])
    ).toEqual(['registroinvima@i-me.com.co', 'comercial1@i-me.com.co']);
  });

  it('exige chips del copy oficial y resume todos los campos', () => {
    expect(validarSeleccionPrediagnostico({ producto: 'M' }, 'es').ok).toBe(false);
    expect(
      validarSeleccionPrediagnostico(
        {
          producto: 'Monitor de signos vitales',
          referencias: '2 a 5 modelos',
          documentacion: 'Tengo CVL + ISO 13485',
          representacion: 'Busco importador autorizado en Colombia',
        },
        'es'
      ).ok
    ).toBe(true);
    expect(
      validarSeleccionPrediagnostico({ producto: 'Monitor', referencias: '99' }, 'en').ok
    ).toBe(false);
    const resumen = resumenPrediagnostico({
      producto: 'Patient monitor for vital signs',
      referencias: REFERENCIAS_EN[1],
      documentacion: DOCUMENTACION_EN[0],
      representacion: REPRESENTACION_EN[0],
      nombre: 'Ana Pérez, Regulatory lead',
      empresa: 'Acme Medical',
      pais: 'Germany',
      email: 'ana@acme.example',
      telefono: '+49 170 000',
    });
    expect(resumen).toContain('Producto y finalidad prevista: Patient monitor for vital signs');
    expect(resumen).toContain(`Referencias o modelos: ${REFERENCIAS_EN[1]}`);
    expect(resumen).toContain(`Documentación en país de origen: ${DOCUMENTACION_EN[0]}`);
    expect(resumen).toContain(`Representación en Colombia: ${REPRESENTACION_EN[0]}`);
    expect(resumen).toContain('Empresa fabricante: Acme Medical');
    expect(resumen).toContain('País: Germany');
    expect(resumen).toContain('Correo corporativo: ana@acme.example');
    expect(resumen).toContain('WhatsApp / Teléfono: +49 170 000');
    expect(REFERENCIAS_ES).toEqual(['1 modelo', '2 a 5 modelos', 'Más de 5 / Familia completa']);
    expect(DOCUMENTACION_ES[0]).toBe('Tengo CVL + ISO 13485');
    expect(REPRESENTACION_ES[0]).toBe('Busco importador autorizado en Colombia');
  });

  it('el componente publica el copy aprobado y la nota regulatoria', () => {
    const ui = readFileSync('src/components/conocimiento/InvimaConversion.astro', 'utf8');
    expect(ui).toContain(
      '¿Es fabricante? Cómo reducir costes y evitar retrasos en su registro sanitario INVIMA'
    );
    expect(ui).toContain(
      'Agrupación inteligente de familias y referencias (Art. 7, Decreto 4725 de 2005)'
    );
    expect(ui).toContain('Revisión previa del Certificado de Venta Libre (CVL) y anexos técnicos');
    expect(ui).toContain('Titularidad a su nombre e importador habilitado en Colombia');
    expect(ui).toContain(
      'Are You a Manufacturer? How to Minimize Costs and Avoid Delays in Your INVIMA Registration'
    );
    expect(ui).toContain('Smart Product Family Grouping (Article 7, Decree 4725 of 2005)');
    expect(ui).toContain(
      'Pre-filing Audit of Your Certificate of Free Sale (CFS/CVL) & Technical File'
    );
    expect(ui).toContain(
      'Keep Ownership of Your Registration with an Authorized Importer in Colombia'
    );
    expect(ui).toContain('Solicitar pre-diagnóstico y cotización →');
    expect(ui).toContain('Request Pre-Assessment & Quote →');
    expect(ui).toContain(NOTA_ES);
    expect(ui).toContain(NOTA_EN);
    expect(ui).toContain('Evaluar mi producto y cotizar');
    expect(ui).toContain('Assess My Device & Get a Quote');
    expect(ui).not.toMatch(/aprobaci[oó]n garantizada|guaranteed approval|convalid/i);
  });
});
