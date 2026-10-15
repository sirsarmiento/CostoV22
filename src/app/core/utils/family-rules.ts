import { Family } from '../models/Cost/family';

export const FAMILIAS_SERVICIO = ['MLD', 'MED', 'ODO', 'AUT', 'IND'];
export const FAMILIAS_PROYECTO = ['SF', 'MLD'];
export const FAMILIAS_PRODUCTO_EXCLUIDAS = ['MLD'];
export const TASAS_FALLO = [5, 11, 18];

export function familiasPermitidas(clasificacion: string | undefined, familias: Family[]): Family[] {
  const tipo = (clasificacion || '').toLowerCase().trim();
  const lista = familias || [];
  if (tipo.startsWith('serv')) {
    return lista.filter(f => FAMILIAS_SERVICIO.includes((f.codigo || '').toUpperCase()));
  }
  if (tipo.startsWith('proy')) {
    return lista.filter(f => FAMILIAS_PROYECTO.includes((f.codigo || '').toUpperCase()));
  }
  return lista.filter(f => !FAMILIAS_PRODUCTO_EXCLUIDAS.includes((f.codigo || '').toUpperCase()));
}

export function nombrePiezaAutomatico(indice: number): string {
  return `Pieza ${indice + 1}`;
}

export function horasPorTecnologia(
  piezas: Array<{ tipo?: string; tecnologia?: string; horas?: number; minutos?: number; cantidad?: number }>
): Array<{ tecnologia: string; horas: number; minutos: number; totalMinutos: number }> {
  const mapa = new Map<string, number>();
  (piezas || []).forEach(pieza => {
    if (String(pieza.tipo || '').toLowerCase() === 'del inventario') {
      return;
    }
    const tec = String(pieza.tecnologia || '').toUpperCase().trim();
    if (!tec) {
      return;
    }
    const cantidad = Number(pieza.cantidad) || 1;
    const minutos = ((Number(pieza.horas) || 0) * 60 + (Number(pieza.minutos) || 0)) * cantidad;
    mapa.set(tec, (mapa.get(tec) || 0) + minutos);
  });

  return [...mapa.entries()].map(([tecnologia, totalMinutos]) => ({
    tecnologia,
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60,
    totalMinutos
  }));
}

export function serializarTasasFallo(mapa: Record<string, number>): string {
  return Object.entries(mapa || {})
    .filter(([clave, valor]) => clave && Number(valor) > 0)
    .map(([clave, valor]) => `${clave.toUpperCase()}:${Number(valor)}`)
    .join(',');
}

export function parsearTasasFallo(crudo?: string | null): Record<string, number> {
  const salida: Record<string, number> = {};
  String(crudo || '').split(',').forEach(parte => {
    const [clave, valor] = parte.split(':');
    if (clave && valor) {
      salida[clave.trim().toUpperCase()] = Number(valor);
    }
  });
  return salida;
}

export function tasaFalloDePieza(
  pieza: { tasaFallo?: number; tecnologia?: string },
  tasasPorTecnologia: Record<string, number> = {},
  tasaGlobal = 0
): number {
  const directa = Number(pieza?.tasaFallo);
  if (directa > 0) {
    return directa;
  }
  const tec = String(pieza?.tecnologia || '').toUpperCase().trim();
  if (tec && Number(tasasPorTecnologia[tec]) > 0) {
    return Number(tasasPorTecnologia[tec]);
  }
  return Number(tasaGlobal) || 0;
}

export function sumarTiempoPiezas(
  piezas: Array<{ tipo?: string; horas?: number; minutos?: number; cantidad?: number }>
): { horas: number; minutos: number; totalMinutos: number } {
  const totalMinutos = (piezas || []).reduce((suma, pieza) => {
    if (String(pieza.tipo || '').toLowerCase() === 'del inventario') {
      return suma;
    }
    const cantidad = Number(pieza.cantidad) || 1;
    return suma + ((Number(pieza.horas) || 0) * 60 + (Number(pieza.minutos) || 0)) * cantidad;
  }, 0);
  return {
    horas: Math.floor(totalMinutos / 60),
    minutos: totalMinutos % 60,
    totalMinutos
  };
}
