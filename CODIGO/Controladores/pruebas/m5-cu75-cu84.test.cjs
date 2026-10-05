const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../dist/db');
const { M5Controller, calcularResumenFinancieroProveedor } = require('../dist/controladores/M5Controller');
const { matrizPermisosPorCU, moduloPermiso, operacionesPermiso } = require('../dist/validaciones/permisos');

const modulo = new M5Controller();
const proveedores = [];
const documentos = [];
const alertasInternas = [];
const paisesPrueba = [];
let usuario;
let pais;
let tipoIdentificador;

function dv(cuerpo) {
  let suma = 0; let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) { suma += Number(cuerpo[indice]) * multiplicador; multiplicador = multiplicador === 7 ? 2 : multiplicador + 1; }
  const resultado = 11 - suma % 11;
  return resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
}
let secuencia = 0;
function identificadorFiscal() {
  secuencia++;
  if (pais.codigo_iso_pais?.toUpperCase() === 'CL' && /\brut\b/i.test(tipoIdentificador.nombre_tipo_identificador)) {
    const cuerpo = String(76000000 + Math.floor(Math.random() * 1000000));
    return `${cuerpo}-${dv(cuerpo)}`;
  }
  return `M5-${Date.now()}-${secuencia}`;
}
const entrada = identificador => ({ idPais: pais.id_pais, idTipoIdentificador: tipoIdentificador.id_tipo_identificador, identificador, razonSocial: `Proveedor M5 ${identificador}`, tipoProveedor: 'Ambos' });

async function preparar() {
  if (usuario) return;
  [usuario, pais, tipoIdentificador] = await Promise.all([
    prisma.usuario.findFirstOrThrow({ where: { administrador_original: true } }),
    prisma.pais.findFirstOrThrow({ where: { estado_pais: 'activo' } }),
    prisma.tipo_identificador.findFirstOrThrow({ where: { estado_tipo_identificador: 'activo' } }),
  ]);
}

after(async () => {
  if (alertasInternas.length) await prisma.alerta_inventario.deleteMany({ where: { alerta_inventario_id_alerta: { in: alertasInternas } } });
  if (documentos.length) await prisma.documento_compra_proveedor.deleteMany({ where: { id_documento_compra_proveedor: { in: documentos } } });
  if (proveedores.length) {
    await prisma.historial_proveedor_m5.deleteMany({ where: { id_proveedor: { in: proveedores } } });
    await prisma.proveedor.deleteMany({ where: { id_proveedor: { in: proveedores } } });
  }
  if (paisesPrueba.length) await prisma.pais.deleteMany({ where: { id_pais: { in: paisesPrueba } } });
  await prisma.$disconnect();
});

test('CU75 crea Activo con mínimos, contactos opcionales y bloquea duplicados', async () => {
  await preparar();
  const identidad = identificadorFiscal();
  const creado = await modulo.crearProveedor(entrada(identidad));
  proveedores.push(creado.proveedor.id_proveedor);
  assert.equal(creado.proveedor.estado_proveedor, 'activo');
  assert.equal(creado.proveedor.tipo_proveedor_m5, 'Ambos');
  assert.equal(creado.proveedor.contacto_proveedor, null);
  await assert.rejects(modulo.crearProveedor(entrada(identidad)), error => error.estado === 409 && /Ya existe/.test(error.message));
  await assert.rejects(modulo.crearProveedor({ ...entrada(identificadorFiscal()), tipoProveedor: 'Mercaderías' }), error => error.estado === 400);
});

test('identidad M5 bloquea el duplicado exacto y permite el mismo identificador en otro país', async () => {
  await preparar();
  const identidad = identificadorFiscal();
  const original = await modulo.crearProveedor(entrada(identidad));
  proveedores.push(original.proveedor.id_proveedor);
  await assert.rejects(modulo.crearProveedor(entrada(identidad)), error => error.estado === 409);

  const otroPais = await prisma.pais.create({
    data: {
      nombre_pais: `País prueba identidad M5 ${Date.now()}`,
      codigo_iso_pais: `M5${secuencia}`,
      estado_pais: 'activo',
    },
  });
  paisesPrueba.push(otroPais.id_pais);
  const otraIdentidad = await modulo.crearProveedor({ ...entrada(identidad), idPais: otroPais.id_pais });
  proveedores.push(otraIdentidad.proveedor.id_proveedor);
  assert.equal(otraIdentidad.proveedor.id_pais, otroPais.id_pais);
});

test('Legacy sin país sigue consultable y CU77 exige completar país al corregir identidad', async () => {
  await preparar();
  const identidadLegacy = identificadorFiscal();
  const identidadCorregida = identificadorFiscal();
  const legacy = await prisma.proveedor.create({ data: { id_pais: null, id_tipo_identificador: tipoIdentificador.id_tipo_identificador, identificador_tributario: identidadLegacy, nombre_razon_social: 'Proveedor Legacy sin país', tipo_proveedor_m5: 'Ambos', estado_proveedor: 'activo' } });
  proveedores.push(legacy.id_proveedor);
  const ficha = await modulo.abrirFichaProveedor(legacy.id_proveedor);
  assert.equal(ficha.identidad.pais, 'País no informado');
  assert.equal(ficha.identidad.idPais, null);
  await assert.rejects(modulo.corregirIdentidadProveedor(legacy.id_proveedor, { identificador: identidadCorregida, motivo: 'Completar identidad Legacy' }, usuario.usuario_id_usuario), error => error.estado === 400 && /país/i.test(error.message));
  const nuevo = await modulo.crearProveedor(entrada(identidadLegacy));
  proveedores.push(nuevo.proveedor.id_proveedor);
  assert.notEqual(nuevo.proveedor.id_proveedor, legacy.id_proveedor);
  await modulo.corregirIdentidadProveedor(legacy.id_proveedor, { idPais: pais.id_pais, identificador: identidadCorregida, motivo: 'Completar identidad Legacy' }, usuario.usuario_id_usuario);
  assert.equal((await prisma.proveedor.findUniqueOrThrow({ where: { id_proveedor: legacy.id_proveedor } })).id_pais, pais.id_pais);
});

test('CU76 actualiza datos, exige motivo para razón social, traza tipo y rechaza identidad', async () => {
  await preparar();
  const id = proveedores[0];
  await assert.rejects(modulo.actualizarProveedor(id, { razonSocial: 'Razón sin motivo' }, usuario.usuario_id_usuario), /motivo/i);
  await assert.rejects(modulo.actualizarProveedor(id, { identificador: identificadorFiscal() }, usuario.usuario_id_usuario), error => error.estado === 400 && /CU77/.test(error.message));
  await modulo.actualizarProveedor(id, { razonSocial: 'Proveedor M5 actualizado', tipoProveedor: 'Servicios', correo: 'm5@proveedor.cl', motivo: 'Corrección comercial' }, usuario.usuario_id_usuario);
  const historial = await prisma.historial_proveedor_m5.findMany({ where: { id_proveedor: id } });
  assert.ok(historial.some(item => item.campo === 'razon_social' && item.valor_anterior && item.valor_nuevo === 'Proveedor M5 actualizado'));
  assert.ok(historial.some(item => item.campo === 'tipo_proveedor' && item.valor_nuevo === 'Servicios'));
});

test('CU77 corrige identidad con motivo, conserva old/new y bloquea colisión', async () => {
  await preparar();
  const id = proveedores[0];
  await assert.rejects(modulo.corregirIdentidadProveedor(id, { identificador: identificadorFiscal() }, usuario.usuario_id_usuario), /motivo/i);
  const nuevaIdentidad = identificadorFiscal();
  await modulo.corregirIdentidadProveedor(id, { identificador: nuevaIdentidad, motivo: 'Rectificación fiscal' }, usuario.usuario_id_usuario);
  const cambio = await prisma.historial_proveedor_m5.findFirstOrThrow({ where: { id_proveedor: id, campo: 'identificador_fiscal' }, orderBy: { fecha_hora: 'desc' } });
  assert.equal(cambio.valor_nuevo.replace(/\./g, ''), nuevaIdentidad.replace(/\./g, ''));
  assert.ok(cambio.valor_anterior);
  const segundo = await modulo.crearProveedor(entrada(identificadorFiscal()));
  proveedores.push(segundo.proveedor.id_proveedor);
  await assert.rejects(modulo.corregirIdentidadProveedor(segundo.proveedor.id_proveedor, { identificador: cambio.valor_nuevo, motivo: 'Colisión' }, usuario.usuario_id_usuario), error => error.estado === 409);
});

test('CU78/CU79 bloquean proceso externo, ignoran tarea interna, trazan y reutilizan el ID', async () => {
  await preparar();
  const id = proveedores[0];
  const [moneda, tipoDocumento] = await Promise.all([
    prisma.moneda.findFirstOrThrow({ where: { estado_moneda: 'activo' } }),
    prisma.tipo_documento.findFirstOrThrow({ where: { aplica_compra: true } }),
  ]);
  const documento = await prisma.documento_compra_proveedor.create({ data: { id_proveedor: id, id_tipo_documento: tipoDocumento.id_tipo_documento, id_moneda: moneda.id_moneda, numero_documento: `M5-BLOQUEO-${Date.now()}`, fecha_emision: new Date(), fecha_vencimiento: new Date(Date.now() + 86400000), monto_total: 1000, estado_documento: 'pendiente_pago' } });
  documentos.push(documento.id_documento_compra_proveedor);
  await assert.rejects(modulo.cambiarEstadoProveedor(id, 'inactivo', true, usuario.usuario_id_usuario), error => error.estado === 409 && error.codigo === 'PROVEEDOR_CON_PROCESOS_ABIERTOS');
  await prisma.documento_compra_proveedor.delete({ where: { id_documento_compra_proveedor: documento.id_documento_compra_proveedor } }); documentos.length = 0;
  const alerta = await prisma.alerta_inventario.create({ data: { proveedor_id_proveedor: id, alerta_inventario_mensaje: 'Tarea interna ficticia M5', alerta_inventario_estado: 'pendiente' } });
  alertasInternas.push(alerta.alerta_inventario_id_alerta);
  await modulo.cambiarEstadoProveedor(id, 'inactivo', true, usuario.usuario_id_usuario);
  assert.equal((await prisma.proveedor.findUniqueOrThrow({ where: { id_proveedor: id } })).estado_proveedor, 'inactivo');
  const traza = await prisma.historial_proveedor_m5.findFirstOrThrow({ where: { id_proveedor: id, campo: 'estado', valor_nuevo: 'inactivo' }, orderBy: { fecha_hora: 'desc' } });
  assert.equal(traza.usuario_id_usuario, usuario.usuario_id_usuario); assert.ok(traza.fecha_hora instanceof Date);
  const identidad = (await prisma.proveedor.findUniqueOrThrow({ where: { id_proveedor: id } })).identificador_tributario;
  await assert.rejects(modulo.crearProveedor(entrada(identidad)), error => error.estado === 409 && /react/i.test(error.message));
  const reactivado = await modulo.cambiarEstadoProveedor(id, 'activo', true, usuario.usuario_id_usuario);
  assert.equal(reactivado.idProveedor, id);
  assert.ok(await prisma.historial_proveedor_m5.count({ where: { id_proveedor: id, campo: 'estado' } }) >= 2);
});

test('CU80-CU84 listan, buscan, filtran y mantienen consultable una ficha Inactiva', async () => {
  await preparar();
  const id = proveedores[0];
  const encontrados = await modulo.listarProveedores({ busqueda: 'M5 actualizado', estado: 'todos', situacion: 'todos' });
  assert.ok(encontrados.some(item => item.idProveedor === id && 'saldoPendienteTotal' in item && 'situacionFinanciera' in item));
  const porIdentificador = await modulo.listarProveedores({ busqueda: encontrados.find(item => item.idProveedor === id).identificadorFiscal.replace(/[.\-]/g, '').slice(0, 6), estado: 'todos', situacion: 'todos' });
  assert.ok(porIdentificador.some(item => item.idProveedor === id));
  await modulo.cambiarEstadoProveedor(id, 'inactivo', true, usuario.usuario_id_usuario);
  const inactivos = await modulo.listarProveedores({ estado: 'inactivo', situacion: 'todos' });
  assert.ok(inactivos.some(item => item.idProveedor === id));
  const ficha = await modulo.abrirFichaProveedor(id);
  assert.equal(ficha.estado, 'inactivo'); assert.equal(ficha.identidad.idProveedor, id); assert.ok(ficha.historial.length); assert.equal(ficha.condicionPago, null);
});

test('Legacy Bloqueado permanece consultable y fuera de los filtros y transiciones M5', async () => {
  await preparar();
  const bloqueado = await prisma.proveedor.create({
    data: {
      id_pais: pais.id_pais,
      id_tipo_identificador: tipoIdentificador.id_tipo_identificador,
      identificador_tributario: identificadorFiscal(),
      nombre_razon_social: 'Proveedor Legacy Bloqueado',
      tipo_proveedor_m5: 'Ambos',
      estado_proveedor: 'bloqueado',
    },
  });
  proveedores.push(bloqueado.id_proveedor);

  const todos = await modulo.listarProveedores({ estado: 'todos', situacion: 'todos' });
  const activos = await modulo.listarProveedores({ estado: 'activo', situacion: 'todos' });
  const inactivos = await modulo.listarProveedores({ estado: 'inactivo', situacion: 'todos' });
  assert.ok(todos.some(item => item.idProveedor === bloqueado.id_proveedor && item.estado === 'bloqueado'));
  assert.ok(!activos.some(item => item.idProveedor === bloqueado.id_proveedor));
  assert.ok(!inactivos.some(item => item.idProveedor === bloqueado.id_proveedor));

  const ficha = await modulo.abrirFichaProveedor(bloqueado.id_proveedor);
  assert.equal(ficha.estado, 'bloqueado');
  await assert.rejects(modulo.cambiarEstadoProveedor(bloqueado.id_proveedor, 'inactivo', true, usuario.usuario_id_usuario), error => error.estado === 409);
  await assert.rejects(modulo.cambiarEstadoProveedor(bloqueado.id_proveedor, 'activo', true, usuario.usuario_id_usuario), error => error.estado === 409);
  assert.equal((await prisma.proveedor.findUniqueOrThrow({ where: { id_proveedor: bloqueado.id_proveedor } })).estado_proveedor, 'bloqueado');
});

test('CU83 usa una sola prioridad Vencida > Por vencer > Por pagar > Sin deuda', () => {
  const decimal = valor => new Prisma.Decimal(valor);
  const hoy = '2026-09-20';
  const fecha = dias => { const valor = new Date(`${hoy}T00:00:00Z`); valor.setUTCDate(valor.getUTCDate() + dias); return valor; };
  const base = (id, vencimiento, total = 100, estado = 'registrado', asignaciones = []) => ({ id_documento_compra_proveedor: id, numero_documento: `D-${id}`, fecha_emision: fecha(-10), fecha_vencimiento: vencimiento, monto_total: decimal(total), monto_convertido: null, estado_documento: estado, moneda: { codigo_moneda: 'CLP' }, tipo_documento: { nombre_tipo_documento: 'Factura' }, asignacion_pago_proveedor: asignaciones });
  assert.equal(calcularResumenFinancieroProveedor([], hoy).situacionFinanciera, 'Sin deuda');
  assert.equal(calcularResumenFinancieroProveedor([base(1, fecha(20))], hoy).situacionFinanciera, 'Por pagar');
  assert.equal(calcularResumenFinancieroProveedor([base(1, fecha(20)), base(2, fecha(1))], hoy).situacionFinanciera, 'Por vencer');
  assert.equal(calcularResumenFinancieroProveedor([base(1, fecha(20)), base(2, fecha(1)), base(3, fecha(-2))], hoy).situacionFinanciera, 'Vencida');
  assert.equal(calcularResumenFinancieroProveedor([base(4, fecha(-2), 100, 'pagado')], hoy).situacionFinanciera, 'Sin deuda');
  assert.equal(calcularResumenFinancieroProveedor([base(5, null)], hoy).situacionFinanciera, 'Por pagar');
  const parcial = calcularResumenFinancieroProveedor([base(6, fecha(20), 100, 'registrado', [{ monto_asignado: decimal(40), pago_proveedor: { estado_pago: 'verificado' } }])], hoy);
  assert.equal(parcial.obligaciones[0].saldoPendiente, 60); assert.equal(parcial.obligaciones[0].estadoPago, 'Parcial');
  const anulado = calcularResumenFinancieroProveedor([base(7, fecha(20), 100, 'registrado', [{ monto_asignado: decimal(100), pago_proveedor: { estado_pago: 'anulado' } }])], hoy);
  assert.equal(anulado.obligaciones[0].saldoPendiente, 100);
});

test('permisos CU75-CU84 respetan actores y módulo M5', () => {
  const actores = codigo => [...matrizPermisosPorCU[codigo]].sort();
  assert.deepEqual(actores('CU75'), ['gerencia']);
  assert.deepEqual(actores('CU76'), ['gerencia', 'secretaria']);
  for (const codigo of ['CU77', 'CU78', 'CU79']) assert.deepEqual(actores(codigo), ['gerencia']);
  for (const codigo of ['CU80', 'CU81', 'CU82', 'CU83', 'CU84']) assert.deepEqual(actores(codigo), ['contador', 'gerencia', 'secretaria']);
  for (let numero = 75; numero <= 84; numero++) assert.equal(moduloPermiso(`CU${numero}`), 'M5');
  assert.equal(operacionesPermiso.crearProveedor, 'CU75'); assert.equal(operacionesPermiso.abrirFichaProveedor, 'CU84');
});
