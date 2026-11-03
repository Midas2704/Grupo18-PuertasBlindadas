import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { M4Controller, ActorAutenticado } from './M4Controller';
import { M1Controller } from './M1Controller';
import { M2Controller } from './M2Controller';
import { M3Controller } from './M3Controller';
import { M5Controller } from './M5Controller';
import { M6Controller } from './M6Controller';
import { M7Controller } from './M7Controller';
import { M8Controller } from './M8Controller';
import { M9Controller } from './M9Controller';
import { AdaptadorCreditoM8ParaM7 } from '../servicios/AdaptadorCreditoM8ParaM7';
import { ProductorAuditoriaM9 } from '../m9/contratoProductor';
import { navegacionOwner, scopeM9DesdeActor } from '../m9/autorizacion';
import type { FiltrosM9 } from '../m9/tipos';
import { Autorizacion, ContextoAutorizacion } from '../validaciones/autorizacion';
import { identificador, texto, validarFiltros } from '../validaciones/solicitudes';

const normalizarFiltrosHttpM9 = (consulta?: Record<string, unknown>): FiltrosM9 => {
  const filtros = { ...(consulta || {}) };
  for (const campo of ['pagina', 'tamano'] as const) {
    const valor = filtros[campo];
    if (typeof valor === 'string' && valor.trim() !== '') filtros[campo] = Number(valor);
  }
  return filtros as FiltrosM9;
};

export type Operacion = 'salud' | 'listarClientes' | 'abrirFicha' | 'dashboard' | 'crearCliente' | 'actualizarCliente' | 'desactivarCliente' | 'reactivarCliente' | 'inventario' | 'productos' | 'monedas'
  | 'bandeja' | 'historial' | 'guardarCotizacion' | 'crearVentaDirecta' | 'anularVenta' | 'registrarDocumento'
  | 'descartarBorrador' | 'aprobarCotizacion' | 'aprobarVenta' | 'editarCotizacion' | 'tipoCambio'
  | 'consultarPago' | 'consultarSaldo' | 'catalogosPago'
  | 'consolidarB2C' | 'aprobarCotizacionB2B' | 'registrarClienteDesdeCotizacion' | 'emitirCotizacion' | 'reactivarCotizacion' | 'formalizarClienteB2C' | 'configurarEtapasCobro' | 'revertirVenta' | 'registrarPago' | 'contextoPago' | 'anularPago' | 'revertirPago' | 'aplicarSaldoFavor' | 'consultarMorosidad' | 'generarComprobante' | 'conciliarPago' | 'modificarGuia' | 'definirCondicionesCobro' | 'configurarUmbral' | 'consultarUmbral'
  | 'iniciarSesion' | 'solicitarRecuperacion' | 'recuperarClave' | 'validarRecuperacion' | 'miSesion' | 'cambiarClave' | 'cerrarSesion'
  | 'usuarios' | 'catalogosUsuarios' | 'registrarUsuario' | 'desactivarUsuario' | 'reactivarUsuario' | 'cambiarConfiguracion'
  | 'asignarPermisos' | 'retirarPermisos' | 'asignarAdministrador' | 'retirarAdministrador' | 'restablecerClave' | 'desbloquearUsuario' | 'consultarSesiones' | 'cerrarSesionAdministrativa'
  | 'crearProveedor' | 'actualizarProveedor' | 'corregirIdentidadProveedor' | 'desactivarProveedor' | 'reactivarProveedor' | 'listarProveedores' | 'abrirFichaProveedor' | 'catalogosProveedores'
  | 'actualizarCondicionPagoProveedor' | 'listarOrdenesCompraServicios' | 'obtenerOrdenCompraServicio' | 'crearOrdenCompraServicio' | 'modificarOrdenCompraServicio'
  | 'prepararAjusteOrdenCompraServicio' | 'confirmarAjusteOrdenCompraServicio' | 'anularOrdenCompraServicio' | 'cerrarOrdenCompraServicio' | 'reabrirOrdenCompraServicio'
  | 'listarDocumentosProveedor' | 'obtenerDocumentoProveedor' | 'catalogosDocumentosProveedor'
  | 'registrarDocumentoPreliminar' | 'registrarDocumentoDefinitivo' | 'asociarDocumentoOrdenes' | 'resolverDiferenciaDocumento' | 'resolverExcedenteDocumento'
  | 'determinarVencimientoDocumento' | 'clasificarDocumento' | 'prepararImputacionDocumento' | 'confirmarImputacionDocumento' | 'registrarTipoCambioManual' | 'generarObligacionDocumento'
  | 'listarCuentasPorPagar' | 'consultarUmbralProveedores' | 'configurarUmbralProveedores'
  | 'buscarProveedoresPago' | 'catalogosPagosProveedores' | 'crearOperacionPago' | 'listarBorradoresPago' | 'obtenerOperacionPago'
  | 'agregarMovimientoPago' | 'actualizarMovimientoPago' | 'adjuntarRespaldoPago' | 'registrarTipoCambioManualPago'
  | 'prepararOperacionPago' | 'guardarBorradorPago' | 'retomarOperacionPago' | 'descartarOperacionPago' | 'confirmarOperacionPago'
  | 'listarPagosConfirmados' | 'consultarDetallePagoProveedor' | 'anularMovimientoPago' | 'anularOperacionPago' | 'revertirMovimientoPago' | 'conciliarMovimientoPago'
  | 'reemplazarRespaldoPago' | 'registrarNotaCredito' | 'registrarNotaDebito' | 'anularAjusteObligacion' | 'consultarSaldosFavorProveedor'
  | 'proponerCompensacion' | 'confirmarCompensacion' | 'listarCompensaciones' | 'revertirCompensacion' | 'listarCategoriasEgreso' | 'crearCategoriaEgreso' | 'actualizarCategoriaEgreso' | 'activarCategoriaEgreso' | 'desactivarCategoriaEgreso'
  | 'solicitarReclasificacion' | 'listarReclasificaciones' | 'aprobarReclasificacion' | 'rechazarReclasificacion' | 'consultarUmbralReclasificacion' | 'configurarUmbralReclasificacion'
  | 'corregirOrdenTrabajoImputacion' | 'solicitarReasignacionCosto' | 'listarReasignacionesCosto' | 'aprobarReasignacionCosto' | 'rechazarReasignacionCosto'
  | 'registrarComisionBancaria' | 'listarEnviosImportaciones' | 'obtenerEnvioImportacion' | 'crearEnvioImportacion' | 'asociarOrdenEnvio' | 'registrarCostoEnvio' | 'actualizarCostoEnvio'
  | 'pasarEnvioRevision' | 'cerrarFinancieramenteEnvio' | 'reabrirEnvio' | 'consultarCajaChica' | 'obtenerGastoCajaChica' | 'configurarFondoCajaChica' | 'registrarGastoCajaChica' | 'adjuntarRespaldoCajaChica' | 'aprobarGastoCajaChica' | 'rechazarGastoCajaChica'
  | 'listarEmpleados' | 'obtenerEmpleado' | 'crearEmpleado' | 'actualizarDatosBaseEmpleado' | 'catalogosLaborales' | 'listarRelacionesLaborales' | 'crearRelacionLaboral' | 'actualizarRelacionLaboral'
  | 'catalogosRemuneracionales' | 'obtenerPerfilRemuneracional' | 'actualizarPerfilRemuneracional' | 'obtenerHistorialRemuneracionalEmpleado'
  | 'catalogosAsignacionEsquemas' | 'listarAsignacionesEsquemaEmpleado' | 'asignarEsquemaEmpleado' | 'finalizarAsignacionEsquemaEmpleado'
  | 'catalogoHaberes' | 'listarAsignacionesHaberEmpleado' | 'asignarHaberEmpleado' | 'finalizarAsignacionHaberEmpleado'
  | 'obtenerConfiguracionDocumental' | 'actualizarConfiguracionDocumental'
  | 'listarEsquemas' | 'catalogoCargosEsquemas' | 'crearEsquema' | 'actualizarEsquema' | 'asignarEsquemaCargo'
  | 'listarTarifasEsquema' | 'crearTarifaEsquema' | 'revisarTarifaEsquema'
  | 'listarHaberes' | 'crearHaber' | 'actualizarHaber' | 'crearConfiguracionHaber' | 'resolverConfiguracionHaber'
  | 'listarParametrosRemuneracionales' | 'crearParametroRemuneracional' | 'actualizarParametroRemuneracional' | 'resolverParametroRemuneracional' | 'listarTramosImpuestoRenta' | 'crearTramoImpuestoRenta'
  | 'listarConceptosDeduccionAporte' | 'crearConceptoDeduccionAporte' | 'actualizarConceptoDeduccionAporte'
  | 'listarConfiguracionProrrateo' | 'crearConfiguracionProrrateo'
  | 'listarPoliticasConservacion' | 'crearPoliticaConservacion'
  | 'listarMediosPagoM6' | 'crearMedioPagoM6' | 'actualizarMedioPagoM6'
  | 'listarHechosRemunerables' | 'obtenerHechoRemunerable' | 'revisarHechoRemunerable' | 'listarRetrabajosPendientes' | 'resolverRetrabajo'
  | 'obtenerOCrearContextoRemuneracion' | 'obtenerRemuneracion' | 'proponerComponenteExcepcional' | 'resolverComponenteExcepcional'
  | 'proponerVariableRemuneracion' | 'resolverVariableRemuneracion' | 'registrarValorExterno' | 'proponerAjusteManual' | 'resolverValorOAjuste'
  | 'obtenerContextoProrrateo' | 'proponerProrrateoIndividual' | 'resolverProrrateoIndividual'
  | 'consultarPeriodoRemuneracion' | 'calcularRemuneracion' | 'cerrarRemuneracion' | 'obtenerLiquidacionRemuneracion'
  | 'cerrarPeriodoRemuneracion' | 'solicitarReaperturaRemuneracion' | 'aprobarReaperturaRemuneracion'
  | 'crearAjustePosterior' | 'obtenerAjustePosterior' | 'postergarAjustePosterior'
  | 'crearRegularizacionExtraordinaria' | 'obtenerRegularizacion' | 'actualizarRegularizacion' | 'cerrarRegularizacion'
  | 'registrarAnticipo' | 'obtenerAnticipo' | 'prepararPagoAnticipo' | 'actualizarPagoAnticipo' | 'confirmarPagoAnticipo'
  | 'listarPagosRemuneracion' | 'obtenerPagoRemuneracion' | 'prepararPagoFinal' | 'actualizarPagoFinal' | 'confirmarPagoFinal'
  | 'listarBoletasHonorariosConfirmadas' | 'prepararPagoHonorarios' | 'actualizarPagoHonorarios' | 'confirmarPagoHonorarios'
  | 'listarPrestadoresHonorarios' | 'crearPrestadorHonorarios' | 'listarBoletasHonorarios' | 'obtenerBoletaHonorarios' | 'crearBoletaHonorarios' | 'actualizarBoletaHonorarios'
  | 'previsualizarConfirmacionBoletaHonorarios' | 'confirmarBoletaHonorarios' | 'consultarRetencionesHonorariosMensuales'
  | 'obtenerDetallePagoRemuneracion' | 'anularPagoRemuneracion' | 'registrarReversionPagoRemuneracion'
  | 'listarDocumentosRemuneracion' | 'descargarDocumentoRemuneracion' | 'reenviarDocumentoRemuneracion'
  | 'registrarEntregaDocumento' | 'consultarEntregaDocumento' | 'exportarCalculoPreliminar' | 'exportarRemuneracionesOficiales'
  | 'crearVisitaTerreno' | 'listarObrasTerreno' | 'listarVisitasTerreno' | 'obtenerVisitaTerreno' | 'listarUsuariosTerreno' | 'asignarResponsableVisita' | 'listarMisTareasTerreno'
  | 'obtenerLevantamientoTerreno' | 'guardarLevantamientoTerreno' | 'corregirLevantamientoTerreno' | 'generarOrdenTrabajoLevantamiento'
  | 'ajustarOrdenTrabajoTerreno' | 'liberarOrdenTrabajoTerreno' | 'generarTareasProduccion'
  | 'listarTareasProduccion' | 'asignarTareaProduccion' | 'registrarEjecucionTarea'
  | 'listarEjecucionesPendientes' | 'validarEjecucionProductiva' | 'obtenerPreparacionSalida' | 'actualizarChecklistSalida'
  | 'registrarResultadoVisita' | 'registrarIncidenciaRetrabajo' | 'listarIncidenciasOperativas' | 'actualizarIncidenciaOperativa'
  | 'catalogoDeduccionesEmpleado' | 'listarDeduccionesEmpleado' | 'asignarDeduccionEmpleado' | 'finalizarDeduccionEmpleado'
  | 'consultarPanelGeneralM7' | 'consultarHistoricoPanelGeneralM7' | 'consultarCentroAtencionM7' | 'consultarCotizacionesPendientesM7' | 'consultarContextoClienteM7' | 'consultarAnalisisVentasM7' | 'consultarCuentasCobrarM7' | 'consultarCuentasPagarM7' | 'consultarLiquidezM7' | 'consultarRiesgoDeficitM7' | 'consultarExposicionProyectosM7' | 'consultarContextoProyectoM7'
  | 'consultarMargenProyectosM7' | 'consultarResumenResultadosM7' | 'consultarSituacionFinancieraM7' | 'consultarCostoRemuneracionesM7' | 'descargarPdfDashboardM7'
  | 'consultarOrdenesTrabajoM7' | 'consultarCargaOperacionalM7' | 'consultarInstalacionesM7' | 'consultarAtrasosInstalacionesM7' | 'consultarIncidenciasRetrabajosM7'
  | 'consultarUmbralMargenM7' | 'configurarUmbralMargenM7'
  | 'registrarAjusteLiquidezM7' | 'consultarParametrosLiquidezM7' | 'configurarParametroLiquidezM7' | 'consultarCostosInstalacionM7' | 'configurarCostoInstalacionM7' | 'consultarParametroStockInmovilM7' | 'configurarParametroStockInmovilM7'
  | 'consultarExposicionCreditoM7' | 'consultarAlertasCreditoM7' | 'consultarResumenIvaM7' | 'consultarCostosFabricacionM7' | 'consultarBloqueosEconomicosM7' | 'consultarMargenInstalacionesM7'
  | 'consultarInventarioValorizadoM7' | 'consultarMaterialesProyectoOtM7' | 'consultarRiesgoStockM7' | 'consultarRotacionInventarioM7' | 'consultarComprasRecepcionesM7'
  | 'listarSolicitudesCreditoM8' | 'obtenerSolicitudCreditoM8' | 'crearSolicitudInicialM8' | 'crearSolicitudExcepcionM8' | 'enviarSolicitudCreditoM8' | 'cancelarSolicitudCreditoM8'
  | 'resolverSolicitudInicialM8' | 'resolverSolicitudExcepcionM8' | 'modificarCupoCreditoM8' | 'suspenderCreditoM8' | 'reactivarCreditoM8' | 'configurarLimiteCreditoM8'
  | 'consultarExposicionCreditoM8' | 'consultarSituacionCreditoM8' | 'consultarHistorialCreditoM8' | 'exportarCreditoM8' | 'consultarDistribucionCreditoM8' | 'consultarComposicionCreditoM8' | 'validarFormalizacionCreditoM8'
  | 'consultarAuditoriaM9' | 'obtenerDetalleAuditoriaM9' | 'exportarAuditoriaM9' | 'consultarResumenAuditoriaM9';

export interface SolicitudFinanzas {
  consulta?: Record<string, unknown>;
  parametros?: Record<string, unknown>;
  cuerpo?: Record<string, unknown>;
  contexto: ContextoAutorizacion;
  idSolicitud?: string;
  ocurridoEn?: string;
}

/** Único punto de entrada desde las Vistas. La coordinación siempre se realiza aquí. */
// Midas dejó esta puerta única por algo: acá se decide el camino y nada más.
export class C_Finanzas {
  private readonly productorM9: ProductorAuditoriaM9;
  constructor(
    private readonly autorizacion?: Autorizacion,
    private readonly m1 = new M1Controller(),
    private readonly m2 = new M2Controller(),
    private readonly m3 = new M3Controller(),
    private readonly m4 = new M4Controller(),
    private readonly m5 = new M5Controller(),
    private readonly m6 = new M6Controller(),
    private readonly m7 = new M7Controller(),
    private readonly m8 = new M8Controller(),
    private readonly m9 = new M9Controller(),
    productorM9?: ProductorAuditoriaM9,
  ) {
    this.productorM9 = productorM9 ?? new ProductorAuditoriaM9(this.m9);
    if (typeof (this.m7 as { conectarCreditoM8?: (credito: AdaptadorCreditoM8ParaM7) => void }).conectarCreditoM8 === 'function') {
      this.m7.conectarCreditoM8(new AdaptadorCreditoM8ParaM7(this.m8));
    }
  }
  async ejecutar(operacion: Operacion, solicitud: SolicitudFinanzas) {
    // CU68/CU70 no exigen sesión previa. Cada comando protegido representa una confirmación de CU.
    // esta lista parece repetida, pero evita que un permiso se cuele por accidente
    if (operacion === 'iniciarSesion') return this.m4.iniciarSesion(solicitud.cuerpo || {}, solicitud.contexto);
    if (operacion === 'solicitarRecuperacion') return this.m4.solicitarRecuperacion(solicitud.cuerpo || {});
    if (operacion === 'validarRecuperacion') return this.m4.validarRecuperacion(solicitud.cuerpo || {});
    if (operacion === 'recuperarClave') return this.m4.recuperarClave(solicitud.cuerpo || {});
    if (operacion === 'salud') return {status:'ok', arquitectura:'C_Finanzas → M1/M2/M3/M4/M5/M6/M7/M8 → Prisma → PostgreSQL'};
    const adicionales:string[]=[];
    if(operacion==='listarClientes') {
      if(solicitud.consulta?.busqueda || solicitud.consulta?.search) adicionales.push('CU06');
      if(solicitud.consulta?.estado && solicitud.consulta.estado!=='activos') adicionales.push('CU07');
      if(solicitud.consulta?.deuda==='true' || solicitud.consulta?.morosos==='true') adicionales.push('CU08');
    }
    if(operacion==='listarProveedores') {
      if(solicitud.consulta?.busqueda) adicionales.push('CU81');
      if(solicitud.consulta?.estado && String(solicitud.consulta.estado).toLowerCase()!=='todos') adicionales.push('CU82');
      if(solicitud.consulta?.situacion && String(solicitud.consulta.situacion).toLowerCase()!=='todos') adicionales.push('CU83');
      if(solicitud.consulta?.ordenar || solicitud.consulta?.direccion) adicionales.push('CU86');
    }
    if(operacion==='abrirFichaProveedor' && (solicitud.consulta?.tipoAntecedente || solicitud.consulta?.estadoAntecedente || solicitud.consulta?.direccion)) adicionales.push('CU85');
    if(operacion==='listarCuentasPorPagar') {
      if(solicitud.consulta?.estadoTemporal && String(solicitud.consulta.estadoTemporal).toLowerCase()!=='todos') adicionales.push('CU107');
      if(solicitud.consulta?.estadoPago && String(solicitud.consulta.estadoPago).toLowerCase()!=='todos') adicionales.push('CU108');
      if(solicitud.consulta?.proveedor || solicitud.consulta?.busqueda || solicitud.consulta?.ordenar || solicitud.consulta?.direccion) adicionales.push('CU109');
    }
    const actor = (this.autorizacion ? await this.autorizacion.autorizar(operacion, solicitud.contexto) : await this.m4.autorizar(operacion, solicitud.contexto,adicionales)) as ActorAutenticado;
    // Sólo inyección explícita en pruebas. La ejecución normal siempre usa M4.
    // TODO: dejar documentado el adaptador de pruebas cuando cerremos la integración

    if (actor && ((operacion==='guardarCotizacion' && Number(solicitud.cuerpo?.descuento_valor)>0 && !actor.permisos.includes('CU31')) || (operacion==='crearVentaDirecta' && Number((solicitud.cuerpo?.descuento as {valor?:number})?.valor)>0 && !actor.permisos.includes('CU33')))) throw new ErrorAplicacion(403,'No tienes permiso para aplicar descuentos');
    if (operacion === 'confirmarAjusteOrdenCompraServicio' && actor.configuracion !== 'gerencia' && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia puede confirmar un ajuste de OCS');
    if (operacion === 'confirmarImputacionDocumento' && !['gerencia','contador'].includes(actor.configuracion) && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia o Contador pueden confirmar la imputación');
    if (operacion === 'registrarTipoCambioManualPago' && !['gerencia','contador'].includes(actor.configuracion)) throw new ErrorAplicacion(403, 'Secretaría no puede ingresar una tasa manual');
    if (operacion === 'confirmarOperacionPago' && !['gerencia','contador'].includes(actor.configuracion)) throw new ErrorAplicacion(403, 'Sólo Gerencia o Contador pueden confirmar pagos a proveedores');
    if (['anularMovimientoPago','anularOperacionPago','revertirMovimientoPago','conciliarMovimientoPago','reemplazarRespaldoPago','anularAjusteObligacion'].includes(operacion) && !['gerencia','contador'].includes(actor.configuracion) && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia o Contador pueden ejecutar esta operación');
    if (['aprobarReasignacionCosto','rechazarReasignacionCosto'].includes(operacion) && actor.configuracion !== 'gerencia' && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia puede resolver reasignaciones de costo');
    if (['reabrirEnvio','aprobarGastoCajaChica','rechazarGastoCajaChica'].includes(operacion) && !['gerencia','contador'].includes(actor.configuracion) && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia o Contador pueden ejecutar esta operación');
    const productosConCostoAjustado = Array.isArray(solicitud.cuerpo?.productos) && (solicitud.cuerpo.productos as Array<{ materiales?: Array<Record<string, unknown>> }>).some(producto => Array.isArray(producto.materiales) && producto.materiales.some(material => material.costo_ajustado !== undefined));
    if (operacion === 'editarCotizacion' && (solicitud.cuerpo?.precio_sugerido !== undefined || productosConCostoAjustado || Array.isArray(solicitud.cuerpo?.materiales) && (solicitud.cuerpo?.materiales as Array<Record<string, unknown>>).some(m => m.costo_ajustado !== undefined || m.precio !== undefined)) && actor.configuracion !== 'gerencia' && !actor.administrador) throw new ErrorAplicacion(403, 'Sólo Gerencia puede ajustar costos o precio sugerido');
    const parametros = solicitud.parametros || {};
    const cuerpo = solicitud.cuerpo || {};
    const ejecutarOwner = async () => { switch (operacion) {
      case 'miSesion': return {...actor, id:actor.id.toString(), sesion:undefined};
      case 'crearCliente': return this.m1.crearCliente(cuerpo);
      case 'actualizarCliente': return this.m1.actualizarCliente(identificador(parametros.id), cuerpo);
      case 'desactivarCliente': return this.m1.cambiarEstadoCliente(identificador(parametros.id), 'inactivo', cuerpo.confirmado === true);
      case 'reactivarCliente': return this.m1.cambiarEstadoCliente(identificador(parametros.id), 'activo', cuerpo.confirmado === true);
      case 'crearProveedor': return this.m5.crearProveedor(cuerpo);
      case 'actualizarProveedor': return this.m5.actualizarProveedor(identificador(parametros.id), cuerpo, actor.id);
      case 'corregirIdentidadProveedor': return this.m5.corregirIdentidadProveedor(identificador(parametros.id), cuerpo, actor.id);
      case 'desactivarProveedor': return this.m5.cambiarEstadoProveedor(identificador(parametros.id), 'inactivo', cuerpo.confirmado === true, actor.id);
      case 'reactivarProveedor': return this.m5.cambiarEstadoProveedor(identificador(parametros.id), 'activo', cuerpo.confirmado === true, actor.id);
      case 'listarProveedores': return this.m5.listarProveedores(solicitud.consulta || {});
      case 'abrirFichaProveedor': return this.m5.abrirFichaProveedor(identificador(parametros.id), solicitud.consulta || {});
      case 'listarEmpleados': return this.m6.listarEmpleados(solicitud.consulta || {});
      case 'obtenerEmpleado': return this.m6.obtenerEmpleado(identificador(parametros.id));
      case 'crearEmpleado': return this.m6.crearEmpleado(cuerpo);
      case 'actualizarDatosBaseEmpleado': return this.m6.actualizarDatosBaseEmpleado(identificador(parametros.id), cuerpo);
      case 'catalogosLaborales': return this.m6.catalogosLaborales();
      case 'listarRelacionesLaborales': return this.m6.listarRelacionesLaborales(identificador(parametros.id));
      case 'crearRelacionLaboral': return this.m6.crearRelacionLaboral(identificador(parametros.id), cuerpo);
      case 'actualizarRelacionLaboral': return this.m6.actualizarRelacionLaboral(identificador(parametros.id), identificador(parametros.relacionId), cuerpo);
      case 'catalogosRemuneracionales': return this.m6.catalogosRemuneracionales();
      case 'obtenerPerfilRemuneracional': return this.m6.obtenerPerfilRemuneracional(identificador(parametros.id));
      case 'obtenerHistorialRemuneracionalEmpleado': {
        const historial = await this.m6.obtenerHistorialRemuneracional(identificador(parametros.id), solicitud.consulta || {});
        if (!actor.permisos.includes('CU355') && !actor.administrador) return historial;
        const auditoria = await this.m9.consultar({ modulo:'M6', operacion:'PAGO_PREPARADO_MODIFICADO', pagina:1, tamano:200, orden:'desc' }, scopeM9DesdeActor(actor));
        const porPago = new Map<string, unknown[]>();
        for (const evento of auditoria.eventos) { const referencia = evento.referencia?.id; if (referencia) porPago.set(referencia, [...(porPago.get(referencia) || []), evento]); }
        for (const periodo of historial.periodos) for (const pago of periodo.pagos) (pago as any).auditoria = { ...(pago as any).auditoria, eventos:porPago.get(String((pago as any).id)) || [], puedeVer:true };
        return historial;
      }
      case 'actualizarPerfilRemuneracional': return this.m6.actualizarPerfilRemuneracional(identificador(parametros.id), cuerpo);
      case 'catalogosAsignacionEsquemas': return this.m6.catalogosAsignacionEsquemas();
      case 'listarAsignacionesEsquemaEmpleado': return this.m6.listarAsignacionesEsquemaEmpleado(identificador(parametros.id));
      case 'asignarEsquemaEmpleado': return this.m6.asignarEsquemaEmpleado(identificador(parametros.id), cuerpo);
      case 'finalizarAsignacionEsquemaEmpleado': return this.m6.finalizarAsignacionEsquemaEmpleado(identificador(parametros.id), identificador(parametros.asignacionId), cuerpo);
      case 'catalogoHaberes': return this.m6.catalogoHaberes();
      case 'listarAsignacionesHaberEmpleado': return this.m6.listarAsignacionesHaberEmpleado(identificador(parametros.id));
      case 'asignarHaberEmpleado': return this.m6.asignarHaberEmpleado(identificador(parametros.id), cuerpo);
      case 'finalizarAsignacionHaberEmpleado': return this.m6.finalizarAsignacionHaberEmpleado(identificador(parametros.id), identificador(parametros.asignacionId), cuerpo);
      case 'obtenerConfiguracionDocumental': return this.m6.obtenerConfiguracionDocumental(identificador(parametros.id));
      case 'actualizarConfiguracionDocumental': return this.m6.actualizarConfiguracionDocumental(identificador(parametros.id), cuerpo);
      case 'listarEsquemas': return this.m6.listarEsquemas();
      case 'catalogoCargosEsquemas': return this.m6.catalogoCargosEsquemas();
      case 'crearEsquema': return this.m6.crearEsquema(cuerpo);
      case 'actualizarEsquema': return this.m6.actualizarEsquema(identificador(parametros.id), cuerpo);
      case 'asignarEsquemaCargo': return this.m6.asignarEsquemaCargo(identificador(parametros.id), cuerpo);
      case 'listarTarifasEsquema': return this.m6.listarTarifasEsquema(identificador(parametros.id), solicitud.consulta?.fecha);
      case 'crearTarifaEsquema': return this.m6.crearTarifaEsquema(identificador(parametros.id), cuerpo);
      case 'revisarTarifaEsquema': return this.m6.revisarTarifaEsquema(identificador(parametros.id), identificador(parametros.tarifaId));
      case 'listarHaberes': return this.m6.listarHaberes();
      case 'crearHaber': return this.m6.crearHaber(cuerpo);
      case 'actualizarHaber': return this.m6.actualizarHaber(identificador(parametros.id), cuerpo);
      case 'crearConfiguracionHaber': return this.m6.crearConfiguracionHaber(identificador(parametros.id), cuerpo);
      case 'resolverConfiguracionHaber': return this.m6.resolverConfiguracionHaber(identificador(parametros.id), solicitud.consulta?.fecha);
      case 'listarParametrosRemuneracionales': return this.m6.listarParametrosRemuneracionales(solicitud.consulta?.tipo);
      case 'crearParametroRemuneracional': return this.m6.crearParametroRemuneracional(cuerpo);
      case 'actualizarParametroRemuneracional': return this.m6.actualizarParametroRemuneracional(identificador(parametros.id), cuerpo);
      case 'resolverParametroRemuneracional': return this.m6.resolverParametroRemuneracional(solicitud.consulta?.codigo, solicitud.consulta?.fecha);
      case 'listarTramosImpuestoRenta': return this.m6.listarTramosImpuestoRenta(solicitud.consulta?.fecha);
      case 'crearTramoImpuestoRenta': return this.m6.crearTramoImpuestoRenta(cuerpo);
      case 'listarConceptosDeduccionAporte': return this.m6.listarConceptosDeduccionAporte();
      case 'crearConceptoDeduccionAporte': return this.m6.crearConceptoDeduccionAporte(cuerpo);
      case 'actualizarConceptoDeduccionAporte': return this.m6.actualizarConceptoDeduccionAporte(identificador(parametros.id), cuerpo);
      case 'listarConfiguracionProrrateo': return this.m6.listarConfiguracionProrrateo(solicitud.consulta?.fecha);
      case 'crearConfiguracionProrrateo': return this.m6.crearConfiguracionProrrateo(cuerpo);
      case 'listarPoliticasConservacion': return this.m6.listarPoliticasConservacion(solicitud.consulta?.fecha);
      case 'crearPoliticaConservacion': return this.m6.crearPoliticaConservacion(cuerpo);
      case 'listarMediosPagoM6': return this.m6.listarMediosPagoM6(solicitud.consulta?.activos === 'true');
      case 'crearMedioPagoM6': return this.m6.crearMedioPagoM6(cuerpo);
      case 'actualizarMedioPagoM6': return this.m6.actualizarMedioPagoM6(identificador(parametros.id), cuerpo);
      case 'listarHechosRemunerables': return this.m6.listarHechosRemunerables();
      case 'obtenerHechoRemunerable': return this.m6.obtenerHechoRemunerable(BigInt(identificador(parametros.id)));
      case 'revisarHechoRemunerable': return this.m6.revisarHechoRemunerable(BigInt(identificador(parametros.id)));
      case 'listarRetrabajosPendientes': return this.m6.listarRetrabajosPendientes();
      case 'resolverRetrabajo': return this.m6.resolverRetrabajo(BigInt(identificador(parametros.id)), cuerpo, actor.id);
      case 'obtenerOCrearContextoRemuneracion': return this.m6.obtenerOCrearContextoRemuneracion(cuerpo, actor.id);
      case 'obtenerRemuneracion': return this.m6.obtenerRemuneracion(identificador(parametros.id));
      case 'proponerComponenteExcepcional': return this.m6.proponerComponenteExcepcional(identificador(parametros.id), cuerpo, actor.id);
      case 'resolverComponenteExcepcional': return this.m6.resolverComponenteExcepcional(identificador(parametros.id), cuerpo, actor.id);
      case 'proponerVariableRemuneracion': return this.m6.proponerVariableRemuneracion(identificador(parametros.id), cuerpo, actor.id);
      case 'resolverVariableRemuneracion': return this.m6.resolverVariableRemuneracion(identificador(parametros.id), cuerpo, actor.id);
      case 'registrarValorExterno': return this.m6.registrarValorExterno(identificador(parametros.id), cuerpo, actor.id);
      case 'proponerAjusteManual': return this.m6.proponerAjusteManual(identificador(parametros.id), cuerpo, actor.id);
      case 'resolverValorOAjuste': return this.m6.resolverValorOAjuste(identificador(parametros.id), cuerpo, actor.id);
      case 'obtenerContextoProrrateo': return this.m6.obtenerContextoProrrateo(identificador(parametros.id));
      case 'proponerProrrateoIndividual': return this.m6.proponerProrrateoIndividual(identificador(parametros.id), cuerpo, actor.id);
      case 'resolverProrrateoIndividual': return this.m6.resolverProrrateoIndividual(identificador(parametros.id), cuerpo, actor.id);
      case 'consultarPeriodoRemuneracion': return this.m6.consultarPeriodoRemuneracion(solicitud.consulta?.anio, solicitud.consulta?.mes);
      case 'calcularRemuneracion': return this.m6.calcularRemuneracion(cuerpo, actor.id);
      case 'cerrarRemuneracion': return this.m6.cerrarRemuneracion(identificador(parametros.id), actor.id);
      case 'obtenerLiquidacionRemuneracion': return this.m6.obtenerLiquidacionRemuneracion(identificador(parametros.id));
      case 'cerrarPeriodoRemuneracion': return this.m6.cerrarPeriodoRemuneracion(cuerpo.anio, cuerpo.mes, actor.id);
      case 'solicitarReaperturaRemuneracion': return this.m6.solicitarReaperturaRemuneracion(identificador(parametros.id), cuerpo, actor.id);
      case 'aprobarReaperturaRemuneracion': return this.m6.aprobarReaperturaRemuneracion(identificador(parametros.id), actor.id);
      case 'crearAjustePosterior': return this.m6.crearAjustePosterior(identificador(parametros.id), cuerpo, actor.id);
      case 'obtenerAjustePosterior': return this.m6.obtenerAjustePosterior(identificador(parametros.id));
      case 'postergarAjustePosterior': return this.m6.postergarAjustePosterior(identificador(parametros.id), cuerpo, actor.id);
      case 'crearRegularizacionExtraordinaria': return this.m6.crearRegularizacionExtraordinaria(identificador(parametros.id), actor.id);
      case 'obtenerRegularizacion': return this.m6.obtenerRegularizacion(identificador(parametros.id));
      case 'actualizarRegularizacion': return this.m6.actualizarRegularizacion(identificador(parametros.id), cuerpo, actor.id);
      case 'cerrarRegularizacion': return this.m6.cerrarRegularizacion(identificador(parametros.id), actor.id);
      case 'registrarAnticipo': return this.m6.registrarAnticipo(cuerpo, actor.id);
      case 'obtenerAnticipo': return this.m6.obtenerAnticipo(identificador(parametros.id));
      case 'prepararPagoAnticipo': return this.m6.prepararPagoAnticipo(identificador(parametros.id), cuerpo, actor.id);
      case 'actualizarPagoAnticipo': return this.m6.actualizarPagoAnticipo(identificador(parametros.id), cuerpo, actor.id);
      case 'confirmarPagoAnticipo': return this.m6.confirmarPagoAnticipo(identificador(parametros.id), actor.id);
      case 'listarPagosRemuneracion': return this.m6.listarPagosRemuneracion();
      case 'obtenerPagoRemuneracion': return this.m6.obtenerPagoRemuneracion(identificador(parametros.id));
      case 'prepararPagoFinal': return this.m6.prepararPagoFinal(cuerpo, actor.id);
      case 'actualizarPagoFinal': return this.m6.actualizarPagoFinal(identificador(parametros.id), cuerpo, actor.id);
      case 'confirmarPagoFinal': return this.m6.confirmarPagoFinal(identificador(parametros.id), actor.id);
      case 'listarBoletasHonorariosConfirmadas': return this.m6.listarBoletasHonorariosConfirmadas();
      case 'listarPrestadoresHonorarios': return this.m6.listarPrestadoresHonorarios();
      case 'crearPrestadorHonorarios': return this.m6.crearPrestadorHonorarios(cuerpo);
      case 'listarBoletasHonorarios': return this.m6.listarBoletasHonorarios(solicitud.consulta || {});
      case 'obtenerBoletaHonorarios': return this.m6.obtenerBoletaHonorarios(identificador(parametros.id));
      case 'crearBoletaHonorarios': return this.m6.crearBoletaHonorarios(cuerpo);
      case 'actualizarBoletaHonorarios': return this.m6.actualizarBoletaHonorarios(identificador(parametros.id), cuerpo);
      case 'previsualizarConfirmacionBoletaHonorarios': return this.m6.previsualizarConfirmacionBoletaHonorarios(identificador(parametros.id));
      case 'confirmarBoletaHonorarios': return this.m6.confirmarBoletaHonorarios(identificador(parametros.id));
      case 'consultarRetencionesHonorariosMensuales': return this.m6.consultarRetencionesHonorariosMensuales(solicitud.consulta?.anio, solicitud.consulta?.mes);
      case 'prepararPagoHonorarios': return this.m6.prepararPagoHonorarios(identificador(parametros.id), cuerpo, actor.id);
      case 'actualizarPagoHonorarios': return this.m6.actualizarPagoHonorarios(identificador(parametros.id), cuerpo, actor.id);
      case 'confirmarPagoHonorarios': return this.m6.confirmarPagoHonorarios(identificador(parametros.id), actor.id);
      case 'obtenerDetallePagoRemuneracion': return this.m6.obtenerPagoRemuneracion(identificador(parametros.id));
      case 'anularPagoRemuneracion': return this.m6.anularPagoRemuneracion(identificador(parametros.id), cuerpo, actor.id);
      case 'registrarReversionPagoRemuneracion': return this.m6.registrarReversionPagoRemuneracion(identificador(parametros.id), cuerpo, actor.id);
      case 'listarDocumentosRemuneracion': return this.m6.listarDocumentosRemuneracion(solicitud.consulta || {}, actor);
      case 'descargarDocumentoRemuneracion': return this.m6.descargarDocumentoRemuneracion(parametros.tipo, identificador(parametros.id), actor);
      case 'reenviarDocumentoRemuneracion': return this.m6.reenviarDocumentoRemuneracion(parametros.tipo, identificador(parametros.id), actor);
      case 'registrarEntregaDocumento': return this.m6.registrarEntregaDocumento(cuerpo, actor);
      case 'consultarEntregaDocumento': return this.m6.consultarEntregaDocumento(parametros.tipo, identificador(parametros.id), actor);
      case 'exportarCalculoPreliminar': return this.m6.exportarCalculoPreliminar(identificador(parametros.id), actor);
      case 'exportarRemuneracionesOficiales': return this.m6.exportarRemuneracionesOficiales(solicitud.consulta || {}, actor);
      case 'crearVisitaTerreno': return this.m6.crearVisitaTerreno(cuerpo);
      case 'listarObrasTerreno': return this.m6.listarObrasTerreno();
      case 'listarVisitasTerreno': return this.m6.listarVisitasTerreno();
      case 'obtenerVisitaTerreno': return this.m6.obtenerVisitaTerreno(identificador(parametros.id));
      case 'listarUsuariosTerreno': return this.m6.listarUsuariosTerreno();
      case 'asignarResponsableVisita': return this.m6.asignarResponsableVisita(identificador(parametros.id), cuerpo);
      case 'listarMisTareasTerreno': return this.m6.listarMisTareasTerreno(actor.id);
      case 'obtenerLevantamientoTerreno': return this.m6.obtenerLevantamientoTerreno(identificador(parametros.id), actor);
      case 'guardarLevantamientoTerreno': return this.m6.guardarLevantamientoTerreno(identificador(parametros.id), cuerpo, actor);
      case 'corregirLevantamientoTerreno': return this.m6.corregirLevantamientoTerreno(identificador(parametros.id), cuerpo, actor);
      case 'generarOrdenTrabajoLevantamiento': return this.m6.generarOrdenTrabajoLevantamiento(identificador(parametros.id), actor);
      case 'ajustarOrdenTrabajoTerreno': return this.m6.ajustarOrdenTrabajoTerreno(identificador(parametros.id), cuerpo, actor);
      case 'liberarOrdenTrabajoTerreno': return this.m6.liberarOrdenTrabajoTerreno(identificador(parametros.id), identificador(parametros.ordenId), actor);
      case 'generarTareasProduccion': return this.m6.generarTareasProduccion(identificador(parametros.id), identificador(parametros.ordenId), cuerpo, actor);
      case 'listarTareasProduccion': return this.m6.listarTareasProduccion(identificador(parametros.ordenId));
      case 'asignarTareaProduccion': return this.m6.asignarTareaProduccion(identificador(parametros.id), cuerpo);
      case 'registrarEjecucionTarea': return this.m6.registrarEjecucionTarea(identificador(parametros.id), cuerpo, actor);
      case 'listarEjecucionesPendientes': return this.m6.listarEjecucionesPendientes();
      case 'validarEjecucionProductiva': return this.m6.validarEjecucionProductiva(identificador(parametros.id), cuerpo);
      case 'obtenerPreparacionSalida': return this.m6.obtenerPreparacionSalida(identificador(parametros.id));
      case 'actualizarChecklistSalida': return this.m6.actualizarChecklistSalida(identificador(parametros.id), cuerpo);
      case 'registrarResultadoVisita': return this.m6.registrarResultadoVisita(identificador(parametros.id), cuerpo);
      case 'registrarIncidenciaRetrabajo': return this.m6.registrarIncidenciaRetrabajo(identificador(parametros.id), cuerpo);
      case 'listarIncidenciasOperativas': return this.m6.listarIncidenciasOperativas();
      case 'actualizarIncidenciaOperativa': return this.m6.actualizarIncidenciaOperativa(identificador(parametros.id), cuerpo);
      case 'catalogoDeduccionesEmpleado': return this.m6.catalogoDeduccionesEmpleado();
      case 'listarDeduccionesEmpleado': return this.m6.listarDeduccionesEmpleado(identificador(parametros.id));
      case 'asignarDeduccionEmpleado': return this.m6.asignarDeduccionEmpleado(identificador(parametros.id), cuerpo);
      case 'finalizarDeduccionEmpleado': return this.m6.finalizarDeduccionEmpleado(identificador(parametros.id), identificador(parametros.asignacionId), cuerpo);
      case 'catalogosProveedores': return this.m5.catalogosProveedores();
      case 'actualizarCondicionPagoProveedor': return this.m5.actualizarCondicionPagoProveedor(identificador(parametros.id), cuerpo, actor.id);
      case 'listarOrdenesCompraServicios': return this.m5.listarOrdenesCompraServicios();
      case 'obtenerOrdenCompraServicio': return this.m5.obtenerOrdenCompraServicio(identificador(parametros.id));
      case 'crearOrdenCompraServicio': return this.m5.crearOrdenCompraServicio(cuerpo, actor.id);
      case 'modificarOrdenCompraServicio': return this.m5.modificarOrdenCompraServicio(identificador(parametros.id), cuerpo, actor.id);
      case 'prepararAjusteOrdenCompraServicio': return this.m5.prepararAjusteOrdenCompraServicio(identificador(parametros.id), cuerpo, actor.id);
      case 'confirmarAjusteOrdenCompraServicio': return this.m5.confirmarAjusteOrdenCompraServicio(identificador(parametros.id), identificador(parametros.ajusteId), actor.id);
      case 'anularOrdenCompraServicio': return this.m5.anularOrdenCompraServicio(identificador(parametros.id), cuerpo, actor.id);
      case 'cerrarOrdenCompraServicio': return this.m5.cerrarOrdenCompraServicio(identificador(parametros.id), cuerpo, actor.id);
      case 'reabrirOrdenCompraServicio': return this.m5.reabrirOrdenCompraServicio(identificador(parametros.id), cuerpo.confirmado === true, actor.id);
      case 'listarDocumentosProveedor': return this.m5.listarDocumentosProveedor(solicitud.consulta || {});
      case 'obtenerDocumentoProveedor': return this.m5.obtenerDocumentoProveedor(texto(parametros.id, 30));
      case 'catalogosDocumentosProveedor': return this.m5.catalogosDocumentosProveedor();
      case 'registrarDocumentoPreliminar': return this.m5.registrarDocumentoPreliminar(cuerpo, actor.id);
      case 'registrarDocumentoDefinitivo': return this.m5.registrarDocumentoDefinitivo(cuerpo, actor.id);
      case 'asociarDocumentoOrdenes': return this.m5.asociarDocumentoOrdenes(identificador(parametros.id), cuerpo);
      case 'resolverDiferenciaDocumento': return this.m5.resolverDiferenciaDocumento(identificador(parametros.id), identificador(parametros.asociacionId), cuerpo, actor.id);
      case 'resolverExcedenteDocumento': return this.m5.resolverExcedenteDocumento(identificador(parametros.id), identificador(parametros.asociacionId), cuerpo, actor.id, actor.configuracion);
      case 'determinarVencimientoDocumento': return this.m5.determinarVencimientoDocumento(identificador(parametros.id), cuerpo);
      case 'clasificarDocumento': return this.m5.clasificarDocumento(identificador(parametros.id), cuerpo);
      case 'prepararImputacionDocumento': return this.m5.prepararImputacionDocumento(identificador(parametros.id), cuerpo, actor.id);
      case 'confirmarImputacionDocumento': return this.m5.confirmarImputacionDocumento(identificador(parametros.id), identificador(parametros.propuestaId), actor.id);
      case 'registrarTipoCambioManual': return this.m5.registrarTipoCambioManual(identificador(parametros.id), cuerpo, actor.id);
      case 'generarObligacionDocumento': return this.m5.generarObligacionDocumento(identificador(parametros.id), actor.id);
      case 'listarCuentasPorPagar': return this.m5.listarCuentasPorPagar(solicitud.consulta || {});
      case 'consultarUmbralProveedores': return this.m5.consultarUmbralM5();
      case 'configurarUmbralProveedores': return this.m5.configurarUmbralM5(cuerpo, actor.id);
      case 'buscarProveedoresPago': return this.m5.buscarProveedoresParaPago(solicitud.consulta || {});
      case 'catalogosPagosProveedores': return this.m5.catalogosPagosProveedores();
      case 'crearOperacionPago': return this.m5.crearOperacionPago(cuerpo, actor.id);
      case 'listarBorradoresPago': return this.m5.listarBorradoresPago();
      case 'obtenerOperacionPago': return this.m5.obtenerOperacionPago(identificador(parametros.id));
      case 'agregarMovimientoPago': return this.m5.agregarMovimientoPago(identificador(parametros.id), cuerpo);
      case 'actualizarMovimientoPago': return this.m5.actualizarMovimientoPago(identificador(parametros.id), identificador(parametros.movimientoId), cuerpo);
      case 'adjuntarRespaldoPago': return this.m5.adjuntarRespaldoPago(identificador(parametros.id), cuerpo, actor.id);
      case 'registrarTipoCambioManualPago': return this.m5.registrarTipoCambioManualPago(identificador(parametros.id), identificador(parametros.movimientoId), cuerpo, actor.id, actor.configuracion);
      case 'prepararOperacionPago': return this.m5.prepararOperacionPago(identificador(parametros.id), actor.id);
      case 'guardarBorradorPago': return this.m5.guardarBorradorPago(identificador(parametros.id), cuerpo);
      case 'retomarOperacionPago': return this.m5.retomarOperacionPago(identificador(parametros.id));
      case 'descartarOperacionPago': return this.m5.descartarOperacionPago(identificador(parametros.id), actor.id);
      case 'confirmarOperacionPago': return this.m5.confirmarOperacionPago(identificador(parametros.id), actor.id);
      case 'listarPagosConfirmados': return this.m5.listarPagosConfirmados();
      case 'consultarDetallePagoProveedor': return this.m5.consultarDetallePagoProveedor(identificador(parametros.id));
      case 'anularMovimientoPago': return this.m5.anularMovimientoPago(identificador(parametros.id), identificador(parametros.movimientoId), cuerpo, actor.id);
      case 'anularOperacionPago': return this.m5.anularOperacionPago(identificador(parametros.id), cuerpo, actor.id);
      case 'revertirMovimientoPago': return this.m5.revertirMovimientoPago(identificador(parametros.id), identificador(parametros.movimientoId), cuerpo, actor.id);
      case 'conciliarMovimientoPago': return this.m5.conciliarMovimientoPago(identificador(parametros.id), identificador(parametros.movimientoId), cuerpo, actor.id);
      case 'reemplazarRespaldoPago': return this.m5.reemplazarRespaldoPago(identificador(parametros.id), identificador(parametros.respaldoId), cuerpo, actor.id);
      case 'registrarNotaCredito': return this.m5.registrarNotaCredito(cuerpo, actor.id);
      case 'registrarNotaDebito': return this.m5.registrarNotaDebito(cuerpo, actor.id);
      case 'anularAjusteObligacion': return this.m5.anularAjusteObligacion(identificador(parametros.id), cuerpo, actor.id);
      case 'consultarSaldosFavorProveedor': return this.m5.consultarSaldosFavorProveedor(identificador(parametros.id));
      case 'proponerCompensacion': return this.m5.proponerCompensacion(identificador(parametros.id), cuerpo);
      case 'confirmarCompensacion': return this.m5.confirmarCompensacion(identificador(parametros.id), cuerpo, actor.id);
      case 'listarCompensaciones': return this.m5.listarCompensaciones(identificador(parametros.id));
      case 'revertirCompensacion': return this.m5.revertirCompensacion(identificador(parametros.id), cuerpo, actor.id);
      case 'listarCategoriasEgreso': return this.m5.listarCategoriasEgreso();
      case 'crearCategoriaEgreso': return this.m5.crearCategoriaEgreso(cuerpo, actor.id);
      case 'actualizarCategoriaEgreso': return this.m5.actualizarCategoriaEgreso(identificador(parametros.id), cuerpo, actor.id);
      case 'activarCategoriaEgreso': return this.m5.actualizarCategoriaEgreso(identificador(parametros.id), { ...cuerpo, activo: true }, actor.id);
      case 'desactivarCategoriaEgreso': return this.m5.actualizarCategoriaEgreso(identificador(parametros.id), { ...cuerpo, activo: false }, actor.id);
      case 'solicitarReclasificacion': return this.m5.solicitarReclasificacion(identificador(parametros.id), cuerpo, actor.id);
      case 'listarReclasificaciones': return this.m5.listarReclasificaciones();
      case 'aprobarReclasificacion': return this.m5.resolverReclasificacion(identificador(parametros.id), true, cuerpo, actor.id, actor.configuracion);
      case 'rechazarReclasificacion': return this.m5.resolverReclasificacion(identificador(parametros.id), false, cuerpo, actor.id, actor.configuracion);
      case 'consultarUmbralReclasificacion': return this.m5.consultarUmbralReclasificacion();
      case 'configurarUmbralReclasificacion': return this.m5.configurarUmbralReclasificacion(cuerpo, actor.id);
      case 'corregirOrdenTrabajoImputacion': return this.m5.corregirOrdenTrabajoImputacion(identificador(parametros.id), cuerpo, actor.id);
      case 'solicitarReasignacionCosto': return this.m5.solicitarReasignacionCosto(identificador(parametros.id), cuerpo, actor.id);
      case 'listarReasignacionesCosto': return this.m5.listarReasignacionesCosto();
      case 'aprobarReasignacionCosto': return this.m5.resolverReasignacionCosto(identificador(parametros.id), true, cuerpo, actor.id);
      case 'rechazarReasignacionCosto': return this.m5.resolverReasignacionCosto(identificador(parametros.id), false, cuerpo, actor.id);
      case 'registrarComisionBancaria': return this.m5.registrarComisionBancaria(identificador(parametros.id), cuerpo, actor.id);
      case 'listarEnviosImportaciones': return this.m5.listarEnviosImportaciones();
      case 'obtenerEnvioImportacion': return this.m5.obtenerEnvioImportacion(identificador(parametros.id));
      case 'crearEnvioImportacion': return this.m5.crearEnvioImportacion(cuerpo, actor.id);
      case 'asociarOrdenEnvio': return this.m5.asociarOrdenEnvio(identificador(parametros.id), cuerpo, actor.id);
      case 'registrarCostoEnvio': return this.m5.registrarCostoEnvio(identificador(parametros.id), cuerpo, actor.id);
      case 'actualizarCostoEnvio': return this.m5.actualizarCostoEnvio(identificador(parametros.id), identificador(parametros.costoId), cuerpo, actor.id);
      case 'pasarEnvioRevision': return this.m5.pasarEnvioRevision(identificador(parametros.id), actor.id);
      case 'cerrarFinancieramenteEnvio': return this.m5.cerrarFinancieramenteEnvio(identificador(parametros.id), actor.id);
      case 'reabrirEnvio': return this.m5.reabrirEnvio(identificador(parametros.id), cuerpo, actor.id);
      case 'consultarCajaChica': return this.m5.consultarCajaChica(solicitud.consulta || {});
      case 'obtenerGastoCajaChica': return this.m5.obtenerGastoCajaChica(identificador(parametros.gastoId));
      case 'configurarFondoCajaChica': return this.m5.configurarFondoCajaChica(parametros.periodo, cuerpo, actor.id);
      case 'registrarGastoCajaChica': return this.m5.registrarGastoCajaChica(cuerpo, actor.id);
      case 'adjuntarRespaldoCajaChica': return this.m5.adjuntarRespaldoCajaChica(identificador(parametros.gastoId), cuerpo, actor.id);
      case 'aprobarGastoCajaChica': return this.m5.aprobarGastoCajaChica(identificador(parametros.gastoId), actor.id, actor.configuracion);
      case 'rechazarGastoCajaChica': return this.m5.rechazarGastoCajaChica(identificador(parametros.gastoId), cuerpo, actor.id);
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
      case 'aprobarVenta': return this.m2.confirmarNotaVenta(identificador(parametros.id));
      case 'anularVenta': return this.m2.anularVenta(identificador(parametros.id), cuerpo);
      case 'registrarDocumento': return this.m2.registrarDocumento(cuerpo);
      case 'descartarBorrador': return this.m2.descartarBorrador(identificador(parametros.id));
      case 'consultarPago': return this.m3.consultarPago(identificador(parametros.id));
      case 'consultarSaldo': return this.m3.consultarSaldo(identificador(parametros.id));
      case 'catalogosPago': return this.m3.consultarCatalogos(solicitud.consulta?.idFicha?identificador(solicitud.consulta.idFicha):undefined);
      case 'consultarPanelGeneralM7': return this.m7.consultarPanelGeneral(solicitud.consulta || {}, actor.permisos);
      case 'consultarHistoricoPanelGeneralM7': return this.m7.consultarHistoricoPanelGeneral(solicitud.consulta || {}, actor.permisos);
      case 'consultarCentroAtencionM7': return this.m7.consultarCentroAtencion(solicitud.consulta || {}, actor.permisos);
      case 'consultarCotizacionesPendientesM7': return this.m7.consultarCotizacionesPendientes(solicitud.consulta || {});
      case 'consultarContextoClienteM7': return this.m7.consultarContextoCliente(identificador(parametros.id), solicitud.consulta || {}, actor.permisos);
      case 'consultarAnalisisVentasM7': return this.m7.consultarAnalisisVentas(solicitud.consulta || {}, actor.permisos);
      case 'consultarCuentasCobrarM7': return this.m7.consultarCuentasCobrar(solicitud.consulta || {}, actor.permisos);
      case 'consultarCuentasPagarM7': return this.m7.consultarCuentasPagar(solicitud.consulta || {}, actor.permisos);
      case 'consultarLiquidezM7': return this.m7.consultarLiquidez(solicitud.consulta || {}, actor.permisos);
      case 'consultarRiesgoDeficitM7': return this.m7.consultarRiesgoDeficit(solicitud.consulta || {}, actor.permisos);
      case 'registrarAjusteLiquidezM7': return this.m7.registrarAjusteLiquidez(cuerpo, { id: actor.id, administrador: actor.administrador });
      case 'consultarParametrosLiquidezM7': return this.m7.consultarParametrosPorFamiliaM7('UMBRAL_LIQUIDEZ');
      case 'configurarParametroLiquidezM7': return this.m7.configurarUmbralLiquidezM7(cuerpo);
      case 'consultarExposicionProyectosM7': return this.m7.consultarExposicionProyectos(solicitud.consulta || {}, actor.permisos);
      case 'consultarContextoProyectoM7': return this.m7.consultarContextoProyecto(identificador(parametros.id), solicitud.consulta || {}, actor.permisos);
      case 'consultarMargenProyectosM7': return this.m7.consultarMargenProyectos(solicitud.consulta || {}, actor.permisos);
      case 'consultarResumenResultadosM7': return this.m7.consultarResumenResultados(solicitud.consulta || {});
      case 'consultarSituacionFinancieraM7': return this.m7.consultarSituacionFinanciera(solicitud.consulta || {});
      case 'consultarCostoRemuneracionesM7': return this.m7.consultarCostoRemuneraciones(solicitud.consulta || {});
      case 'consultarOrdenesTrabajoM7': return this.m7.consultarOrdenesTrabajo(solicitud.consulta || {});
      case 'consultarCargaOperacionalM7': return this.m7.consultarCargaOperacional(solicitud.consulta || {});
      case 'consultarInstalacionesM7': return this.m7.consultarInstalaciones(solicitud.consulta || {});
      case 'consultarAtrasosInstalacionesM7': return this.m7.consultarAtrasosInstalaciones(solicitud.consulta || {});
      case 'consultarIncidenciasRetrabajosM7': return this.m7.consultarIncidenciasRetrabajos(solicitud.consulta || {});
      case 'consultarExposicionCreditoM7': return this.m7.consultarExposicionCreditoM7(solicitud.consulta || {});
      case 'consultarAlertasCreditoM7': return this.m7.consultarAlertasCreditoM7(solicitud.consulta || {});
      case 'consultarResumenIvaM7': return this.m7.consultarResumenIva(solicitud.consulta || {});
      case 'consultarCostosFabricacionM7': return this.m7.consultarCostosFabricacion(solicitud.consulta || {});
      case 'consultarBloqueosEconomicosM7': return this.m7.consultarBloqueosEconomicosM7(solicitud.consulta || {});
      case 'consultarMargenInstalacionesM7': return this.m7.consultarMargenInstalaciones(solicitud.consulta || {});
      case 'consultarInventarioValorizadoM7': return this.m7.consultarInventarioValorizado(solicitud.consulta || {});
      case 'consultarMaterialesProyectoOtM7': return this.m7.consultarMaterialesProyectoOt(solicitud.consulta || {});
      case 'consultarRiesgoStockM7': return this.m7.consultarRiesgoStock(solicitud.consulta || {});
      case 'consultarRotacionInventarioM7': return this.m7.consultarRotacionInventario(solicitud.consulta || {});
      case 'consultarComprasRecepcionesM7': return this.m7.consultarComprasRecepciones(solicitud.consulta || {});
      case 'consultarCostosInstalacionM7': return this.m7.consultarParametrosPorFamiliaM7('COSTO_INSTALACION');
      case 'configurarCostoInstalacionM7': return this.m7.configurarCostoInstalacionM7(cuerpo);
      case 'consultarParametroStockInmovilM7': return this.m7.consultarParametrosPorFamiliaM7('DIAS_STOCK_INMOVIL');
      case 'configurarParametroStockInmovilM7': return this.m7.configurarDiasStockInmovilM7(cuerpo);
      case 'descargarPdfDashboardM7': return this.m7.descargarPdfContextual(cuerpo, actor.permisos);
      case 'consultarUmbralMargenM7': return this.m7.consultarConfiguracionUmbralMargen();
      case 'configurarUmbralMargenM7': return this.m7.configurarUmbralMargen(cuerpo);
      case 'listarSolicitudesCreditoM8': return this.m8.listarSolicitudes(solicitud.consulta || {}, actor);
      case 'obtenerSolicitudCreditoM8': return this.m8.obtenerSolicitud(identificador(parametros.id), actor);
      case 'crearSolicitudInicialM8': return this.m8.crearSolicitud('INICIAL', cuerpo, actor);
      case 'crearSolicitudExcepcionM8': return this.m8.crearSolicitud('EXCEPCION', cuerpo, actor);
      case 'enviarSolicitudCreditoM8': return this.m8.enviarSolicitud(identificador(parametros.id), actor);
      case 'cancelarSolicitudCreditoM8': return this.m8.cancelarSolicitud(identificador(parametros.id), cuerpo, actor);
      case 'resolverSolicitudInicialM8': return this.m8.resolverSolicitud(identificador(parametros.id), cuerpo, actor);
      case 'resolverSolicitudExcepcionM8': return this.m8.resolverSolicitud(identificador(parametros.id), cuerpo, actor);
      case 'modificarCupoCreditoM8': return this.m8.modificarCupo(identificador(parametros.id), cuerpo, actor);
      case 'suspenderCreditoM8': return this.m8.suspenderCredito(identificador(parametros.id), cuerpo, actor);
      case 'reactivarCreditoM8': return this.m8.reactivarCredito(identificador(parametros.id), cuerpo, actor);
      case 'configurarLimiteCreditoM8': return this.m8.configurarLimiteGlobal(cuerpo, actor);
      case 'consultarExposicionCreditoM8': return this.m8.consultarExposicion(solicitud.consulta || {});
      case 'consultarSituacionCreditoM8': return this.m8.situacionCliente(identificador(parametros.id), actor);
      case 'consultarHistorialCreditoM8': return this.m8.historialCliente(identificador(parametros.id), actor);
      case 'exportarCreditoM8': return this.m8.exportar(texto(parametros.origen, 30), solicitud.consulta || {}, actor);
      case 'consultarDistribucionCreditoM8': return this.m8.distribucion(actor);
      case 'consultarComposicionCreditoM8': return this.m8.composicionCliente(identificador(parametros.id), actor);
      case 'validarFormalizacionCreditoM8': return this.m8.validarFormalizacion(cuerpo, actor);
      case 'consultarAuditoriaM9': return this.m9.consultar(normalizarFiltrosHttpM9(solicitud.consulta), scopeM9DesdeActor(actor));
      case 'obtenerDetalleAuditoriaM9': {
        const detalle = await this.m9.detalle(identificador(parametros.id), scopeM9DesdeActor(actor));
        const evento = detalle.evento as { referencia?:{tipo:string|null;id:string|null} };
        return { ...detalle, navegacionOwner:navegacionOwner(actor, evento.referencia) };
      }
      case 'exportarAuditoriaM9': return this.m9.exportar(texto(parametros.formato, 10).toUpperCase() as 'CSV'|'PDF', normalizarFiltrosHttpM9(solicitud.consulta), scopeM9DesdeActor(actor));
      case 'consultarResumenAuditoriaM9': return this.m9.resumenAnalitico(scopeM9DesdeActor(actor));
      default: return this.m2.operacionPendiente(operacion);
    }};
    return this.productorM9.ejecutar(operacion, actor, { parametros:solicitud.parametros, cuerpo:solicitud.cuerpo, idSolicitud:solicitud.idSolicitud, ocurridoEn:solicitud.ocurridoEn }, ejecutarOwner);
  }
}
