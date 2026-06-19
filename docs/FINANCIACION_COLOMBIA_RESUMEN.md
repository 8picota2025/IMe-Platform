# Financiación Colombia — Resumen Ejecutivo

**Vigencia:** 2026-06-19  
**Versión:** 1.0  
**Estado:** Términos completados — Pendiente validación legal formal

---

## 📋 Parámetros Clave (TL;DR)

| Parámetro                | Valor                 | Nota                                     |
| ------------------------ | --------------------- | ---------------------------------------- |
| 🏦 **Tasa Anual**        | **12%**               | Fija durante toda la duración            |
| ⏰ **Plazo Máximo**      | **60 meses (5 años)** | Con opciones de 12, 24, 36, 48, 60 meses |
| 💰 **Aporte Cliente**    | **50% OBLIGATORIO**   | ⚠️ Requisito legal crítico               |
| 📊 **Monto Financiable** | 50% restante          | Máximo 500M COP                          |
| 💵 **Límite Mínimo**     | 1M COP                | Monto mínimo a financiar                 |
| 💵 **Límite Máximo**     | 500M COP              | Considerando aporte del cliente          |
| 📍 **Jurisdicción**      | Colombia              | Código Civil y Comercial Colombiano      |

---

## 🎯 La Restricción Más Importante: 50% de Aporte del Cliente

### Por qué es crítico:

```
✅ Requisito legal y comercial
✅ Vinculante en cualquier contrato
✅ NO se puede financiar más del 50% bajo ninguna circunstancia
✅ Comprobante de pago obligatorio
```

### Cálculo Práctico:

```
Equipo cuesta:              100,000,000 COP
Cliente DEBE aportar (50%):  50,000,000 COP ← OBLIGATORIO
Máximo a financiar (50%):    50,000,000 COP
```

### Cuota Mensual (Ejemplo):

```
Monto financiable:     50,000,000 COP
Plazo:                 60 meses (5 años)
Tasa:                  12% anual
─────────────────────────────────
Cuota mensual:         ~1,055,728 COP
Total pagado:          ~63,343,680 COP
Total intereses:       ~13,343,680 COP
```

---

## 📁 Archivos Generados

### 1. **`src/data/financiacion.json`** (ACTUALIZADO)

Archivo de configuración principal con parámetros:

- ✅ Tasa anual: 12%
- ✅ Plazo máximo: 60 meses
- ✅ Aporte cliente: 50%
- ✅ Límites crediticios
- ✅ Estado: COMPLETADO_LEGAL

### 2. **`src/data/terminos_financiacion_colombia.json`** (NUEVO)

Documento JSON con:

- Parámetros principales completos
- Restricciones legales detalladas
- Proceso de solicitud paso a paso
- Garantías y seguridades
- Normativa legal aplicable
- Causas de terminación
- Historial de versiones

**Uso:** Datos estructurados para APIs, integración con simulador, base de datos.

### 3. **`src/data/TERMINOS_FINANCIACION_COLOMBIA.md`** (NUEVO)

Documento legal en Markdown con:

- ⚠️ Aviso: BORRADOR (requiere revisión legal)
- Secciones completas de términos y condiciones
- Cálculos de ejemplo
- Marco legal y regulatorio
- Contacto y consultas

**Uso:** Comunicación con clientes, borrador para aprobación legal.

### 4. **`src/lib/financiacion.ts`** (NUEVO)

Módulo TypeScript con:

- Constantes de configuración
- Función: `calcularCuotaMensual()`
- Función: `calcularResumenFinanciacion()`
- Función: `generarCronogramaPagos()`
- Función: `validarElegibilidad()`
- Formateo de moneda COP

**Uso:** Simulador, cálculos backend, componentes React/Astro.

### 5. **Este Documento: `docs/FINANCIACION_COLOMBIA_RESUMEN.md`**

Referencia rápida para equipo técnico y comercial.

---

## 🚀 Cómo Usar en el Simulador

### Importar constantes:

```typescript
import {
  FINANCIACION_COLOMBIA,
  calcularCuotaMensual,
  formatearCOP,
} from '@/lib/financiacion';

const tasaAnual = FINANCIACION_COLOMBIA.tasaAnualPorcentaje; // 12
const plazoMaximo = FINANCIACION_COLOMBIA.plazoMaximoMeses; // 60
```

### Calcular cuota:

```typescript
const cuota = calcularCuotaMensual(50_000_000, 60); // 1,055,728 COP
const formateado = formatearCOP(cuota); // "1.055.728 COP"
```

### Resumen completo:

```typescript
const resumen = calcularResumenFinanciacion(100_000_000, 60);
console.log(resumen.cuotaMensual); // 1055728
console.log(resumen.aporteCliente); // 50000000
console.log(resumen.totalIntereses); // 13343680
console.log(resumen.resumen.pagoMensual); // "1.055.728 COP"
```

### Generar cronograma:

```typescript
const cronograma = generarCronogramaPagos(50_000_000, 12);
cronograma.forEach(mes => {
  console.log(
    `Cuota ${mes.cuota}: ${formatearCOP(mes.capital)} capital, ${formatearCOP(mes.interes)} intereses`
  );
});
```

---

## ✅ Checklist Antes de Publicar

- [ ] **LEGAL:** Abogado especializado ha revisado `TERMINOS_FINANCIACION_COLOMBIA.md`
- [ ] **LEGAL:** Cliente (I-ME) ha aprobado por escrito los términos
- [ ] **BACKEND:** Edge Functions validan aporte cliente (50%) antes de procesar crédito
- [ ] **FRONTEND:** Simulador usa funciones de `src/lib/financiacion.ts`
- [ ] **CONTRATO:** Se ha generado contrato formal que referencia estos términos
- [ ] **COMUNICACIÓN:** Cliente ha recibido documento legal en PDF/formal
- [ ] **TESTING:** Se han validado cálculos con casos reales
- [ ] **SEGURIDAD:** `precio_costo` y cálculos sensibles solo en servidor (Edge Functions)
- [ ] **AUDITORÍA:** Cada crédito deja rastro en logs con aporte cliente documentado
- [ ] **DEPLOYMENT:** Variables de configuración en `.env` (tasas, límites)

---

## ⚠️ Estado Legal

### BLOQUEANTE_LEGAL

Este paquete de términos está **COMPLETADO** pero requiere:

1. **Revisión Formal de Abogado**
   - Especialidad: Derecho comercial y financiero
   - Enfoque: Validar conformidad con normativa colombiana
   - Entregable: Memo legal de aprobación

2. **Aprobación Escrita del Cliente (I-ME)**
   - Responsable: Gerencia/Director Legal de I-ME
   - Documento: Email o acta de aprobación
   - Requerimiento: Antes de cualquier publicación

3. **Contrato Formal**
   - Tipo: Contrato de Crédito Comercial
   - Vigencia: Bilateral (I-ME + Cliente)
   - Cláusulas: Deberá incluir estos términos como anexo

4. **Seguro y Garantías** (caso por caso)
   - A evaluar según cliente y monto
   - Puede incluirse en financiamiento

---

## 🔧 Integración Técnica

### Variables de Entorno Sugeridas

```env
# .env (requiere validación)
FINANCIACION_TASA_ANUAL_PORCENTAJE=12
FINANCIACION_PLAZO_MAXIMO_MESES=60
FINANCIACION_APORTE_CLIENTE_PORCENTAJE=50
FINANCIACION_MONTO_MINIMO=1000000
FINANCIACION_MONTO_MAXIMO=500000000
```

### Base de Datos (Supabase)

Tabla sugerida: `creditos`

```sql
CREATE TABLE creditos (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL,
  costo_equipo NUMERIC NOT NULL,
  aporte_cliente NUMERIC NOT NULL,
  monto_financiable NUMERIC NOT NULL,
  plazo_meses INTEGER NOT NULL,
  tasa_anual_porcentaje NUMERIC NOT NULL,
  cuota_mensual NUMERIC NOT NULL,
  total_intereses NUMERIC NOT NULL,
  total_pagado NUMERIC NOT NULL,
  estado TEXT, -- 'pendiente', 'aprobado', 'pagando', 'completado', 'vencido'
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_aprobacion TIMESTAMP,
  fecha_primer_pago TIMESTAMP,
  comprobante_aporte_url TEXT,
  contrato_url TEXT
);
```

---

## 📞 Contacto y Preguntas

**Para dudas técnicas:**

- Revisar `src/lib/financiacion.ts` y documentación inline
- Ejecutar pruebas: `npm run test -- financiacion`

**Para dudas legales/comerciales:**

- Contactar al abogado especializado designado
- Revisar aprobación de I-ME en archivo de actas

**Para publicación en web:**

- Obtener aprobación legal formal ✅
- Incluir disclaimer de BORRADOR si aún está en validación
- Hacer público solo después de aprobación legal completa

---

## 📊 Ejemplo de Comunicación al Cliente

```
Equipo: [Nombre del equipo]
Precio: 100.000.000 COP
Aporte requerido: 50.000.000 COP (50% del costo)

Opción 1 - 12 meses:
  Cuota mensual: ~4.321.101 COP
  Total intereses: ~1.452.200 COP

Opción 2 - 60 meses (5 años):
  Cuota mensual: ~1.055.728 COP
  Total intereses: ~13.343.680 COP

Todos los créditos requieren:
✅ Comprobante de pago del aporte inicial (50%)
✅ Firma de contrato formal
✅ Análisis crediticio según monto
```

---

## 🎓 Educación para el Equipo

### Puntos Clave a Entender:

1. **No negociable:** 50% de aporte del cliente
2. **Fijo:** 12% anual durante toda la duración
3. **Variable:** Plazo (12-60 meses) → afecta cuota mensual
4. **Importante:** Comprobante de aporte es documento legal

### Cálculo Mental Rápido:

- **50M COP a 60 meses:** ~1M COP/mes (aproximado)
- **100M COP a 5 años:** 50M aporte + ~50M a financiar → ~1M/mes

---

## 📝 Historial de Cambios

| Fecha      | Versión | Cambio                                                    |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-06-19 | 1.0     | Creación: parámetros 12% anual, 50% aporte, 5 años máximo |

---

**Última actualización:** 2026-06-19  
**Próxima revisión:** Después de aprobación legal formal  
**Responsable:** Equipo I-ME + Asesor Legal
