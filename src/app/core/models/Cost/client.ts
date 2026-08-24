export interface Client {
  id?: number;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fechaRegistro?: string | Date;
  totalCompras?: number;
}
