export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  groupClasses?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  link?: string;
  description?: string;
  path?: string;
}

export const NavigationItems: NavigationItem[] = [
  // INICIO
  {
    id: 'inicio',
    title: 'INICIO',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard/default',
        icon: 'dashboard',
        breadcrumbs: false
      }
    ]
  },

  // ADMIN
  {
    id: 'admin',
    title: 'ADMIN',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'configs',
        title: 'Perfil',
        type: 'item',
        classes: 'nav-item',
        url: '/configs',
        icon: 'setting',
        breadcrumbs: false
      },
      // Usuarios y Roles de seguridad se colocarán después cuando se migren los archivos
      {
        id: 'codings',
        title: 'Codigos',
        type: 'item',
        classes: 'nav-item',
        url: '/codings',
        icon: 'barcode',
        breadcrumbs: false
      }
    ]
  },

  // MODULOS
  {
    id: 'modulos',
    title: 'MODULOS',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'products',
        title: 'Productos',
        type: 'item',
        classes: 'nav-item',
        url: '/products',
        icon: 'gold',
        breadcrumbs: false
      },
      {
        id: 'fixes',
        title: 'Costos',
        type: 'item',
        classes: 'nav-item',
        url: '/fixes',
        icon: 'dollar',
        breadcrumbs: false
      },
      {
        id: 'assets',
        title: 'Activos',
        type: 'item',
        classes: 'nav-item',
        url: '/assets',
        icon: 'database',
        breadcrumbs: false
      },
      {
        id: 'pricings',
        title: 'Precios',
        type: 'item',
        classes: 'nav-item',
        url: '/pricings',
        icon: 'calculator',
        breadcrumbs: false
      },
      {
        id: 'budgets',
        title: 'Presupuestos',
        type: 'item',
        classes: 'nav-item',
        url: '/budgets',
        icon: 'audit',
        breadcrumbs: false
      }
    ]
  }

  /* Comentados por ahora
  {
    id: 'authentication',
    title: 'Authentication',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'register',
        title: 'Register',
        type: 'item',
        classes: 'nav-item',
        url: '/register',
        icon: 'profile',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'utilities',
    title: 'UI Components',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'typography',
        title: 'Typography',
        type: 'item',
        classes: 'nav-item',
        url: '/typography',
        icon: 'font-size'
      },
      {
        id: 'color',
        title: 'Colors',
        type: 'item',
        classes: 'nav-item',
        url: '/color',
        icon: 'bg-colors'
      },
      {
        id: 'ant-icons',
        title: 'Ant Icons',
        type: 'item',
        classes: 'nav-item',
        url: 'https://ant.design/components/icon',
        icon: 'ant-design',
        target: true,
        external: true
      }
    ]
  },
  {
    id: 'other',
    title: 'Other',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'sample-page',
        title: 'Sample Page',
        type: 'item',
        url: '/sample-page',
        classes: 'nav-item',
        icon: 'chrome'
      }
    ]
  }
  */
];
