// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: false,
  useMocks: false,
  mockData: {
    products: [
      {
        id: 1,
        nombre: 'Tornillo CNC Especial M8',
        sku: 'CNC-M8-001',
        medida: 'Unidades',
        clasificacion: 'Directo',
        descripcion: 'Tornillo mecanizado de precisión para ensambles de chasis',
        perfil: 1,
        periodo: '2026'
      },
      {
        id: 2,
        nombre: 'Eje de Transmisión Aluminio',
        sku: 'EJE-ALU-002',
        medida: 'Unidades',
        clasificacion: 'Directo',
        descripcion: 'Eje de aluminio de alta resistencia fresado',
        perfil: 1,
        periodo: '2026'
      }
    ],
    fixes: [
      {
        id: 1,
        tipo: 'Fijo',
        concepto: 'Alquiler del Taller Mecánico',
        precio: 1500.0,
        clasificacion: 'Indirecto',
        producto: 0
      },
      {
        id: 2,
        tipo: 'Fijo',
        concepto: 'Salario Supervisor de Planta',
        precio: 2200.0,
        clasificacion: 'Indirecto',
        producto: 0
      },
      {
        id: 3,
        tipo: 'Fijo',
        concepto: 'Mantenimiento Preventivo CNC',
        precio: 450.0,
        clasificacion: 'Directo',
        producto: 1
      }
    ],
    configs: [
      {
        id: 1,
        nombre: 'Empresa Alpha S.A.',
        tipo: 'Manufactura',
        sector: 'Metalmecánica',
        empleados: 45,
        rif: 'J-12345678-9',
        periodo: '2026',
        direccion: 'Zona Industrial I, Calle 4, Local 12',
        moneda: 'USD',
        margenGanancia: 30,
        parametros: [
          { id: 1, unidad: 'Piezas', tipo: 'Torno CNC', descripcion: 'Mecanizado de piezas de precisión', prodMaxHoras: 50, horasMax: 160, horasUso: 120 },
          { id: 2, unidad: 'Piezas', tipo: 'Fresadora', descripcion: 'Fresado y desbaste', prodMaxHoras: 30, horasMax: 160, horasUso: 80 },
          { id: 3, unidad: 'Horas', tipo: 'Compresor Industrial', descripcion: 'Suministro de aire comprimido', prodMaxHoras: 1, horasMax: 200, horasUso: 150 }
        ]
      },
      {
        id: 2,
        nombre: 'Servicios Beta C.A.',
        tipo: 'Servicios',
        sector: 'Consultoría',
        empleados: 12,
        rif: 'J-98765432-1',
        periodo: '2026',
        direccion: 'Av. Francisco de Miranda, Torre Delta, Piso 5',
        moneda: 'VES',
        margenGanancia: 25,
        parametros: []
      }
    ],
    assets: [
      {
        id: 1,
        nombre: 'Impresora 3D Prusa MK4',
        costoInicial: 1200,
        valorResidual: 200,
        vidaUtil: 5,
        fechaCompra: new Date('2026-01-10'),
        tipo: 'Fijo',
        cantidad: 2,
        valorUnitario: 1200,
        unidadMedida: 'Unidades',
        presentacion: 'Caja',
        descripcion: 'Impresora 3D de filamento FDM de alta velocidad',
        ubicacion: 'Taller CNC',
        categoria: 'Maquinaria',
        consumoMaquina: 0.35,
        tarifa: 0.15,
        costoMantenimiento: 120,
        depMensual: 16.67,
        depAnual: 200
      },
      {
        id: 2,
        nombre: 'Compresor de Aire 50L',
        costoInicial: 450,
        valorResidual: 50,
        vidaUtil: 5,
        fechaCompra: new Date('2026-02-15'),
        tipo: 'Fijo',
        cantidad: 1,
        valorUnitario: 450,
        unidadMedida: 'Unidades',
        presentacion: 'Caja',
        descripcion: 'Compresor de aire para limpieza y herramientas neumáticas',
        ubicacion: 'Taller CNC',
        categoria: 'Maquinaria',
        consumoMaquina: 1.5,
        tarifa: 0.15,
        costoMantenimiento: 50,
        depMensual: 6.67,
        depAnual: 80
      },
      {
        id: 3,
        nombre: 'Filamento PLA Pro 1kg',
        costoInicial: 120,
        valorResidual: 0,
        vidaUtil: 0,
        fechaCompra: new Date('2026-06-01'),
        tipo: 'Circulante',
        cantidad: 5,
        valorUnitario: 24,
        unidadMedida: 'Kilogramos',
        presentacion: 'Bobina',
        descripcion: 'Materia prima para impresión 3D',
        ubicacion: 'Almacén de Materiales',
        categoria: 'Materiales',
        depMensual: 0,
        depAnual: 0
      }
    ],
    budgets: [
      {
        id: 1,
        sku: 'B-CNC-001',
        clasificacion: 'Servicio',
        descripcion: 'Servicio Mecanizado Eje Torno',
        numero: 'B-001',
        fecha: new Date('2026-07-01'),
        piezas: [
          { id: 1, nombre: 'Eje Base', materialTipo: 'Aluminio', gramos: 350, metros: 1.2, horas: 1, minutos: 30, precioMaterial: 15.5, tiempoPostProcesado: 20 }
        ],
        productoId: 1,
        costoOperador: 15.0,
        costoMaquina: 25.0,
        tasaFalloGlobal: 5.0,
        tiempoSetup: 30,
        margenGanancia: 30,
        tiempoPostProcesado: 20,
        activoId: 1
      },
      {
        id: 2,
        sku: 'B-PLA-002',
        clasificacion: 'Proyecto',
        descripcion: 'Proyecto Prototipo Carcasa PLA',
        numero: 'B-002',
        fecha: new Date('2026-07-15'),
        piezas: [
          { id: 2, nombre: 'Carcasa Principal', materialTipo: 'PLA', gramos: 250, metros: 84.0, horas: 6, minutos: 0, precioMaterial: 8.0, tiempoPostProcesado: 10 }
        ],
        productoId: 2,
        costoOperador: 12.0,
        costoMaquina: 18.0,
        tasaFalloGlobal: 3.0,
        tiempoSetup: 15,
        margenGanancia: 25,
        tiempoPostProcesado: 10,
        activoId: 2
      }
    ],
    pricings: [] as unknown[],
    codings: [] as unknown[],
    families: [
      { id: 1, codigo: 'FM01', nombre: 'Familia Mecanizados', subFamilias: [ { id: 1, codigo: 'S01', nombre: 'Subfamilia Torneado' }, { id: 2, codigo: 'S02', nombre: 'Subfamilia Fresado' } ] },
      { id: 2, codigo: 'FM02', nombre: 'Familia Extrusión', subFamilias: [] }
    ],
    skus: [
      { id: 1, sku: 'SR-CNC-AC-FM01-S01', codigo: 'SR-CNC-AC-FM01-S01', productName: 'Tornillo CNC Especial M8', categoria: 'SR', tecnologia: 'CNC', material: 'AC', familia: 'FM01', subfamilia: 'S01', productId: 1, presupuestoId: 1, familiaId: 1, subfamiliaId: 1 },
      { id: 2, sku: 'PP-FRE-AL-FM02-001', codigo: 'PP-FRE-AL-FM02-001', productName: 'Eje de Transmisión Aluminio', categoria: 'PP', tecnologia: 'FRE', material: 'AL', familia: 'FM02', subfamilia: '', productId: 2, presupuestoId: 2, familiaId: 2, subfamiliaId: null }
    ]
  },
  name_system: 'COST',
  ttl: 28800000,
  apiAuth: 'http://localhost:8090/backost/public',
  apiUrl: 'http://localhost:8090/backost/public/api',
  //apiUrl: 'https://bof.pafar.com.ve/public/api',
  //apiAuth: 'https://bof.pafar.com.ve/public',
  appUrl: 'http://localhost:4200',
  wsserver: "https://wsplatformstage.pafar.com.ve",
  localstorage: {
    userKey: 'cusr'
  },
  form: {
    url: {
      validations: {
        pattern: '^(https?|http):\\/\\/([a-zA-Z0-9.-]+(:[a-zA-Z0-9.&%$-]+)*@)*((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}|([a-zA-Z0-9-]+\\.)*[a-zA-Z0-9-]+\\.(com|edu|gov|int|mil|net|org|biz|arpa|info|name|pro|aero|coop|museum|[a-zA-Z]{2,10}))(:[0-9]+)*(\\/($|[a-zA-Z0-9.,?\'\\\\+&%$#=~_-]+))*$'
      }
    },
    password: {
      validations: {
        pattern: '^(?=.{8,})(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&.+=*]).*$',
      }
    },
    number: {
      validations: {
        pattern: '^[0-9]*$',
      }
    },
    double: {
      validations: {
        pattern: '^[0-9.]*$',
      }
    },
    alphanumeric: {
      validations: {
        pattern: '^[a-zA-Z0-9]*$',
      }
    },
    alphanumeric_guion: {
      validations: {
        pattern: '^[a-zA-Z0-9-]*$',
      }
    },
    number_guion: {
      validations: {
        pattern: '^[0-9-]*$',
      }
    },
    role_pattern: {
      validations: {
        pattern: '(ROLE)[A-Z_]+',
      }
    },
    file_extension: ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'png', 'jpg', 'jpge'],
    file_imagen_extension: ['png', 'jpg', 'jpge'],
    file_acordo_extension: ['pdf'],
    file_extension_pdf: ['pdf'],
    file_extension_excel: ['xls', 'xlsx']
  },
  paginator: {
    default_page: 1,
    row_per_page: 8
  },
  endpoints: {
    handle_error_blackList: [
      '/login_check',
      '/recovery-password',
      '/changepassword',
      'security/login'
    ],
    handler_auth_whiteList: [
      '/recovery-password',
      '/changepassword'
    ]
  },
  superset: {
    url: "https://psuperset.pafar.com.ve/api/v1/",
    username: "admin",
    first_name: "admin",
    last_name: "analytic",
    password: "pafarco1"
  }
};


