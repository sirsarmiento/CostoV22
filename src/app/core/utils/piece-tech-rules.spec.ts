import {
  CANTIDAD_MAXIMA_CNC,
  DESCARTE_RESINA_POR_DEFECTO,
  agruparPiezasPorEquipo,
  calcularAreaCm2,
  materialAprobadoParaCorte,
  mensajeValidacionPieza,
  reglasDePieza,
  textoMedidaPieza
} from './piece-tech-rules';

describe('piece-tech-rules', () => {
  it('deja filamento como está hoy', () => {
    const reglas = reglasDePieza('FDM');
    expect(reglas.mostrarGramos).toBeTrue();
    expect(reglas.mostrarDimensiones).toBeFalse();
    expect(reglas.etiquetaTipoMaterial).toBe('Tipo de polímero');
  });

  it('en resina cambia la etiqueta, autoselecciona y pide descartables', () => {
    const reglas = reglasDePieza('SLA');
    expect(reglas.etiquetaTipoMaterial).toBe('Tipo de resina');
    expect(reglas.autoseleccionarInsumo).toBeTrue();
    expect(reglas.mostrarDescartables).toBeTrue();
    expect(reglas.descartablesPorDefecto).toBe(DESCARTE_RESINA_POR_DEFECTO);
  });

  it('en control numérico limita a 5 y pide medidas de la placa', () => {
    const reglas = reglasDePieza('CNC');
    expect(reglas.cantidadMaxima).toBe(CANTIDAD_MAXIMA_CNC);
    expect(reglas.mostrarTipoMaterial).toBeFalse();
    expect(reglas.mostrarMarca).toBeFalse();
    expect(reglas.mostrarGramos).toBeFalse();
    expect(reglas.mostrarDimensiones).toBeTrue();
    expect(reglas.mostrarCarasPcb).toBeTrue();
    expect(calcularAreaCm2(10, 5)).toBe(50);
    expect(mensajeValidacionPieza('CNC', { cantidad: 6, anchoCm: 10, largoCm: 5, carasPcb: 1 }))
      .toContain('1 a 5');
  });

  it('en corte láser solo deja los materiales aprobados', () => {
    const reglas = reglasDePieza('LSR');
    expect(reglas.mostrarMarca).toBeFalse();
    expect(reglas.usaSuperficie).toBeTrue();
    expect(materialAprobadoParaCorte('Acrílico negro')).toBeTrue();
    expect(materialAprobadoParaCorte('Acrílico transparente')).toBeFalse();
    expect(materialAprobadoParaCorte('Vinilo')).toBeTrue();
  });

  it('en chocolate oculta color y separa limpieza y empaque', () => {
    const reglas = reglasDePieza('CHO');
    expect(reglas.mostrarColor).toBeFalse();
    expect(reglas.mostrarLimpieza).toBeTrue();
    expect(reglas.mostrarEmpaque).toBeTrue();
    expect(reglas.autoseleccionarInsumo).toBeTrue();
  });

  it('en alimentos no descuenta inventario y pide texto y costo', () => {
    const reglas = reglasDePieza('ALM');
    expect(reglas.mostrarMaterialInsumo).toBeFalse();
    expect(reglas.descuentaInventario).toBeFalse();
    expect(mensajeValidacionPieza('ALM', { cantidad: 1, materialLibre: '', costoEstimado: 2 }))
      .toContain('material');
  });

  it('agrupa piezas por tecnología y equipo y suma las horas al final', () => {
    const bloques = agruparPiezasPorEquipo([
      { tipo: 'Fabricada', tecnologia: 'FDM', maquinaNombre: 'Prusa', horas: 1, minutos: 0, cantidad: 2 },
      { tipo: 'Fabricada', tecnologia: 'FDM', maquinaNombre: 'Prusa', horas: 0, minutos: 30, cantidad: 1 },
      { tipo: 'Fabricada', tecnologia: 'SLA', maquinaNombre: 'Form', horas: 1, minutos: 0, cantidad: 1 }
    ]);
    expect(bloques.length).toBe(2);
    const filamento = bloques.find(b => b.tecnologia === 'FDM');
    expect(filamento?.totalMinutos).toBe(150);
    expect(filamento?.horas).toBe(2);
    expect(filamento?.minutos).toBe(30);
  });

  it('muestra área en control numérico y gramos en filamento', () => {
    expect(textoMedidaPieza({ tecnologia: 'CNC', anchoCm: 10, largoCm: 2, cantidad: 2 })).toBe('40 cm²');
    expect(textoMedidaPieza({ tecnologia: 'FDM', gramos: 10, cantidad: 2 })).toBe('20 g');
  });
});
