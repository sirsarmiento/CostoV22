
export class Budget { //Presupuesto
    id?: number;
    sku?: string;
    clasificacion!: string;
    descripcion!: string;
    numero!: string;
    fecha!: Date;
    piezas?: Parts[];
    producto?: number | null;
    costoOperador?: number;
    costoMaquina?: number;
    tasaFalloGlobal?: number;
    tiempoSetup?: number;
    margenGanancia?: number;
    tiempoPostProcesado?: number;
    cantidadGlobal?: number;
    delivery?: number;
    cliente?: number;
    clienteId?: number;
    clienteNombre?: string;
    clienteDetalle?: Record<string, unknown>;
    activo?: number;
    costoTotalFinal?: number;
    total?: number;
}

export class Parts{ //Piezas
    id?: number;
    tipo?: string;
    nombre?: string;
    cantidad?: number;
    materialTipo!: string;
    materialDisplayName?: string;
    gramos!: number;
    metros?: number;
    horas!: number;
    minutos!: number;
    precioMaterial?: number;
    tiempoPostProcesado?: number;
    producto?: number;
    activo?: number;
    maquina?: number;
    maquinaNombre?: string;
}


