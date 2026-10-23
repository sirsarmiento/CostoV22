import { calculateMultiItemTotals, clasificacionCabecera, productosYaUsados, serializarLineas } from './budget-items';
import { Parts } from '../models/Cost/budge';

describe('budget-items', () => {
  it('marca Varios cuando hay producto y servicio juntos', () => {
    expect(clasificacionCabecera([
      { clave: 'a', productoId: 1, clasificacion: 'Producto', nombre: 'Busto', cantidad: 1, tiempoSetup: 0, tiempoPostProcesado: 0, tasaFallo: 5, margenGanancia: 20, piezas: [] },
      { clave: 'b', productoId: 2, clasificacion: 'Servicio', nombre: 'Modelado', cantidad: 1, tiempoSetup: 0, tiempoPostProcesado: 0, tasaFallo: 5, margenGanancia: 20, piezas: [] }
    ])).toBe('Varios');
  });

  it('bloquea productos ya agregados', () => {
    expect(productosYaUsados([
      { clave: 'a', productoId: 7, clasificacion: 'Producto', nombre: 'A', cantidad: 1, tiempoSetup: 0, tiempoPostProcesado: 0, tasaFallo: 5, margenGanancia: 20, piezas: [] }
    ])).toEqual([7]);
  });

  it('suma el total de varios ítems y el envío una sola vez', () => {
    const piezas: Parts[] = [{
      tipo: 'Fabricada',
      cantidad: 1,
      gramos: 100,
      precioMaterial: 0.05,
      horas: 1,
      minutos: 0
    }];
    const totales = calculateMultiItemTotals([
      { clave: 'a', productoId: 1, clasificacion: 'Producto', nombre: 'Uno', cantidad: 1, tiempoSetup: 0, tiempoPostProcesado: 0, tasaFallo: 0, margenGanancia: 0, piezas },
      { clave: 'b', productoId: 2, clasificacion: 'Servicio', nombre: 'Dos', cantidad: 1, tiempoSetup: 0, tiempoPostProcesado: 0, tasaFallo: 0, margenGanancia: 0, piezas }
    ], 10, [], 0, 160);
    expect(totales.totalCostoMaterial).toBeCloseTo(10, 2);
    expect(totales.costoTotalFinal).toBeCloseTo(20, 2);
  });

  it('serializa las líneas sin meter las piezas dentro del json', () => {
    const lineas = serializarLineas([{
      clave: 'a', productoId: 3, clasificacion: 'Producto', nombre: 'Busto', cantidad: 2,
      tiempoSetup: 10, tiempoPostProcesado: 5, tasaFallo: 11, margenGanancia: 30,
      piezas: [{ tipo: 'Fabricada', nombre: 'Base' }]
    }]);
    expect(lineas[0]['productoId']).toBe(3);
    expect(lineas[0]['piezas']).toBeUndefined();
  });
});
