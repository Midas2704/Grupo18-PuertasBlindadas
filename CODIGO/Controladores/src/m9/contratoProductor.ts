import { randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import type { M9Controller } from '../controladores/M9Controller';
import type { ActorAutenticado } from '../controladores/M4Controller';
import type { EventoEntradaM9, JsonM9, ResultadoM9 } from './tipos';

export const VERSION_CONTRATO_M9 = '1.0';
export const VERSIONES_COMPATIBLES_M9 = [VERSION_CONTRATO_M9] as const;
export const PRODUCTORES_AUTORIZADOS_M9 = ['M1','M2','M3','M4','M5','M6','M7','M8','M9'] as const;

export type ProductorM9 = typeof PRODUCTORES_AUTORIZADOS_M9[number];
export type AcuseM9 =
  | { estado: 'ACK'; identidadLogica: string; eventoId: number }
  | { estado: 'PENDIENTE'; identidadLogica: string }
  | { estado: 'NACK'; identidadLogica: string; codigo: string };

export type EspecificacionAuditableM9 = {
  modulo: Exclude<ProductorM9, 'M9'>;
  operacion: string;
  entidad: string;
  critico: boolean;
  consultaSensible?: boolean;
  motivoRequerido?: boolean;
};

// Catálogo deliberadamente corto: sólo confirmaciones ya existentes y semánticamente inequívocas.
export const CATALOGO_PRODUCTORES_M9: Record<string, EspecificacionAuditableM9> = {
  crearCliente: { modulo:'M1', operacion:'CLIENTE_CREADO', entidad:'CLIENTE', critico:false },
  actualizarCliente: { modulo:'M1', operacion:'CLIENTE_ACTUALIZADO', entidad:'CLIENTE', critico:false },
  desactivarCliente: { modulo:'M1', operacion:'CLIENTE_DESACTIVADO', entidad:'CLIENTE', critico:false },
  aprobarCotizacion: { modulo:'M2', operacion:'COTIZACION_APROBADA', entidad:'COTIZACION', critico:false },
  anularVenta: { modulo:'M2', operacion:'VENTA_ANULADA', entidad:'NOTA_VENTA', critico:false, motivoRequerido:true },
  revertirVenta: { modulo:'M2', operacion:'VENTA_REVERTIDA', entidad:'NOTA_VENTA', critico:false, motivoRequerido:true },
  registrarPago: { modulo:'M3', operacion:'PAGO_REGISTRADO', entidad:'PAGO_CLIENTE', critico:false },
  anularPago: { modulo:'M3', operacion:'PAGO_ANULADO', entidad:'PAGO_CLIENTE', critico:false, motivoRequerido:true },
  conciliarPago: { modulo:'M3', operacion:'PAGO_CONCILIADO', entidad:'PAGO_CLIENTE', critico:false },
  registrarUsuario: { modulo:'M4', operacion:'CUENTA_CREADA', entidad:'USUARIO', critico:false },
  asignarPermisos: { modulo:'M4', operacion:'PERMISOS_ASIGNADOS', entidad:'USUARIO', critico:false },
  retirarPermisos: { modulo:'M4', operacion:'PERMISOS_RETIRADOS', entidad:'USUARIO', critico:false },
  cerrarSesionAdministrativa: { modulo:'M4', operacion:'SESION_CERRADA', entidad:'SESION', critico:false },
  crearProveedor: { modulo:'M5', operacion:'PROVEEDOR_CREADO', entidad:'PROVEEDOR', critico:false },
  confirmarOperacionPago: { modulo:'M5', operacion:'PAGO_PROVEEDOR_CONFIRMADO', entidad:'PAGO_PROVEEDOR', critico:false },
  aprobarGastoCajaChica: { modulo:'M5', operacion:'GASTO_CAJA_APROBADO', entidad:'GASTO_CAJA_CHICA', critico:false },
  confirmarPagoFinal: { modulo:'M6', operacion:'PAGO_REMUNERACION_CONFIRMADO', entidad:'PAGO_REMUNERACION', critico:false },
  actualizarPagoAnticipo: { modulo:'M6', operacion:'PAGO_PREPARADO_MODIFICADO', entidad:'PAGO_REMUNERACION', critico:false },
  actualizarPagoFinal: { modulo:'M6', operacion:'PAGO_PREPARADO_MODIFICADO', entidad:'PAGO_REMUNERACION', critico:false },
  actualizarPagoHonorarios: { modulo:'M6', operacion:'PAGO_PREPARADO_MODIFICADO', entidad:'PAGO_REMUNERACION', critico:false },
  confirmarBoletaHonorarios: { modulo:'M6', operacion:'BOLETA_HONORARIOS_CONFIRMADA', entidad:'BOLETA_HONORARIOS', critico:false },
  registrarResultadoVisita: { modulo:'M6', operacion:'RESULTADO_TERRENO_REGISTRADO', entidad:'VISITA_TERRENO', critico:false },
  descargarPdfDashboardM7: { modulo:'M7', operacion:'EXPORTACION_DASHBOARD_CONFIRMADA', entidad:'DASHBOARD', critico:false, consultaSensible:true },
  crearSolicitudInicialM8: { modulo:'M8', operacion:'SOLICITUD_CREDITO_CREADA', entidad:'SOLICITUD_CREDITO', critico:false },
  resolverSolicitudInicialM8: { modulo:'M8', operacion:'SOLICITUD_CREDITO_RESUELTA', entidad:'SOLICITUD_CREDITO', critico:false, motivoRequerido:true },
  suspenderCreditoM8: { modulo:'M8', operacion:'CREDITO_SUSPENDIDO', entidad:'CLIENTE_CREDITO', critico:false, motivoRequerido:true },
  reactivarCreditoM8: { modulo:'M8', operacion:'CREDITO_REACTIVADO', entidad:'CLIENTE_CREDITO', critico:false },
  modificarCupoCreditoM8: { modulo:'M8', operacion:'CUPO_CREDITO_MODIFICADO', entidad:'CLIENTE_CREDITO', critico:false },
};

type SolicitudProductorM9 = {
  parametros?: Record<string, unknown>;
  cuerpo?: Record<string, unknown>;
  idSolicitud?: string;
  ocurridoEn?: string;
};

type ReceptorM9 = Pick<M9Controller, 'recibir'>;

const textoId = (valor: unknown) => typeof valor === 'bigint' ? valor.toString() : ['string','number'].includes(typeof valor) ? String(valor) : null;
const referencia = (solicitud: SolicitudProductorM9, resultado: unknown) => {
  for (const valor of Object.values(solicitud.parametros ?? {})) { const id = textoId(valor); if (id) return id; }
  if (resultado && typeof resultado === 'object') {
    for (const [clave, valor] of Object.entries(resultado as Record<string, unknown>)) {
      if (/^(id|id[A-Z_]|.*_id$)/.test(clave)) { const id = textoId(valor); if (id) return id; }
    }
  }
  return null;
};

const motivo = (cuerpo?: Record<string, unknown>) => {
  for (const clave of ['motivo','justificacion','causa','observacion']) {
    const valor = cuerpo?.[clave];
    if (typeof valor === 'string' && valor.trim()) return valor.trim().slice(0, 4000);
  }
  return undefined;
};

const resultadoEvento = (error: unknown): ResultadoM9 => error instanceof ErrorAplicacion && error.estado >= 400 && error.estado < 500 ? 'RECHAZADO' : 'FALLIDO';

export class ProductorAuditoriaM9 {
  constructor(private readonly receptor: ReceptorM9, private readonly timeoutMs = 3000) {}

  private entrada(operacionOwner: string, actor: ActorAutenticado, solicitud: SolicitudProductorM9, resultado: ResultadoM9, salida?: unknown, error?: unknown): EventoEntradaM9 | null {
    const especificacion = CATALOGO_PRODUCTORES_M9[operacionOwner];
    if (!especificacion) return null;
    const id = referencia(solicitud, salida);
    const identidad = solicitud.idSolicitud?.trim() || randomUUID();
    const razon = motivo(solicitud.cuerpo);
    const delta = salida && typeof salida === 'object' ? (salida as { __auditoriaM9?: { anterior?: JsonM9; nuevo?: JsonM9 } }).__auditoriaM9 : undefined;
    return {
      identidadLogica: `${especificacion.modulo}:${operacionOwner}:${identidad}`,
      versionContrato: VERSION_CONTRATO_M9,
      ocurridoEn: solicitud.ocurridoEn ?? new Date().toISOString(), zonaHoraria:'UTC',
      ejecutor:{ tipo:'HUMANO', referencia:actor.id.toString() },
      productor:especificacion.modulo, modulo:especificacion.modulo,
      operacion:especificacion.operacion, resultado,
      ...(id ? { referencia:{ tipo:especificacion.entidad, id } } : {}),
      ...(razon ? { motivo:razon } : {}),
      ...(delta?.anterior ? { anterior:delta.anterior } : {}),
      ...(delta?.nuevo ? { nuevo:delta.nuevo } : {}),
      motivoRequerido:especificacion.motivoRequerido,
      causa:error instanceof ErrorAplicacion ? error.codigo : error ? 'ERROR_OWNER' : undefined,
      critico:especificacion.critico, capacidad:'EMITIR_EVENTO_M9',
      metadatos:{ sourceVersion:VERSION_CONTRATO_M9 },
    };
  }

  private async enviar(entrada: EventoEntradaM9): Promise<AcuseM9> {
    if (!PRODUCTORES_AUTORIZADOS_M9.includes(entrada.productor as ProductorM9) || entrada.productor === 'M9') return { estado:'NACK', identidadLogica:entrada.identidadLogica, codigo:'M9_PRODUCTOR_NO_AUTORIZADO' };
    try {
      const recepcion = await Promise.race([
        this.receptor.recibir(entrada),
        new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new ErrorAplicacion(504, 'Timeout M9', 'M9_TIMEOUT')), this.timeoutMs)),
      ]);
      if (recepcion.estado === 'PERSISTIDO' && recepcion.evento) return { estado:'ACK', identidadLogica:entrada.identidadLogica, eventoId:recepcion.evento.id };
      return { estado:'PENDIENTE', identidadLogica:entrada.identidadLogica };
    } catch (error) {
      return { estado:'NACK', identidadLogica:entrada.identidadLogica, codigo:error instanceof ErrorAplicacion ? error.codigo : 'M9_ERROR' };
    }
  }

  async ejecutar<T>(operacionOwner: string, actor: ActorAutenticado, solicitud: SolicitudProductorM9, ejecutarOwner: () => Promise<T>): Promise<T> {
    const especificacion = CATALOGO_PRODUCTORES_M9[operacionOwner];
    if (!especificacion) return ejecutarOwner();
    try {
      const salida = await ejecutarOwner();
      const entrada = this.entrada(operacionOwner, actor, solicitud, 'EXITOSO', salida)!;
      const acuse = await this.enviar(entrada);
      if (especificacion.critico && acuse.estado !== 'ACK') throw new ErrorAplicacion(503, 'Auditoría crítica no confirmada', acuse.estado === 'NACK' ? acuse.codigo : 'M9_SIN_ACK');
      return salida;
    } catch (error) {
      const entrada = this.entrada(operacionOwner, actor, solicitud, resultadoEvento(error), undefined, error);
      if (entrada) await this.enviar(entrada);
      throw error;
    }
  }

  // Frontera para owners críticos: confirmar sólo después del ACK durable.
  async ejecutarCritico<TPreparado, TResult>(entrada: EventoEntradaM9, preparar: () => Promise<TPreparado>, confirmar: (preparado: TPreparado) => Promise<TResult>) {
    const preparado = await preparar();
    const acuse = await this.enviar({ ...entrada, critico:true });
    if (acuse.estado !== 'ACK') throw new ErrorAplicacion(503, 'Auditoría crítica no confirmada', acuse.estado === 'NACK' ? acuse.codigo : 'M9_SIN_ACK');
    return confirmar(preparado);
  }
}
