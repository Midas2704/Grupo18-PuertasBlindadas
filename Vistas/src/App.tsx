import { ProveedorSesion, Protegido } from './seguridad/Sesion';
import { Acceso } from './views/Seguridad/Acceso';
import Usuarios from './views/Seguridad/Usuarios';
import Sesiones from './views/Seguridad/Sesiones';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Layout; acá se decide la carcasa y el resto sólo pinta su vista
import DashboardWrapper from './views/DashboardWrapper/DashboardWrapper';

// Views, sin lógica de negocio escondida en el router
import DashboardPrincipal from './views/DashboardPrincipal/DashboardPrincipal';
import CatalogoClientes from './views/CatalogoClientes/CatalogoClientes';
import VerFicha from './views/VerFicha/VerFicha';
import ArmarCotizacion from './views/ArmarCotizacion/ArmarCotizacion';
import NotaDeVentaDirecta from './views/NotaDeVentaDirecta/NotaDeVentaDirecta';
import BandejaAprobacionGerencia from './views/BandejaAprobacion/BandejaAprobacionGerencia';
import PagosCliente from './views/Pagos/PagosCliente';
import UmbralPorVencer from './views/Configuracion/UmbralPorVencer';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ProveedorSesion><Routes>
        <Route path="/login" element={<Acceso modo="login"/>}/>
        <Route path="/recuperar" element={<Acceso modo="recuperar"/>}/>
        <Route path="/" element={<Protegido><DashboardWrapper /></Protegido>}>
          <Route path="usuarios" element={<Protegido permiso="CU67"><Usuarios/></Protegido>}/>
          <Route path="sesiones" element={<Protegido permiso="CU73"><Sesiones/></Protegido>}/>
          <Route path="cuenta/clave" element={<Acceso modo="clave"/>}/>
          <Route index element={<Protegido permiso="CU05"><DashboardPrincipal /></Protegido>} />
          <Route path="clientes" element={<Protegido permiso="CU05"><CatalogoClientes /></Protegido>} />
          <Route path="clientes/:rut" element={<Protegido permiso="CU09"><VerFicha /></Protegido>} />
          <Route path="cotizacion/nueva" element={<Protegido permiso={new URLSearchParams(window.location.search).has('borrador') ? 'CU20' : 'CU19'}><ArmarCotizacion /></Protegido>} />
          <Route path="venta/directa" element={<Protegido permiso="CU27"><NotaDeVentaDirecta /></Protegido>} />
          <Route path="aprobaciones" element={<Protegido permiso="CU20"><BandejaAprobacionGerencia /></Protegido>} />
          <Route path="pagos" element={<Protegido permiso="CU42"><PagosCliente /></Protegido>} />
          <Route path="configuracion/umbral" element={<Protegido permiso="CU41"><UmbralPorVencer /></Protegido>} />
        </Route>
      </Routes></ProveedorSesion>
    </BrowserRouter>
  );
};

export default App;
