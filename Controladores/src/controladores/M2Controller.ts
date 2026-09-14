import { prepararPago } from '../utilidades/pago';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { calcularNota, consolidarNotasClp, estadoVisibleNota, fechaNegocio, incluirCotizacion, incluirNota, resumirNotas } from '../utilidades/finanzas';
import { identificador, numeroNoNegativo, texto } from '../validaciones/solicitudes';
import { BancoCentral, C_BancoCentral } from '../utilidades/C_BancoCentral';

type Entrada = Record<string, any>; // viene del contrato HTTP antiguo; los datos se validan antes de guardar
function importes(base: Prisma.Decimal, tipo: unknown, valor: unknown, exento: unknown) {
  if (typeof exento !== 'boolean') throw new ErrorAplicacion(400, 'Indica IVA o exención');
  const descuento = new Prisma.Decimal(numeroNoNegativo(valor ?? 0, 'Descuento'));
  if (tipo && !['porcentaje', 'monto_fijo', 'fijo'].includes(String(tipo))) throw new ErrorAplicacion(400, 'Tipo de descuento inválido');
  if ((tipo === 'porcentaje' && descuento.gt(100)) || (tipo !== 'porcentaje' && descuento.gt(base))) throw new ErrorAplicacion(400, 'Descuento fuera de límites');
  const montoDescuento = !tipo ? new Prisma.Decimal(0) : tipo === 'porcentaje' ? base.mul(descuento).div(100) : descuento;
  const neto = base.minus(montoDescuento).toDecimalPlaces(2);
  const impuesto = exento ? new Prisma.Decimal(0) : neto.mul('0.19').toDecimalPlaces(2);
  return { neto, impuesto, total: neto.plus(impuesto), descuento: montoDescuento.toDecimalPlaces(2) };
}

function rutValido(rut: string) {
  const [cuerpo, digito] = rut.split('-');
  if (!cuerpo || !digito) return false;
  let suma = 0; let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) { suma += Number(cuerpo[indice]) * multiplicador; multiplicador = multiplicador === 7 ? 2 : multiplicador + 1; }
  const resultado = 11 - suma % 11;
  return (resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado)) === digito;
}

async function construirCosteoCotizacion(
  transaccion: Prisma.TransactionClient,
  productos: Entrada[],
  monedaCostos: { id_moneda: number },
  margen: number,
  permitirAjustes = false,
) {
  const detalles: Prisma.detalle_cotizacionCreateWithoutCotizacionInput[] = [];
  let costoTotal = new Prisma.Decimal(0);
  for (const producto of productos) {
    const item = producto.id_item_comercial
      ? await transaccion.item_comercial.findFirst({ where: { id_item_comercial: identificador(producto.id_item_comercial), estado_item: 'activo' } })
      : await transaccion.item_comercial.findFirst({ where: { nombre_item: texto(producto.tipo_producto), estado_item: 'activo' } });
    if (!item) throw new ErrorAplicacion(400, 'Selecciona un producto activo del catálogo');
    const medidas = texto(producto.medidas, 100).split(/[xX]/).map(valor => Number(valor));
    if (medidas.length !== 3 || medidas.some(valor => !Number.isFinite(valor) || valor <= 0)) throw new ErrorAplicacion(400, 'Completa las tres medidas del producto');
    const cantidadProducto = numeroNoNegativo(producto.cantidad ?? 1, 'Cantidad de producto');
    if (!Number.isInteger(cantidadProducto) || cantidadProducto <= 0) throw new ErrorAplicacion(400, 'La cantidad de producto debe ser un entero mayor a cero');
    if (!Array.isArray(producto.materiales) || !producto.materiales.length) throw new ErrorAplicacion(400, 'Selecciona los materiales');
    let costoProducto = new Prisma.Decimal(0);
    const materiales: Prisma.detalle_costo_material_cotizacionCreateWithoutDetalle_cotizacionInput[] = [];
    for (const material of producto.materiales as Entrada[]) {
      const origen = await transaccion.historial_precio_material.findUnique({ where: { id_historial_precio_material: identificador(material.id_historial_precio_material) } });
      if (!origen || origen.estado_precio !== 'vigente' || origen.id_moneda !== monedaCostos.id_moneda) throw new ErrorAplicacion(400, 'Los materiales de la Cotización deben tener un costo vigente en CLP');
      const cantidadMaterial = numeroNoNegativo(material.cantidad, 'Cantidad de material');
      if (cantidadMaterial <= 0) throw new ErrorAplicacion(400, 'La cantidad de material debe ser mayor a cero');
      const tieneAjuste = permitirAjustes && material.costo_ajustado !== undefined;
      const precioUsado = tieneAjuste ? new Prisma.Decimal(numeroNoNegativo(material.costo_ajustado, 'Costo ajustado')) : origen.precio_unitario;
      const subtotal = precioUsado.mul(cantidadMaterial).mul(cantidadProducto).toDecimalPlaces(2);
      costoProducto = costoProducto.plus(subtotal);
      materiales.push({
        historial_precio_material: { connect: { id_historial_precio_material: origen.id_historial_precio_material } },
        cantidad_material_estimada: cantidadMaterial, precio_unitario_usado: precioUsado, subtotal_material_estimado: subtotal,
        observacion: tieneAjuste ? `Costo original ${origen.precio_unitario.toString()}; ajuste autorizado` : undefined,
      });
    }
    costoTotal = costoTotal.plus(costoProducto);
    detalles.push({
      item_comercial: { connect: { id_item_comercial: item.id_item_comercial } }, cantidad_item: cantidadProducto,
      descripcion_item_cotizado: texto(producto.descripcion, 500) || `${item.nombre_item} (${producto.medidas})`,
      observacion_medidas: texto(producto.observaciones, 2000), medida_alto_referencial: medidas[0],
      medida_ancho_referencial: medidas[1], medida_espesor_referencial: medidas[2],
      subtotal_item_estimado: costoProducto.div(new Prisma.Decimal(1).minus(new Prisma.Decimal(margen).div(100))).toDecimalPlaces(2),
      detalle_costo_material_cotizacion: { create: materiales },
    });
  }
  const precioSugerido = costoTotal.div(new Prisma.Decimal(1).minus(new Prisma.Decimal(margen).div(100))).toDecimalPlaces(2);
  return { costoTotal, precioSugerido, detalles };
}

const MOTIVO_TIPO_CAMBIO_COTIZACION = 'Conversión USD/CLP de Cotización';
const convertirDesdeClp = (monto: Prisma.Decimal, tipoCambio: Prisma.Decimal | null) =>
  tipoCambio ? monto.div(tipoCambio).toDecimalPlaces(2) : monto.toDecimalPlaces(2);

async function guardarTipoCambioCotizacion(transaccion: Prisma.TransactionClient, idCotizacion: number, tipoCambio: Prisma.Decimal | null) {
  if (!tipoCambio) return;
  await transaccion.cotizacion_version.create({ data: {
    id_cotizacion: idCotizacion, motivo: MOTIVO_TIPO_CAMBIO_COTIZACION,
    antecedentes: { monedaBase: 'CLP', monedaCotizacion: 'USD', tipoCambio: tipoCambio.toString(), fecha: fechaNegocio() },
  } });
}

async function obtenerTipoCambioCotizacion(transaccion: Prisma.TransactionClient, idCotizacion: number, codigoMoneda: string, respaldo?: unknown) {
  if (codigoMoneda === 'CLP') return null;
  const version = await transaccion.cotizacion_version.findFirst({
    where: { id_cotizacion: idCotizacion, motivo: MOTIVO_TIPO_CAMBIO_COTIZACION },
    orderBy: { id_cotizacion_version: 'desc' },
  });
  const antecedente = version?.antecedentes as { tipoCambio?: unknown } | undefined;
  const valor = antecedente?.tipoCambio;
  if ((typeof valor === 'string' || typeof valor === 'number') && new Prisma.Decimal(valor).gt(0)) return new Prisma.Decimal(valor);
  if ((typeof respaldo === 'string' || typeof respaldo === 'number') && new Prisma.Decimal(respaldo).gt(0)) return new Prisma.Decimal(respaldo);
  throw new ErrorAplicacion(409, 'La Cotización USD no conserva un tipo de cambio histórico válido');
}

/** M2 CU12–CU41. Compatibilidad del frontend existente; no sustituye la implementación completa de los CU. */
export class M2Controller {
  constructor(private readonly bancoCentral: BancoCentral = new C_BancoCentral()) {}
  private async resolverTipoCambioCotizacion(codigoMoneda: string, entrada: Entrada) {
    if (codigoMoneda === 'CLP') return null;
    try {
      const tipoCambio = new Prisma.Decimal(await this.bancoCentral.obtenerTipoCambio('USD', fechaNegocio()));
      if (!tipoCambio.isFinite() || tipoCambio.lte(0)) throw new ErrorAplicacion(502, 'Banco Central entregó un tipo de cambio inválido');
      return tipoCambio;
    } catch (error) {
      if (entrada.tipoCambioManual !== true) throw error;
      const tipoCambio = new Prisma.Decimal(numeroNoNegativo(entrada.tipoCambio, 'Tipo de cambio manual'));
      if (!tipoCambio.isFinite() || tipoCambio.lte(0)) throw new ErrorAplicacion(400, 'El tipo de cambio USD/CLP debe ser mayor a cero');
      return tipoCambio;
    }
  }
  async enTransaccion<T>(accion: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(accion,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
  }

  async consolidarB2C(idCotizacion:number, entrada:Entrada, responsable:string) {
    return this.enTransaccion(async tx=>{
      const cotizacion=await tx.cotizacion.findUnique({where:{id_cotizacion:idCotizacion},include:{...incluirCotizacion,nota_venta:true}});
      if(!cotizacion || cotizacion.estado_cotizacion!=='emitida' || !cotizacion.fecha_vigencia || cotizacion.fecha_vigencia.toISOString().slice(0,10)<fechaNegocio() || cotizacion.nota_venta) throw new ErrorAplicacion(409,'Cotización no emitida/vigente o ya consolidada');
      const cliente=cotizacion.ficha_cliente.cliente_financiero;
      const tipo=await tx.tipo_cliente_financiero.findUnique({where:{id_tipo_cliente_financiero:cliente.id_tipo_cliente_financiero}});
      if(tipo?.nombre_tipo_cliente_financiero!=='B2C' || cliente.estado_financiero!=='activo' || cliente.nivel_formalizacion!=='formal') throw new ErrorAplicacion(409,'La consolidación exige cliente B2C activo y formalizado');
      if(cotizacion.monto_neto===null || cotizacion.monto_impuesto===null || cotizacion.monto_total_estimado===null || cotizacion.monto_total_estimado.lte(0)) throw new ErrorAplicacion(409,'Completa las condiciones comerciales antes de consolidar');
      // Midas: nota y pago salen juntos de esta transacción, o no sale ninguno
      const tipoCambio=await obtenerTipoCambioCotizacion(tx,idCotizacion,cotizacion.moneda.codigo_moneda,entrada.tipoCambio);
      const nota=await tx.nota_venta.create({data:{numero_nota_venta:`B2C-${randomUUID()}`,id_cotizacion:idCotizacion,id_ficha_cliente:cotizacion.id_ficha_cliente,id_moneda:cotizacion.id_moneda,fecha_emision:new Date(`${fechaNegocio()}T00:00:00Z`),monto_neto:cotizacion.monto_neto,monto_impuesto:cotizacion.monto_impuesto,monto_total:cotizacion.monto_total_estimado,tipo_cambio_usado:tipoCambio,monto_convertido:tipoCambio?cotizacion.monto_total_estimado.mul(tipoCambio).toDecimalPlaces(2):null,exento_iva:cotizacion.exento_iva,estado_nota_venta:'emitida'},include:incluirNota});
      const idDocumento=entrada.idDocumento?identificador(entrada.idDocumento):null;
      const documento=idDocumento?await tx.documento_tributario.findUnique({where:{id_documento_tributario:idDocumento}}):null;
      if(idDocumento&&(!documento || documento.id_ficha_cliente!==nota.id_ficha_cliente))throw new ErrorAplicacion(400,'Selecciona un documento tributario existente del mismo cliente');
      const catalogo={medios:await tx.medio_pago.findMany({where:{estado_medio_pago:'activo'}}),categorias:await tx.categoria_pago.findMany({where:{activo:true}}),cuotas:await tx.config_cuotas_tarjeta.findMany({where:{activo:true}})};
      const datosPago=tipoCambio?{...entrada,tipoCambio:tipoCambio.toString()}:entrada;
      const pago=await tx.pago_cliente.create({data:prepararPago(nota,datosPago,catalogo,idDocumento,responsable)});
      const actual=await tx.nota_venta.findUniqueOrThrow({where:{id_nota_venta:nota.id_nota_venta},include:incluirNota});
      await tx.nota_venta.update({where:{id_nota_venta:nota.id_nota_venta},data:{estado_pago:calcularNota(actual).estadoPago}});
      await tx.cotizacion.update({where:{id_cotizacion:idCotizacion},data:{estado_cotizacion:'aprobada'}});
      return {mensaje:'Venta B2C consolidada con su primer pago',idNota:nota.id_nota_venta,idPago:pago.id_pago_cliente};
    });
  }

  async aprobarCotizacionB2B(idCotizacion: number, entrada: Entrada) {
    return this.enTransaccion(async tx => {
      const cot = await tx.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion }, include: { nota_venta: true, orden_compra_b2b: true, moneda: true } });
      if (!cot || cot.estado_cotizacion !== 'emitida' || cot.nota_venta) throw new ErrorAplicacion(409, 'La Cotización no está disponible para aceptación');
      if (!cot.fecha_vigencia || cot.fecha_vigencia.toISOString().slice(0, 10) < fechaNegocio()) throw new ErrorAplicacion(409, 'La Cotización está vencida; no se puede aceptar');
      const folio = texto(entrada.folioOrdenCompra, 100); const respaldo = texto(entrada.respaldoOrdenCompra, 4500000);
      if (!folio || !respaldo) throw new ErrorAplicacion(400, 'El folio y respaldo de la Orden de Compra son obligatorios');
      const oc = await tx.orden_compra_b2b.create({ data: { id_cotizacion: idCotizacion, folio, respaldo, fecha: new Date(`${fechaNegocio()}T00:00:00Z`) } });
      let tipoCambio:Prisma.Decimal|null;
      try{tipoCambio=await obtenerTipoCambioCotizacion(tx,idCotizacion,cot.moneda.codigo_moneda,entrada.tipoCambio);}catch(error){
        if(!(error instanceof ErrorAplicacion)||cot.moneda.codigo_moneda!=='USD')throw error;
        tipoCambio=await this.resolverTipoCambioCotizacion(cot.moneda.codigo_moneda,entrada);
      }
      const montoTotal=cot.monto_total_estimado || new Prisma.Decimal(0);
      const nota = await tx.nota_venta.create({ data: { numero_nota_venta: `B2B-${randomUUID()}`, id_cotizacion: idCotizacion, id_ficha_cliente: cot.id_ficha_cliente, id_moneda: cot.id_moneda, fecha_emision: new Date(`${fechaNegocio()}T00:00:00Z`), monto_neto: cot.monto_neto || 0, monto_impuesto: cot.monto_impuesto || 0, monto_total: montoTotal, tipo_cambio_usado: tipoCambio, monto_convertido: tipoCambio?montoTotal.mul(tipoCambio).toDecimalPlaces(2):null, exento_iva: cot.exento_iva, estado_nota_venta: 'emitida', estado_pago: 'pendiente' } });
      await tx.cotizacion.update({ where: { id_cotizacion: idCotizacion }, data: { estado_cotizacion: 'aprobada' } });
      return { mensaje: 'Orden de Compra registrada y Nota de Venta generada', idNota: nota.id_nota_venta, ordenCompra: oc };
    });
  }

  async registrarClienteDesdeCotizacion(entrada: Entrada) {
    const nombre = texto(entrada.nombre, 150); const tipo = texto(entrada.tipo || 'B2C', 30).toUpperCase();
    const rut = texto(entrada.rut, 15).replace(/\./g, '').toUpperCase() || null;
    if (!nombre || !['B2B','B2C'].includes(tipo)) throw new ErrorAplicacion(400, 'Nombre y tipo de cliente son obligatorios');
    if (tipo === 'B2B' && !rut) throw new ErrorAplicacion(400, 'El RUT es obligatorio para clientes B2B');
    if (tipo === 'B2C' && !texto(entrada.telefono, 30)) throw new ErrorAplicacion(400, 'El teléfono es obligatorio para clientes B2C provisionales');
    if (tipo === 'B2B' && !texto(entrada.contacto, 150)) throw new ErrorAplicacion(400, 'El contacto es obligatorio para clientes B2B');
    if (entrada.confirmado !== true) throw new ErrorAplicacion(400, 'Confirma el registro del cliente');
    return prisma.$transaction(async tx => {
      const tipoCliente = await tx.tipo_cliente_financiero.findFirst({ where: { nombre_tipo_cliente_financiero: { equals: tipo, mode: 'insensitive' } } });
      if (!tipoCliente) throw new ErrorAplicacion(400, 'Tipo de cliente no configurado');
      const rutFormateado = rut && rut.includes('-') ? `${rut.split('-')[0]?.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.split('-')[1]}` : rut;
      if (rut && await tx.cliente_financiero.findFirst({ where: { rut_cliente: { in: [rut, rutFormateado || rut], mode: 'insensitive' } } })) throw new ErrorAplicacion(409, 'El cliente ya existe');
      if (rut) await tx.cliente.upsert({ where: { cliente_cliente_rut: rutFormateado || rut }, update: { cliente_razon_social: nombre, cliente_contacto_principal: texto(entrada.contacto,150) || undefined, cliente_correo: texto(entrada.correo,150) || undefined, cliente_telefono: texto(entrada.telefono,30) || undefined }, create: { cliente_cliente_rut: rutFormateado || rut, cliente_razon_social: nombre, cliente_contacto_principal: texto(entrada.contacto,150) || null, cliente_correo: texto(entrada.correo,150) || null, cliente_telefono: texto(entrada.telefono,30) || null, cliente_es_cliente_b2b: tipo === 'B2B', cliente_es_cliente_b2c: tipo === 'B2C' } });
      const cliente = await tx.cliente_financiero.create({ data: { rut_cliente: rutFormateado, id_tipo_cliente_financiero: tipoCliente.id_tipo_cliente_financiero, nombre_razon_social_referencia: nombre, contacto_financiero: texto(entrada.contacto,150) || null, correo_financiero: texto(entrada.correo,150) || null, telefono_financiero: texto(entrada.telefono,30) || null, estado_financiero: 'activo', nivel_formalizacion: rut ? 'formal' : 'provisional', ficha_cliente: { create: {} } }, include: { ficha_cliente: true } });
      const idCotizacion = entrada.idCotizacion ? identificador(entrada.idCotizacion) : null;
      if (idCotizacion) {
        const cotizacion = await tx.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion } });
        if (!cotizacion || cotizacion.estado_cotizacion !== 'borrador') throw new ErrorAplicacion(409, 'La Cotización debe estar en elaboración');
        await tx.cotizacion.update({ where: { id_cotizacion: idCotizacion }, data: { id_ficha_cliente: cliente.ficha_cliente!.id_ficha_cliente } });
      }
      return { mensaje: 'Cliente registrado desde Cotización', cliente, idCotizacion };
    });
  }

  async emitirCotizacion(idCotizacion: number) {
    return prisma.$transaction(async tx => {
      const cot = await tx.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion }, include: { detalle_cotizacion: true } });
      if (!cot || cot.estado_cotizacion !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se puede emitir un borrador disponible');
      if (!cot.id_ficha_cliente || !cot.fecha_vigencia || !cot.monto_total_estimado || cot.monto_total_estimado.lte(0) || !cot.detalle_cotizacion.length) throw new ErrorAplicacion(409, 'La Cotización está incompleta');
      return tx.cotizacion.update({ where: { id_cotizacion: idCotizacion }, data: { estado_cotizacion: 'emitida' } });
    });
  }

  async reactivarCotizacion(idCotizacion: number, entrada: Entrada) {
    const fecha = texto(entrada.fechaVigencia, 20); if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha <= fechaNegocio()) throw new ErrorAplicacion(400, 'La nueva vigencia debe ser posterior a hoy');
    return prisma.$transaction(async tx => {
      const cot = await tx.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion } }); if (!cot || cot.estado_cotizacion !== 'vencida') throw new ErrorAplicacion(409, 'La Cotización no está vencida');
      await tx.cotizacion_version.create({ data: { id_cotizacion: idCotizacion, motivo: 'Reactivación de Cotización vencida', antecedentes: { fechaAnterior: cot.fecha_vigencia?.toISOString() || null } } });
      return tx.cotizacion.update({ where: { id_cotizacion: idCotizacion }, data: { fecha_vigencia: new Date(`${fecha}T00:00:00Z`), estado_cotizacion: 'emitida' } });
    });
  }

  async formalizarClienteB2C(entrada: Entrada) {
    const id = identificador(entrada.idCliente); const rut = texto(entrada.rut,15).replace(/\./g,'').toUpperCase();
    const nombre = texto(entrada.nombre,150); const telefono = texto(entrada.telefono,30);
    if (!/^\d{7,8}-[0-9K]$/i.test(rut) || !rutValido(rut)) throw new ErrorAplicacion(400, 'Ingresa un RUT válido con guion');
    if (!nombre || !telefono) throw new ErrorAplicacion(400, 'Nombre y teléfono son obligatorios para formalizar');
    return prisma.$transaction(async tx => {
      const cliente = await tx.cliente_financiero.findUnique({ where: { id_cliente_financiero: id }, include: { tipo_cliente_financiero: true, ficha_cliente: true } });
      if (!cliente || cliente.tipo_cliente_financiero.nombre_tipo_cliente_financiero.toUpperCase() !== 'B2C' || cliente.nivel_formalizacion !== 'provisional') throw new ErrorAplicacion(409, 'El cliente no está disponible para formalización B2C');
      const idCotizacion = entrada.idCotizacion ? identificador(entrada.idCotizacion) : undefined;
      if (idCotizacion) { const cotizacion = await tx.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion } }); if (!cotizacion || cotizacion.estado_cotizacion !== 'borrador' || cotizacion.id_ficha_cliente !== cliente.ficha_cliente?.id_ficha_cliente) throw new ErrorAplicacion(409, 'La Cotización ya no está disponible o no pertenece al cliente'); }
      const rutFormateado = `${rut.split('-')[0]?.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.split('-')[1]}`;
      const existente = await tx.cliente_financiero.findFirst({ where: { rut_cliente: { in: [rut, rutFormateado], mode: 'insensitive' }, id_cliente_financiero: { not: id } } }); if (existente) throw new ErrorAplicacion(409, 'El RUT ya está asociado a otro cliente');
      await tx.cliente.upsert({ where: { cliente_cliente_rut: rutFormateado }, update: { cliente_razon_social: nombre, cliente_contacto_principal: texto(entrada.contacto,150) || undefined, cliente_correo: texto(entrada.correo,150) || undefined, cliente_telefono: telefono }, create: { cliente_cliente_rut: rutFormateado, cliente_razon_social: nombre, cliente_contacto_principal: texto(entrada.contacto,150) || null, cliente_correo: texto(entrada.correo,150) || null, cliente_telefono: telefono, cliente_es_cliente_b2c: true, cliente_es_cliente_b2b: false } });
      const actualizado = await tx.cliente_financiero.update({ where: { id_cliente_financiero: id }, data: { rut_cliente: rutFormateado, nivel_formalizacion: 'formal', nombre_razon_social_referencia: nombre, correo_financiero: texto(entrada.correo,150) || undefined, telefono_financiero: telefono, contacto_financiero: texto(entrada.contacto,150) || undefined } });
      return { mensaje: 'Cliente B2C formalizado', cliente: actualizado, idCotizacion };
    });
  }

  async configurarEtapasCobro(idNota: number, entrada: Entrada) {
    if (!Array.isArray(entrada.etapas) || !entrada.etapas.length) throw new ErrorAplicacion(400, 'Define al menos una etapa de cobro');
    return prisma.$transaction(async tx => {
      const nota = await tx.nota_venta.findUnique({ where: { id_nota_venta: idNota } }); if (!nota) throw new ErrorAplicacion(404, 'Nota de Venta no encontrada');
      await tx.hito_cobro.deleteMany({ where: { id_nota_venta: idNota } });
      const permitidas = ['anticipo', 'abono parcial', 'pago final'];
      const etapas = (entrada.etapas as Entrada[]).map(e => { const descripcion=texto(e.descripcion,150); const fecha=texto(e.fecha,20); const monto=numeroNoNegativo(e.monto,'Monto etapa'); if(!descripcion || !permitidas.includes(descripcion.toLowerCase()) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ErrorAplicacion(400,'Etapa inválida: usa Anticipo, Abono parcial o Pago final'); return { id_nota_venta:idNota, descripcion_hito:descripcion, fecha_programada_cobro:new Date(`${fecha}T00:00:00Z`), monto_programado:monto }; });
      if (new Set(etapas.map(e => e.descripcion_hito.toLowerCase())).size !== etapas.length) throw new ErrorAplicacion(400, 'No repitas una etapa de cobro');
      return tx.hito_cobro.createMany({ data: etapas });
    });
  }
  async registrarReversion(tx:Prisma.TransactionClient,idNota:number,entrada:Entrada,responsable:string) {
    const nota=await tx.nota_venta.findUnique({where:{id_nota_venta:idNota},include:incluirNota});
    if(!nota || !nota.asignacion_pago_cliente.length || ['anulada','cerrada','revertida_total'].includes(nota.estado_nota_venta)) throw new ErrorAplicacion(409,'La reversión requiere una NV vigente con pagos asociados');
    const monto=new Prisma.Decimal(numeroNoNegativo(entrada.monto,'Monto a revertir'));const actual=calcularNota(nota);
    if(monto.lte(0)||monto.gt(actual.montoComercialVigente)||!monto.eq(numeroNoNegativo(entrada.montoDocumento,'Monto indicado en la Nota de Crédito'))) throw new ErrorAplicacion(400,'Monto de reversión inconsistente con la Nota de Crédito');
    const motivo=texto(entrada.motivo,2000),folio=texto(entrada.folio,100);
    if(!motivo||!folio||entrada.confirmacionMontoPdf!==true)throw new ErrorAplicacion(400,'Completa motivo, folio y revisión del monto del PDF');
    const respaldo=texto(entrada.respaldoPdf,4500000);
    if(!respaldo.startsWith('data:application/pdf;base64,'))throw new ErrorAplicacion(400,'Adjunta la Nota de Crédito PDF');
    const bytes=Buffer.from(respaldo.split(',')[1] || '', 'base64');
    if(bytes.length>3000000 || !bytes.subarray(0,5).equals(Buffer.from('%PDF-')) || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new ErrorAplicacion(400,'Archivo PDF no válido');
    const reversion=await tx.reversion_nota_venta.create({data:{id_nota_venta:idNota,monto,motivo,folio_nota_credito:folio,respaldo_pdf:respaldo,responsable}});
    await tx.nota_venta.update({where:{id_nota_venta:idNota},data:{estado_nota_venta:monto.eq(actual.montoComercialVigente)?'revertida_total':'revertida_parcial'}});
    return reversion;
  }
  async listarInventario() {
    const materiales = await prisma.historial_precio_material.findMany({ where: { estado_precio: 'vigente' }, include: { material: true, moneda: true } });
    return materiales.map(material => ({ id_historial_precio_material: material.id_historial_precio_material,
      sku: material.material_sku, nombre: material.material.material_nombre_material,
      precio_unitario: material.precio_unitario.toNumber(), moneda: material.moneda.codigo_moneda,
    }));
  }
  async listarProductos() { return prisma.item_comercial.findMany({ where: { estado_item: 'activo' } }); }
  async listarMonedas() { return prisma.moneda.findMany({ where: { estado_moneda: 'activo', codigo_moneda: { in: ['CLP', 'USD'] } } }); }
  async consultarResumen() {
    const [notas, cotizacionesPendientes] = await Promise.all([
      prisma.nota_venta.findMany({ include: incluirNota }),
      prisma.cotizacion.count({ where: { estado_cotizacion: { in: ['borrador', 'emitida'] } } }),
    ]);
    const saldosPorMoneda = resumirNotas(notas);
    const consolidadoClp = consolidarNotasClp(notas);
    return { ingresosTotales: consolidadoClp.montoComercialVigente, cotizacionesPendientes, saldosPorMoneda, consolidadoClp };
  }
  async consultarBandeja(historial = false) {
    const [cotizaciones, notas] = await Promise.all([
      prisma.cotizacion.findMany({ where: { estado_cotizacion: { in: historial ? ['aprobada', 'anulada', 'rechazada', 'descartada', 'vencida'] : ['borrador', 'emitida'] } }, include: incluirCotizacion, orderBy: { fecha_emision: 'desc' } }),
      prisma.nota_venta.findMany({ where: { estado_nota_venta: { in: historial ? ['confirmada', 'anulada', 'cerrada', 'revertida_parcial', 'revertida_total'] : ['emitida'] } }, include: { ...incluirNota, ficha_cliente: { include: { cliente_financiero: true } } }, orderBy: { fecha_emision: 'desc' } }),
    ]);
    return { cotizaciones, notas_venta: notas.map(nota => { const calculo=calcularNota(nota); return { ...nota, estado_pago: calculo.estadoPago, estadoNotaVentaVisible: estadoVisibleNota(nota,calculo.estadoPago), ...calculo }; }) };
  }

  async guardarCotizacion(entrada: Entrada) {
    const rut = texto(entrada.rut_cliente).replace(/\./g, '').toUpperCase();
    const idFichaCliente = entrada.id_ficha_cliente ? identificador(entrada.id_ficha_cliente) : null;
    if (!rut && !idFichaCliente) throw new ErrorAplicacion(400, 'Selecciona un cliente');
    const partesRut = rut.split('-');
    const rutFormateado = rut ? `${partesRut[0]?.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${partesRut[1]}` : null;
    const fechaVigencia = texto(entrada.fecha_vigencia);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVigencia) || !Number.isFinite(Date.parse(fechaVigencia)) || fechaVigencia <= fechaNegocio()) throw new ErrorAplicacion(400, 'La vigencia debe ser posterior a hoy');
    const margen = numeroNoNegativo(entrada.margen_esperado, 'Margen');
    if (margen >= 100) throw new ErrorAplicacion(400, 'El margen debe ser menor a 100 para calcular el precio');
    if (!Array.isArray(entrada.productos) || !entrada.productos.length) throw new ErrorAplicacion(400, 'Incluye al menos un producto');
    const idMonedaObjetivo=identificador(entrada.id_moneda);
    const monedaObjetivo=await prisma.moneda.findUnique({where:{id_moneda:idMonedaObjetivo}});
    if(!monedaObjetivo||monedaObjetivo.estado_moneda!=='activo'||!['CLP','USD'].includes(monedaObjetivo.codigo_moneda))throw new ErrorAplicacion(400,'Moneda no habilitada');
    const tipoCambio=await this.resolverTipoCambioCotizacion(monedaObjetivo.codigo_moneda,entrada);
    return prisma.$transaction(async transaccion => {
      const fichaDirecta = idFichaCliente ? await transaccion.ficha_cliente.findUnique({ where: { id_ficha_cliente: idFichaCliente }, include: { cliente_financiero: true } }) : null;
      const coincidencias = fichaDirecta ? [] : await transaccion.cliente_financiero.findMany({ where: { rut_cliente: { in: [rut, rutFormateado!], mode: 'insensitive' } }, include: { ficha_cliente: true } });
      if (coincidencias.length > 1) throw new ErrorAplicacion(409, 'Hay identidades heredadas duplicadas; revisa el cliente antes de continuar');
      const cliente = fichaDirecta?.cliente_financiero || coincidencias[0];
      if (!cliente || cliente.estado_financiero !== 'activo') throw new ErrorAplicacion(400, 'Cliente no disponible');
      const ficha = fichaDirecta || (cliente as any).ficha_cliente || await transaccion.ficha_cliente.create({ data: { id_cliente_financiero: cliente.id_cliente_financiero } });
      const monedaLocal=await transaccion.moneda.findUnique({where:{codigo_moneda:'CLP'}});
      if(!monedaLocal||monedaLocal.estado_moneda!=='activo')throw new ErrorAplicacion(409,'La moneda local CLP no está disponible para costear materiales');
      const { costoTotal, precioSugerido: sugeridoClp, detalles } = await construirCosteoCotizacion(transaccion, entrada.productos as Entrada[], monedaLocal, margen);
      const sugerido=convertirDesdeClp(sugeridoClp,tipoCambio);
      const detallesConvertidos=detalles.map(detalle=>({...detalle,subtotal_item_estimado:convertirDesdeClp(new Prisma.Decimal(detalle.subtotal_item_estimado as Prisma.Decimal),tipoCambio)}));
      const montos = importes(sugerido, entrada.descuento_tipo, entrada.descuento_valor, entrada.exento_iva);
      const cotizacion=await transaccion.cotizacion.create({ data: {
        id_ficha_cliente: ficha.id_ficha_cliente, id_moneda: monedaObjetivo.id_moneda,
        fecha_emision: new Date(`${fechaNegocio()}T00:00:00Z`), fecha_vigencia: new Date(`${fechaVigencia}T00:00:00Z`),
        subtotal_costos_estimados: costoTotal, margen_esperado: margen, precio_sugerido: sugerido,
        monto_neto: montos.neto, monto_impuesto: montos.impuesto, monto_total_estimado: montos.total,
        descuento_tipo: entrada.descuento_tipo || null, descuento_valor: entrada.descuento_valor || 0,
        exento_iva: entrada.exento_iva, estado_cotizacion: 'borrador', detalle_cotizacion: { create: detallesConvertidos },
      } });
      await guardarTipoCambioCotizacion(transaccion,cotizacion.id_cotizacion,tipoCambio);
      return cotizacion;
    });
  }

  async editarCotizacion(idCotizacion: number, entrada: Entrada) {
    const margen = numeroNoNegativo(entrada.margen_esperado, 'Margen');
    if (margen >= 100) throw new ErrorAplicacion(400, 'El margen debe ser menor a 100');
    if (!Array.isArray(entrada.materiales) && !Array.isArray(entrada.productos)) throw new ErrorAplicacion(400, 'Materiales o productos inválidos');
    let tipoCambioEdicion: Prisma.Decimal|null|undefined;
    if(Array.isArray(entrada.productos)){
      const referencia=await prisma.cotizacion.findUnique({where:{id_cotizacion:idCotizacion},select:{id_moneda:true}});
      if(!referencia)throw new ErrorAplicacion(404,'Cotización no encontrada');
      const idMonedaObjetivo=entrada.id_moneda?identificador(entrada.id_moneda):referencia.id_moneda;
      const monedaObjetivo=await prisma.moneda.findUnique({where:{id_moneda:idMonedaObjetivo}});
      if(!monedaObjetivo||monedaObjetivo.estado_moneda!=='activo'||!['CLP','USD'].includes(monedaObjetivo.codigo_moneda))throw new ErrorAplicacion(400,'Moneda no habilitada');
      tipoCambioEdicion=await this.resolverTipoCambioCotizacion(monedaObjetivo.codigo_moneda,entrada);
    }
    return prisma.$transaction(async transaccion => {
      const cotizacion = await transaccion.cotizacion.findUnique({ where: { id_cotizacion: idCotizacion }, include: incluirCotizacion });
      if (!cotizacion) throw new ErrorAplicacion(404, 'Cotización no encontrada');
      if (cotizacion.estado_cotizacion !== 'borrador') throw new ErrorAplicacion(409, 'Sólo se puede editar un Borrador; las condiciones emitidas se conservan');

      if (Array.isArray(entrada.productos)) {
        const fechaVigencia = texto(entrada.fecha_vigencia || cotizacion.fecha_vigencia?.toISOString().slice(0, 10), 20);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVigencia) || fechaVigencia < fechaNegocio()) throw new ErrorAplicacion(400, 'La vigencia no puede estar vencida');
        const idFicha = entrada.id_ficha_cliente ? identificador(entrada.id_ficha_cliente) : cotizacion.id_ficha_cliente;
        const ficha = await transaccion.ficha_cliente.findUnique({ where: { id_ficha_cliente: idFicha }, include: { cliente_financiero: true } });
        if (!ficha || ficha.cliente_financiero.estado_financiero !== 'activo') throw new ErrorAplicacion(400, 'Cliente no disponible');
        const idMoneda = entrada.id_moneda ? identificador(entrada.id_moneda) : cotizacion.id_moneda;
        const moneda = await transaccion.moneda.findUnique({ where: { id_moneda: idMoneda } });
        if (!moneda || moneda.estado_moneda !== 'activo' || !['CLP', 'USD'].includes(moneda.codigo_moneda)) throw new ErrorAplicacion(400, 'Moneda no habilitada');

        const monedaLocal=await transaccion.moneda.findUnique({where:{codigo_moneda:'CLP'}});
        if(!monedaLocal||monedaLocal.estado_moneda!=='activo')throw new ErrorAplicacion(409,'La moneda local CLP no está disponible para costear materiales');
        const { costoTotal, precioSugerido: calculadoClp, detalles } = await construirCosteoCotizacion(transaccion, entrada.productos as Entrada[], monedaLocal, margen, true);
        const calculado=convertirDesdeClp(calculadoClp,tipoCambioEdicion??null);
        const nuevosDetalles=detalles.map(detalle=>({...detalle,subtotal_item_estimado:convertirDesdeClp(new Prisma.Decimal(detalle.subtotal_item_estimado as Prisma.Decimal),tipoCambioEdicion??null)}));
        const precioDefinido = entrada.precio_sugerido === undefined ? calculado : new Prisma.Decimal(numeroNoNegativo(entrada.precio_sugerido, 'Precio definido'));
        const descuentoTipo = entrada.descuento_tipo || null;
        const descuentoValor = entrada.descuento_valor ?? 0;
        const exento = typeof entrada.exento_iva === 'boolean' ? entrada.exento_iva : cotizacion.exento_iva;
        const montos = importes(precioDefinido, descuentoTipo, descuentoValor, exento);
        await transaccion.detalle_costo_material_cotizacion.deleteMany({ where: { detalle_cotizacion: { id_cotizacion: idCotizacion } } });
        await transaccion.detalle_cotizacion.deleteMany({ where: { id_cotizacion: idCotizacion } });
        const actualizada=await transaccion.cotizacion.update({ where: { id_cotizacion: idCotizacion }, data: { id_ficha_cliente: idFicha, id_moneda: idMoneda, fecha_vigencia: new Date(`${fechaVigencia}T00:00:00Z`), margen_esperado: margen, subtotal_costos_estimados: costoTotal, precio_sugerido: precioDefinido, monto_neto: montos.neto, monto_impuesto: montos.impuesto, monto_total_estimado: montos.total, descuento_tipo: descuentoTipo as string | null, descuento_valor: numeroNoNegativo(descuentoValor, 'Descuento'), exento_iva: exento, observacion: texto(entrada.observacion, 2000) || null, detalle_cotizacion: { create: nuevosDetalles } }, include: incluirCotizacion });
        await guardarTipoCambioCotizacion(transaccion,idCotizacion,tipoCambioEdicion??null);
        return actualizada;
      }

      const detalles = cotizacion.detalle_cotizacion;
      const primero = detalles[0];
      const idsMaterialesCotizacion = new Set(detalles.flatMap(detalle => detalle.detalle_costo_material_cotizacion.map(material => material.id_detalle_costo_material_cotizacion)));
      const cantidades = new Map<number, number>();
      for (const material of entrada.materiales) {
        const id = identificador(material.id_detalle_costo_material_cotizacion);
        if (cantidades.has(id) || !idsMaterialesCotizacion.has(id)) throw new ErrorAplicacion(400, 'Material ajeno o duplicado');
        const cantidad = numeroNoNegativo(material.cantidad, 'Cantidad');
        if (!cantidad) throw new ErrorAplicacion(400, 'La cantidad debe ser mayor a cero');
        cantidades.set(id, cantidad);
      }
      let costoTotal = new Prisma.Decimal(0);
      let sugerido = new Prisma.Decimal(0);
      const monedaLocal=await transaccion.moneda.findUnique({where:{codigo_moneda:'CLP'}});
      if(!monedaLocal)throw new ErrorAplicacion(409,'La moneda local CLP no está disponible para costear materiales');
      const tipoCambio=await obtenerTipoCambioCotizacion(transaccion,idCotizacion,cotizacion.moneda.codigo_moneda);
      for (const detalle of detalles) {
        let costo = new Prisma.Decimal(0);
        if (!detalle.detalle_costo_material_cotizacion.length) throw new ErrorAplicacion(409, 'El borrador no tiene un costeo completo; requiere la edición ampliada de M2');
        for (const material of detalle.detalle_costo_material_cotizacion) {
          if(material.historial_precio_material.id_moneda!==monedaLocal.id_moneda)throw new ErrorAplicacion(409,'El borrador debe actualizar sus materiales a costos locales CLP');
          const cantidad = cantidades.get(material.id_detalle_costo_material_cotizacion) ?? material.cantidad_material_estimada;
          const override = material.id_detalle_costo_material_cotizacion === identificador(entrada.materiales.find((m: Entrada) => m.id_detalle_costo_material_cotizacion)?.id_detalle_costo_material_cotizacion || material.id_detalle_costo_material_cotizacion)
            ? entrada.materiales.find((m: Entrada) => m.id_detalle_costo_material_cotizacion === material.id_detalle_costo_material_cotizacion)?.costo_ajustado
            : undefined;
          const precioUsado = override === undefined ? material.precio_unitario_usado : new Prisma.Decimal(numeroNoNegativo(override, 'Costo ajustado'));
          const subtotal = precioUsado.mul(cantidad).mul(detalle.cantidad_item).toDecimalPlaces(2);
          costo = costo.plus(subtotal);
          if (cantidades.has(material.id_detalle_costo_material_cotizacion)) await transaccion.detalle_costo_material_cotizacion.update({ where: { id_detalle_costo_material_cotizacion: material.id_detalle_costo_material_cotizacion }, data: { cantidad_material_estimada: cantidad, precio_unitario_usado: precioUsado, subtotal_material_estimado: subtotal, ...(override === undefined ? {} : { observacion: `Costo original ${material.precio_unitario_usado.toString()}; ajuste autorizado` }) } });
        }
        const subtotalClp = costo.div(new Prisma.Decimal(1).minus(new Prisma.Decimal(margen).div(100))).toDecimalPlaces(2);
        const subtotal=convertirDesdeClp(subtotalClp,tipoCambio);
        costoTotal = costoTotal.plus(costo);
        sugerido = sugerido.plus(subtotal);
        await transaccion.detalle_cotizacion.update({ where: { id_detalle_cotizacion: detalle.id_detalle_cotizacion }, data: { subtotal_item_estimado: subtotal, ...(detalle === primero ? { observacion_medidas: texto(entrada.observacion, 2000) } : {}) } });
      }
      const precioDefinido = entrada.precio_sugerido === undefined ? sugerido : new Prisma.Decimal(numeroNoNegativo(entrada.precio_sugerido, 'Precio definido'));
      if (precioDefinido.lte(0)) throw new ErrorAplicacion(400, 'El precio definido debe ser positivo');
      const montos = importes(precioDefinido, cotizacion.descuento_tipo, cotizacion.descuento_valor?.toNumber(), cotizacion.exento_iva);
      return transaccion.cotizacion.update({ where: { id_cotizacion: idCotizacion }, data: { margen_esperado: margen, subtotal_costos_estimados: costoTotal, precio_sugerido: precioDefinido, monto_neto: montos.neto, monto_impuesto: montos.impuesto, monto_total_estimado: montos.total } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async crearVentaDirecta(entrada: Entrada) {
    const idFicha = identificador(entrada.id_cliente);
    const base = numeroNoNegativo(entrada.monto_neto, 'Monto neto');
    if (!base) throw new ErrorAplicacion(400, 'El monto debe ser mayor a cero');
    const montos = importes(new Prisma.Decimal(base), entrada.descuento?.tipo, entrada.descuento?.valor, entrada.exento_iva);
    const codigoMoneda = texto(entrada.moneda).toUpperCase() || 'CLP';
    let tipoCambio: Prisma.Decimal | null = null;
    if (codigoMoneda === 'USD') {
      try {
        tipoCambio = new Prisma.Decimal(await this.bancoCentral.obtenerTipoCambio('USD', fechaNegocio()));
      } catch (error) {
        if (entrada.tipoCambioManual !== true) throw error;
        tipoCambio = new Prisma.Decimal(numeroNoNegativo(entrada.tipoCambio, 'Tipo de cambio manual'));
      }
      if (!tipoCambio.isFinite() || tipoCambio.lte(0)) throw new ErrorAplicacion(400, 'El tipo de cambio USD/CLP debe ser mayor a cero');
    }
    return prisma.$transaction(async transaccion => {
      const ficha = await transaccion.ficha_cliente.findUnique({ where: { id_ficha_cliente: idFicha }, include: { cliente_financiero: true } });
      if (!ficha || ficha.cliente_financiero.estado_financiero !== 'activo' || ficha.cliente_financiero.nivel_formalizacion !== 'formal') throw new ErrorAplicacion(400, 'La venta directa requiere cliente activo y formal');
      const moneda = await transaccion.moneda.findUnique({ where: { codigo_moneda: codigoMoneda } });
      if (!moneda || moneda.estado_moneda !== 'activo' || !['CLP', 'USD'].includes(moneda.codigo_moneda)) throw new ErrorAplicacion(400, 'Moneda no habilitada');
      const detalle = Array.isArray(entrada.detalle) ? entrada.detalle.map((linea: Entrada) => ({ tipo: texto(linea.tipo, 40), descripcion: texto(linea.descripcion, 500), cantidad: numeroNoNegativo(linea.cantidad ?? 1, 'Cantidad'), valor: numeroNoNegativo(linea.valor, 'Valor'), idItemComercial: linea.idItemComercial ? identificador(linea.idItemComercial) : undefined, idProyecto: linea.idProyecto ? identificador(linea.idProyecto) : undefined })) : [];
      if (!detalle.length || detalle.some(linea => !['producto','servicio','reparacion','trabajo posterior','adicional'].includes(linea.tipo.toLowerCase()) || !linea.descripcion || linea.cantidad <= 0 || linea.valor <= 0)) throw new ErrorAplicacion(400, 'Incluye al menos una línea comercial válida');
      const sumaDetalle = detalle.reduce((suma, linea) => suma + linea.cantidad * linea.valor, 0);
      if (detalle.length && Math.abs(sumaDetalle - base) > 0.01) throw new ErrorAplicacion(400, 'El monto neto no coincide con el detalle comercial');
      const idsItem = [...new Set(detalle.flatMap(linea => linea.idItemComercial ? [linea.idItemComercial] : []))];
      if (idsItem.length && await transaccion.item_comercial.count({ where: { id_item_comercial: { in: idsItem }, estado_item: 'activo' } }) !== idsItem.length) throw new ErrorAplicacion(400, 'Uno de los ítems comerciales no existe o está inactivo');
      const idsProyecto = [...new Set(detalle.flatMap(linea => linea.idProyecto ? [linea.idProyecto] : []))];
      if (idsProyecto.length) { const proyectos = await transaccion.proyecto.findMany({ where: { proyecto_proyecto_id: { in: idsProyecto.map(BigInt) } }, select: { proyecto_proyecto_id: true, proyecto_estado_operacional: true } }); if (proyectos.length !== idsProyecto.length || proyectos.some(proyecto => proyecto.proyecto_estado_operacional?.toLowerCase() !== 'activo')) throw new ErrorAplicacion(409, 'El proyecto seleccionado no existe o no está activo'); }
      const proyectoContexto = idsProyecto.length === 1 ? BigInt(idsProyecto[0]) : undefined;
      return transaccion.nota_venta.create({ data: {
        id_ficha_cliente: idFicha, id_moneda: moneda.id_moneda, numero_nota_venta: `NVD-${randomUUID()}`,
        fecha_emision: new Date(`${fechaNegocio()}T00:00:00Z`), monto_neto: montos.neto, monto_impuesto: montos.impuesto,
        monto_total: montos.total, tipo_cambio_usado: tipoCambio, monto_convertido: tipoCambio ? montos.total.mul(tipoCambio).toDecimalPlaces(2) : null,
        descuento_aplicado: montos.descuento, exento_iva: entrada.exento_iva,
        estado_nota_venta: 'emitida', estado_pago: 'pendiente', id_proyecto_contexto: proyectoContexto, observacion: JSON.stringify({ detalleComercial: detalle, persistencia: 'auxiliar_hasta_detalle_nv_estructurado' }),
      } });
    });
  }
  async confirmarNotaVenta(idNota:number){
    return prisma.$transaction(async transaccion=>{
      const nota=await transaccion.nota_venta.findUnique({where:{id_nota_venta:idNota}});
      if(!nota)throw new ErrorAplicacion(404,'Nota de Venta no encontrada');
      if(nota.estado_nota_venta!=='emitida')throw new ErrorAplicacion(409,'Sólo se puede confirmar una Nota de Venta emitida');
      const documento=await transaccion.nota_venta.update({
        where:{id_nota_venta:idNota},data:{estado_nota_venta:'confirmada'},
        include:{...incluirNota,ficha_cliente:{include:{cliente_financiero:true}}},
      });
      return {mensaje:'Nota de Venta confirmada',documento};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  async anularVenta(idNota: number, entrada: Entrada) {
    return prisma.$transaction(async transaccion => {
      const nota = await transaccion.nota_venta.findUnique({ where: { id_nota_venta: idNota }, include: { asignacion_pago_cliente: true, aplicacion_saldo_favor: true } });
      if (!nota) throw new ErrorAplicacion(404, 'Nota de Venta no encontrada');
      if (nota.asignacion_pago_cliente.length || nota.aplicacion_saldo_favor.length) throw new ErrorAplicacion(409, 'Tiene pagos asociados: utiliza la reversión comercial desde el detalle de la Nota de Venta');
      if (!['emitida', 'confirmada'].includes(nota.estado_nota_venta)) throw new ErrorAplicacion(409, 'Nota de Venta no disponible para anular');
      await transaccion.nota_venta.update({ where: { id_nota_venta: idNota }, data: {
        estado_nota_venta: 'anulada', fecha_anulacion: new Date(), motivo_anulacion: texto(entrada.motivo || 'Anulación confirmada desde la Vista', 2000),
      } });
      return { message: 'Nota de Venta anulada; antecedentes históricos conservados' };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async registrarDocumento(entrada: Entrada) {
    const folio = texto(entrada.folio, 80); const tipoEntrada = texto(entrada.tipo_documento,80);
    if (!folio || !tipoEntrada) throw new ErrorAplicacion(400, 'Tipo y folio son obligatorios');
    return prisma.$transaction(async transaccion => {
      if (entrada.tipo_documento === 'guia_despacho') {
        const idNota = identificador(entrada.id_nota_venta);
        const nota = await transaccion.nota_venta.findUnique({ where: { id_nota_venta: idNota } });
        if (!nota || ['anulada', 'revertida_total', 'provisional'].includes(nota.estado_nota_venta)) throw new ErrorAplicacion(409, 'Nota de Venta no disponible');
        const documento = await transaccion.guia_despacho.create({ data: { id_nota_venta: idNota, folio, fecha_emision: new Date() } });
        return { message: 'Guía vinculada', documento };
      }

      const idsRecibidos = Array.isArray(entrada.ids_notas_venta) ? entrada.ids_notas_venta : [entrada.id_nota_venta];
      const idsNotas = [...new Set(idsRecibidos.map(identificador))];
      const notas = await transaccion.nota_venta.findMany({ where: { id_nota_venta: { in: idsNotas } } });
      if (!idsNotas.length || notas.length !== idsNotas.length || notas.some(nota => ['anulada','revertida_total','provisional'].includes(nota.estado_nota_venta))) throw new ErrorAplicacion(409, 'Una de las Notas de Venta no está disponible');
      const primera = notas[0]!;
      if (notas.some(nota => nota.id_ficha_cliente !== primera.id_ficha_cliente || nota.id_moneda !== primera.id_moneda)) throw new ErrorAplicacion(409, 'Las Notas de Venta deben pertenecer al mismo cliente y moneda');

      const nombreTipo = texto(entrada.nombre_tipo_documento || tipoEntrada,80);
      const tipo = entrada.id_tipo_documento
        ? await transaccion.tipo_documento.findFirst({ where: { id_tipo_documento: identificador(entrada.id_tipo_documento), estado_tipo_documento: 'activo', aplica_venta: true } })
        : await transaccion.tipo_documento.findFirst({ where: { nombre_tipo_documento: { equals: nombreTipo === 'factura' ? 'Factura Electrónica' : nombreTipo, mode: 'insensitive' }, estado_tipo_documento: 'activo', aplica_venta: true } });
      if (!tipo) throw new ErrorAplicacion(409, 'Selecciona un tipo de documento de venta configurado');
      const fechaEmision = texto(entrada.fecha_emision,20); const fechaVencimiento = texto(entrada.fecha_vencimiento,20);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEmision) || !Number.isFinite(Date.parse(fechaEmision))) throw new ErrorAplicacion(400, 'Fecha de emisión inválida');
      if (tipo.requiere_vencimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento) || !Number.isFinite(Date.parse(fechaVencimiento)))) throw new ErrorAplicacion(400, 'Fecha de vencimiento obligatoria o inválida');
      const neto = new Prisma.Decimal(numeroNoNegativo(entrada.monto_neto,'Monto neto')); const impuesto = new Prisma.Decimal(numeroNoNegativo(entrada.monto_impuesto,'Monto impuesto')); const total = new Prisma.Decimal(numeroNoNegativo(entrada.monto_total,'Monto total'));
      if (!total.gt(0) || !neto.plus(impuesto).eq(total)) throw new ErrorAplicacion(400, 'Los montos del documento no son coherentes');
      const respaldo = texto(entrada.respaldo,4500000); if (!respaldo) throw new ErrorAplicacion(400, 'El respaldo del documento externo es obligatorio');
      const documento = await transaccion.documento_tributario.create({ data: {
        id_ficha_cliente: primera.id_ficha_cliente, id_nota_venta: primera.id_nota_venta, id_tipo_documento: tipo.id_tipo_documento,
        id_moneda: primera.id_moneda, folio_documento: folio, fecha_emision: new Date(`${fechaEmision}T00:00:00Z`), fecha_vencimiento: fechaVencimiento ? new Date(`${fechaVencimiento}T00:00:00Z`) : null,
        monto_neto: neto, monto_impuesto: impuesto, monto_total: total, respaldo_documento: respaldo, observacion: texto(entrada.observacion,2000) || null,
        documento_tributario_nota_venta: { create: idsNotas.map(id_nota_venta => ({ id_nota_venta })) },
      } });
      return { message: 'Documento tributario externo registrado y vinculado', documento };
    });
  }
  async modificarGuia(idGuia: number, entrada: Entrada) {
    const folio = texto(entrada.folio, 80); if (!folio) throw new ErrorAplicacion(400, 'El folio es obligatorio');
    const guia = await prisma.guia_despacho.findUnique({ where: { id_guia_despacho: idGuia } });
    if (!guia) throw new ErrorAplicacion(404, 'Guía de Despacho no encontrada');
    if (['cerrada', 'finalizada', 'anulada'].includes(String(guia.estado).toLowerCase())) throw new ErrorAplicacion(409, 'La Guía de Despacho ya no permite modificaciones');
    const antecedentes = entrada.antecedentes === undefined ? undefined : entrada.antecedentes;
    if (antecedentes !== undefined && (typeof antecedentes !== 'object' || antecedentes === null || Array.isArray(antecedentes))) throw new ErrorAplicacion(400, 'Antecedentes inválidos');
    return prisma.guia_despacho.update({ where: { id_guia_despacho: idGuia }, data: { folio, antecedentes: antecedentes as any } });
  }
  async definirCondicionesCobro(idNota: number, entrada: Entrada) {
    const fecha = texto(entrada.fechaVencimiento, 20); if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new ErrorAplicacion(400, 'Fecha de vencimiento inválida');
    return prisma.$transaction(async tx => { const nota = await tx.nota_venta.findUnique({ where: { id_nota_venta: idNota } }); if (!nota) throw new ErrorAplicacion(404, 'Nota de Venta no encontrada'); const condiciones = Array.isArray(entrada.condiciones) ? entrada.condiciones as Entrada[] : []; if (condiciones.some(c => !texto(c.descripcion, 200))) throw new ErrorAplicacion(400, 'Cada condición necesita una descripción'); await tx.condicion_cobro_nv.deleteMany({ where: { id_nota_venta: idNota } }); if (condiciones.length) await tx.condicion_cobro_nv.createMany({ data: condiciones.map(c => ({ id_nota_venta: idNota, descripcion: texto(c.descripcion, 200), monto_referencia: c.monto === undefined ? undefined : numeroNoNegativo(c.monto, 'Monto condición'), porcentaje_referencia: c.porcentaje === undefined ? undefined : numeroNoNegativo(c.porcentaje, 'Porcentaje condición'), evento_referencia: texto(c.evento, 150) || null })) }); return tx.nota_venta.update({ where: { id_nota_venta: idNota }, data: { fecha_vencimiento: new Date(`${fecha}T00:00:00Z`) } }); });
  }
  async configurarUmbral(entrada: Entrada) {
    const dias = Number(entrada.diasHabiles); if (!Number.isInteger(dias) || dias < 0) throw new ErrorAplicacion(400, 'El umbral debe ser un número de días válido');
    return prisma.$transaction(async tx => {
      const vigente = await tx.config_umbral_por_vencer.findFirst({ orderBy: { fecha: 'desc' } });
      return vigente ? tx.config_umbral_por_vencer.update({ where: { id_configuracion: vigente.id_configuracion }, data: { dias_habiles: dias, fecha: new Date() } }) : tx.config_umbral_por_vencer.create({ data: { dias_habiles: dias } });
    });
  }
  async consultarUmbral() {
    return prisma.$transaction(async tx => {
      const vigente = await tx.config_umbral_por_vencer.findFirst({ orderBy: { fecha: 'desc' } });
      return vigente || tx.config_umbral_por_vencer.create({ data: { dias_habiles: 5 } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async descartarBorrador(idCotizacion: number) {
    const resultado = await prisma.cotizacion.updateMany({ where: { id_cotizacion: idCotizacion, estado_cotizacion: 'borrador' }, data: { estado_cotizacion: 'descartada' } });
    if (!resultado.count) throw new ErrorAplicacion(409, 'Sólo se puede descartar una cotización en Borrador');
    return { message: 'Borrador descartado' };
  }
  operacionPendiente(operacion: string): never {
    const explicaciones: Record<string, string> = {
      aprobarCotizacion: 'Para B2C utiliza Consolidar con primer pago; para B2B utiliza la aceptación con Orden de Compra disponible en el detalle',
      aprobarVenta: 'La aprobación genérica antigua no corresponde al flujo I2; la Nota de Venta emitida ya está registrada',
      tipoCambio: 'La conversión corresponde al pago en M3; la fuente del tipo de cambio sigue pendiente',
    };
    throw new ErrorAplicacion(501, explicaciones[operacion] || 'Operación pendiente de implementación por etapa', 'ETAPA_PENDIENTE');
  }
}
