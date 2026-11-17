export const SECTORES_COMERCIALES = [
  'Alimentos y bebidas',
  'Salud y médico',
  'Odontología',
  'Educación',
  'Automotriz',
  'Construcción',
  'Comercio al detal',
  'Publicidad y mercadeo',
  'Tecnología',
  'Manufactura',
  'Gobierno',
  'Entretenimiento',
  'Industrial',
  'Belleza y cuidado personal',
  'Logística'
];

export function normalizarSectores(crudo: unknown): string[] {
  if (Array.isArray(crudo)) {
    return crudo.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof crudo === 'string' && crudo.trim()) {
    try {
      const decodificado = JSON.parse(crudo);
      if (Array.isArray(decodificado)) {
        return normalizarSectores(decodificado);
      }
    } catch {
      return crudo.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}
