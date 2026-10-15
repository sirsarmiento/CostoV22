import { Budget, Parts } from '../models/Cost/budge';
import { Asset } from '../models/Cost/asset';
import { parsearTasasFallo, tasaFalloDePieza } from './family-rules';

export interface BudgetCalculationResult {
  totalGramos: number;
  totalTiempoHoras: number;
  totalHoras: number;
  totalMinutos: number;
  tiempoSetupMin: number;
  tiempoPostProcesadoMin: number;
  rawMaterialCost: number;
  tasaFalloGlobal: number;
  totalCostoMaterial: number;
  costoMaquinaRate: number;
  totalCostoMaquina: number;
  tasaCIF: number;
  costoIndirectoAsignado: number;
  tasaDepreciacionMaquina: number;
  depreciacionAsignada: number;
  totalCostoInventario: number;
  costoTotalUnitarioBase: number;
  margenGanancia: number;
  precioSugeridoUnitario: number;
  cantidadGlobal: number;
  delivery: number;
  costoTotalFinal: number;
}

/** Activo fijo de producción (máquina). No incluye circulante, material ni mobiliario. */
export function isMachineAsset(asset: Asset | null | undefined): boolean {
  if (!asset) return false;
  const tipo = String(asset.tipo || '').toLowerCase().trim();
  const cat = String(asset.categoria || '').toLowerCase().trim();
  if (tipo === 'circulante' || tipo === 'material') return false;
  const esFijo = tipo === 'fijo' || tipo === 'maquinaria' || tipo === '';
  if (!esFijo) return false;
  const consumo = Number(asset.consumoMaquina) || 0;
  return cat === 'equipo'
    || cat.includes('máquina')
    || cat.includes('maquina')
    || cat.includes('impresora')
    || cat.includes('cnc')
    || cat.includes('herramienta')
    || tipo === 'maquinaria'
    || consumo > 0;
}

export function costoHoraMaquina(asset: Asset): { rate: number; dep: number } {
  const consumo = Number(asset.consumoMaquina) || 0;
  const tarifa = Number(asset.tarifa) || 0;
  const mantenimiento = Number(asset.costoMantenimiento) || 0;
  const rate = (consumo / 1000 * tarifa) + mantenimiento;
  const costoInicial = Number(asset.costoInicial) || 0;
  const valorResidual = Number(asset.valorResidual) || 0;
  const vidaUtilAnos = Number(asset.vidaUtil) > 0 ? Number(asset.vidaUtil) : 1;
  const dep = (costoInicial - valorResidual) / (vidaUtilAnos * 1920);
  return { rate, dep: dep > 0 ? dep : 0 };
}

export function depreciacionAnualMaquina(asset: Asset): number {
  const costo = Number(asset.costoInicial) || 0;
  const residual = Number(asset.valorResidual) || 0;
  const vida = Number(asset.vidaUtil) || 0;
  if (costo <= 0 || vida <= 0 || residual < 0 || residual > costo) return 0;
  return (costo - residual) / vida;
}

/** Suma depreciación mensual solo de máquinas, no de todo el inventario. */
export function depreciacionMensualMaquinas(assets: Asset[] = []): number {
  return assets.filter(isMachineAsset).reduce((sum, asset) => sum + depreciacionAnualMaquina(asset) / 12, 0);
}

/**
 * Normaliza las propiedades numéricas y listas de un objeto Budget.
 */
export function normalizeBudget(budget: Budget): Budget {
  return {
    ...budget,
    piezas: budget.piezas || [],
    cantidadGlobal: (budget.cantidadGlobal && budget.cantidadGlobal > 0) ? budget.cantidadGlobal : 1,
    margenGanancia: Number(budget.margenGanancia) || 0,
    tiempoSetup: Number(budget.tiempoSetup) || 0,
    tiempoPostProcesado: Number(budget.tiempoPostProcesado) || 0,
    tasaFalloGlobal: Number(budget.tasaFalloGlobal) || 0,
    delivery: Number(budget.delivery) || 0,
    costoMaquina: Number(budget.costoMaquina) || 0
  };
}

/**
 * Calcula la estructura completa de costos y precio final del Presupuesto
 * siguiendo la fórmula de costeo estándar.
 */
export function calculateBudgetTotals(
  budgetInput: Budget,
  allAssets: Asset[] = [],
  totalFijoIndirecto: number = 0,
  capacidadHorasMaquina: number = 160,
  overrideCostoMaquina?: number,
  overrideDepreciacionMaquina?: number
): BudgetCalculationResult {
  const budget = normalizeBudget(budgetInput);
  const piezas: Parts[] = budget.piezas || [];

  let rawMaterialCost = 0;
  let totalCostoInventario = 0;
  let totalTiempoHorasPiezas = 0;
  let totalCostoMaquinaPiezas = 0;
  let depreciacionPiezas = 0;
  const tasasPorTecnologia = parsearTasasFallo((budget as Budget).tasasFallo);
  const tasaFalloGlobal = budget.tasaFalloGlobal || 0;

  piezas.forEach(pieza => {
    const cant = Number(pieza.cantidad) || 1;
    const tipo = String(pieza.tipo || '');

    if (tipo === 'Del Inventario') {
      let val = 0;
      if (pieza.activo && allAssets.length > 0) {
        const foundAsset = allAssets.find(a => a.id === pieza.activo);
        if (foundAsset) {
          val = Number(foundAsset.valorUnitario) || Number(foundAsset.costoInicial) || 0;
        }
      }
      if (val <= 0) {
        val = Number(pieza.precioMaterial) || 0;
      }
      totalCostoInventario += val * cant;
    } else {
      const gramos = Number(pieza.gramos) || 0;
      let precioMaterial = Number(pieza.precioMaterial) || 0;
      if (precioMaterial <= 0 && pieza.activo && allAssets.length > 0) {
        const foundAsset = allAssets.find(a => a.id === pieza.activo);
        if (foundAsset) {
          precioMaterial = Number(foundAsset.valorUnitario) || Number(foundAsset.costoInicial) || 0;
        }
      }
      if (precioMaterial >= 1.0) {
        precioMaterial = precioMaterial / 1000;
      }
      const tasaPieza = tasaFalloDePieza(pieza, tasasPorTecnologia, tasaFalloGlobal);
      rawMaterialCost += (gramos * precioMaterial) * cant * (1 + (tasaPieza / 100));

      const horas = Number(pieza.horas) || 0;
      const minutos = Number(pieza.minutos) || 0;
      const tiempoPieza = (horas + (minutos / 60)) * cant;
      totalTiempoHorasPiezas += tiempoPieza;

      const maquinaPieza = pieza.maquina && allAssets.length > 0
        ? allAssets.find(a => a.id === pieza.maquina)
        : undefined;
      if (maquinaPieza && tiempoPieza > 0) {
        const costos = costoHoraMaquina(maquinaPieza);
        totalCostoMaquinaPiezas += costos.rate * tiempoPieza;
        depreciacionPiezas += costos.dep * tiempoPieza;
      }
    }
  });

  const headerHoras = Number((budget as Budget).horasImpresion) || 0;
  const headerMinutos = Number((budget as Budget).minutosImpresion) || 0;
  const tiempoCabecera = headerHoras + (headerMinutos / 60);
  if (totalTiempoHorasPiezas <= 0 && tiempoCabecera > 0) {
    totalTiempoHorasPiezas = tiempoCabecera;
  }

  const totalCostoMaterial = rawMaterialCost;

  const tiempoSetupMin = budget.tiempoSetup || 0;
  const tiempoPostProcesadoMin = budget.tiempoPostProcesado || 0;
  const tiempoExtraHoras = (tiempoSetupMin + tiempoPostProcesadoMin) / 60;
  const totalTiempoHoras = totalTiempoHorasPiezas + tiempoExtraHoras;

  let costoMaquinaRate = 0;
  let tasaDepreciacionMaquina = 0;

  if (overrideCostoMaquina !== undefined && overrideCostoMaquina > 0) {
    costoMaquinaRate = overrideCostoMaquina;
  }
  if (overrideDepreciacionMaquina !== undefined) {
    tasaDepreciacionMaquina = overrideDepreciacionMaquina;
  }

  if (costoMaquinaRate <= 0) {
    const directRate = budget.costoMaquina || 0;
    if (directRate > 0) {
      costoMaquinaRate = directRate;
    } else {
      let machineAsset: Asset | undefined;
      if (budget.activo && allAssets.length > 0) {
        machineAsset = allAssets.find(a => a.id === budget.activo);
      }
      if (!machineAsset && piezas.length > 0 && allAssets.length > 0) {
        for (const p of piezas) {
          if (p.maquina) {
            machineAsset = allAssets.find(a => a.id === p.maquina);
            if (machineAsset) break;
          }
        }
      }
      if (!machineAsset && allAssets.length > 0) {
        machineAsset = allAssets.find(a => isMachineAsset(a));
      }

      if (machineAsset) {
        const costos = costoHoraMaquina(machineAsset);
        costoMaquinaRate = costos.rate;
        if (tasaDepreciacionMaquina <= 0) {
          tasaDepreciacionMaquina = costos.dep;
        }
      }
    }
  }

  const usarCostoPorPieza = totalCostoMaquinaPiezas > 0 && !(overrideCostoMaquina !== undefined && overrideCostoMaquina > 0);
  const totalCostoMaquina = usarCostoPorPieza
    ? totalCostoMaquinaPiezas + (costoMaquinaRate * tiempoExtraHoras)
    : costoMaquinaRate * totalTiempoHoras;

  const capHoras = capacidadHorasMaquina > 0 ? capacidadHorasMaquina : 160;
  const tasaCIF = (totalFijoIndirecto || 0) / capHoras;
  const costoIndirectoAsignado = tasaCIF * totalTiempoHoras;
  const depreciacionAsignada = (depreciacionPiezas > 0 && overrideDepreciacionMaquina === undefined)
    ? depreciacionPiezas + (tasaDepreciacionMaquina * tiempoExtraHoras)
    : tasaDepreciacionMaquina * totalTiempoHoras;

  const costoTotalUnitarioBase = totalCostoMaterial + totalCostoMaquina + costoIndirectoAsignado + depreciacionAsignada + totalCostoInventario;

  const margen = budget.margenGanancia || 0;
  const factorGanancia = margen < 1 ? margen : margen / 100;
  const precioSugeridoUnitario = factorGanancia >= 1
    ? costoTotalUnitarioBase / 0.0001
    : costoTotalUnitarioBase / (1 - factorGanancia);

  const cantidadGlobal = budget.cantidadGlobal || 1;
  const delivery = budget.delivery || 0;
  const costoTotalFinal = (precioSugeridoUnitario * cantidadGlobal) + delivery;

  const totalGramos = piezas.reduce((sum, pieza) => {
    const cant = Number(pieza.cantidad) || 1;
    return sum + ((Number(pieza.gramos) || 0) * cant);
  }, 0);

  const totalHoras = Math.floor(totalTiempoHoras);
  const totalMinutos = Math.round((totalTiempoHoras - totalHoras) * 60);

  return {
    totalGramos,
    totalTiempoHoras,
    totalHoras,
    totalMinutos,
    tiempoSetupMin,
    tiempoPostProcesadoMin,
    rawMaterialCost,
    tasaFalloGlobal,
    totalCostoMaterial,
    costoMaquinaRate,
    totalCostoMaquina,
    tasaCIF,
    costoIndirectoAsignado,
    tasaDepreciacionMaquina,
    depreciacionAsignada,
    totalCostoInventario,
    costoTotalUnitarioBase,
    margenGanancia: margen,
    precioSugeridoUnitario,
    cantidadGlobal,
    delivery,
    costoTotalFinal
  };
}
