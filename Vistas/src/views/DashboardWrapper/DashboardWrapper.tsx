import { usarSesion, operar } from '../../seguridad/Sesion';
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileSignature, Receipt, ShieldCheck, CheckSquare } from 'lucide-react';

const DashboardWrapper: React.FC = () => {
  const {sesion,actualizar}=usarSesion();
  const permisosRuta:Record<string,string>={'/':'CU05','/clientes':'CU05','/cotizacion/nueva':'CU19','/venta/directa':'CU27','/aprobaciones':'CU20','/pagos':'CU42','/usuarios':'CU67','/sesiones':'CU73','/configuracion/umbral':'CU41'};
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/clientes', label: 'Catálogo de Clientes', icon: <Users className="w-5 h-5" /> },
    { path: '/cotizacion/nueva', label: 'Armar Cotización', icon: <FileSignature className="w-5 h-5" /> },
    { path: '/venta/directa', label: 'Nueva Venta Directa', icon: <Receipt className="w-5 h-5" /> },
    { path: '/pagos', label: 'Pagos y Recaudación', icon: <Receipt className="w-5 h-5" /> },
    { path: '/configuracion/umbral', label: 'Mantenedor', icon: <CheckSquare className="w-5 h-5" /> },
    { path: '/aprobaciones', label: 'Gestión', icon: <CheckSquare className="w-5 h-5" /> },
    { path: '/usuarios', label: 'Usuarios y Accesos', icon: <Users className="w-5 h-5" /> },
    { path: '/sesiones', label: 'Sesiones', icon: <ShieldCheck className="w-5 h-5" /> },
    { path: '/cuenta/clave', label: 'Mi contraseña', icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Sidebar: navegación persistente, sin sorpresas */}
      <aside className="flex w-full flex-shrink-0 flex-col bg-[#111111] text-gray-300 lg:w-72">
        <div className="h-20 flex items-center px-6 border-b border-gray-800">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-primary-600 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Finanzas PBlindadas</span>
          </div>
        </div>

        <nav className="flex flex-1 gap-2 overflow-x-auto px-4 py-3 lg:block lg:space-y-2 lg:overflow-visible lg:py-6">
          {menuItems.filter(item=>!permisosRuta[item.path] || sesion?.permisos.includes(permisosRuta[item.path]!)).map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${
                  isActive 
                    ? 'bg-primary-600/10 text-primary-500' 
                    : 'hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-gray-800 p-6 text-sm text-gray-500 lg:block">
          <p className="text-white mb-1">{sesion?.nombre}</p>
          <button className="text-primary-500 mb-4" onClick={async()=>{await operar('/seguridad/salir',{});await actualizar();}}>Cerrar mi sesión</button><br/>
          Módulo Finanzas <br />
          © 2026 Puertas Blindadas
          Producto desarrollado por MidasSupremacySPA
        </div>
      </aside>

      {/* El contenido cambia, la carcasa queda quieta */}
      <main className="min-w-0 flex-1 lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardWrapper;
