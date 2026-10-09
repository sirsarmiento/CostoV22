import { Asset } from '../models/Cost/asset';
import { MaterialCatalogo } from '../models/Cost/catalog-config';
import { materialCompatibleConTecnologia, tecnologiaDeActivo } from '../constants/asset-categories';

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
  if (a.marca) {
    detalles.push(a.marca);
  }
  if (a.color) {
    detalles.push(a.color);
  }
  if (a.subCategoria) {
    detalles.push(a.subCategoria);
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
    const tec = tecnologiaDeActivo(a).toLowerCase();
    return c === catLower
      || tec === catLower
      || (catLower === 'filamento' && (c.includes('filam') || c === 'material' || tec === 'fdm'))
      || (catLower === 'resina' && (c.includes('resin') || tec === 'sla'))
      || (catLower === 'fdm' && (tec === 'fdm' || c.includes('filam')))
      || (catLower === 'sla' && (tec === 'sla' || c.includes('resin')));
  });
}

export function coincidenciaTexto(valor: string | undefined, esperado: string): boolean {
  const a = (valor || '').toLowerCase().trim();
  const b = (esperado || '').toLowerCase().trim();
  if (!b) return true;
  return a === b;
}

export function filtrarMaterialesImpresion(
  activosMateriales: Asset[],
  filtros: { tecnologia?: string; polimero?: string; marca?: string; color?: string }
): Asset[] {
  return activosMateriales.filter(a => {
    if (filtros.tecnologia && !materialCompatibleConTecnologia(a, filtros.tecnologia)) {
      return false;
    }
    if (filtros.polimero && !coincidenciaTexto(a.subCategoria, filtros.polimero)) {
      return false;
    }
    if (filtros.marca && !coincidenciaTexto(a.marca, filtros.marca)) {
      return false;
    }
    if (filtros.color && !coincidenciaTexto(a.color, filtros.color)) {
      return false;
    }
    return true;
  });
}

export function listarUnicosNormalizados(valores: (string | undefined | null)[]): string[] {
  const vistos = new Map<string, string>();
  for (const valor of valores) {
    const limpio = String(valor || '').trim();
    if (!limpio) {
      continue;
    }
    const clave = limpio.toLowerCase();
    if (!vistos.has(clave)) {
      vistos.set(clave, limpio);
    }
  }
  return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

export function estaEnLista(lista: string[], valor: string | undefined | null): boolean {
  const buscado = String(valor || '').trim().toLowerCase();
  if (!buscado) {
    return false;
  }
  return lista.some(item => item.toLowerCase() === buscado);
}

export function listarPolimeros(
  materialesCatalogo: MaterialCatalogo[],
  activosMateriales: Asset[],
  tecnologia: string
): string[] {
  const tec = (tecnologia || '').toUpperCase().trim();
  const deActivos = listarUnicosNormalizados(
    filtrarMaterialesImpresion(activosMateriales, { tecnologia: tec }).map(a => a.subCategoria)
  );
  if (deActivos.length > 0) {
    return deActivos;
  }
  return listarUnicosNormalizados(
    (materialesCatalogo || [])
      .filter(m => !tec || (m.tecnologias || []).some(t => (t.codigo || '').toUpperCase() === tec))
      .map(m => m.codigo || m.nombre)
  );
}

export function listarValoresUnicos(activos: Asset[], campo: 'marca' | 'color', extra: string[] = []): string[] {
  return listarUnicosNormalizados([
    ...extra,
    ...activos.map(a => a[campo])
  ]);
}

export function armarFiltrosMaterialPieza(
  activosMateriales: Asset[],
  materialesCatalogo: MaterialCatalogo[],
  tecnologia: string,
  polimero: string,
  marca: string,
  color: string
): {
  polimeros: string[];
  marcas: string[];
  colores: string[];
  materiales: Asset[];
  polimero: string;
  marca: string;
  color: string;
} {
  const tec = (tecnologia || '').toUpperCase().trim();
  const polimeros = listarPolimeros(materialesCatalogo, activosMateriales, tec);
  const polimeroOk = estaEnLista(polimeros, polimero) ? String(polimero).trim() : '';

  if (!polimeroOk) {
    return {
      polimeros,
      marcas: [],
      colores: [],
      materiales: filtrarMaterialesImpresion(activosMateriales, { tecnologia: tec }),
      polimero: '',
      marca: '',
      color: ''
    };
  }

  const paraMarcas = filtrarMaterialesImpresion(activosMateriales, { tecnologia: tec, polimero: polimeroOk });
  const marcas = listarValoresUnicos(paraMarcas, 'marca');
  const marcaOk = estaEnLista(marcas, marca) ? String(marca).trim() : '';

  const paraColores = filtrarMaterialesImpresion(activosMateriales, {
    tecnologia: tec,
    polimero: polimeroOk,
    marca: marcaOk
  });
  const colores = listarValoresUnicos(paraColores, 'color');
  const colorOk = estaEnLista(colores, color) ? String(color).trim() : '';

  const materiales = filtrarMaterialesImpresion(activosMateriales, {
    tecnologia: tec,
    polimero: polimeroOk,
    marca: marcaOk,
    color: colorOk
  });

  return {
    polimeros,
    marcas,
    colores,
    materiales,
    polimero: polimeroOk,
    marca: marcaOk,
    color: colorOk
  };
}

export function sumarGramosPiezas(piezas: Array<{ gramos?: number; cantidad?: number } | Record<string, unknown>>): number {
  return piezas.reduce((suma, pieza) => {
    const fila = pieza as Record<string, unknown>;
    const cantidad = Number(fila['cantidad']) || 1;
    const gramos = Number(fila['gramos']) || 0;
    return suma + (gramos * cantidad);
  }, 0);
}

export interface StockDisponibilidad {
  disponibleGramos: number;
  requeridoGramos: number;
  faltanteGramos: number;
  estado: 'suficiente' | 'insuficiente' | 'agotado' | 'sin_seleccion';
  mensaje: string;
}

/* Obtiene el stock disponible real en gramos de un material de inventario. */
export function obtenerStockDisponibleGramos(asset?: Asset | null): number {
  if (!asset) return 0;
  const cantidad = Number(asset.cantidad) || 0;
  const reservada = Number(asset.cantidadReservada) || 0;
  const disponible = Math.max(0, cantidad - reservada);
  const u = (asset.unidadMedida || '').toLowerCase().trim();
  const esGramos = u === 'gramos' || u === 'gramo' || u === 'g' || u === 'gr';
  return esGramos ? Math.round(disponible * 100) / 100 : Math.round(disponible * 1000 * 100) / 100;
}

/* Evalúa la disponibilidad de stock en tiempo real según gramos y cantidad requerida. */
export function evaluarDisponibilidadStock(
  asset?: Asset | null,
  gramosPorPieza?: number | null,
  cantidadPiezas?: number | null
): StockDisponibilidad {
  if (!asset) {
    return {
      disponibleGramos: 0,
      requeridoGramos: 0,
      faltanteGramos: 0,
      estado: 'sin_seleccion',
      mensaje: ''
    };
  }

  const disponibleGramos = obtenerStockDisponibleGramos(asset);
  const gr = Math.max(0, Number(gramosPorPieza) || 0);
  const cant = Math.max(1, Number(cantidadPiezas) || 1);
  const requeridoGramos = Math.round(gr * cant * 100) / 100;

  if (disponibleGramos <= 0) {
    return {
      disponibleGramos: 0,
      requeridoGramos,
      faltanteGramos: requeridoGramos,
      estado: 'agotado',
      mensaje: 'Material sin stock disponible en inventario'
    };
  }

  if (requeridoGramos > disponibleGramos) {
    const faltanteGramos = Math.round((requeridoGramos - disponibleGramos) * 100) / 100;
    return {
      disponibleGramos,
      requeridoGramos,
      faltanteGramos,
      estado: 'insuficiente',
      mensaje: `Stock insuficiente: ${disponibleGramos} g disponibles (faltan ${faltanteGramos} g)`
    };
  }

  return {
    disponibleGramos,
    requeridoGramos,
    faltanteGramos: 0,
    estado: 'suficiente',
    mensaje: `Stock disponible: ${disponibleGramos} g`
  };
}
