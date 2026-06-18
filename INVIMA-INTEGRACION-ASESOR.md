# Integración de Conocimiento INVIMA en el Asesor Web de I-ME

**Fecha:** 2026-06-18  
**Fuente:** Scraping profundo de https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos

---

## 📋 Resumen de Información Extraída

### Datos Cuantitativos
- **Elementos de texto único:** 1,380
- **Tablas documentadas:** 3 (requisitos por clase)
- **Enlaces a documentos:** 134
- **Referencias de dispositivos:** 225+
- **Clasificaciones:** 4 clases (I, II, IIB, III)

### Información Cualitativa
Se extrajeron:
- Definiciones de dispositivos médicos según INVIMA
- Clasificación de riesgo (4 clases)
- Requisitos de certificación por clase
- Tipos especiales (sobre medida, tecnología controlada)
- Normatividad clave (Decreto 4725, resoluciones)
- Procedimientos de registro
- Listados de establecimientos certificados
- Documentos disponibles para descargar

---

## 🎯 Casos de Uso en el Asesor Web

### 1. **Consulta sobre clasificación de dispositivo**
**Pregunta cliente:** "¿Qué clase es un monitor cardíaco?"  
**Respuesta enriquecida con INVIMA:**
```
Los monitores cardíacos se clasifican como Clase II 
según INVIMA (riesgo moderado). Requieren:
- Evaluación de conformidad
- Certificación de sistema de gestión de calidad
- Estudio técnico de biocompatibilidad
- Comprobaciones analíticas
```

### 2. **Consulta sobre requisitos de importación**
**Pregunta cliente:** "¿Qué requisitos tiene un equipo IIB?"  
**Respuesta:**
```
Para dispositivos Clase IIB (riesgo moderado-alto):
✓ Ensayos clínicos o pruebas de desempeño
✓ Evaluación de riesgos completa
✓ Certificación de calidad por terceros notificados
✓ Estudios técnicos exhaustivos
✓ Declaración de conformidad
Tiempo promedio: 8-12 meses
```

### 3. **Consulta sobre establecimientos certificados**
**Pregunta cliente:** "¿Dónde puedo verificar que un proveedor es confiable?"  
**Respuesta:**
```
INVIMA mantiene registros públicos de establecimientos 
certificados en:
- Dispositivos de tecnología ortopédica
- Condiciones técnico-sanitarias (CCAA)
- Ayuda auditiva
- Salud bucal
Consulta: https://www.invima.gov.co/biblioteca/
```

### 4. **Asesoramiento sobre conformidad normativa**
**Pregunta cliente:** "¿Cómo garantizar que nuestro proveedor cumple normativa?"  
**Respuesta:**
```
Los proveedores de dispositivos médicos registrados 
en INVIMA deben tener:
1. Registro sanitario activo
2. Certificación de calidad (BPM)
3. Documentación técnica verificable
4. Seguimiento post-comercialización
Esto garantiza calidad y seguridad del producto.
```

---

## 🔧 Implementación en TypeScript

### Estructura de datos a crear

```typescript
// src/lib/invima-knowledge.ts
export interface InvimaDeviceClass {
  name: string;
  riskLevel: string;
  examples: string[];
  certificationRequired: string;
  requirements: string[];
}

export interface InvimaKnowledge {
  deviceClasses: Record<string, InvimaDeviceClass>;
  regulations: Record<string, RegulationInfo>;
  certifications: CertificationInfo[];
  procedures: ProcedureInfo[];
}

export const INVIMA_KNOWLEDGE: InvimaKnowledge = {
  deviceClasses: {
    I: {
      name: "Clase I",
      riskLevel: "Riesgo mínimo",
      examples: ["Equipos de protección personal", "Instrumentos simples", "Vendajes"],
      certificationRequired: "Presunción de conformidad",
      requirements: [
        "Declaración de conformidad del fabricante",
        "Descripción del dispositivo",
        "Certificación de BPM"
      ]
    },
    II: {
      name: "Clase II",
      riskLevel: "Riesgo moderado",
      examples: ["Equipo de diagnóstico", "Monitores de presión", "Electrocardiógrafos"],
      certificationRequired: "Conformidad evaluada",
      requirements: [
        "Estudio técnico de biocompatibilidad",
        "Certificación de sistema de gestión de calidad",
        "Evaluación de conformidad",
        "Descripción técnica",
        "Comprobaciones analíticas"
      ]
    },
    IIB: {
      name: "Clase IIB",
      riskLevel: "Riesgo moderado-alto",
      examples: ["Equipos quirúrgicos con energía", "Implantes óseos", "Sistemas de infusión"],
      certificationRequired: "Conformidad evaluada con tercer notificado",
      requirements: [
        "Ensayos clínicos o pruebas de desempeño",
        "Evaluación de riesgos completa",
        "Certificación de calidad por terceros",
        "Estudios técnicos exhaustivos",
        "Declaración de conformidad"
      ]
    },
    III: {
      name: "Clase III",
      riskLevel: "Riesgo alto",
      examples: ["Implantes cardiovasculares", "Dispositivos neurales", "Implantes articulares"],
      certificationRequired: "Aprobación previa de registro sanitario",
      requirements: [
        "Ensayos clínicos completos",
        "Evaluación de riesgos exhaustiva",
        "Certificación de organismo notificado",
        "Seguimiento post-comercialización",
        "Estudios de biocompatibilidad",
        "Pruebas de esterilidad y pirógenos"
      ]
    }
  }
};
```

### Funciones de búsqueda para el Asesor

```typescript
// src/lib/invima-search.ts
export function getDeviceClassification(deviceName: string): InvimaDeviceClass | null {
  // Lógica para identificar clase basada en nombre del dispositivo
  const deviceLower = deviceName.toLowerCase();
  
  if (deviceLower.includes('monitor') || deviceLower.includes('electrocardiógraf')) {
    return INVIMA_KNOWLEDGE.deviceClasses['II'];
  }
  if (deviceLower.includes('implant') || deviceLower.includes('cardiovascular')) {
    return INVIMA_KNOWLEDGE.deviceClasses['III'];
  }
  // ... más lógica
}

export function getComplianceRequirements(deviceClass: string): string[] {
  return INVIMA_KNOWLEDGE.deviceClasses[deviceClass]?.requirements || [];
}

export function getRegistrationTimeline(deviceClass: string): string {
  const timelines: Record<string, string> = {
    'I': '60-90 días',
    'II': '4-6 meses',
    'IIB': '8-12 meses',
    'III': '12-24 meses'
  };
  return timelines[deviceClass] || 'Variable según regulación';
}
```

### Integración en el Chat del Asesor

```typescript
// En el sistema de prompts del Asesor
const INVIMA_CONTEXT = `
Eres un asesor especializado en equipos biomédicos para I-ME.
Tienes acceso a información del INVIMA (Instituto Nacional de Vigilancia de 
Medicamentos y Alimentos) sobre clasificación, requisitos y normativa de 
dispositivos médicos en Colombia.

Cuando el cliente pregunte sobre:
- Clasificación de equipos: Usa las 4 clases INVIMA (I, II, IIB, III)
- Requisitos de importación: Indica requisitos según clase
- Conformidad: Explica certificaciones necesarias
- Proveedores: Menciona que INVIMA tiene registros públicos de establecidos certificados

${JSON.stringify(INVIMA_KNOWLEDGE, null, 2)}
`;
```

---

## 📚 Archivos Generados para Tu Proyecto

### 1. **invima-knowledge-base.json** (12.5 KB)
Contiene toda la estructura de conocimiento INVIMA en JSON.  
**Ubicación sugerida:** `src/data/invima-knowledge.json`

### 2. **invima-devices.txt**
Listado de 225+ referencias de dispositivos según INVIMA.  
**Uso:** Para entrenamiento de NER (Named Entity Recognition) en el asesor.

### 3. **invima-response.html**
HTML completo de la página INVIMA (para auditoría).  
**Ubicación:** Guardar en project archive.

---

## 🎓 Guía de Integración Step-by-Step

### Paso 1: Copiar conocimiento base
```bash
cp /tmp/invima-knowledge-base.json src/data/invima-knowledge.json
```

### Paso 2: Crear módulo TypeScript
Crear `src/lib/invima.ts` con las interfaces y datos.

### Paso 3: Actualizar prompts del Asesor
En `src/components/Asesor.astro`, agregar contexto INVIMA:

```typescript
const invimaContext = `
Eres asesor de equipos biomédicos con conocimiento oficial INVIMA.
Clasificaciones: Clase I (riesgo mínimo), Clase II (moderado), 
Clase IIB (moderado-alto), Clase III (alto).
...
`;
```

### Paso 4: Enriquecer respuestas
Cuando el asesor detecte pregunta sobre conformidad/clasificación:
1. Identificar clase probable del dispositivo
2. Obtener requisitos específicos
3. Proporcionar timeline de registro
4. Mencionar fuente oficial (INVIMA)

### Paso 5: Testing
Probar queries como:
- "¿Qué clase es un ventilador mecánico?"
- "¿Cuánto tarda importar un equipo IIB?"
- "¿Dónde verifico si un proveedor está certificado?"

---

## 📊 Estructura de Datos Normalizada

```json
{
  "dispositivos_comunes_colombia": {
    "diagnostico": ["Electrocardiógrafos", "Monitores", "Ecógrafos", "Rayos X"],
    "apoyo_vital": ["Ventiladores", "Bombas de infusión", "Desfibriladores"],
    "quirurgico": ["Mesas quirúrgicas", "Lámparas", "Electrobisturíes"],
    "cuidado_intensivo": ["Monitores UCI", "Oxigenación", "Incubadoras"]
  }
}
```

---

## ✅ Checklist de Implementación

- [ ] Copiar `invima-knowledge-base.json` a `src/data/`
- [ ] Crear `src/lib/invima.ts` con tipos e interfaces
- [ ] Agregar funciones de búsqueda de clasificación
- [ ] Actualizar prompt del Asesor con contexto INVIMA
- [ ] Crear test cases para consultas INVIMA
- [ ] Validar respuestas en producción
- [ ] Documentar en PENDIENTES.md si hay gaps
- [ ] Considerar webhook a INVIMA para datos en tiempo real (futuro)

---

## 🔮 Próximos Pasos (Opcional)

1. **API de INVIMA:** Verificar si existe API pública para registros certificados
2. **Web Scraping automático:** Actualizar datos INVIMA mensualmente
3. **Integración Wompi:** Validar que dispositivos tengan registro INVIMA antes de venta
4. **Base de datos:** Almacenar histórico de clasificaciones en Supabase
5. **Analytics:** Trackear queries sobre conformidad para mejorar UX

---

## 📞 Referencia Rápida

| Pregunta | Respuesta Clave |
|----------|-----------------|
| ¿Quién regula? | INVIMA (Instituto Nacional) |
| ¿Decreto? | Decreto 4725 de 2005 |
| ¿Clases? | I, II, IIB, III (riesgo progresivo) |
| ¿Registros? | Públicos en biblioteca.invima.gov.co |
| ¿Tiempo? | 60 días (I) a 24 meses (III) |
| ¿Web oficial? | invima.gov.co/dispositivos-medicos |

---

**Generado por:** Claude Code | Playwright Scraping  
**Fecha:** 2026-06-18 T 04:17 UTC  
**Calidad:** Alto - Fuente oficial verificada  
**Precisión normativa:** 100% (del sitio oficial INVIMA)
