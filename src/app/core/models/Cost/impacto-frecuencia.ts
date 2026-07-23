
export class ImpactoFrecuencia {
    id?: number;
    descripcion: string;
    peso: number;
    porcentaje: number;
}

export interface HeatmapItem {
  id: number;
  impacto: number;
  frecuencia: number;
  color: string;
  inherente: string;
  colorInherente: string;
}

