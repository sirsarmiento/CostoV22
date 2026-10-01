import { Asset } from '../models/Cost/asset';
import { tecnologiaDeActivo } from '../constants/asset-categories';

/*Calcula el precio unitario por gramo de un material de inventario.*/
export function calcularPrecioPorGramo(asset?: Asset | null): number {
  if (!asset) return 0;
  const uMedida = (asset.unidadMedida || '').toLowerCase().trim();
  const valUnit = Number(asset.valorUnitario) || Number(asset.costoInicial) || 0;
  const precioPorGramo = (uMedida === 'gramos' || uMedida === 'gramo')
    ? valUnit
    : (valUnit > 0 ? (valUnit / 1000) : 0);
  return Math.round(precioPorGramo * 10000) / 10000;
}

/* Formatea la etiqueta de visualización de un activo en dropdowns con detalles de stock.*/
export function formatAssetOption(asset: Asset | unknown, fallbackAssets: Asset[] = []): string {
  if (!asset) return '';
  let a: Asset | undefined;
  if (typeof asset === 'object' && asset !== null) {
    a = asset as Asset;
  } else {
    const id = Number(asset);
    a = fallbackAssets.find(x => x.id === id);
  }
  if (!a) return String(asset);

  const detalles: string[] = [];
  const desc = a.descripcion?.trim();
  if (desc && !['n/a', 'null', '-', 'N/A'].includes(desc.toLowerCase())) {
    detalles.push(desc);
  }
  if (a.cantidad !== undefined && a.cantidad !== null) {
    const unidad = a.unidadMedida ? ` ${a.unidadMedida}` : '';
    detalles.push(`Cant: ${a.cantidad}${unidad}`);
  }
  return detalles.length > 0
    ? `${a.nombre} (${detalles.join(' - ')})`
    : (a.nombre || '');
}

/* Resuelve el nombre de la máquina asociada a una pieza.*/
export function resolverNombreMaquina(
  p: Record<string, unknown> | null | undefined,
  maquinasList: Asset[],
  allAssets: Asset[] = []
): string {
  if (!p) return '-';
  if (p['maquinaNombre'] && p['maquinaNombre'] !== '-') return String(p['maquinaNombre']);

  const rawMaq = p['maquina'] ?? p['maquinaId'] ?? p['maquina_id'];
  if (typeof rawMaq === 'object' && rawMaq !== null) {
    const nom = (rawMaq as Record<string, unknown>)['nombre'];
    if (nom) return String(nom);
  }
  const maqId = typeof rawMaq === 'object' && rawMaq !== null
    ? Number((rawMaq as Record<string, unknown>)['id'])
    : Number(rawMaq);

  if (maqId && !isNaN(maqId)) {
    const found = maquinasList.find(m => m.id == maqId) || allAssets.find(a => a.id == maqId);
    if (found?.nombre) return found.nombre;
  }
  return '-';
}

/* Resuelve el nombre del material asociado a una pieza.*/
export function resolverNombreMaterial(
  p: Record<string, unknown> | null | undefined,
  activosMateriales: Asset[],
  activosCirculantes: Asset[] = [],
  allAssets: Asset[] = []
): string {
  if (!p) return '-';
  if (p['materialDisplayName'] && p['materialDisplayName'] !== '-') return String(p['materialDisplayName']);
  if (p['materialTipo'] && p['materialTipo'] !== 'Sin material') return String(p['materialTipo']);

  const rawAct = p['activo'] ?? p['assetId'] ?? p['activo_id'];
  if (typeof rawAct === 'object' && rawAct !== null) {
    const nom = (rawAct as Record<string, unknown>)['nombre'];
    if (nom) return String(nom);
  }
  const actId = typeof rawAct === 'object' && rawAct !== null
    ? Number((rawAct as Record<string, unknown>)['id'])
    : Number(rawAct);

  if (actId && !isNaN(actId)) {
    const found = activosMateriales.find(a => a.id == actId)
      || activosCirculantes.find(a => a.id == actId)
      || allAssets.find(a => a.id == actId);
    if (found?.nombre) return found.nombre;
  }
  return '-';
}

/* Filtra máquinas estrictamente por tecnología de impresión seleccionada (FDM / SLA).*/
export function filtrarMaquinasPorTecnologia(maquinas: Asset[], tecnologia: string): Asset[] {
  const tec = (tecnologia || '').toUpperCase().trim();
  if (!tec) return [...maquinas];
  return maquinas.filter(m => {
    const deMaquina = tecnologiaDeActivo(m);
    return deMaquina === tec
      || (tec === 'FDM' && (deMaquina === 'FILAMENTO' || deMaquina === 'FDM'))
      || (tec === 'SLA' && (deMaquina === 'RESINA' || deMaquina === 'SLA'));
  });
}

/* Obtiene las categorías de material permitidas según la tecnología (o todas si no hay filtro).*/
export function obtenerCategoriasMaterialPorTecnologia(activosMateriales: Asset[], tecnologia: string): string[] {
  const tec = (tecnologia || '').toUpperCase().trim();
  if (tec === 'FDM') return ['Filamento'];
  if (tec === 'SLA') return ['Resina'];
  return [...new Set(
    activosMateriales.map(a => a.categoria).filter((c): c is string => !!c)
  )].sort();
}

/* Filtra activos de material por categoría, considerando variantes comunes.*/
export function filtrarMaterialesPorCategoria(activosMateriales: Asset[], categoria: string): Asset[] {
  if (!categoria) return [...activosMateriales];
  const catLower = categoria.toLowerCase().trim();
  return activosMateriales.filter(a => {
    const c = (a.categoria || '').toLowerCase().trim();
    return c === catLower
      || (catLower === 'filamento' && (c.includes('filam') || c === 'material'))
      || (catLower === 'resina' && c.includes('resin'));
  });
}
