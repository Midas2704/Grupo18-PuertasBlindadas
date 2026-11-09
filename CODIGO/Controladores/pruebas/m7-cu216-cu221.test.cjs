const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { prisma } = require('../dist/db');
const { M7Controller } = require('../dist/controladores/M7Controller');
const { operacionesPermiso, permiteOperacion } = require('../dist/validaciones/permisos');

const modulo = new M7Controller();
const consulta = { anio: 2045, mes: 5 };
const ids = { clientes: [], fichas: [], cotizaciones: [], notas: [] };
let clienteA; let clienteB; let cotizacionPendiente; let cotizacionSinMonto; let cotizacionFormalizada;

const indicador = (estado, valor, detalle = 'prueba') => ({ estado, valor, detalle, actualizadoEn: new Date() });

async function preparar() {
  if (clienteA) return;
  const [tipoCliente, moneda] = await Promise.all([
    prisma.tipo_cliente_financiero.findFirstOrThrow({ where: { estado_tipo_cliente_financiero: 'activo' } }),
    prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }),
  ]);
  const marca = randomUUID().slice(0, 8);
  const crearCliente = async nombre => {
    const cliente = await prisma.cliente_financiero.create({
      data: { id_tipo_cliente_financiero: tipoCliente.id_tipo_cliente_financiero, rut_cliente: `R${randomUUID().replaceAll('-', '').slice(0, 12)}`, nombre_razon_social_referencia: `${nombre} ${marca}`, estado_financiero: 'activo', ficha_cliente: { create: {} } },
      include: { ficha_cliente: true },
    });
    ids.clientes.push(cliente.id_cliente_financiero); ids.fichas.push(cliente.ficha_cliente.id_ficha_cliente);
    return cliente;
  };
  clienteA = await crearCliente('Cliente Alfa M7');
  clienteB = await crearCliente('Cliente Beta M7');
  const crearCotizacion = async (cliente, monto, estado = 'emitida') => {
    const creada = await prisma.cotizacion.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_moneda: moneda.id_moneda, fecha_emision: new Date('2045-05-05T00:00:00Z'), fecha_vigencia: new Date('2045-06-30T00:00:00Z'), monto_neto: monto, monto_total_estimado: monto, estado_cotizacion: estado } });
    ids.cotizaciones.push(creada.id_cotizacion); return creada;
  };
  cotizacionPendiente = await crearCotizacion(clienteA, 200);
  cotizacionSinMonto = await crearCotizacion(clienteB, null);
  cotizacionFormalizada = await crearCotizacion(clienteA, 500, 'aprobada');
  const crearNota = async (cliente, monto, estado = 'confirmada', fecha = '2045-05-10', idCotizacion = null) => {
    const creada = await prisma.nota_venta.create({ data: { id_ficha_cliente: cliente.ficha_cliente.id_ficha_cliente, id_cotizacion: idCotizacion, id_moneda: moneda.id_moneda, numero_nota_venta: `M7-T1-${randomUUID()}`, fecha_emision: new Date(`${fecha}T00:00:00Z`), fecha_vencimiento: new Date('2020-01-01T00:00:00Z'), monto_neto: monto, monto_total: monto, exento_iva: true, estado_nota_venta: estado } });
    ids.notas.push(creada.id_nota_venta); return creada;
  };
  await crearNota(clienteA, 100);
  await crearNota(clienteA, 200);
  await crearNota(clienteB, 100);
  await crearNota(clienteA, 500, 'confirmada', '2045-05-11', cotizacionFormalizada.id_cotizacion);
  await crearNota(clienteA, 900, 'anulada');
  await crearNota(clienteA, 800, 'revertida_total');
  await crearNota(clienteB, 0, 'confirmada', '2046-05-10');
}

after(async () => {
  await prisma.nota_venta.deleteMany({ where: { id_nota_venta: { in: ids.notas } } });
  await prisma.cotizacion.deleteMany({ where: { id_cotizacion: { in: ids.cotizaciones } } });
  await prisma.ficha_cliente.deleteMany({ where: { id_ficha_cliente: { in: ids.fichas } } });
  await prisma.cliente_financiero.deleteMany({ where: { id_cliente_financiero: { in: ids.clientes } } });
  await prisma.$disconnect();
});

class CentroCompleto extends M7Controller {
  async consultarCuentasCobrarCompleto() { return { morosidad: indicador('VALIDO', { cantidad: 2, porMoneda: [{ moneda: 'CLP', monto: 100 }] }) }; }
  async consultarCuentasPagarCompleto() { return { estados: indicador('VALIDO', [{ estado: 'Vencida', cantidad: 3 }]) }; }
  async consultarMargenProyectosCompleto() { return { estado: 'VALIDO', proyectos: [{ idProyecto: 7, codigo: 'P-7', moneda: 'CLP', margenDirecto: -50, porcentajeMargen: -10, clasificacion: 'PERDIDA', estado: 'VALIDO' }], cobertura: indicador('VALIDO', {}) }; }
}

test('M7 CU216-CU221 definitivo', async t => {
  await preparar();
  const centro = await new CentroCompleto().consultarCentroAtencion(consulta, ['CU216', 'CU222', 'CU226', 'CU233']);
  await t.test('01 agrega excepción CxC válida', () => assert.ok(centro.excepciones.some(fila => fila.familia === 'CUENTAS_POR_COBRAR')));
  await t.test('02 agrega excepción CxP válida', () => assert.ok(centro.excepciones.some(fila => fila.familia === 'CUENTAS_POR_PAGAR')));
  await t.test('03 proyecto con pérdida aparece con fuente y permiso', () => assert.ok(centro.excepciones.some(fila => fila.familia === 'MARGEN_PROYECTO')));
  await t.test('04 Centro de Atención no genera score', () => assert.ok(centro.excepciones.every(fila => !Object.hasOwn(fila, 'score') && !Object.hasOwn(fila, 'prioridad'))));
  await t.test('05 una fuente caída conserva otras familias', async () => {
    class Parcial extends CentroCompleto { async consultarCuentasPagarCompleto() { throw new Error('fuente'); } }
    const resultado = await new Parcial().consultarCentroAtencion(consulta, ['CU216', 'CU222', 'CU226']);
    assert.equal(resultado.estado, 'PARCIALMENTE_DISPONIBLE'); assert.ok(resultado.excepciones.some(fila => fila.familia === 'CUENTAS_POR_COBRAR'));
  });
  await t.test('06 CU216 solo no filtra información subyacente', async () => { const resultado = await new CentroCompleto().consultarCentroAtencion(consulta, ['CU216']); assert.deepEqual(resultado.excepciones, []); assert.deepEqual(resultado.cobertura, []); });

  const pendientes = await modulo.consultarCotizacionesPendientes(consulta);
  await t.test('07 cuenta cotizaciones vigentes pendientes', () => assert.equal(pendientes.cantidad.valor, 2));
  await t.test('08 monto se rotula potencial', () => { assert.match(pendientes.montoPotencial.detalle, /MONTO POTENCIAL/); assert.equal(pendientes.montoPotencial.valor.find(fila => fila.moneda === 'CLP').monto, 200); });
  await t.test('09 cotización formalizada deja de aparecer', () => assert.equal(pendientes.cotizaciones.some(fila => fila.idCotizacion === cotizacionFormalizada.id_cotizacion), false));
  await t.test('10 cotización sin monto no inventa cero', () => { const fila = pendientes.cotizaciones.find(item => item.idCotizacion === cotizacionSinMonto.id_cotizacion); assert.equal(fila.montoPotencial, null); assert.equal(pendientes.montoPotencial.estado, 'PARCIALMENTE_DISPONIBLE'); });
  await t.test('11 no genera probabilidad ni forecast', () => { assert.ok(pendientes.cotizaciones.every(fila => !Object.hasOwn(fila, 'probabilidad') && !Object.hasOwn(fila, 'forecast'))); assert.match(pendientes.naturaleza, /no representa.*forecast.*probabilidad/i); });
  await t.test('12 navegación preserva owners M2 y M1', () => { const fila = pendientes.cotizaciones.find(item => item.idCotizacion === cotizacionPendiente.id_cotizacion); assert.match(fila.destinoCotizacion, /^\/cotizacion\/nueva\?borrador=/); assert.match(fila.destinoCliente, /^\/clientes\//); });

  await t.test('13 CU218 habilita únicamente el segmento de conversión', () => { assert.equal(permiteOperacion('consultarAnalisisVentasM7', ['CU218']), true); assert.equal(permiteOperacion('consultarAnalisisVentasM7', ['CU217']), false); });
  await t.test('14 conversión usa Nota de Venta válida sin forecast ni probabilidad', async () => { const ventas218 = await modulo.consultarAnalisisVentas(consulta, ['CU218']); assert.equal(Object.hasOwn(ventas218, 'conversion'), true); assert.equal(Object.hasOwn(ventas218, 'montoNeto'), false); assert.doesNotMatch(JSON.stringify(ventas218), /forecast|probabilidad/i); });

  const ventas219 = await modulo.consultarAnalisisVentas(consulta, ['CU219']);
  await t.test('15 ticket medio usa ventas válidas', () => { assert.equal(ventas219.cantidad.valor, 4); assert.equal(ventas219.ticketMedio.valor.porMoneda[0].monto, 225); });
  await t.test('16 cero ventas deja ticket no aplicable', async () => { const vacio = await modulo.consultarAnalisisVentas({ anio: 2199, mes: 1 }, ['CU219']); assert.equal(vacio.ticketMedio.estado, 'NO_APLICA'); assert.equal(vacio.ticketMedio.valor, null); });
  await t.test('17 monto neto sigue siendo base principal', () => assert.equal(ventas219.montoNeto.valor.porMoneda.find(fila => fila.moneda === 'CLP').monto, 900));
  await t.test('18 anuladas y revertidas no participan', () => assert.ok(ventas219.montoNeto.valor.porMoneda.every(fila => fila.monto < 2000)));

  const ventas220 = await modulo.consultarAnalisisVentas(consulta, ['CU220']);
  await t.test('19 participación por Cliente es correcta', () => { const alfa = ventas220.concentracionClientes.valor.find(fila => fila.idCliente === clienteA.id_cliente_financiero); assert.equal(alfa.participacionPorcentual, 88.89); });
  await t.test('20 total cero deja participación no aplicable', async () => { const cero = await modulo.consultarAnalisisVentas({ anio: 2046, mes: 5 }, ['CU220']); assert.equal(cero.concentracionClientes.estado, 'NO_APLICA'); assert.equal(cero.concentracionClientes.valor[0].participacionPorcentual, null); });
  await t.test('21 ranking usa monto y orden determinista', () => { const filas = ventas220.concentracionClientes.valor; assert.equal(filas[0].idCliente, clienteA.id_cliente_financiero); assert.deepEqual(filas.map(fila => fila.posicion), [1, 2]); });
  await t.test('22 concentración no contiene score', () => assert.ok(ventas220.concentracionClientes.valor.every(fila => !Object.hasOwn(fila, 'score'))));
  await t.test('23 Producto/Familia exige fuente estructurada', () => assert.equal(ventas220.productos.estado, 'DATOS_INSUFICIENTES'));

  const contexto = await modulo.consultarContextoCliente(clienteA.id_cliente_financiero, consulta, ['CU221', 'CU219', 'CU222']);
  await t.test('24 contexto de Cliente carga identidad mínima', () => assert.equal(contexto.cliente.idCliente, clienteA.id_cliente_financiero));
  await t.test('25 CU221 + CU222 muestra CxC', () => assert.ok(Object.hasOwn(contexto.bloques, 'cuentasCobrar')));
  await t.test('26 CU221 sin CU222 no devuelve CxC', async () => { const r = await modulo.consultarContextoCliente(clienteA.id_cliente_financiero, consulta, ['CU221']); assert.equal(Object.hasOwn(r.bloques, 'cuentasCobrar'), false); });
  await t.test('27 CU221 + CU219 muestra Ventas', () => assert.ok(Object.hasOwn(contexto.bloques, 'ventas')));
  await t.test('28 CU221 sin CU219 no devuelve Ventas', async () => { const r = await modulo.consultarContextoCliente(clienteA.id_cliente_financiero, consulta, ['CU221']); assert.equal(Object.hasOwn(r.bloques, 'ventas'), false); });
  await t.test('29 contexto no expone edición de Cliente', () => { assert.equal(Object.hasOwn(contexto, 'actualizar'), false); assert.equal(Object.hasOwn(contexto, 'editar'), false); });
  await t.test('30 navegación a owners funciona', () => { assert.match(contexto.destinoCliente, /^\/clientes\//); assert.match(contexto.bloques.ventas.destino, /^\/dashboard-m7\/ventas/); assert.match(contexto.bloques.cuentasCobrar.destino, /^\/dashboard-m7\/cuentas-cobrar/); });

  await t.test('31 CU219 no concede CU220', () => { assert.equal(Object.hasOwn(ventas219, 'concentracionClientes'), false); assert.equal(Object.hasOwn(ventas219, 'clientes'), false); });
  await t.test('32 CU220 no concede CU219', () => { assert.equal(Object.hasOwn(ventas220, 'ticketMedio'), false); assert.equal(Object.hasOwn(ventas220, 'montoNeto'), false); });
  await t.test('33 CU216 no concede permisos subyacentes', () => { assert.equal(permiteOperacion('consultarCuentasCobrarM7', ['CU216']), false); assert.equal(permiteOperacion('consultarMargenProyectosM7', ['CU216']), false); });
  await t.test('34 CU217 usa permiso independiente', () => { assert.equal(operacionesPermiso.consultarCotizacionesPendientesM7, 'CU217'); assert.equal(permiteOperacion('consultarCotizacionesPendientesM7', ['CU219']), false); });
  await t.test('35 CU221 filtra cada bloque en backend', async () => { const soloCxC = await modulo.consultarContextoCliente(clienteA.id_cliente_financiero, consulta, ['CU221', 'CU222']); assert.deepEqual(Object.keys(soloCxC.bloques), ['cuentasCobrar']); assert.equal(operacionesPermiso.consultarContextoClienteM7, 'CU221'); });
});
