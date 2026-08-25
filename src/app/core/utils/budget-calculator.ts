import { Budget, Parts } from '../models/Cost/budge';
import { Asset } from '../models/Cost/asset';

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

/**
 * Extrae un número buscando múltiples posibles nombres de propiedad en un objeto.
 */
export function getNumFromRecord(obj: Record<string, unknown> | null | undefined, keys: string[], defaultVal = 0): number {
  if (!obj) return defaultVal;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const num = Number(obj[k]);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const num = Number(obj[k]);
      if (!isNaN(num)) return num;
    }
  }
  return defaultVal;
}

/**
 * Normaliza las propiedades de un objeto Budget para asegurar que campos aliased
 * (ej: tiempo_setup, prepSlicing, prep_slicing) existan en las propiedades estándar.
 */
export function normalizeBudget(row: Budget | Record<string, unknown>): Budget {
  const r = row as Record<string, unknown>;
  const piezasRaw = r['piezasProducto'] ?? r['piezas'] ?? r['piezasBase'] ?? r['piezas_base'] ?? [];
  const piezasList: Parts[] = Array.isArray(piezasRaw) ? piezasRaw as Parts[] : [];

  const tiempoSetup = getNumFromRecord(r, ['tiempoSetup', 'prepSlicing', 'tiempo_setup', 'prep_slicing'], 0);
  const tiempoPostProcesado = getNumFromRecord(r, ['postProcesado', 'tiempoPostProcesado', 'tiempo_post_procesado', 'post_procesado'], 0);
  const tasaFalloGlobal = getNumFromRecord(r, ['tasaFalloGlobal', 'tasaFallo', 'tasa_fallo_global', 'tasa_fallo'], 0);
  const margenGanancia = getNumFromRecord(r, ['margenGanancia', 'margen_ganancia'], 0);
  const cantidadGlobal = getNumFromRecord(r, ['cantidadGlobal', 'cantidad_global'], 1);
  const delivery = getNumFromRecord(r, ['delivery'], 0);
  const costoMaquina = getNumFromRecord(r, ['costoMaquina', 'costo_maquina', 'costoMaquinaHora', 'tasaMaquina'], 0);

  const producto = r['producto'] ?? r['productoId'] ?? r['producto_id'] ?? null;
  const cliente = r['cliente'] ?? r['clienteId'] ?? r['cliente_id'] ?? null;
  const activo = r['activo'] ?? r['activoId'] ?? r['activo_id'] ?? null;

  return {
    ...(row as Budget),
    tiempoSetup,
    tiempoPostProcesado,
    tasaFalloGlobal,
    margenGanancia,
    cantidadGlobal: cantidadGlobal > 0 ? cantidadGlobal : 1,
    delivery,
    costoMaquina,
    piezas: piezasList,
    producto: producto ? Number(producto) : null,
    cliente: cliente ? Number(cliente) : undefined,
    activo: activo ? Number(activo) : undefined,
    id: r['id'] ? Number(r['id']) : (row as Budget).id,
    sku: String(r['sku'] || (row as Budget).sku || ''),
    clasificacion: String(r['clasificacion'] || (row as Budget).clasificacion || ''),
    descripcion: String(r['descripcion'] || (row as Budget).descripcion || ''),
    numero: String(r['numero'] || (row as Budget).numero || ''),
    fecha: (row as Budget).fecha ? new Date((row as Budget).fecha) : new Date()
  };
}

/**
 * Calcula la estructura completa de costos y precio final del Presupuesto
 * siguiendo exactamente la fórmula del CIF del formulario (add-budget).
 */
export function calculateBudgetTotals(
  row: Budget | Record<string, unknown>,
  allAssets: Asset[] = [],
  totalFijoIndirecto: number = 0,
  capacidadHorasMaquina: number = 160,
  overrideCostoMaquina?: number,
  overrideDepreciacionMaquina?: number
): BudgetCalculationResult {
  const normBudget = normalizeBudget(row);
  const rRec = row as Record<string, unknown>;

  const piezas = normBudget.piezas || [];

  let rawMaterialCost = 0;
  let totalCostoInventario = 0;
  let totalTiempoHorasPiezas = 0;

  piezas.forEach(pieza => {
    const pRec = pieza as unknown as Record<string, unknown>;
    const cant = Number(pRec['cantidad'] ?? pieza.cantidad) || 1;
    const tipo = String(pRec['tipo'] ?? pieza.tipo ?? '');

    if (tipo === 'Del Inventario') {
      const actId = pRec['activo'] ?? pRec['activo_id'] ?? pRec['assetId'] ?? pieza.activo;
      let val = 0;
      if (actId && allAssets && allAssets.length > 0) {
        const foundAsset = allAssets.find(a => a.id == actId);
        if (foundAsset) {
          val = Number(foundAsset.valorUnitario) || Number(foundAsset.costoInicial) || Number((foundAsset as unknown as Record<string, unknown>)['precio']) || 0;
        }
      }
      if (val <= 0) {
        val = Number(pRec['costoInicial'] ?? pRec['valorUnitario'] ?? pRec['precio'] ?? pRec['precioMaterial'] ?? pieza.precioMaterial) || 0;
      }
      totalCostoInventario += val * cant;
    } else {
      const gramos = Number(pRec['gramos'] ?? pieza.gramos) || 0;
      const precioMaterial = Number(pRec['precioMaterial'] ?? pRec['precio_material'] ?? pieza.precioMaterial) || 0;
      rawMaterialCost += (gramos * precioMaterial) * cant;

      const horas = Number(pRec['horas'] ?? pieza.horas) || 0;
      const minutos = Number(pRec['minutos'] ?? pieza.minutos) || 0;
      const tiempoPieza = horas + (minutos / 60);
      totalTiempoHorasPiezas += tiempoPieza * cant;
    }
  });

  const tasaFalloGlobal = normBudget.tasaFalloGlobal || 0;
  const totalCostoMaterial = rawMaterialCost * (1 + (tasaFalloGlobal / 100));

  const tiempoSetupMin = normBudget.tiempoSetup || 0;
  const tiempoPostProcesadoMin = normBudget.tiempoPostProcesado || 0;
  const tiempoExtraHoras = (tiempoSetupMin + tiempoPostProcesadoMin) / 60;
  const totalTiempoHoras = totalTiempoHorasPiezas + tiempoExtraHoras;

  // Determinar costo de máquina y depreciación de máquina por hora
  let costoMaquinaRate = 0;
  let tasaDepreciacionMaquina = 0;

  if (overrideCostoMaquina !== undefined && overrideCostoMaquina > 0) {
    costoMaquinaRate = overrideCostoMaquina;
  }
  if (overrideDepreciacionMaquina !== undefined) {
    tasaDepreciacionMaquina = overrideDepreciacionMaquina;
  }

  if (costoMaquinaRate <= 0) {
    const directRate = normBudget.costoMaquina || 0;
    if (directRate > 0) {
      costoMaquinaRate = directRate;
    } else {
      // Buscar máquina asociada en presupuesto o piezas
      const targetActivoId = rRec['activoId'] ?? rRec['activo_id'] ?? rRec['activo'] ?? normBudget.activo;
      let machineAsset: Asset | undefined;
      if (targetActivoId && allAssets && allAssets.length > 0) {
        machineAsset = allAssets.find(a => a.id == targetActivoId);
      }
      if (!machineAsset && piezas.length > 0 && allAssets && allAssets.length > 0) {
        for (const p of piezas) {
          const pRec = p as unknown as Record<string, unknown>;
          const maqId = p.maquina ?? pRec['maquina_id'] ?? pRec['activo_id'];
          if (maqId) {
            machineAsset = allAssets.find(a => a.id == maqId);
            if (machineAsset) break;
          }
        }
      }
      if (!machineAsset && allAssets && allAssets.length > 0) {
        machineAsset = allAssets.find(a => 
          (a as unknown as Record<string, unknown>)['clasificacion'] === 'Maquinaria' || 
          (a as unknown as Record<string, unknown>)['tipo'] === 'Maquinaria' ||
          a.categoria?.toLowerCase() === 'maquinaria' ||
          (a.tipo?.toLowerCase() === 'fijo' && a.categoria?.toLowerCase() === 'equipo')
        );
      }

      if (machineAsset) {
        const consumo = Number(machineAsset.consumoMaquina) || 0;
        const tarifa = Number(machineAsset.tarifa) || 0;
        const mantenimiento = Number(machineAsset.costoMantenimiento) || 0;
        costoMaquinaRate = (consumo / 1000 * tarifa) + mantenimiento;

        if (tasaDepreciacionMaquina <= 0) {
          const costoInicial = Number(machineAsset.costoInicial) || 0;
          const valorResidual = Number(machineAsset.valorResidual) || 0;
          const vidaUtilAnos = Number(machineAsset.vidaUtil) > 0 ? Number(machineAsset.vidaUtil) : 1;
          const vidaUtilHoras = vidaUtilAnos * 1920;
          tasaDepreciacionMaquina = (costoInicial - valorResidual) / vidaUtilHoras;
        }
      }
    }
  }

  const totalCostoMaquina = costoMaquinaRate * totalTiempoHoras;

  const capHoras = capacidadHorasMaquina > 0 ? capacidadHorasMaquina : 160;
  const tasaCIF = (totalFijoIndirecto || 0) / capHoras;
  const costoIndirectoAsignado = tasaCIF * totalTiempoHoras;
  const depreciacionAsignada = tasaDepreciacionMaquina * totalTiempoHoras;

  const costoTotalUnitarioBase = totalCostoMaterial + totalCostoMaquina + costoIndirectoAsignado + depreciacionAsignada + totalCostoInventario;

  const margen = normBudget.margenGanancia || 0;
  const factorGanancia = margen < 1 ? margen : margen / 100;
  const precioSugeridoUnitario = factorGanancia >= 1
    ? costoTotalUnitarioBase / 0.0001
    : costoTotalUnitarioBase / (1 - factorGanancia);

  const cantidadGlobal = normBudget.cantidadGlobal || 1;
  const delivery = normBudget.delivery || 0;
  const costoTotalFinal = (precioSugeridoUnitario * cantidadGlobal) + delivery;

  const totalGramos = piezas.reduce((sum, pieza) => {
    const pRec = pieza as unknown as Record<string, unknown>;
    const cant = Number(pRec['cantidad'] ?? pieza.cantidad) || 1;
    return sum + ((Number(pRec['gramos'] ?? pieza.gramos) || 0) * cant);
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
