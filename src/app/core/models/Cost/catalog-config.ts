export interface TecnologiaCatalogo {
  id?: number;
  codigo: string;
  nombre: string;
  materiales?: MaterialCatalogo[];
}

export interface MaterialCatalogo {
  id?: number;
  codigo: string;
  nombre: string;
  tecnologias?: TecnologiaCatalogo[];
}
