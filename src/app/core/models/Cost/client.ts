export interface Client {
  id?: number;
  nombre: string;
  apellido: string;
  rifCedula?: string;
  cedula?: string;
  categoria?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fechaRegistro?: string | Date;
  totalCompras?: number;
}
