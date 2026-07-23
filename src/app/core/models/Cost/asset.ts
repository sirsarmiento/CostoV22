
export class Asset { 
    id?: number;
    nombre: string;
    costoInicial: number;
    valorResidual: number;
    vidaUtil: number;
    fechaCompra: Date;
    tipo: string;        
    depMensual?: number;        
    depAnual?: number;
    
    cantidad: number;      
    unidadMedida: string;    
    presentacion: string;    
    descripcion: string;     
    ubicacion: string;       
    valorUnitario: number;
    
    categoria?: string;
    subcategoria?: string;
    consumoMaquina?: number;
    tarifa?: number;
    costoMantenimiento?: number;
}