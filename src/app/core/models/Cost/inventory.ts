export interface Supplier {
  id?: number;
  nombre: string;
  rif?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  contacto?: string;
}

export interface PurchaseLine {
  activo: number;
  cantidad: number;
  valorUnitario: number;
  activoNombre?: string;
}

export interface Purchase {
  id?: number;
  numero?: string;
  fecha: string | Date;
  proveedor: number;
  observacion?: string;
  total?: number;
  lineas: PurchaseLine[];
  proveedorNombre?: string;
}

export interface Sale {
  id?: number;
  numero?: string;
  fecha?: string;
  descripcion?: string;
  cantidad?: number;
  total?: number;
  presupuesto?: number;
  cliente?: { id: number; nombre: string };
  producto?: { id: number; nombre: string };
}

export interface StockItem {
  id: number;
  nombre: string;
  sku?: string;
  clasificacion?: string;
  cantidadStock: number;
}

export interface InventoryMovement {
  id: number;
  tipo: string;
  cantidad: number;
  observacion?: string;
  createAt?: string;
  activo?: { id: number; nombre: string } | null;
  producto?: { id: number; nombre: string } | null;
}

export interface DecoupleLine {
  activo: number;
  recuperado: number;
  merma: number;
}

export interface Decouple {
  producto: number;
  cantidadProducto: number;
  observacion?: string;
  lineas: DecoupleLine[];
}
