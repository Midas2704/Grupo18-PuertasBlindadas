import { ProveedorSesion, Protegido } from './seguridad/Sesion';
import { Acceso } from './views/Seguridad/Acceso';
import Usuarios from './views/Seguridad/Usuarios';
import Sesiones from './views/Seguridad/Sesiones';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DialogosSistema } from './components/DialogosSistema';

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
import CatalogoProveedores from './views/CatalogoProveedores/CatalogoProveedores';
import VerFichaProveedor from './views/VerFichaProveedor/VerFichaProveedor';
import OrdenesCompraServicios from './views/OrdenesCompraServicios/OrdenesCompraServicios';
import DocumentosProveedor from './views/DocumentosProveedor/DocumentosProveedor';
import CuentasPorPagar from './views/CuentasPorPagar/CuentasPorPagar';
import PagosProveedores from './views/PagosProveedores/PagosProveedores';
import CategoriasEgreso from './views/CategoriasEgreso/CategoriasEgreso';
import EnviosImportaciones from './views/EnviosImportaciones/EnviosImportaciones';
import CajaChica from './views/CajaChica/CajaChica';
import CatalogoEmpleados from './views/CatalogoEmpleados/CatalogoEmpleados';
import FichaEmpleado from './views/FichaEmpleado/FichaEmpleado';
import EsquemasRemuneracionales from './views/EsquemasRemuneracionales/EsquemasRemuneracionales';
import MantenedorParametros from './views/MantenedorParametros/MantenedorParametros';
import DetalleRemuneracion from './views/DetalleRemuneracion/DetalleRemuneracion';
import PeriodosRemuneracion from './views/PeriodosRemuneracion/PeriodosRemuneracion';
import RegistroPagosRemuneracion from './views/RegistroPagosRemuneracion/RegistroPagosRemuneracion';
import DetallePagoRemuneracion from './views/DetallePagoRemuneracion/DetallePagoRemuneracion';
import DocumentosRemuneracion from './views/DocumentosRemuneracion/DocumentosRemuneracion';
import Honorarios from './views/Honorarios/Honorarios';
import GestionTerreno from './views/GestionTerreno/GestionTerreno';
import MisTareasTerreno from './views/MisTareasTerreno/MisTareasTerreno';
import LevantamientoTecnico from './views/LevantamientoTecnico/LevantamientoTecnico';
import ProduccionTerreno from './views/ProduccionTerreno/ProduccionTerreno';
import IncidenciasTerreno from './views/IncidenciasTerreno/IncidenciasTerreno';
import PanelGeneralM7 from './views/DashboardM7/PanelGeneralM7';
import AnalisisVentasM7 from './views/DashboardM7/AnalisisVentasM7';
import CuentasCobrarM7 from './views/DashboardM7/CuentasCobrarM7';
import CuentasPagarM7 from './views/DashboardM7/CuentasPagarM7';
import LiquidezM7 from './views/DashboardM7/LiquidezM7';
import MargenProyectosM7 from './views/DashboardM7/MargenProyectosM7';
import ResumenesM7 from './views/DashboardM7/ResumenesM7';
import CentroAtencionM7 from './views/DashboardM7/CentroAtencionM7';
import CotizacionesPendientesM7 from './views/DashboardM7/CotizacionesPendientesM7';
import ContextoClienteM7 from './views/DashboardM7/ContextoClienteM7';
import RiesgoDeficitM7 from './views/DashboardM7/RiesgoDeficitM7';
import ExposicionProyectosM7 from './views/DashboardM7/ExposicionProyectosM7';
import ContextoProyectoM7 from './views/DashboardM7/ContextoProyectoM7';
import OperacionCostosM7 from './views/DashboardM7/OperacionCostosM7';
import DeltaControladoM7 from './views/DashboardM7/DeltaControladoM7';
import SolicitudesCredito from './views/Credito/SolicitudesCredito';
import Auditoria from './views/Auditoria/Auditoria';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <DialogosSistema />
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
          <Route path="proveedores" element={<Protegido permiso="CU80"><CatalogoProveedores /></Protegido>} />
          <Route path="proveedores/:id" element={<Protegido permiso="CU84"><VerFichaProveedor /></Protegido>} />
          <Route path="ordenes-compra-servicios" element={<Protegido permiso="CU88"><OrdenesCompraServicios /></Protegido>} />
          <Route path="documentos-proveedor" element={<Protegido permiso="CU95"><DocumentosProveedor /></Protegido>} />
          <Route path="cuentas-por-pagar" element={<Protegido permiso="CU106"><CuentasPorPagar /></Protegido>} />
          <Route path="pagos-proveedores" element={<Protegido permiso="CU111"><PagosProveedores /></Protegido>} />
          <Route path="categorias-egreso" element={<Protegido permiso="CU134"><CategoriasEgreso /></Protegido>} />
          <Route path="envios-importaciones" element={<Protegido permiso="CU142"><EnviosImportaciones /></Protegido>} />
          <Route path="caja-chica" element={<Protegido permiso="CU149"><CajaChica /></Protegido>} />
          <Route path="empleados" element={<Protegido permiso="CU155"><CatalogoEmpleados /></Protegido>} />
          <Route path="empleados/:id" element={<Protegido permiso="CU155"><FichaEmpleado /></Protegido>} />
          <Route path="esquemas-remuneracionales" element={<Protegido permiso={['CU162','CU163','CU164','CU165','CU166']}><EsquemasRemuneracionales /></Protegido>} />
          <Route path="parametros-remuneraciones" element={<Protegido permiso={['CU167','CU168','CU169','CU170','CU171','CU246']}><MantenedorParametros /></Protegido>} />
          <Route path="periodos-remuneracion" element={<Protegido permiso={['CU178','CU181']}><PeriodosRemuneracion /></Protegido>} />
          <Route path="detalle-remuneracion" element={<Protegido permiso={['CU172','CU173','CU174','CU175','CU176','CU177','CU179','CU180','CU182','CU183','CU184']}><DetalleRemuneracion /></Protegido>} />
          <Route path="pagos-remuneraciones" element={<Protegido permiso={['CU185','CU186','CU187','CU188','CU189','CU190']}><RegistroPagosRemuneracion /></Protegido>} />
          <Route path="pagos-remuneraciones/:id" element={<Protegido permiso={['CU188','CU189','CU190']}><DetallePagoRemuneracion /></Protegido>} />
          <Route path="documentos-remuneracion" element={<Protegido permiso={['CU191','CU192','CU193']}><DocumentosRemuneracion /></Protegido>} />
          <Route path="honorarios" element={<Protegido permiso={['CU196','CU197','CU198']}><Honorarios /></Protegido>} />
          <Route path="terreno/visitas" element={<Protegido permiso={['CU199','CU200','CU210','CU211']}><GestionTerreno /></Protegido>} />
          <Route path="terreno/mis-tareas" element={<Protegido permiso={['CU201','CU208']}><MisTareasTerreno /></Protegido>} />
          <Route path="terreno/produccion" element={<Protegido permiso={['CU207','CU209']}><ProduccionTerreno /></Protegido>} />
          <Route path="terreno/incidencias" element={<Protegido permiso={['CU212','CU213']}><IncidenciasTerreno /></Protegido>} />
          <Route path="terreno/tareas/:id/levantamiento" element={<Protegido permiso={['CU202','CU203','CU204','CU205','CU206']}><LevantamientoTecnico /></Protegido>} />
          <Route path="dashboard-m7" element={<Protegido permiso="CU215"><PanelGeneralM7 /></Protegido>} />
          <Route path="dashboard-m7/centro-atencion" element={<Protegido permiso="CU216"><CentroAtencionM7 /></Protegido>} />
          <Route path="dashboard-m7/cotizaciones-pendientes" element={<Protegido permiso="CU217"><CotizacionesPendientesM7 /></Protegido>} />
          <Route path="dashboard-m7/clientes/:id" element={<Protegido permiso="CU221"><ContextoClienteM7 /></Protegido>} />
          <Route path="dashboard-m7/ventas" element={<Protegido permiso={['CU218','CU219','CU220']}><AnalisisVentasM7 /></Protegido>} />
          <Route path="dashboard-m7/cuentas-cobrar" element={<Protegido permiso={['CU222','CU223','CU224','CU225']}><CuentasCobrarM7 /></Protegido>} />
          <Route path="dashboard-m7/cuentas-pagar" element={<Protegido permiso={['CU226','CU227']}><CuentasPagarM7 /></Protegido>} />
          <Route path="dashboard-m7/liquidez" element={<Protegido permiso={['CU228','CU229','CU230','CU231']}><LiquidezM7 /></Protegido>} />
          <Route path="dashboard-m7/riesgo-deficit" element={<Protegido permiso="CU232"><RiesgoDeficitM7 /></Protegido>} />
          <Route path="dashboard-m7/margen-proyectos" element={<Protegido permiso={['CU233','CU234','CU235']}><MargenProyectosM7 /></Protegido>} />
          <Route path="dashboard-m7/proyectos/exposicion" element={<Protegido permiso="CU236"><ExposicionProyectosM7 /></Protegido>} />
          <Route path="dashboard-m7/proyectos/:id" element={<Protegido permiso="CU237"><ContextoProyectoM7 /></Protegido>} />
          <Route path="dashboard-m7/resumenes" element={<Protegido permiso={['CU238','CU239']}><ResumenesM7 /></Protegido>} />
          <Route path="dashboard-m7/operacion" element={<Protegido permiso={['CU242','CU247','CU248','CU250','CU252','CU253']}><OperacionCostosM7 /></Protegido>} />
          <Route path="dashboard-m7/control" element={<Protegido permiso={['CU228','CU232','CU240','CU241','CU243','CU244','CU249','CU251','CU254','CU255','CU256','CU257','CU258']}><DeltaControladoM7 /></Protegido>} />
          <Route path="credito" element={<Protegido permiso="CU259"><SolicitudesCredito /></Protegido>} />
          <Route path="credito/solicitudes" element={<Protegido permiso="CU259"><SolicitudesCredito /></Protegido>} />
          <Route path="credito/solicitudes/:id" element={<Protegido permiso="CU259"><SolicitudesCredito /></Protegido>} />
          <Route path="auditoria" element={<Protegido permiso="CU355"><Auditoria /></Protegido>} />
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
