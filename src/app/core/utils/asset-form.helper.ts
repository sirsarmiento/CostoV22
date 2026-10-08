import { Asset } from '../models/Cost/asset';
import { CATALOGO_MATERIALES } from '../constants/material-catalog';
import { CATEGORIAS_ACTIVO_FIJO, mapearCategoriaFijo, esEquiposFabricacion } from '../constants/asset-categories';

/* Formatea un texto a formato Título (Title Case). */
export function formatTitleCase(text: string): string {
  if (!text) return '';
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/* Determina si una unidad de medida representa una fracción submúltiplo (Gramos) respecto a la unidad base de costo (Kilo). */
export function esUnidadFraccionaria(unidadMedida?: string | null): boolean {
  if (!unidadMedida) return false;
  const u = unidadMedida.toLowerCase().trim();
  return u === 'gramos';
}

/* Calcula el valor monetario total de un activo según su tipo, cantidad y unidad de medida. */
export function calcularValorTotalActivo(asset?: Asset | null): number {
  if (!asset) return 0;
  const cantidad = Number(asset.cantidad) || 0;
  const valorUnitario = Number(asset.costoInicial) || Number(asset.valorUnitario) || 0;
  if (cantidad <= 0 || valorUnitario <= 0) return 0;

  const tipo = (asset.tipo || '').toLowerCase().trim();
  const cat = (asset.categoria || '').toLowerCase().trim();
  const esMaterial = tipo === 'material' || cat.includes('filam') || cat.includes('resin');

  if (esMaterial && esUnidadFraccionaria(asset.unidadMedida)) {
    return Math.round((cantidad / 1000) * valorUnitario * 100) / 100;
  }

  return Math.round(cantidad * valorUnitario * 100) / 100;
}

/* Extrae las sugerencias de categorías y subcategorías a partir de la lista global de activos. */
export function extractAssetSuggestions(assets: Asset[]): {
  categoriasFijo: string[];
  categoriasCirculante: string[];
  subcategoriasMap: Map<string, Set<string>>;
} {
  const catFijoMap = new Map<string, string>();
  const catCircMap = new Map<string, string>();
  const subcategoriasMap = new Map<string, Set<string>>();

  assets.forEach(a => {
    const rawRec = a as unknown as Record<string, unknown>;
    const tipo = String(a.tipo || rawRec['tipo'] || '').toLowerCase().trim();
    const cat = formatTitleCase(String(a.categoria || rawRec['Categoria'] || '').trim());
    const sub = formatTitleCase(String(a.subCategoria || '').trim());

    if (tipo === 'fijo' || (!tipo && a.vidaUtil && a.vidaUtil > 0)) {
      if (cat) {
        catFijoMap.set(cat.toLowerCase(), cat);
      }
    } else if (tipo === 'circulante' || (!tipo && (!a.vidaUtil || a.vidaUtil === 0))) {
      if (cat) {
        catCircMap.set(cat.toLowerCase(), cat);
        if (!subcategoriasMap.has(cat.toLowerCase())) {
          subcategoriasMap.set(cat.toLowerCase(), new Set<string>());
        }
        if (sub) {
          subcategoriasMap.get(cat.toLowerCase())!.add(sub);
        }
      }
    }
  });

  const categoriasFijo = Array.from(new Set([
    ...CATEGORIAS_ACTIVO_FIJO,
    ...Array.from(catFijoMap.values()).map(c => mapearCategoriaFijo(c))
  ].filter(Boolean)));

  const categoriasCirculante = Array.from(catCircMap.values()).sort();

  return {
    categoriasFijo,
    categoriasCirculante,
    subcategoriasMap
  };
}

/* Obtiene las subcategorías de un material según el catálogo. */
export function getSubcategoriasMaterial(categoria: string): string[] {
  if (!categoria) return [];
  const raw = categoria.toLowerCase().trim();
  const mapped = raw === 'fdm' || raw.includes('filam')
    ? 'Filamento'
    : (raw === 'sla' || raw.includes('resin') ? 'Resina' : categoria);
  const catKey = Object.keys(CATALOGO_MATERIALES).find(k => k.toLowerCase() === mapped.toLowerCase().trim());
  return catKey ? CATALOGO_MATERIALES[catKey] : [];
}

/* Construye el payload del activo para creación o actualización. */
export function buildAssetPayload(formValues: Record<string, unknown>, id: number): Asset {
  const tipo = String(formValues['tipo'] || 'Fijo');
  const rawCat = String(formValues['categoria'] || '');
  const esMaterial = tipo === 'Material';

  let cleanCat: string;
  let tecnologia = '';

  if (tipo === 'Fijo') {
    cleanCat = mapearCategoriaFijo(rawCat);
    tecnologia = esEquiposFabricacion(cleanCat) ? String(formValues['tecnologia'] || '') : '';
  } else if (esMaterial) {
    const rawUpper = String(rawCat).toUpperCase().trim();
    if (rawUpper === 'FDM' || rawUpper.includes('FILAM')) {
      cleanCat = 'Filamento';
      tecnologia = 'FDM';
    } else if (rawUpper === 'SLA' || rawUpper.includes('RESIN')) {
      cleanCat = 'Resina';
      tecnologia = 'SLA';
    } else {
      cleanCat = formatTitleCase(rawCat);
      tecnologia = rawUpper;
    }
  } else {
    cleanCat = formatTitleCase(rawCat);
  }

  const esFabricacion = tipo === 'Fijo' && esEquiposFabricacion(cleanCat);
  const cleanSub = tipo === 'Fijo' ? '' : (esMaterial
    ? String(formValues['subcategoria'] || '').trim()
    : formatTitleCase(String(formValues['subcategoria'] || '')));

  return {
    id: id > 0 ? id : 0,
    nombre: String(formValues['nombre'] || ''),
    tipo: tipo,
    costoInicial: Number(formValues['costoInicial']) || 0,
    categoria: cleanCat,
    subCategoria: cleanSub,
    tecnologia: tecnologia,
    marca: esMaterial ? String(formValues['marca'] || '').trim() : '',
    color: esMaterial ? String(formValues['color'] || '').trim() : '',
    
    valorResidual: tipo === 'Fijo' ? (Number(formValues['valorResidual']) || 0) : 0,
    vidaUtil: tipo === 'Fijo' ? (Number(formValues['vidaUtil']) || 0) : 0,
    fechaCompra: tipo === 'Fijo' && formValues['fechaCompra'] ? new Date(String(formValues['fechaCompra'])) : new Date(),

    consumoMaquina: esFabricacion ? (Number(formValues['consumoMaquina']) || 0) : 0,
    tarifa: esFabricacion ? (Number(formValues['tarifa']) || 0) : 0,
    costoMantenimiento: esFabricacion ? (Number(formValues['costoMantenimiento']) || 0) : 0,

    cantidad: Number(formValues['cantidad']) || 1,
    valorUnitario: (tipo === 'Circulante' || tipo === 'Material') ? (Number(formValues['costoInicial']) || Number(formValues['valorUnitario']) || 0) : 0,
    unidadMedida: (tipo === 'Circulante' || tipo === 'Material') ? String(formValues['unidadMedida'] || '') : '',
    presentacion: (tipo === 'Circulante' || tipo === 'Material') ? String(formValues['presentacion'] || '') : '',
    descripcion: (tipo === 'Circulante' || tipo === 'Material') ? String(formValues['descripcion'] || '') : '',
    ubicacion: (tipo === 'Circulante' || tipo === 'Material') ? String(formValues['ubicacion'] || '') : ''
  };
}
