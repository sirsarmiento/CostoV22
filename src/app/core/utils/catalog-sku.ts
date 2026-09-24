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
  if (['producto', 'productos', 'producto final', 'producto fabricado'].includes(valor)) {
    return 'PF';
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
  const nombre = (input.nombre || '').toLowerCase().trim();
  let correlativo = '';

  if (familia === 'LUD' && CATALOGO_LUD[nombre] && !usados.includes(CATALOGO_LUD[nombre])) {
    correlativo = CATALOGO_LUD[nombre];
  } else {
    const esProyecto = ['proyecto', 'proyectos'].includes((input.clasificacion || '').toLowerCase().trim());
    const serie = (input.serie || '').toUpperCase().trim();
    if (esProyecto) {
      correlativo = siguientePrefijo(usados, 'P', 2);
    } else if (serie && /^[A-Z]{1,3}$/.test(serie)) {
      correlativo = siguientePrefijo(usados, serie, 2);
    } else {
      correlativo = siguienteNumerico(usados);
    }
  }

  return {
    sku: `${categoria}-${tecnologia}-${material}-${familia}-${correlativo}`,
    codigoCatalogo: `${familia}-${correlativo}`,
    correlativo
  };
}

function siguientePrefijo(usados: string[], prefijo: string, digitos: number): string {
  const patron = new RegExp(`^${prefijo}(\\d+)$`);
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
  let max = 0;
  usados.forEach(valor => {
    if (/^\d{3}$/.test(valor)) {
      max = Math.max(max, Number(valor));
    }
  });
  return String(max + 1).padStart(3, '0');
}
