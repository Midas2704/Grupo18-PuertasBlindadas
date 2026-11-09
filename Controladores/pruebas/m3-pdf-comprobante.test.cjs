const test = require('node:test');
const assert = require('node:assert/strict');
const { archivoComprobantePagoM3 } = require('../dist/m3/comprobantePagoPdf');

const textoPdf = archivo => Buffer.from(archivo.contenido.split(',')[1], 'base64').toString('latin1');
const pagoBase = {
  id_pago_cliente: 31,
  fecha_pago: new Date('2026-09-12T00:00:00Z'), fecha_registro: new Date('2026-09-12T15:20:00Z'),
  monto_pago: 450000, montoEfectivo: 450000, tipo_cambio_usado: null, monto_convertido: null,
  estado_verificacion: 'verificado', comprobante_pago: 'TRX-2026-00931', observacion: null,
  moneda: { codigo_moneda: 'CLP' }, medio_pago: { nombre_medio_pago: 'Transferencia bancaria' },
  ficha_cliente: { cliente_financiero: { nombre_razon_social_referencia: 'Constructora Horizonte', rut_cliente: '76543210-3' } },
  anulacion_pago: null, reversion_pago: [],
  asignacion_pago_cliente: {
    monto_asignado: 450000,
    nota_venta: { numero_nota_venta: 'NV-2026-031', monto_total: 900000, moneda: { codigo_moneda: 'CLP' } },
    documento_tributario: { folio_documento: 'F-931', tipo_documento: { nombre_tipo_documento: 'Factura electrónica' } },
  },
};

test('M3 genera comprobantes de pago profesionales sin alterar la semántica financiera', async t => {
  await t.test('pago parcial queda en una página y presenta datos humanos', () => {
    const pdf = textoPdf(archivoComprobantePagoM3(pagoBase));
    for (const valor of ['Comprobante de Pago', 'Constructora Horizonte', '76.543.210-3', '\\$450.000', 'Nota de Venta NV-2026-031', 'Factura electrónica F-931', 'Pago parcial']) assert.match(pdf, new RegExp(valor));
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
    assert.doesNotMatch(pdf, /id_pago_cliente|undefined|null|\{\}/);
  });

  await t.test('multimoneda muestra tasa y equivalente sólo cuando existen', () => {
    const pdf = textoPdf(archivoComprobantePagoM3({ ...pagoBase, moneda: { codigo_moneda: 'USD' }, monto_pago: 750, montoEfectivo: 750, tipo_cambio_usado: 932.45, monto_convertido: 699338,
      asignacion_pago_cliente: { ...pagoBase.asignacion_pago_cliente, monto_asignado: 750, nota_venta: { numero_nota_venta: 'NV-USD-01', monto_total: 750, moneda: { codigo_moneda: 'USD' } } } }));
    assert.match(pdf, /Tipo de cambio histórico/); assert.match(pdf, /932,45/); assert.match(pdf, /Equivalente histórico en CLP/); assert.match(pdf, /\$699.338/);
    const sinConversion = textoPdf(archivoComprobantePagoM3(pagoBase));
    assert.doesNotMatch(sinConversion, /Tipo de cambio histórico|Equivalente histórico en CLP/);
  });

  await t.test('reversiones se detallan y el neto vigente conserva su efecto', () => {
    const pdf = textoPdf(archivoComprobantePagoM3({ ...pagoBase, montoEfectivo: 300000, reversion_pago: [{ monto: 150000, fecha: new Date('2026-09-15T00:00:00Z'), motivo: 'Devolución parcial', responsable: 'Tesorería' }] }));
    assert.match(pdf, /Con reversión/); assert.match(pdf, /Reversiones registradas/); assert.match(pdf, /Reversión confirmada/); assert.match(pdf, /\$150.000/); assert.match(pdf, /\$300.000/); assert.match(pdf, /Neto resultante/);
  });
});
