import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { M4Controller, ActorAutenticado } from './M4Controller';
import { M1Controller } from './M1Controller';
import { M2Controller } from './M2Controller';
import { M3Controller } from './M3Controller';
import { Autorizacion, ContextoAutorizacion } from '../validaciones/autorizacion';
import { identificador, texto, validarFiltros } from '../validaciones/solicitudes';

export type Operacion = 'salud' | 'listarClientes' | 'abrirFicha' | 'dashboard' | 'crearCliente' | 'actualizarCliente' | 'desactivarCliente' | 'reactivarCliente' | 'inventario' | 'productos' | 'monedas'
  | 'bandeja' | 'historial' | 'guardarCotizacion' | 'crearVentaDirecta' | 'anularVenta' | 'registrarDocumento'
  | 'descartarBorrador' | 'aprobarCotizacion' | 'aprobarVenta' | 'editarCotizacion' | 'tipoCambio'
  | 'consultarPago' | 'consultarSaldo' | 'catalogosPago'
  | 'consolidarB2C' | 'aprobarCotizacionB2B' | 'registrarClienteDesdeCotizacion' | 'emitirCotizacion' | 'reactivarCotizacion' | 'formalizarClienteB2C' | 'configurarEtapasCobro' | 'revertirVenta' | 'registrarPago' | 'contextoPago' | 'anularPago' | 'revertirPago' | 'aplicarSaldoFavor' | 'consultarMorosidad' | 'generarComprobante' | 'conciliarPago' | 'modificarGuia' | 'definirCondicionesCobro' | 'configurarUmbral' | 'consultarUmbral'
  | 'iniciarSesion' | 'solicitarRecuperacion' | 'recuperarClave' | 'validarRecuperacion' | 'miSesion' | 'cambiarClave' | 'cerrarSesion'
  | 'usuarios' | 'catalogosUsuarios' | 'registrarUsuario' | 'desactivarUsuario' | 'reactivarUsuario' | 'cambiarConfiguracion'
  | 'asignarPermisos' | 'retirarPermisos' | 'asignarAdministrador' | 'retirarAdministrador' | 'restablecerClave' | 'desbloquearUsuario' | 'consultarSesiones' | 'cerrarSesionAdministrativa';
export interface SolicitudFinanzas {
  consulta?: Record<string, unknown>;
  parametros?: Record<string, unknown>;
  cuerpo?: Record<string, unknown>;
  contexto: ContextoAutorizacion;
}

/** Único punto de entrada desde las Vistas. La coordinación siempre se realiza aquí. */
// Midas dejó esta puerta única por algo: acá se decide el camino y nada más.
export class C_Finanzas {
  constructor(
    private readonly autorizacion?: Autorizacion,
    private readonly m1 = new M1Controller(),
    private readonly m2 = new M2Controller(),
    private readonly m3 = new M3Controller(),
    private readonly m4 = new M4Controller(),
  ) {}
  async ejecutar(operacion: Operacion, solicitud: SolicitudFinanzas) {
    // CU68/CU70 no exigen sesión previa. Cada comando protegido representa una confirmación de CU.
    // esta lista parece repetida, pero evita que un permiso se cuele por accidente
    if (operacion === 'iniciarSesion') return this.m4.iniciarSesion(solicitud.cuerpo || {}, solicitud.contexto);
    if (operacion === 'solicitarRecuperacion') return this.m4.solicitarRecuperacion(solicitud.cuerpo || {});
    if (operacion === 'validarRecuperacion') return this.m4.validarRecuperacion(solicitud.cuerpo || {});
    if (operacion === 'recuperarClave') return this.m4.recuperarClave(solicitud.cuerpo || {});
    if (operacion === 'salud') return {status:'ok', arquitectura:'C_Finanzas → M1/M2/M3/M4 → Prisma → PostgreSQL'};
    const adicionales:string[]=[];
    if(operacion==='listarClientes') {
      if(solicitud.consulta?.busqueda || solicitud.consulta?.search) adicionales.push('CU06');
      if(solicitud.consulta?.estado && solicitud.consulta.estado!=='activos') adicionales.push('CU07');
      if(solicitud.consulta?.deuda==='true' || solicitud.consulta?.morosos==='true') adicionales.push('CU08');
    }
    const actor = (this.autorizacion ? await this.autorizacion.autorizar(operacion, solicitud.contexto) : await this.m4.autorizar(operacion, solicitud.contexto,adicionales)) as ActorAutenticado;
    // Sólo inyección explícita en pruebas. La ejecución normal siempre usa M4.
    // TODO: dejar documentado el adaptador de pruebas cuando cerremos la integración

    if (actor && ((operacion==='guardarCotizacion' && Number(solicitud.cuerpo?.descuento_valor)>0 && !actor.permisos.includes('CU31')) || (operacion==='crearVentaDirecta' && Number((solicitud.cuerpo?.descuento as {valor?:number})?.valor)>0 && !actor.permisos.includes('CU33')))) throw new ErrorAplicacion(403,'No tienes permiso para aplicar descuentos');
    const productosConCostoAjustado = Array.isArray(solicitud.cuerpo?.productos) && (solicitud.cuerpo.productos as Array<{ materiales?: Array<Record<string, unknown>> }>).some(producto => Array.isArray(producto.materiales) && producto.materiales.some(material => material.costo_ajustado !== undefined));
    if (operacion === 'editarCotizacion' && (solicitud.cuerpo?.precio_sugerido !== undefined || productosConCostoAjustado || Array.isArray(solicitud.cuerpo?.materiales) && (solicitud.cuerpo?.materiales as Array<Record<string, unknown>>).some(m => m.costo_ajustado !== undefined || m.precio !== undefined)) && actor.configuracion !== 'gerencia' && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia puede ajustar costos o precio sugerido');
    const parametros = solicitud.parametros || {};
    const cuerpo = solicitud.cuerpo || {};
    switch (operacion) {
      case 'miSesion': return {...actor, id:actor.id.toString(), sesion:undefined};
      case 'crearCliente': return this.m1.crearCliente(cuerpo);
      case 'actualizarCliente': return this.m1.actualizarCliente(identificador(parametros.id), cuerpo);
      case 'desactivarCliente': return this.m1.cambiarEstadoCliente(identificador(parametros.id), 'inactivo', cuerpo.confirmado === true);
      case 'reactivarCliente': return this.m1.cambiarEstadoCliente(identificador(parametros.id), 'activo', cuerpo.confirmado === true);
      case 'cerrarSesion': return this.m4.cerrarSesion(actor);
      case 'cambiarClave': return this.m4.cambiarClave(actor,cuerpo);
      case 'usuarios': return this.m4.usuarios();
      case 'catalogosUsuarios': return this.m4.catalogosUsuarios();
      case 'registrarUsuario': return this.m4.registrarUsuario(actor,cuerpo);
      case 'consultarSesiones': return this.m4.consultarSesiones(actor);
      case 'cerrarSesionAdministrativa': return this.m4.cerrarSesionAdministrativa(actor,cuerpo);
      case 'desactivarUsuario': case 'reactivarUsuario': case 'cambiarConfiguracion': case 'asignarPermisos': case 'retirarPermisos':
      case 'asignarAdministrador': case 'retirarAdministrador': case 'restablecerClave': case 'desbloquearUsuario':
        return this.m4.modificarUsuario(operacion,actor,cuerpo);
      case 'listarClientes': return this.m1.listarClientes(validarFiltros(solicitud.consulta || {}));
      case 'abrirFicha': return this.m1.abrirFicha(texto(parametros.referencia, 80), solicitud.consulta || {});
      case 'dashboard': {
        const [clientesActivos, resumen] = await Promise.all([this.m1.contarClientesActivos(), this.m2.consultarResumen()]);
        return { clientesActivos, ...resumen };
      }
      case 'inventario': return this.m2.listarInventario();
      case 'productos': return this.m2.listarProductos();
      case 'monedas': return this.m2.listarMonedas();
      case 'bandeja': return this.m2.consultarBandeja();
      case 'historial': return this.m2.consultarBandeja(true);
      case 'consolidarB2C': return this.m2.consolidarB2C(identificador(parametros.id),cuerpo,actor.id.toString());
      case 'aprobarCotizacionB2B': return this.m2.aprobarCotizacionB2B(identificador(parametros.id), cuerpo);
      case 'aprobarCotizacion': return cuerpo.folioOrdenCompra ? this.m2.aprobarCotizacionB2B(identificador(parametros.id), cuerpo) : this.m2.operacionPendiente(operacion);
      case 'registrarClienteDesdeCotizacion': return this.m2.registrarClienteDesdeCotizacion(cuerpo);
      case 'emitirCotizacion': return this.m2.emitirCotizacion(identificador(parametros.id));
      case 'reactivarCotizacion': return this.m2.reactivarCotizacion(identificador(parametros.id), cuerpo);
      case 'formalizarClienteB2C': return this.m2.formalizarClienteB2C(cuerpo);
      case 'configurarEtapasCobro': return this.m2.configurarEtapasCobro(identificador(parametros.id), cuerpo);
      case 'modificarGuia': return this.m2.modificarGuia(identificador(parametros.id), cuerpo);
      case 'definirCondicionesCobro': return this.m2.definirCondicionesCobro(identificador(parametros.id), cuerpo);
      case 'configurarUmbral': return this.m2.configurarUmbral(cuerpo);
      case 'consultarUmbral': return this.m2.consultarUmbral();
      case 'registrarPago': return this.m3.registrarPago(cuerpo,actor.id.toString());
      case 'tipoCambio': return this.m3.consultarTipoCambio(texto(parametros.currency, 10));
      case 'contextoPago': return this.m3.contextoPago(identificador(parametros.idFicha));
      case 'anularPago': return this.m3.anularPago(identificador(parametros.id), cuerpo, actor.id.toString());
      case 'revertirPago': return this.m3.revertirPago(identificador(parametros.id), cuerpo, actor.id.toString());
      case 'aplicarSaldoFavor': return this.m3.aplicarSaldoFavor(identificador(parametros.id), cuerpo, actor.id.toString());
      case 'consultarMorosidad': return this.m3.consultarMorosidad(identificador(parametros.id));
      case 'generarComprobante': return this.m3.generarComprobante(identificador(parametros.id));
      case 'conciliarPago': return this.m3.conciliarPago(identificador(parametros.id), cuerpo, actor.id.toString());
      case 'revertirVenta': return this.m2.enTransaccion(async tx=>{
        const reversion=await this.m2.registrarReversion(tx,identificador(parametros.id),cuerpo,actor.id.toString());
        return this.m3.procesarExcedente(tx,reversion.id_nota_venta,reversion.id_reversion_nota_venta,cuerpo);
      });
      case 'guardarCotizacion': return this.m2.guardarCotizacion(cuerpo);
      case 'editarCotizacion': return this.m2.editarCotizacion(identificador(parametros.id), cuerpo);
      case 'crearVentaDirecta': return this.m2.crearVentaDirecta(cuerpo);
      case 'anularVenta': return this.m2.anularVenta(identificador(parametros.id), cuerpo);
      case 'registrarDocumento': return this.m2.registrarDocumento(cuerpo);
      case 'descartarBorrador': return this.m2.descartarBorrador(identificador(parametros.id));
      case 'consultarPago': return this.m3.consultarPago(identificador(parametros.id));
      case 'consultarSaldo': return this.m3.consultarSaldo(identificador(parametros.id));
      case 'catalogosPago': return this.m3.consultarCatalogos(solicitud.consulta?.idFicha?identificador(solicitud.consulta.idFicha):undefined);
      default: return this.m2.operacionPendiente(operacion);
    }
  }
}
