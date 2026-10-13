import { describe, expect, it } from 'vitest';
import { capacidadesPublicadas, datosConfianzaProducto } from './producto-confianza';

describe('datosConfianzaProducto', () => {
  it('solo devuelve INVIMA y garantía cuando la ficha los trae', () => {
    const datos = datosConfianzaProducto([
      { clave: 'Registro', grupo: 'Normativa', valor: 'INVIMA 2025DM-0031142' },
      { clave: 'Garantía', grupo: 'Garantía', valor: '2 años' },
      { clave: 'Pantalla', grupo: 'Catálogo IME', valor: '19 pulgadas' },
    ]);
    expect(datos.invima).toEqual([{ clave: 'Registro', valor: 'INVIMA 2025DM-0031142' }]);
    expect(datos.garantia).toEqual([{ clave: 'Garantía', valor: '2 años' }]);
  });

  it('omite INVIMA y garantía si no existen', () => {
    const datos = datosConfianzaProducto([
      { clave: 'Pantalla', grupo: 'Catálogo IME', valor: '19 pulgadas' },
    ]);
    expect(datos.invima).toEqual([]);
    expect(datos.garantia).toEqual([]);
  });
});

describe('capacidadesPublicadas', () => {
  it('toma solo filas que declaran capacidad', () => {
    const filas = capacidadesPublicadas([
      { clave: 'Capacidad', grupo: 'Capacidad', valor: '1010 litros de volumen de cámara' },
      { clave: 'Puerta', grupo: 'Función principal', valor: 'Doble puerta' },
      {
        clave: 'Función principal',
        grupo: 'Catálogo IME',
        valor: 'Autoclave horizontal de vapor para esterilización central de alto volumen',
      },
      { clave: 'Dimensiones de cámara', grupo: 'Dimensiones', valor: '610 x 910 x 1815 mm' },
    ]);
    expect(filas).toEqual([{ clave: 'Capacidad', valor: '1010 litros de volumen de cámara' }]);
  });
});
