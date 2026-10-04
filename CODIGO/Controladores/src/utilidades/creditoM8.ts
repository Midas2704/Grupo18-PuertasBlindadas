import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ErrorAplicacion } from './ErrorAplicacion';

const hoy = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
type ClientePrisma = Prisma.TransactionClient | typeof prisma;

export async function fichaB2B(tx: ClientePrisma, id: number) {
  const ficha = await tx.ficha_cliente.findUnique({
    where: { id_ficha_cliente: id },
    include: { cliente_financiero: { include: { tipo_cliente_financiero: true } } },
  });
  if (!ficha) throw new ErrorAplicacion(404, 'Cliente no encontrado');
  if (ficha.cliente_financiero.tipo_cliente_financiero.nombre_tipo_cliente_financiero.toUpperCase() !== 'B2B') {
    throw new ErrorAplicacion(409, 'Crédito sólo aplica a Cliente B2B');
  }
  return ficha;
}

export async function exposicionCredito(tx: ClientePrisma, idFicha?: number) {
  const resultado = await tx.compromiso_credito_m8.aggregate({
    where: { estado: 'VIGENTE', monto_pendiente: { gt: 0 }, ...(idFicha ? { id_ficha_cliente: idFicha } : {}) },
    _sum: { monto_pendiente: true },
  });
  return resultado._sum.monto_pendiente ?? new Prisma.Decimal(0);
}

export async function limiteCreditoVigente(tx: ClientePrisma, referencia = hoy()) {
  const limites = await tx.limite_global_credito_m8.findMany({
    where: { vigencia_desde: { lte: referencia }, OR: [{ vigencia_hasta: null }, { vigencia_hasta: { gte: referencia } }] },
    orderBy: { vigencia_desde: 'desc' },
    take: 2,
  });
  if (limites.length > 1) throw new ErrorAplicacion(409, 'Existe más de un límite global vigente');
  return limites[0] ?? null;
}

export async function validarCreditoParaFormalizacion(
  tx: Prisma.TransactionClient,
  entrada: { idFicha: number; montoFinanciado: Prisma.Decimal; idCotizacion?: number; idSolicitudExcepcion?: number },
) {
  await fichaB2B(tx, entrada.idFicha);
  const condicion = await tx.condicion_crediticia_m8.findUnique({ where: { id_ficha_cliente: entrada.idFicha } });
  if (!condicion?.credito_habilitado) return { resultado: 'REQUIERE_SOLICITUD_INICIAL' as const, motivos: ['Crédito no habilitado'] };

  const motivos: string[] = [];
  const referencia = hoy();
  const utilizado = await exposicionCredito(tx, entrada.idFicha);
  const cupo = condicion.monto_cupo ?? new Prisma.Decimal(0);
  const limite = await limiteCreditoVigente(tx, referencia);
  const exposicionGlobal = await exposicionCredito(tx);
  if (condicion.suspendido) motivos.push('Crédito suspendido');
  if (!condicion.vigencia_desde || condicion.vigencia_desde > referencia || condicion.vigencia_hasta && condicion.vigencia_hasta < referencia) motivos.push('Vigencia no válida');
  if (utilizado.plus(entrada.montoFinanciado).gt(cupo)) motivos.push('Supera cupo disponible');
  if (!limite) motivos.push('Límite global no configurado');
  else if (exposicionGlobal.plus(entrada.montoFinanciado).gt(limite.monto_limite)) motivos.push('Supera límite global');
  if (!motivos.length) return { resultado: 'AUTORIZADO' as const, motivos: [], idSolicitudExcepcion: null };
  if (motivos.some(motivo => ['Crédito suspendido', 'Vigencia no válida', 'Límite global no configurado'].includes(motivo))) {
    return { resultado: 'RESTRINGIDO' as const, motivos };
  }
  const excepcion = entrada.idSolicitudExcepcion ? await tx.solicitud_crediticia_m8.findFirst({
    where: {
      id_solicitud_crediticia: entrada.idSolicitudExcepcion,
      id_ficha_cliente: entrada.idFicha,
      tipo_solicitud: 'EXCEPCION',
      estado_solicitud: 'APROBADA',
      ...(entrada.idCotizacion ? { id_cotizacion: entrada.idCotizacion } : {}),
    },
    include: { resolucion: true },
  }) : null;
  return excepcion?.resolucion
    ? { resultado: 'AUTORIZADO' as const, motivos, idSolicitudExcepcion: excepcion.id_solicitud_crediticia }
    : { resultado: 'REQUIERE_EXCEPCION' as const, motivos };
}

export async function registrarCompromisoCredito(
  tx: Prisma.TransactionClient,
  entrada: { idFicha: number; idNota: number; montoFinanciado: Prisma.Decimal; idSolicitudExcepcion?: number | null },
) {
  return tx.compromiso_credito_m8.upsert({
    where: { id_nota_venta: entrada.idNota },
    update: {},
    create: {
      id_ficha_cliente: entrada.idFicha,
      id_nota_venta: entrada.idNota,
      id_solicitud_excepcion: entrada.idSolicitudExcepcion ?? null,
      monto_original: entrada.montoFinanciado,
      monto_pendiente: entrada.montoFinanciado,
    },
  });
}

export async function reducirCompromisoPorPago(
  tx: Prisma.TransactionClient,
  idPago: number,
  idNota: number,
  montoPago: Prisma.Decimal,
) {
  if (await tx.reduccion_compromiso_credito_m8.findUnique({ where: { id_pago_cliente: idPago } })) return null;
  const compromiso = await tx.compromiso_credito_m8.findUnique({ where: { id_nota_venta: idNota } });
  if (!compromiso || compromiso.estado !== 'VIGENTE') return null;
  const reduccion = Prisma.Decimal.min(compromiso.monto_pendiente, montoPago);
  if (reduccion.lte(0)) return null;
  const pendiente = compromiso.monto_pendiente.minus(reduccion);
  const creada = await tx.reduccion_compromiso_credito_m8.create({
    data: { id_compromiso: compromiso.id_compromiso, id_pago_cliente: idPago, monto_reduccion: reduccion },
  });
  await tx.compromiso_credito_m8.update({
    where: { id_compromiso: compromiso.id_compromiso },
    data: { monto_pendiente: pendiente, estado: pendiente.eq(0) ? 'LIBERADO' : 'VIGENTE', fecha_liberacion: pendiente.eq(0) ? new Date() : null },
  });
  return creada;
}
