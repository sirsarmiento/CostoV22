import { Budget, Parts } from '../models/Cost/budge';
import { Asset } from '../models/Cost/asset';
import { Product } from '../models/Cost/product';
import { calculateBudgetTotals, costoHoraMaquina, normalizeBudget } from './budget-calculator';
import { calculateMultiItemTotals, hidratarLineas, nombresDeLineas } from './budget-items';
import Swal from 'sweetalert2';

export interface ClientModalData {
  nombre: string;
  rifCedula: string;
  nacionalidad: string;
  nroDocumento: string;
  categoria: string;
  telefono: string;
  email: string;
  direccion: string;
}

/*Parsea un documento o cédula/RIF en nacionalidad y número.*/
export function parseCedula(rawCedula: string): { nac: string; num: string } {
  const clean = String(rawCedula || '').trim();
  if (!clean) return { nac: 'V', num: '' };
  const match = clean.match(/^([VEJGP])[-_ ]*(.*)$/i);
  if (match) {
    return { nac: match[1].toUpperCase(), num: match[2] };
  }
  return { nac: 'V', num: clean };
}

/* Obtiene la descripción o nombre del producto asociado a un presupuesto.*/
export function resolveProductDescription(row: Budget, allProducts: Product[]): string {
  const rawR = row as unknown as Record<string, unknown>;
  const varios = nombresDeLineas(rawR, allProducts);
  if (varios) return varios;
  const prodId = Number(row.producto ?? rawR['producto_id'] ?? rawR['productoId']);
  if (prodId && allProducts.length > 0) {
    const found = allProducts.find(p => p.id == prodId);
    if (found?.nombre) {
      return found.nombre;
    }
  }
  const prodObj = rawR['producto'] as Record<string, unknown> | undefined;
  if (prodObj && typeof prodObj === 'object' && prodObj['nombre']) {
    return String(prodObj['nombre']);
  }
  return row.descripcion || 'Sin descripción';
}

/*Obtiene la tasa de costo de máquina aplicable al presupuesto.*/
export function resolveRateMaquina(row: Budget, allAssets: Asset[]): number {
  const rowRec = row as unknown as Record<string, unknown>;
  const rate = Number(row.costoMaquina ?? rowRec['costo_maquina'] ?? rowRec['costoMaquinaHora'] ?? rowRec['tasaMaquina']) || 0;
  if (rate > 0) return rate;

  if (row.piezas) {
    for (const p of row.piezas) {
      const pRec = p as unknown as Record<string, unknown>;
      const maqId = p.maquina ?? pRec['maquina_id'] ?? pRec['activo_id'];
      if (maqId) {
        const maq = allAssets.find(a => a.id == maqId);
        if (maq) {
          const consumo = Number(maq.consumoMaquina) || 0;
          const tarifa = Number(maq.tarifa) || 0;
          const mantenimiento = Number(maq.costoMantenimiento) || 0;
          const calc = (consumo / 1000 * tarifa) + mantenimiento;
          if (calc > 0) return calc;
        }
      }
    }
  }

  const firstMaq = allAssets.find(a => (a as unknown as Record<string, unknown>)['clasificacion'] === 'Maquinaria' || (a as unknown as Record<string, unknown>)['tipo'] === 'Maquinaria');
  if (firstMaq) {
    const consumo = Number(firstMaq.consumoMaquina) || 0;
    const tarifa = Number(firstMaq.tarifa) || 0;
    const mantenimiento = Number(firstMaq.costoMantenimiento) || 0;
    const calc = (consumo / 1000 * tarifa) + mantenimiento;
    if (calc > 0) return calc;
  }

  return 15.75;
}

/* Renderiza el modal interactivo de estudio de presupuesto con desglose por piezas y costos.*/
export function showBudgetStudyModal(
  row: Budget,
  allAssets: Asset[],
  totalFijoIndirecto: number,
  capacidadHorasMaquina: number
): void {
  const norm = normalizeBudget(row);
  const rowRec = row as unknown as Record<string, unknown>;
  const lineas = hidratarLineas(rowRec, norm.piezas || [], {
    maquinas: allAssets,
    materiales: allAssets,
    circulantes: allAssets,
    mobiliario: allAssets
  });

  const res = lineas.length > 0
    ? calculateMultiItemTotals(
        lineas,
        Number(norm.delivery) || 0,
        allAssets,
        totalFijoIndirecto,
        capacidadHorasMaquina
      )
    : calculateBudgetTotals(
        norm,
        allAssets,
        totalFijoIndirecto,
        capacidadHorasMaquina
      );

  const totalGramos = res.totalGramos;
  const finalHoras = res.totalHoras;
  const finalMinutos = res.totalMinutos;
  const totalCostoMaterial = res.totalCostoMaterial;
  const totalCostoMaquina = res.totalCostoMaquina;
  const totalCostoIndirecto = res.costoIndirectoAsignado;
  const depreciacionAsignada = res.depreciacionAsignada;
  const totalCostoInventario = res.totalCostoInventario;
  const baseCost = res.costoTotalUnitarioBase;
  const suggestedPrice = res.precioSugeridoUnitario;
  const deliveryCost = res.delivery;
  const totalBudgetFinal = res.costoTotalFinal;

  function renderPiezaRow(p: Parts): string {
    const pRec = p as unknown as Record<string, unknown>;
    const cant = Number(pRec['cantidad'] ?? p.cantidad) || 1;
    const baseG = Number(pRec['gramos'] ?? p.gramos) || 0;
    const g = baseG * cant;
    const baseH = Number(pRec['horas'] ?? p.horas) || 0;
    const baseMin = Number(pRec['minutos'] ?? p.minutos) || 0;
    const totalMinutos = (baseH * 60 + baseMin) * cant;
    const h = Math.floor(totalMinutos / 60);
    const min = totalMinutos % 60;

    let matCost: number;
    const tipo = String(pRec['tipo'] ?? p.tipo ?? 'Fabricada');
    if (tipo === 'Del Inventario') {
      const actId = pRec['activo'] ?? pRec['activo_id'] ?? pRec['assetId'] ?? p.activo;
      let unitVal = 0;
      if (actId && allAssets && allAssets.length > 0) {
        const found = allAssets.find(a => a.id == actId);
        if (found) {
          unitVal = Number(found.costoInicial || found.valorUnitario) || Number((found as unknown as Record<string, unknown>)['precio']) || 0;
        }
      }
      if (unitVal <= 0) {
        unitVal = Number(pRec['costoInicial'] ?? pRec['valorUnitario'] ?? pRec['precio'] ?? pRec['precioMaterial'] ?? p.precioMaterial) || 0;
      }
      matCost = unitVal * cant;
    } else {
      let precioMat = Number(pRec['precioMaterial'] ?? pRec['precio_material'] ?? p.precioMaterial) || 0;
      if (precioMat >= 1.0) {
        precioMat = precioMat / 1000;
      }
      matCost = g * precioMat;
    }

    let maqRate = res.costoMaquinaRate;
    const maqId = p.maquina ?? pRec['maquina_id'] ?? pRec['activo_id'];
    if (maqId && allAssets && allAssets.length > 0) {
      const maq = allAssets.find(a => a.id == maqId);
      if (maq) {
        maqRate = costoHoraMaquina(maq).rate;
      }
    }
    const maqCost = (maqRate || 0) * (totalMinutos / 60);
    const tiempoTxt = (baseH > 0 || baseMin > 0) ? `${h}h ${min}m` : '-';

    return `
      <tr>
        <td class="text-start ps-3 fw-medium text-dark">${p.nombre || 'Pieza'} ${cant > 1 ? `<span class="badge bg-secondary bg-opacity-10 text-secondary ms-1">x${cant}</span>` : ''}</td>
        <td><span class="badge ${tipo === 'Del Inventario' ? 'bg-info bg-opacity-10 text-info' : 'bg-primary bg-opacity-10 text-primary'}" style="font-size: 0.68rem;">${tipo}</span></td>
        <td>${g > 0 ? `${g.toFixed(1)}g` : '-'}</td>
        <td class="text-muted">${tiempoTxt}</td>
        <td class="fw-semibold text-dark">$${matCost.toFixed(2)}</td>
        <td class="fw-semibold text-primary pe-3">$${maqCost.toFixed(2)}</td>
      </tr>
    `;
  }

  const itemsParaMostrar = lineas.length > 0 ? lineas : [{
    clave: 'item-default',
    productoId: null,
    clasificacion: norm.clasificacion || 'Producto',
    nombre: norm.descripcion || 'Producto Principal',
    cantidad: norm.cantidadGlobal || 1,
    tiempoSetup: res.tiempoSetupMin || 0,
    tiempoPostProcesado: res.tiempoPostProcesadoMin || 0,
    tasaFallo: norm.tasaFalloGlobal || 0,
    margenGanancia: norm.margenGanancia || 0,
    piezas: norm.piezas || []
  }];

  const productosHtml = itemsParaMostrar.map((item, idx) => {
    const itemPiezas = (item.piezas && item.piezas.length > 0) ? item.piezas : (itemsParaMostrar.length === 1 ? (norm.piezas || []) : []);
    const filasPiezas = itemPiezas.map(renderPiezaRow).join('');

    return `
      <div class="card border border-secondary border-opacity-15 shadow-none mb-3 bg-white overflow-hidden rounded-3">
        <div class="card-header bg-light bg-opacity-75 py-2 px-3 border-bottom d-flex flex-wrap justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${item.clasificacion === 'Servicio' ? 'bg-success' : 'bg-primary'} bg-opacity-10 ${item.clasificacion === 'Servicio' ? 'text-success' : 'text-primary'} fw-semibold px-2 py-1" style="font-size: 0.7rem;">
              <i class="ti ${item.clasificacion === 'Servicio' ? 'ti-tools' : 'ti-box'} me-1"></i>${item.clasificacion || 'Producto'}
            </span>
            <span class="fw-bold text-dark" style="font-size: 0.88rem;">${item.nombre || `Ítem ${idx + 1}`}</span>
            <span class="badge bg-light text-muted border px-2 py-1" style="font-size: 0.7rem;">
              ${item.cantidad > 1 ? `${item.cantidad} unidades` : '1 unidad'}
            </span>
          </div>
          <div class="d-flex align-items-center gap-3 text-muted" style="font-size: 0.72rem;">
            ${item.margenGanancia ? `<span>Margen: <b class="text-dark">${item.margenGanancia}%</b></span>` : ''}
            ${item.tasaFallo ? `<span>Merma: <b class="text-danger">${item.tasaFallo}%</b></span>` : ''}
            ${(item.tiempoSetup || item.tiempoPostProcesado) ? `<span>Setup/Post: <b class="text-dark">${item.tiempoSetup || 0}m / ${item.tiempoPostProcesado || 0}m</b></span>` : ''}
          </div>
        </div>
        <div class="card-body p-0">
          ${filasPiezas ? `
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0 text-center" style="font-size: 0.75rem;">
                <thead class="table-light text-muted" style="font-size: 0.7rem;">
                  <tr>
                    <th class="text-start ps-3 py-1 fw-semibold">Pieza / Insumo</th>
                    <th class="py-1 fw-semibold">Tipo</th>
                    <th class="py-1 fw-semibold">Gramos</th>
                    <th class="py-1 fw-semibold">Tiempo</th>
                    <th class="py-1 fw-semibold">Costo Insumo</th>
                    <th class="py-1 fw-semibold pe-3">Costo Máq.</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasPiezas}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="text-muted text-center py-2 fst-italic" style="font-size: 0.72rem;">
              <i class="ti ti-info-circle me-1"></i>Ítem directo sin piezas desglosadas
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  Swal.fire({
    title: `<div class="text-start text-primary fw-bold fs-5">Estudio de Presupuesto</div>`,
    html: `
      <div class="text-start" style="font-family: 'Inter', sans-serif; font-size: 0.85rem; max-height: 75vh; overflow-y: auto; padding-right: 4px;">
        <div class="row g-3 mb-3">
          <div class="col-md-7">
            <div class="card border-0 shadow-sm h-100 bg-light">
              <div class="card-header bg-transparent border-bottom-0 pt-3 pb-1 text-start">
                <h6 class="fw-bold text-dark mb-0 fs-6"><i class="ti ti-file-description me-2"></i>Datos del Presupuesto</h6>
              </div>
              <div class="card-body px-3 py-2 text-start">
                <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Clasificación:</span>
                  <span class="fw-medium text-dark">${norm.clasificacion || ''}</span>
                </div>
                <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Nro. de Orden:</span>
                  <span class="fw-medium text-dark">${norm.numero || ''}</span>
                </div>
                <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Fecha:</span>
                  <span class="fw-medium text-dark">${norm.fecha ? new Date(norm.fecha).toLocaleDateString() : ''}</span>
                </div>
                <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Descripción:</span>
                  <span class="fw-medium text-dark">${norm.descripcion || ''}</span>
                </div>
                <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Tasa de Fallo (Merma):</span>
                  <span class="text-danger fw-medium">${norm.tasaFalloGlobal || 0}%</span>
                </div>
                <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Prep/Slicing:</span>
                  <span class="fw-medium text-dark">${res.tiempoSetupMin} min</span>
                </div>
                <div class="d-flex justify-content-between pt-1">
                  <span class="text-muted" style="font-size: 0.8rem;">Post-procesado:</span>
                  <span class="fw-medium text-dark">${res.tiempoPostProcesadoMin} min</span>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-5">
            <div class="card h-100 border-0 text-white shadow-sm" style="background-color: #2b5fe8; border-radius: 8px;">
              <div class="card-body text-start p-3 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <span class="text-uppercase text-white-50 fw-bold" style="font-size: 0.7rem; letter-spacing: 1px;">Análisis de Costos</span>
                  <div class="bg-white bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;">
                    <i class="ti ti-currency-dollar fs-6 text-white"></i>
                  </div>
                </div>
                <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                  <span class="text-white-50">Costo de Materiales (con merma):</span>
                  <span class="fw-medium">$${totalCostoMaterial.toFixed(2)}</span>
                </div>
                <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                  <span class="text-white-50">Costo Operativo Máquina:</span>
                  <span class="fw-medium">$${totalCostoMaquina.toFixed(2)}</span>
                </div>
                <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                  <span class="text-white-50">Costo Indirecto Prorrateado:</span>
                  <span class="fw-medium">$${totalCostoIndirecto.toFixed(2)}</span>
                </div>
                ${depreciacionAsignada > 0 ? `
                <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                  <span class="text-white-50">Depreciación Prorrateada:</span>
                  <span class="fw-medium">$${depreciacionAsignada.toFixed(2)}</span>
                </div>
                ` : ''}
                ${totalCostoInventario > 0 ? `
                <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                  <span class="text-white-50">Costo Piezas Inventario:</span>
                  <span class="fw-medium">$${totalCostoInventario.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="d-flex justify-content-between mb-2 border-bottom border-white border-opacity-25 pb-2" style="font-size: 0.8rem;">
                  <span class="text-white-50">${lineas.length > 1 ? 'Costo Base Total (Ítems):' : 'Costo Unitario Base:'}</span>
                  <span class="fw-bold">$${baseCost.toFixed(2)}</span>
                </div>
                <div class="mt-2 pt-2 border-top border-white border-opacity-25">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="text-white-50" style="font-size: 0.75rem;">${lineas.length > 1 ? 'Subtotal Sugerido (Ítems):' : 'Precio Sugerido Unitario:'}</span>
                    <span class="fw-bold text-white fs-5">$${suggestedPrice.toFixed(2)}</span>
                  </div>
                  ${deliveryCost > 0 ? `
                  <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 0.75rem;">
                    <span class="text-white-50">Costo de Delivery:</span>
                    <span class="fw-medium text-white">$${deliveryCost.toFixed(2)}</span>
                  </div>
                  ` : ''}
                  <div class="pt-2 border-top border-white border-opacity-25 mt-2">
                    <div class="text-white-50 mb-1" style="font-size: 0.7rem;">Presupuesto Total Final</div>
                    <div class="fs-4 fw-bold text-warning">$${totalBudgetFinal.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mb-3">
          <h6 class="fw-bold mb-2 text-dark fs-6"><i class="ti ti-layers-intersect me-2 text-muted"></i>Especificaciones Físicas Totales</h6>
          <div class="row g-2">
            <div class="col-md-4">
              <div class="card border border-light shadow-sm bg-white">
                <div class="card-body p-2 d-flex align-items-center">
                  <div class="bg-primary bg-opacity-10 rounded-circle p-1 text-primary me-2">
                    <i class="ti ti-weight fs-5"></i>
                  </div>
                  <div>
                    <div class="text-muted mb-0" style="font-size: 0.7rem;">Gramos Totales</div>
                    <div class="fw-bold fs-6 text-dark">${totalGramos.toFixed(2)}g</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card border border-light shadow-sm bg-white">
                <div class="card-body p-2 d-flex align-items-center">
                  <div class="bg-warning bg-opacity-10 rounded-circle p-1 text-warning me-2">
                    <i class="ti ti-clock fs-5"></i>
                  </div>
                  <div>
                    <div class="text-muted mb-0" style="font-size: 0.7rem;">Horas Totales</div>
                    <div class="fw-bold fs-6 text-dark">${finalHoras}h</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card border border-light shadow-sm bg-white">
                <div class="card-body p-2 d-flex align-items-center">
                  <div class="bg-danger bg-opacity-10 rounded-circle p-1 text-danger me-2">
                    <i class="ti ti-timer fs-5"></i>
                  </div>
                  <div>
                    <div class="text-muted mb-0" style="font-size: 0.7rem;">Minutos Totales</div>
                    <div class="fw-bold fs-6 text-dark">${finalMinutos}m</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="fw-bold mb-0 text-dark fs-6"><i class="ti ti-box-model-2 me-2 text-muted"></i>Productos y Desglose de Piezas</h6>
            <span class="badge bg-light text-muted border px-2 py-1" style="font-size: 0.75rem;">
              ${itemsParaMostrar.length} ${itemsParaMostrar.length === 1 ? 'producto/ítem' : 'productos/ítems'}
            </span>
          </div>
          ${productosHtml}
        </div>
      </div>
    `,
    customClass: {
      popup: 'rounded-4 bg-white',
      title: 'border-bottom pb-2 mb-0'
    },
    width: '950px',
    showCloseButton: true,
    showConfirmButton: false,
  });
}
