import { Prisma } from '@prisma/client';

export const incluirPago = {
  medio_pago: true, moneda: true, categoria_pago: true,
  anulacion_pago: true, reversion_pago: true,
} satisfies Prisma.pago_clienteInclude;
export const incluirNota = {
  moneda: true, reversion_nota_venta: true, aplicacion_saldo_favor: true,
  asignacion_pago_cliente: { include: { pago_cliente: { include: incluirPago } } },
  documento_tributario: { include: { tipo_documento: true } },
  guia_despacho: true, condicion_cobro_nv: true,
  cotizacion: { include: { detalle_cotizacion: { include: { item_comercial: true } } } },
} satisfies Prisma.nota_ventaInclude;
export const incluirCotizacion = {
  moneda: true, ficha_cliente: { include: { cliente_financiero: true } },
  detalle_cotizacion: { include: {
    item_comercial: true,
    detalle_costo_material_cotizacion: { include: { historial_precio_material: { include: { material: true } } } },
  } },
} satisfies Prisma.cotizacionInclude;
export type PagoFinanciero = Prisma.pago_clienteGetPayload<{ include: typeof incluirPago }>;
export type NotaFinanciera = Prisma.nota_ventaGetPayload<{ include: typeof incluirNota }>;
const cero = () => new Prisma.Decimal(0);

// LUNA: la fecha del negocio tiene su propio reloj, el de Santiago
export const fechaNegocio = (ahora = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(ahora);
export const fechaRegistro = (fecha: Date) => fecha.toISOString().slice(0, 10);
export function diasHabilesEntre(desde: string, hasta = fechaNegocio()) {
  const inicio = new Date(`${desde}T00:00:00Z`); const fin = new Date(`${hasta}T00:00:00Z`); if (inicio.getTime() === fin.getTime()) return 0;
  const signo = inicio < fin ? 1 : -1; const cursor = signo > 0 ? new Date(inicio) : new Date(fin); const limite = signo > 0 ? fin : inicio; let cuenta = 0;
  for (; cursor < limite; cursor.setUTCDate(cursor.getUTCDate() + 1)) { const dia = cursor.getUTCDay(); if (dia !== 0 && dia !== 6) cuenta++; }
  return signo * cuenta;
}
export function clasificarPorVencer(fecha: Date | null, umbral: number) {
  if (!fecha) return 'sin_vencimiento';
  const dias = diasHabilesEntre(fechaRegistro(new Date()), fechaRegistro(fecha));
  return dias >= 0 && dias <= umbral ? 'por_vencer' : dias < 0 ? 'vencida' : 'vigente';
}

// acá calculamos con los datos recibidos, sin ir a buscar nada a la BD
export function efectoPago(pago: PagoFinanciero) {
  if (pago.anulacion_pago || ['anulado', 'rechazado'].includes(pago.estado_verificacion)) return cero();
  const revertido = pago.reversion_pago.reduce((suma, movimiento) => suma.plus(movimiento.monto), cero());
  return Prisma.Decimal.max(0, pago.monto_pago.minus(revertido));
}


export function calcularNota(nota: NotaFinanciera, hoy = fechaNegocio()) {
  const retiroComercial = ['anulada', 'revertida', 'revertida_total', 'provisional'].includes(nota.estado_nota_venta.toLowerCase());
  // Midas: el monto original se queda quieto; las reversiones van aparte
  const reversiones = nota.reversion_nota_venta.reduce((suma, movimiento) => suma.plus(movimiento.monto), cero());
  const montoComercialVigente = retiroComercial ? cero() : Prisma.Decimal.max(0, nota.monto_total.minus(reversiones));
  const pagosEfectivos = nota.asignacion_pago_cliente.reduce((suma, asignacion) =>
    suma.plus(Prisma.Decimal.min(asignacion.monto_asignado, efectoPago(asignacion.pago_cliente))), cero());
  const saldoAplicado = nota.aplicacion_saldo_favor.reduce((suma, aplicacion) => suma.plus(aplicacion.monto), cero());
  const saldoResultante = montoComercialVigente.minus(pagosEfectivos).minus(saldoAplicado);
  const saldoPendiente = Prisma.Decimal.max(0, saldoResultante);
  const excedente = Prisma.Decimal.max(0, saldoResultante.negated());
  const esMorosa = saldoPendiente.gt(0) && !!nota.fecha_vencimiento && fechaRegistro(nota.fecha_vencimiento) < hoy;
  return {
    montoOriginal: nota.monto_total.toNumber(), montoComercialVigente: montoComercialVigente.toNumber(),
    pagosEfectivos: pagosEfectivos.toNumber(), saldoAplicado: saldoAplicado.toNumber(),
    saldoResultante: saldoResultante.toNumber(), saldoPendiente: saldoPendiente.toNumber(), excedente: excedente.toNumber(),
    esMorosa, fechaVencimientoPendiente: !nota.fecha_vencimiento && saldoPendiente.gt(0),
    estadoPago: saldoPendiente.isZero() ? 'pagada' : saldoPendiente.eq(montoComercialVigente) ? 'pendiente' : 'parcial',
  };
}

export function resumirNotas(notas: NotaFinanciera[]) {
  // ojo: CLP y USD se resumen por separado
  const agrupados = new Map<string, { moneda: string; montoComercialVigente: Prisma.Decimal; pagosEfectivos: Prisma.Decimal; saldoPendiente: Prisma.Decimal; deudaVigente: Prisma.Decimal; obligacionesMorosas: Prisma.Decimal; excedente: Prisma.Decimal }>();
  for (const nota of notas) {
    const codigo = nota.moneda.codigo_moneda;
    const resumen = agrupados.get(codigo) || { moneda: codigo, montoComercialVigente: cero(), pagosEfectivos: cero(), saldoPendiente: cero(), deudaVigente: cero(), obligacionesMorosas: cero(), excedente: cero() };
    const calculo = calcularNota(nota);
    resumen.montoComercialVigente = resumen.montoComercialVigente.plus(calculo.montoComercialVigente);
    resumen.pagosEfectivos = resumen.pagosEfectivos.plus(calculo.pagosEfectivos);
    resumen.saldoPendiente = resumen.saldoPendiente.plus(calculo.saldoPendiente);
    resumen.deudaVigente = resumen.deudaVigente.plus(calculo.esMorosa ? 0 : calculo.saldoPendiente);
    resumen.obligacionesMorosas = resumen.obligacionesMorosas.plus(calculo.esMorosa ? calculo.saldoPendiente : 0);
    resumen.excedente = resumen.excedente.plus(calculo.excedente);
    agrupados.set(codigo, resumen);
  }
  return [...agrupados.values()].map(resumen => ({
    moneda: resumen.moneda, montoComercialVigente: resumen.montoComercialVigente.toNumber(),
    pagosEfectivos: resumen.pagosEfectivos.toNumber(), saldoPendiente: resumen.saldoPendiente.toNumber(),
    deudaVigente: resumen.deudaVigente.toNumber(), obligacionesMorosas: resumen.obligacionesMorosas.toNumber(),
    excedente: resumen.excedente.toNumber(),
  }));
}
