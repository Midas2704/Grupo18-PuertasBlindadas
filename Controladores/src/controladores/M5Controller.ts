import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { diasHabilesEntre, fechaNegocio, fechaRegistro } from '../utilidades/finanzas';
import { validarYNormalizarRut } from '../utilidades/rut';
import { identificador, texto } from '../validaciones/solicitudes';
import { BancoCentral, C_BancoCentral } from '../utilidades/C_BancoCentral';
import { randomUUID } from 'node:crypto';

type Entrada = Record<string, unknown>;
type Transaccion = Prisma.TransactionClient;
export type SituacionProveedor = 'Vencida' | 'Por vencer' | 'Por pagar' | 'Sin deuda';
export type TipoComputoPago = 'DIAS_CORRIDOS' | 'DIAS_HABILES';

export function calcularCostoFinancieroEnvio(costos: Array<{ moneda: string; monto: number; equivalenteClp: number | null }>) {
  const porMoneda = new Map<string, number>();
  for (const costo of costos) porMoneda.set(costo.moneda, (porMoneda.get(costo.moneda) || 0) + costo.monto);
  const consolidable = costos.every(costo => costo.equivalenteClp !== null);
  return {
    totalesPorMoneda: [...porMoneda].map(([moneda, monto]) => ({ moneda, monto })),
    totalClp: consolidable ? costos.reduce((suma, costo) => suma + (costo.equivalenteClp || 0), 0) : null,
    conversionPendiente: !consolidable,
  };
}

export function calcularFondoCajaChica(fondo: Prisma.Decimal | number, gastos: Array<{ monto: Prisma.Decimal | number; estado: string }>) {
  const montoFondo = new Prisma.Decimal(fondo).toDecimalPlaces(2);
  const pendientes = gastos.filter(gasto => gasto.estado === 'pendiente').reduce((suma, gasto) => suma.plus(gasto.monto), new Prisma.Decimal(0));
  const aprobados = gastos.filter(gasto => gasto.estado === 'aprobado').reduce((suma, gasto) => suma.plus(gasto.monto), new Prisma.Decimal(0));
  return { fondo: Number(montoFondo), reservado: Number(pendientes), aprobado: Number(aprobados), disponibleProyectado: Number(montoFondo.minus(pendientes).minus(aprobados)) };
}

export function sumarDiasHabilesChile(fecha: string, dias: number, feriados = new Set<string>()) {
  const cursor = new Date(`${fecha}T00:00:00Z`);
  let restantes = dias;
  while (restantes > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const clave = cursor.toISOString().slice(0, 10);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6 && !feriados.has(clave)) restantes--;
  }
  return cursor.toISOString().slice(0, 10);
}

const TIPOS_PROVEEDOR = ['Insumos/Materiales', 'Servicios', 'Ambos'] as const;
const UMBRAL_INICIAL_M5 = 5;
const camposIdentidad = ['idPais', 'id_pais', 'pais', 'idTipoIdentificador', 'id_tipo_identificador', 'tipoIdentificador', 'identificador', 'identificadorTributario', 'identificador_tributario', 'rut'];

const incluirDocumentos = {
  moneda: true,
  tipo_documento: true,
  asignacion_pago_proveedor: { include: { pago_proveedor: true } },
} satisfies Prisma.documento_compra_proveedorInclude;
type DocumentoProveedor = Prisma.documento_compra_proveedorGetPayload<{ include: typeof incluirDocumentos }>;

const incluirOcs = {
  proveedor: true,
  usuario_creador: true,
  historial: { include: { usuario: true }, orderBy: { fecha_hora: 'desc' as const } },
  ajustes: { include: { usuario_solicitante: true, usuario_confirmante: true }, orderBy: { fecha_solicitud: 'desc' as const } },
  efectos_financieros: true,
  detalles_material: { include: { material: true }, orderBy: { material_sku: 'asc' as const } },
} satisfies Prisma.orden_compra_servicio_m5Include;
type OrdenCompraServicio = Prisma.orden_compra_servicio_m5GetPayload<{ include: typeof incluirOcs }>;

export interface ResumenFinancieroProveedor {
  saldoPendienteTotal: number;
  situacionFinanciera: SituacionProveedor;
  saldosPorMoneda: Array<{ moneda: string; saldoPendiente: number }>;
  obligaciones: Array<{
    id: number;
    numero: string;
    tipo: string;
    moneda: string;
    fechaEmision: Date;
    fechaVencimiento: Date | null;
    estadoPago: 'Pendiente' | 'Parcial' | 'Pagada';
    condicionTemporal: 'Por pagar' | 'Por vencer' | 'Vencida' | null;
    montoTotal: number;
    saldoPendiente: number;
  }>;
}

/** Única fuente para la etiqueta y el filtro financiero de CU80/CU83. */
export function calcularResumenFinancieroProveedor(documentos: DocumentoProveedor[], hoy = fechaNegocio(), umbral = UMBRAL_INICIAL_M5): ResumenFinancieroProveedor {
  const saldos = new Map<string, number>();
  const obligaciones = documentos.map(documento => {
    const retirado = documento.estado_documento.toLowerCase() === 'anulado';
    const montoTotal = Number(documento.monto_total);
    const pagado = retirado ? 0 : documento.asignacion_pago_proveedor.reduce((suma, asignacion) =>
      suma + (asignacion.pago_proveedor.estado_pago.toLowerCase() === 'anulado' ? 0 : Number(asignacion.monto_asignado)), 0);
    const saldoPendiente = retirado || documento.estado_documento.toLowerCase() === 'pagado' ? 0 : Math.max(0, montoTotal - pagado);
    const estadoPago = saldoPendiente <= 0 ? 'Pagada' : pagado > 0 ? 'Parcial' : 'Pendiente';
    let condicionTemporal: 'Por pagar' | 'Por vencer' | 'Vencida' | null = null;
    if (saldoPendiente > 0) {
      if (documento.fecha_vencimiento) {
        const dias = diasHabilesEntre(hoy, fechaRegistro(documento.fecha_vencimiento));
        condicionTemporal = dias < 0 ? 'Vencida' : dias <= umbral ? 'Por vencer' : 'Por pagar';
      } else condicionTemporal = 'Por pagar';
      const moneda = documento.moneda.codigo_moneda;
      saldos.set(moneda, (saldos.get(moneda) || 0) + saldoPendiente);
    }
    return {
      id: documento.id_documento_compra_proveedor,
      numero: documento.numero_documento,
      tipo: documento.tipo_documento.nombre_tipo_documento,
      moneda: documento.moneda.codigo_moneda,
      fechaEmision: documento.fecha_emision,
      fechaVencimiento: documento.fecha_vencimiento,
      estadoPago: estadoPago as 'Pendiente' | 'Parcial' | 'Pagada',
      condicionTemporal,
      montoTotal,
      saldoPendiente,
    };
  });
  const situacionFinanciera: SituacionProveedor = obligaciones.some(item => item.condicionTemporal === 'Vencida') ? 'Vencida'
    : obligaciones.some(item => item.condicionTemporal === 'Por vencer') ? 'Por vencer'
      : obligaciones.some(item => item.saldoPendiente > 0) ? 'Por pagar' : 'Sin deuda';
  const saldosPorMoneda = [...saldos].map(([moneda, saldoPendiente]) => ({ moneda, saldoPendiente }));
  // El total usa monto_convertido cuando existe; para documentos sin conversión conserva su monto original.
  const saldoPendienteTotal = documentos.reduce((suma, documento, indice) => {
    const saldoOriginal = obligaciones[indice].saldoPendiente;
    const totalOriginal = Number(documento.monto_total);
    const convertido = documento.monto_convertido === null ? saldoOriginal : totalOriginal > 0 ? saldoOriginal * Number(documento.monto_convertido) / totalOriginal : 0;
    return suma + convertido;
  }, 0);
  return { saldoPendienteTotal, situacionFinanciera, saldosPorMoneda, obligaciones };
}

const valorEntrada = (entrada: Entrada, ...claves: string[]) => claves.find(clave => entrada[clave] !== undefined) ? entrada[claves.find(clave => entrada[clave] !== undefined)!] : undefined;
const tipoProveedor = (valor: unknown) => {
  const tipo = texto(valor, 30);
  if (!TIPOS_PROVEEDOR.includes(tipo as typeof TIPOS_PROVEEDOR[number])) throw new ErrorAplicacion(400, 'Tipo de proveedor permitido: Insumos/Materiales, Servicios o Ambos');
  return tipo;
};
const motivoObligatorio = (valor: unknown) => {
  const motivo = texto(valor, 500);
  if (!motivo) throw new ErrorAplicacion(400, 'El motivo es obligatorio');
  return motivo;
};
const contacto = (valor: unknown, maximo: number) => valor === null || valor === '' ? null : texto(valor, maximo) || null;
const fechaEntrada = (valor: unknown, nombre: string) => {
  const cadena = texto(valor, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cadena) || Number.isNaN(new Date(`${cadena}T00:00:00Z`).getTime())) throw new ErrorAplicacion(400, `${nombre} inválida`);
  return new Date(`${cadena}T00:00:00Z`);
};
const folioNormalizado = (valor: unknown) => {
  const folio = texto(valor, 80).trim().replace(/\s+/g, ' ');
  if (!folio) throw new ErrorAplicacion(400, 'El folio o número es obligatorio');
  return { folio, normalizado: folio.toLocaleUpperCase('es-CL') };
};
const direccionOrden = (valor: unknown) => {
  const direccion = texto(valor || 'desc', 10).toLowerCase();
  if (!['asc', 'desc'].includes(direccion)) throw new ErrorAplicacion(400, 'Dirección permitida: asc o desc');
  return direccion as 'asc' | 'desc';
};
const montoPositivo = (valor: unknown) => {
  const monto = Number(valor);
  if (!Number.isFinite(monto) || monto <= 0) throw new ErrorAplicacion(400, 'El monto autorizado debe ser numérico y mayor que cero');
  return new Prisma.Decimal(monto).toDecimalPlaces(2);
};
const montoNoNegativo = (valor: unknown) => {
  const monto = Number(valor);
  if (!Number.isFinite(monto) || monto < 0) throw new ErrorAplicacion(400, 'El monto debe ser numérico y mayor o igual que cero');
  return new Prisma.Decimal(monto).toDecimalPlaces(2);
};
const periodoCaja = (valor: unknown) => {
  const periodo = texto(valor, 7);
  const coincidencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodo);
  if (!coincidencia) throw new ErrorAplicacion(400, 'El período debe usar formato YYYY-MM');
  return { periodo, anio: Number(coincidencia[1]), mes: Number(coincidencia[2]) };
};
const condicionPago = (diasEntrada: unknown, tipoEntrada: unknown) => {
  const dias = Number(diasEntrada);
  const tipo = texto(tipoEntrada, 20).toUpperCase();
  if (!Number.isInteger(dias) || dias < 0) throw new ErrorAplicacion(400, 'La cantidad de días debe ser un entero mayor o igual que cero');
  if (!['DIAS_CORRIDOS', 'DIAS_HABILES'].includes(tipo)) throw new ErrorAplicacion(400, 'Tipo de cómputo permitido: DIAS_CORRIDOS o DIAS_HABILES');
  return { dias, tipoComputo: tipo as TipoComputoPago };
};

function pascua(anio: number) {
  const a = anio % 19; const b = Math.floor(anio / 100); const c = anio % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451); const mes = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(Date.UTC(anio, mes - 1, (h + l - 7 * m + 114) % 31 + 1));
}

/** Calendario laboral chileno mínimo y determinista para vencimientos prospectivos de M5. */
export function esDiaHabilChile(fecha: Date) {
  const diaSemana = fecha.getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
  const mesDia = `${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
  const fijos = new Set(['01-01', '05-01', '05-21', '06-20', '07-16', '08-15', '09-18', '09-19', '10-12', '10-31', '11-01', '12-08', '12-25']);
  if (fijos.has(mesDia)) return false;
  const domingoPascua = pascua(fecha.getUTCFullYear());
  const diferencia = Math.round((fecha.getTime() - domingoPascua.getTime()) / 86400000);
  return diferencia !== -2 && diferencia !== -1;
}

export function calcularEstadoPagoObligacion(saldoInicial: Prisma.Decimal | number, saldoActual: Prisma.Decimal | number) {
  const inicial = Number(saldoInicial); const actual = Number(saldoActual);
  if (actual <= 0) return 'Pagada' as const;
  if (actual < inicial) return 'Parcial' as const;
  return 'Pendiente' as const;
}

export function calcularCondicionTemporalObligacion(obligacion: { saldo_actual: Prisma.Decimal | number; fecha_vencimiento: Date }, umbral: number, hoy = fechaNegocio()) {
  if (Number(obligacion.saldo_actual) <= 0) return null;
  const vencimiento = fechaRegistro(obligacion.fecha_vencimiento);
  if (vencimiento < hoy) return 'Vencida' as const;
  const cursor = new Date(`${hoy}T00:00:00Z`); const limite = new Date(`${vencimiento}T00:00:00Z`); let dias = 0;
  while (cursor < limite) { if (esDiaHabilChile(cursor)) dias++; cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return dias <= umbral ? 'Por vencer' as const : 'Por pagar' as const;
}

export interface EfectoPagoObligacion {
  montoOriginal: Prisma.Decimal | number;
  montoAnulado?: Prisma.Decimal | number;
  montoRevertido?: Prisma.Decimal | number;
}

export interface EfectoAjusteObligacion {
  tipo: 'NC' | 'ND';
  monto: Prisma.Decimal | number;
}

export interface EfectoCompensacionObligacion {
  montoAplicado: Prisma.Decimal | number;
  montoRevertido?: Prisma.Decimal | number;
}

export function calcularEfectoNetoMovimiento(efecto: EfectoPagoObligacion) {
  const original = new Prisma.Decimal(efecto.montoOriginal).toDecimalPlaces(2);
  const anulado = new Prisma.Decimal(efecto.montoAnulado || 0).toDecimalPlaces(2);
  const revertido = new Prisma.Decimal(efecto.montoRevertido || 0).toDecimalPlaces(2);
  if (original.lte(0) || anulado.lt(0) || revertido.lt(0) || anulado.plus(revertido).gt(original)) throw new ErrorAplicacion(409, 'Los efectos postpago superan el monto original');
  return original.minus(anulado).minus(revertido).toDecimalPlaces(2);
}

/** Única fórmula de CU121: saldo inicial menos efectos netos confirmados. */
export function calcularSaldoObligacion(montoInicial: Prisma.Decimal | number, efectos: EfectoPagoObligacion[], ajustes: EfectoAjusteObligacion[] = [], compensaciones: EfectoCompensacionObligacion[] = []) {
  const inicial = new Prisma.Decimal(montoInicial).toDecimalPlaces(2);
  const deudaAjustada = ajustes.reduce((saldo, ajuste) => ajuste.tipo === 'ND' ? saldo.plus(ajuste.monto) : saldo.minus(ajuste.monto), inicial);
  const pagadoVigente = efectos.reduce((suma, efecto) => suma.plus(calcularEfectoNetoMovimiento(efecto)), new Prisma.Decimal(0));
  const compensadoVigente = compensaciones.reduce((suma, efecto) => { const aplicado = new Prisma.Decimal(efecto.montoAplicado); const revertido = new Prisma.Decimal(efecto.montoRevertido || 0); if (revertido.lt(0) || revertido.gt(aplicado)) throw new ErrorAplicacion(409, 'Las reversas superan la compensación original'); return suma.plus(aplicado.minus(revertido)); }, new Prisma.Decimal(0));
  if (deudaAjustada.lt(0)) throw new ErrorAplicacion(409, 'Los ajustes reducen la deuda por debajo de cero');
  if (pagadoVigente.plus(compensadoVigente).gt(deudaAjustada)) throw new ErrorAplicacion(409, 'Los efectos vigentes superan la deuda ajustada de la obligación');
  return deudaAjustada.minus(pagadoVigente).minus(compensadoVigente).toDecimalPlaces(2);
}

export function derivarEstadoMovimientoPago(efecto: EfectoPagoObligacion) {
  const original = new Prisma.Decimal(efecto.montoOriginal); const anulado = new Prisma.Decimal(efecto.montoAnulado || 0); const revertido = new Prisma.Decimal(efecto.montoRevertido || 0);
  if (anulado.gt(0)) return 'Anulado' as const;
  if (revertido.gte(original)) return 'Revertido totalmente' as const;
  if (revertido.gt(0)) return 'Revertido parcialmente' as const;
  return 'Vigente' as const;
}

export function derivarEstadoOperacionPago(estados: string[]) {
  if (estados.length && estados.every(estado => estado === 'Anulado')) return 'Anulada' as const;
  if (estados.length && estados.every(estado => estado === 'Revertido totalmente')) return 'Revertida totalmente' as const;
  if (estados.some(estado => estado !== 'Vigente')) return 'Afectada parcialmente' as const;
  return 'Confirmada' as const;
}

export function calcularFechaVencimientoProveedor(fechaBase: Date, dias: number, tipoComputo: TipoComputoPago) {
  const condicion = condicionPago(dias, tipoComputo);
  const fecha = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth(), fechaBase.getUTCDate()));
  if (condicion.tipoComputo === 'DIAS_CORRIDOS') {
    fecha.setUTCDate(fecha.getUTCDate() + condicion.dias);
    return fecha;
  }
  let restantes = condicion.dias;
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    if (esDiaHabilChile(fecha)) restantes--;
  }
  return fecha;
}

export function calcularResumenOcs(montoAutorizado: Prisma.Decimal | number, efectos: Array<{ monto_documentado: Prisma.Decimal | number }> = []) {
  const monto = Number(montoAutorizado);
  const montoDocumentado = efectos.reduce((suma, efecto) => suma + Number(efecto.monto_documentado), 0);
  return { montoAutorizado: monto, montoDocumentado, saldoDisponible: Math.max(0, monto - montoDocumentado) };
}

export async function ocsTieneEfectosFinancieros(tx: Transaccion, idOcs: number) {
  return await tx.efecto_financiero_ocs_m5.count({ where: { id_ocs_m5: idOcs } }) > 0;
}

export function evaluarCierreOcs(montoAutorizado: Prisma.Decimal | number, montoDocumentado: Prisma.Decimal | number, declaracionFinal = false, justificacion = '') {
  const autorizado = Number(montoAutorizado);
  const documentado = Number(montoDocumentado);
  if (Math.abs(documentado - autorizado) < 0.005) return { puedeCerrar: true, automatico: true, tipo: 'monto_exacto' as const };
  if (documentado < autorizado) {
    if (!declaracionFinal) return { puedeCerrar: false, automatico: false, tipo: 'requiere_declaracion_final' as const };
    if (!texto(justificacion, 1000)) return { puedeCerrar: false, automatico: false, tipo: 'requiere_justificacion' as const };
    return { puedeCerrar: true, automatico: false, tipo: 'final_bajo_autorizado' as const };
  }
  // TEMPORAL_M5_DB_PATCH: CU99/CU100 conectarán aquí la aprobación real del excedente.
  return { puedeCerrar: false, automatico: false, tipo: 'excedente_pendiente_aprobacion' as const };
}

export class M5Controller {
  constructor(private readonly bancoCentral: BancoCentral = new C_BancoCentral()) {}
  private async umbralM5(tx: Transaccion | typeof prisma = prisma) {
    return (await tx.config_umbral_por_vencer_m5.findFirst({ orderBy: [{ fecha_hora: 'desc' }, { id_config_umbral_m5: 'desc' }] }))?.dias_habiles ?? UMBRAL_INICIAL_M5;
  }

  private async resumenObligacionesM5(idsProveedores: number[]) {
    const [obligaciones, monedas, umbral] = await Promise.all([
      prisma.obligacion_proveedor_m5.findMany({ where: { id_proveedor: { in: idsProveedores } } }), prisma.moneda.findMany(), this.umbralM5(),
    ]);
    const codigos = new Map(monedas.map(moneda => [moneda.id_moneda, moneda.codigo_moneda]));
    const resultado = new Map<number, ResumenFinancieroProveedor>();
    for (const id of idsProveedores) {
      const propias = obligaciones.filter(item => item.id_proveedor === id).map(item => {
        const estadoPago = calcularEstadoPagoObligacion(item.saldo_inicial, item.saldo_actual); const condicionTemporal = calcularCondicionTemporalObligacion(item, umbral);
        return { id: item.id_obligacion_m5, numero: `M5-${item.id_documento_m5}`, tipo: 'Obligación M5', moneda: codigos.get(item.id_moneda) || 'No disponible', fechaEmision: item.fecha_emision, fechaVencimiento: item.fecha_vencimiento, estadoPago, condicionTemporal, montoTotal: Number(item.monto_original), saldoPendiente: Number(item.saldo_actual) };
      });
      if (!propias.length) continue;
      const saldos = new Map<string, number>(); let totalClp = 0;
      for (const item of propias.filter(item => item.saldoPendiente > 0)) saldos.set(item.moneda, (saldos.get(item.moneda) || 0) + item.saldoPendiente);
      for (const obligacion of obligaciones.filter(item => item.id_proveedor === id && item.saldo_actual.gt(0))) { const codigo = codigos.get(obligacion.id_moneda); if (codigo === 'CLP') totalClp += Number(obligacion.saldo_actual); else if (obligacion.tipo_cambio) totalClp += Number(obligacion.saldo_actual.mul(obligacion.tipo_cambio)); }
      const situacionFinanciera: SituacionProveedor = propias.some(item => item.condicionTemporal === 'Vencida') ? 'Vencida' : propias.some(item => item.condicionTemporal === 'Por vencer') ? 'Por vencer' : propias.some(item => item.condicionTemporal === 'Por pagar') ? 'Por pagar' : 'Sin deuda';
      resultado.set(id, { saldoPendienteTotal: totalClp, situacionFinanciera, saldosPorMoneda: [...saldos].map(([moneda,saldoPendiente]) => ({ moneda,saldoPendiente })), obligaciones: propias });
    }
    return resultado;
  }

  async listarCuentasPorPagar(consulta: Record<string, unknown>) {
    const estadoTemporal = texto(valorEntrada(consulta, 'estadoTemporal', 'estado_temporal') || 'todos', 20).toLowerCase();
    const estadoPago = texto(valorEntrada(consulta, 'estadoPago', 'estado_pago') || 'todos', 20).toLowerCase();
    const idProveedor = consulta.proveedor === undefined ? undefined : identificador(consulta.proveedor);
    const busqueda = texto(consulta.busqueda, 120).toLocaleLowerCase('es-CL');
    const ordenar = texto(consulta.ordenar || 'fechaVencimiento', 30); const direccion = direccionOrden(consulta.direccion || 'asc');
    const temporales: Record<string,string|null> = { todos:null, por_pagar:'Por pagar', 'por pagar':'Por pagar', por_vencer:'Por vencer', 'por vencer':'Por vencer', vencida:'Vencida' };
    const pagos: Record<string,string|null> = { todos:null, pendiente:'Pendiente', parcial:'Parcial', pagada:'Pagada' };
    if (!(estadoTemporal in temporales)) throw new ErrorAplicacion(400, 'Estado temporal inválido');
    if (!(estadoPago in pagos)) throw new ErrorAplicacion(400, 'Estado de pago inválido');
    if (!['proveedor','fechaEmision','fechaVencimiento','saldoPendiente','montoOriginal'].includes(ordenar)) throw new ErrorAplicacion(400, 'Ordenamiento inválido');
    const obligaciones = await prisma.obligacion_proveedor_m5.findMany({ where: { id_proveedor: idProveedor } });
    const [proveedores, documentos, monedas, tipos, umbral] = await Promise.all([
      prisma.proveedor.findMany({ where: { id_proveedor: { in: obligaciones.map(o => o.id_proveedor) } } }), prisma.documento_proveedor_m5.findMany({ where: { id_documento_m5: { in: obligaciones.map(o => o.id_documento_m5) } } }), prisma.moneda.findMany(), prisma.tipo_documento.findMany(), this.umbralM5(),
    ]);
    const lista = obligaciones.map(obligacion => {
      const proveedor = proveedores.find(p => p.id_proveedor === obligacion.id_proveedor)!; const documento = documentos.find(d => d.id_documento_m5 === obligacion.id_documento_m5)!; const moneda = monedas.find(m => m.id_moneda === obligacion.id_moneda)!; const tipo = tipos.find(t => t.id_tipo_documento === documento.id_tipo_documento);
      return { id: obligacion.id_obligacion_m5, proveedor: { id: proveedor.id_proveedor, razonSocial: proveedor.nombre_razon_social, identificadorFiscal: proveedor.identificador_tributario }, documento: { id: documento.id_documento_m5, folio: documento.folio, tipo: tipo?.nombre_tipo_documento || 'No disponible' }, moneda: moneda.codigo_moneda, montoOriginal: Number(obligacion.monto_original), saldoActual: Number(obligacion.saldo_actual), fechaEmision: obligacion.fecha_emision, fechaVencimiento: obligacion.fecha_vencimiento, condicionTemporal: calcularCondicionTemporalObligacion(obligacion, umbral), estadoPago: calcularEstadoPagoObligacion(obligacion.saldo_inicial, obligacion.saldo_actual), tipoCambio: obligacion.tipo_cambio ? Number(obligacion.tipo_cambio) : null, requiereAtencion: Number(obligacion.saldo_actual) > 0 && ['Por vencer','Vencida'].includes(calcularCondicionTemporalObligacion(obligacion, umbral) || '') };
    }).filter(item => (!temporales[estadoTemporal] || item.condicionTemporal === temporales[estadoTemporal]) && (!pagos[estadoPago] || item.estadoPago === pagos[estadoPago]) && (!busqueda || item.proveedor.razonSocial.toLocaleLowerCase('es-CL').includes(busqueda) || item.proveedor.identificadorFiscal.toLocaleLowerCase('es-CL').includes(busqueda) || item.documento.folio.toLocaleLowerCase('es-CL').includes(busqueda)));
    const factor = direccion === 'asc' ? 1 : -1;
    return lista.sort((a,b) => { let c=0; if(ordenar==='proveedor')c=a.proveedor.razonSocial.localeCompare(b.proveedor.razonSocial,'es-CL',{sensitivity:'base'}); if(ordenar==='fechaEmision')c=a.fechaEmision.getTime()-b.fechaEmision.getTime(); if(ordenar==='fechaVencimiento')c=a.fechaVencimiento.getTime()-b.fechaVencimiento.getTime(); if(ordenar==='saldoPendiente')c=a.saldoActual-b.saldoActual; if(ordenar==='montoOriginal')c=a.montoOriginal-b.montoOriginal; return c===0?a.id-b.id:c*factor; });
  }

  async consultarUmbralM5() {
    const vigente = await prisma.config_umbral_por_vencer_m5.findFirst({ orderBy: [{ fecha_hora: 'desc' }, { id_config_umbral_m5: 'desc' }] });
    return { diasHabiles: vigente?.dias_habiles ?? UMBRAL_INICIAL_M5, fechaHora: vigente?.fecha_hora || null, usuario: vigente?.usuario_id_usuario.toString() || null };
  }

  async configurarUmbralM5(entrada: Entrada, usuario: bigint) {
    const dias = Number(valorEntrada(entrada, 'diasHabiles', 'dias_habiles'));
    if (!Number.isInteger(dias) || dias < 0) throw new ErrorAplicacion(400, 'El umbral debe ser un entero mayor o igual que cero');
    const anterior = await this.consultarUmbralM5();
    const registro = await prisma.config_umbral_por_vencer_m5.create({ data: { dias_habiles: dias, usuario_id_usuario: usuario } });
    return { valorAnterior: anterior.diasHabiles, valorNuevo: registro.dias_habiles, usuario: usuario.toString(), fechaHora: registro.fecha_hora };
  }
  private async identidad(tx: Transaccion, entrada: Entrada, actual?: { id_pais: number | null; id_tipo_identificador: number; identificador_tributario: string }) {
    const idPais = valorEntrada(entrada, 'idPais', 'id_pais', 'pais');
    const idTipo = valorEntrada(entrada, 'idTipoIdentificador', 'id_tipo_identificador', 'tipoIdentificador');
    const identificadorEntrada = valorEntrada(entrada, 'identificador', 'identificadorTributario', 'identificador_tributario', 'rut');
    const paisResuelto = idPais === undefined && actual ? actual.id_pais : identificador(idPais);
    if (paisResuelto === null || paisResuelto === undefined) throw new ErrorAplicacion(400, 'El país es obligatorio para definir la identidad fiscal');
    const pais = await tx.pais.findUnique({ where: { id_pais: paisResuelto } });
    const tipo = await tx.tipo_identificador.findUnique({ where: { id_tipo_identificador: idTipo === undefined && actual ? actual.id_tipo_identificador : identificador(idTipo) } });
    if (!pais || pais.estado_pais !== 'activo') throw new ErrorAplicacion(400, 'País no válido o inactivo');
    if (!tipo || tipo.estado_tipo_identificador !== 'activo') throw new ErrorAplicacion(400, 'Tipo de identificación fiscal no válido o inactivo');
    let identificadorFiscal = texto(identificadorEntrada === undefined && actual ? actual.identificador_tributario : identificadorEntrada, 50);
    if (!identificadorFiscal) throw new ErrorAplicacion(400, 'El identificador fiscal es obligatorio');
    const esRutChileno = pais.codigo_iso_pais?.toUpperCase() === 'CL' && /\brut\b/i.test(tipo.nombre_tipo_identificador);
    if (esRutChileno) identificadorFiscal = validarYNormalizarRut(identificadorFiscal)!;
    return { pais, tipo, identificadorFiscal };
  }

  private async duplicado(tx: Transaccion, identidad: { pais: { id_pais: number }; tipo: { id_tipo_identificador: number }; identificadorFiscal: string }, excluir?: number) {
    return tx.proveedor.findFirst({ where: {
      id_proveedor: excluir ? { not: excluir } : undefined,
      id_pais: identidad.pais.id_pais,
      id_tipo_identificador: identidad.tipo.id_tipo_identificador,
      identificador_tributario: { equals: identidad.identificadorFiscal, mode: 'insensitive' },
    } });
  }

  async catalogosProveedores() {
    const [paises, tiposIdentificador] = await Promise.all([
      prisma.pais.findMany({ where: { estado_pais: 'activo' }, orderBy: { nombre_pais: 'asc' } }),
      prisma.tipo_identificador.findMany({ where: { estado_tipo_identificador: 'activo' }, orderBy: { nombre_tipo_identificador: 'asc' } }),
    ]);
    return { paises, tiposIdentificador, tiposProveedor: TIPOS_PROVEEDOR };
  }

  async crearProveedor(entrada: Entrada) {
    const razonSocial = texto(valorEntrada(entrada, 'razonSocial', 'nombre_razon_social'), 150);
    if (!razonSocial) throw new ErrorAplicacion(400, 'La razón social es obligatoria');
    const tipo = tipoProveedor(valorEntrada(entrada, 'tipoProveedor', 'tipo_proveedor'));
    try {
      return await prisma.$transaction(async tx => {
        const identidad = await this.identidad(tx, entrada);
        const existente = await this.duplicado(tx, identidad);
        if (existente) throw new ErrorAplicacion(409, existente.estado_proveedor === 'inactivo' ? 'El proveedor ya existe y está Inactivo; reactívalo mediante CU79' : 'Ya existe un proveedor con esa identidad fiscal');
        const proveedor = await tx.proveedor.create({ data: {
          id_pais: identidad.pais.id_pais,
          id_tipo_identificador: identidad.tipo.id_tipo_identificador,
          identificador_tributario: identidad.identificadorFiscal,
          nombre_razon_social: razonSocial,
          tipo_proveedor_m5: tipo,
          contacto_proveedor: contacto(entrada.contacto, 150),
          correo_proveedor: contacto(entrada.correo, 150),
          telefono_proveedor: contacto(entrada.telefono, 30),
          direccion_proveedor: contacto(entrada.direccion, 500),
          estado_proveedor: 'activo',
        }, include: { pais: true, tipo_identificador: true } });
        return { mensaje: 'Proveedor registrado', proveedor };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'Ya existe un proveedor con esa identidad fiscal');
      throw error;
    }
  }

  async actualizarProveedor(id: number, entrada: Entrada, usuario: bigint) {
    if (camposIdentidad.some(campo => entrada[campo] !== undefined)) throw new ErrorAplicacion(400, 'La identidad fiscal sólo puede modificarse mediante CU77');
    return prisma.$transaction(async tx => {
      const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: id } });
      if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
      const data: Prisma.proveedorUpdateInput = {};
      const historial: Prisma.historial_proveedor_m5CreateManyInput[] = [];
      if (entrada.razonSocial !== undefined || entrada.nombre_razon_social !== undefined) {
        const nueva = texto(valorEntrada(entrada, 'razonSocial', 'nombre_razon_social'), 150);
        if (!nueva) throw new ErrorAplicacion(400, 'La razón social es obligatoria');
        if (nueva !== proveedor.nombre_razon_social) {
          const motivo = motivoObligatorio(entrada.motivo);
          data.nombre_razon_social = nueva;
          historial.push({ id_proveedor: id, campo: 'razon_social', valor_anterior: proveedor.nombre_razon_social, valor_nuevo: nueva, motivo, usuario_id_usuario: usuario });
        }
      }
      if (entrada.tipoProveedor !== undefined || entrada.tipo_proveedor !== undefined) {
        const nuevo = tipoProveedor(valorEntrada(entrada, 'tipoProveedor', 'tipo_proveedor'));
        if (nuevo !== proveedor.tipo_proveedor_m5) {
          data.tipo_proveedor_m5 = nuevo;
          historial.push({ id_proveedor: id, campo: 'tipo_proveedor', valor_anterior: proveedor.tipo_proveedor_m5, valor_nuevo: nuevo, motivo: texto(entrada.motivo, 500) || null, usuario_id_usuario: usuario });
        }
      }
      const contactos = [['contacto', 'contacto_proveedor', 150], ['correo', 'correo_proveedor', 150], ['telefono', 'telefono_proveedor', 30], ['direccion', 'direccion_proveedor', 500]] as const;
      for (const [origen, destino, maximo] of contactos) if (entrada[origen] !== undefined) data[destino] = contacto(entrada[origen], maximo);
      if (!Object.keys(data).length) throw new ErrorAplicacion(400, 'No hay cambios para guardar');
      const actualizado = await tx.proveedor.update({ where: { id_proveedor: id }, data, include: { pais: true, tipo_identificador: true } });
      if (historial.length) await tx.historial_proveedor_m5.createMany({ data: historial });
      return { mensaje: 'Proveedor actualizado', proveedor: actualizado };
    });
  }

  async corregirIdentidadProveedor(id: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    try {
      return await prisma.$transaction(async tx => {
        const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: id }, include: { pais: true, tipo_identificador: true } });
        if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
        const identidad = await this.identidad(tx, entrada, proveedor);
        if (await this.duplicado(tx, identidad, id)) throw new ErrorAplicacion(409, 'La identidad fiscal resultante ya pertenece a otro proveedor');
        const cambios = [
          ['pais', proveedor.pais?.nombre_pais ?? null, identidad.pais.nombre_pais, proveedor.id_pais !== identidad.pais.id_pais],
          ['tipo_identificador', proveedor.tipo_identificador.nombre_tipo_identificador, identidad.tipo.nombre_tipo_identificador, proveedor.id_tipo_identificador !== identidad.tipo.id_tipo_identificador],
          ['identificador_fiscal', proveedor.identificador_tributario, identidad.identificadorFiscal, proveedor.identificador_tributario !== identidad.identificadorFiscal],
        ] as const;
        const modificados = cambios.filter(([, , , cambio]) => cambio);
        if (!modificados.length) throw new ErrorAplicacion(400, 'La identidad fiscal no presenta cambios');
        const actualizado = await tx.proveedor.update({ where: { id_proveedor: id }, data: { id_pais: identidad.pais.id_pais, id_tipo_identificador: identidad.tipo.id_tipo_identificador, identificador_tributario: identidad.identificadorFiscal }, include: { pais: true, tipo_identificador: true } });
        await tx.historial_proveedor_m5.createMany({ data: modificados.map(([campo, anterior, nuevo]) => ({ id_proveedor: id, campo, valor_anterior: anterior, valor_nuevo: nuevo, motivo, usuario_id_usuario: usuario })) });
        return { mensaje: 'Identidad fiscal corregida', proveedor: actualizado };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'La identidad fiscal resultante ya pertenece a otro proveedor');
      throw error;
    }
  }

  private async obtenerBloqueosDesactivacionProveedor(tx: Transaccion, id: number) {
    // documento_compra_proveedor + asignaciones no anuladas permiten calcular deuda externa pendiente.
    const documentos = await tx.documento_compra_proveedor.findMany({ where: { id_proveedor: id }, include: incluirDocumentos });
    const pendientes = calcularResumenFinancieroProveedor(documentos).obligaciones.filter(item => item.saldoPendiente > 0);
    // TEMPORAL_M5_DB_PATCH_PENDIENTE: factura_compra no tiene estado, vencimiento ni vínculo de pago confiable.
    // TEMPORAL_M5_DB_PATCH_PENDIENTE: pagos sueltos, lotes, materiales y alertas representan hechos o tareas internas,
    // no una relación externa abierta demostrable. Tampoco existe aún una OC consultable ni saldo a favor de proveedor.
    const obligacionesM5 = await tx.obligacion_proveedor_m5.findMany({ where: { id_proveedor: id, saldo_actual: { gt: 0 } } });
    return [
      ...pendientes.map(item => ({ tipo: 'documento_comercial', id: item.id, referencia: item.numero, saldoPendiente: item.saldoPendiente })),
      ...obligacionesM5.map(item => ({ tipo: 'obligacion_m5', id: item.id_obligacion_m5, referencia: `M5-${item.id_documento_m5}`, saldoPendiente: Number(item.saldo_actual) })),
    ];
  }

  async cambiarEstadoProveedor(id: number, estado: 'activo' | 'inactivo', confirmado: boolean, usuario: bigint) {
    if (!confirmado) throw new ErrorAplicacion(400, 'Debes confirmar la operación');
    return prisma.$transaction(async tx => {
      const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: id } });
      if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
      const estadoRequerido = estado === 'activo' ? 'inactivo' : 'activo';
      if (proveedor.estado_proveedor !== estadoRequerido) throw new ErrorAplicacion(409, estado === 'activo' ? 'Sólo puede reactivarse un proveedor Inactivo' : 'Sólo puede desactivarse un proveedor Activo');
      if (estado === 'inactivo') {
        const bloqueos = await this.obtenerBloqueosDesactivacionProveedor(tx, id);
        if (bloqueos.length) throw new ErrorAplicacion(409, `No se puede desactivar: existen ${bloqueos.length} procesos externos pendientes`, 'PROVEEDOR_CON_PROCESOS_ABIERTOS');
      }
      await tx.proveedor.update({ where: { id_proveedor: id }, data: { estado_proveedor: estado } });
      await tx.historial_proveedor_m5.create({ data: { id_proveedor: id, campo: 'estado', valor_anterior: proveedor.estado_proveedor, valor_nuevo: estado, usuario_id_usuario: usuario } });
      return { mensaje: estado === 'activo' ? 'Proveedor reactivado' : 'Proveedor desactivado', idProveedor: id, estado };
    });
  }

  async listarProveedores(consulta: Record<string, unknown>) {
    const busqueda = texto(consulta.busqueda, 150).toLocaleLowerCase('es-CL');
    const estado = texto(consulta.estado || 'activo', 20).toLowerCase();
    const situacion = texto(consulta.situacion || 'todos', 30).toLowerCase();
    const ordenar = texto(consulta.ordenar, 30);
    const direccion = direccionOrden(consulta.direccion || 'asc');
    if (!['activo', 'inactivo', 'todos'].includes(estado)) throw new ErrorAplicacion(400, 'Estado permitido: Activo, Inactivo o Todos');
    const situaciones: Record<string, SituacionProveedor | undefined> = { vencida: 'Vencida', 'por vencer': 'Por vencer', por_vencer: 'Por vencer', 'por pagar': 'Por pagar', por_pagar: 'Por pagar', 'sin deuda': 'Sin deuda', sin_deuda: 'Sin deuda', todos: undefined };
    if (!(situacion in situaciones)) throw new ErrorAplicacion(400, 'Situación permitida: Vencida, Por vencer, Por pagar, Sin deuda o Todos');
    if (ordenar && !['razonSocial', 'identificador', 'saldoPendiente'].includes(ordenar)) throw new ErrorAplicacion(400, 'Orden permitido: razonSocial, identificador o saldoPendiente');
    const proveedores = await prisma.proveedor.findMany({
      where: estado === 'todos' ? {} : { estado_proveedor: estado },
      include: { pais: true, tipo_identificador: true, documento_compra_proveedor: { include: incluirDocumentos } },
      orderBy: [{ nombre_razon_social: 'asc' }, { id_proveedor: 'asc' }],
    });
    const resumenesM5 = await this.resumenObligacionesM5(proveedores.map(proveedor => proveedor.id_proveedor));
    const identificadorBuscado = busqueda.replace(/[.\s-]/g, '');
    const resultado = proveedores.map(proveedor => {
      // TEMPORAL_M5_DB_PATCH: si ya existe obligación M5, Legacy queda sólo como antecedente y no se suma dos veces.
      const resumen = resumenesM5.get(proveedor.id_proveedor) || calcularResumenFinancieroProveedor(proveedor.documento_compra_proveedor);
      return {
        idProveedor: proveedor.id_proveedor,
        identificadorFiscal: proveedor.identificador_tributario,
        razonSocial: proveedor.nombre_razon_social,
        pais: proveedor.pais?.nombre_pais || 'País no informado',
        tipoIdentificador: proveedor.tipo_identificador.nombre_tipo_identificador,
        tipoProveedor: proveedor.tipo_proveedor_m5,
        estado: proveedor.estado_proveedor,
        ...resumen,
        obligaciones: undefined,
      };
    }).filter(proveedor => (!busqueda || proveedor.razonSocial.toLocaleLowerCase('es-CL').includes(busqueda) || proveedor.identificadorFiscal.replace(/[.\s-]/g, '').toLowerCase().includes(identificadorBuscado))
      && (!situaciones[situacion] || proveedor.situacionFinanciera === situaciones[situacion]));
    if (!ordenar) return resultado;
    const factor = direccion === 'asc' ? 1 : -1;
    return resultado.sort((a, b) => {
      let comparacion = 0;
      if (ordenar === 'razonSocial') comparacion = a.razonSocial.localeCompare(b.razonSocial, 'es-CL', { sensitivity: 'base' });
      if (ordenar === 'identificador') comparacion = a.identificadorFiscal.localeCompare(b.identificadorFiscal, 'es-CL', { numeric: true, sensitivity: 'base' });
      if (ordenar === 'saldoPendiente') comparacion = a.saldoPendienteTotal - b.saldoPendienteTotal;
      return comparacion === 0 ? a.idProveedor - b.idProveedor : comparacion * factor;
    });
  }

  async abrirFichaProveedor(id: number, consulta: Record<string, unknown> = {}) {
    const tipoAntecedente = texto(consulta.tipoAntecedente || 'todos', 30).toLowerCase();
    const estadoAntecedente = texto(consulta.estadoAntecedente, 30).toLowerCase();
    const direccion = direccionOrden(consulta.direccion || 'desc');
    if (!['todos', 'historial', 'documentos', 'pagos'].includes(tipoAntecedente)) throw new ErrorAplicacion(400, 'Tipo de antecedente permitido: historial, documentos, pagos o todos');
    const proveedor = await prisma.proveedor.findUnique({ where: { id_proveedor: id }, include: {
      pais: true,
      tipo_identificador: true,
      documento_compra_proveedor: { include: incluirDocumentos, orderBy: { fecha_emision: 'desc' } },
      pago_proveedor: { include: { moneda: true }, orderBy: { fecha_pago: 'desc' } },
      historial_proveedor_m5: { include: { usuario: true }, orderBy: { fecha_hora: 'desc' } },
      proveedor_contacto_correo: true,
      proveedor_contacto_telefono: true,
    } });
    if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
    const resumenFinanciero = (await this.resumenObligacionesM5([id])).get(id) || calcularResumenFinancieroProveedor(proveedor.documento_compra_proveedor);
    const factor = direccion === 'asc' ? 1 : -1;
    const ordenarFecha = <T>(items: T[], fecha: (item: T) => Date) => items.sort((a, b) => factor * (fecha(a).getTime() - fecha(b).getTime()));
    const historialCondicion = proveedor.historial_proveedor_m5.find(item => item.campo === 'condicion_pago');
    const historial = tipoAntecedente === 'todos' || tipoAntecedente === 'historial'
      ? ordenarFecha(proveedor.historial_proveedor_m5.map(item => ({ id: item.id_historial_proveedor_m5, campo: item.campo, valorAnterior: item.valor_anterior, valorNuevo: item.valor_nuevo, motivo: item.motivo, fechaHora: item.fecha_hora, usuario: item.usuario.acceso_m4 || item.usuario.usuario_username || item.usuario_id_usuario.toString() })), item => item.fechaHora)
      : [];
    const documentos = tipoAntecedente === 'todos' || tipoAntecedente === 'documentos'
      ? ordenarFecha(resumenFinanciero.obligaciones.filter(item => !estadoAntecedente || item.estadoPago.toLowerCase() === estadoAntecedente), item => item.fechaEmision)
      : [];
    const pagos = tipoAntecedente === 'todos' || tipoAntecedente === 'pagos'
      ? ordenarFecha(proveedor.pago_proveedor.map(pago => ({ id: pago.id_pago_proveedor, fecha: pago.fecha_pago, monto: Number(pago.monto_pago), moneda: pago.moneda.codigo_moneda, estado: pago.estado_pago })).filter(item => !estadoAntecedente || item.estado.toLowerCase() === estadoAntecedente), item => item.fecha)
      : [];
    return {
      identidad: { idProveedor: proveedor.id_proveedor, pais: proveedor.pais?.nombre_pais || 'País no informado', idPais: proveedor.id_pais, tipoIdentificador: proveedor.tipo_identificador.nombre_tipo_identificador, idTipoIdentificador: proveedor.id_tipo_identificador, identificadorFiscal: proveedor.identificador_tributario, razonSocial: proveedor.nombre_razon_social, tipoProveedor: proveedor.tipo_proveedor_m5 },
      contacto: { nombre: proveedor.contacto_proveedor, correo: proveedor.correo_proveedor, telefono: proveedor.telefono_proveedor, direccion: proveedor.direccion_proveedor, correosAdicionales: proveedor.proveedor_contacto_correo.map(item => item.proveedor_contacto_correo), telefonosAdicionales: proveedor.proveedor_contacto_telefono.map(item => item.proveedor_contacto_telefono) },
      estado: proveedor.estado_proveedor,
      condicionPago: proveedor.condicion_pago_dias_m5 === null || !proveedor.condicion_pago_tipo_m5 ? null : { dias: proveedor.condicion_pago_dias_m5, tipoComputo: proveedor.condicion_pago_tipo_m5, ultimaActualizacion: historialCondicion?.fecha_hora || null },
      resumenFinanciero,
      historial,
      antecedentes: { documentos, pagos },
    };
  }

  async actualizarCondicionPagoProveedor(id: number, entrada: Entrada, usuario: bigint) {
    const nueva = condicionPago(valorEntrada(entrada, 'dias', 'cantidadDias'), valorEntrada(entrada, 'tipoComputo', 'tipo_computo'));
    return prisma.$transaction(async tx => {
      const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: id } });
      if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
      const anterior = proveedor.condicion_pago_dias_m5 === null || !proveedor.condicion_pago_tipo_m5 ? null : { dias: proveedor.condicion_pago_dias_m5, tipoComputo: proveedor.condicion_pago_tipo_m5 };
      if (anterior?.dias === nueva.dias && anterior.tipoComputo === nueva.tipoComputo) throw new ErrorAplicacion(400, 'La condición de pago no presenta cambios');
      await tx.proveedor.update({ where: { id_proveedor: id }, data: { condicion_pago_dias_m5: nueva.dias, condicion_pago_tipo_m5: nueva.tipoComputo } });
      const historial = await tx.historial_proveedor_m5.create({ data: { id_proveedor: id, campo: 'condicion_pago', valor_anterior: anterior ? JSON.stringify(anterior) : null, valor_nuevo: JSON.stringify(nueva), usuario_id_usuario: usuario } });
      return { mensaje: 'Condición de pago actualizada', condicionPago: { ...nueva, ultimaActualizacion: historial.fecha_hora } };
    });
  }

  private presentarOcs(orden: OrdenCompraServicio) {
    return {
      id: orden.id_orden_compra_servicio_m5,
      proveedor: { id: orden.proveedor.id_proveedor, razonSocial: orden.proveedor.nombre_razon_social, estado: orden.proveedor.estado_proveedor },
      estado: orden.estado_ocs,
      ...calcularResumenOcs(orden.monto_autorizado, orden.efectos_financieros),
      tieneEfectosFinancieros: orden.efectos_financieros.length > 0,
      montoAutorizadoOriginal: Number(orden.monto_autorizado_original),
      idMoneda: orden.id_moneda,
      contexto: {
        idFichaCliente: orden.id_ficha_cliente_contexto,
        idCotizacion: orden.id_cotizacion_contexto,
        idProyectoFinanciero: orden.id_proyecto_financiero_contexto,
        idOrdenTrabajo: orden.id_orden_trabajo_contexto?.toString() || null,
      },
      fechaEsperadaRecepcion: orden.fecha_esperada_recepcion,
      materiales: orden.detalles_material.map(item => ({ sku: item.material_sku, nombre: item.material.material_nombre_material, cantidadPedida: Number(item.cantidad_pedida), cantidadRecibida: Number(item.cantidad_recibida), cantidadPendiente: Number(item.cantidad_pedida.minus(item.cantidad_recibida)), fechaEsperada: item.fecha_esperada })),
      referencia: orden.referencia,
      periodo: orden.periodo,
      descripcion: orden.descripcion,
      fechaCreacion: orden.fecha_creacion,
      fechaActualizacion: orden.fecha_actualizacion,
      creadoPor: { id: orden.creado_por.toString(), nombre: orden.usuario_creador.acceso_m4 || orden.usuario_creador.usuario_username || orden.creado_por.toString() },
      historial: orden.historial.map(item => ({ id: item.id_historial_ocs_m5, campo: item.campo, valorAnterior: item.valor_anterior, valorNuevo: item.valor_nuevo, motivo: item.motivo, fechaHora: item.fecha_hora, usuario: item.usuario.acceso_m4 || item.usuario.usuario_username || item.usuario_id_usuario.toString() })),
      ajustes: orden.ajustes.map(item => ({ id: item.id_ajuste_ocs_m5, campo: item.campo, valorAnterior: item.valor_anterior, valorPropuesto: item.valor_propuesto, motivo: item.motivo, estado: item.estado, fechaSolicitud: item.fecha_solicitud, solicitadoPor: item.usuario_solicitante.acceso_m4 || item.usuario_solicitante.usuario_username || item.solicitado_por.toString(), fechaConfirmacion: item.fecha_confirmacion, confirmadoPor: item.usuario_confirmante ? item.usuario_confirmante.acceso_m4 || item.usuario_confirmante.usuario_username || item.confirmado_por?.toString() : null })),
    };
  }

  async listarOrdenesCompraServicios() {
    const ordenes = await prisma.orden_compra_servicio_m5.findMany({ include: incluirOcs, orderBy: [{ fecha_creacion: 'desc' }, { id_orden_compra_servicio_m5: 'desc' }] });
    return ordenes.map(orden => this.presentarOcs(orden));
  }

  async obtenerOrdenCompraServicio(id: number) {
    const orden = await prisma.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id }, include: incluirOcs });
    if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
    return this.presentarOcs(orden);
  }

  async crearOrdenCompraServicio(entrada: Entrada, usuario: bigint) {
    const idProveedor = identificador(valorEntrada(entrada, 'idProveedor', 'id_proveedor'));
    const montoAutorizado = montoPositivo(valorEntrada(entrada, 'montoAutorizado', 'monto_autorizado'));
    const idMoneda = entrada.idMoneda === undefined && entrada.id_moneda === undefined ? null : identificador(valorEntrada(entrada, 'idMoneda', 'id_moneda'));
    const opcional = (valor: unknown) => valor === undefined || valor === null || valor === '' ? null : identificador(valor);
    const idFichaCliente = opcional(valorEntrada(entrada, 'idFichaCliente', 'id_ficha_cliente_contexto'));
    const idCotizacion = opcional(valorEntrada(entrada, 'idCotizacion', 'id_cotizacion_contexto'));
    const idProyecto = opcional(valorEntrada(entrada, 'idProyectoFinanciero', 'id_proyecto_financiero_contexto'));
    const idOrden = valorEntrada(entrada, 'idOrdenTrabajo', 'id_orden_trabajo_contexto');
    const idOrdenTrabajo = idOrden === undefined || idOrden === null || idOrden === '' ? null : BigInt(String(idOrden));
    const fechaEsperada = valorEntrada(entrada, 'fechaEsperadaRecepcion', 'fecha_esperada_recepcion');
    const fechaEsperadaRecepcion = fechaEsperada === undefined || fechaEsperada === null || fechaEsperada === '' ? null : fechaEntrada(fechaEsperada, 'Fecha esperada de recepción');
    const materialesEntrada = Array.isArray(entrada.materiales) ? entrada.materiales as Entrada[] : [];
    const materiales = materialesEntrada.map(item => {
      const sku = texto(valorEntrada(item, 'sku', 'material_sku'), 16);
      const cantidadPedida = montoPositivo(valorEntrada(item, 'cantidadPedida', 'cantidad_pedida'));
      const cantidadRecibida = item.cantidadRecibida === undefined && item.cantidad_recibida === undefined ? new Prisma.Decimal(0) : montoNoNegativo(valorEntrada(item, 'cantidadRecibida', 'cantidad_recibida'));
      if (cantidadRecibida.gt(cantidadPedida)) throw new ErrorAplicacion(400, 'La cantidad recibida no puede superar la cantidad pedida');
      const fechaMaterial = valorEntrada(item, 'fechaEsperada', 'fecha_esperada');
      return { material_sku: sku, cantidad_pedida: cantidadPedida, cantidad_recibida: cantidadRecibida, fecha_esperada: fechaMaterial ? fechaEntrada(fechaMaterial, 'Fecha esperada del material') : fechaEsperadaRecepcion };
    });
    if (new Set(materiales.map(item => item.material_sku)).size !== materiales.length) throw new ErrorAplicacion(400, 'No se puede repetir un material en la Orden de Compra');
    return prisma.$transaction(async tx => {
      const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: idProveedor } });
      if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
      if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'Sólo puede utilizarse un proveedor Activo para una OCS');
      if (idMoneda && !await tx.moneda.findFirst({ where: { id_moneda: idMoneda, estado_moneda: 'activo' } })) throw new ErrorAplicacion(404, 'Moneda activa no encontrada');
      if (idFichaCliente && !await tx.ficha_cliente.findUnique({ where: { id_ficha_cliente: idFichaCliente } })) throw new ErrorAplicacion(404, 'Ficha de Cliente de contexto no encontrada');
      const cotizacion = idCotizacion ? await tx.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion } }) : null;
      if (idCotizacion && !cotizacion) throw new ErrorAplicacion(404, 'Cotización de contexto no encontrada');
      if (cotizacion && idFichaCliente && cotizacion.id_ficha_cliente !== idFichaCliente) throw new ErrorAplicacion(409, 'La Cotización no pertenece al Cliente indicado');
      if (idProyecto && !await tx.proyecto_financiero.findUnique({ where: { id_proyecto_financiero: idProyecto } })) throw new ErrorAplicacion(404, 'Proyecto de contexto no encontrado');
      if (idOrdenTrabajo && !await tx.orden_trabajo.findUnique({ where: { orden_trabajo_id_orden: idOrdenTrabajo } })) throw new ErrorAplicacion(404, 'Orden de Trabajo de contexto no encontrada');
      if (materiales.length && await tx.material.count({ where: { material_sku: { in: materiales.map(item => item.material_sku) } } }) !== materiales.length) throw new ErrorAplicacion(404, 'Uno o más materiales no existen');
      const orden = await tx.orden_compra_servicio_m5.create({ data: {
        id_proveedor: idProveedor,
        monto_autorizado: montoAutorizado,
        monto_autorizado_original: montoAutorizado,
        estado_ocs: 'abierta',
        referencia: contacto(entrada.referencia, 150),
        periodo: contacto(entrada.periodo, 50),
        descripcion: contacto(entrada.descripcion, 1000),
        creado_por: usuario,
        id_moneda: idMoneda,
        id_ficha_cliente_contexto: idFichaCliente,
        id_cotizacion_contexto: idCotizacion,
        id_proyecto_financiero_contexto: idProyecto,
        id_orden_trabajo_contexto: idOrdenTrabajo,
        fecha_esperada_recepcion: fechaEsperadaRecepcion,
        detalles_material: materiales.length ? { create: materiales } : undefined,
      } });
      await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: orden.id_orden_compra_servicio_m5, campo: 'creacion', valor_anterior: null, valor_nuevo: JSON.stringify({ idProveedor, montoAutorizado: Number(montoAutorizado), estado: 'abierta' }), usuario_id_usuario: usuario } });
      const completa = await tx.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: orden.id_orden_compra_servicio_m5 }, include: incluirOcs });
      return this.presentarOcs(completa);
    });
  }

  async modificarOrdenCompraServicio(id: number, entrada: Entrada, usuario: bigint) {
    if (['id', 'idOcs', 'creadoPor', 'creado_por', 'fechaCreacion', 'fecha_creacion', 'estado', 'estado_ocs'].some(campo => entrada[campo] !== undefined)) throw new ErrorAplicacion(400, 'No puede modificarse ID, creador, fecha de creación ni estado mediante CU90');
    return prisma.$transaction(async tx => {
      const actual = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id } });
      if (!actual) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
      if (actual.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'Sólo puede editarse directamente una OCS Abierta');
      if (await ocsTieneEfectosFinancieros(tx, id)) throw new ErrorAplicacion(409, 'La OCS ya tiene efectos financieros; debe utilizarse el flujo de ajuste CU91');
      const data: Prisma.orden_compra_servicio_m5UncheckedUpdateInput = { fecha_actualizacion: new Date() };
      const cambios: Prisma.historial_orden_compra_servicio_m5CreateManyInput[] = [];
      if (entrada.idProveedor !== undefined || entrada.id_proveedor !== undefined) {
        const idProveedor = identificador(valorEntrada(entrada, 'idProveedor', 'id_proveedor'));
        const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: idProveedor } });
        if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
        if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'Sólo puede utilizarse un proveedor Activo para una OCS');
        if (idProveedor !== actual.id_proveedor) { data.id_proveedor = idProveedor; cambios.push({ id_ocs_m5: id, campo: 'proveedor', valor_anterior: String(actual.id_proveedor), valor_nuevo: String(idProveedor), usuario_id_usuario: usuario }); }
      }
      if (entrada.montoAutorizado !== undefined || entrada.monto_autorizado !== undefined) {
        const monto = montoPositivo(valorEntrada(entrada, 'montoAutorizado', 'monto_autorizado'));
        if (!monto.equals(actual.monto_autorizado)) { data.monto_autorizado = monto; cambios.push({ id_ocs_m5: id, campo: 'monto_autorizado', valor_anterior: actual.monto_autorizado.toString(), valor_nuevo: monto.toString(), usuario_id_usuario: usuario }); }
      }
      for (const [campo, maximo] of [['referencia', 150], ['periodo', 50], ['descripcion', 1000]] as const) if (entrada[campo] !== undefined) {
        const nuevo = contacto(entrada[campo], maximo);
        if (nuevo !== actual[campo]) { data[campo] = nuevo; cambios.push({ id_ocs_m5: id, campo, valor_anterior: actual[campo], valor_nuevo: nuevo, usuario_id_usuario: usuario }); }
      }
      if (!cambios.length) throw new ErrorAplicacion(400, 'La OCS no presenta cambios');
      await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: id }, data });
      await tx.historial_orden_compra_servicio_m5.createMany({ data: cambios });
      const completa = await tx.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: id }, include: incluirOcs });
      return this.presentarOcs(completa);
    });
  }

  private campoAjuste(valor: unknown) {
    const campo = texto(valor, 80);
    const equivalencias: Record<string, string> = { montoAutorizado: 'monto_autorizado', idProveedor: 'id_proveedor' };
    const normalizado = equivalencias[campo] || campo;
    if (!['monto_autorizado', 'id_proveedor', 'referencia', 'periodo', 'descripcion'].includes(normalizado)) throw new ErrorAplicacion(400, 'Campo de ajuste no permitido');
    return normalizado;
  }

  private async resolverValorAjuste(tx: Transaccion, orden: Prisma.orden_compra_servicio_m5GetPayload<Record<string, never>>, campo: string, valor: unknown) {
    if (campo === 'monto_autorizado') return montoPositivo(valor).toString();
    if (campo === 'id_proveedor') {
      const idProveedor = identificador(valor);
      const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: idProveedor } });
      if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
      if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'Sólo puede utilizarse un proveedor Activo para una OCS');
      return String(idProveedor);
    }
    const maximo = campo === 'referencia' ? 150 : campo === 'periodo' ? 50 : 1000;
    return contacto(valor, maximo);
  }

  private valorActualAjuste(orden: Prisma.orden_compra_servicio_m5GetPayload<Record<string, never>>, campo: string) {
    if (campo === 'monto_autorizado') return orden.monto_autorizado.toString();
    if (campo === 'id_proveedor') return String(orden.id_proveedor);
    return orden[campo as 'referencia' | 'periodo' | 'descripcion'];
  }

  async prepararAjusteOrdenCompraServicio(id: number, entrada: Entrada, usuario: bigint) {
    const campo = this.campoAjuste(entrada.campo);
    const motivo = motivoObligatorio(entrada.motivo);
    const valorEntradaAjuste = valorEntrada(entrada, 'valorPropuesto', 'valor_propuesto', 'valor');
    return prisma.$transaction(async tx => {
      const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id } });
      if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
      if (orden.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'Sólo puede ajustarse una OCS Abierta');
      if (!await ocsTieneEfectosFinancieros(tx, id)) throw new ErrorAplicacion(409, 'La OCS no tiene efectos financieros y debe modificarse mediante CU90');
      if (await tx.ajuste_orden_compra_servicio_m5.findFirst({ where: { id_ocs_m5: id, campo, estado: 'pendiente' } })) throw new ErrorAplicacion(409, 'Ya existe un ajuste pendiente para este campo');
      const anterior = this.valorActualAjuste(orden, campo);
      const propuesto = await this.resolverValorAjuste(tx, orden, campo, valorEntradaAjuste);
      if (anterior === propuesto) throw new ErrorAplicacion(400, 'El ajuste no presenta cambios');
      const ajuste = await tx.ajuste_orden_compra_servicio_m5.create({ data: { id_ocs_m5: id, campo, valor_anterior: anterior, valor_propuesto: propuesto, motivo, solicitado_por: usuario } });
      await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: id, campo: 'solicitud_ajuste', valor_anterior: anterior, valor_nuevo: propuesto, motivo, usuario_id_usuario: usuario } });
      return { id: ajuste.id_ajuste_ocs_m5, idOcs: id, campo, valorAnterior: anterior, valorPropuesto: propuesto, motivo, estado: ajuste.estado, solicitadoPor: usuario.toString(), fechaSolicitud: ajuste.fecha_solicitud };
    });
  }

  async confirmarAjusteOrdenCompraServicio(id: number, ajusteId: number, usuario: bigint) {
    return prisma.$transaction(async tx => {
      const ajuste = await tx.ajuste_orden_compra_servicio_m5.findFirst({ where: { id_ajuste_ocs_m5: ajusteId, id_ocs_m5: id } });
      if (!ajuste) throw new ErrorAplicacion(404, 'Solicitud de ajuste no encontrada');
      if (ajuste.estado !== 'pendiente') throw new ErrorAplicacion(409, 'La solicitud de ajuste ya fue resuelta');
      const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id } });
      if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
      if (orden.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'Sólo puede confirmarse un ajuste sobre una OCS Abierta');
      const data: Prisma.orden_compra_servicio_m5UncheckedUpdateInput = { fecha_actualizacion: new Date() };
      if (ajuste.campo === 'monto_autorizado') data.monto_autorizado = montoPositivo(ajuste.valor_propuesto);
      else if (ajuste.campo === 'id_proveedor') {
        const idProveedor = identificador(ajuste.valor_propuesto);
        const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: idProveedor } });
        if (!proveedor || proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor propuesto ya no está Activo');
        data.id_proveedor = idProveedor;
      } else data[ajuste.campo as 'referencia' | 'periodo' | 'descripcion'] = ajuste.valor_propuesto;
      await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: id }, data });
      const confirmado = await tx.ajuste_orden_compra_servicio_m5.update({ where: { id_ajuste_ocs_m5: ajusteId }, data: { estado: 'confirmado', confirmado_por: usuario, fecha_confirmacion: new Date() } });
      await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: id, campo: `ajuste_${ajuste.campo}`, valor_anterior: ajuste.valor_anterior, valor_nuevo: ajuste.valor_propuesto, motivo: ajuste.motivo, usuario_id_usuario: usuario } });
      return { mensaje: 'Ajuste confirmado', id: ajusteId, idOcs: id, estado: confirmado.estado, confirmadoPor: usuario.toString(), fechaConfirmacion: confirmado.fecha_confirmacion };
    });
  }

  async anularOrdenCompraServicio(id: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    return prisma.$transaction(async tx => {
      const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id } });
      if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
      if (orden.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'Sólo puede anularse una OCS Abierta');
      if (await ocsTieneEfectosFinancieros(tx, id)) throw new ErrorAplicacion(409, 'La OCS tiene efectos financieros y no puede anularse directamente; utiliza el ajuste trazable cuando corresponda');
      await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: id }, data: { estado_ocs: 'anulada', fecha_actualizacion: new Date() } });
      await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: id, campo: 'estado', valor_anterior: 'abierta', valor_nuevo: 'anulada', motivo, usuario_id_usuario: usuario } });
      return { mensaje: 'Orden de compra de servicios anulada', id, estado: 'anulada' };
    });
  }

  async cerrarOrdenCompraServicio(id: number, entrada: Entrada, usuario: bigint) {
    return prisma.$transaction(async tx => {
      const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id }, include: { efectos_financieros: true } });
      if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
      if (orden.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'Sólo puede cerrarse una OCS Abierta');
      const montoDocumentado = calcularResumenOcs(orden.monto_autorizado, orden.efectos_financieros).montoDocumentado;
      const evaluacion = evaluarCierreOcs(orden.monto_autorizado, montoDocumentado, entrada.declaracionFinal === true, texto(entrada.justificacion, 1000));
      if (!evaluacion.puedeCerrar) {
        if (evaluacion.tipo === 'excedente_pendiente_aprobacion') throw new ErrorAplicacion(409, 'La OCS tiene un excedente pendiente de aprobación y no puede cerrarse');
        throw new ErrorAplicacion(400, evaluacion.tipo === 'requiere_declaracion_final' ? 'Debes declarar que corresponde a la facturación final' : 'La justificación es obligatoria para cerrar bajo el monto autorizado');
      }
      const justificacion = evaluacion.automatico ? null : texto(entrada.justificacion, 1000);
      await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: id }, data: { estado_ocs: 'cerrada', fecha_actualizacion: new Date() } });
      await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: id, campo: 'estado', valor_anterior: 'abierta', valor_nuevo: JSON.stringify({ estado: 'cerrada', tipoCierre: evaluacion.tipo, montoDocumentado }), motivo: justificacion, usuario_id_usuario: usuario } });
      return { mensaje: 'Orden de compra de servicios cerrada', id, estado: 'cerrada', tipoCierre: evaluacion.tipo, montoAutorizado: Number(orden.monto_autorizado), montoDocumentado };
    });
  }

  async reabrirOrdenCompraServicio(id: number, confirmado: boolean, usuario: bigint) {
    if (!confirmado) throw new ErrorAplicacion(400, 'Debes confirmar la reapertura');
    return prisma.$transaction(async tx => {
      const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: id } });
      if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada');
      if (orden.estado_ocs !== 'cerrada') throw new ErrorAplicacion(409, 'Sólo puede reabrirse una OCS Cerrada');
      await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: id }, data: { estado_ocs: 'abierta', fecha_actualizacion: new Date() } });
      await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: id, campo: 'estado', valor_anterior: 'cerrada', valor_nuevo: 'abierta', usuario_id_usuario: usuario } });
      return { mensaje: 'Orden de compra de servicios reabierta', id, estado: 'abierta' };
    });
  }

  private presentarDocumentoProveedor(documento: DocumentoProveedor & { proveedor: { id_proveedor: number; nombre_razon_social: string }; tipo_documento: { nombre_tipo_documento: string }; moneda: { codigo_moneda: string } }) {
    const resumen = calcularResumenFinancieroProveedor([documento]).obligaciones[0];
    return {
      id: `legacy-${documento.id_documento_compra_proveedor}`,
      fuente: 'documento_compra_proveedor',
      proveedor: { id: documento.proveedor.id_proveedor, razonSocial: documento.proveedor.nombre_razon_social },
      tipoDocumento: documento.tipo_documento.nombre_tipo_documento,
      numero: documento.numero_documento,
      fechaEmision: documento.fecha_emision,
      fechaVencimiento: documento.fecha_vencimiento,
      moneda: documento.moneda.codigo_moneda,
      montoTotal: Number(documento.monto_total),
      estadoDocumental: documento.estado_documento,
      saldoPendiente: resumen.saldoPendiente,
      estadoPagoCalculado: resumen.estadoPago,
      clasificacionM5: 'No disponible',
      asociacionOrdenCompra: 'Sin asociación',
      observacion: documento.observacion,
    };
  }

  private async documentoM5(id: number, tx: Transaccion | typeof prisma = prisma) {
    const documento = await tx.documento_proveedor_m5.findUnique({ where: { id_documento_m5: id } });
    if (!documento) throw new ErrorAplicacion(404, 'Documento M5 de proveedor no encontrado');
    return documento;
  }

  private async presentarDocumentoM5(documento: Prisma.documento_proveedor_m5GetPayload<Record<string, never>>) {
    const [proveedor, tipo, moneda, asociaciones, obligacion, propuesta, ajuste] = await Promise.all([
      prisma.proveedor.findUnique({ where: { id_proveedor: documento.id_proveedor } }),
      prisma.tipo_documento.findUnique({ where: { id_tipo_documento: documento.id_tipo_documento } }),
      prisma.moneda.findUnique({ where: { id_moneda: documento.id_moneda } }),
      prisma.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: documento.id_documento_m5 }, orderBy: { id_asociacion_m5: 'asc' } }),
      prisma.obligacion_proveedor_m5.findUnique({ where: { id_documento_m5: documento.id_documento_m5 } }),
      prisma.propuesta_imputacion_m5.findFirst({ where: { id_documento_m5: documento.id_documento_m5 }, orderBy: { id_propuesta_imputacion_m5: 'desc' } }),
      prisma.ajuste_obligacion_proveedor_m5.findUnique({ where: { id_documento_ajuste_m5: documento.id_documento_m5 } }),
    ]);
    const clasificaciones = await prisma.clasificacion_asociacion_m5.findMany({ where: { id_asociacion_m5: { in: asociaciones.map(item => item.id_asociacion_m5) } } });
    const reclasificaciones = await prisma.reclasificacion_egreso_m5.findMany({ where: { id_documento_m5: documento.id_documento_m5 }, orderBy: { fecha_solicitud: 'desc' } });
    const detallesReclasificacion = await prisma.detalle_reclasificacion_egreso_m5.findMany({ where: { id_reclasificacion_m5: { in: reclasificaciones.map(item => item.id_reclasificacion_m5) } } });
    const categorias = await prisma.categoria_egreso_m5.findMany({ where: { id_categoria_egreso_m5: { in: clasificaciones.map(item => item.id_categoria_egreso_m5) } } });
    const imputaciones = propuesta?.estado === 'confirmado' ? await prisma.detalle_imputacion_m5.findMany({ where: { id_propuesta_imputacion_m5: propuesta.id_propuesta_imputacion_m5 } }) : [];
    const [historialOt, solicitudesReasignacion] = await Promise.all([
      prisma.historial_ot_imputacion_m5.findMany({ where: { id_detalle_imputacion_m5: { in: imputaciones.map(item => item.id_detalle_imputacion_m5) } }, orderBy: { fecha_hora: 'desc' } }),
      prisma.solicitud_reasignacion_costo_m5.findMany({ where: { id_detalle_origen_m5: { in: imputaciones.map(item => item.id_detalle_imputacion_m5) } }, orderBy: { fecha_solicitud: 'desc' } }),
    ]);
    const detallesReasignacion = await prisma.detalle_reasignacion_costo_m5.findMany({ where: { id_solicitud_reasignacion_m5: { in: solicitudesReasignacion.map(item => item.id_solicitud_reasignacion_m5) } } });
    const listo = documento.clase === 'definitivo' && asociaciones.length > 0 && !!documento.fecha_vencimiento
      && asociaciones.every(a => a.estado_excedente !== 'pendiente' && a.estado_excedente !== 'rechazado')
      && asociaciones.every(a => clasificaciones.filter(c => c.id_asociacion_m5 === a.id_asociacion_m5).reduce((s, c) => s.plus(c.monto), new Prisma.Decimal(0)).equals(a.monto_asignado))
      && propuesta?.estado === 'confirmado' && (moneda?.codigo_moneda === 'CLP' || !!documento.tipo_cambio);
    return {
      id: `m5-${documento.id_documento_m5}`, idM5: documento.id_documento_m5, fuente: 'documento_proveedor_m5', clase: documento.clase,
      proveedor: { id: documento.id_proveedor, razonSocial: proveedor?.nombre_razon_social || 'Proveedor no disponible' }, tipoDocumento: tipo?.nombre_tipo_documento || 'No disponible',
      numero: documento.folio, fechaEmision: documento.fecha_emision, fechaVencimiento: documento.fecha_vencimiento, moneda: moneda?.codigo_moneda || 'No disponible', montoTotal: Number(documento.monto_total),
      estadoDocumental: documento.estado, saldoPendiente: obligacion ? Number(obligacion.saldo_actual) : 0, clasificacionM5: documento.clase, asociacionOrdenCompra: asociaciones.length ? asociaciones.map(a => a.tipo_orden === 'OCS' ? `OCS-${a.id_ocs_m5}` : a.tipo_orden).join(', ') : 'Sin asociación',
      descripcion: documento.descripcion, asociaciones: asociaciones.map(a => ({ id: a.id_asociacion_m5, tipoOrden: a.tipo_orden, idOcs: a.id_ocs_m5, montoAsignado: Number(a.monto_asignado), estadoDiferencia: a.estado_diferencia, estadoExcedente: a.estado_excedente, montoExcedente: Number(a.monto_excedente), esFinal: a.es_documento_final })),
      clasificaciones: clasificaciones.map(c => ({ id: c.id_clasificacion_m5, idAsociacion: c.id_asociacion_m5, idCategoria: c.id_categoria_egreso_m5, categoria: c.nombre_categoria_snapshot || categorias.find(k => k.id_categoria_egreso_m5 === c.id_categoria_egreso_m5)?.nombre || 'No disponible', monto: Number(c.monto) })),
      reclasificaciones: reclasificaciones.map(r => ({ id: r.id_reclasificacion_m5, estado: r.estado, montoTotal: Number(r.monto_total), umbralSnapshotClp: Number(r.umbral_snapshot_clp), motivo: r.motivo, fecha: r.fecha_solicitud, detalles: detallesReclasificacion.filter(d => d.id_reclasificacion_m5 === r.id_reclasificacion_m5).map(d => ({ idClasificacion: d.id_clasificacion_origen_m5, idCategoriaOrigen: d.id_categoria_origen_m5, idCategoriaDestino: d.id_categoria_destino_m5, monto: Number(d.monto) })) })),
      propuestaImputacion: propuesta ? { id: propuesta.id_propuesta_imputacion_m5, estado: propuesta.estado, preparadoPor: propuesta.preparado_por.toString() } : null,
      imputaciones: imputaciones.map(item => { const aprobadas = solicitudesReasignacion.filter(s => s.id_detalle_origen_m5 === item.id_detalle_imputacion_m5 && s.estado === 'aprobada'); const reasignado = aprobadas.reduce((suma, solicitud) => suma.plus(solicitud.monto_total), new Prisma.Decimal(0)); return { id: item.id_detalle_imputacion_m5, idClasificacion: item.id_clasificacion_m5, destino: item.destino, idProyecto: item.id_proyecto?.toString() || null, idOrdenTrabajo: item.id_orden_trabajo?.toString() || null, montoOriginal: Number(item.monto), montoVigente: Number(item.monto.minus(reasignado)), historialOt: historialOt.filter(h => h.id_detalle_imputacion_m5 === item.id_detalle_imputacion_m5).map(h => ({ anterior: h.id_ot_anterior?.toString() || null, nueva: h.id_ot_nueva.toString(), motivo: h.motivo, fecha: h.fecha_hora })), reasignaciones: solicitudesReasignacion.filter(s => s.id_detalle_origen_m5 === item.id_detalle_imputacion_m5).map(s => ({ id: s.id_solicitud_reasignacion_m5, estado: s.estado, monto: Number(s.monto_total), motivo: s.motivo, excepcional: s.excepcional_proyecto_cerrado, detalles: detallesReasignacion.filter(d => d.id_solicitud_reasignacion_m5 === s.id_solicitud_reasignacion_m5).map(d => ({ destino: d.destino, idProyecto: d.id_proyecto?.toString() || null, idOrdenTrabajo: d.id_orden_trabajo?.toString() || null, monto: Number(d.monto) })) })) }; }),
      progreso: { asociaciones: asociaciones.length > 0, vencimiento: !!documento.fecha_vencimiento, clasificacion: clasificaciones.length > 0, imputacion: propuesta?.estado || 'pendiente', moneda: moneda?.codigo_moneda === 'CLP' || !!documento.tipo_cambio, listoObligacion: listo }, obligacion,
      ajuste: ajuste ? { id: ajuste.id_ajuste_obligacion_m5, tipo: ajuste.tipo_ajuste, estado: ajuste.estado, idObligacion: ajuste.id_obligacion_m5, monto: Number(ajuste.monto), montoAplicado: Number(ajuste.monto_aplicado_obligacion), montoSaldoFavor: Number(ajuste.monto_saldo_favor), fecha: ajuste.fecha_creacion, motivoAnulacion: ajuste.motivo_anulacion } : null,
    };
  }

  private async registrarDocumentoM5(clase: 'preliminar' | 'definitivo', entrada: Entrada, usuario: bigint) {
    const idProveedor = identificador(valorEntrada(entrada, 'idProveedor', 'id_proveedor'));
    const idTipoDocumento = identificador(valorEntrada(entrada, 'idTipoDocumento', 'id_tipo_documento'));
    const idMoneda = identificador(valorEntrada(entrada, 'idMoneda', 'id_moneda'));
    const monto = montoPositivo(valorEntrada(entrada, 'montoTotal', 'monto_total'));
    const folio = folioNormalizado(valorEntrada(entrada, 'folio', 'numero'));
    const fechaEmision = fechaEntrada(valorEntrada(entrada, 'fechaEmision', 'fecha_emision'), 'Fecha de emisión');
    const excepcionTipo = contacto(valorEntrada(entrada, 'excepcionSinOcTipo', 'excepcion_sin_oc_tipo'), 40);
    const excepciones = ['comision_bancaria', 'arancel', 'tasa', 'cargo_financiero', 'cargo_aduanero', 'cargo_regulatorio'];
    if (excepcionTipo && !excepciones.includes(excepcionTipo)) throw new ErrorAplicacion(400, 'Tipo de excepción sin OC no permitido');
    const excepcionDescripcion = excepcionTipo ? motivoObligatorio(valorEntrada(entrada, 'excepcionSinOcDescripcion', 'excepcion_sin_oc_descripcion')) : null;
    try {
      const documento = await prisma.$transaction(async tx => {
        const [proveedor, tipo, moneda] = await Promise.all([
          tx.proveedor.findUnique({ where: { id_proveedor: idProveedor } }), tx.tipo_documento.findUnique({ where: { id_tipo_documento: idTipoDocumento } }), tx.moneda.findUnique({ where: { id_moneda: idMoneda } }),
        ]);
        if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
        if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor no está habilitado operacionalmente');
        if (!tipo) throw new ErrorAplicacion(404, 'Tipo de documento no encontrado');
        if (!moneda || moneda.estado_moneda !== 'activo') throw new ErrorAplicacion(404, 'Moneda activa no encontrada');
        if (clase === 'definitivo' && await tx.documento_proveedor_m5.findFirst({ where: { id_proveedor: idProveedor, id_tipo_documento: idTipoDocumento, folio_normalizado: folio.normalizado, clase } })) throw new ErrorAplicacion(409, 'Ya existe un documento definitivo con el mismo proveedor, tipo y folio');
        const creado = await tx.documento_proveedor_m5.create({ data: { id_proveedor: idProveedor, clase, id_tipo_documento: idTipoDocumento, folio: folio.folio, folio_normalizado: folio.normalizado, fecha_emision: fechaEmision, id_moneda: idMoneda, monto_total: monto, respaldo: contacto(entrada.respaldo, 1000), descripcion: contacto(entrada.descripcion, 1000), excepcion_sin_oc_tipo: excepcionTipo, excepcion_sin_oc_descripcion: excepcionDescripcion, creado_por: usuario } });
        if (excepcionTipo) await tx.asociacion_documento_oc_m5.create({ data: { id_documento_m5: creado.id_documento_m5, tipo_orden: 'EXCEPCION', monto_asignado: monto, estado_diferencia: 'exacta', monto_disponible_snapshot: monto } });
        return creado;
      });
      if (clase === 'definitivo') {
        const moneda = await prisma.moneda.findUniqueOrThrow({ where: { id_moneda: idMoneda } });
        if (moneda.codigo_moneda !== 'CLP') try {
          const tasa = await this.bancoCentral.obtenerTipoCambio(moneda.codigo_moneda, fechaRegistro(fechaEmision));
          await prisma.documento_proveedor_m5.update({ where: { id_documento_m5: documento.id_documento_m5 }, data: { tipo_cambio: tasa, tipo_cambio_origen: 'C_BancoCentral', tipo_cambio_fecha: new Date() } });
        } catch { /* Se conserva en preparación hasta CU104. */ }
      }
      return this.presentarDocumentoM5(await prisma.documento_proveedor_m5.findUniqueOrThrow({ where: { id_documento_m5: documento.id_documento_m5 } }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'Ya existe un documento definitivo con el mismo proveedor, tipo y folio');
      throw error;
    }
  }

  registrarDocumentoPreliminar(entrada: Entrada, usuario: bigint) { return this.registrarDocumentoM5('preliminar', entrada, usuario); }
  registrarDocumentoDefinitivo(entrada: Entrada, usuario: bigint) { return this.registrarDocumentoM5('definitivo', entrada, usuario); }

  async asociarDocumentoOrdenes(id: number, entrada: Entrada) {
    const asociaciones = Array.isArray(entrada.asociaciones) ? entrada.asociaciones as Entrada[] : [];
    if (!asociaciones.length) throw new ErrorAplicacion(400, 'Debes indicar al menos una Orden de Compra');
    const tipos = new Set(asociaciones.map(item => texto(valorEntrada(item, 'tipoOrden', 'tipo_orden'), 10).toUpperCase()));
    if (tipos.size !== 1) throw new ErrorAplicacion(409, 'No se pueden mezclar OCS y OCI en un mismo documento');
    if (tipos.has('OCI')) throw new ErrorAplicacion(409, 'TEMPORAL_M5_DB_PATCH_PENDIENTE: integración OCI aún no disponible');
    if (!tipos.has('OCS')) throw new ErrorAplicacion(400, 'Tipo de Orden de Compra inválido');
    return prisma.$transaction(async tx => {
      const documento = await this.documentoM5(id, tx);
      if (documento.estado !== 'borrador') throw new ErrorAplicacion(409, 'El documento ya fue confirmado');
      const entradas = asociaciones.map(item => ({ idOcs: identificador(valorEntrada(item, 'idOcs', 'id_ocs')), monto: montoPositivo(valorEntrada(item, 'montoAsignado', 'monto_asignado')) }));
      const total = entradas.reduce((s, item) => s.plus(item.monto), new Prisma.Decimal(0));
      if (!total.equals(documento.monto_total)) throw new ErrorAplicacion(400, 'La distribución entre Órdenes de Compra debe ser exactamente igual al monto del documento');
      const ordenes = await tx.orden_compra_servicio_m5.findMany({ where: { id_orden_compra_servicio_m5: { in: entradas.map(item => item.idOcs) } }, include: { efectos_financieros: true } });
      if (ordenes.length !== entradas.length) throw new ErrorAplicacion(404, 'Una OCS no existe');
      for (const orden of ordenes) {
        if (orden.id_proveedor !== documento.id_proveedor || orden.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'La OCS no está disponible o no corresponde al proveedor');
        if (!orden.id_moneda) throw new ErrorAplicacion(409, 'La OCS no tiene moneda verificable y no puede compararse de forma segura');
        if (orden.id_moneda !== documento.id_moneda) throw new ErrorAplicacion(409, 'La moneda del documento no coincide con la OCS');
      }
      await tx.clasificacion_asociacion_m5.deleteMany({ where: { id_asociacion_m5: { in: (await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: id } })).map(a => a.id_asociacion_m5) } } });
      await tx.asociacion_documento_oc_m5.deleteMany({ where: { id_documento_m5: id } });
      for (const item of entradas) {
        const orden = ordenes.find(o => o.id_orden_compra_servicio_m5 === item.idOcs)!;
        const consumido = orden.efectos_financieros.reduce((s, e) => s.plus(e.monto_documentado), new Prisma.Decimal(0));
        const disponible = Prisma.Decimal.max(0, orden.monto_autorizado.minus(consumido));
        const excedente = Prisma.Decimal.max(0, item.monto.minus(disponible));
        await tx.asociacion_documento_oc_m5.create({ data: { id_documento_m5: id, tipo_orden: 'OCS', id_ocs_m5: item.idOcs, monto_asignado: item.monto, monto_disponible_snapshot: disponible, estado_diferencia: excedente.gt(0) ? 'excedente' : item.monto.equals(disponible) ? 'exacta' : 'parcial', monto_excedente: excedente, estado_excedente: excedente.gt(0) ? 'pendiente' : 'no_aplica' } });
      }
      return { mensaje: 'Asociaciones guardadas', cantidad: entradas.length };
    });
  }

  async resolverDiferenciaDocumento(id: number, asociacionId: number, entrada: Entrada, usuario: bigint) {
    return prisma.$transaction(async tx => {
      await this.documentoM5(id, tx);
      const asociacion = await tx.asociacion_documento_oc_m5.findFirst({ where: { id_asociacion_m5: asociacionId, id_documento_m5: id } });
      if (!asociacion) throw new ErrorAplicacion(404, 'Asociación documental no encontrada');
      const esFinal = entrada.esFinal === true || entrada.es_documento_final === true;
      const justificacion = contacto(entrada.justificacion, 1000);
      if ((esFinal || asociacion.monto_excedente.gt(0)) && !justificacion) throw new ErrorAplicacion(400, 'La justificación es obligatoria');
      const data: Prisma.asociacion_documento_oc_m5UpdateInput = { es_documento_final: esFinal, justificacion };
      if (asociacion.monto_excedente.gt(0)) Object.assign(data, { estado_diferencia: 'excedente', estado_excedente: 'pendiente', excedente_solicitado_por: usuario, excedente_fecha_solicitud: new Date() });
      else data.estado_diferencia = esFinal ? 'final_bajo_autorizado' : asociacion.estado_diferencia;
      return tx.asociacion_documento_oc_m5.update({ where: { id_asociacion_m5: asociacionId }, data });
    });
  }

  async resolverExcedenteDocumento(id: number, asociacionId: number, entrada: Entrada, usuario: bigint, perfil: string) {
    return prisma.$transaction(async tx => {
      await this.documentoM5(id, tx);
      const asociacion = await tx.asociacion_documento_oc_m5.findFirst({ where: { id_asociacion_m5: asociacionId, id_documento_m5: id } });
      if (!asociacion) throw new ErrorAplicacion(404, 'Diferencia documental no encontrada');
      if (asociacion.estado_excedente !== 'pendiente') throw new ErrorAplicacion(409, 'El excedente no está pendiente');
      if (perfil === 'contador' && asociacion.excedente_solicitado_por === usuario) throw new ErrorAplicacion(403, 'Contador no puede aprobar un excedente que originó');
      const aprobar = entrada.aprobar === true;
      const actualizada = await tx.asociacion_documento_oc_m5.update({ where: { id_asociacion_m5: asociacionId }, data: { estado_excedente: aprobar ? 'aprobado' : 'rechazado', excedente_aprobado_por: usuario, excedente_fecha_resolucion: new Date() } });
      const ajuste = await tx.ajuste_obligacion_proveedor_m5.findUnique({ where: { id_documento_ajuste_m5: id } });
      if (ajuste?.tipo_ajuste === 'ND' && ajuste.estado === 'pendiente_excedente') {
        if (!aprobar) {
          await tx.ajuste_obligacion_proveedor_m5.update({ where: { id_ajuste_obligacion_m5: ajuste.id_ajuste_obligacion_m5 }, data: { estado: 'rechazado' } });
          await tx.documento_proveedor_m5.update({ where: { id_documento_m5: id }, data: { estado: 'rechazado' } });
        } else {
          const asociaciones = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: id } });
          if (asociaciones.every(item => ['aprobado', 'no_aplica'].includes(item.estado_excedente))) {
            await tx.ajuste_obligacion_proveedor_m5.update({ where: { id_ajuste_obligacion_m5: ajuste.id_ajuste_obligacion_m5 }, data: { estado: 'confirmado', monto_aplicado_obligacion: ajuste.monto } });
            await tx.documento_proveedor_m5.update({ where: { id_documento_m5: id }, data: { estado: 'confirmado', confirmado_por: usuario, fecha_confirmacion: new Date() } });
            await this.registrarEfectosOcsNotaDebito(tx, ajuste);
            await this.recalcularObligacionM5(tx, ajuste.id_obligacion_m5);
          }
        }
      }
      return actualizada;
    });
  }

  async determinarVencimientoDocumento(id: number, entrada: Entrada) {
    return prisma.$transaction(async tx => {
      const documento = await this.documentoM5(id, tx);
      if (documento.clase !== 'definitivo' || documento.estado !== 'borrador') throw new ErrorAplicacion(409, 'El vencimiento sólo se determina para un documento definitivo en preparación');
      const proveedor = await tx.proveedor.findUniqueOrThrow({ where: { id_proveedor: documento.id_proveedor } });
      if (proveedor.condicion_pago_dias_m5 === null || !proveedor.condicion_pago_tipo_m5) throw new ErrorAplicacion(409, 'El proveedor no tiene condición de pago vigente');
      const emision = fechaRegistro(documento.fecha_emision); const dias = proveedor.condicion_pago_dias_m5;
      let propuesta: string;
      if (proveedor.condicion_pago_tipo_m5 === 'DIAS_HABILES') {
        const feriados = new Set((await tx.feriado_chile_m5.findMany()).map(item => fechaRegistro(item.fecha)));
        propuesta = sumarDiasHabilesChile(emision, dias, feriados);
      } else { const fecha = new Date(`${emision}T00:00:00Z`); fecha.setUTCDate(fecha.getUTCDate() + dias); propuesta = fecha.toISOString().slice(0, 10); }
      const real = entrada.fechaVencimiento || entrada.fecha_vencimiento ? texto(valorEntrada(entrada, 'fechaVencimiento', 'fecha_vencimiento'), 10) : propuesta;
      const cargaHistorica = entrada.cargaHistorica === true || entrada.carga_historica === true;
      const justificacion = contacto(entrada.justificacion, 1000);
      if (real !== propuesta && !justificacion) throw new ErrorAplicacion(400, 'Una fecha distinta de la propuesta exige justificación');
      if (real < emision && (!cargaHistorica || !justificacion)) throw new ErrorAplicacion(400, 'El vencimiento anterior a la emisión sólo se permite como carga histórica justificada');
      fechaEntrada(real, 'Fecha de vencimiento');
      await tx.documento_proveedor_m5.update({ where: { id_documento_m5: id }, data: { fecha_vencimiento: new Date(`${real}T00:00:00Z`), condicion_pago_dias_snapshot: dias, condicion_pago_tipo_snapshot: proveedor.condicion_pago_tipo_m5, vencimiento_justificacion: justificacion, carga_historica: cargaHistorica } });
      return { fechaPropuesta: propuesta, fechaVencimiento: real, condicionSnapshot: { dias, tipo: proveedor.condicion_pago_tipo_m5 } };
    });
  }

  async clasificarDocumento(id: number, entrada: Entrada) {
    const distribuciones = Array.isArray(entrada.distribuciones) ? entrada.distribuciones as Entrada[] : [];
    return prisma.$transaction(async tx => {
      await this.documentoM5(id, tx);
      const asociaciones = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: id } });
      const ids = new Set(asociaciones.map(a => a.id_asociacion_m5));
      const datos = distribuciones.map(item => ({ idAsociacion: identificador(valorEntrada(item, 'idAsociacion', 'id_asociacion')), idCategoria: identificador(valorEntrada(item, 'idCategoria', 'id_categoria')), monto: montoPositivo(item.monto) }));
      if (!datos.length || datos.some(item => !ids.has(item.idAsociacion))) throw new ErrorAplicacion(404, 'Asociación documental no encontrada');
      const categorias = await tx.categoria_egreso_m5.findMany({ where: { id_categoria_egreso_m5: { in: datos.map(d => d.idCategoria) }, activo: true } });
      if (new Set(datos.map(d => d.idCategoria)).size !== categorias.length) throw new ErrorAplicacion(404, 'Categoría de egreso activa no encontrada');
      for (const asociacion of asociaciones) if (!datos.filter(d => d.idAsociacion === asociacion.id_asociacion_m5).reduce((s, d) => s.plus(d.monto), new Prisma.Decimal(0)).equals(asociacion.monto_asignado)) throw new ErrorAplicacion(400, 'La clasificación debe cuadrar exactamente con cada asociación');
      await tx.clasificacion_asociacion_m5.deleteMany({ where: { id_asociacion_m5: { in: [...ids] } } });
      await tx.clasificacion_asociacion_m5.createMany({ data: datos.map(d => ({ id_asociacion_m5: d.idAsociacion, id_categoria_egreso_m5: d.idCategoria, nombre_categoria_snapshot: categorias.find(c => c.id_categoria_egreso_m5 === d.idCategoria)!.nombre, monto: d.monto })) });
      return { mensaje: 'Clasificación guardada', cantidad: datos.length };
    });
  }

  async prepararImputacionDocumento(id: number, entrada: Entrada, usuario: bigint) {
    const distribuciones = Array.isArray(entrada.distribuciones) ? entrada.distribuciones as Entrada[] : [];
    return prisma.$transaction(async tx => {
      await this.documentoM5(id, tx);
      const clasificaciones = await tx.clasificacion_asociacion_m5.findMany({ where: { id_asociacion_m5: { in: (await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: id } })).map(a => a.id_asociacion_m5) } } });
      const datos = distribuciones.map(item => ({ idClasificacion: identificador(valorEntrada(item, 'idClasificacion', 'id_clasificacion')), destino: texto(item.destino, 20).toLowerCase(), idProyecto: item.idProyecto ? BigInt(String(item.idProyecto)) : null, idOt: item.idOrdenTrabajo ? BigInt(String(item.idOrdenTrabajo)) : null, monto: montoPositivo(item.monto) }));
      for (const clasificacion of clasificaciones) if (!datos.filter(d => d.idClasificacion === clasificacion.id_clasificacion_m5).reduce((s, d) => s.plus(d.monto), new Prisma.Decimal(0)).equals(clasificacion.monto)) throw new ErrorAplicacion(400, 'La imputación debe cuadrar exactamente con cada clasificación');
      for (const item of datos) {
        if (!['general','proyecto'].includes(item.destino)) throw new ErrorAplicacion(400, 'Destino de imputación inválido');
        if (item.destino === 'proyecto') {
          const proyecto = item.idProyecto ? await tx.proyecto.findUnique({ where: { proyecto_proyecto_id: item.idProyecto } }) : null;
          if (!proyecto) throw new ErrorAplicacion(404, 'Proyecto no encontrado');
          if (proyecto.proyecto_estado_operacional?.toLowerCase() !== 'activo') throw new ErrorAplicacion(409, 'El proyecto no está activo');
          if (item.idOt) { const ot = await tx.orden_trabajo.findUnique({ where: { orden_trabajo_id_orden: item.idOt } }); if (!ot) throw new ErrorAplicacion(404, 'Orden de Trabajo no encontrada'); if (ot.proyecto_id_proyecto !== item.idProyecto) throw new ErrorAplicacion(400, 'La Orden de Trabajo no pertenece al Proyecto'); }
        } else if (item.idProyecto || item.idOt) throw new ErrorAplicacion(400, 'Gasto general no admite Proyecto ni Orden de Trabajo');
      }
      const anterior = await tx.propuesta_imputacion_m5.findFirst({ where: { id_documento_m5: id, estado: 'pendiente' } });
      if (anterior) { await tx.detalle_imputacion_m5.deleteMany({ where: { id_propuesta_imputacion_m5: anterior.id_propuesta_imputacion_m5 } }); await tx.propuesta_imputacion_m5.delete({ where: { id_propuesta_imputacion_m5: anterior.id_propuesta_imputacion_m5 } }); }
      const propuesta = await tx.propuesta_imputacion_m5.create({ data: { id_documento_m5: id, preparado_por: usuario } });
      await tx.detalle_imputacion_m5.createMany({ data: datos.map(d => ({ id_propuesta_imputacion_m5: propuesta.id_propuesta_imputacion_m5, id_clasificacion_m5: d.idClasificacion, destino: d.destino, id_proyecto: d.idProyecto, id_orden_trabajo: d.idOt, monto: d.monto })) });
      return { id: propuesta.id_propuesta_imputacion_m5, estado: propuesta.estado };
    });
  }

  async confirmarImputacionDocumento(id: number, propuestaId: number, usuario: bigint) {
    const propuesta = await prisma.propuesta_imputacion_m5.findFirst({ where: { id_propuesta_imputacion_m5: propuestaId, id_documento_m5: id, estado: 'pendiente' } });
    if (!propuesta) throw new ErrorAplicacion(409, 'Propuesta de imputación no disponible');
    return prisma.propuesta_imputacion_m5.update({ where: { id_propuesta_imputacion_m5: propuestaId }, data: { estado: 'confirmado', confirmado_por: usuario, fecha_confirmacion: new Date() } });
  }

  async registrarTipoCambioManual(id: number, entrada: Entrada, usuario: bigint) {
    const tasa = montoPositivo(valorEntrada(entrada, 'tipoCambio', 'tipo_cambio'));
    const justificacion = motivoObligatorio(entrada.justificacion); const origen = texto(entrada.origen, 40);
    if (!origen) throw new ErrorAplicacion(400, 'El origen o contexto de la tasa es obligatorio');
    const documento = await this.documentoM5(id);
    const moneda = await prisma.moneda.findUniqueOrThrow({ where: { id_moneda: documento.id_moneda } });
    if (moneda.codigo_moneda === 'CLP') throw new ErrorAplicacion(400, 'CLP no requiere tipo de cambio');
    return prisma.documento_proveedor_m5.update({ where: { id_documento_m5: id }, data: { tipo_cambio: tasa, tipo_cambio_origen: `manual:${origen}`, tipo_cambio_justificacion: justificacion, tipo_cambio_usuario: usuario, tipo_cambio_fecha: new Date() } });
  }

  async generarObligacionDocumento(id: number, usuario: bigint) {
    return prisma.$transaction(async tx => {
      const documento = await this.documentoM5(id, tx);
      if (documento.clase !== 'definitivo' || documento.estado !== 'borrador') throw new ErrorAplicacion(409, 'Documento definitivo no disponible para generar obligación');
      if (await tx.obligacion_proveedor_m5.findUnique({ where: { id_documento_m5: id } })) throw new ErrorAplicacion(409, 'El documento ya tiene obligación');
      const proveedor = await tx.proveedor.findUniqueOrThrow({ where: { id_proveedor: documento.id_proveedor } });
      if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor no está habilitado');
      const asociaciones = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: id } });
      if (!asociaciones.length || !asociaciones.reduce((s, a) => s.plus(a.monto_asignado), new Prisma.Decimal(0)).equals(documento.monto_total)) throw new ErrorAplicacion(409, 'La asociación documental no está completa');
      if (asociaciones.some(a => a.tipo_orden === 'OCI')) throw new ErrorAplicacion(409, 'La integración OCI aún no puede validarse');
      if (asociaciones.some(a => ['pendiente','rechazado'].includes(a.estado_excedente))) throw new ErrorAplicacion(409, 'Existe un excedente sin aprobación');
      if (!documento.fecha_vencimiento) throw new ErrorAplicacion(409, 'Falta determinar vencimiento');
      const clasificaciones = await tx.clasificacion_asociacion_m5.findMany({ where: { id_asociacion_m5: { in: asociaciones.map(a => a.id_asociacion_m5) } } });
      for (const a of asociaciones) if (!clasificaciones.filter(c => c.id_asociacion_m5 === a.id_asociacion_m5).reduce((s,c) => s.plus(c.monto), new Prisma.Decimal(0)).equals(a.monto_asignado)) throw new ErrorAplicacion(409, 'La clasificación no está completa');
      if (!await tx.propuesta_imputacion_m5.findFirst({ where: { id_documento_m5: id, estado: 'confirmado' } })) throw new ErrorAplicacion(409, 'La imputación no está confirmada');
      const moneda = await tx.moneda.findUniqueOrThrow({ where: { id_moneda: documento.id_moneda } });
      if (moneda.codigo_moneda !== 'CLP' && !documento.tipo_cambio) throw new ErrorAplicacion(409, 'Se requiere referencia cambiaria confirmada');
      const condicion = calcularCondicionTemporalObligacion({ saldo_actual: documento.monto_total, fecha_vencimiento: documento.fecha_vencimiento }, await this.umbralM5(tx))!;
      const obligacion = await tx.obligacion_proveedor_m5.create({ data: { id_documento_m5: id, id_proveedor: documento.id_proveedor, monto_original: documento.monto_total, id_moneda: documento.id_moneda, saldo_inicial: documento.monto_total, saldo_actual: documento.monto_total, fecha_emision: documento.fecha_emision, fecha_vencimiento: documento.fecha_vencimiento, estado_pago: 'Pendiente', condicion_temporal: condicion, condicion_pago_dias_snapshot: documento.condicion_pago_dias_snapshot, condicion_pago_tipo_snapshot: documento.condicion_pago_tipo_snapshot, tipo_cambio: documento.tipo_cambio, tipo_cambio_origen: documento.tipo_cambio_origen, generado_por: usuario } });
      for (const asociacion of asociaciones.filter(a => a.tipo_orden === 'OCS')) {
        const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: asociacion.id_ocs_m5! }, include: { efectos_financieros: true } });
        if (!orden || orden.id_proveedor !== documento.id_proveedor || orden.id_moneda !== documento.id_moneda || orden.estado_ocs !== 'abierta') throw new ErrorAplicacion(409, 'La OCS cambió y ya no está disponible');
        await tx.efecto_financiero_ocs_m5.create({ data: { id_ocs_m5: orden.id_orden_compra_servicio_m5, tipo_efecto: 'documento_definitivo', referencia: `DOC-M5-${id}`, monto_documentado: asociacion.monto_asignado } });
        const total = orden.efectos_financieros.reduce((s,e) => s.plus(e.monto_documentado), asociacion.monto_asignado);
        const evaluacion = evaluarCierreOcs(orden.monto_autorizado, total, asociacion.es_documento_final, asociacion.justificacion || '');
        if (evaluacion.puedeCerrar) { await tx.orden_compra_servicio_m5.update({ where: { id_orden_compra_servicio_m5: orden.id_orden_compra_servicio_m5 }, data: { estado_ocs: 'cerrada', fecha_actualizacion: new Date() } }); await tx.historial_orden_compra_servicio_m5.create({ data: { id_ocs_m5: orden.id_orden_compra_servicio_m5, campo: 'estado', valor_anterior: 'abierta', valor_nuevo: 'cerrada', motivo: asociacion.justificacion, usuario_id_usuario: usuario } }); }
      }
      await tx.documento_proveedor_m5.update({ where: { id_documento_m5: id }, data: { estado: 'confirmado', confirmado_por: usuario, fecha_confirmacion: new Date() } });
      return { id: obligacion.id_obligacion_m5, idDocumento: id, montoOriginal: Number(obligacion.monto_original), saldoInicial: Number(obligacion.saldo_inicial), saldoActual: Number(obligacion.saldo_actual), estadoPago: obligacion.estado_pago, condicionTemporal: obligacion.condicion_temporal };
    });
  }

  private async operacionPagoM5(id: number, tx: Transaccion | typeof prisma = prisma) {
    const operacion = await tx.operacion_pago_proveedor_m5.findUnique({ where: { id_operacion_pago_m5: id } });
    if (!operacion) throw new ErrorAplicacion(404, 'Operación de pago no encontrada');
    return operacion;
  }

  private async efectosMovimientosPago(tx: Transaccion | typeof prisma, ids: number[]) {
    const [anulaciones, reversas, conciliaciones] = await Promise.all([
      tx.anulacion_movimiento_pago_m5.findMany({ where: { id_movimiento_pago_m5: { in: ids } } }),
      tx.reversion_movimiento_pago_m5.findMany({ where: { id_movimiento_pago_m5: { in: ids } }, orderBy: [{ fecha_hora: 'asc' }, { id_reversion_movimiento_m5: 'asc' }] }),
      tx.conciliacion_movimiento_pago_m5.findMany({ where: { id_movimiento_pago_m5: { in: ids } }, orderBy: [{ fecha_hora: 'desc' }, { id_conciliacion_movimiento_m5: 'desc' }] }),
    ]);
    return { anulaciones, reversas, conciliaciones };
  }

  private async recalcularObligacionM5(tx: Transaccion, idObligacion: number) {
    const obligacion = await tx.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: idObligacion } });
    const movimientos = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_obligacion_m5: idObligacion, estado: 'Vigente' } });
    const operaciones = await tx.operacion_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: { in: movimientos.map(m => m.id_operacion_pago_m5) }, estado: 'confirmada' }, select: { id_operacion_pago_m5: true } });
    const confirmadas = new Set(operaciones.map(item => item.id_operacion_pago_m5));
    const vigentes = movimientos.filter(item => confirmadas.has(item.id_operacion_pago_m5));
    const efectos = await this.efectosMovimientosPago(tx, vigentes.map(item => item.id_movimiento_pago_m5));
    const ajustes = await tx.ajuste_obligacion_proveedor_m5.findMany({ where: { id_obligacion_m5: idObligacion, estado: 'confirmado' } });
    const compensaciones = await tx.detalle_compensacion_saldo_favor_m5.findMany({ where: { id_obligacion_m5: idObligacion } });
    const reversasCompensacion = await tx.reversion_compensacion_m5.findMany({ where: { id_detalle_compensacion_m5: { in: compensaciones.map(item => item.id_detalle_compensacion_m5) } } });
    const saldo = calcularSaldoObligacion(obligacion.saldo_inicial, vigentes.map(movimiento => ({
      montoOriginal: movimiento.monto_aplicado,
      montoAnulado: efectos.anulaciones.find(item => item.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5)?.monto_anulado || 0,
      montoRevertido: efectos.reversas.filter(item => item.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5).reduce((suma, item) => suma.plus(item.monto_revertido), new Prisma.Decimal(0)),
    })), ajustes.map(ajuste => ({ tipo: ajuste.tipo_ajuste as 'NC' | 'ND', monto: ajuste.monto_aplicado_obligacion })), compensaciones.map(item => ({ montoAplicado: item.monto_aplicado, montoRevertido: reversasCompensacion.filter(reversa => reversa.id_detalle_compensacion_m5 === item.id_detalle_compensacion_m5).reduce((suma, reversa) => suma.plus(reversa.monto_revertido), new Prisma.Decimal(0)) })));
    const estado = calcularEstadoPagoObligacion(obligacion.saldo_inicial, saldo);
    const condicion = calcularCondicionTemporalObligacion({ saldo_actual: saldo, fecha_vencimiento: obligacion.fecha_vencimiento }, await this.umbralM5(tx));
    return tx.obligacion_proveedor_m5.update({ where: { id_obligacion_m5: idObligacion }, data: { saldo_actual: saldo, estado_pago: estado, condicion_temporal: condicion } });
  }

  private nombreUsuario(usuario: { usuario_id_usuario: bigint; usuario_nombre_completo_primer_nombre_usuario: string | null; usuario_nombre_completo_primer_apellido_usuario: string | null; usuario_username: string | null } | undefined) {
    if (!usuario) return null;
    return [usuario.usuario_nombre_completo_primer_nombre_usuario, usuario.usuario_nombre_completo_primer_apellido_usuario].filter(Boolean).join(' ') || usuario.usuario_username || usuario.usuario_id_usuario.toString();
  }

  private async presentarOperacionPago(id: number, tx: Transaccion | typeof prisma = prisma) {
    const operacion = await this.operacionPagoM5(id, tx);
    const movimientos = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: id }, orderBy: { id_movimiento_pago_m5: 'asc' } });
    const idsMovimientos = movimientos.map(m => m.id_movimiento_pago_m5);
    const [proveedor, obligaciones, medios, monedas, asociaciones, efectos, usuarios, historialRespaldos] = await Promise.all([
      tx.proveedor.findUniqueOrThrow({ where: { id_proveedor: operacion.id_proveedor } }),
      tx.obligacion_proveedor_m5.findMany({ where: { id_obligacion_m5: { in: movimientos.map(m => m.id_obligacion_m5) } } }),
      tx.medio_pago.findMany({ where: { id_medio_pago: { in: movimientos.map(m => m.id_medio_pago) } } }),
      tx.moneda.findMany({ where: { id_moneda: { in: movimientos.map(m => m.id_moneda) } } }),
      tx.asociacion_respaldo_pago_m5.findMany({ where: { OR: [{ id_operacion_pago_m5: id }, { id_movimiento_pago_m5: { in: idsMovimientos } }] } }),
      this.efectosMovimientosPago(tx, idsMovimientos),
      tx.usuario.findMany({ where: { usuario_id_usuario: { in: [operacion.creado_por, operacion.preparado_por, operacion.confirmado_por].filter((valor): valor is bigint => valor !== null) } } }),
      tx.historial_respaldo_pago_m5.findMany({ where: { id_operacion_pago_m5: id }, orderBy: [{ fecha_hora: 'desc' }, { id_historial_respaldo_m5: 'desc' }] }),
    ]);
    const comisiones = await tx.comision_bancaria_m5.findMany({ where: { id_operacion_pago_m5: id }, orderBy: { fecha_registro: 'asc' } });
    const monedasComision = await tx.moneda.findMany({ where: { id_moneda: { in: comisiones.map(item => item.id_moneda) } } });
    const idsRespaldos = [...new Set([...asociaciones.map(a => a.id_respaldo_pago_m5), ...efectos.anulaciones.map(a => a.id_respaldo_pago_m5), ...efectos.reversas.map(r => r.id_respaldo_pago_m5), ...historialRespaldos.flatMap(item => [item.id_respaldo_anterior, item.id_respaldo_nuevo]), ...comisiones.map(item => item.id_respaldo_pago_m5)])];
    const respaldos = await tx.respaldo_pago_proveedor_m5.findMany({ where: { id_respaldo_pago_m5: { in: idsRespaldos } } });
    const total = movimientos.reduce((suma, movimiento) => suma.plus(movimiento.monto_aplicado), new Prisma.Decimal(0));
    const presentados = movimientos.map(movimiento => {
      const obligacion = obligaciones.find(o => o.id_obligacion_m5 === movimiento.id_obligacion_m5)!;
      const propuesto = movimientos.filter(m => m.id_obligacion_m5 === movimiento.id_obligacion_m5).reduce((suma, m) => suma.plus(m.monto_aplicado), new Prisma.Decimal(0));
      const anulacion = efectos.anulaciones.find(item => item.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5);
      const reversas = efectos.reversas.filter(item => item.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5);
      const montoRevertido = reversas.reduce((suma, item) => suma.plus(item.monto_revertido), new Prisma.Decimal(0));
      const efecto = { montoOriginal: movimiento.monto_aplicado, montoAnulado: anulacion?.monto_anulado || 0, montoRevertido };
      const conciliacion = efectos.conciliaciones.find(item => item.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5);
      return {
        id: movimiento.id_movimiento_pago_m5, idObligacion: movimiento.id_obligacion_m5, idMedioPago: movimiento.id_medio_pago,
        medioPago: medios.find(m => m.id_medio_pago === movimiento.id_medio_pago)?.nombre_medio_pago,
        moneda: monedas.find(m => m.id_moneda === movimiento.id_moneda)?.codigo_moneda, montoAplicado: Number(movimiento.monto_aplicado), saldoActual: Number(obligacion.saldo_actual), conflictoSaldo: operacion.estado !== 'confirmada' && propuesto.gt(obligacion.saldo_actual),
        tasaReferencia: movimiento.tasa_referencia === null ? null : Number(movimiento.tasa_referencia), fuenteTasa: movimiento.fuente_tasa, tasaBancariaEfectiva: movimiento.tasa_bancaria_efectiva === null ? null : Number(movimiento.tasa_bancaria_efectiva), equivalenteClp: movimiento.equivalente_clp === null ? null : Number(movimiento.equivalente_clp), tasaManual: movimiento.tasa_manual,
        estado: operacion.estado === 'confirmada' ? derivarEstadoMovimientoPago(efecto) : movimiento.estado,
        tieneRespaldo: asociaciones.some(a => a.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5),
        montoAnulado: Number(anulacion?.monto_anulado || 0), montoRevertido: Number(montoRevertido), montoNetoVigente: Number(calcularEfectoNetoMovimiento(efecto)),
        conciliacion: conciliacion ? { estado: conciliacion.resultado, observacion: conciliacion.observacion, usuario: conciliacion.usuario_id_usuario.toString(), fecha: conciliacion.fecha_hora } : { estado: 'pendiente', observacion: null, usuario: null, fecha: null },
        respaldos: asociaciones.filter(a => a.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5).map(a => respaldos.find(r => r.id_respaldo_pago_m5 === a.id_respaldo_pago_m5)).filter(Boolean).map(r => ({ id: r!.id_respaldo_pago_m5, nombre: r!.nombre_archivo })),
        anulacion: anulacion ? { monto: Number(anulacion.monto_anulado), motivo: anulacion.motivo, usuario: anulacion.usuario_id_usuario.toString(), fecha: anulacion.fecha_hora, respaldo: respaldos.find(r => r.id_respaldo_pago_m5 === anulacion.id_respaldo_pago_m5)?.nombre_archivo } : null,
        reversas: reversas.map(reversa => ({ id: reversa.id_reversion_movimiento_m5, monto: Number(reversa.monto_revertido), motivo: reversa.motivo, usuario: reversa.usuario_id_usuario.toString(), fecha: reversa.fecha_hora, respaldo: respaldos.find(r => r.id_respaldo_pago_m5 === reversa.id_respaldo_pago_m5)?.nombre_archivo })),
      };
    });
    return {
      id: operacion.id_operacion_pago_m5, estado: operacion.estado, estadoAgregado: operacion.estado === 'confirmada' ? derivarEstadoOperacionPago(presentados.map(item => item.estado)) : operacion.estado, fechaEfectivaPago: operacion.fecha_efectiva_pago,
      proveedor: { id: proveedor.id_proveedor, razonSocial: proveedor.nombre_razon_social, identificadorFiscal: proveedor.identificador_tributario, estado: proveedor.estado_proveedor },
      total: Number(total), totalConfirmado: operacion.total_confirmado === null ? null : Number(operacion.total_confirmado),
      tieneRespaldo: asociaciones.some(a => a.id_operacion_pago_m5 === id),
      respaldos: asociaciones.filter(a => a.id_operacion_pago_m5 === id).map(a => respaldos.find(r => r.id_respaldo_pago_m5 === a.id_respaldo_pago_m5)).filter(Boolean).map(r => ({ id: r!.id_respaldo_pago_m5, nombre: r!.nombre_archivo })),
      historialRespaldos: historialRespaldos.map(item => ({ id: item.id_historial_respaldo_m5, idMovimiento: item.id_movimiento_pago_m5, anterior: { id: item.id_respaldo_anterior, nombre: respaldos.find(r => r.id_respaldo_pago_m5 === item.id_respaldo_anterior)?.nombre_archivo }, nuevo: { id: item.id_respaldo_nuevo, nombre: respaldos.find(r => r.id_respaldo_pago_m5 === item.id_respaldo_nuevo)?.nombre_archivo }, motivo: item.motivo, usuario: item.usuario_id_usuario.toString(), fecha: item.fecha_hora })),
      movimientos: presentados,
      comisiones: comisiones.map(item => ({ id: item.id_comision_bancaria_m5, idMovimiento: item.id_movimiento_pago_m5, monto: Number(item.monto), moneda: monedasComision.find(moneda => moneda.id_moneda === item.id_moneda)?.codigo_moneda || 'No disponible', equivalenteClp: item.equivalente_clp === null ? null : Number(item.equivalente_clp), fecha: item.fecha_comision, descripcion: item.descripcion, respaldo: respaldos.find(r => r.id_respaldo_pago_m5 === item.id_respaldo_pago_m5)?.nombre_archivo })),
      creadoPor: this.nombreUsuario(usuarios.find(u => u.usuario_id_usuario === operacion.creado_por)) || operacion.creado_por.toString(), fechaCreacion: operacion.fecha_creacion,
      preparadoPor: this.nombreUsuario(usuarios.find(u => u.usuario_id_usuario === operacion.preparado_por)), fechaPreparacion: operacion.fecha_preparacion,
      confirmadoPor: this.nombreUsuario(usuarios.find(u => u.usuario_id_usuario === operacion.confirmado_por)), fechaConfirmacion: operacion.fecha_confirmacion,
    };
  }

  async buscarProveedoresParaPago(consulta: Record<string, unknown>) {
    const busqueda = texto(consulta.busqueda, 120);
    const proveedores = await prisma.proveedor.findMany({
      where: { estado_proveedor: 'activo', OR: busqueda ? [{ nombre_razon_social: { contains: busqueda, mode: 'insensitive' } }, { identificador_tributario: { contains: busqueda, mode: 'insensitive' } }] : undefined },
      orderBy: [{ nombre_razon_social: 'asc' }, { id_proveedor: 'asc' }],
    });
    const obligaciones = await prisma.obligacion_proveedor_m5.findMany({ where: { id_proveedor: { in: proveedores.map(p => p.id_proveedor) }, saldo_actual: { gt: 0 } }, orderBy: [{ fecha_vencimiento: 'asc' }, { id_obligacion_m5: 'asc' }] });
    const monedas = await prisma.moneda.findMany({ where: { id_moneda: { in: obligaciones.map(o => o.id_moneda) } } });
    return proveedores.map(proveedor => ({ id: proveedor.id_proveedor, razonSocial: proveedor.nombre_razon_social, identificadorFiscal: proveedor.identificador_tributario, obligaciones: obligaciones.filter(o => o.id_proveedor === proveedor.id_proveedor).map(o => ({ id: o.id_obligacion_m5, moneda: monedas.find(m => m.id_moneda === o.id_moneda)?.codigo_moneda, saldoActual: Number(o.saldo_actual), montoOriginal: Number(o.monto_original), fechaVencimiento: o.fecha_vencimiento })) })).filter(proveedor => proveedor.obligaciones.length > 0);
  }

  async catalogosPagosProveedores() {
    const [medios, monedas] = await Promise.all([prisma.medio_pago.findMany({ where: { estado_medio_pago: 'activo' }, orderBy: { nombre_medio_pago: 'asc' } }), prisma.moneda.findMany({ where: { estado_moneda: 'activo' }, orderBy: { codigo_moneda: 'asc' } })]);
    return { medios: medios.map(m => ({ id: m.id_medio_pago, nombre: m.nombre_medio_pago })), monedas: monedas.map(m => ({ id: m.id_moneda, codigo: m.codigo_moneda, simbolo: m.simbolo_moneda })) };
  }

  async crearOperacionPago(entrada: Entrada, usuario: bigint) {
    const idProveedor = identificador(valorEntrada(entrada, 'idProveedor', 'id_proveedor'));
    const proveedor = await prisma.proveedor.findUnique({ where: { id_proveedor: idProveedor } });
    if (!proveedor || proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor no está habilitado para iniciar pagos');
    if (!await prisma.obligacion_proveedor_m5.findFirst({ where: { id_proveedor: idProveedor, saldo_actual: { gt: 0 } } })) throw new ErrorAplicacion(409, 'El proveedor no tiene obligaciones pendientes');
    const fecha = valorEntrada(entrada, 'fechaEfectivaPago', 'fecha_pago');
    return this.presentarOperacionPago((await prisma.operacion_pago_proveedor_m5.create({ data: { id_proveedor: idProveedor, creado_por: usuario, fecha_efectiva_pago: fecha ? fechaEntrada(fecha, 'Fecha efectiva de pago') : null } })).id_operacion_pago_m5);
  }

  async listarBorradoresPago() {
    const operaciones = await prisma.operacion_pago_proveedor_m5.findMany({ where: { estado: { in: ['borrador','preparada'] } }, orderBy: [{ fecha_creacion: 'desc' }, { id_operacion_pago_m5: 'desc' }] });
    return Promise.all(operaciones.map(operacion => this.presentarOperacionPago(operacion.id_operacion_pago_m5)));
  }

  async obtenerOperacionPago(id: number) { return this.presentarOperacionPago(id); }

  async listarPagosConfirmados() {
    const operaciones = await prisma.operacion_pago_proveedor_m5.findMany({ where: { estado: 'confirmada' }, orderBy: [{ fecha_confirmacion: 'desc' }, { id_operacion_pago_m5: 'desc' }] });
    return Promise.all(operaciones.map(operacion => this.presentarOperacionPago(operacion.id_operacion_pago_m5)));
  }

  async consultarDetallePagoProveedor(id: number) {
    const operacion = await this.operacionPagoM5(id);
    if (operacion.estado !== 'confirmada') throw new ErrorAplicacion(409, 'El detalle postpago sólo está disponible para operaciones confirmadas');
    return this.presentarOperacionPago(id);
  }

  private async datosMovimientoPago(idOperacion: number, entrada: Entrada, excluir?: number) {
    const operacion = await this.operacionPagoM5(idOperacion);
    if (operacion.estado !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se editan operaciones en borrador');
    const idObligacion = identificador(valorEntrada(entrada, 'idObligacion', 'id_obligacion_m5'));
    const idMedio = identificador(valorEntrada(entrada, 'idMedioPago', 'id_medio_pago'));
    const monto = montoPositivo(valorEntrada(entrada, 'montoAplicado', 'monto'));
    const [obligacion, medio, moneda, movimientos] = await Promise.all([
      prisma.obligacion_proveedor_m5.findUnique({ where: { id_obligacion_m5: idObligacion } }), prisma.medio_pago.findUnique({ where: { id_medio_pago: idMedio } }),
      prisma.obligacion_proveedor_m5.findUnique({ where: { id_obligacion_m5: idObligacion } }).then(o => o ? prisma.moneda.findUnique({ where: { id_moneda: o.id_moneda } }) : null),
      prisma.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: idOperacion, id_obligacion_m5: idObligacion, id_movimiento_pago_m5: excluir ? { not: excluir } : undefined } }),
    ]);
    if (!obligacion || obligacion.id_proveedor !== operacion.id_proveedor || obligacion.saldo_actual.lte(0)) throw new ErrorAplicacion(409, 'La obligación no es elegible para este proveedor');
    if (!medio || medio.estado_medio_pago !== 'activo') throw new ErrorAplicacion(409, 'Selecciona un medio de pago activo');
    if (movimientos.reduce((suma, actual) => suma.plus(actual.monto_aplicado), monto).gt(obligacion.saldo_actual)) throw new ErrorAplicacion(409, 'La suma de movimientos supera el saldo actual de la obligación');
    const tasaBancariaEntrada = valorEntrada(entrada, 'tasaBancariaEfectiva', 'tasa_bancaria_efectiva');
    const tasaBancaria = tasaBancariaEntrada === undefined || tasaBancariaEntrada === null || tasaBancariaEntrada === '' ? null : montoPositivo(tasaBancariaEntrada);
    let tasaReferencia: Prisma.Decimal | null = null; let fuenteTasa: string | null = null;
    if (moneda?.codigo_moneda !== 'CLP' && operacion.fecha_efectiva_pago) {
      try { tasaReferencia = new Prisma.Decimal(await this.bancoCentral.obtenerTipoCambio(moneda!.codigo_moneda, fechaRegistro(operacion.fecha_efectiva_pago))); fuenteTasa = 'C_BancoCentral'; } catch (error) { if (!(error instanceof ErrorAplicacion)) throw error; }
    }
    const tasaClp = tasaBancaria || tasaReferencia;
    return { id_operacion_pago_m5: idOperacion, id_obligacion_m5: idObligacion, id_medio_pago: idMedio, id_moneda: obligacion.id_moneda, monto_aplicado: monto, tasa_referencia: tasaReferencia, fuente_tasa: fuenteTasa, fecha_tasa: tasaReferencia ? operacion.fecha_efectiva_pago : null, tasa_bancaria_efectiva: tasaBancaria, equivalente_clp: moneda?.codigo_moneda === 'CLP' ? monto : tasaClp ? monto.mul(tasaClp).toDecimalPlaces(2) : null };
  }

  async agregarMovimientoPago(idOperacion: number, entrada: Entrada) {
    const datos = await this.datosMovimientoPago(idOperacion, entrada);
    const movimiento = await prisma.movimiento_pago_proveedor_m5.create({ data: datos });
    return this.presentarOperacionPago(movimiento.id_operacion_pago_m5);
  }

  async actualizarMovimientoPago(idOperacion: number, idMovimiento: number, entrada: Entrada) {
    const actual = await prisma.movimiento_pago_proveedor_m5.findFirst({ where: { id_movimiento_pago_m5: idMovimiento, id_operacion_pago_m5: idOperacion } });
    if (!actual) throw new ErrorAplicacion(404, 'Movimiento no encontrado');
    const datos = await this.datosMovimientoPago(idOperacion, entrada, idMovimiento);
    await prisma.movimiento_pago_proveedor_m5.update({ where: { id_movimiento_pago_m5: idMovimiento }, data: { ...datos, tasa_manual: false, tasa_manual_justificacion: null, tasa_manual_usuario: null, tasa_manual_fecha: null } });
    return this.presentarOperacionPago(idOperacion);
  }

  async adjuntarRespaldoPago(idOperacion: number, entrada: Entrada, usuario: bigint) {
    const operacion = await this.operacionPagoM5(idOperacion);
    if (operacion.estado !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se adjuntan respaldos a un borrador');
    const nombre = texto(valorEntrada(entrada, 'nombreArchivo', 'nombre'), 255); const contenido = texto(entrada.contenido, 4500000);
    if (!nombre || !contenido) throw new ErrorAplicacion(400, 'Nombre y contenido del respaldo son obligatorios');
    const ids = Array.isArray(entrada.movimientos) ? entrada.movimientos.map(identificador) : [];
    const movimientos = await prisma.movimiento_pago_proveedor_m5.findMany({ where: { id_movimiento_pago_m5: { in: ids }, id_operacion_pago_m5: idOperacion } });
    if (movimientos.length !== new Set(ids).size) throw new ErrorAplicacion(400, 'Uno de los movimientos no pertenece a la operación');
    const asociarOperacion = entrada.operacion !== false;
    if (!asociarOperacion && !ids.length) throw new ErrorAplicacion(400, 'Selecciona la operación o al menos un movimiento');
    await prisma.$transaction(async tx => {
      const respaldo = await tx.respaldo_pago_proveedor_m5.create({ data: { nombre_archivo: nombre, contenido, creado_por: usuario } });
      await tx.asociacion_respaldo_pago_m5.createMany({ data: [...(asociarOperacion ? [{ id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, id_operacion_pago_m5: idOperacion }] : []), ...ids.map(id => ({ id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, id_movimiento_pago_m5: id }))] });
    });
    return this.presentarOperacionPago(idOperacion);
  }

  private async crearRespaldoPostPago(tx: Transaccion, entrada: Entrada, usuario: bigint) {
    const nombre = texto(valorEntrada(entrada, 'nombreArchivo', 'nombre'), 255); const contenido = texto(entrada.contenido, 4500000);
    if (!nombre || !contenido) throw new ErrorAplicacion(400, 'El respaldo es obligatorio');
    return tx.respaldo_pago_proveedor_m5.create({ data: { nombre_archivo: nombre, contenido, creado_por: usuario } });
  }

  async reemplazarRespaldoPago(idOperacion: number, idRespaldo: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    await prisma.$transaction(async tx => {
      const operacion = await this.operacionPagoM5(idOperacion, tx);
      if (operacion.estado !== 'confirmada') throw new ErrorAplicacion(409, 'Sólo puede corregirse evidencia de una operación confirmada');
      const asociaciones = await tx.asociacion_respaldo_pago_m5.findMany({ where: { id_respaldo_pago_m5: idRespaldo, OR: [{ id_operacion_pago_m5: idOperacion }, { id_movimiento_pago_m5: { not: null } }] } });
      const movimientos = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: idOperacion }, select: { id_movimiento_pago_m5: true } });
      const idsMovimiento = new Set(movimientos.map(item => item.id_movimiento_pago_m5));
      const asociacion = asociaciones.find(item => item.id_operacion_pago_m5 === idOperacion || item.id_movimiento_pago_m5 !== null && idsMovimiento.has(item.id_movimiento_pago_m5));
      if (!asociacion) throw new ErrorAplicacion(404, 'El respaldo no pertenece a la operación confirmada');
      const nuevo = await this.crearRespaldoPostPago(tx, entrada, usuario);
      await tx.asociacion_respaldo_pago_m5.create({ data: { id_respaldo_pago_m5: nuevo.id_respaldo_pago_m5, id_operacion_pago_m5: asociacion.id_operacion_pago_m5, id_movimiento_pago_m5: asociacion.id_movimiento_pago_m5 } });
      await tx.historial_respaldo_pago_m5.create({ data: { id_operacion_pago_m5: idOperacion, id_movimiento_pago_m5: asociacion.id_movimiento_pago_m5, id_respaldo_anterior: idRespaldo, id_respaldo_nuevo: nuevo.id_respaldo_pago_m5, motivo, usuario_id_usuario: usuario } });
    });
    return this.presentarOperacionPago(idOperacion);
  }

  private async movimientoPostPago(tx: Transaccion, idOperacion: number, idMovimiento: number) {
    const operacion = await this.operacionPagoM5(idOperacion, tx);
    if (operacion.estado !== 'confirmada') throw new ErrorAplicacion(409, 'La operación debe estar confirmada');
    const movimiento = await tx.movimiento_pago_proveedor_m5.findFirst({ where: { id_movimiento_pago_m5: idMovimiento, id_operacion_pago_m5: idOperacion, estado: 'Vigente' } });
    if (!movimiento) throw new ErrorAplicacion(404, 'Movimiento confirmado no encontrado');
    return movimiento;
  }

  private async efectoMovimientoPostPago(tx: Transaccion, movimiento: { id_movimiento_pago_m5: number; monto_aplicado: Prisma.Decimal }) {
    const efectos = await this.efectosMovimientosPago(tx, [movimiento.id_movimiento_pago_m5]);
    const anulacion = efectos.anulaciones[0];
    const revertido = efectos.reversas.reduce((suma, item) => suma.plus(item.monto_revertido), new Prisma.Decimal(0));
    const efecto = { montoOriginal: movimiento.monto_aplicado, montoAnulado: anulacion?.monto_anulado || 0, montoRevertido: revertido };
    return { ...efectos, anulacion, revertido, neto: calcularEfectoNetoMovimiento(efecto) };
  }

  async registrarTipoCambioManualPago(idOperacion: number, idMovimiento: number, entrada: Entrada, usuario: bigint, perfil: string) {
    if (!['gerencia','contador'].includes(perfil)) throw new ErrorAplicacion(403, 'Sólo Gerencia o Contador pueden ingresar una tasa manual');
    const operacion = await this.operacionPagoM5(idOperacion); if (operacion.estado !== 'borrador') throw new ErrorAplicacion(409, 'La operación ya no admite cambios');
    const movimiento = await prisma.movimiento_pago_proveedor_m5.findFirst({ where: { id_movimiento_pago_m5: idMovimiento, id_operacion_pago_m5: idOperacion } });
    if (!movimiento) throw new ErrorAplicacion(404, 'Movimiento no encontrado');
    const moneda = await prisma.moneda.findUniqueOrThrow({ where: { id_moneda: movimiento.id_moneda } }); if (moneda.codigo_moneda === 'CLP') throw new ErrorAplicacion(400, 'CLP no requiere tipo de cambio');
    const tasa = montoPositivo(valorEntrada(entrada, 'tasaReferencia', 'tasa')); const justificacion = motivoObligatorio(entrada.justificacion);
    const bancariaEntrada = valorEntrada(entrada, 'tasaBancariaEfectiva', 'tasa_bancaria_efectiva'); const bancaria = bancariaEntrada === undefined || bancariaEntrada === null || bancariaEntrada === '' ? null : montoPositivo(bancariaEntrada);
    await prisma.movimiento_pago_proveedor_m5.update({ where: { id_movimiento_pago_m5: idMovimiento }, data: { tasa_referencia: tasa, fuente_tasa: 'manual', fecha_tasa: operacion.fecha_efectiva_pago, tasa_manual: true, tasa_manual_justificacion: justificacion, tasa_manual_usuario: usuario, tasa_manual_fecha: new Date(), tasa_bancaria_efectiva: bancaria, equivalente_clp: movimiento.monto_aplicado.mul(bancaria || tasa).toDecimalPlaces(2) } });
    return this.presentarOperacionPago(idOperacion);
  }

  private async validarOperacionPago(tx: Transaccion, idOperacion: number) {
    const operacion = await this.operacionPagoM5(idOperacion, tx);
    if (!['borrador','preparada'].includes(operacion.estado)) throw new ErrorAplicacion(409, 'La operación ya no está disponible');
    if (!operacion.fecha_efectiva_pago) throw new ErrorAplicacion(409, 'Falta la fecha efectiva de pago');
    const proveedor = await tx.proveedor.findUnique({ where: { id_proveedor: operacion.id_proveedor } }); if (!proveedor || proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor ya no está habilitado');
    const movimientos = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: idOperacion } }); if (!movimientos.length) throw new ErrorAplicacion(409, 'La operación requiere al menos un movimiento');
    const [obligaciones, medios, monedas, respaldos] = await Promise.all([tx.obligacion_proveedor_m5.findMany({ where: { id_obligacion_m5: { in: movimientos.map(m => m.id_obligacion_m5) } } }), tx.medio_pago.findMany({ where: { id_medio_pago: { in: movimientos.map(m => m.id_medio_pago) } } }), tx.moneda.findMany({ where: { id_moneda: { in: movimientos.map(m => m.id_moneda) } } }), tx.asociacion_respaldo_pago_m5.findMany({ where: { OR: [{ id_operacion_pago_m5: idOperacion }, { id_movimiento_pago_m5: { in: movimientos.map(m => m.id_movimiento_pago_m5) } }] } })]);
    if (!respaldos.some(r => r.id_operacion_pago_m5 === idOperacion)) throw new ErrorAplicacion(409, 'La operación requiere respaldo');
    for (const movimiento of movimientos) {
      const obligacion = obligaciones.find(o => o.id_obligacion_m5 === movimiento.id_obligacion_m5); const medio = medios.find(m => m.id_medio_pago === movimiento.id_medio_pago); const moneda = monedas.find(m => m.id_moneda === movimiento.id_moneda);
      if (!obligacion || obligacion.id_proveedor !== operacion.id_proveedor || obligacion.saldo_actual.lte(0)) throw new ErrorAplicacion(409, 'Una obligación ya no está disponible');
      if (!medio || medio.estado_medio_pago !== 'activo') throw new ErrorAplicacion(409, 'Un medio de pago ya no está activo');
      if (!respaldos.some(r => r.id_movimiento_pago_m5 === movimiento.id_movimiento_pago_m5)) throw new ErrorAplicacion(409, 'Todos los movimientos requieren respaldo');
      if (moneda?.codigo_moneda !== 'CLP' && (!movimiento.tasa_referencia || !movimiento.equivalente_clp)) throw new ErrorAplicacion(409, 'Falta resolver la tasa de un movimiento en moneda extranjera');
    }
    const porObligacion = new Map<number, Prisma.Decimal>(); for (const movimiento of movimientos) porObligacion.set(movimiento.id_obligacion_m5, (porObligacion.get(movimiento.id_obligacion_m5) || new Prisma.Decimal(0)).plus(movimiento.monto_aplicado));
    for (const [id, monto] of porObligacion) if (monto.gt(obligaciones.find(o => o.id_obligacion_m5 === id)!.saldo_actual)) throw new ErrorAplicacion(409, 'La operación supera el saldo actual de una obligación');
    return { operacion, movimientos, obligaciones, porObligacion, total: movimientos.reduce((suma, m) => suma.plus(m.monto_aplicado), new Prisma.Decimal(0)) };
  }

  async prepararOperacionPago(id: number, usuario: bigint) {
    await prisma.$transaction(async tx => { await this.validarOperacionPago(tx, id); await tx.operacion_pago_proveedor_m5.update({ where: { id_operacion_pago_m5: id }, data: { estado: 'preparada', preparado_por: usuario, fecha_preparacion: new Date() } }); });
    return this.presentarOperacionPago(id);
  }

  async guardarBorradorPago(id: number, entrada: Entrada) {
    const operacion = await this.operacionPagoM5(id); if (operacion.estado !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se guarda una operación en borrador');
    const fecha = valorEntrada(entrada, 'fechaEfectivaPago', 'fecha_pago');
    if (fecha !== undefined) {
      const nuevaFecha = fecha ? fechaEntrada(fecha, 'Fecha efectiva de pago') : null;
      await prisma.operacion_pago_proveedor_m5.update({ where: { id_operacion_pago_m5: id }, data: { fecha_efectiva_pago: nuevaFecha } });
      if (nuevaFecha && fechaRegistro(nuevaFecha) !== (operacion.fecha_efectiva_pago ? fechaRegistro(operacion.fecha_efectiva_pago) : null)) {
        const movimientos = await prisma.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: id } }); const monedas = await prisma.moneda.findMany({ where: { id_moneda: { in: movimientos.map(m => m.id_moneda) } } });
        for (const movimiento of movimientos.filter(m => monedas.find(moneda => moneda.id_moneda === m.id_moneda)?.codigo_moneda !== 'CLP')) {
          try { const tasa = new Prisma.Decimal(await this.bancoCentral.obtenerTipoCambio(monedas.find(moneda => moneda.id_moneda === movimiento.id_moneda)!.codigo_moneda, fechaRegistro(nuevaFecha))); await prisma.movimiento_pago_proveedor_m5.update({ where: { id_movimiento_pago_m5: movimiento.id_movimiento_pago_m5 }, data: { tasa_referencia: tasa, fuente_tasa: 'C_BancoCentral', fecha_tasa: nuevaFecha, tasa_manual: false, tasa_manual_justificacion: null, tasa_manual_usuario: null, tasa_manual_fecha: null, tasa_bancaria_efectiva: null, equivalente_clp: movimiento.monto_aplicado.mul(tasa).toDecimalPlaces(2) } }); }
          catch (error) { if (!(error instanceof ErrorAplicacion)) throw error; await prisma.movimiento_pago_proveedor_m5.update({ where: { id_movimiento_pago_m5: movimiento.id_movimiento_pago_m5 }, data: { tasa_referencia: null, fuente_tasa: null, fecha_tasa: null, tasa_manual: false, tasa_manual_justificacion: null, tasa_manual_usuario: null, tasa_manual_fecha: null, tasa_bancaria_efectiva: null, equivalente_clp: null } }); }
        }
      }
    }
    return this.presentarOperacionPago(id);
  }

  async retomarOperacionPago(id: number) { const operacion = await this.operacionPagoM5(id); if (operacion.estado !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se retoman operaciones en borrador'); return this.presentarOperacionPago(id); }

  async descartarOperacionPago(id: number, usuario: bigint) {
    const operacion = await this.operacionPagoM5(id); if (operacion.estado !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se descartan operaciones en borrador');
    await prisma.operacion_pago_proveedor_m5.update({ where: { id_operacion_pago_m5: id }, data: { estado: 'descartada', descartado_por: usuario, fecha_descarte: new Date() } }); return this.presentarOperacionPago(id);
  }

  async confirmarOperacionPago(id: number, usuario: bigint) {
    try {
      await prisma.$transaction(async tx => {
        const validacion = await this.validarOperacionPago(tx, id); if (validacion.operacion.estado !== 'preparada') throw new ErrorAplicacion(409, 'La operación debe estar preparada antes de confirmar');
        await tx.movimiento_pago_proveedor_m5.updateMany({ where: { id_operacion_pago_m5: id }, data: { estado: 'Vigente' } });
        await tx.operacion_pago_proveedor_m5.update({ where: { id_operacion_pago_m5: id }, data: { estado: 'confirmada', confirmado_por: usuario, fecha_confirmacion: new Date(), total_confirmado: validacion.total } });
        for (const idObligacion of validacion.porObligacion.keys()) await this.recalcularObligacionM5(tx, idObligacion);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente: vuelve a revisar los saldos'); throw error; }
    return this.presentarOperacionPago(id);
  }

  async anularMovimientoPago(idOperacion: number, idMovimiento: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    try {
      await prisma.$transaction(async tx => {
        const movimiento = await this.movimientoPostPago(tx, idOperacion, idMovimiento); const efecto = await this.efectoMovimientoPostPago(tx, movimiento);
        if (efecto.anulacion || efecto.neto.lte(0)) throw new ErrorAplicacion(409, 'El movimiento no conserva efecto vigente anulable');
        const respaldo = await this.crearRespaldoPostPago(tx, entrada, usuario);
        await tx.anulacion_movimiento_pago_m5.create({ data: { id_movimiento_pago_m5: idMovimiento, monto_anulado: efecto.neto, motivo, id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, usuario_id_usuario: usuario } });
        await this.recalcularObligacionM5(tx, movimiento.id_obligacion_m5);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) throw new ErrorAplicacion(409, 'El movimiento cambió concurrentemente; vuelve a revisar el pago'); throw error; }
    return this.presentarOperacionPago(idOperacion);
  }

  async anularOperacionPago(idOperacion: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo); const grupo = randomUUID();
    try {
      await prisma.$transaction(async tx => {
        const operacion = await this.operacionPagoM5(idOperacion, tx); if (operacion.estado !== 'confirmada') throw new ErrorAplicacion(409, 'La operación debe estar confirmada');
        const movimientos = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: idOperacion, estado: 'Vigente' } });
        if (!movimientos.length) throw new ErrorAplicacion(409, 'La operación no contiene movimientos anulables');
        const calculados = await Promise.all(movimientos.map(async movimiento => ({ movimiento, efecto: await this.efectoMovimientoPostPago(tx, movimiento) })));
        if (calculados.some(item => item.efecto.anulacion || item.efecto.neto.lte(0))) throw new ErrorAplicacion(409, 'No es posible anular la operación completa porque uno de sus movimientos ya no conserva efecto anulable');
        const respaldo = await this.crearRespaldoPostPago(tx, entrada, usuario);
        await tx.anulacion_movimiento_pago_m5.createMany({ data: calculados.map(({ movimiento, efecto }) => ({ id_movimiento_pago_m5: movimiento.id_movimiento_pago_m5, monto_anulado: efecto.neto, motivo, id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, usuario_id_usuario: usuario, grupo_operacion: grupo })) });
        for (const idObligacion of new Set(movimientos.map(item => item.id_obligacion_m5))) await this.recalcularObligacionM5(tx, idObligacion);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) throw new ErrorAplicacion(409, 'La operación cambió concurrentemente y no fue anulada'); throw error; }
    return this.presentarOperacionPago(idOperacion);
  }

  async revertirMovimientoPago(idOperacion: number, idMovimiento: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo); const monto = montoPositivo(valorEntrada(entrada, 'monto', 'montoRevertido'));
    try {
      await prisma.$transaction(async tx => {
        const movimiento = await this.movimientoPostPago(tx, idOperacion, idMovimiento); const efecto = await this.efectoMovimientoPostPago(tx, movimiento);
        if (monto.gt(efecto.neto)) throw new ErrorAplicacion(409, 'La reversa supera el efecto neto vigente del movimiento');
        const respaldo = await this.crearRespaldoPostPago(tx, entrada, usuario);
        await tx.reversion_movimiento_pago_m5.create({ data: { id_movimiento_pago_m5: idMovimiento, monto_revertido: monto, motivo, id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, usuario_id_usuario: usuario } });
        await this.recalcularObligacionM5(tx, movimiento.id_obligacion_m5);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente: la reversa no fue registrada'); throw error; }
    return this.presentarOperacionPago(idOperacion);
  }

  async conciliarMovimientoPago(idOperacion: number, idMovimiento: number, entrada: Entrada, usuario: bigint) {
    const resultado = texto(entrada.resultado, 20).toLowerCase();
    if (!['conciliado','con_discrepancia'].includes(resultado)) throw new ErrorAplicacion(400, 'Resultado de conciliación inválido');
    const observacion = texto(entrada.observacion, 1000) || null;
    if (resultado === 'con_discrepancia' && !observacion) throw new ErrorAplicacion(400, 'La discrepancia requiere una observación');
    await prisma.$transaction(async tx => {
      await this.movimientoPostPago(tx, idOperacion, idMovimiento);
      await tx.conciliacion_movimiento_pago_m5.create({ data: { id_movimiento_pago_m5: idMovimiento, resultado, observacion, usuario_id_usuario: usuario } });
    });
    return this.presentarOperacionPago(idOperacion);
  }

  private async registrarEfectosOcsNotaDebito(tx: Transaccion, ajuste: { id_ajuste_obligacion_m5: number; id_documento_ajuste_m5: number }) {
    const asociaciones = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: ajuste.id_documento_ajuste_m5, tipo_orden: 'OCS' } });
    for (const asociacion of asociaciones) {
      if (!asociacion.id_ocs_m5) continue;
      const referencia = `AJUSTE-${ajuste.id_ajuste_obligacion_m5}-${asociacion.id_asociacion_m5}`;
      if (!await tx.efecto_financiero_ocs_m5.findFirst({ where: { id_ocs_m5: asociacion.id_ocs_m5, tipo_efecto: 'ND_M5', referencia } })) await tx.efecto_financiero_ocs_m5.create({ data: { id_ocs_m5: asociacion.id_ocs_m5, tipo_efecto: 'ND_M5', referencia, monto_documentado: asociacion.monto_asignado } });
    }
  }

  private async registrarAjusteObligacion(tipoAjuste: 'NC' | 'ND', entrada: Entrada, usuario: bigint) {
    const idObligacion = identificador(valorEntrada(entrada, 'idObligacion', 'id_obligacion_m5'));
    const idTipoDocumento = identificador(valorEntrada(entrada, 'idTipoDocumento', 'id_tipo_documento'));
    const folio = folioNormalizado(valorEntrada(entrada, 'folio', 'numero'));
    const fechaEmision = fechaEntrada(valorEntrada(entrada, 'fechaEmision', 'fecha_emision'), 'Fecha de emisión');
    const monto = montoPositivo(valorEntrada(entrada, 'monto', 'montoTotal', 'monto_total'));
    const justificacion = contacto(entrada.justificacion, 1000);
    try {
      const idAjuste = await prisma.$transaction(async tx => {
        const obligacion = await tx.obligacion_proveedor_m5.findUnique({ where: { id_obligacion_m5: idObligacion } });
        if (!obligacion) throw new ErrorAplicacion(404, 'Obligación M5 no encontrada');
        const [proveedor, tipoDocumento] = await Promise.all([tx.proveedor.findUnique({ where: { id_proveedor: obligacion.id_proveedor } }), tx.tipo_documento.findUnique({ where: { id_tipo_documento: idTipoDocumento } })]);
        if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
        if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor no está habilitado operacionalmente para registrar ajustes');
        if (!tipoDocumento) throw new ErrorAplicacion(404, 'Tipo de documento no encontrado');
        const idMonedaEntrada = valorEntrada(entrada, 'idMoneda', 'id_moneda'); const idMoneda = idMonedaEntrada === undefined ? obligacion.id_moneda : identificador(idMonedaEntrada);
        if (idMoneda !== obligacion.id_moneda) throw new ErrorAplicacion(400, 'La moneda del ajuste debe coincidir con la obligación');
        if (await tx.ajuste_obligacion_proveedor_m5.findFirst({ where: { id_proveedor: obligacion.id_proveedor, id_tipo_documento: idTipoDocumento, folio_normalizado: folio.normalizado } })) throw new ErrorAplicacion(409, 'Ya existe un ajuste con el mismo proveedor, tipo y folio');
        await this.recalcularObligacionM5(tx, idObligacion);
        const vigente = await tx.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: idObligacion } });
        let estado = 'confirmado'; let aplicado = monto; let saldoFavor = new Prisma.Decimal(0); let distribuciones: Array<{ idOcs: number; monto: Prisma.Decimal; disponible: Prisma.Decimal; excedente: Prisma.Decimal }> = [];
        if (tipoAjuste === 'NC') { aplicado = Prisma.Decimal.min(monto, vigente.saldo_actual); saldoFavor = monto.minus(aplicado); }
        else {
          const originales = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: obligacion.id_documento_m5 } });
          if (originales.some(item => item.tipo_orden === 'OCI')) throw new ErrorAplicacion(409, 'TEMPORAL_M5_DB_PATCH_PENDIENTE: no es posible validar el autorizado OCI');
          const ocs = originales.filter(item => item.tipo_orden === 'OCS' && item.id_ocs_m5 !== null);
          if (ocs.length) {
            const ordenes = await tx.orden_compra_servicio_m5.findMany({ where: { id_orden_compra_servicio_m5: { in: ocs.map(item => item.id_ocs_m5!) } }, include: { efectos_financieros: true } });
            if (ordenes.length !== ocs.length || ordenes.some(item => item.estado_ocs === 'anulada' || item.id_moneda !== obligacion.id_moneda)) throw new ErrorAplicacion(409, 'Una OCS vinculada está anulada o no tiene moneda compatible');
            const base = ocs.reduce((suma, item) => suma.plus(item.monto_asignado), new Prisma.Decimal(0)); let distribuido = new Prisma.Decimal(0);
            distribuciones = ocs.map((item, indice) => { const parte = indice === ocs.length - 1 ? monto.minus(distribuido) : monto.mul(item.monto_asignado).div(base).toDecimalPlaces(2); distribuido = distribuido.plus(parte); const orden = ordenes.find(o => o.id_orden_compra_servicio_m5 === item.id_ocs_m5)!; const consumido = orden.efectos_financieros.reduce((suma, efecto) => suma.plus(efecto.monto_documentado), new Prisma.Decimal(0)); const disponible = Prisma.Decimal.max(0, orden.monto_autorizado.minus(consumido)); return { idOcs: item.id_ocs_m5!, monto: parte, disponible, excedente: Prisma.Decimal.max(0, parte.minus(disponible)) }; });
            if (distribuciones.some(item => item.excedente.gt(0))) { if (!justificacion) throw new ErrorAplicacion(400, 'El excedente de la Nota de Débito requiere justificación'); estado = 'pendiente_excedente'; aplicado = new Prisma.Decimal(0); }
          }
        }
        const documento = await tx.documento_proveedor_m5.create({ data: { id_proveedor: obligacion.id_proveedor, clase: 'ajuste', id_tipo_documento: idTipoDocumento, folio: folio.folio, folio_normalizado: folio.normalizado, fecha_emision: fechaEmision, id_moneda: idMoneda, monto_total: monto, estado, respaldo: contacto(entrada.respaldo, 1000), descripcion: contacto(entrada.descripcion, 1000) || `${tipoAjuste} vinculada a obligación M5-${idObligacion}`, creado_por: usuario, confirmado_por: estado === 'confirmado' ? usuario : null, fecha_confirmacion: estado === 'confirmado' ? new Date() : null } });
        const ajuste = await tx.ajuste_obligacion_proveedor_m5.create({ data: { id_documento_ajuste_m5: documento.id_documento_m5, id_obligacion_m5: idObligacion, id_proveedor: obligacion.id_proveedor, id_tipo_documento: idTipoDocumento, folio_normalizado: folio.normalizado, id_moneda: idMoneda, tipo_ajuste: tipoAjuste, monto, monto_aplicado_obligacion: aplicado, monto_saldo_favor: saldoFavor, estado, creado_por: usuario } });
        for (const item of distribuciones) await tx.asociacion_documento_oc_m5.create({ data: { id_documento_m5: documento.id_documento_m5, tipo_orden: 'OCS', id_ocs_m5: item.idOcs, monto_asignado: item.monto, monto_disponible_snapshot: item.disponible, estado_diferencia: item.excedente.gt(0) ? 'excedente' : 'parcial', monto_excedente: item.excedente, estado_excedente: item.excedente.gt(0) ? 'pendiente' : 'no_aplica', justificacion: item.excedente.gt(0) ? justificacion : null, excedente_solicitado_por: item.excedente.gt(0) ? usuario : null, excedente_fecha_solicitud: item.excedente.gt(0) ? new Date() : null } });
        if (tipoAjuste === 'NC' && saldoFavor.gt(0)) await tx.saldo_favor_proveedor_m5.create({ data: { id_proveedor: obligacion.id_proveedor, id_ajuste_origen_m5: ajuste.id_ajuste_obligacion_m5, id_moneda: idMoneda, monto_generado: saldoFavor, monto_disponible: saldoFavor } });
        if (tipoAjuste === 'ND' && estado === 'confirmado') await this.registrarEfectosOcsNotaDebito(tx, ajuste);
        if (estado === 'confirmado') await this.recalcularObligacionM5(tx, idObligacion);
        return ajuste.id_ajuste_obligacion_m5;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.obtenerAjusteObligacion(idAjuste);
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'Ya existe un ajuste con el mismo proveedor, tipo y folio'); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente: vuelve a revisar la obligación'); throw error; }
  }

  registrarNotaCredito(entrada: Entrada, usuario: bigint) { return this.registrarAjusteObligacion('NC', entrada, usuario); }
  registrarNotaDebito(entrada: Entrada, usuario: bigint) { return this.registrarAjusteObligacion('ND', entrada, usuario); }

  async obtenerAjusteObligacion(id: number) {
    const ajuste = await prisma.ajuste_obligacion_proveedor_m5.findUnique({ where: { id_ajuste_obligacion_m5: id } });
    if (!ajuste) throw new ErrorAplicacion(404, 'Ajuste documental no encontrado');
    const [documento, moneda, saldoFavor] = await Promise.all([prisma.documento_proveedor_m5.findUniqueOrThrow({ where: { id_documento_m5: ajuste.id_documento_ajuste_m5 } }), prisma.moneda.findUniqueOrThrow({ where: { id_moneda: ajuste.id_moneda } }), prisma.saldo_favor_proveedor_m5.findUnique({ where: { id_ajuste_origen_m5: id } })]);
    return { id: ajuste.id_ajuste_obligacion_m5, tipo: ajuste.tipo_ajuste, estado: ajuste.estado, idObligacion: ajuste.id_obligacion_m5, idProveedor: ajuste.id_proveedor, folio: documento.folio, moneda: moneda.codigo_moneda, monto: Number(ajuste.monto), montoAplicado: Number(ajuste.monto_aplicado_obligacion), montoSaldoFavor: Number(ajuste.monto_saldo_favor), fecha: ajuste.fecha_creacion, saldoFavor: saldoFavor ? { id: saldoFavor.id_saldo_favor_m5, generado: Number(saldoFavor.monto_generado), disponible: Number(saldoFavor.monto_disponible), estado: saldoFavor.estado } : null };
  }

  async anularAjusteObligacion(id: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    try {
      await prisma.$transaction(async tx => {
        const ajuste = await tx.ajuste_obligacion_proveedor_m5.findUnique({ where: { id_ajuste_obligacion_m5: id } });
        if (!ajuste) throw new ErrorAplicacion(404, 'Ajuste documental no encontrado');
        if (ajuste.estado !== 'confirmado') throw new ErrorAplicacion(409, 'Sólo puede anularse un ajuste confirmado y vigente');
        const respaldo = await this.crearRespaldoPostPago(tx, entrada, usuario);
        if (ajuste.tipo_ajuste === 'NC') {
          const saldoFavor = await tx.saldo_favor_proveedor_m5.findUnique({ where: { id_ajuste_origen_m5: id } });
          // TEMPORAL_M5_DB_PATCH_PENDIENTE CU132-CU133: el disponible menor al generado indica compensaciones activas.
          if (saldoFavor && !saldoFavor.monto_disponible.equals(saldoFavor.monto_generado)) throw new ErrorAplicacion(409, 'La Nota de Crédito tiene saldo a favor utilizado; primero deben revertirse sus compensaciones');
          if (saldoFavor) await tx.saldo_favor_proveedor_m5.update({ where: { id_saldo_favor_m5: saldoFavor.id_saldo_favor_m5 }, data: { monto_disponible: 0, estado: 'anulado' } });
        } else {
          const asociaciones = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: ajuste.id_documento_ajuste_m5, tipo_orden: 'OCS' } });
          for (const asociacion of asociaciones) if (asociacion.id_ocs_m5) await tx.efecto_financiero_ocs_m5.create({ data: { id_ocs_m5: asociacion.id_ocs_m5, tipo_efecto: 'ND_ANULADA_M5', referencia: `AJUSTE-${id}-${asociacion.id_asociacion_m5}`, monto_documentado: asociacion.monto_asignado.negated() } });
        }
        await tx.ajuste_obligacion_proveedor_m5.update({ where: { id_ajuste_obligacion_m5: id }, data: { estado: 'anulado', anulado_por: usuario, fecha_anulacion: new Date(), motivo_anulacion: motivo, id_respaldo_anulacion: respaldo.id_respaldo_pago_m5 } });
        await tx.documento_proveedor_m5.update({ where: { id_documento_m5: ajuste.id_documento_ajuste_m5 }, data: { estado: 'anulado' } });
        await this.recalcularObligacionM5(tx, ajuste.id_obligacion_m5);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente: el ajuste no fue anulado'); throw error; }
    return this.obtenerAjusteObligacion(id);
  }

  async consultarSaldosFavorProveedor(idProveedor: number) {
    const proveedor = await prisma.proveedor.findUnique({ where: { id_proveedor: idProveedor } });
    if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
    const saldos = await prisma.saldo_favor_proveedor_m5.findMany({ where: { id_proveedor: idProveedor }, orderBy: [{ fecha_creacion: 'desc' }, { id_saldo_favor_m5: 'desc' }] });
    const ajustes = await prisma.ajuste_obligacion_proveedor_m5.findMany({ where: { id_ajuste_obligacion_m5: { in: saldos.map(item => item.id_ajuste_origen_m5) } } });
    const documentos = await prisma.documento_proveedor_m5.findMany({ where: { id_documento_m5: { in: ajustes.map(item => item.id_documento_ajuste_m5) } } });
    const monedas = await prisma.moneda.findMany({ where: { id_moneda: { in: saldos.map(item => item.id_moneda) } } });
    const detalle = saldos.map(saldo => { const ajuste = ajustes.find(item => item.id_ajuste_obligacion_m5 === saldo.id_ajuste_origen_m5)!; const documento = documentos.find(item => item.id_documento_m5 === ajuste.id_documento_ajuste_m5)!; return { id: saldo.id_saldo_favor_m5, moneda: monedas.find(item => item.id_moneda === saldo.id_moneda)?.codigo_moneda || 'No disponible', origen: 'Nota de Crédito', idNotaCredito: ajuste.id_ajuste_obligacion_m5, folio: documento.folio, montoOriginalCredito: Number(ajuste.monto), montoGenerado: Number(saldo.monto_generado), montoUtilizadoNeto: Number(saldo.monto_generado.minus(saldo.monto_disponible)), montoDisponible: Number(saldo.monto_disponible), fecha: saldo.fecha_creacion, estado: saldo.estado }; });
    const totales = new Map<string, number>(); for (const item of detalle.filter(item => item.estado === 'disponible')) totales.set(item.moneda, (totales.get(item.moneda) || 0) + item.montoDisponible);
    return { proveedor: { id: proveedor.id_proveedor, razonSocial: proveedor.nombre_razon_social, estado: proveedor.estado_proveedor }, totalesPorMoneda: [...totales].map(([moneda, montoDisponible]) => ({ moneda, montoDisponible })), saldos: detalle };
  }

  async proponerCompensacion(idProveedor: number, entrada: Entrada) {
    const idSaldo = identificador(valorEntrada(entrada, 'idSaldoFavor', 'id_saldo_favor'));
    const [proveedor, saldo] = await Promise.all([prisma.proveedor.findUnique({ where: { id_proveedor: idProveedor } }), prisma.saldo_favor_proveedor_m5.findUnique({ where: { id_saldo_favor_m5: idSaldo } })]);
    if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
    if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor debe estar Activo para compensar');
    if (!saldo || saldo.id_proveedor !== idProveedor || saldo.estado !== 'disponible' || saldo.monto_disponible.lte(0)) throw new ErrorAplicacion(404, 'Saldo a favor disponible no encontrado');
    const obligaciones = await prisma.obligacion_proveedor_m5.findMany({ where: { id_proveedor: idProveedor, id_moneda: saldo.id_moneda, saldo_actual: { gt: 0 } }, orderBy: [{ fecha_vencimiento: 'asc' }, { id_obligacion_m5: 'asc' }] });
    const prioridad = (estado: string | null) => estado === 'Vencida' ? 0 : estado === 'Por vencer' ? 1 : 2;
    obligaciones.sort((a, b) => prioridad(a.condicion_temporal) - prioridad(b.condicion_temporal) || a.fecha_vencimiento.getTime() - b.fecha_vencimiento.getTime() || a.id_obligacion_m5 - b.id_obligacion_m5);
    let disponible = saldo.monto_disponible;
    const distribuciones = obligaciones.flatMap(obligacion => { if (disponible.lte(0)) return []; const monto = Prisma.Decimal.min(disponible, obligacion.saldo_actual); disponible = disponible.minus(monto); return [{ idObligacion: obligacion.id_obligacion_m5, monto: Number(monto), saldoObligacion: Number(obligacion.saldo_actual), condicionTemporal: obligacion.condicion_temporal, fechaVencimiento: obligacion.fecha_vencimiento }]; });
    return { idSaldoFavor: idSaldo, montoDisponible: Number(saldo.monto_disponible), distribuciones, reglaMoneda: 'TEMPORAL_M5_REGLA_MONEDA_COMPENSACION' };
  }

  private async presentarCompensacion(id: number) {
    const compensacion = await prisma.compensacion_saldo_favor_m5.findUnique({ where: { id_compensacion_m5: id } });
    if (!compensacion) throw new ErrorAplicacion(404, 'Compensación no encontrada');
    const detalles = await prisma.detalle_compensacion_saldo_favor_m5.findMany({ where: { id_compensacion_m5: id } });
    const reversas = await prisma.reversion_compensacion_m5.findMany({ where: { id_detalle_compensacion_m5: { in: detalles.map(item => item.id_detalle_compensacion_m5) } }, orderBy: { fecha_hora: 'asc' } });
    return { id, estado: compensacion.estado, idSaldoFavor: compensacion.id_saldo_favor_m5, idProveedor: compensacion.id_proveedor, total: Number(compensacion.monto_total), fecha: compensacion.fecha_creacion, distribuciones: detalles.map(item => ({ id: item.id_detalle_compensacion_m5, idObligacion: item.id_obligacion_m5, monto: Number(item.monto_aplicado), montoRevertido: Number(reversas.filter(r => r.id_detalle_compensacion_m5 === item.id_detalle_compensacion_m5).reduce((s, r) => s.plus(r.monto_revertido), new Prisma.Decimal(0))), reversas: reversas.filter(r => r.id_detalle_compensacion_m5 === item.id_detalle_compensacion_m5).map(r => ({ id: r.id_reversion_compensacion_m5, monto: Number(r.monto_revertido), motivo: r.motivo, fecha: r.fecha_hora })) })) };
  }

  async listarCompensaciones(idProveedor: number) { const proveedor = await prisma.proveedor.findUnique({ where: { id_proveedor: idProveedor } }); if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado'); const registros = await prisma.compensacion_saldo_favor_m5.findMany({ where: { id_proveedor: idProveedor }, orderBy: { fecha_creacion: 'desc' }, select: { id_compensacion_m5: true } }); return Promise.all(registros.map(item => this.presentarCompensacion(item.id_compensacion_m5))); }

  async confirmarCompensacion(idProveedor: number, entrada: Entrada, usuario: bigint) {
    const idSaldo = identificador(valorEntrada(entrada, 'idSaldoFavor', 'id_saldo_favor'));
    const distribuciones = Array.isArray(entrada.distribuciones) ? entrada.distribuciones as Entrada[] : [];
    const datos = distribuciones.map(item => ({ idObligacion: identificador(valorEntrada(item, 'idObligacion', 'id_obligacion')), monto: montoPositivo(item.monto) }));
    if (!datos.length || new Set(datos.map(item => item.idObligacion)).size !== datos.length) throw new ErrorAplicacion(400, 'La distribución de compensación es obligatoria y no admite obligaciones repetidas');
    try {
      const id = await prisma.$transaction(async tx => {
        const [proveedor, saldo, obligaciones] = await Promise.all([tx.proveedor.findUnique({ where: { id_proveedor: idProveedor } }), tx.saldo_favor_proveedor_m5.findUnique({ where: { id_saldo_favor_m5: idSaldo } }), tx.obligacion_proveedor_m5.findMany({ where: { id_obligacion_m5: { in: datos.map(item => item.idObligacion) } } })]);
        if (!proveedor) throw new ErrorAplicacion(404, 'Proveedor no encontrado');
        if (proveedor.estado_proveedor !== 'activo') throw new ErrorAplicacion(409, 'El proveedor debe estar Activo para compensar');
        if (!saldo || saldo.id_proveedor !== idProveedor || saldo.estado !== 'disponible') throw new ErrorAplicacion(404, 'Saldo a favor disponible no encontrado');
        if (obligaciones.length !== datos.length) throw new ErrorAplicacion(404, 'Obligación no encontrada');
        const total = datos.reduce((s, item) => s.plus(item.monto), new Prisma.Decimal(0));
        if (total.gt(saldo.monto_disponible)) throw new ErrorAplicacion(409, 'La compensación supera el saldo a favor disponible');
        for (const item of datos) { const obligacion = obligaciones.find(o => o.id_obligacion_m5 === item.idObligacion)!; if (obligacion.id_proveedor !== idProveedor) throw new ErrorAplicacion(400, 'Todas las obligaciones deben pertenecer al mismo proveedor'); if (obligacion.id_moneda !== saldo.id_moneda) throw new ErrorAplicacion(400, 'TEMPORAL_M5_REGLA_MONEDA_COMPENSACION: crédito y obligación deben usar la misma moneda'); if (item.monto.gt(obligacion.saldo_actual)) throw new ErrorAplicacion(409, 'La compensación supera el saldo de una obligación'); }
        const creada = await tx.compensacion_saldo_favor_m5.create({ data: { id_saldo_favor_m5: idSaldo, id_proveedor: idProveedor, id_moneda: saldo.id_moneda, monto_total: total, creado_por: usuario } });
        await tx.detalle_compensacion_saldo_favor_m5.createMany({ data: datos.map(item => ({ id_compensacion_m5: creada.id_compensacion_m5, id_obligacion_m5: item.idObligacion, monto_aplicado: item.monto })) });
        const restante = saldo.monto_disponible.minus(total); await tx.saldo_favor_proveedor_m5.update({ where: { id_saldo_favor_m5: idSaldo }, data: { monto_disponible: restante, estado: restante.isZero() ? 'agotado' : 'disponible' } });
        for (const item of datos) await this.recalcularObligacionM5(tx, item.idObligacion);
        return creada.id_compensacion_m5;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.presentarCompensacion(id);
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente: vuelve a revisar el saldo disponible'); throw error; }
  }

  async revertirCompensacion(id: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo); const distribuciones = Array.isArray(entrada.distribuciones) ? entrada.distribuciones as Entrada[] : [];
    const datos = distribuciones.map(item => ({ idDetalle: identificador(valorEntrada(item, 'idDetalle', 'id_detalle')), monto: montoPositivo(item.monto) }));
    if (!datos.length || new Set(datos.map(item => item.idDetalle)).size !== datos.length) throw new ErrorAplicacion(400, 'Indica las distribuciones que serán revertidas');
    try { await prisma.$transaction(async tx => {
      const compensacion = await tx.compensacion_saldo_favor_m5.findUnique({ where: { id_compensacion_m5: id } }); if (!compensacion) throw new ErrorAplicacion(404, 'Compensación no encontrada');
      const detalles = await tx.detalle_compensacion_saldo_favor_m5.findMany({ where: { id_compensacion_m5: id, id_detalle_compensacion_m5: { in: datos.map(item => item.idDetalle) } } }); if (detalles.length !== datos.length) throw new ErrorAplicacion(404, 'Distribución de compensación no encontrada');
      const previas = await tx.reversion_compensacion_m5.findMany({ where: { id_detalle_compensacion_m5: { in: datos.map(item => item.idDetalle) } } });
      for (const item of datos) { const detalle = detalles.find(d => d.id_detalle_compensacion_m5 === item.idDetalle)!; const revertido = previas.filter(r => r.id_detalle_compensacion_m5 === item.idDetalle).reduce((s, r) => s.plus(r.monto_revertido), new Prisma.Decimal(0)); if (item.monto.plus(revertido).gt(detalle.monto_aplicado)) throw new ErrorAplicacion(409, 'La reversa supera lo compensado en una distribución'); }
      const respaldo = await this.crearRespaldoPostPago(tx, entrada, usuario); const total = datos.reduce((s, item) => s.plus(item.monto), new Prisma.Decimal(0));
      await tx.reversion_compensacion_m5.createMany({ data: datos.map(item => ({ id_detalle_compensacion_m5: item.idDetalle, monto_revertido: item.monto, motivo, id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, usuario_id_usuario: usuario })) });
      const saldo = await tx.saldo_favor_proveedor_m5.findUniqueOrThrow({ where: { id_saldo_favor_m5: compensacion.id_saldo_favor_m5 } }); await tx.saldo_favor_proveedor_m5.update({ where: { id_saldo_favor_m5: saldo.id_saldo_favor_m5 }, data: { monto_disponible: saldo.monto_disponible.plus(total), estado: 'disponible' } });
      const todas = await tx.detalle_compensacion_saldo_favor_m5.findMany({ where: { id_compensacion_m5: id } }); const todasReversas = await tx.reversion_compensacion_m5.findMany({ where: { id_detalle_compensacion_m5: { in: todas.map(item => item.id_detalle_compensacion_m5) } } }); const neto = todas.reduce((s, d) => s.plus(d.monto_aplicado), new Prisma.Decimal(0)).minus(todasReversas.reduce((s, r) => s.plus(r.monto_revertido), new Prisma.Decimal(0)));
      await tx.compensacion_saldo_favor_m5.update({ where: { id_compensacion_m5: id }, data: { estado: neto.isZero() ? 'revertida_total' : 'revertida_parcial' } }); for (const detalle of detalles) await this.recalcularObligacionM5(tx, detalle.id_obligacion_m5);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente al revertir la compensación'); throw error; }
    return this.presentarCompensacion(id);
  }

  async listarCategoriasEgreso() {
    const categorias = await prisma.categoria_egreso_m5.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }); const historial = await prisma.historial_categoria_egreso_m5.findMany({ where: { id_categoria_egreso_m5: { in: categorias.map(item => item.id_categoria_egreso_m5) } }, orderBy: { fecha_hora: 'desc' } });
    return categorias.map(item => ({ id: item.id_categoria_egreso_m5, nombre: item.nombre, activo: item.activo, fechaCreacion: item.fecha_creacion, historial: historial.filter(h => h.id_categoria_egreso_m5 === item.id_categoria_egreso_m5) }));
  }

  async crearCategoriaEgreso(entrada: Entrada, usuario: bigint) {
    const nombre = texto(entrada.nombre, 100).trim(); if (!nombre) throw new ErrorAplicacion(400, 'El nombre es obligatorio'); const normalizado = nombre.toLocaleUpperCase('es-CL');
    try { return await prisma.categoria_egreso_m5.create({ data: { nombre, nombre_normalizado: normalizado, activo: entrada.activo !== false, creado_por: usuario } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'Ya existe una categoría con ese nombre'); throw error; }
  }

  async actualizarCategoriaEgreso(id: number, entrada: Entrada, usuario: bigint) {
    return prisma.$transaction(async tx => { const actual = await tx.categoria_egreso_m5.findUnique({ where: { id_categoria_egreso_m5: id } }); if (!actual) throw new ErrorAplicacion(404, 'Categoría no encontrada'); const nombre = entrada.nombre === undefined ? actual.nombre : texto(entrada.nombre, 100).trim(); if (!nombre) throw new ErrorAplicacion(400, 'El nombre es obligatorio'); const activo = entrada.activo === undefined ? actual.activo : entrada.activo === true; const motivo = contacto(entrada.motivo, 500); if (nombre === actual.nombre && activo === actual.activo) return actual; try { const actualizada = await tx.categoria_egreso_m5.update({ where: { id_categoria_egreso_m5: id }, data: { nombre, nombre_normalizado: nombre.toLocaleUpperCase('es-CL'), activo } }); await tx.historial_categoria_egreso_m5.create({ data: { id_categoria_egreso_m5: id, nombre_anterior: actual.nombre, nombre_nuevo: nombre, activo_anterior: actual.activo, activo_nuevo: activo, motivo, usuario_id_usuario: usuario } }); return actualizada; } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'Ya existe una categoría con ese nombre'); throw error; } });
  }

  async consultarUmbralReclasificacion() { const actual = await prisma.config_umbral_reclasificacion_m5.findUniqueOrThrow({ where: { id_configuracion: 1 } }); const historial = await prisma.historial_umbral_reclasificacion_m5.findMany({ orderBy: { fecha_hora: 'desc' } }); return { montoClp: Number(actual.monto_clp), fecha: actual.fecha_actualizacion, historial: historial.map(item => ({ anterior: Number(item.monto_anterior_clp), nuevo: Number(item.monto_nuevo_clp), usuario: item.usuario_id_usuario.toString(), fecha: item.fecha_hora })) }; }
  async configurarUmbralReclasificacion(entrada: Entrada, usuario: bigint) { const valor = Number(valorEntrada(entrada, 'montoClp', 'monto')); if (!Number.isFinite(valor) || valor < 0) throw new ErrorAplicacion(400, 'El umbral debe ser un monto mayor o igual que cero'); const nuevo = new Prisma.Decimal(valor).toDecimalPlaces(2); await prisma.$transaction(async tx => { const actual = await tx.config_umbral_reclasificacion_m5.findUniqueOrThrow({ where: { id_configuracion: 1 } }); await tx.historial_umbral_reclasificacion_m5.create({ data: { monto_anterior_clp: actual.monto_clp, monto_nuevo_clp: nuevo, usuario_id_usuario: usuario } }); await tx.config_umbral_reclasificacion_m5.update({ where: { id_configuracion: 1 }, data: { monto_clp: nuevo, actualizado_por: usuario, fecha_actualizacion: new Date() } }); }); return this.consultarUmbralReclasificacion(); }

  private async disponibilidadClasificacion(tx: Transaccion, idClasificacion: number) { const original = await tx.clasificacion_asociacion_m5.findUnique({ where: { id_clasificacion_m5: idClasificacion } }); if (!original) throw new ErrorAplicacion(404, 'Clasificación de origen no encontrada'); const salidas = await tx.detalle_reclasificacion_egreso_m5.findMany({ where: { id_clasificacion_origen_m5: idClasificacion } }); const aprobadas = await tx.reclasificacion_egreso_m5.findMany({ where: { id_reclasificacion_m5: { in: salidas.map(item => item.id_reclasificacion_m5) }, estado: 'aprobada' }, select: { id_reclasificacion_m5: true } }); const ids = new Set(aprobadas.map(item => item.id_reclasificacion_m5)); return { original, disponible: original.monto.minus(salidas.filter(item => ids.has(item.id_reclasificacion_m5)).reduce((s, item) => s.plus(item.monto), new Prisma.Decimal(0))) }; }

  async solicitarReclasificacion(idDocumento: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo); const movimientos = Array.isArray(entrada.movimientos) ? entrada.movimientos as Entrada[] : []; const datos = movimientos.map(item => ({ idClasificacion: identificador(valorEntrada(item, 'idClasificacion', 'id_clasificacion')), idDestino: identificador(valorEntrada(item, 'idCategoriaDestino', 'id_categoria_destino')), monto: montoPositivo(item.monto) })); if (!datos.length) throw new ErrorAplicacion(400, 'La corrección completa debe enviarse en una sola solicitud');
    return prisma.$transaction(async tx => { const documento = await tx.documento_proveedor_m5.findUnique({ where: { id_documento_m5: idDocumento } }); if (!documento || documento.estado !== 'confirmado') throw new ErrorAplicacion(409, 'El documento debe estar confirmado'); const asociaciones = await tx.asociacion_documento_oc_m5.findMany({ where: { id_documento_m5: idDocumento } }); const idsAsociacion = new Set(asociaciones.map(item => item.id_asociacion_m5)); const destinos = await tx.categoria_egreso_m5.findMany({ where: { id_categoria_egreso_m5: { in: datos.map(item => item.idDestino) }, activo: true } }); if (new Set(datos.map(item => item.idDestino)).size !== destinos.length) throw new ErrorAplicacion(404, 'Categoría destino activa no encontrada'); for (const item of datos) { const origen = await this.disponibilidadClasificacion(tx, item.idClasificacion); if (!idsAsociacion.has(origen.original.id_asociacion_m5)) throw new ErrorAplicacion(400, 'La clasificación no pertenece al documento'); if (origen.original.id_categoria_egreso_m5 === item.idDestino) throw new ErrorAplicacion(400, 'La categoría destino debe ser distinta'); if (item.monto.gt(origen.disponible)) throw new ErrorAplicacion(409, 'El monto supera la clasificación vigente'); }
      const total = datos.reduce((s, item) => s.plus(item.monto), new Prisma.Decimal(0)); const obligacion = await tx.obligacion_proveedor_m5.findUnique({ where: { id_documento_m5: idDocumento } }); const moneda = await tx.moneda.findUniqueOrThrow({ where: { id_moneda: documento.id_moneda } }); let referenciaSolicitud = total; if (moneda.codigo_moneda !== 'CLP') { if (!obligacion?.tipo_cambio) throw new ErrorAplicacion(409, 'TEMPORAL_M5_REGLA_UMBRAL_MONEDA: no existe equivalente CLP confirmado'); referenciaSolicitud = total.mul(obligacion.tipo_cambio).toDecimalPlaces(2); } const anteriores = await tx.reclasificacion_egreso_m5.findMany({ where: { id_documento_m5: idDocumento, estado: { in: ['pendiente','aprobada'] } } }); const referencia = anteriores.reduce((s, item) => s.plus(item.monto_referencia_clp), referenciaSolicitud); const config = await tx.config_umbral_reclasificacion_m5.findUniqueOrThrow({ where: { id_configuracion: 1 } }); const estado = referencia.lte(config.monto_clp) ? 'aprobada' : 'pendiente'; const creada = await tx.reclasificacion_egreso_m5.create({ data: { id_documento_m5: idDocumento, monto_total: total, monto_referencia_clp: referencia, umbral_snapshot_clp: config.monto_clp, motivo, estado, solicitado_por: usuario, resuelto_por: estado === 'aprobada' ? usuario : null, fecha_resolucion: estado === 'aprobada' ? new Date() : null } }); for (const item of datos) { const origen = await tx.clasificacion_asociacion_m5.findUniqueOrThrow({ where: { id_clasificacion_m5: item.idClasificacion } }); await tx.detalle_reclasificacion_egreso_m5.create({ data: { id_reclasificacion_m5: creada.id_reclasificacion_m5, id_clasificacion_origen_m5: item.idClasificacion, id_asociacion_m5: origen.id_asociacion_m5, id_categoria_origen_m5: origen.id_categoria_egreso_m5, id_categoria_destino_m5: item.idDestino, monto: item.monto } }); } return { id: creada.id_reclasificacion_m5, estado, montoTotal: Number(total), montoReferenciaClp: Number(referencia), umbralSnapshotClp: Number(config.monto_clp) }; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resolverReclasificacion(id: number, aprobar: boolean, entrada: Entrada, usuario: bigint, perfil: string) { const motivoRechazo = aprobar ? null : motivoObligatorio(entrada.motivo); return prisma.$transaction(async tx => { const solicitud = await tx.reclasificacion_egreso_m5.findUnique({ where: { id_reclasificacion_m5: id } }); if (!solicitud) throw new ErrorAplicacion(404, 'Solicitud de reclasificación no encontrada'); if (solicitud.estado !== 'pendiente') throw new ErrorAplicacion(409, 'La solicitud ya fue resuelta'); if (aprobar && perfil === 'contador' && solicitud.solicitado_por === usuario) throw new ErrorAplicacion(403, 'Contador no puede aprobar su propia reclasificación'); if (aprobar) { const detalles = await tx.detalle_reclasificacion_egreso_m5.findMany({ where: { id_reclasificacion_m5: id } }); const destinos = await tx.categoria_egreso_m5.findMany({ where: { id_categoria_egreso_m5: { in: detalles.map(item => item.id_categoria_destino_m5) }, activo: true } }); if (new Set(detalles.map(item => item.id_categoria_destino_m5)).size !== destinos.length) throw new ErrorAplicacion(409, 'Una categoría destino ya no está activa'); for (const detalle of detalles) { const origen = await this.disponibilidadClasificacion(tx, detalle.id_clasificacion_origen_m5); if (detalle.monto.gt(origen.disponible)) throw new ErrorAplicacion(409, 'La clasificación original cambió y ya no tiene monto suficiente'); } } const actualizada = await tx.reclasificacion_egreso_m5.update({ where: { id_reclasificacion_m5: id }, data: { estado: aprobar ? 'aprobada' : 'rechazada', resuelto_por: usuario, fecha_resolucion: new Date(), motivo_rechazo: motivoRechazo } }); return { id, estado: actualizada.estado }; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }

  async listarReclasificaciones() { const solicitudes = await prisma.reclasificacion_egreso_m5.findMany({ orderBy: [{ fecha_solicitud: 'desc' }, { id_reclasificacion_m5: 'desc' }] }); const detalles = await prisma.detalle_reclasificacion_egreso_m5.findMany({ where: { id_reclasificacion_m5: { in: solicitudes.map(item => item.id_reclasificacion_m5) } } }); return solicitudes.map(item => ({ id: item.id_reclasificacion_m5, idDocumento: item.id_documento_m5, estado: item.estado, montoTotal: Number(item.monto_total), montoReferenciaClp: Number(item.monto_referencia_clp), umbralSnapshotClp: Number(item.umbral_snapshot_clp), motivo: item.motivo, solicitadoPor: item.solicitado_por.toString(), fecha: item.fecha_solicitud, detalles: detalles.filter(d => d.id_reclasificacion_m5 === item.id_reclasificacion_m5).map(d => ({ idClasificacion: d.id_clasificacion_origen_m5, idCategoriaDestino: d.id_categoria_destino_m5, monto: Number(d.monto) })) })); }

  async corregirOrdenTrabajoImputacion(idDetalle: number, entrada: Entrada, usuario: bigint) {
    const idOt = BigInt(String(valorEntrada(entrada, 'idOrdenTrabajo', 'id_orden_trabajo')));
    const motivo = motivoObligatorio(entrada.motivo);
    return prisma.$transaction(async tx => {
      const detalle = await tx.detalle_imputacion_m5.findUnique({ where: { id_detalle_imputacion_m5: idDetalle } });
      if (!detalle) throw new ErrorAplicacion(404, 'Imputación no encontrada');
      const propuesta = await tx.propuesta_imputacion_m5.findUnique({ where: { id_propuesta_imputacion_m5: detalle.id_propuesta_imputacion_m5 } });
      if (!propuesta || propuesta.estado !== 'confirmado') throw new ErrorAplicacion(409, 'La imputación debe estar confirmada');
      if (detalle.destino !== 'proyecto' || !detalle.id_proyecto) throw new ErrorAplicacion(400, 'La corrección de OT requiere una imputación a Proyecto');
      const ot = await tx.orden_trabajo.findUnique({ where: { orden_trabajo_id_orden: idOt } });
      if (!ot) throw new ErrorAplicacion(404, 'Orden de Trabajo no encontrada');
      if (ot.proyecto_id_proyecto !== detalle.id_proyecto) throw new ErrorAplicacion(400, 'La Orden de Trabajo no pertenece al Proyecto de la imputación');
      await tx.historial_ot_imputacion_m5.create({ data: { id_detalle_imputacion_m5: idDetalle, id_proyecto: detalle.id_proyecto, id_ot_anterior: detalle.id_orden_trabajo, id_ot_nueva: idOt, monto_contexto: detalle.monto, motivo, usuario_id_usuario: usuario } });
      await tx.detalle_imputacion_m5.update({ where: { id_detalle_imputacion_m5: idDetalle }, data: { id_orden_trabajo: idOt } });
      return { idDetalle, idProyecto: detalle.id_proyecto.toString(), idOtAnterior: detalle.id_orden_trabajo?.toString() || null, idOtNueva: idOt.toString(), monto: Number(detalle.monto), motivo };
    });
  }

  private async validarDestinoReasignacion(tx: Transaccion, item: { destino: string; idProyecto: bigint | null; idOt: bigint | null }) {
    if (!['general', 'proyecto'].includes(item.destino)) throw new ErrorAplicacion(400, 'Destino de reasignación inválido');
    if (item.destino === 'general') {
      if (item.idProyecto || item.idOt) throw new ErrorAplicacion(400, 'Gasto general no admite Proyecto ni Orden de Trabajo');
      return false;
    }
    if (!item.idProyecto) throw new ErrorAplicacion(400, 'El Proyecto destino es obligatorio');
    const proyecto = await tx.proyecto.findUnique({ where: { proyecto_proyecto_id: item.idProyecto } });
    if (!proyecto) throw new ErrorAplicacion(404, 'Proyecto destino no encontrado');
    let excepcional = !['activo', 'abierto'].includes((proyecto.proyecto_estado_operacional || '').toLowerCase());
    if (item.idOt) {
      const ot = await tx.orden_trabajo.findUnique({ where: { orden_trabajo_id_orden: item.idOt } });
      if (!ot) throw new ErrorAplicacion(404, 'Orden de Trabajo destino no encontrada');
      if (ot.proyecto_id_proyecto !== item.idProyecto) throw new ErrorAplicacion(400, 'La Orden de Trabajo no pertenece al Proyecto destino');
      excepcional ||= ['cerrada', 'cerrado', 'finalizada', 'finalizado', 'terminada', 'terminado', 'inactiva', 'inactivo'].includes((ot.orden_trabajo_estado || '').toLowerCase());
    }
    return excepcional;
  }

  private async disponibilidadImputacion(tx: Transaccion, idDetalle: number) {
    const detalle = await tx.detalle_imputacion_m5.findUnique({ where: { id_detalle_imputacion_m5: idDetalle } });
    if (!detalle) throw new ErrorAplicacion(404, 'Imputación de origen no encontrada');
    const propuesta = await tx.propuesta_imputacion_m5.findUnique({ where: { id_propuesta_imputacion_m5: detalle.id_propuesta_imputacion_m5 } });
    if (!propuesta || propuesta.estado !== 'confirmado') throw new ErrorAplicacion(409, 'La imputación de origen ya no está confirmada');
    const aprobadas = await tx.solicitud_reasignacion_costo_m5.findMany({ where: { id_detalle_origen_m5: idDetalle, estado: 'aprobada' } });
    const utilizado = aprobadas.reduce((suma, item) => suma.plus(item.monto_total), new Prisma.Decimal(0));
    return { detalle, propuesta, disponible: detalle.monto.minus(utilizado) };
  }

  async solicitarReasignacionCosto(idDetalle: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    const distribuciones = Array.isArray(entrada.distribuciones) ? entrada.distribuciones as Entrada[] : [];
    const datos = distribuciones.map(item => ({ destino: texto(item.destino, 20).toLowerCase(), idProyecto: item.idProyecto ? BigInt(String(item.idProyecto)) : null, idOt: item.idOrdenTrabajo ? BigInt(String(item.idOrdenTrabajo)) : null, monto: montoPositivo(item.monto) }));
    if (!datos.length) throw new ErrorAplicacion(400, 'La distribución propuesta es obligatoria');
    const total = datos.reduce((suma, item) => suma.plus(item.monto), new Prisma.Decimal(0));
    if (entrada.monto !== undefined && !total.equals(montoPositivo(entrada.monto))) throw new ErrorAplicacion(400, 'La distribución no cuadra con el monto que se pretende reasignar');
    const justificacion = contacto(valorEntrada(entrada, 'justificacionExcepcion', 'justificacion'), 1000);
    try {
      const id = await prisma.$transaction(async tx => {
        const origen = await this.disponibilidadImputacion(tx, idDetalle);
        if (total.gt(origen.disponible)) throw new ErrorAplicacion(409, 'El monto supera la imputación vigente disponible');
        let excepcional: boolean = false;
        for (const item of datos) if (await this.validarDestinoReasignacion(tx, item)) excepcional = true;
        if (excepcional && !justificacion) throw new ErrorAplicacion(400, 'El Proyecto u OT cerrado requiere justificación excepcional');
        const datosSolicitud: Prisma.solicitud_reasignacion_costo_m5UncheckedCreateInput = { id_detalle_origen_m5: idDetalle, monto_total: total, motivo, excepcional_proyecto_cerrado: excepcional, justificacion_excepcion: justificacion, solicitado_por: usuario };
        const solicitud = await tx.solicitud_reasignacion_costo_m5.create({ data: datosSolicitud });
        await tx.detalle_reasignacion_costo_m5.createMany({ data: datos.map(item => ({ id_solicitud_reasignacion_m5: solicitud.id_solicitud_reasignacion_m5, destino: item.destino, id_proyecto: item.idProyecto, id_orden_trabajo: item.idOt, monto: item.monto })) });
        return solicitud.id_solicitud_reasignacion_m5;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return (await this.listarReasignacionesCosto()).find(item => item.id === id)!;
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'La imputación cambió concurrentemente'); throw error; }
  }

  async resolverReasignacionCosto(id: number, aprobar: boolean, entrada: Entrada, usuario: bigint) {
    const motivoRechazo = aprobar ? null : motivoObligatorio(entrada.motivo);
    try {
      await prisma.$transaction(async tx => {
        const solicitud = await tx.solicitud_reasignacion_costo_m5.findUnique({ where: { id_solicitud_reasignacion_m5: id } });
        if (!solicitud) throw new ErrorAplicacion(404, 'Solicitud de reasignación no encontrada');
        if (solicitud.estado !== 'pendiente') throw new ErrorAplicacion(409, 'La solicitud ya fue resuelta');
        if (aprobar) {
          const origen = await this.disponibilidadImputacion(tx, solicitud.id_detalle_origen_m5);
          if (solicitud.monto_total.gt(origen.disponible)) throw new ErrorAplicacion(409, 'La imputación original cambió y no tiene monto suficiente');
          const detalles = await tx.detalle_reasignacion_costo_m5.findMany({ where: { id_solicitud_reasignacion_m5: id } });
          for (const item of detalles) {
            const excepcional = await this.validarDestinoReasignacion(tx, { destino: item.destino, idProyecto: item.id_proyecto, idOt: item.id_orden_trabajo });
            if (excepcional && !solicitud.justificacion_excepcion) throw new ErrorAplicacion(409, 'El destino cerró y requiere una nueva solicitud excepcional');
          }
        }
        await tx.solicitud_reasignacion_costo_m5.update({ where: { id_solicitud_reasignacion_m5: id }, data: { estado: aprobar ? 'aprobada' : 'rechazada', resuelto_por: usuario, fecha_resolucion: new Date(), motivo_rechazo: motivoRechazo } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'La imputación cambió concurrentemente'); throw error; }
    return (await this.listarReasignacionesCosto()).find(item => item.id === id)!;
  }

  async listarReasignacionesCosto() {
    const solicitudes = await prisma.solicitud_reasignacion_costo_m5.findMany({ orderBy: [{ fecha_solicitud: 'desc' }, { id_solicitud_reasignacion_m5: 'desc' }] });
    const detalles = await prisma.detalle_reasignacion_costo_m5.findMany({ where: { id_solicitud_reasignacion_m5: { in: solicitudes.map(item => item.id_solicitud_reasignacion_m5) } } });
    return solicitudes.map(item => ({ id: item.id_solicitud_reasignacion_m5, idDetalleOrigen: item.id_detalle_origen_m5, montoTotal: Number(item.monto_total), motivo: item.motivo, estado: item.estado, excepcional: item.excepcional_proyecto_cerrado, justificacionExcepcion: item.justificacion_excepcion, solicitadoPor: item.solicitado_por.toString(), fechaSolicitud: item.fecha_solicitud, resueltoPor: item.resuelto_por?.toString() || null, fechaResolucion: item.fecha_resolucion, motivoRechazo: item.motivo_rechazo, distribuciones: detalles.filter(d => d.id_solicitud_reasignacion_m5 === item.id_solicitud_reasignacion_m5).map(d => ({ destino: d.destino, idProyecto: d.id_proyecto?.toString() || null, idOrdenTrabajo: d.id_orden_trabajo?.toString() || null, monto: Number(d.monto) })) }));
  }

  async registrarComisionBancaria(idOperacion: number, entrada: Entrada, usuario: bigint) {
    const monto = montoPositivo(entrada.monto); const idMoneda = identificador(valorEntrada(entrada, 'idMoneda', 'id_moneda'));
    const idMovimiento = valorEntrada(entrada, 'idMovimiento', 'id_movimiento') === undefined ? null : identificador(valorEntrada(entrada, 'idMovimiento', 'id_movimiento'));
    const descripcion = motivoObligatorio(valorEntrada(entrada, 'descripcion', 'tipo'));
    const fecha = fechaEntrada(valorEntrada(entrada, 'fecha', 'fechaComision'), 'Fecha de comisión');
    return prisma.$transaction(async tx => {
      const operacion = await this.operacionPagoM5(idOperacion, tx);
      if (operacion.estado !== 'confirmada') throw new ErrorAplicacion(409, 'La operación de pago debe estar confirmada');
      const movimientos = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: idOperacion } });
      const monedasMovimiento = await tx.moneda.findMany({ where: { id_moneda: { in: movimientos.map(item => item.id_moneda) } } });
      if (!movimientos.some(item => monedasMovimiento.find(moneda => moneda.id_moneda === item.id_moneda)?.codigo_moneda !== 'CLP')) throw new ErrorAplicacion(409, 'La comisión bancaria sólo aplica a un pago internacional');
      const movimiento = idMovimiento ? movimientos.find(item => item.id_movimiento_pago_m5 === idMovimiento) : null;
      if (idMovimiento && !movimiento) throw new ErrorAplicacion(404, 'Movimiento internacional relacionado no encontrado');
      const moneda = await tx.moneda.findUnique({ where: { id_moneda: idMoneda } });
      if (!moneda || moneda.estado_moneda !== 'activo') throw new ErrorAplicacion(404, 'Moneda activa no encontrada');
      let equivalente: Prisma.Decimal | null = moneda.codigo_moneda === 'CLP' ? monto : null;
      if (movimiento && movimiento.id_moneda === idMoneda) { const tasa = movimiento.tasa_bancaria_efectiva || movimiento.tasa_referencia; if (tasa) equivalente = monto.mul(tasa).toDecimalPlaces(2); }
      const respaldo = await this.crearRespaldoPostPago(tx, entrada, usuario);
      const comision = await tx.comision_bancaria_m5.create({ data: { id_operacion_pago_m5: idOperacion, id_movimiento_pago_m5: idMovimiento, id_moneda: idMoneda, monto, equivalente_clp: equivalente, fecha_comision: fecha, descripcion, id_respaldo_pago_m5: respaldo.id_respaldo_pago_m5, registrado_por: usuario } });
      return { id: comision.id_comision_bancaria_m5, idOperacion, idMovimiento, monto: Number(monto), moneda: moneda.codigo_moneda, equivalenteClp: equivalente ? Number(equivalente) : null, fecha, descripcion, efectoDeudaProveedor: 0 };
    });
  }

  private async presentarEnvio(id: number) {
    const envio = await prisma.envio_importacion_m5.findUnique({ where: { id_envio_importacion_m5: id } });
    if (!envio) throw new ErrorAplicacion(404, 'Envío o importación no encontrado');
    const [ordenes, costos, historial] = await Promise.all([prisma.envio_orden_compra_m5.findMany({ where: { id_envio_importacion_m5: id }, orderBy: { id_envio_orden_m5: 'asc' } }), prisma.costo_envio_importacion_m5.findMany({ where: { id_envio_importacion_m5: id }, orderBy: { id_costo_envio_m5: 'asc' } }), prisma.historial_envio_importacion_m5.findMany({ where: { id_envio_importacion_m5: id }, orderBy: [{ fecha_hora: 'desc' }, { id_historial_envio_m5: 'desc' }] })]);
    const monedas = await prisma.moneda.findMany({ where: { id_moneda: { in: costos.map(item => item.id_moneda) } } });
    const presentados = costos.map(item => ({ id: item.id_costo_envio_m5, tipo: item.tipo_costo, fuente: item.fuente, idObligacion: item.id_obligacion_m5, idComision: item.id_comision_bancaria_m5, monto: Number(item.monto), moneda: monedas.find(m => m.id_moneda === item.id_moneda)?.codigo_moneda || 'No disponible', equivalenteClp: item.equivalente_clp === null ? null : Number(item.equivalente_clp), descripcion: item.descripcion, fecha: item.fecha_registro }));
    return { id: envio.id_envio_importacion_m5, referencia: envio.referencia, fecha: envio.fecha, descripcion: envio.descripcion, estado: envio.estado, fechaCreacion: envio.fecha_creacion, ordenes: ordenes.map(item => ({ id: item.id_envio_orden_m5, tipo: item.tipo_orden, idOcs: item.id_ocs_m5, idExterno: item.id_orden_externa, fecha: item.fecha_asociacion })), costos: presentados, costoFinanciero: calcularCostoFinancieroEnvio(presentados), historial: historial.map(item => ({ id: item.id_historial_envio_m5, evento: item.evento, detalle: item.detalle, usuario: item.usuario_id_usuario.toString(), fecha: item.fecha_hora })) };
  }

  async listarEnviosImportaciones() { const envios = await prisma.envio_importacion_m5.findMany({ orderBy: [{ fecha: 'desc' }, { id_envio_importacion_m5: 'desc' }] }); return Promise.all(envios.map(item => this.presentarEnvio(item.id_envio_importacion_m5))); }
  obtenerEnvioImportacion(id: number) { return this.presentarEnvio(id); }

  async crearEnvioImportacion(entrada: Entrada, usuario: bigint) {
    const referencia = texto(entrada.referencia, 120).trim(); if (!referencia) throw new ErrorAplicacion(400, 'La referencia es obligatoria');
    const fecha = fechaEntrada(entrada.fecha, 'Fecha del envío'); const descripcion = contacto(entrada.descripcion, 1000);
    try { const id = await prisma.$transaction(async tx => { const envio = await tx.envio_importacion_m5.create({ data: { referencia, referencia_normalizada: referencia.toLocaleUpperCase('es-CL'), fecha, descripcion, estado: 'abierto', creado_por: usuario } }); await tx.historial_envio_importacion_m5.create({ data: { id_envio_importacion_m5: envio.id_envio_importacion_m5, evento: 'creacion', detalle: JSON.stringify({ referencia, estado: 'abierto' }), usuario_id_usuario: usuario } }); return envio.id_envio_importacion_m5; }); return this.presentarEnvio(id); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'Ya existe un envío con esa referencia'); throw error; }
  }

  async asociarOrdenEnvio(idEnvio: number, entrada: Entrada, usuario: bigint) {
    const tipo = texto(valorEntrada(entrada, 'tipoOrden', 'tipo'), 10).toUpperCase();
    if (tipo === 'OCI') throw new ErrorAplicacion(409, 'TEMPORAL_M5_DB_PATCH_PENDIENTE_INTEGRACION_OCI: la fuente oficial OCI no está disponible');
    if (tipo !== 'OCS') throw new ErrorAplicacion(400, 'Tipo de Orden de Compra inválido');
    const idOcs = identificador(valorEntrada(entrada, 'idOcs', 'id_ocs'));
    try { await prisma.$transaction(async tx => { const envio = await tx.envio_importacion_m5.findUnique({ where: { id_envio_importacion_m5: idEnvio } }); if (!envio) throw new ErrorAplicacion(404, 'Envío o importación no encontrado'); if (!['abierto','en_revision'].includes(envio.estado)) throw new ErrorAplicacion(409, 'El envío no está editable'); const orden = await tx.orden_compra_servicio_m5.findUnique({ where: { id_orden_compra_servicio_m5: idOcs } }); if (!orden) throw new ErrorAplicacion(404, 'Orden de compra de servicios no encontrada'); await tx.envio_orden_compra_m5.create({ data: { id_envio_importacion_m5: idEnvio, tipo_orden: 'OCS', id_ocs_m5: idOcs, asociado_por: usuario } }); await tx.historial_envio_importacion_m5.create({ data: { id_envio_importacion_m5: idEnvio, evento: 'asociacion_oc', detalle: JSON.stringify({ tipo: 'OCS', id: idOcs }), usuario_id_usuario: usuario } }); }); return this.presentarEnvio(idEnvio); } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'La Orden de Compra ya está asociada al envío'); throw error; }
  }

  async registrarCostoEnvio(idEnvio: number, entrada: Entrada, usuario: bigint) {
    const fuente = texto(entrada.fuente || 'directo', 20).toLowerCase(); const tipo = texto(valorEntrada(entrada, 'tipoCosto', 'tipo'), 40).trim(); if (!tipo) throw new ErrorAplicacion(400, 'El tipo de costo es obligatorio');
    try { const idCosto = await prisma.$transaction(async tx => { const envio = await tx.envio_importacion_m5.findUnique({ where: { id_envio_importacion_m5: idEnvio } }); if (!envio) throw new ErrorAplicacion(404, 'Envío o importación no encontrado'); if (!['abierto','en_revision'].includes(envio.estado)) throw new ErrorAplicacion(409, 'El envío no está editable'); let idMoneda: number; let monto: Prisma.Decimal; let equivalente: Prisma.Decimal | null; let idObligacion: number | null = null; let idComision: number | null = null; let idRespaldo: number | null = null;
      if (fuente === 'obligacion') { idObligacion = identificador(valorEntrada(entrada, 'idObligacion', 'id_obligacion')); const obligacion = await tx.obligacion_proveedor_m5.findUnique({ where: { id_obligacion_m5: idObligacion } }); if (!obligacion) throw new ErrorAplicacion(404, 'Obligación referenciada no encontrada'); idMoneda = obligacion.id_moneda; monto = obligacion.monto_original; const moneda = await tx.moneda.findUniqueOrThrow({ where: { id_moneda: idMoneda } }); equivalente = moneda.codigo_moneda === 'CLP' ? monto : obligacion.tipo_cambio ? monto.mul(obligacion.tipo_cambio).toDecimalPlaces(2) : null; }
      else if (fuente === 'comision') { idComision = identificador(valorEntrada(entrada, 'idComision', 'id_comision')); const comision = await tx.comision_bancaria_m5.findUnique({ where: { id_comision_bancaria_m5: idComision } }); if (!comision) throw new ErrorAplicacion(404, 'Comisión bancaria referenciada no encontrada'); idMoneda = comision.id_moneda; monto = comision.monto; equivalente = comision.equivalente_clp; }
      else if (fuente === 'directo') { idMoneda = identificador(valorEntrada(entrada, 'idMoneda', 'id_moneda')); monto = montoPositivo(entrada.monto); const moneda = await tx.moneda.findUnique({ where: { id_moneda: idMoneda } }); if (!moneda || moneda.estado_moneda !== 'activo') throw new ErrorAplicacion(404, 'Moneda activa no encontrada'); equivalente = moneda.codigo_moneda === 'CLP' ? monto : null; idRespaldo = (await this.crearRespaldoPostPago(tx, entrada, usuario)).id_respaldo_pago_m5; }
      else throw new ErrorAplicacion(400, 'Fuente de costo inválida');
      const costo = await tx.costo_envio_importacion_m5.create({ data: { id_envio_importacion_m5: idEnvio, tipo_costo: tipo, fuente, id_obligacion_m5: idObligacion, id_comision_bancaria_m5: idComision, id_moneda: idMoneda, monto, equivalente_clp: equivalente, descripcion: contacto(entrada.descripcion, 1000), id_respaldo_pago_m5: idRespaldo, registrado_por: usuario } }); await tx.historial_envio_importacion_m5.create({ data: { id_envio_importacion_m5: idEnvio, evento: 'alta_costo', detalle: JSON.stringify({ idCosto: costo.id_costo_envio_m5, fuente, tipo }), usuario_id_usuario: usuario } }); return costo.id_costo_envio_m5;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); return (await this.presentarEnvio(idEnvio)).costos.find(item => item.id === idCosto)!; } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ErrorAplicacion(409, 'La fuente financiera ya fue vinculada a un envío'); if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'Conflicto concurrente al registrar el costo'); throw error; }
  }

  async actualizarCostoEnvio(idEnvio: number, idCosto: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    await prisma.$transaction(async tx => {
      const envio = await tx.envio_importacion_m5.findUnique({ where: { id_envio_importacion_m5: idEnvio } });
      if (!envio) throw new ErrorAplicacion(404, 'Envío o importación no encontrado');
      if (!['abierto','en_revision'].includes(envio.estado)) throw new ErrorAplicacion(409, 'El envío no está editable');
      const costo = await tx.costo_envio_importacion_m5.findFirst({ where: { id_costo_envio_m5: idCosto, id_envio_importacion_m5: idEnvio } });
      if (!costo) throw new ErrorAplicacion(404, 'Costo de envío no encontrado');
      if (costo.fuente !== 'directo') throw new ErrorAplicacion(409, 'Un costo referenciado se corrige en su fuente financiera');
      const idMoneda = entrada.idMoneda === undefined ? costo.id_moneda : identificador(entrada.idMoneda);
      const monto = entrada.monto === undefined ? costo.monto : montoPositivo(entrada.monto);
      const moneda = await tx.moneda.findUnique({ where: { id_moneda: idMoneda } });
      if (!moneda || moneda.estado_moneda !== 'activo') throw new ErrorAplicacion(404, 'Moneda activa no encontrada');
      let idRespaldo = costo.id_respaldo_pago_m5;
      if (entrada.nombreArchivo || entrada.contenido) idRespaldo = (await this.crearRespaldoPostPago(tx, entrada, usuario)).id_respaldo_pago_m5;
      const anterior = { tipo: costo.tipo_costo, monto: Number(costo.monto), idMoneda: costo.id_moneda, descripcion: costo.descripcion };
      const nuevo = { tipo: texto(entrada.tipoCosto || costo.tipo_costo, 40), monto: Number(monto), idMoneda, descripcion: contacto(entrada.descripcion, 1000) ?? costo.descripcion };
      await tx.costo_envio_importacion_m5.update({ where: { id_costo_envio_m5: idCosto }, data: { tipo_costo: nuevo.tipo, monto, id_moneda: idMoneda, equivalente_clp: moneda.codigo_moneda === 'CLP' ? monto : null, descripcion: nuevo.descripcion, id_respaldo_pago_m5: idRespaldo } });
      await tx.historial_envio_importacion_m5.create({ data: { id_envio_importacion_m5: idEnvio, evento: 'correccion_costo', detalle: JSON.stringify({ idCosto, anterior, nuevo, motivo }), usuario_id_usuario: usuario } });
    });
    return this.presentarEnvio(idEnvio);
  }

  private async cambiarEstadoEnvio(idEnvio: number, estadoAnterior: string, estadoNuevo: string, evento: string, usuario: bigint, detalle: Entrada = {}) {
    try {
      await prisma.$transaction(async tx => {
        const actualizado = await tx.envio_importacion_m5.updateMany({ where: { id_envio_importacion_m5: idEnvio, estado: estadoAnterior }, data: { estado: estadoNuevo } });
        if (actualizado.count !== 1) {
          const existe = await tx.envio_importacion_m5.count({ where: { id_envio_importacion_m5: idEnvio } });
          throw new ErrorAplicacion(existe ? 409 : 404, existe ? 'El estado del envío no permite esta transición' : 'Envío o importación no encontrado');
        }
        await tx.historial_envio_importacion_m5.create({ data: { id_envio_importacion_m5: idEnvio, evento, detalle: JSON.stringify({ estadoAnterior, estadoNuevo, ...detalle }), usuario_id_usuario: usuario } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.presentarEnvio(idEnvio);
    } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'El envío cambió concurrentemente'); throw error; }
  }

  pasarEnvioRevision(idEnvio: number, usuario: bigint) { return this.cambiarEstadoEnvio(idEnvio, 'abierto', 'en_revision', 'paso_revision', usuario); }

  async cerrarFinancieramenteEnvio(idEnvio: number, usuario: bigint) {
    const envio = await this.presentarEnvio(idEnvio);
    if (envio.estado !== 'en_revision') throw new ErrorAplicacion(409, 'El envío debe estar En revisión para cerrarse');
    if (!envio.costos.length) throw new ErrorAplicacion(409, 'El envío no tiene costos consolidados');
    if (envio.costoFinanciero.conversionPendiente) throw new ErrorAplicacion(409, 'Existen costos sin equivalente confiable para el cierre');
    const idsOcs = envio.ordenes.filter(item => item.tipo === 'OCS' && item.idOcs).map(item => item.idOcs!);
    if (idsOcs.length) {
      const asociaciones = await prisma.asociacion_documento_oc_m5.findMany({ where: { id_ocs_m5: { in: idsOcs } } });
      if (asociaciones.some(item => item.estado_diferencia === 'sin_evaluar' || item.estado_excedente === 'pendiente')) throw new ErrorAplicacion(409, 'Existen diferencias o excedentes pendientes vinculados al envío');
      const idsDocumentos = [...new Set(asociaciones.map(item => item.id_documento_m5))];
      if (idsDocumentos.length) {
        const [documentos, propuestas] = await Promise.all([prisma.documento_proveedor_m5.findMany({ where: { id_documento_m5: { in: idsDocumentos } } }), prisma.propuesta_imputacion_m5.findMany({ where: { id_documento_m5: { in: idsDocumentos }, estado: 'pendiente' } })]);
        if (documentos.some(item => item.clase === 'preliminar' || item.estado !== 'confirmado') || propuestas.length) throw new ErrorAplicacion(409, 'Existen documentos o validaciones relevantes todavía en preparación');
      }
    }
    return this.cambiarEstadoEnvio(idEnvio, 'en_revision', 'cerrado_financieramente', 'cierre_financiero', usuario, { costoFinanciero: envio.costoFinanciero });
  }

  async reabrirEnvio(idEnvio: number, entrada: Entrada, usuario: bigint) { return this.cambiarEstadoEnvio(idEnvio, 'cerrado_financieramente', 'en_revision', 'reapertura', usuario, { motivo: motivoObligatorio(entrada.motivo) }); }

  private async presentarCajaChica(periodoEntrada: unknown) {
    const { periodo, anio, mes } = periodoCaja(periodoEntrada);
    const [fondo, gastos, historialFondo] = await Promise.all([
      prisma.fondo_caja_chica_m5.findUnique({ where: { anio_mes: { anio, mes } } }),
      prisma.gasto_caja_chica_m5.findMany({ where: { anio, mes }, orderBy: [{ fecha_registro: 'desc' }, { id_gasto_caja_chica_m5: 'desc' }] }),
      prisma.historial_fondo_caja_chica_m5.findMany({ where: { id_fondo_caja_chica_m5: { in: (await prisma.fondo_caja_chica_m5.findMany({ where: { anio, mes }, select: { id_fondo_caja_chica_m5: true } })).map(item => item.id_fondo_caja_chica_m5) } }, orderBy: { fecha_hora: 'desc' } }),
    ]);
    const ids = gastos.map(item => item.id_gasto_caja_chica_m5);
    const [respaldos, historial] = await Promise.all([prisma.respaldo_gasto_caja_chica_m5.findMany({ where: { id_gasto_caja_chica_m5: { in: ids } }, orderBy: { fecha_hora: 'desc' } }), prisma.historial_gasto_caja_chica_m5.findMany({ where: { id_gasto_caja_chica_m5: { in: ids } }, orderBy: { fecha_hora: 'desc' } })]);
    const resumen = calcularFondoCajaChica(fondo?.monto || 0, gastos);
    return { periodo, ...resumen, fondoConfigurado: !!fondo, historialFondo: historialFondo.map(item => ({ id: item.id_historial_fondo_m5, anterior: Number(item.monto_anterior), nuevo: Number(item.monto_nuevo), usuario: item.usuario_id_usuario.toString(), fecha: item.fecha_hora })), gastos: gastos.map(item => ({ id: item.id_gasto_caja_chica_m5, monto: Number(item.monto), descripcion: item.descripcion, fechaGasto: item.fecha_gasto, fechaRegistro: item.fecha_registro, periodo: `${item.anio}-${String(item.mes).padStart(2, '0')}`, comercioEmisor: item.comercio_emisor, estado: item.estado, registradoPor: item.registrado_por.toString(), resueltoPor: item.resuelto_por?.toString() || null, fechaResolucion: item.fecha_resolucion, condicionAprobacion: item.condicion_aprobacion, motivoRechazo: item.motivo_rechazo, respaldos: respaldos.filter(r => r.id_gasto_caja_chica_m5 === item.id_gasto_caja_chica_m5).map(r => ({ id: r.id_respaldo_gasto_m5, nombreArchivo: r.nombre_archivo, tipo: r.tipo_respaldo, comercioEmisor: r.comercio_emisor, actor: r.adjuntado_por.toString(), fecha: r.fecha_hora })), historial: historial.filter(h => h.id_gasto_caja_chica_m5 === item.id_gasto_caja_chica_m5).map(h => ({ id: h.id_historial_gasto_m5, evento: h.evento, detalle: h.detalle, usuario: h.usuario_id_usuario.toString(), fecha: h.fecha_hora })) })) };
  }

  consultarCajaChica(consulta: Entrada) { return this.presentarCajaChica(consulta.periodo || fechaNegocio().slice(0, 7)); }
  async obtenerGastoCajaChica(id: number) { const gasto = await prisma.gasto_caja_chica_m5.findUnique({ where: { id_gasto_caja_chica_m5: id } }); if (!gasto) throw new ErrorAplicacion(404, 'Gasto de Caja Chica no encontrado'); const caja = await this.presentarCajaChica(`${gasto.anio}-${String(gasto.mes).padStart(2, '0')}`); return caja.gastos.find(item => item.id === id)!; }

  async configurarFondoCajaChica(periodoEntrada: unknown, entrada: Entrada, usuario: bigint) {
    const { periodo, anio, mes } = periodoCaja(periodoEntrada); const monto = montoNoNegativo(entrada.monto);
    try { await prisma.$transaction(async tx => { const anterior = await tx.fondo_caja_chica_m5.findUnique({ where: { anio_mes: { anio, mes } } }); const fondo = anterior ? await tx.fondo_caja_chica_m5.update({ where: { anio_mes: { anio, mes } }, data: { monto, actualizado_por: usuario, fecha_actualizacion: new Date() } }) : await tx.fondo_caja_chica_m5.create({ data: { anio, mes, monto, actualizado_por: usuario } }); await tx.historial_fondo_caja_chica_m5.create({ data: { id_fondo_caja_chica_m5: fondo.id_fondo_caja_chica_m5, monto_anterior: anterior?.monto || 0, monto_nuevo: monto, usuario_id_usuario: usuario } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); return this.presentarCajaChica(periodo); } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) throw new ErrorAplicacion(409, 'El fondo mensual cambió concurrentemente'); throw error; }
  }

  async registrarGastoCajaChica(entrada: Entrada, usuario: bigint) {
    const monto = montoPositivo(entrada.monto); const descripcion = motivoObligatorio(entrada.descripcion); const fechaGasto = fechaEntrada(entrada.fecha || fechaNegocio(), 'Fecha del gasto'); const { periodo, anio, mes } = periodoCaja(fechaNegocio().slice(0, 7));
    const id = await prisma.$transaction(async tx => { if (!await tx.fondo_caja_chica_m5.findUnique({ where: { anio_mes: { anio, mes } } })) throw new ErrorAplicacion(409, 'El fondo del mes debe configurarse antes de registrar gastos'); const gasto = await tx.gasto_caja_chica_m5.create({ data: { anio, mes, monto, descripcion, fecha_gasto: fechaGasto, comercio_emisor: contacto(valorEntrada(entrada, 'comercioEmisor', 'comercio'), 200), estado: 'pendiente', registrado_por: usuario } }); await tx.historial_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: gasto.id_gasto_caja_chica_m5, evento: 'registro', detalle: JSON.stringify({ monto: Number(monto), periodo, origen: 'Caja Chica' }), usuario_id_usuario: usuario } }); return gasto.id_gasto_caja_chica_m5; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); return this.obtenerGastoCajaChica(id);
  }

  async adjuntarRespaldoCajaChica(id: number, entrada: Entrada, usuario: bigint) {
    const nombre = texto(valorEntrada(entrada, 'nombreArchivo', 'nombre'), 255).trim(); const contenido = texto(entrada.contenido, 10_000_000); if (!nombre || !contenido) throw new ErrorAplicacion(400, 'Archivo y contenido del respaldo son obligatorios');
    await prisma.$transaction(async tx => { const gasto = await tx.gasto_caja_chica_m5.findUnique({ where: { id_gasto_caja_chica_m5: id } }); if (!gasto) throw new ErrorAplicacion(404, 'Gasto de Caja Chica no encontrado'); if (gasto.estado !== 'pendiente') throw new ErrorAplicacion(409, 'El gasto ya fue resuelto'); const respaldo = await tx.respaldo_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: id, nombre_archivo: nombre, contenido, tipo_respaldo: contacto(valorEntrada(entrada, 'tipoRespaldo', 'tipo'), 40), comercio_emisor: contacto(valorEntrada(entrada, 'comercioEmisor', 'comercio'), 200), adjuntado_por: usuario } }); await tx.historial_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: id, evento: 'respaldo', detalle: JSON.stringify({ idRespaldo: respaldo.id_respaldo_gasto_m5, nombre, circuito: 'Caja Chica' }), usuario_id_usuario: usuario } }); }); return this.obtenerGastoCajaChica(id);
  }

  async aprobarGastoCajaChica(id: number, usuario: bigint, perfil: string) {
    try { let periodo = ''; await prisma.$transaction(async tx => { const gasto = await tx.gasto_caja_chica_m5.findUnique({ where: { id_gasto_caja_chica_m5: id } }); if (!gasto) throw new ErrorAplicacion(404, 'Gasto de Caja Chica no encontrado'); if (gasto.estado !== 'pendiente') throw new ErrorAplicacion(409, 'El gasto ya fue resuelto'); if (!await tx.respaldo_gasto_caja_chica_m5.count({ where: { id_gasto_caja_chica_m5: id } })) throw new ErrorAplicacion(409, 'El gasto requiere respaldo antes de aprobarse'); const fondo = await tx.fondo_caja_chica_m5.findUnique({ where: { anio_mes: { anio: gasto.anio, mes: gasto.mes } } }); if (!fondo) throw new ErrorAplicacion(409, 'El fondo histórico del gasto no existe'); const gastos = await tx.gasto_caja_chica_m5.findMany({ where: { anio: gasto.anio, mes: gasto.mes } }); const exceso = calcularFondoCajaChica(fondo.monto, gastos).disponibleProyectado < 0; if (exceso && perfil === 'contador' && gasto.registrado_por === usuario) throw new ErrorAplicacion(403, 'Contador no puede autoaprobar su propio gasto cuando implica exceso'); const actualizado = await tx.gasto_caja_chica_m5.updateMany({ where: { id_gasto_caja_chica_m5: id, estado: 'pendiente' }, data: { estado: 'aprobado', resuelto_por: usuario, fecha_resolucion: new Date(), condicion_aprobacion: exceso ? 'exceso' : 'normal' } }); if (actualizado.count !== 1) throw new ErrorAplicacion(409, 'El gasto cambió concurrentemente'); await tx.historial_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: id, evento: 'aprobacion', detalle: JSON.stringify({ condicion: exceso ? 'exceso' : 'normal', reservaDuplicada: false }), usuario_id_usuario: usuario } }); periodo = `${gasto.anio}-${String(gasto.mes).padStart(2, '0')}`; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); return this.presentarCajaChica(periodo); } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'El gasto cambió concurrentemente'); throw error; }
  }

  async rechazarGastoCajaChica(id: number, entrada: Entrada, usuario: bigint) {
    const motivo = motivoObligatorio(entrada.motivo);
    try { let periodo = ''; await prisma.$transaction(async tx => { const gasto = await tx.gasto_caja_chica_m5.findUnique({ where: { id_gasto_caja_chica_m5: id } }); if (!gasto) throw new ErrorAplicacion(404, 'Gasto de Caja Chica no encontrado'); if (gasto.estado !== 'pendiente') throw new ErrorAplicacion(409, 'El gasto ya fue resuelto'); const actualizado = await tx.gasto_caja_chica_m5.updateMany({ where: { id_gasto_caja_chica_m5: id, estado: 'pendiente' }, data: { estado: 'rechazado', resuelto_por: usuario, fecha_resolucion: new Date(), motivo_rechazo: motivo } }); if (actualizado.count !== 1) throw new ErrorAplicacion(409, 'El gasto cambió concurrentemente'); await tx.historial_gasto_caja_chica_m5.create({ data: { id_gasto_caja_chica_m5: id, evento: 'rechazo', detalle: JSON.stringify({ motivo, reservaLiberadaEn: `${gasto.anio}-${String(gasto.mes).padStart(2, '0')}` }), usuario_id_usuario: usuario } }); periodo = `${gasto.anio}-${String(gasto.mes).padStart(2, '0')}`; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); return this.presentarCajaChica(periodo); } catch (error) { if (error instanceof ErrorAplicacion) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ErrorAplicacion(409, 'El gasto cambió concurrentemente'); throw error; }
  }

  async catalogosDocumentosProveedor() {
    const [proveedores, tipos, monedas, categorias, ordenes, proyectos, ots] = await Promise.all([
      prisma.proveedor.findMany({ where: { estado_proveedor: 'activo' }, orderBy: { nombre_razon_social: 'asc' } }), prisma.tipo_documento.findMany({ orderBy: { nombre_tipo_documento: 'asc' } }), prisma.moneda.findMany({ where: { estado_moneda: 'activo' } }), prisma.categoria_egreso_m5.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }), prisma.orden_compra_servicio_m5.findMany({ where: { estado_ocs: 'abierta', id_moneda: { not: null } } }), prisma.proyecto.findMany({ where: { proyecto_estado_operacional: 'activo' } }), prisma.orden_trabajo.findMany(),
    ]);
    return { proveedores: proveedores.map(p => ({ id: p.id_proveedor, nombre: p.nombre_razon_social })), tipos: tipos.map(t => ({ id: t.id_tipo_documento, nombre: t.nombre_tipo_documento })), monedas: monedas.map(m => ({ id: m.id_moneda, codigo: m.codigo_moneda })), categorias, ordenes: ordenes.map(o => ({ id: o.id_orden_compra_servicio_m5, idProveedor: o.id_proveedor, idMoneda: o.id_moneda, monto: Number(o.monto_autorizado), referencia: o.referencia })), proyectos: proyectos.map(p => ({ id: p.proyecto_proyecto_id.toString(), nombre: p.proyecto_nombre_referencia || p.proyecto_codigo_proyecto || p.proyecto_proyecto_id.toString() })), ordenesTrabajo: ots.map(o => ({ id: o.orden_trabajo_id_orden.toString(), idProyecto: o.proyecto_id_proyecto?.toString() || null })) };
  }

  async listarDocumentosProveedor(consulta: Record<string, unknown>) {
    const idProveedor = consulta.idProveedor === undefined && consulta.proveedor === undefined ? undefined : identificador(valorEntrada(consulta, 'idProveedor', 'proveedor'));
    const busqueda = texto(valorEntrada(consulta, 'busqueda', 'numero'), 100);
    const estado = texto(consulta.estado, 30);
    const documentos = await prisma.documento_compra_proveedor.findMany({
      where: {
        id_proveedor: idProveedor,
        numero_documento: busqueda ? { contains: busqueda, mode: 'insensitive' } : undefined,
        estado_documento: estado ? { equals: estado, mode: 'insensitive' } : undefined,
      },
      include: { ...incluirDocumentos, proveedor: true },
      orderBy: [{ fecha_emision: 'desc' }, { id_documento_compra_proveedor: 'desc' }],
    });
    const m5 = await prisma.documento_proveedor_m5.findMany({ where: { id_proveedor: idProveedor, folio: busqueda ? { contains: busqueda, mode: 'insensitive' } : undefined, estado: estado ? { equals: estado, mode: 'insensitive' } : undefined }, orderBy: [{ fecha_emision: 'desc' }, { id_documento_m5: 'desc' }] });
    return [...await Promise.all(m5.map(documento => this.presentarDocumentoM5(documento))), ...documentos.map(documento => this.presentarDocumentoProveedor(documento))].sort((a,b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime());
  }

  async obtenerDocumentoProveedor(referencia: number | string) {
    const valor = String(referencia);
    if (valor.startsWith('m5-')) return this.presentarDocumentoM5(await this.documentoM5(identificador(valor.slice(3))));
    const id = valor.startsWith('legacy-') ? identificador(valor.slice(7)) : identificador(valor);
    const documento = await prisma.documento_compra_proveedor.findUnique({ where: { id_documento_compra_proveedor: id }, include: { ...incluirDocumentos, proveedor: true } });
    if (!documento) throw new ErrorAplicacion(404, 'Documento de proveedor no encontrado');
    return this.presentarDocumentoProveedor(documento);
  }
}
