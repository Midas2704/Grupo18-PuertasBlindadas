import { Prisma } from '@prisma/client';
import { prepararPago } from '../utilidades/pago';
import { identificador, texto } from '../validaciones/solicitudes';
import { prisma } from '../db';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { calcularNota, incluirNota, incluirPago, efectoPago, fechaNegocio } from '../utilidades/finanzas';
import { BancoCentral, C_BancoCentral } from '../utilidades/C_BancoCentral';

const textoPdf = (valor: unknown) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?').replace(/([\\()])/g,'\\$1');
function crearPdf(lineas: string[]) {
  const instrucciones = ['BT','/F1 18 Tf','50 790 Td',`(${textoPdf(lineas[0])}) Tj`,'/F1 11 Tf',...lineas.slice(1).flatMap(linea => ['0 -24 Td',`(${textoPdf(linea)}) Tj`]),'ET'].join('\n');
  const objetos = ['', '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(instrucciones,'latin1')} >>\nstream\n${instrucciones}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  let salida = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const posiciones = [0];
  for(let indice=1;indice<objetos.length;indice++) { posiciones[indice]=Buffer.byteLength(salida,'latin1'); salida += `${indice} 0 obj\n${objetos[indice]}\nendobj\n`; }
  const inicioXref = Buffer.byteLength(salida,'latin1');
  salida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n${posiciones.slice(1).map(posicion=>`${String(posicion).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(salida,'latin1');
}

/** M3 CU42–CU58: pagos, reversas, saldos a favor y conciliación. */
export class M3Controller {
  constructor(private readonly bancoCentral: BancoCentral = new C_BancoCentral()) {}
  async registrarPago(entrada:Record<string,unknown>,responsable:string) {
    const idNota = identificador(entrada.idNota);
    const notaPrevia = await prisma.nota_venta.findUnique({ where: { id_nota_venta: idNota }, include: { moneda: true } });
    let datosEntrada = { ...entrada };
    if (notaPrevia?.moneda.codigo_moneda === 'USD') {
      try {
        const externo = await this.bancoCentral.obtenerTipoCambio('USD');
        datosEntrada = { ...datosEntrada, tipoCambio: externo, tipoCambioOrigen: 'C_BancoCentral' };
      } catch (error) {
        if (!entrada.tipoCambio) throw error;
        datosEntrada = { ...datosEntrada, tipoCambioOrigen: 'manual-fallback' };
      }
    }
    return prisma.$transaction(async tx=>{
      const nota=await tx.nota_venta.findUnique({where:{id_nota_venta:idNota},include:{...incluirNota,ficha_cliente:{include:{cliente_financiero:true}}}});
      if(!nota || nota.ficha_cliente.cliente_financiero.estado_financiero!=='activo')throw new ErrorAplicacion(409,'Selecciona una NV de un cliente activo');
      const documento=await tx.documento_tributario.findUnique({where:{id_documento_tributario:identificador(entrada.idDocumento)}});
      if(!documento || documento.id_ficha_cliente!==nota.id_ficha_cliente)throw new ErrorAplicacion(400,'El documento tributario debe existir y pertenecer al mismo cliente');
      const catalogo={medios:await tx.medio_pago.findMany({where:{estado_medio_pago:'activo'}}),categorias:await tx.categoria_pago.findMany({where:{activo:true}}),cuotas:await tx.config_cuotas_tarjeta.findMany({where:{activo:true}})};
      const pago=await tx.pago_cliente.create({data:prepararPago(nota,datosEntrada,catalogo,documento.id_documento_tributario,responsable)});
      await tx.documento_tributario_nota_venta.upsert({where:{id_documento_tributario_id_nota_venta:{id_documento_tributario:documento.id_documento_tributario,id_nota_venta:idNota}},update:{},create:{id_documento_tributario:documento.id_documento_tributario,id_nota_venta:idNota}});
      const calculo=await this.recalcularSaldo(tx,idNota);
      return {mensaje:'Pago registrado',idPago:pago.id_pago_cliente,...calculo};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async recalcularSaldo(tx:Prisma.TransactionClient,idNota:number) {
    const nota=await tx.nota_venta.findUniqueOrThrow({where:{id_nota_venta:idNota},include:incluirNota});
    const calculo=calcularNota(nota);
    // CU50: actualizamos el estado del pago; el comercial se queda como está.
    await tx.nota_venta.update({where:{id_nota_venta:idNota},data:{estado_pago:calculo.estadoPago}});
    return calculo;
  }
  async procesarExcedente(tx:Prisma.TransactionClient,idNota:number,idReversion:number,entrada:Record<string,unknown>) {
    const calculo=await this.recalcularSaldo(tx,idNota);
    const registrados=await tx.saldo_favor_cliente.aggregate({where:{id_nota_venta:idNota},_sum:{monto_original:true}});
    const disponible=Prisma.Decimal.max(0,new Prisma.Decimal(calculo.excedente).minus(registrados._sum.monto_original || 0));
    if(disponible.gt(0)) {
      const destino=texto(entrada.destino);
      if(!['devolucion','saldo_favor'].includes(destino))throw new ErrorAplicacion(409,'Existe excedente; elige devolución o saldo a favor antes de confirmar');
      await tx.reversion_nota_venta.update({where:{id_reversion_nota_venta:idReversion},data:{destino_excedente:destino}});
      if(destino==='saldo_favor') {
        const nota=await tx.nota_venta.findUniqueOrThrow({where:{id_nota_venta:idNota},include:{ficha_cliente:true}});
        await tx.saldo_favor_cliente.create({data:{id_cliente_financiero:nota.ficha_cliente.id_cliente_financiero,id_nota_venta:idNota,id_reversion_nota_venta:idReversion,monto_original:disponible,monto_disponible:disponible}});
      }
      return {...calculo,excedenteGestionado:disponible.toNumber(),destino,mensaje:destino==='devolucion'?'Reversión registrada; devolución financiera pendiente de ejecutar':'Reversión registrada; saldo a favor disponible'};
    }
    return {...calculo,mensaje:'Reversión registrada sin nuevo excedente'};
  }
  async consultarPago(idPago: number) {
    const pago = await prisma.pago_cliente.findUnique({ where: { id_pago_cliente: idPago }, include: {
      ...incluirPago, conciliacion: true, asignacion_pago_cliente: { include: { documento_tributario: { include: { tipo_documento: true } }, nota_venta: { include: { moneda: true } } } },
      ficha_cliente: { include: { cliente_financiero: true } },
    } });
    if (!pago) throw new ErrorAplicacion(404, 'Pago no encontrado');
    return { ...pago, montoEfectivo: efectoPago(pago).toNumber() };
  }
  async consultarSaldo(idNota: number) {
    const nota = await prisma.nota_venta.findUnique({ where: { id_nota_venta: idNota }, include: incluirNota });
    if (!nota) throw new ErrorAplicacion(404, 'Nota de Venta no encontrada');
    return { idNota, moneda: nota.moneda.codigo_moneda, ...calcularNota(nota) };
  }
  async consultarCatalogos(idFicha?:number) {
    const [medios, categorias, cuotas] = await Promise.all([
      prisma.medio_pago.findMany({ where: { estado_medio_pago: 'activo' } }),
      prisma.categoria_pago.findMany({ where: { activo: true } }),
      prisma.config_cuotas_tarjeta.findMany({ where: { activo: true }, orderBy: { cantidad: 'asc' } }),
    ]);
    const documentos=idFicha?await prisma.documento_tributario.findMany({where:{id_ficha_cliente:idFicha},select:{id_documento_tributario:true,folio_documento:true,tipo_documento:{select:{nombre_tipo_documento:true}}}}):[];
    return { medios, categorias, cuotas, documentos };
  }
  async consultarTipoCambio(moneda: string) { return { moneda: moneda.toUpperCase(), valor: await this.bancoCentral.obtenerTipoCambio(moneda) }; }
  async contextoPago(idFicha: number) {
    const catalogos = await this.consultarCatalogos(idFicha);
    const notas = await prisma.nota_venta.findMany({ where: { id_ficha_cliente: idFicha, estado_nota_venta: { notIn: ['anulada','revertida_total','cerrada'] } }, include: incluirNota, orderBy: { fecha_emision: 'desc' } });
    const pagos = await prisma.pago_cliente.findMany({ where: { id_ficha_cliente: idFicha }, include: incluirPago, orderBy: { fecha_pago: 'desc' } });
    return { ...catalogos, notas: notas.map(n => ({ ...n, ...calcularNota(n) })).filter(n => n.saldoPendiente > 0), pagos: pagos.map(p => ({ ...p, montoEfectivo: efectoPago(p).toNumber() })) };
  }

  async anularPago(idPago: number, entrada: Record<string, unknown>, responsable: string) {
    const motivo = texto(entrada.motivo, 2000); const respaldo = texto(entrada.respaldo, 4500000);
    if (!motivo || !respaldo) throw new ErrorAplicacion(400, 'Motivo y respaldo son obligatorios');
    return prisma.$transaction(async tx => {
      const pago = await tx.pago_cliente.findUnique({ where: { id_pago_cliente: idPago }, include: { anulacion_pago: true, reversion_pago: true, asignacion_pago_cliente: true } });
      if (!pago) throw new ErrorAplicacion(404, 'Pago no encontrado');
      if (pago.anulacion_pago) throw new ErrorAplicacion(409, 'El pago ya está anulado');
      if (pago.reversion_pago.length) throw new ErrorAplicacion(409, 'El pago tiene una reversión previa y no puede anularse');
      await tx.anulacion_pago.create({ data: { id_pago_cliente: idPago, motivo, respaldo, responsable } });
      const calculo = pago.asignacion_pago_cliente ? await this.recalcularSaldo(tx, pago.asignacion_pago_cliente.id_nota_venta) : undefined;
      return { mensaje: 'Pago anulado; el registro original se conserva', ...calculo };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revertirPago(idPago: number, entrada: Record<string, unknown>, responsable: string) {
    const monto = new Prisma.Decimal(Number(entrada.monto)); const motivo = texto(entrada.motivo, 2000); const respaldo = texto(entrada.respaldo, 4500000);
    if (monto.lte(0) || !motivo || !respaldo) throw new ErrorAplicacion(400, 'Monto, motivo y respaldo son obligatorios');
    return prisma.$transaction(async tx => {
      const pago = await tx.pago_cliente.findUnique({ where: { id_pago_cliente: idPago }, include: { reversion_pago: true, anulacion_pago: true, asignacion_pago_cliente: true } });
      if (!pago || pago.anulacion_pago) throw new ErrorAplicacion(409, 'El pago no está disponible para reversión');
      const ya = pago.reversion_pago.reduce((s, r) => s.plus(r.monto), new Prisma.Decimal(0));
      const efectivo = pago.monto_pago; if (monto.gt(efectivo.minus(ya))) throw new ErrorAplicacion(400, 'La reversión supera el monto aún disponible');
      await tx.reversion_pago.create({ data: { id_pago_cliente: idPago, monto, motivo, respaldo, responsable } });
      const calculo = pago.asignacion_pago_cliente ? await this.recalcularSaldo(tx, pago.asignacion_pago_cliente.id_nota_venta) : undefined;
      return { mensaje: 'Reversión de pago registrada', ...calculo };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async aplicarSaldoFavor(idSaldo: number, entrada: Record<string, unknown>, responsable: string) {
    const idNota = identificador(entrada.idNota); const monto = new Prisma.Decimal(Number(entrada.monto));
    if (monto.lte(0)) throw new ErrorAplicacion(400, 'El monto debe ser positivo');
    return prisma.$transaction(async tx => {
      const saldo = await tx.saldo_favor_cliente.findUnique({ where: { id_saldo_favor_cliente: idSaldo } });
      const nota = await tx.nota_venta.findUnique({ where: { id_nota_venta: idNota }, include: incluirNota });
      const ficha = nota ? await tx.ficha_cliente.findUnique({ where: { id_ficha_cliente: nota.id_ficha_cliente } }) : null;
      const calculo = nota ? calcularNota(nota) : null;
      if (!saldo || !nota || !ficha || saldo.monto_disponible.lt(monto) || saldo.id_cliente_financiero !== ficha.id_cliente_financiero || ['anulada','cerrada','revertida_total'].includes(nota.estado_nota_venta) || !calculo || monto.gt(calculo.saldoPendiente)) throw new ErrorAplicacion(409, 'Saldo a favor o Nota de Venta no elegible para la aplicación');
      await tx.aplicacion_saldo_favor.create({ data: { id_saldo_favor_cliente: idSaldo, id_nota_venta: idNota, monto, responsable } });
      await tx.saldo_favor_cliente.update({ where: { id_saldo_favor_cliente: idSaldo }, data: { monto_disponible: { decrement: monto } } });
      await this.recalcularSaldo(tx, idNota);
      return { mensaje: 'Saldo a favor aplicado' };
    });
  }

  async consultarMorosidad(idNota: number) {
    const nota = await prisma.nota_venta.findUnique({ where: { id_nota_venta: idNota }, include: incluirNota });
    if (!nota) throw new ErrorAplicacion(404, 'Nota de Venta no encontrada');
    const calculo = calcularNota(nota,fechaNegocio()); const vencida = calculo.esMorosa && !['anulada','revertida_total','provisional'].includes(nota.estado_nota_venta);
    return { idNota, moroso: vencida, fechaVencimiento: nota.fecha_vencimiento, saldoPendiente: calculo.saldoPendiente, situacion: vencida ? 'Morosa' : calculo.saldoPendiente > 0 ? 'Deuda vigente' : 'Al día' };
  }

  async generarComprobante(idPago: number) {
    const pago = await this.consultarPago(idPago);
    const cliente = pago.ficha_cliente.cliente_financiero;
    const rut = cliente.rut_cliente?.trim(); const nombre = cliente.nombre_razon_social_referencia?.trim();
    const medio = pago.medio_pago.nombre_medio_pago?.trim(); const moneda = pago.moneda.codigo_moneda?.trim();
    if (!rut || !nombre || !pago.fecha_pago || !medio || !moneda || !pago.monto_pago.gt(0)) throw new ErrorAplicacion(409,'El pago no tiene todos los antecedentes obligatorios para generar el comprobante');
    const adicionales = [
      pago.categoria_pago?.nombre ? `Categoria: ${pago.categoria_pago.nombre}` : '',
      pago.cantidad_cuotas ? `Cuotas: ${pago.cantidad_cuotas}` : '',
      pago.asignacion_pago_cliente?.documento_tributario ? `Documento: ${pago.asignacion_pago_cliente.documento_tributario.folio_documento}` : '',
      pago.observacion ? `Observacion: ${pago.observacion}` : '',
    ].filter(Boolean);
    const pdf = crearPdf(['Comprobante de pago',`Pago: ${idPago}`,`RUT cliente: ${rut}`,`Cliente: ${nombre}`,`Fecha: ${pago.fecha_pago.toISOString().slice(0,10)}`,`Medio: ${medio}`,`Monto: ${pago.monto_pago.toString()}`,`Moneda: ${moneda}`,`Monto vigente: ${pago.montoEfectivo}`,`Estado: ${pago.anulacion_pago?'Anulado':pago.reversion_pago.length?'Con reversion':pago.estado_verificacion}`,...adicionales]).toString('base64');
    return { nombre: `comprobante-pago-${idPago}.pdf`, contenido: `data:application/pdf;base64,${pdf}` };
  }

  async conciliarPago(idPago: number, entrada: Record<string, unknown>, responsable: string) {
    const monto = new Prisma.Decimal(Number(entrada.monto)); if (monto.lte(0) || !monto.isFinite()) throw new ErrorAplicacion(400, 'El monto conciliado debe ser positivo');
    return prisma.$transaction(async tx => {
      const pago = await tx.pago_cliente.findUnique({ where: { id_pago_cliente: idPago }, include: { anulacion_pago: true, conciliacion: true } }); if (!pago) throw new ErrorAplicacion(404, 'Pago no encontrado');
      if (pago.anulacion_pago || pago.estado_conciliacion === 'conciliado' || pago.conciliacion.some(c => c.estado_conciliacion === 'conciliado')) throw new ErrorAplicacion(409, 'El pago no está disponible para conciliación');
      const evidencia = texto(entrada.evidencia, 4500000); if (!evidencia) throw new ErrorAplicacion(400, 'La evidencia de conciliación es obligatoria');
      if (monto.gt(pago.monto_pago)) throw new ErrorAplicacion(400, 'El monto conciliado no puede superar el pago');
      const conciliacion = await tx.conciliacion.create({ data: { id_pago_cliente: idPago, monto_conciliado: monto, diferencia_conciliacion: monto.minus(pago.monto_pago), evidencia, estado_conciliacion: monto.eq(pago.monto_pago) ? 'conciliado' : 'con_diferencia', responsable_conciliacion: responsable } });
      await tx.pago_cliente.update({ where: { id_pago_cliente: idPago }, data: { estado_conciliacion: conciliacion.estado_conciliacion } });
      return { mensaje: 'Pago conciliado', conciliacion };
    });
  }
}
