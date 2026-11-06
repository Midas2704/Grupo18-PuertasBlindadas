import { usarSesion, operar } from '../../seguridad/Sesion';
import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Anchor,
  Banknote,
  BriefcaseBusiness,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  FileSearch,
  FileSignature,
  Landmark,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MapPinned,
  Menu,
  Receipt,
  SearchCheck,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users,
  WalletCards,
  X,
  ChartNoAxesCombined,
  Scale,
  BellRing,
  CreditCard,
  ScrollText,
} from 'lucide-react';

type MenuItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  permissions?: string[];
};

type MenuGroupDefinition = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
};

type MenuGroupProps = {
  group: MenuGroupDefinition;
  isOpen: boolean;
  pathname: string;
  onToggle: () => void;
  onNavigate: () => void;
};

const dashboardItem: MenuItem = {
  path: '/',
  label: 'Dashboard',
  icon: LayoutDashboard,
  permission: 'CU05',
};

const menuGroups: MenuGroupDefinition[] = [
  {
    id: 'analitica-financiera',
    label: 'Analítica financiera',
    icon: ChartNoAxesCombined,
    items: [
      { path: '/dashboard-m7/centro-atencion', label: 'Centro de Atención', icon: BellRing, permission: 'CU216' },
      { path: '/dashboard-m7/resumenes', label: 'Resúmenes Gerenciales', icon: Scale, permissions: ['CU238', 'CU239'] },
      { path: '/dashboard-m7/operacion', label: 'Operación y Costos', icon: ClipboardList, permissions: ['CU242', 'CU247', 'CU248', 'CU250', 'CU252', 'CU253'] },
      { path: '/dashboard-m7/control', label: 'Control Financiero', icon: SearchCheck, permissions: ['CU228', 'CU232', 'CU240', 'CU241', 'CU243', 'CU244', 'CU249', 'CU251', 'CU254', 'CU255', 'CU256', 'CU257', 'CU258'] },
    ],
  },
  {
    id: 'credito',
    label: 'Crédito',
    icon: CreditCard,
    items: [
      { path: '/credito/solicitudes', label: 'Solicitudes de Crédito', icon: ClipboardList, permission: 'CU259' },
    ],
  },
  {
    id: 'clientes-ventas',
    label: 'Clientes y Ventas',
    icon: ShoppingCart,
    items: [
      { path: '/clientes', label: 'Catálogo de Clientes', icon: Users, permission: 'CU05' },
      { path: '/cotizacion/nueva', label: 'Armar Cotización', icon: FileSignature, permission: 'CU19' },
      { path: '/venta/directa', label: 'Nueva Venta Directa', icon: Receipt, permission: 'CU27' },
      { path: '/pagos', label: 'Pagos y Recaudación', icon: Receipt, permission: 'CU42' },
      { path: '/aprobaciones', label: 'Gestión / Aprobaciones', icon: ListChecks, permission: 'CU20' },
    ],
  },
  {
    id: 'proveedores-egresos',
    label: 'Proveedores y Egresos',
    icon: WalletCards,
    items: [
      { path: '/proveedores', label: 'Proveedores', icon: Truck, permission: 'CU80' },
      { path: '/ordenes-compra-servicios', label: 'OC de Servicios', icon: ClipboardList, permission: 'CU88' },
      { path: '/documentos-proveedor', label: 'Documentos Proveedor', icon: FileSearch, permission: 'CU95' },
      { path: '/cuentas-por-pagar', label: 'Cuentas por Pagar', icon: Landmark, permission: 'CU106' },
      { path: '/pagos-proveedores', label: 'Pagos a Proveedores', icon: WalletCards, permission: 'CU111' },
      { path: '/envios-importaciones', label: 'Envíos e Importaciones', icon: Anchor, permission: 'CU142' },
      { path: '/caja-chica', label: 'Caja Chica', icon: Banknote, permission: 'CU149' },
    ],
  },
  {
    id: 'remuneraciones',
    label: 'Remuneraciones',
    icon: BriefcaseBusiness,
    items: [
      { path: '/empleados', label: 'Empleados', icon: BriefcaseBusiness, permission: 'CU155' },
      { path: '/esquemas-remuneracionales', label: 'Esquemas y Haberes', icon: WalletCards, permissions: ['CU162', 'CU163', 'CU164', 'CU165', 'CU166'] },
      { path: '/parametros-remuneraciones', label: 'Mantenedor de Parámetros', icon: Settings, permissions: ['CU167', 'CU168', 'CU169', 'CU170', 'CU171', 'CU246'] },
      { path: '/periodos-remuneracion', label: 'Períodos de Remuneración', icon: CalendarRange, permissions: ['CU178', 'CU181'] },
      { path: '/detalle-remuneracion', label: 'Detalle de Remuneración', icon: SearchCheck, permissions: ['CU172', 'CU173', 'CU174', 'CU175', 'CU176', 'CU177', 'CU179', 'CU180', 'CU182', 'CU183', 'CU184'] },
      { path: '/pagos-remuneraciones', label: 'Pagos de Remuneración', icon: Banknote, permissions: ['CU185', 'CU186', 'CU187', 'CU188', 'CU189', 'CU190'] },
      { path: '/documentos-remuneracion', label: 'Documentos de Remuneración', icon: FileSearch, permissions: ['CU191', 'CU192', 'CU193'] },
      { path: '/honorarios', label: 'Honorarios', icon: Receipt, permissions: ['CU196', 'CU197', 'CU198'] },
    ],
  },
  {
    id: 'terreno',
    label: 'Terreno',
    icon: MapPinned,
    items: [
      { path: '/terreno/visitas', label: 'Visitas y Servicios', icon: MapPinned, permissions: ['CU199', 'CU200', 'CU210', 'CU211'] },
      { path: '/terreno/mis-tareas', label: 'Mis Tareas', icon: ListTodo, permissions: ['CU201', 'CU208'] },
      { path: '/terreno/produccion', label: 'Producción', icon: ListTodo, permissions: ['CU207', 'CU209'] },
      { path: '/terreno/incidencias', label: 'Incidencias', icon: ListTodo, permissions: ['CU212', 'CU213'] },
    ],
  },
  {
    id: 'mantenedores',
    label: 'Mantenedores',
    icon: Settings,
    items: [
      { path: '/categorias-egreso', label: 'Categorías de Egreso', icon: Tags, permission: 'CU134' },
      { path: '/configuracion/umbral', label: 'Umbral por vencer', icon: Settings, permission: 'CU41' },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    icon: ShieldCheck,
    items: [
      { path: '/auditoria', label: 'Auditoría', icon: ScrollText, permission: 'CU355' },
      { path: '/usuarios', label: 'Usuarios y Accesos', icon: UserCog, permission: 'CU67' },
      { path: '/sesiones', label: 'Sesiones', icon: ShieldCheck, permission: 'CU73' },
      { path: '/cuenta/clave', label: 'Mi contraseña', icon: ShieldCheck },
    ],
  },
];

const routeIsActive = (pathname: string, path: string) =>
  pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));

const MenuLink: React.FC<{ item: MenuItem; pathname: string; child?: boolean; onNavigate?: () => void }> = ({
  item,
  pathname,
  child = false,
  onNavigate,
}) => {
  const Icon = item.icon;
  const isActive = routeIsActive(pathname, item.path);

  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${
        child ? 'ml-3 text-sm' : ''
      } ${
        isActive
          ? 'bg-primary-600/10 text-primary-500'
          : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 break-words">{item.label}</span>
    </Link>
  );
};

const MenuGroup: React.FC<MenuGroupProps> = ({ group, isOpen, pathname, onToggle, onNavigate }) => {
  const GroupIcon = group.icon;

  return (
    <section>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`menu-group-${group.id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-800/60 hover:text-white"
      >
        <GroupIcon className="h-5 w-5 shrink-0 text-gray-400" />
        <span className="min-w-0 flex-1 break-words">{group.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div id={`menu-group-${group.id}`} className="mt-1 space-y-1 border-l border-gray-800 pl-1">
          {group.items.map((item) => (
            <MenuLink key={item.path} item={item} pathname={pathname} child onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </section>
  );
};

const DashboardWrapper: React.FC = () => {
  const { sesion, actualizar } = usarSesion();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState({ open: false, pathname: location.pathname });
  const mobileMenuOpen = mobileMenu.open && mobileMenu.pathname === location.pathname;

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMobileMenu({ open: false, pathname: location.pathname });
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [location.pathname, mobileMenuOpen]);

  const canSee = (item: MenuItem) =>
    (!item.permission || Boolean(sesion?.permisos.includes(item.permission))) &&
    (!item.permissions || item.permissions.some((permiso) => sesion?.permisos.includes(permiso)));

  const visibleGroups = menuGroups
    .map((group) => ({ ...group, items: group.items.filter(canSee) }))
    .filter((group) => group.items.length > 0);

  const activeGroupId = visibleGroups.find((group) =>
    group.items.some((item) => routeIsActive(location.pathname, item.path)),
  )?.id;

  const [accordionState, setAccordionState] = useState<{
    pathname: string;
    openGroupId: string | null;
  }>(() => ({
    pathname: location.pathname,
    openGroupId: activeGroupId ?? null,
  }));

  const openGroupId =
    accordionState.pathname === location.pathname
      ? accordionState.openGroupId
      : (activeGroupId ?? null);

  const toggleGroup = (groupId: string) => {
    setAccordionState({
      pathname: location.pathname,
      openGroupId: openGroupId === groupId ? null : groupId,
    });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-md bg-primary-600 p-2 text-white"><ShieldCheck className="h-5 w-5" /></span>
          <span className="truncate font-bold text-gray-950">Finanzas PBlindadas</span>
        </div>
        <button
          type="button"
          aria-label="Abrir menú principal"
          aria-controls="sidebar-principal"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenu({ open: true, pathname: location.pathname })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {mobileMenuOpen && <button type="button" aria-label="Cerrar menú principal" onClick={() => setMobileMenu({ open: false, pathname: location.pathname })} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />}

      <aside
        id="sidebar-principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))] shrink-0 flex-col bg-[#111111] text-gray-300 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:h-screen lg:w-72 lg:translate-x-0 lg:shadow-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-gray-800 px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3 text-white">
            <div className="shrink-0 rounded-lg bg-primary-600 p-2">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <span className="min-w-0 truncate text-lg font-bold tracking-tight">Finanzas PBlindadas</span>
          </div>
          <button type="button" aria-label="Cerrar menú principal" onClick={() => setMobileMenu({ open: false, pathname: location.pathname })} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-gray-800 hover:text-white lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <nav
          aria-label="Navegación principal"
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 lg:py-6"
        >
          {canSee(dashboardItem) && <MenuLink item={dashboardItem} pathname={location.pathname} onNavigate={() => setMobileMenu({ open: false, pathname: location.pathname })} />}

          {visibleGroups.map((group) => (
            <MenuGroup
              key={group.id}
              group={group}
              isOpen={openGroupId === group.id}
              pathname={location.pathname}
              onToggle={() => toggleGroup(group.id)}
              onNavigate={() => setMobileMenu({ open: false, pathname: location.pathname })}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-gray-800 p-4 text-sm text-gray-500 lg:p-6">
          <p className="mb-1 break-words text-white">{sesion?.nombre}</p>
          <button
            type="button"
            className="mb-4 text-primary-500 hover:text-primary-400"
            onClick={async () => {
              await operar('/seguridad/salir', {});
              await actualizar();
            }}
          >
            Cerrar mi sesión
          </button>
          <div className="hidden lg:block"><p>Módulo Finanzas</p><p>© 2026 Puertas Blindadas</p><p>Producto desarrollado por MidasSupremacySPA</p></div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardWrapper;
