import { Asset } from '../models/Cost/asset';
import { Product, PiezaProducto } from '../models/Cost/product';
import { InventoryMovement } from '../models/Cost/inventory';

export interface LineaDesacopleCalculada {
  activoId: number;
  nombre: string;
  tipo: string;
  recuperado: number;
  merma: number;
  unidadMedida: string;
}

export interface ResultadoInsumosFiltrados {
  insumosFiltrados: Asset[];
  productoSinPiezas: boolean;
  selectedProductPiecesCount: number;
}

/* Calcula el desglose automático de materiales (recuperables vs merma) para el desacople de un producto.*/
export function calcularDesgloseDesacople(
  currentProd: Product | Record<string, unknown> | null | undefined,
  cantProd: number,
  allAssets: Asset[]
): LineaDesacopleCalculada[] {
  if (!currentProd || cantProd <= 0) {
    return [];
  }

  const prodRec = currentProd as Record<string, unknown>;
  const rawPiezas = (prodRec['piezasProducto'] ?? prodRec['piezas_producto'] ?? prodRec['piezas'] ?? []) as (PiezaProducto | Record<string, unknown>)[];
  if (rawPiezas.length === 0) {
    return [];
  }

  const lineasCalculadas: LineaDesacopleCalculada[] = [];

  rawPiezas.forEach(pz => {
    const rawPz = pz as Record<string, unknown>;
    const actId = Number(rawPz['activo'] ?? rawPz['activo_id'] ?? rawPz['assetId'] ?? rawPz['materialId']);
    const matName = String(rawPz['materialDisplayName'] || rawPz['materialTipo'] || rawPz['activoNombre'] || '').trim().toLowerCase();

    const asset = allAssets.find(a => {
      if (actId && a.id == actId) return true;
      const aNom = (a.nombre || '').trim().toLowerCase();
      if (matName && (aNom.includes(matName) || matName.includes(aNom))) return true;
      if (rawPz['nombre'] && aNom === String(rawPz['nombre']).trim().toLowerCase()) return true;
      return false;
    });

    const realActivoId = asset?.id || actId || 0;
    const nombreActivo = asset?.nombre || rawPz['materialDisplayName'] || rawPz['materialTipo'] || rawPz['activoNombre'] || rawPz['nombre'] || `Insumo #${actId || 'N/A'}`;
    const tipoActivo = String(asset?.tipo || rawPz['tipo'] || '').toLowerCase();
    const catActivo = (asset?.categoria || '').toLowerCase();

    // Material de impresión 3D / resina / filamento (Merma Irrecuperable):
    const esMaterial = tipoActivo === 'material'
      || catActivo === 'filamento'
      || catActivo === 'resina'
      || catActivo.includes('filam')
      || catActivo.includes('resin')
      || String(rawPz['tipo']).toLowerCase() === 'fabricada'
      || (rawPz['gramos'] !== undefined && Number(rawPz['gramos']) > 0);

    if (esMaterial) {
      const gramosUnitario = Number(rawPz['gramos']) || Number(rawPz['cantidad']) || 1;
      const totalMerma = Math.round(gramosUnitario * cantProd * 100) / 100;

      lineasCalculadas.push({
        activoId: realActivoId,
        nombre: String(nombreActivo),
        tipo: 'Material (Merma)',
        recuperado: 0,
        merma: totalMerma,
        unidadMedida: asset?.unidadMedida || 'Gramos'
      });
    } else {
      // Insumo circulante / accesorio del inventario (Recuperable):
      const cantUnitaria = Number(rawPz['cantidad']) || 1;
      const totalRecuperable = Math.round(cantUnitaria * cantProd * 100) / 100;

      lineasCalculadas.push({
        activoId: realActivoId,
        nombre: String(nombreActivo),
        tipo: 'Del Inventario (Recuperable)',
        recuperado: totalRecuperable,
        merma: 0,
        unidadMedida: asset?.unidadMedida || 'Unidades'
      });
    }
  });

  return lineasCalculadas;
}

/* Filtra los insumos de inventario relevantes para el producto seleccionado y el tipo de insumo actual.*/
export function filtrarInsumosParaProducto(
  currentProd: Product | Record<string, unknown> | null | undefined,
  tempTipoInsumo: 'Circulante' | 'Material',
  allAssets: Asset[]
): ResultadoInsumosFiltrados {
  if (!currentProd) {
    return {
      insumosFiltrados: [],
      productoSinPiezas: false,
      selectedProductPiecesCount: 0
    };
  }

  const prodRec = currentProd as Record<string, unknown>;
  const rawPiezas = (prodRec['piezasProducto'] ?? prodRec['piezas_producto'] ?? prodRec['piezas'] ?? []) as (PiezaProducto | Record<string, unknown>)[];

  const selectedProductPiecesCount = rawPiezas.length;
  if (rawPiezas.length === 0) {
    return {
      insumosFiltrados: [],
      productoSinPiezas: true,
      selectedProductPiecesCount: 0
    };
  }

  const piezasActivosIds: number[] = [];
  const piezasNombres: string[] = [];

  rawPiezas.forEach(pz => {
    const rawPz = pz as Record<string, unknown>;
    const actId = rawPz['activo'] ?? rawPz['activo_id'] ?? rawPz['assetId'] ?? rawPz['materialId'];
    if (actId) {
      piezasActivosIds.push(Number(actId));
    }
    const actNom = String(rawPz['activoNombre'] || rawPz['materialDisplayName'] || rawPz['materialTipo'] || '').trim().toLowerCase();
    if (actNom) {
      piezasNombres.push(actNom);
    }
    if (rawPz['nombre']) {
      piezasNombres.push(String(rawPz['nombre']).trim().toLowerCase());
    }
  });

  const activosPorTipo = allAssets.filter(a => {
    const tipo = (a.tipo || '').toLowerCase().trim();
    const cat = (a.categoria || '').toLowerCase().trim();

    if (tempTipoInsumo === 'Circulante') {
      return tipo === 'circulante' && (cat === 'producción' || cat === 'produccion');
    } else if (tempTipoInsumo === 'Material') {
      return tipo === 'material' || cat === 'filamento' || cat === 'resina' || cat.includes('filam') || cat.includes('resin');
    }
    return true;
  });

  if (piezasActivosIds.length > 0 || piezasNombres.length > 0) {
    const matched = activosPorTipo.filter(a => {
      const matchId = piezasActivosIds.includes(Number(a.id));
      const aNom = (a.nombre || '').trim().toLowerCase();
      const matchNom = piezasNombres.some(n => n && (aNom.includes(n) || n.includes(aNom)));
      return matchId || matchNom;
    });

    return {
      insumosFiltrados: matched,
      productoSinPiezas: matched.length === 0,
      selectedProductPiecesCount
    };
  }

  return {
    insumosFiltrados: [],
    productoSinPiezas: true,
    selectedProductPiecesCount
  };
}

/*Normaliza y clasifica el tipo de movimiento de inventario.*/
export function clasificarTipoMovimiento(m: InventoryMovement): string {
  const rawM = m as unknown as Record<string, unknown>;
  const rawTipo = String(m.tipo || rawM['tipo_movimiento'] || rawM['tipoMovimiento'] || rawM['type'] || '').toUpperCase().trim();
  const obs = String(m.observacion || '').toLowerCase();
  const isProductoTerminado = !!(m.producto || rawM['producto_id'] || rawM['productoId'] || (obs.includes('producto') && !obs.includes('insumo') && !obs.includes('material')));

  if (obs.includes('pérdida') || obs.includes('perdida') || obs.includes('merma') || rawTipo === 'PERDIDA' || rawTipo === 'MERMA' || rawTipo === 'PÉRDIDA / MERMA') {
    return 'PÉRDIDA / MERMA';
  }

  if (obs.includes('material recuperado') || obs.includes('recuperad') || rawTipo === 'RECUPERADO' || rawTipo === 'RECUPERACION' || rawTipo === 'RECUPERACIÓN') {
    return 'RECUPERACIÓN';
  }

  if (obs.includes('desacople de producto') || (obs.includes('desacople') && isProductoTerminado) || rawTipo === 'DESACOPLE (PT)' || rawTipo === 'DESACOPLE') {
    return isProductoTerminado ? 'DESACOPLE' : 'RECUPERACIÓN';
  }

  if (obs.includes('desacople') || obs.includes('desarm') || rawTipo === 'DESACOPLE' || rawTipo === 'DESACOPLED') {
    return isProductoTerminado ? 'DESACOPLE' : 'RECUPERACIÓN';
  }

  if (
    rawTipo === 'PRODUCCIÓN' ||
    rawTipo === 'PRODUCCION' ||
    rawTipo === 'PRODUCCIÓN (PT)' ||
    rawTipo === 'PRODUCCION (PT)'
  ) {
    return 'PRODUCCIÓN';
  }

  if (rawTipo === 'VENTA' || rawTipo === 'VENTA (PT)') {
    return 'VENTA';
  }

  if (rawTipo === 'COMPRA INSUMO' || rawTipo === 'CONSUMO INSUMO' || rawTipo === 'RECUPERACIÓN' || rawTipo === 'PÉRDIDA / MERMA' || rawTipo === 'DESACOPLE') {
    return rawTipo;
  }

  if (rawTipo === 'ENTRADA_PT' || (isProductoTerminado && (obs.includes('ingreso a stock') || obs.includes('fabricaci') || obs.includes('producci')))) {
    return 'PRODUCCIÓN';
  }

  if (rawTipo === 'SALIDA_PT' || (isProductoTerminado && (obs.includes('salida de producto') || obs.includes('venta')))) {
    return 'VENTA';
  }

  if (obs.includes('compra') || obs.includes('proveedor')) {
    return 'COMPRA INSUMO';
  }

  if (obs.includes('consumo')) {
    return 'CONSUMO INSUMO';
  }

  if (rawTipo === 'SALIDA') {
    return isProductoTerminado ? 'VENTA' : 'CONSUMO INSUMO';
  }

  if (rawTipo === 'ENTRADA' || rawTipo === 'INGRESO') {
    return isProductoTerminado ? 'PRODUCCIÓN' : 'COMPRA INSUMO';
  }

  return rawTipo && rawTipo !== 'UNDEFINED' && rawTipo !== 'NULL' ? rawTipo : 'MOVIMIENTO';
}

/*Devuelve la clase CSS de badge para el tipo de movimiento.*/
export function obtenerBadgeClassMovimiento(tipo: string): string {
  const t = (tipo || '').toUpperCase();
  if (t.includes('PRODUCCIÓN') || t.includes('PRODUCCION') || t.includes('COMPRA') || t.includes('RECUPERAC') || t === 'ENTRADA' || t === 'INGRESO') {
    return 'bg-light-success text-success';
  }
  if (t.includes('VENTA') || t.includes('CONSUMO') || t.includes('SALIDA')) {
    return 'bg-light-danger text-danger';
  }
  if (t.includes('DESACOPLE')) {
    return 'bg-light-warning text-warning';
  }
  if (t.includes('PÉRDIDA') || t.includes('PERDIDA') || t.includes('MERMA')) {
    return 'bg-light-secondary text-secondary';
  }
  return 'bg-light-primary text-primary';
}

/*Formatea una fecha ISO a hora local legible para visualización y filtrado.*/
export function formatFechaLocal(dateStr?: string): string {
  if (!dateStr) return '-';
  const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) {
    return dateStr;
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
