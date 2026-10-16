export const CATALOGO_LUD: Record<string, string> = {
  'tetris balance': 'JM01',
  'isla de pascua': 'JM02',
  'llegaron las pizzas': 'JM03',
  'torre de rocas': 'JM04',
  'rock balance': 'JM05',
  'the wall': 'JM06',
  'la cueva': 'JM07',
  'quoridor': 'JM08',
  'triggle': 'JM09',
  'juego de ajedrez minimalista': 'JM10',
  'mastermind': 'JM11',
  'conecta 4-tex': 'JM12',
  'conecta 4 tex': 'JM12',
  'zigzag': 'JM13',
  'memory color': 'JM14',
  'laberinto mini': 'JM15',
  'rompecabeza hexagonal': 'RC01',
  'rompecabeza de colores': 'RC02',
  'tetris box': 'RC03',
  'curvas locas': 'RC04',
  'botones locos': 'FG01',
  'penta spin': 'FG02',
  'heart gear': 'FG03',
  'cube gear': 'FG04',
  'sevoya flexi 1': 'FG05',
  'sevoya flexi 2': 'FG06',
  'brain flexi': 'FG07',
  'cono fidget': 'FG08',
  'tuerca infinita': 'FG09',
  'torre flexi': 'FG10'
};

export interface SkuPreviewInput {
  nombre?: string;
  clasificacion?: string;
  tecnologia?: string;
  material?: string;
  tecnologias?: string[];
  materiales?: string[];
  familiaCodigo?: string;
  serie?: string;
  correlativosUsados?: string[];
}

export function unicosMayusculas(valores?: Array<string | undefined | null>): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  (valores || []).forEach(valor => {
    const limpio = String(valor || '').toUpperCase().trim();
    if (!limpio || limpio === 'M' || vistos.has(limpio)) {
      return;
    }
    vistos.add(limpio);
    salida.push(limpio);
  });
  return salida;
}

export function tecnologiasDesdePiezas(
  piezas: Array<{ tipo?: string; tecnologia?: string }>
): string[] {
  return unicosMayusculas(
    (piezas || [])
      .filter(pieza => String(pieza.tipo || '').toLowerCase() !== 'del inventario')
      .map(pieza => pieza.tecnologia)
  );
}

export function materialesDesdePiezas(
  piezas: Array<{ tipo?: string; material?: string; polimero?: string; subCategoria?: string }>
): string[] {
  return unicosMayusculas(
    (piezas || [])
      .filter(pieza => String(pieza.tipo || '').toLowerCase() !== 'del inventario')
      .map(pieza => pieza.material || pieza.polimero || pieza.subCategoria || '')
  );
}

export function armarSegmentosTecMat(
  tecnologias: string[],
  materiales: string[]
): { tecnologia: string; material: string; tecnologias: string[]; materiales: string[] } {
  const tecs = unicosMayusculas(tecnologias.flatMap(valor => String(valor || '').split(/[/,|-]/)));
  const mats = unicosMayusculas(materiales.flatMap(valor => String(valor || '').split(/[/,|-]/)));
  if (tecs.length > 1) {
    return {
      tecnologia: `M-${tecs.join('/')}`,
      material: mats.join('/') || 'NA',
      tecnologias: tecs,
      materiales: mats
    };
  }
  return {
    tecnologia: tecs[0] || '',
    material: mats[0] || '',
    tecnologias: tecs,
    materiales: mats
  };
}

export function categoriaDesdeClasificacion(clasificacion?: string): string {
  const valor = (clasificacion || '').toLowerCase().trim();
  if (['producto', 'productos', 'producto final', 'producto fabricado', 'pf'].includes(valor)) {
    return 'PF';
  }
  if (['proyecto', 'proyectos', 'pr', 'py', 'p'].includes(valor)) {
    return 'P';
  }
  return 'SR';
}

export function previsualizarCodigo(input: SkuPreviewInput): { sku: string; codigoCatalogo: string; correlativo: string } {
  const vacio = { sku: '', codigoCatalogo: '', correlativo: '' };
  const segs = armarSegmentosTecMat(
    input.tecnologias?.length ? input.tecnologias : [input.tecnologia || ''],
    input.materiales?.length ? input.materiales : [input.material || '']
  );
  const familia = (input.familiaCodigo || '').toUpperCase().trim();
  const categoria = categoriaDesdeClasificacion(input.clasificacion);
  const esProyecto = categoria === 'P';

  if (esProyecto && !segs.tecnologia) {
    return vacio;
  }
  if (!esProyecto && (!segs.tecnologia || !segs.material || !familia)) {
    return vacio;
  }

  const usados = (input.correlativosUsados || []).map(c => c.toUpperCase());
  const rawNombre = (input.nombre || '').toLowerCase().trim();
  const nombreLimpio = rawNombre.replace(/^(juegos?\s+(de\s+)?|el\s+|la\s+|los\s+|las\s+)/i, '').trim();
  const entryLud = CATALOGO_LUD[rawNombre] || CATALOGO_LUD[nombreLimpio];
  const isLudTaken = entryLud ? usados.some(u => u === entryLud || u.endsWith(entryLud)) : false;
  const serie = (input.serie || '').toUpperCase().trim();

  let correlativo: string;

  if (esProyecto) {
    const famProyecto = familia || 'SF';
    const matProyecto = segs.material || 'NA';
    correlativo = siguienteNumerico(usados, 2);
    return {
      sku: `P-${segs.tecnologia}-${matProyecto}-${famProyecto}-${correlativo}`,
      codigoCatalogo: `${famProyecto}-${correlativo}`,
      correlativo
    };
  }

  if (serie && /^[A-Z]{1,3}$/.test(serie)) {
    if (familia === 'LUD' && entryLud && entryLud.startsWith(serie) && !isLudTaken) {
      correlativo = entryLud;
    } else {
      correlativo = siguientePrefijo(usados, serie, 2);
    }
  } else if (familia === 'LUD' && entryLud && !isLudTaken) {
    correlativo = entryLud;
  } else {
    correlativo = siguienteNumerico(usados, 3);
  }

  return {
    sku: `${categoria}-${segs.tecnologia}-${segs.material}-${familia}-${correlativo}`,
    codigoCatalogo: `${familia}-${correlativo}`,
    correlativo
  };
}

function siguientePrefijo(usados: string[], prefijo: string, digitos: number): string {
  const patron = new RegExp(`(?:^|-)${prefijo}(\\d+)$`, 'i');
  let max = 0;
  usados.forEach(valor => {
    const match = valor.match(patron);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });
  return `${prefijo}${String(max + 1).padStart(digitos, '0')}`;
}

function siguienteNumerico(usados: string[], digitos: number = 3): string {
  const patron = /(?:^|-|[A-Z]+)(\d{1,4})$/i;
  let max = 0;
  usados.forEach(valor => {
    const match = String(valor || '').trim().match(patron);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });
  return String(max + 1).padStart(digitos, '0');
}
