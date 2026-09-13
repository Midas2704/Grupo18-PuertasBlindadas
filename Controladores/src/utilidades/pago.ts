import { Prisma } from '@prisma/client';
import { calcularNota, NotaFinanciera, fechaNegocio } from './finanzas';
import { ErrorAplicacion } from './ErrorAplicacion';
import { identificador, numeroNoNegativo, texto } from '../validaciones/solicitudes';

// Los módulos traen los datos desde Prisma; acá sólo preparamos el pago.
export function prepararPago(nota:NotaFinanciera, entrada:Record<string,unknown>, catalogo:{medios:{id_medio_pago:number;nombre_medio_pago:string}[];categorias:{id_categoria_pago:number;nombre:string}[];cuotas:{cantidad:number}[]}, idDocumento:number, responsable:string) {
 const saldo=calcularNota(nota);
 if(['anulada','cerrada','revertida_total','revertida','provisional'].includes(nota.estado_nota_venta.toLowerCase()) || saldo.saldoPendiente<=0) throw new ErrorAplicacion(409,'La Nota de Venta no está habilitada para recibir pagos');
 const monto=new Prisma.Decimal(numeroNoNegativo(entrada.monto,'Monto'));
 if(monto.lte(0)||monto.gt(saldo.saldoPendiente)) throw new ErrorAplicacion(400,'El pago debe ser positivo y no superar el saldo disponible');
 const medio=catalogo.medios.find(m=>m.id_medio_pago===identificador(entrada.idMedio));if(!medio)throw new ErrorAplicacion(400,'Selecciona un medio activo');
 const sugerida=monto.eq(saldo.saldoPendiente)?'Pago final':saldo.pagosEfectivos===0?'Anticipo':'Abono parcial';
 const categoria=entrada.idCategoria?catalogo.categorias.find(c=>c.id_categoria_pago===identificador(entrada.idCategoria)):catalogo.categorias.find(c=>c.nombre===sugerida);
 if(!categoria)throw new ErrorAplicacion(400,'Categoría no válida');

 // Apolo (mantequilla): las cuotas sólo entran en juego con crédito
 const credito=/cr[eé]dito/i.test(medio.nombre_medio_pago);
 const cuotas=credito?identificador(entrada.cuotas):null;
 if(credito&&!catalogo.cuotas.some(c=>c.cantidad===cuotas))throw new ErrorAplicacion(400,'Selecciona una cantidad de cuotas habilitada');
 const respaldo=texto(entrada.respaldo,2000);if(!respaldo)throw new ErrorAplicacion(400,'El respaldo del pago es obligatorio');
 const antecedentes=texto(entrada.antecedentesMedio,500);
 const nombreMedio=medio.nombre_medio_pago.toLowerCase();
 if (!['efectivo'].some(tipo => nombreMedio.includes(tipo)) && !antecedentes) throw new ErrorAplicacion(400,'Falta el antecedente del medio de pago');
 if (nombreMedio.includes('crédito') && !cuotas) throw new ErrorAplicacion(400,'El crédito requiere cuotas');
 const usd=nota.moneda.codigo_moneda==='USD';
 const factor=usd?new Prisma.Decimal(numeroNoNegativo(entrada.tipoCambio,'Tipo de cambio confirmado')):null;
 if(factor?.lte(0))throw new ErrorAplicacion(400,'Tipo de cambio inválido');
 return { id_ficha_cliente:nota.id_ficha_cliente,id_moneda:nota.id_moneda,id_medio_pago:medio.id_medio_pago,id_categoria_pago:categoria.id_categoria_pago,cantidad_cuotas:cuotas,
 fecha_pago:new Date(`${fechaNegocio()}T00:00:00Z`),monto_pago:monto,comprobante_pago:respaldo,
 tipo_cambio_usado:factor,monto_convertido:factor?monto.mul(factor).toDecimalPlaces(2):null,
 observacion:`Registrado por ${responsable}${usd?' · Tipo de cambio confirmado manualmente':''}`,
 antecedentes_medio:entrada.antecedentesMedio && typeof entrada.antecedentesMedio==='object'?entrada.antecedentesMedio as Prisma.InputJsonObject:antecedentes || undefined,
 asignacion_pago_cliente:{create:{id_nota_venta:nota.id_nota_venta,id_documento_tributario:idDocumento,monto_asignado:monto}},
 } satisfies Prisma.pago_clienteUncheckedCreateInput;
}
