import {
  FAMILIAS_SERVICIO,
  TASAS_FALLO,
  familiasPermitidas,
  horasPorTecnologia,
  nombrePiezaAutomatico,
  parsearTasasFallo,
  serializarTasasFallo,
  tasaFalloDePieza
} from './family-rules';
import { Family } from '../models/Cost/family';

const familias: Family[] = [
  { id: 1, codigo: 'LUD', nombre: 'Lúdico' },
  { id: 2, codigo: 'MLD', nombre: 'Molde' },
  { id: 3, codigo: 'MED', nombre: 'Médico' },
  { id: 4, codigo: 'SF', nombre: 'Sin familia' },
  { id: 5, codigo: 'POP', nombre: 'POP' }
];

describe('family-rules', () => {
  it('deja las tasas de fallo en 5, 11 y 18', () => {
    expect(TASAS_FALLO).toEqual([5, 11, 18]);
  });

  it('filtra familias de servicio, proyecto y producto', () => {
    expect(familiasPermitidas('Servicio', familias).map(f => f.codigo)).toEqual(
      familias.filter(f => FAMILIAS_SERVICIO.includes(f.codigo)).map(f => f.codigo)
    );
    expect(familiasPermitidas('Proyecto', familias).map(f => f.codigo)).toEqual(['MLD', 'SF']);
    expect(familiasPermitidas('Productos', familias).map(f => f.codigo)).toEqual(['LUD', 'MED', 'SF', 'POP']);
  });

  it('nombra las piezas en orden', () => {
    expect(nombrePiezaAutomatico(0)).toBe('Pieza 1');
    expect(nombrePiezaAutomatico(1)).toBe('Pieza 2');
  });

  it('suma las horas por tecnología', () => {
    const resumen = horasPorTecnologia([
      { tipo: 'Fabricada', tecnologia: 'FDM', horas: 1, minutos: 30, cantidad: 2 },
      { tipo: 'Fabricada', tecnologia: 'SLA', horas: 0, minutos: 20, cantidad: 1 }
    ]);
    expect(resumen.find(r => r.tecnologia === 'FDM')?.totalMinutos).toBe(180);
    expect(resumen.find(r => r.tecnologia === 'SLA')?.totalMinutos).toBe(20);
  });

  it('serializa y lee las tasas por tecnología', () => {
    const texto = serializarTasasFallo({ FDM: 5, SLA: 11 });
    expect(texto).toBe('FDM:5,SLA:11');
    expect(parsearTasasFallo(texto)).toEqual({ FDM: 5, SLA: 11 });
  });

  it('aplica la tasa de la pieza, luego la de la tecnología y al final la global', () => {
    expect(tasaFalloDePieza({ tasaFallo: 18, tecnologia: 'FDM' }, { FDM: 5 }, 11)).toBe(18);
    expect(tasaFalloDePieza({ tecnologia: 'SLA' }, { SLA: 11 }, 5)).toBe(11);
    expect(tasaFalloDePieza({ tecnologia: 'FDM' }, {}, 5)).toBe(5);
  });
});
