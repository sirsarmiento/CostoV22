export class Config { //Perfil de la Empresa
    id?: number;
    nombre!: string;
    tipo!: string;
    sector!: string;
    empleados!: number;
    rif!: string;
    periodo!: string;
    direccion!: string;
    moneda!: string;
    margenGanancia?: number;
    parametros?: Machine[];
}

export class Machine{ //Parametros
    id?: number;
    unidad!: string;
    tipo!: string;
    descripcion!: string;
    prodMaxHoras!: number;
    horasMax!: number;
    horasUso!: number;
}

export class CapacityResults {
  installedCapacity!: number;    // Capacidad instalada total
  productionCapacity!: number;   // Capacidad de producción real
  idleCapacity!: number;         // Capacidad ociosa total
  utilizationPercentage!: number; // Porcentaje de utilización
  machines!: MachineCapacity[];  // Detalle por máquina
}

export class MachineCapacity {
  machine!: Machine;
  installed!: number;     // Capacidad instalada de esta máquina
  production!: number;    // Capacidad de producción de esta máquina
  idle!: number;          // Capacidad ociosa de esta máquina
}

export class Responsibles{
    id!: number;
    fullName!: string;
    dependence!: string;
    position!: string;
}