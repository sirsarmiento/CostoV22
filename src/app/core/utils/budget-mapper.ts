import { Parts } from '../models/Cost/budge';
import { Asset } from '../models/Cost/asset';
import { Product } from '../models/Cost/product';
import { QuickClientData } from '../../theme/shared/components/quick-client-modal/quick-client-modal.component';

export interface AssetCatalog {
  maquinas: Asset[];
  materiales: Asset[];
  circulantes: Asset[];
  mobiliario: Asset[];
}

/**
 * Resuelve y asigna los nombres legibles de máquina y material para cada pieza.
 * Soporta directamente nombres enviados por el backend (maquinaNombre, materialNombre)
 * o realiza la búsqueda por ID en los catálogos correspondientes como fallback.
 */
export function resolvePiezasDisplay(piezasList: Parts[], catalog: AssetCatalog): Parts[] {
  if (!piezasList || !Array.isArray(piezasList)) return [];

  return piezasList.map(p => {
    const pObj = p as unknown as Record<string, unknown>;

    // 1. Resolver Máquina
    const directMaqName = (pObj['maquinaNombre'] || pObj['maquina_nombre'] || pObj['nombreMaquina']) as string | undefined;
    if (directMaqName && directMaqName !== '-' && directMaqName !== '[object Object]') {
      p.maquinaNombre = directMaqName;
    } else {
      const rawMaq = p.maquina ?? pObj['maquina_id'] ?? pObj['maquina'];
      const maqObj = typeof rawMaq === 'object' && rawMaq !== null ? rawMaq as Record<string, unknown> : undefined;
      const maqId = maqObj ? Number(maqObj['id']) : (Number(rawMaq) || undefined);
      if (maqId) {
        p.maquina = maqId;
        const foundMaq = catalog.maquinas.find(m => m.id == maqId);
        p.maquinaNombre = (maqObj?.['nombre'] as string) || foundMaq?.nombre;
      }
    }

    // 2. Resolver Material / Activo
    const directMatName = (pObj['materialNombre'] || pObj['material_nombre'] || pObj['nombreMaterial'] || pObj['materialDisplayName']) as string | undefined;
    if (directMatName && directMatName !== '-' && directMatName !== 'Sin material' && directMatName !== '[object Object]') {
      p.materialDisplayName = directMatName;
    } else {
      const rawAct = p.activo ?? pObj['activo_id'] ?? pObj['activo'] ?? pObj['material_id'] ?? pObj['materialId'];
      const actObj = typeof rawAct === 'object' && rawAct !== null ? rawAct as Record<string, unknown> : undefined;
      const actId = actObj ? Number(actObj['id']) : (Number(rawAct) || undefined);
      if (actId) {
        p.activo = actId;
        const foundMat = catalog.materiales.find(a => a.id == actId)
          || catalog.circulantes.find(a => a.id == actId)
          || catalog.mobiliario.find(a => a.id == actId);
        if (foundMat || actObj?.['nombre']) {
          p.materialDisplayName = (actObj?.['nombre'] as string) || foundMat?.nombre;
        }
      }
    }

    if (!p.materialDisplayName || p.materialDisplayName === 'Sin material') {
      if (p.materialTipo && p.materialTipo !== 'Sin material') {
        p.materialDisplayName = p.materialTipo;
      } else if (p.tipo === 'Del Inventario') {
        p.materialDisplayName = p.nombre;
      }
    }

    return { ...p, fromDb: true };
  });
}

/**
 * Obtiene el nombre legible de la máquina de una pieza para renderizado en tabla.
 */
export function getNombreMaquina(row: Parts | Record<string, unknown> | unknown, maquinasList: Asset[] = []): string {
  if (!row) return '-';
  const r = row as Record<string, unknown>;
  const directName = r['maquinaNombre'] || r['maquina_nombre'] || r['nombreMaquina'];
  if (typeof directName === 'string' && directName && directName !== '-' && directName !== '[object Object]') {
    return directName;
  }
  const rawMaq = r['maquina'] ?? r['maquinaId'] ?? r['maquina_id'];
  if (typeof rawMaq === 'object' && rawMaq !== null) {
    const nom = (rawMaq as Record<string, unknown>)['nombre'];
    if (nom) return String(nom);
  }
  const maqId = typeof rawMaq === 'object' && rawMaq !== null ? Number((rawMaq as Record<string, unknown>)['id']) : Number(rawMaq);
  if (maqId && !isNaN(maqId)) {
    const found = maquinasList.find(m => m.id == maqId);
    if (found?.nombre) return found.nombre;
  }
  return '-';
}

/**
 * Obtiene el nombre legible del material de una pieza para renderizado en tabla.
 */
export function getNombreMaterial(row: Parts | Record<string, unknown> | unknown, catalog: AssetCatalog): string {
  if (!row) return '-';
  const r = row as Record<string, unknown>;
  const directName = r['materialNombre'] || r['material_nombre'] || r['nombreMaterial'] || r['materialDisplayName'];
  if (typeof directName === 'string' && directName && directName !== '-' && directName !== 'Sin material' && directName !== '[object Object]') {
    return directName;
  }
  const rawAct = r['activo'] ?? r['assetId'] ?? r['activo_id'] ?? r['materialId'];
  if (typeof rawAct === 'object' && rawAct !== null) {
    const nom = (rawAct as Record<string, unknown>)['nombre'];
    if (nom) return String(nom);
  }
  const matTipo = r['materialTipo'];
  if (typeof matTipo === 'string' && matTipo && matTipo !== 'Sin material' && matTipo !== '-' && matTipo !== '[object Object]') {
    return matTipo;
  }
  const actId = typeof rawAct === 'object' && rawAct !== null ? Number((rawAct as Record<string, unknown>)['id']) : Number(rawAct);
  if (actId && !isNaN(actId)) {
    const found = catalog.materiales.find(a => a.id == actId)
      || catalog.circulantes.find(a => a.id == actId)
      || catalog.mobiliario.find(a => a.id == actId);
    if (found?.nombre) return found.nombre;
  }
  return r['tipo'] === 'Del Inventario' ? String(r['nombre'] || 'Activo Inventario') : '-';
}

/**
 * Mapea las piezas de un producto del catálogo para inicializar las piezas del presupuesto.
 */
export function mapProductToPieces(product: Product, catalog: AssetCatalog): Parts[] {
  const pRec = product as unknown as Record<string, unknown>;
  const rawPiezas = pRec['piezasProducto'] ?? pRec['piezas_producto'] ?? pRec['piezas'] ?? product.piezasProducto ?? [];
  const piezasList = Array.isArray(rawPiezas) ? rawPiezas : [];

  return piezasList.map((pb: Record<string, unknown>, index: number) => {
    const rawAct = pb['activo'] ?? pb['activo_id'] ?? pb['assetId'] ?? pb['materialId'];
    const actObj = typeof rawAct === 'object' && rawAct !== null ? rawAct as Record<string, unknown> : undefined;
    const actId = actObj ? Number(actObj['id']) : (Number(rawAct) || undefined);

    const foundAsset = actId
      ? (catalog.materiales.find(a => a.id == actId) || catalog.circulantes.find(a => a.id == actId) || catalog.mobiliario.find(a => a.id == actId))
      : undefined;

    const rawMaq = pb['maquina'] ?? pb['maquinaId'] ?? pb['maquina_id'];
    const maqObj = typeof rawMaq === 'object' && rawMaq !== null ? rawMaq as Record<string, unknown> : undefined;
    const maqId = maqObj ? Number(maqObj['id']) : (Number(rawMaq) || undefined);
    const foundMaq = maqId ? catalog.maquinas.find(m => m.id == maqId) : undefined;

    const maqName = (pb['maquinaNombre'] as string)
      || (maqObj?.['nombre'] as string)
      || (foundMaq?.nombre);

    let tipo = (pb['tipo'] as string) || '';
    if (!tipo) {
      tipo = (foundAsset && !maqId) ? 'Del Inventario' : 'Fabricada';
    }

    const matName = (pb['materialNombre'] as string)
      || (pb['materialDisplayName'] as string)
      || (actObj?.['nombre'] as string)
      || (foundAsset ? foundAsset.nombre : undefined)
      || (typeof pb['materialTipo'] === 'string' && pb['materialTipo'] !== 'Sin material' ? pb['materialTipo'] as string : undefined);

    const rawPrecio = Number(pb['precioMaterial'] ?? pb['precio_material']);
    const precioMaterial = (!isNaN(rawPrecio) && rawPrecio > 0)
      ? rawPrecio
      : (Number(foundAsset?.costoInicial || foundAsset?.valorUnitario) || 0);

    return {
      id: index + 1,
      tipo: tipo,
      nombre: (pb['nombre'] as string) || foundAsset?.nombre || `PIEZA ${index + 1}`,
      cantidad: Number(pb['cantidad']) || 1,
      activo: actId,
      assetId: actId,
      materialTipo: matName || 'Sin material',
      materialDisplayName: matName || '',
      precioMaterial: precioMaterial,
      gramos: Number(pb['gramos']) || 0,
      horas: Number(pb['horas']) || 0,
      minutos: Number(pb['minutos']) || 0,
      maquinaId: maqId,
      maquina: maqId,
      maquinaNombre: maqName
    };
  });
}

export interface BudgetPayloadParams {
  id: number;
  formValue: Record<string, unknown>;
  piezas: Parts[];
  totalCostoFinal: number;
  isCreandoClienteNuevo: boolean;
  tempClienteData: QuickClientData;
  parsedCliId?: number;
  parsedProdId?: number;
  clienteTexto: string;
}

/**
 * Construye el payload completo para enviar a la API al crear o actualizar un presupuesto.
 */
export function buildBudgetPayload(params: BudgetPayloadParams): Record<string, unknown> {
  const {
    id,
    formValue,
    piezas,
    totalCostoFinal,
    isCreandoClienteNuevo,
    tempClienteData,
    parsedCliId,
    parsedProdId,
    clienteTexto
  } = params;

  const mappedPiezas = piezas.map((p, idx) => {
    const pObj = p as unknown as Record<string, unknown>;
    const actId = p.activo ?? pObj['activo_id'] ?? pObj['assetId'] ?? pObj['materialId'];
    const maqId = p.maquina ?? pObj['maquina_id'] ?? pObj['maquinaId'];
    const prodId = p.producto ?? pObj['producto_id'] ?? pObj['productoId'] ?? parsedProdId;

    const pieceObj: Record<string, unknown> = {
      nombre: String(p.nombre || `PIEZA ${idx + 1}`).trim(),
      gramos: Number(p.gramos) || 0,
      metros: Number(p.metros) || 0,
      horas: Number(p.horas) || 0,
      minutos: Number(p.minutos) || 0,
      precioMaterial: Number(p.precioMaterial ?? pObj['precio_material']) || 0,
      tipo: String(p.tipo || 'Producción').trim(),
      cantidad: Number(p.cantidad) || 1,
      producto: prodId ? Number(prodId) : null,
      activo: actId ? Number(actId) : null,
      maquina: maqId ? Number(maqId) : null
    };

    if (p.maquinaNombre) {
      pieceObj['maquinaNombre'] = p.maquinaNombre;
    }
    if (p.materialDisplayName) {
      pieceObj['materialNombre'] = p.materialDisplayName;
    }

    if (pObj['fromDb'] && p.id && Number(p.id) > 0) {
      pieceObj['id'] = Number(p.id);
    }

    return pieceObj;
  });

  const rawNum = String(formValue['numero'] || '').trim();
  const clasifCode = String(formValue['clasificacion'] || 'GEN').substring(0, 3).toUpperCase();
  const isProducto = formValue['clasificacion'] === 'Producto';
  const finalNumero = (isProducto || !rawNum) ? 'x' : rawNum;

  return {
    id: id > 0 ? id : 0,
    sku: id > 0 ? (finalNumero || `P-${id}`) : `B-${clasifCode}-${Math.floor(Math.random() * 900) + 100}`,
    clasificacion: formValue['clasificacion'] || 'General',
    descripcion: formValue['descripcion'],
    numero: finalNumero,
    fecha: formValue['fecha'],
    costoOperador: Number(formValue['costoOperador']) || 0,
    costoMaquina: Number(formValue['costoMaquina']) || 0,
    tasaFalloGlobal: Number(formValue['tasaFalloGlobal']) || 0,
    tiempoSetup: Number(formValue['tiempoSetup']) || 0,
    margenGanancia: Number(formValue['margenGanancia']) || 0,
    tiempoPostProcesado: Number(formValue['tiempoPostProcesado']) || 0,
    cantidadGlobal: Number(formValue['cantidadGlobal']) || 1,
    delivery: Number(formValue['delivery']) || 0,
    cliente: parsedCliId,
    clienteNombre: clienteTexto || undefined,
    nombreCliente: clienteTexto || undefined,
    cliente_nombre: clienteTexto || undefined,
    clienteDetalle: isCreandoClienteNuevo ? { ...tempClienteData } : undefined,
    cliente_detalle: isCreandoClienteNuevo ? { ...tempClienteData } : undefined,
    cedula: isCreandoClienteNuevo ? tempClienteData.rifCedula : undefined,
    rifCedula: isCreandoClienteNuevo ? tempClienteData.rifCedula : undefined,
    telefono: isCreandoClienteNuevo ? tempClienteData.telefono : undefined,
    email: isCreandoClienteNuevo ? tempClienteData.email : undefined,
    direccion: isCreandoClienteNuevo ? tempClienteData.direccion : undefined,
    clienteCategoria: isCreandoClienteNuevo ? tempClienteData.categoria : undefined,
    producto: parsedProdId,
    piezas: mappedPiezas,
    total: totalCostoFinal
  };
}
