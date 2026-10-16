import {
  armarSegmentosTecMat,
  categoriaDesdeClasificacion,
  previsualizarCodigo,
  tecnologiasDesdePiezas
} from './catalog-sku';

describe('catalog-sku', () => {
  it('marca producto, servicio y proyecto con la letra correcta', () => {
    expect(categoriaDesdeClasificacion('Productos')).toBe('PF');
    expect(categoriaDesdeClasificacion('Servicio')).toBe('SR');
    expect(categoriaDesdeClasificacion('Proyecto')).toBe('P');
  });

  it('arma una sola tecnología sin la letra M', () => {
    const segs = armarSegmentosTecMat(['FDM'], ['PLA']);
    expect(segs.tecnologia).toBe('FDM');
    expect(segs.material).toBe('PLA');
  });

  it('arma varias tecnologías con M y barras', () => {
    const segs = armarSegmentosTecMat(['FDM', 'SLA'], ['PLA', 'RES']);
    expect(segs.tecnologia).toBe('M-FDM/SLA');
    expect(segs.material).toBe('PLA/RES');
  });

  it('saca las tecnologías solo de las piezas fabricadas', () => {
    const tecs = tecnologiasDesdePiezas([
      { tipo: 'Fabricada', tecnologia: 'FDM' },
      { tipo: 'Del Inventario', tecnologia: 'SLA' },
      { tipo: 'Fabricada', tecnologia: 'SLA' }
    ]);
    expect(tecs).toEqual(['FDM', 'SLA']);
  });

  it('arma el código de un producto de una tecnología', () => {
    const preview = previsualizarCodigo({
      clasificacion: 'Productos',
      tecnologia: 'FDM',
      material: 'PLA',
      familiaCodigo: 'LUD',
      correlativosUsados: []
    });
    expect(preview.sku).toBe('PF-FDM-PLA-LUD-001');
    expect(preview.codigoCatalogo).toBe('LUD-001');
  });

  it('arma el código multitecnología con M y barras', () => {
    const preview = previsualizarCodigo({
      clasificacion: 'Productos',
      tecnologias: ['FDM', 'SLA'],
      materiales: ['PLA', 'RES'],
      familiaCodigo: 'POP',
      correlativosUsados: []
    });
    expect(preview.sku).toBe('PF-M-FDM/SLA-PLA/RES-POP-001');
    expect(preview.codigoCatalogo).toBe('POP-001');
  });

  it('arma el código de proyecto con orden Categoria-Tecnologia-Material-Familia-Correlativo', () => {
    const preview = previsualizarCodigo({
      clasificacion: 'Proyecto',
      tecnologia: 'FDM',
      material: 'ABS',
      correlativosUsados: []
    });
    expect(preview.sku).toBe('P-FDM-ABS-SF-01');
    expect(preview.codigoCatalogo).toBe('SF-01');
    expect(preview.correlativo).toBe('01');
  });

  it('arma el código de proyecto multitecnología y con correlativo incremental', () => {
    const preview = previsualizarCodigo({
      clasificacion: 'Proyecto',
      tecnologias: ['FDM', 'SLA'],
      materiales: ['ABS', 'RES'],
      correlativosUsados: ['01']
    });
    expect(preview.sku).toBe('P-M-FDM/SLA-ABS/RES-SF-02');
    expect(preview.codigoCatalogo).toBe('SF-02');
    expect(preview.correlativo).toBe('02');
  });
});
