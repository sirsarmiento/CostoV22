
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
    codigoCatalogo?: string;
    tecnologia?: string;
    material?: string;
    familia?: string | { id?: number; codigo?: string; nombre?: string };
    familiaId?: number | null;
    serie?: string;
    correlativo?: string;
    medida!: string;
    clasificacion!: string;
    descripcion!: string;
    perfil!: number;
    periodo?: string;
    tasaFallo?: number;
    tiempoSetup?: number;
    postProcesado?: number;
    margenGanancia?: number;
    piezasProducto?: PiezaProducto[];
    cantidadStock?: number;
    imagen?: string;
}