
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
    piezasBase?: any[];
}