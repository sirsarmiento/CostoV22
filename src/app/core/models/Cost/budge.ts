
export class Budget { //Presupuesto
    id?: number;
    sku?: string;
    clasificacion: string;
    descripcion: string;
    numero: string;
    fecha: Date;
    piezas?: Parts[];
    productoId?: number | null;
    costoOperador?: number;
    costoMaquina?: number;
    tasaFalloGlobal?: number;
    tiempoSetup?: number;
    margenGanancia?: number;
    tiempoPostProcesado?: number;
    activoId?: number;
}

export class Parts{ //Piezas
    id?: number;
    nombre?: string;
    materialTipo: string;
    gramos: number;
    metros: number;
    horas: number;
    minutos: number;
    precioMaterial?: number;
    tiempoPostProcesado?: number;
}


