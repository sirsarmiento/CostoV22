export const CATEGORIA_FABRICACION = 'Equipos de fabricación';
export const CATEGORIA_POSTPROCESO = 'Equipos de postproceso';
export const CATEGORIA_COMPUTO = 'Equipos de cómputo';

export const CATEGORIAS_ACTIVO_FIJO: string[] = [
  CATEGORIA_FABRICACION,
  CATEGORIA_POSTPROCESO,
  CATEGORIA_COMPUTO,
  'Equipos de medición',
  'Herramientas',
  'Mobiliario',
  'Instalaciones de planta',
  'Equipos de seguridad'
];

export function esEquiposFabricacion(categoria?: string, subCategoria?: string): boolean {
  const c = (categoria || '').toLowerCase().trim();
  const s = (subCategoria || '').toLowerCase().trim();

  if (c === 'equipos de fabricación' || c === 'equipos de fabricacion') {
    return true;
  }
  if (c === 'equipo' || c === 'equipos') {
    return s.includes('fabricac') || s.includes('impresora') || s.includes('3d') || !s;
  }
  return c.includes('impresora') || c.includes('máquina') || c.includes('maquina');
}

export function esEquiposComputo(categoria?: string, subCategoria?: string): boolean {
  const c = (categoria || '').toLowerCase().trim();
  const s = (subCategoria || '').toLowerCase().trim();
  if (c.includes('cómputo') || c.includes('computo')) {
    return true;
  }
  return (c === 'equipo' || c === 'equipos') && (s.includes('comput') || s.includes('laptop') || s.includes('oficina'));
}

export function mapearCategoriaFijo(categoria?: string, subCategoria?: string): string {
  if (esEquiposComputo(categoria, subCategoria)) {
    return CATEGORIA_COMPUTO;
  }
  if (esEquiposFabricacion(categoria, subCategoria)) {
    return CATEGORIA_FABRICACION;
  }
  const actual = (categoria || '').trim();
  const oficial = CATEGORIAS_ACTIVO_FIJO.find(x => x.toLowerCase() === actual.toLowerCase());
  return oficial || actual;
}

export function tecnologiaDeActivo(asset: {
  nombre?: string;
  categoria?: string;
  subCategoria?: string;
  tecnologia?: string;
}): string {
  const directa = (asset.tecnologia || '').toUpperCase().trim();
  if (!directa) {
    return '';
  }
  if (directa === 'FILAMENTO' || directa.includes('FDM') || directa.includes('FILAM')) return 'FDM';
  if (directa === 'RESINA' || directa.includes('SLA') || directa.includes('RESIN')) return 'SLA';
  return directa;
}

export function materialCompatibleConTecnologia(
  asset: { nombre?: string; categoria?: string; subCategoria?: string; tecnologia?: string },
  tecnologia: string
): boolean {
  const t = (tecnologia || '').toUpperCase().trim();
  if (!t) {
    return true;
  }
  const propia = tecnologiaDeActivo(asset);
  if (propia) {
    return propia === t;
  }
  const c = (asset.categoria || '').toLowerCase().trim();
  if (t === 'FDM') {
    return c === 'fdm' || c === 'filamento' || c === 'filamentos' || c.includes('filam');
  }
  if (t === 'SLA') {
    return c === 'sla' || c === 'resina' || c === 'resinas' || c.includes('resin');
  }
  return true;
}
