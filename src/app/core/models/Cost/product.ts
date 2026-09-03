
export interface PiezaProducto {
    id?: number;
    nombre?: string;
    gramos?: number;
    metros?: number;
    horas?: number;
    minutos?: number;
    precioMaterial?: number;
    tipo?: string;
    cantidad?: number;
    activo?: number;
    maquina?: number;
    activoId?: number;
    activoNombre?: string;
    maquinaId?: number;
    maquinaNombre?: string;
}

export class Product { 
    id?: number;
    nombre!: string;
    sku!: string;
    medida!: string;
    clasificacion!: string;
    descripcion!: string;
    perfil!: number;
    periodo?: string;
    tasaFallo?: number;
    prepSlicing?: number;
    postProcesado?: number;
    margenGanancia?: number;
    piezasProducto?: PiezaProducto[];
    cantidadStock?: number;
}