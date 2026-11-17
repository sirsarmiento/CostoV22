import { calculateBudgetTotals } from './budget-calculator';
import { Budget, Parts } from '../models/Cost/budge';
import { Asset } from '../models/Cost/asset';

describe('budget-calculator', () => {
  it('aplica merma por tecnología y no pisa las horas de las piezas con la cabecera', () => {
    const presupuesto = {
      tasaFalloGlobal: 5,
      tasasFallo: 'FDM:5,SLA:18',
      horasImpresion: 10,
      minutosImpresion: 0,
      tiempoSetup: 0,
      tiempoPostProcesado: 0,
      margenGanancia: 0,
      cantidadGlobal: 1,
      delivery: 0,
      piezas: [
        { tipo: 'Fabricada', tecnologia: 'FDM', cantidad: 1, gramos: 100, precioMaterial: 0.05, horas: 1, minutos: 0 },
        { tipo: 'Fabricada', tecnologia: 'SLA', cantidad: 1, gramos: 100, precioMaterial: 0.05, horas: 2, minutos: 0 }
      ] as Parts[]
    } as Budget;

    const totales = calculateBudgetTotals(presupuesto, [], 0, 160, 0, 0);
    expect(totales.totalTiempoHoras).toBeCloseTo(3, 2);
    expect(totales.totalCostoMaterial).toBeCloseTo((5 * 1.05) + (5 * 1.18), 2);
  });

  it('cuesta cada pieza con la tarifa de su propia máquina', () => {
    const maquinas: Asset[] = [
      { id: 1, nombre: 'A', tipo: 'Fijo', categoria: 'Equipo', consumoMaquina: 1000, tarifa: 1, costoMantenimiento: 1, costoInicial: 1920, valorResidual: 0, vidaUtil: 1 } as Asset,
      { id: 2, nombre: 'B', tipo: 'Fijo', categoria: 'Equipo', consumoMaquina: 1000, tarifa: 2, costoMantenimiento: 0, costoInicial: 0, valorResidual: 0, vidaUtil: 1 } as Asset
    ];
    const presupuesto = {
      tasaFalloGlobal: 0,
      tiempoSetup: 0,
      tiempoPostProcesado: 0,
      margenGanancia: 0,
      cantidadGlobal: 1,
      delivery: 0,
      piezas: [
        { tipo: 'Fabricada', tecnologia: 'FDM', cantidad: 1, gramos: 0, precioMaterial: 0, horas: 1, minutos: 0, maquina: 1 },
        { tipo: 'Fabricada', tecnologia: 'SLA', cantidad: 1, gramos: 0, precioMaterial: 0, horas: 1, minutos: 0, maquina: 2 }
      ] as Parts[]
    } as Budget;

    const totales = calculateBudgetTotals(presupuesto, maquinas, 0, 160);
    expect(totales.totalCostoMaquina).toBeCloseTo(4, 2);
  });

  it('suma descartables de resina sobre los gramos', () => {
    const presupuesto = {
      tasaFalloGlobal: 0,
      tiempoSetup: 0,
      tiempoPostProcesado: 0,
      margenGanancia: 0,
      cantidadGlobal: 1,
      delivery: 0,
      piezas: [
        { tipo: 'Fabricada', tecnologia: 'SLA', cantidad: 1, gramos: 100, precioMaterial: 0.10, descartablesPct: 8, horas: 0, minutos: 0 }
      ] as Parts[]
    } as Budget;
    const totales = calculateBudgetTotals(presupuesto, [], 0, 160, 0, 0);
    expect(totales.totalCostoMaterial).toBeCloseTo(10.8, 2);
  });

  it('cuesta control numérico por área y caras', () => {
    const presupuesto = {
      tasaFalloGlobal: 0,
      tiempoSetup: 0,
      tiempoPostProcesado: 0,
      margenGanancia: 0,
      cantidadGlobal: 1,
      delivery: 0,
      piezas: [
        { tipo: 'Fabricada', tecnologia: 'CNC', cantidad: 1, anchoCm: 10, largoCm: 5, areaCm2: 50, carasPcb: 2, precioMaterial: 0.2, horas: 0, minutos: 0 }
      ] as Parts[]
    } as Budget;
    const totales = calculateBudgetTotals(presupuesto, [], 0, 160, 0, 0);
    expect(totales.totalCostoMaterial).toBeCloseTo(20, 2);
  });

  it('en chocolate suma limpieza y empaque aparte del material', () => {
    const presupuesto = {
      tasaFalloGlobal: 0,
      tiempoSetup: 0,
      tiempoPostProcesado: 0,
      margenGanancia: 0,
      cantidadGlobal: 1,
      delivery: 0,
      piezas: [
        { tipo: 'Fabricada', tecnologia: 'CHO', cantidad: 2, gramos: 50, precioMaterial: 0.04, limpiezaMaquina: 0.5, empaque: 1, horas: 0, minutos: 0 }
      ] as Parts[]
    } as Budget;
    const totales = calculateBudgetTotals(presupuesto, [], 0, 160, 0, 0);
    expect(totales.totalCostoMaterial).toBeCloseTo(7, 2);
  });

  it('en alimentos usa el costo estimado y no pide inventario', () => {
    const presupuesto = {
      tasaFalloGlobal: 0,
      tiempoSetup: 0,
      tiempoPostProcesado: 0,
      margenGanancia: 0,
      cantidadGlobal: 1,
      delivery: 0,
      piezas: [
        { tipo: 'Fabricada', tecnologia: 'ALM', cantidad: 3, costoEstimado: 4, materialLibre: 'Masa de hojaldre', horas: 0, minutos: 0 }
      ] as Parts[]
    } as Budget;
    const totales = calculateBudgetTotals(presupuesto, [], 0, 160, 0, 0);
    expect(totales.totalCostoMaterial).toBeCloseTo(12, 2);
  });
});
