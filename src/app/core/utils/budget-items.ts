import { Budget, Parts } from '../models/Cost/budge';
import { Asset } from '../models/Cost/asset';
import { Product } from '../models/Cost/product';
import { BudgetCalculationResult, calculateBudgetTotals } from './budget-calculator';
import { AssetCatalog, mapProductToPieces, resolvePiezasDisplay } from './budget-mapper';

export interface BudgetLineItem {
  clave: string;
  productoId: number | null;
  clasificacion: string;
  nombre: string;
  cantidad: number;
  tiempoSetup: number;
  tiempoPostProcesado: number;
  tasaFallo: number;
  margenGanancia: number;
  piezas: Parts[];
}

export function nuevaClaveItem(): string {
  return `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function itemDesdeProducto(product: Product, catalog: AssetCatalog, minMargen = 0): BudgetLineItem {
  const piezas = mapProductToPieces(product, catalog).map((pieza, idx) => ({
    ...pieza,
    id: idx + 1,
    producto: product.id
  }));
  return {
    clave: nuevaClaveItem(),
    productoId: product.id || null,
    clasificacion: product.clasificacion || 'Producto',
    nombre: product.nombre,
    cantidad: 1,
    tiempoSetup: Number(product.tiempoSetup) || 0,
    tiempoPostProcesado: Number(product.postProcesado) || 0,
    tasaFallo: Number(product.tasaFallo) || 5,
    margenGanancia: Number(product.margenGanancia) || minMargen,
    piezas
  };
}

export function serializarLineas(items: BudgetLineItem[]): Array<Record<string, unknown>> {
  return (items || []).map(item => ({
    clave: item.clave,
    productoId: item.productoId,
    clasificacion: item.clasificacion,
    nombre: item.nombre,
    cantidad: item.cantidad,
    tiempoSetup: item.tiempoSetup,
    tiempoPostProcesado: item.tiempoPostProcesado,
    tasaFallo: item.tasaFallo,
    margenGanancia: item.margenGanancia
  }));
}

export function hidratarLineas(
  data: Record<string, unknown>,
  piezas: Parts[],
  catalog?: AssetCatalog
): BudgetLineItem[] {
  const piezasResueltas = catalog ? resolvePiezasDisplay(piezas, catalog) : piezas;
  const crudo = data['lineas'] ?? data['items'];
  let parsed: unknown[] = [];
  if (typeof crudo === 'string' && crudo.trim()) {
    try {
      parsed = JSON.parse(crudo);
    } catch {
      parsed = [];
    }
  } else if (Array.isArray(crudo)) {
    parsed = crudo;
  }

  if (parsed.length > 0) {
    const algunaTieneProducto = (piezasResueltas || []).some(p => {
      const pRec = p as unknown as Record<string, unknown>;
      const pid = Number(p.producto ?? pRec['producto_id'] ?? pRec['productoId']);
      return pid > 0;
    });

    return parsed.map((fila, idx) => {
      const rec = fila as Record<string, unknown>;
      const productoId = rec['productoId'] != null ? Number(rec['productoId']) : null;
      let piezasItem: Parts[] = [];
      if (algunaTieneProducto) {
        piezasItem = (piezasResueltas || []).filter(p => {
          const pRec = p as unknown as Record<string, unknown>;
          const pid = Number(p.producto ?? pRec['producto_id'] ?? pRec['productoId']);
          return productoId ? pid === productoId : false;
        });
      } else {
        if (parsed.length === 1 || idx === 0) {
          piezasItem = piezasResueltas;
        }
      }

      return {
        clave: String(rec['clave'] || `item-${idx + 1}`),
        productoId,
        clasificacion: String(rec['clasificacion'] || 'Producto'),
        nombre: String(rec['nombre'] || `Ítem ${idx + 1}`),
        cantidad: Number(rec['cantidad']) || 1,
        tiempoSetup: Number(rec['tiempoSetup']) || 0,
        tiempoPostProcesado: Number(rec['tiempoPostProcesado']) || 0,
        tasaFallo: Number(rec['tasaFallo']) || 5,
        margenGanancia: Number(rec['margenGanancia']) || 0,
        piezas: piezasItem.length ? piezasItem : (parsed.length === 1 ? piezasResueltas : [])
      };
    });
  }

  if ((piezasResueltas || []).length === 0 && !data['producto'] && !data['productoId']) {
    return [];
  }

  const rawProd = data['productoId'] ?? data['producto_id'] ?? data['producto'];
  const productoId = rawProd && typeof rawProd === 'object'
    ? Number((rawProd as Record<string, unknown>)['id']) || null
    : (rawProd != null && rawProd !== '' ? Number(rawProd) || null : null);

  return [{
    clave: 'item-legacy',
    productoId,
    clasificacion: String(data['clasificacion'] || 'Producto'),
    nombre: String(data['descripcion'] || 'Ítem 1'),
    cantidad: Number(data['cantidadGlobal']) || 1,
    tiempoSetup: Number(data['tiempoSetup']) || 0,
    tiempoPostProcesado: Number(data['tiempoPostProcesado'] ?? data['postProcesado']) || 0,
    tasaFallo: Number(data['tasaFalloGlobal'] ?? data['tasaFallo']) || 5,
    margenGanancia: Number(data['margenGanancia']) || 0,
    piezas: piezasResueltas || []
  }];
}

export function clasificacionCabecera(items: BudgetLineItem[]): string {
  const tipos = [...new Set((items || []).map(i => i.clasificacion).filter(Boolean))];
  if (tipos.length === 1) return tipos[0];
  if (tipos.length > 1) return 'Varios';
  return 'General';
}

export function productosYaUsados(items: BudgetLineItem[]): number[] {
  return (items || []).map(i => Number(i.productoId)).filter(id => id > 0);
}

export function calculateMultiItemTotals(
  items: BudgetLineItem[],
  delivery: number,
  allAssets: Asset[] = [],
  totalFijoIndirecto = 0,
  capacidadHorasMaquina = 176
): BudgetCalculationResult {
  const vacio = calculateBudgetTotals(
    { piezas: [], cantidadGlobal: 1, margenGanancia: 0, tasaFalloGlobal: 0, tiempoSetup: 0, tiempoPostProcesado: 0, delivery: 0 } as Budget,
    allAssets,
    totalFijoIndirecto,
    capacidadHorasMaquina
  );

  if (!items.length) {
    return { ...vacio, delivery, costoTotalFinal: delivery };
  }

  const parciales = items.map(item => calculateBudgetTotals(
    {
      piezas: item.piezas,
      cantidadGlobal: item.cantidad || 1,
      margenGanancia: item.margenGanancia,
      tasaFalloGlobal: item.tasaFallo,
      tiempoSetup: item.tiempoSetup,
      tiempoPostProcesado: item.tiempoPostProcesado,
      delivery: 0
    } as Budget,
    allAssets,
    totalFijoIndirecto,
    capacidadHorasMaquina
  ));

  const suma = parciales.reduce((acc, actual) => ({
    ...acc,
    totalGramos: acc.totalGramos + actual.totalGramos,
    totalTiempoHoras: acc.totalTiempoHoras + actual.totalTiempoHoras,
    rawMaterialCost: acc.rawMaterialCost + actual.rawMaterialCost,
    totalCostoMaterial: acc.totalCostoMaterial + actual.totalCostoMaterial,
    totalCostoMaquina: acc.totalCostoMaquina + actual.totalCostoMaquina,
    costoIndirectoAsignado: acc.costoIndirectoAsignado + actual.costoIndirectoAsignado,
    depreciacionAsignada: acc.depreciacionAsignada + actual.depreciacionAsignada,
    totalCostoInventario: acc.totalCostoInventario + actual.totalCostoInventario,
    costoTotalUnitarioBase: acc.costoTotalUnitarioBase + actual.costoTotalUnitarioBase,
    precioSugeridoUnitario: acc.precioSugeridoUnitario + actual.precioSugeridoUnitario,
    costoTotalFinal: acc.costoTotalFinal + actual.costoTotalFinal,
    tiempoSetupMin: acc.tiempoSetupMin + actual.tiempoSetupMin,
    tiempoPostProcesadoMin: acc.tiempoPostProcesadoMin + actual.tiempoPostProcesadoMin
  }), { ...vacio });

  const totalHoras = Math.floor(suma.totalTiempoHoras);
  const totalMinutos = Math.round((suma.totalTiempoHoras - totalHoras) * 60);
  const deliveryNum = Number(delivery) || 0;

  return {
    ...suma,
    totalHoras,
    totalMinutos,
    delivery: deliveryNum,
    cantidadGlobal: items.reduce((n, i) => n + (Number(i.cantidad) || 1), 0),
    costoTotalFinal: suma.costoTotalFinal + deliveryNum
  };
}

export function nombresDeLineas(row: Budget | Record<string, unknown>, allProducts: Product[] = []): string {
  const rec = row as Record<string, unknown>;
  const crudo = rec['lineas'] ?? rec['items'];
  let parsed: unknown[] = [];
  if (typeof crudo === 'string' && crudo.trim()) {
    try { parsed = JSON.parse(crudo); } catch { parsed = []; }
  } else if (Array.isArray(crudo)) {
    parsed = crudo;
  }
  if (parsed.length > 0) {
    const nombres = parsed.map(fila => {
      const item = fila as Record<string, unknown>;
      const id = Number(item['productoId']);
      const delCatalogo = id ? allProducts.find(p => p.id == id)?.nombre : '';
      return String(delCatalogo || item['nombre'] || '').trim();
    }).filter(Boolean);
    if (nombres.length) return nombres.join(' + ');
  }
  return '';
}
