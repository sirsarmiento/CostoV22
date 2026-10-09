import { Asset } from '../models/Cost/asset';
import { Product, PiezaProducto } from '../models/Cost/product';
import { resolverNombreMaquina, resolverNombreMaterial } from './piece-builder.helper';

/* Extrae los correlativos ya usados para productos de la misma familia.*/
export function extractCorrelativosUsadosDeFamilia(
  productosExistentes: Product[],
  famId: number | null | undefined,
  famCod: string,
  currentProductId: number = 0
): string[] {
  const normFamCod = (famCod || '').toUpperCase().trim();

  const productosDeMismaFamilia = productosExistentes.filter(p => {
    if (currentProductId && p.id === currentProductId) return false;
    const pFamId = p.familiaId || (typeof p.familia === 'object' ? p.familia?.id : null);
    const pFamCod = (typeof p.familia === 'object' ? p.familia?.codigo : (typeof p.familia === 'string' ? p.familia : '')) || '';

    if (famId && pFamId && Number(pFamId) === famId) return true;
    if (normFamCod && pFamCod && pFamCod.toUpperCase() === normFamCod) return true;
    if (normFamCod && p.codigoCatalogo && p.codigoCatalogo.toUpperCase().startsWith(`${normFamCod}-`)) return true;
    if (normFamCod && p.sku && p.sku.toUpperCase().includes(`-${normFamCod}-`)) return true;
    return false;
  });

  return productosDeMismaFamilia.flatMap(p => {
    const list: string[] = [];
    if (p.correlativo) list.push(p.correlativo.toUpperCase());
    if (p.serie && p.correlativo) list.push(`${p.serie}${p.correlativo}`.toUpperCase());
    if (p.codigoCatalogo) {
      const parts = p.codigoCatalogo.split('-');
      if (parts.length > 1) list.push(parts[1].toUpperCase());
    }
    if (p.sku) {
      const parts = p.sku.split('-');
      if (parts.length > 0) list.push(parts[parts.length - 1].toUpperCase());
    }
    return list;
  }).filter(Boolean);
}

/* Transforma las piezas de la BD/API al modelo con nombres resueltos para la vista.*/
export function mapDbPiezasToView(
  rawPiezas: unknown[],
  maquinasList: Asset[],
  activosMateriales: Asset[],
  activosCirculantes: Asset[],
  allAssets: Asset[] = []
): PiezaProducto[] {
  const piezasArray = Array.isArray(rawPiezas) ? rawPiezas : [];
  return piezasArray.map(p => {
    const pRecord = p as Record<string, unknown>;
    const rawMaq = pRecord['maquina'] ?? pRecord['maquinaId'] ?? pRecord['maquina_id'];
    const maqId = (rawMaq !== null && rawMaq !== undefined && rawMaq !== '') ? Number(rawMaq) : undefined;
    const maqName = resolverNombreMaquina(pRecord, maquinasList, allAssets);

    const rawAct = pRecord['activo'] ?? pRecord['assetId'] ?? pRecord['activo_id'];
    const actId = (rawAct !== null && rawAct !== undefined && rawAct !== '') ? Number(rawAct) : undefined;
    const matName = resolverNombreMaterial(pRecord, activosMateriales, activosCirculantes, allAssets);

    return {
      ...(p as PiezaProducto),
      fromDb: true,
      maquina: maqId,
      maquinaNombre: maqName !== '-' ? maqName : (pRecord['maquinaNombre'] as string | undefined),
      activo: actId,
      activoNombre: matName !== '-' ? matName : (pRecord['activoNombre'] as string | undefined)
    };
  });
}

/* Mapea las piezas pendientes al formato de payload para la API.*/
export function mapPiezasToPayload(
  piezasPendientes: PiezaProducto[],
  assetsMobiliario: Asset[],
  activosCirculantes: Asset[]
): Record<string, unknown>[] {
  return piezasPendientes.map((p, idx) => {
    const pObj = p;
    const numAct = (pObj.activo !== null && pObj.activo !== undefined) ? Number(pObj.activo) : null;
    const numMaq = (pObj.maquina !== null && pObj.maquina !== undefined) ? Number(pObj.maquina) : null;

    let nom = String(pObj.nombre || '').trim();
    if (!nom || nom === 'null' || nom === 'undefined') {
      if (numAct) {
        const foundMob = assetsMobiliario.find(a => a.id == numAct);
        const foundCirc = activosCirculantes.find(a => a.id == numAct);
        nom = (foundMob || foundCirc)?.nombre || `PIEZA ${idx + 1}`;
      } else {
        nom = `PIEZA ${idx + 1}`;
      }
    }

    let tip = String(pObj.tipo || '').trim();
    if (!tip || tip === 'null' || tip === 'undefined') {
      tip = numAct && !numMaq ? 'Del Inventario' : 'Producción';
    }

    const gVal = Number(pObj.gramos) || 0;
    const mVal = Number(pObj.metros) || 0;
    const hVal = 0;
    const minVal = 0;
    const matPrice = Number(pObj.precioMaterial) || 0;
    const cant = Number(pObj.cantidad) || 1;

    const piece: Record<string, unknown> = {
      nombre: nom,
      gramos: gVal,
      metros: mVal,
      horas: hVal,
      minutos: minVal,
      precioMaterial: matPrice,
      precio_material: matPrice,
      tipo: tip,
      cantidad: cant,
      activo: numAct,
      activo_id: numAct,
      maquina: numMaq,
      maquina_id: numMaq
    };

    if (pObj.fromDb && pObj.id && Number(pObj.id) > 0) {
      piece['id'] = Number(pObj.id);
    }

    return piece;
  });
}
