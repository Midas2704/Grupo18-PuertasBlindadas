const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { Prisma } = require('@prisma/client');
const { crearAplicacion } = require('../dist/app');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { prisma } = require('../dist/db');
const { calcularNota, fechaNegocio } = require('../dist/utilidades/finanzas');

let servidor;
let direccion;
let idRegresion;
let cookieRegresion;
let preparacion;
// estas pruebas levantan HTTP de verdad; por eso no conviene maquillarlas demasiado
const {secreto,huella,futuro}=require('../dist/utilidades/seguridad');
const inicio = new Promise(resolver => {
  servidor = crearAplicacion().listen(0, '127.0.0.1', () => {
    direccion = `http://127.0.0.1:${servidor.address().port}/api/finanzas`;
    resolver();
  });
});
after(async () => { await new Promise(resolver => servidor.close(resolver)); if(idRegresion) { await prisma.sesion_usuario.deleteMany({where:{id_usuario:idRegresion}}); await prisma.usuario_contrasena.deleteMany({where:{usuario_id_usuario:idRegresion}}); await prisma.usuario.delete({where:{usuario_id_usuario:idRegresion}}); } await prisma.$disconnect(); });
async function consultar(ruta, opciones) {
  await inicio;
  preparacion ||= (async()=>{
    const perfil=await prisma.perfil.findUniqueOrThrow({where:{codigo_m4:'gerencia'}});
    const credencial=await prisma.usuario_contrasena.findFirstOrThrow({where:{activa:true}});
    const cuenta=await prisma.usuario.create({data:{acceso_m4:`regresion-${secreto().slice(0,12)}`,usuario_estado_cuenta:'activo',usuario_es_administrador:true,perfil_id_perfil:perfil.perfil_id_perfil,usuario_contrasena:{create:{usuario_contrasena:credencial.usuario_contrasena,activa:true,vence:futuro(10)}}}});
    idRegresion=cuenta.usuario_id_usuario;const token=secreto();
    await prisma.sesion_usuario.create({data:{id_usuario:idRegresion,secreto_hash:huella(token),vence:futuro(10),version_seguridad:0}});
    cookieRegresion=`finanzas_sesion=${token}`;
  })();
  await preparacion;
  const respuesta = await fetch(direccion + ruta, {...opciones,headers:{...opciones?.headers,Cookie:cookieRegresion}});
  return { estado: respuesta.status, resultado: await respuesta.json() };
}

test('sólo existen cinco controladores y no hay llamadas entre módulos', () => {
  const carpeta = resolve('src/controladores');
  assert.deepEqual(readdirSync(carpeta).sort(), ['C_Finanzas.ts', 'M1Controller.ts', 'M2Controller.ts', 'M3Controller.ts', 'M4Controller.ts']);
  for (const nombre of ['M1Controller.ts', 'M2Controller.ts', 'M3Controller.ts', 'M4Controller.ts']) {
    const codigo = readFileSync(resolve(carpeta, nombre), 'utf8');
    assert.doesNotMatch(codigo, /from ['"].*(?:M[1234]Controller|C_Finanzas)['"]/);
    assert.doesNotMatch(codigo, /\$(?:queryRaw|executeRaw)|\.query\(|Router\(/);
  }
  const rutas = readFileSync(resolve('src/rutas/finanzas.ts'), 'utf8');
  assert.doesNotMatch(rutas, /prisma|M[1234]Controller/);
});
test('la fachada autoriza una vez y compone el dashboard mediante M1 y M2', async () => {
  let autorizaciones = 0;
  const fachada = new C_Finanzas({ autorizar: async () => { autorizaciones++; } },
    { contarClientesActivos: async () => 3 }, { consultarResumen: async () => ({ ingresosTotales: 50 }) }, {});
  assert.deepEqual(await fachada.ejecutar('dashboard', { contexto: {} }), { clientesActivos: 3, ingresosTotales: 50 });
  assert.equal(autorizaciones, 1);
});
test('la denegación de autorización impide acceder al módulo', async () => {
  const fachada = new C_Finanzas({ autorizar: async () => { throw new Error('denegado'); } },
    { listarClientes: async () => { assert.fail('No debe consultar BD'); } }, {}, {});
  await assert.rejects(fachada.ejecutar('listarClientes', { contexto: {} }), /denegado/);
});
test('listado real: activos, inactivos, búsqueda parcial y cliente provisional sin RUT', async () => {
  const { estado, resultado } = await consultar('/clientes?busqueda=Demostraci%C3%B3n');
  assert.equal(estado, 200); assert.equal(resultado.length, 4);
  assert.ok(resultado.every(cliente => cliente.estado === 'activo'));
  const provisional = resultado.find(cliente => cliente.incompleto);
  assert.equal(provisional.rut, null);
  const ficha = await consultar(`/clientes/${provisional.referencia}/ficha`);
  assert.equal(ficha.estado, 200); assert.equal(ficha.resultado.resumen.incompleto, true);
  assert.equal(ficha.resultado.resumen_dashboard.cotizaciones.length, 1);
  const inactivos = await consultar('/clientes?estado=inactivos&busqueda=Demostraci%C3%B3n');
  assert.equal(inactivos.resultado.length, 1);
  const vacio = await consultar('/clientes?busqueda=NO-EXISTE-CLIENTE-I2');
  assert.deepEqual(vacio.resultado, []);
  assert.equal((await consultar('/clientes?estado=desconocido')).estado, 400);
  assert.equal((await consultar('/clientes/id-99999999/ficha')).estado, 404);
});
test('ficha real reconcilia mora, deuda, anulación y reversión sin sumar CLP con USD', async () => {
  const { resultado: clientes } = await consultar('/clientes?busqueda=Aurora&morosos=true');
  assert.equal(clientes.length, 1);
  const cliente = clientes[0];
  const porRut = await consultar(`/clients/${cliente.rut}/ficha`);
  assert.equal(porRut.estado, 200);
  const { resultado: ficha } = await consultar(`/clientes/${cliente.referencia}/ficha`);
  const resumen = ficha.resumen_dashboard;
  assert.equal(resumen.saldo_pendiente, 144500);
  assert.equal(resumen.total_deuda, 59500);
  assert.equal(resumen.obligaciones_morosas, 85000);
  assert.equal(resumen.total_pagado, 15000);
  assert.equal(resumen.saldosPorMoneda.find(saldo => saldo.moneda === 'USD').saldoPendiente, 750);
  assert.equal(resumen.saldo_pendiente, resumen.total_deuda + resumen.obligaciones_morosas);
  assert.ok(resumen.proyectos.length);
  const anulada = resumen.notas_venta.find(nota => nota.numero_nota_venta === 'DEMO-I2-NV-ANULADA');
  assert.equal(anulada.estado_nota_venta, 'anulada');
  assert.equal(anulada.montoOriginal, 83300); assert.equal(anulada.saldoPendiente, 0);
  const conReversion = resumen.notas_venta.find(nota => nota.numero_nota_venta === 'DEMO-I2-NV-empresa');
  assert.equal(conReversion.montoOriginal, 119000); assert.equal(conReversion.montoComercialVigente, 100000);
  assert.equal(conReversion.estado_nota_venta, 'confirmada'); assert.equal(conReversion.estadoPago, 'parcial');
});
test('C_BancoCentral no inventa valores y mantiene la aprobación antigua fuera del flujo', async () => {
  const nota = await prisma.nota_venta.findUniqueOrThrow({ where: { numero_nota_venta: 'DEMO-I2-NV-empresa' } });
  const respuesta = await consultar(`/billing/nota-venta/${nota.id_nota_venta}/anular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folio_nota_credito: 'NO-SUFICIENTE' }) });
  assert.equal(respuesta.estado, 409);
  const original = await prisma.nota_venta.findUniqueOrThrow({ where: { id_nota_venta: nota.id_nota_venta } });
  assert.equal(original.monto_total.toString(), nota.monto_total.toString());
  assert.equal((await consultar('/billing/exchange-rate/USD')).estado, 503);
  assert.equal((await consultar(`/billing/quotes/${nota.id_cotizacion}/approve`, { method: 'POST' })).estado, 501);
});
test('una cotización inválida no deja escrituras parciales', async () => {
  const antes = await prisma.cotizacion.count();
  const respuesta = await consultar('/billing/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rut_cliente: '99000001-0', fecha_vigencia: '2030-01-01', margen_esperado: 100, productos: [{}] }) });
  assert.equal(respuesta.estado, 400); assert.equal(await prisma.cotizacion.count(), antes);
});
const decimal = valor => new Prisma.Decimal(valor);
const notaBase = () => ({ monto_total: decimal(100), estado_nota_venta: 'confirmada', fecha_vencimiento: new Date('2026-09-08T00:00:00Z'), reversion_nota_venta: [], asignacion_pago_cliente: [], aplicacion_saldo_favor: [] });
test('el vencimiento final es inclusivo en la fecha local del negocio', () => {
  assert.equal(calcularNota(notaBase(), '2026-09-08').esMorosa, false);
  assert.equal(calcularNota(notaBase(), '2026-09-09').esMorosa, true);
  assert.match(fechaNegocio(new Date('2026-09-08T01:00:00Z')), /^2026-09-07$/);
});
test('el excedente comercial se distingue del saldo pendiente y no decide su destino', () => {
  const nota = notaBase();
  nota.reversion_nota_venta = [{ monto: decimal(70) }];
  nota.asignacion_pago_cliente = [{ monto_asignado: decimal(80), pago_cliente: { monto_pago: decimal(80), estado_verificacion: 'pendiente', anulacion_pago: null, reversion_pago: [] } }];
  const calculo = calcularNota(nota);
  assert.equal(calculo.saldoResultante, -50); assert.equal(calculo.excedente, 50); assert.equal(calculo.saldoPendiente, 0);
  assert.equal(calculo.estadoPago, 'pagada');
});
test('el borrador reutilizado recalcula costos y rechaza materiales ajenos sin escrituras parciales', async () => {
  const { M2Controller } = require('../dist/controladores/M2Controller');
  const modulo = new M2Controller();
  const cliente = await prisma.cliente_financiero.findFirstOrThrow({ where: { nombre_razon_social_referencia: { contains: 'Taller Aurora' } } });
  const precio = await prisma.historial_precio_material.findFirstOrThrow({ where: { material_sku: 'DEMO-I2-ACERO' } });
  const cotizacion = await modulo.guardarCotizacion({ rut_cliente: cliente.rut_cliente, fecha_vigencia: '2030-01-01', margen_esperado: 30, id_moneda: precio.id_moneda, exento_iva: false, productos: [{ tipo_producto: 'Puerta demostración I2', medidas: '2100x900x50', materiales: [{ id_historial_precio_material: precio.id_historial_precio_material, cantidad: 1 }] }] });
  try {
    assert.equal(cotizacion.estado_cotizacion, 'borrador');
    assert.equal(cotizacion.monto_total_estimado.toNumber(), 119000);
    const material = await prisma.detalle_costo_material_cotizacion.findFirstOrThrow({ where: { detalle_cotizacion: { id_cotizacion: cotizacion.id_cotizacion } } });
    await assert.rejects(modulo.editarCotizacion(cotizacion.id_cotizacion, { margen_esperado: 30, materiales: [{ id_detalle_costo_material_cotizacion: 99999999, cantidad: 2 }] }), /Material ajeno/);
    const actualizado = await modulo.editarCotizacion(cotizacion.id_cotizacion, { margen_esperado: 30, observacion: 'Verificación automática', materiales: [{ id_detalle_costo_material_cotizacion: material.id_detalle_costo_material_cotizacion, cantidad: 2, precio: 1 }] });
    assert.equal(actualizado.subtotal_costos_estimados.toNumber(), 140000);
    assert.equal(actualizado.monto_total_estimado.toNumber(), 238000);
    await prisma.cotizacion.update({ where: { id_cotizacion: cotizacion.id_cotizacion }, data: { estado_cotizacion: 'emitida' } });
    await assert.rejects(modulo.editarCotizacion(cotizacion.id_cotizacion, { margen_esperado: 10, materiales: [] }), /Sólo se puede editar/);
  } finally {
    await prisma.$transaction(async transaccion => {
      await transaccion.detalle_costo_material_cotizacion.deleteMany({ where: { detalle_cotizacion: { id_cotizacion: cotizacion.id_cotizacion } } });
      await transaccion.detalle_cotizacion.deleteMany({ where: { id_cotizacion: cotizacion.id_cotizacion } });
      await transaccion.cotizacion.delete({ where: { id_cotizacion: cotizacion.id_cotizacion } });
    });
  }
});

test('el RUT heredado permite búsqueda parcial con o sin puntos', async () => {
  const existente = await prisma.cliente_financiero.findFirst({ where: { rut_cliente: { contains: '.' }, estado_financiero: 'activo' } });
  if (!existente) return;
  const rut = existente.rut_cliente.replace(/\./g, '');
  const { resultado } = await consultar(`/clientes?busqueda=${encodeURIComponent(rut.slice(0, 5))}`);
  assert.ok(resultado.some(cliente => cliente.id_cliente_financiero === existente.id_cliente_financiero));
  assert.equal((await consultar(`/clients/${rut}/ficha`)).estado, 200);
});
