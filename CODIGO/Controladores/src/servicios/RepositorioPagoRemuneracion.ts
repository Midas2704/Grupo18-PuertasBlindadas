import { Prisma } from '@prisma/client';

export type OrigenPagoRemuneracion =
  | { clase: 'remuneracion'; id: number }
  | { clase: 'anticipo'; id: number }
  | { clase: 'regularizacion'; id: number }
  | { clase: 'boleta_honorarios'; id: number };

type ClientePago = Pick<Prisma.TransactionClient, 'pago_remuneracion' | 'reversion_pago_remuneracion' | '$queryRaw'>;

const tiposFisicos = {
  remuneracion: 'REMUNERACION',
  anticipo: 'ANTICIPO',
  regularizacion: 'REGULARIZACION',
  boleta_honorarios: 'BOLETA_HONORARIOS',
} as const;

export class RepositorioPagoRemuneracionPrisma {
  remuneracion(id: number): OrigenPagoRemuneracion { return { clase: 'remuneracion', id }; }
  anticipo(id: number): OrigenPagoRemuneracion { return { clase: 'anticipo', id }; }
  regularizacion(id: number): OrigenPagoRemuneracion { return { clase: 'regularizacion', id }; }
  boletaHonorarios(id: number): OrigenPagoRemuneracion { return { clase: 'boleta_honorarios', id }; }

  desdePersistencia(tipo: string, id: number): OrigenPagoRemuneracion {
    if (tipo === tiposFisicos.remuneracion) return this.remuneracion(id);
    if (tipo === tiposFisicos.anticipo) return this.anticipo(id);
    if (tipo === tiposFisicos.regularizacion) return this.regularizacion(id);
    if (tipo === tiposFisicos.boleta_honorarios) return this.boletaHonorarios(id);
    throw new Error(`Tipo físico de origen de pago no soportado: ${tipo}`);
  }

  origenDesdePago(pago: { origen_tipo: string; origen_id: number }) {
    return this.desdePersistencia(pago.origen_tipo, pago.origen_id);
  }

  tipoPublico(origen: OrigenPagoRemuneracion) { return tiposFisicos[origen.clase]; }

  private criterio(origen: OrigenPagoRemuneracion) {
    return { origen_tipo: tiposFisicos[origen.clase], origen_id: origen.id };
  }

  async bloquearOrigen(cliente: ClientePago, origen: OrigenPagoRemuneracion) {
    const tipo = tiposFisicos[origen.clase];
    await cliente.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${tipo})::integer, ${origen.id}::integer)::text AS lock_result`);
  }

  async bloquearRemuneracion(cliente: ClientePago, id: number) {
    await cliente.$queryRaw(Prisma.sql`SELECT id_remuneracion FROM finanzas.remuneracion WHERE id_remuneracion = ${id} FOR UPDATE`);
  }

  async pagosConfirmadosAnticipo(cliente: ClientePago, idAnticipo: number) {
    return cliente.pago_remuneracion.findMany({
      where: { origen_tipo: tiposFisicos.anticipo, origen_id: idAnticipo, confirmado_en: { not: null } },
      include: { medio_pago: true, reversiones: true },
      orderBy: { confirmado_en: 'asc' },
    });
  }

  async idsAnticiposConPagoConfirmado(cliente: ClientePago) {
    const pagos = await cliente.pago_remuneracion.findMany({
      where: { origen_tipo: tiposFisicos.anticipo, confirmado_en: { not: null } },
      select: { origen_id: true }, distinct: ['origen_id'],
    });
    return pagos.map((pago) => pago.origen_id);
  }

  async tienePagoEfectivo(cliente: ClientePago, origen: OrigenPagoRemuneracion) {
    return (await this.estadoEconomicoOrigen(cliente, origen)).montoEfectivo.gt(0);
  }

  async buscarPagoEfectivo(cliente: ClientePago, origen: OrigenPagoRemuneracion) {
    const pagos = await cliente.pago_remuneracion.findMany({ where: { ...this.criterio(origen), estado: 'CONFIRMADO' }, include: { reversiones: true } });
    return pagos.find((pago) => pago.monto.minus(pago.reversiones.reduce((suma, item) => suma.plus(item.monto), new Prisma.Decimal(0))).gt(0)) ?? null;
  }

  async pagosEfectivosAnticipos(cliente: ClientePago, ids: number[]) {
    if (!ids.length) return [];
    const filas = await cliente.pago_remuneracion.findMany({ where: { origen_tipo: tiposFisicos.anticipo, origen_id: { in: ids }, estado: 'CONFIRMADO' }, include: { reversiones: true }, orderBy: { id_pago_remuneracion: 'asc' } });
    const acumulados = new Map<number, { idAnticipo: number; idPago: number; montoEfectivo: Prisma.Decimal }>();
    for (const fila of filas) {
      const neto = fila.monto.minus(fila.reversiones.reduce((suma, item) => suma.plus(item.monto), new Prisma.Decimal(0)));
      const previo = acumulados.get(fila.origen_id);
      acumulados.set(fila.origen_id, { idAnticipo: fila.origen_id, idPago: fila.id_pago_remuneracion, montoEfectivo: (previo?.montoEfectivo ?? new Prisma.Decimal(0)).plus(neto) });
    }
    return [...acumulados.values()].filter((fila) => fila.montoEfectivo.gt(0));
  }

  async montoPagadoEfectivo(cliente: ClientePago, origen: OrigenPagoRemuneracion) {
    const pagos = await cliente.pago_remuneracion.findMany({ where: this.criterio(origen), include: { reversiones: true } });
    return pagos.reduce((total, pago) => pago.estado === 'CONFIRMADO' ? total.plus(pago.monto).minus(pago.reversiones.reduce((suma, item) => suma.plus(item.monto), new Prisma.Decimal(0))) : total, new Prisma.Decimal(0));
  }

  async estadoEconomicoOrigen(cliente: ClientePago, origen: OrigenPagoRemuneracion, montoOriginal?: Prisma.Decimal) {
    const montoEfectivo = await this.montoPagadoEfectivo(cliente, origen);
    const saldoPendiente = montoOriginal === undefined ? null : Prisma.Decimal.max(montoOriginal.minus(montoEfectivo), new Prisma.Decimal(0));
    return { montoOriginal: montoOriginal ?? null, montoEfectivo, saldoPendiente, tienePago: montoEfectivo.gt(0) };
  }

  async buscarPorClave(cliente: ClientePago, clave: string) {
    return cliente.pago_remuneracion.findUnique({ where: { clave_idempotencia: clave } });
  }

  async crearPreparado(cliente: ClientePago, origen: OrigenPagoRemuneracion, data: {
    monto: Prisma.Decimal; idMedioPago: number; respaldo: string | null; referencia: string | null;
    claveIdempotencia: string; creadoPor: bigint;
  }) {
    return cliente.pago_remuneracion.create({ data: {
      ...this.criterio(origen), monto: data.monto, id_medio_pago: data.idMedioPago,
      respaldo: data.respaldo, referencia: data.referencia,
      clave_idempotencia: data.claveIdempotencia, creado_por: data.creadoPor,
    } });
  }

  async obtener(cliente: ClientePago, id: number, _incluirMedio = false) {
    return cliente.pago_remuneracion.findUnique({
      where: { id_pago_remuneracion: id },
      include: { medio_pago: true, reversiones: { orderBy: { registrado_en: 'asc' } } },
    });
  }

  async actualizarPreparado(cliente: ClientePago, id: number, data: {
    monto: Prisma.Decimal; idMedioPago: number; respaldo: string | null; referencia: string | null;
  }) {
    return cliente.pago_remuneracion.update({ where: { id_pago_remuneracion: id }, data: {
      monto: data.monto, id_medio_pago: data.idMedioPago, respaldo: data.respaldo, referencia: data.referencia,
    } });
  }

  async confirmarPreparado(cliente: ClientePago, id: number, idUsuario: bigint) {
    return cliente.pago_remuneracion.updateMany({
      where: { id_pago_remuneracion: id, estado: 'PREPARADO' },
      data: { estado: 'CONFIRMADO', confirmado_por: idUsuario, confirmado_en: new Date() },
    });
  }

  async listar(cliente: ClientePago) {
    return cliente.pago_remuneracion.findMany({ include: { medio_pago: true, reversiones: true }, orderBy: { creado_en: 'desc' }, take: 100 });
  }

  async anularConfirmado(cliente: ClientePago, id: number, motivo: string, idUsuario: bigint) {
    return cliente.pago_remuneracion.updateMany({ where: { id_pago_remuneracion: id, estado: 'CONFIRMADO', reversiones: { none: {} } }, data: { estado: 'ANULADO', motivo_anulacion: motivo, anulado_por: idUsuario, anulado_en: new Date() } });
  }

  async registrarReversion(cliente: ClientePago, idPago: number, monto: Prisma.Decimal, motivo: string, idUsuario: bigint) {
    return cliente.reversion_pago_remuneracion.create({ data: { id_pago_remuneracion: idPago, monto, motivo, registrado_por: idUsuario } });
  }
}
