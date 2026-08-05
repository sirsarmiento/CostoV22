export class SkuCoding {
  id?: number;
  sku!: string;
  codigo!: string;
  productName!: string;
  categoria!: string;
  tecnologia!: string;
  material!: string;
  familia!: string | { id: number, nombre: string, codigo?: string };
  subfamilia!: string | { id: number, nombre: string, codigo?: string };
  productId?: number | null;
  presupuestoId?: number | null;
  familiaId?: number | null;
  subfamiliaId?: number | null;
  materialesMolde?: { material: string, cantidad: number, unidad: string }[];
  
  // Datos anidados del servidor
  producto?: { id: number, nombre: string };
  servicio?: { id: number, nombre: string };
  proyecto?: { id: number, nombre: string };
}
