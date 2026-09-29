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
  familiaCodigo?: string;
  serie?: string;
  correlativosUsados?: string[];
}

export function categoriaDesdeClasificacion(clasificacion?: string): string {
  const valor = (clasificacion || '').toLowerCase().trim();
  if (['producto', 'productos', 'producto final', 'producto fabricado', 'pf'].includes(valor)) {
    return 'PF';
  }
  if (['proyecto', 'proyectos', 'pr', 'py'].includes(valor)) {
    return 'PR';
  }
  return 'SR';
}

export function previsualizarCodigo(input: SkuPreviewInput): { sku: string; codigoCatalogo: string; correlativo: string } {
  const tecnologia = (input.tecnologia || '').toUpperCase().trim();
  const material = (input.material || '').toUpperCase().trim();
  const familia = (input.familiaCodigo || '').toUpperCase().trim();
  if (!tecnologia || !material || !familia) {
    return { sku: '', codigoCatalogo: '', correlativo: '' };
  }

  const categoria = categoriaDesdeClasificacion(input.clasificacion);
  const usados = (input.correlativosUsados || []).map(c => c.toUpperCase());
  const rawNombre = (input.nombre || '').toLowerCase().trim();
  const nombreLimpio = rawNombre.replace(/^(juegos?\s+(de\s+)?|el\s+|la\s+|los\s+|las\s+)/i, '').trim();
  const entryLud = CATALOGO_LUD[rawNombre] || CATALOGO_LUD[nombreLimpio];
  const isLudTaken = entryLud ? usados.some(u => u === entryLud || u.endsWith(entryLud)) : false;

  const esProyecto = ['proyecto', 'proyectos'].includes((input.clasificacion || '').toLowerCase().trim());
  const serie = (input.serie || '').toUpperCase().trim();

  let correlativo: string;

  if (esProyecto) {
    correlativo = siguientePrefijo(usados, 'P', 2);
  } else if (serie && /^[A-Z]{1,3}$/.test(serie)) {
    // Si se seleccionó una Serie/Subfamilia (ej: 'RC', 'JM', 'FG')
    if (familia === 'LUD' && entryLud && entryLud.startsWith(serie) && !isLudTaken) {
      correlativo = entryLud;
    } else {
      correlativo = siguientePrefijo(usados, serie, 2);
    }
  } else if (familia === 'LUD' && entryLud && !isLudTaken) {
    // Si no tiene serie seleccionada pero coincide con un nombre del catálogo histórico
    correlativo = entryLud;
  } else {
    correlativo = siguienteNumerico(usados);
  }

  return {
    sku: `${categoria}-${tecnologia}-${material}-${familia}-${correlativo}`,
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

function siguienteNumerico(usados: string[]): string {
  const patron = /(?:^|-)(\d{1,4})$/;
  let max = 0;
  usados.forEach(valor => {
    const match = valor.match(patron);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });
  return String(max + 1).padStart(3, '0');
}
