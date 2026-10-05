import { Asset } from '../models/Cost/asset';
import { CATALOGO_MATERIALES } from '../constants/material-catalog';
import { CATEGORIAS_ACTIVO_FIJO, mapearCategoriaFijo, esEquiposFabricacion } from '../constants/asset-categories';

/* Formatea un texto a formato Título (Title Case). */
export function formatTitleCase(text: string): string {
  if (!text) return '';
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
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
  const catKey = Object.keys(CATALOGO_MATERIALES).find(k => k.toLowerCase() === categoria.toLowerCase().trim());
  return catKey ? CATALOGO_MATERIALES[catKey] : [];
}

/* Construye el payload del activo para creación o actualización. */
export function buildAssetPayload(formValues: Record<string, unknown>, id: number): Asset {
  const tipo = String(formValues['tipo'] || 'Fijo');
  const rawCat = String(formValues['categoria'] || '');
  const cleanCat = tipo === 'Fijo'
    ? mapearCategoriaFijo(rawCat)
    : formatTitleCase(rawCat);
  const cleanSub = tipo === 'Fijo' ? '' : formatTitleCase(String(formValues['subcategoria'] || ''));
  const esFabricacion = tipo === 'Fijo' && esEquiposFabricacion(cleanCat);

  return {
    id: id > 0 ? id : 0,
    nombre: String(formValues['nombre'] || ''),
    tipo: tipo,
    costoInicial: Number(formValues['costoInicial']) || 0,
    categoria: cleanCat,
    subCategoria: cleanSub,
    tecnologia: esFabricacion ? String(formValues['tecnologia'] || '') : '',
    
    valorResidual: tipo === 'Fijo' ? (Number(formValues['valorResidual']) || 0) : 0,
    vidaUtil: tipo === 'Fijo' ? (Number(formValues['vidaUtil']) || 0) : 0,
    fechaCompra: tipo === 'Fijo' && formValues['fechaCompra'] ? new Date(String(formValues['fechaCompra'])) : new Date(),

    consumoMaquina: esFabricacion ? (Number(formValues['consumoMaquina']) || 0) : 0,
    tarifa: esFabricacion ? (Number(formValues['tarifa']) || 0) : 0,
    costoMantenimiento: esFabricacion ? (Number(formValues['costoMantenimiento']) || 0) : 0,

    cantidad: Number(formValues['cantidad']) || 1,
    valorUnitario: tipo === 'Circulante' ? (Number(formValues['costoInicial']) || Number(formValues['valorUnitario']) || 0) : 0,
    unidadMedida: tipo === 'Circulante' ? String(formValues['unidadMedida'] || '') : '',
    presentacion: tipo === 'Circulante' ? String(formValues['presentacion'] || '') : '',
    descripcion: tipo === 'Circulante' ? String(formValues['descripcion'] || '') : '',
    ubicacion: tipo === 'Circulante' ? String(formValues['ubicacion'] || '') : ''
  };
}
