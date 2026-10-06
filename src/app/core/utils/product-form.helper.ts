import { Asset } from '../models/Cost/asset';
import { Product } from '../models/Cost/product';
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
): Record<string, unknown>[] {
  const piezasArray = Array.isArray(rawPiezas) ? rawPiezas : [];
  return piezasArray.map(p => {
    const pObj = p as Record<string, unknown>;
    const maqId = Number(pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id']) || undefined;
    const maqName = resolverNombreMaquina(pObj, maquinasList, allAssets);

    const actId = Number(pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id']) || undefined;
    const matName = resolverNombreMaterial(pObj, activosMateriales, activosCirculantes, allAssets);

    return {
      ...pObj,
      fromDb: true,
      maquinaId: maqId,
      maquinaNombre: maqName !== '-' ? maqName : (pObj['maquinaNombre'] as string | undefined),
      assetId: actId,
      materialDisplayName: matName !== '-' ? matName : (pObj['materialDisplayName'] as string | undefined)
    };
  });
}

/* Mapea las piezas pendientes al formato de payload para la API.*/
export function mapPiezasToPayload(
  piezasPendientes: Record<string, unknown>[],
  assetsMobiliario: Asset[],
  activosCirculantes: Asset[]
): Record<string, unknown>[] {
  return piezasPendientes.map((p, idx) => {
    const pObj = p;
    const actId = pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id'];
    const maqId = pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id'];
    const numAct = (actId !== null && actId !== undefined && actId !== '') ? Number(actId) : null;
    const numMaq = (maqId !== null && maqId !== undefined && maqId !== '') ? Number(maqId) : null;

    let nom = String(pObj['nombre'] || '').trim();
    if (!nom || nom === 'null' || nom === 'undefined') {
      if (numAct) {
        const foundMob = assetsMobiliario.find(a => a.id == numAct);
        const foundCirc = activosCirculantes.find(a => a.id == numAct);
        nom = (foundMob || foundCirc)?.nombre || `PIEZA ${idx + 1}`;
      } else {
        nom = `PIEZA ${idx + 1}`;
      }
    }

    let tip = String(pObj['tipo'] || '').trim();
    if (!tip || tip === 'null' || tip === 'undefined') {
      tip = numAct && !numMaq ? 'Del Inventario' : 'Producción';
    }

    const gVal = Number(pObj['gramos']) || 0;
    const mVal = Number(pObj['metros'] ?? pObj['metro']) || 0;
    const hVal = 0;
    const minVal = 0;
    const matPrice = Number(pObj['precioMaterial'] ?? pObj['precio_material']) || 0;
    const cant = Number(pObj['cantidad']) || 1;

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

    if (pObj['fromDb'] && pObj['id'] && Number(pObj['id']) > 0) {
      piece['id'] = Number(pObj['id']);
    }

    return piece;
  });
}
