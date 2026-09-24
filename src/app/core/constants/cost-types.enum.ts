/**
 * Constantes y Enums de Dominio para el Sistema de Costos
 * Sigue el Principio Open/Closed (OCP) para permitir extender tecnologías y clasificaciones fácilmente.
 */

export enum AssetType {
  FIJO = 'fijo',
  CIRCULANTE = 'circulante',
  MATERIAL = 'material'
}

export enum AssetCategory {
  EQUIPO = 'equipo',
  MOBILIARIO = 'mobiliario',
  PRODUCCION = 'producción',
  FILAMENTO = 'filamento',
  RESINA = 'resina'
}

export enum ManufacturingTech {
  FDM = 'FDM',
  SLA = 'SLA'
}

export enum PieceType {
  PRODUCCION = 'Producción',
  INVENTARIO = 'Del Inventario'
}

export enum CostClassification {
  DIRECTO = 'Directo',
  INDIRECTO = 'Indirecto'
}

export enum CostType {
  FIJO = 'Fijo',
  VARIABLE = 'Variable'
}

/**
 * Predicados funcionales para clasificación segura de Activos
 */
export function isMachine(type?: string | null, category?: string | null, subCategory?: string | null): boolean {
  const t = (type || '').toLowerCase().trim();
  const c = (category || '').toLowerCase().trim();
  const s = (subCategory || '').toLowerCase().trim();

  if (t === AssetType.CIRCULANTE || t === AssetType.MATERIAL) return false;
  const isFijo = t === AssetType.FIJO || t === 'maquinaria' || t === '';
  if (!isFijo) return false;

  return c === AssetCategory.EQUIPO || c.includes('máquina') || c.includes('maquina') || c.includes('impresora') || s.includes('fabricacion') || s.includes('fabricación');
}

export function isMaterial(type?: string | null, category?: string | null): boolean {
  const t = (type || '').toLowerCase().trim();
  const c = (category || '').toLowerCase().trim();

  return t === AssetType.MATERIAL || c === 'filamento' || c === 'resina' || c === 'filamentos' || c === 'resinas' || c.includes('material');
}

export function isCirculante(type?: string | null): boolean {
  const t = (type || '').toLowerCase().trim();
  return t === AssetType.CIRCULANTE;
}
