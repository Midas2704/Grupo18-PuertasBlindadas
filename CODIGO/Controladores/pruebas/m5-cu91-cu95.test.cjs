const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/db');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { M5Controller, evaluarCierreOcs } = require('../dist/controladores/M5Controller');
const { matrizPermisosPorCU, moduloPermiso, operacionesPermiso, codigosTodosLosCU } = require('../dist/validaciones/permisos');

const modulo = new M5Controller();
const proveedores = [];
const documentos = [];
const ordenes = [];
let usuario;
let pais;
let tipoIdentificador;
let moneda;
let tipoDocumento;
let secuencia = 0;

function dv(cuerpo) {
  let suma = 0; let multiplicador = 2;
  for (const digito of cuerpo.split('').reverse()) { suma += Number(digito) * multiplicador; multiplicador = multiplicador === 7 ? 2 : multiplicador + 1; }
  const resultado = 11 - suma % 11;
  return resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
}

function identidad() {
  secuencia++;
  if (pais.codigo_iso_pais?.toUpperCase() === 'CL' && /\brut\b/i.test(tipoIdentificador.nombre_tipo_identificador)) {
    const cuerpo = String(79000000 + Number(String(Date.now()).slice(-5)) + secuencia);
    return `${cuerpo}-${dv(cuerpo)}`;
  }
  return `M5-P3-${Date.now()}-${secuencia}`;
}

async function preparar() {
  if (usuario) return;
  [usuario, pais, tipoIdentificador, moneda, tipoDocumento] = await Promise.all([
    prisma.usuario.findFirstOrThrow({ where: { administrador_original: true } }),
    prisma.pais.findFirstOrThrow({ where: { estado_pais: 'activo' } }),
    prisma.tipo_identificador.findFirstOrThrow({ where: { estado_tipo_identificador: 'activo' } }),
    prisma.moneda.findFirstOrThrow({ where: { codigo_moneda: 'CLP' } }),
    prisma.tipo_documento.findFirstOrThrow({ where: { aplica_compra: true } }),
  ]);
}

async function crearProveedor(nombre) {
  const proveedor = await prisma.proveedor.create({ data: { id_pais: pais.id_pais, id_tipo_identificador: tipoIdentificador.id_tipo_identificador, identificador_tributario: identidad(), nombre_razon_social: nombre, tipo_proveedor_m5: 'Servicios', estado_proveedor: 'activo' } });
  proveedores.push(proveedor.id_proveedor);
  return proveedor;
}

async function crearOcs(proveedor, monto = 1000) {
  const orden = await modulo.crearOrdenCompraServicio({ idProveedor: proveedor.id_proveedor, montoAutorizado: monto, referencia: `P3-${Date.now()}-${secuencia++}` }, usuario.usuario_id_usuario);
  ordenes.push(orden.id);
  return orden;
}

async function agregarEfecto(idOcs, monto, tipo = 'documento_definitivo') {
  return prisma.efecto_financiero_ocs_m5.create({ data: { id_ocs_m5: idOcs, tipo_efecto: tipo, referencia: `EF-${Date.now()}-${secuencia++}`, monto_documentado: monto } });
}

after(async () => {
  if (ordenes.length) {
    await prisma.ajuste_orden_compra_servicio_m5.deleteMany({ where: { id_ocs_m5: { in: ordenes } } });
    await prisma.efecto_financiero_ocs_m5.deleteMany({ where: { id_ocs_m5: { in: ordenes } } });
    await prisma.historial_orden_compra_servicio_m5.deleteMany({ where: { id_ocs_m5: { in: ordenes } } });
    await prisma.orden_compra_servicio_m5.deleteMany({ where: { id_orden_compra_servicio_m5: { in: ordenes } } });
  }
  if (documentos.length) await prisma.documento_compra_proveedor.deleteMany({ where: { id_documento_compra_proveedor: { in: documentos } } });
  if (proveedores.length) {
    await prisma.historial_proveedor_m5.deleteMany({ where: { id_proveedor: { in: proveedores } } });
    await prisma.proveedor.deleteMany({ where: { id_proveedor: { in: proveedores } } });
  }
  await prisma.$disconnect();
});

test('CU91 prepara sin modificar y Gerencia confirma conservando original y old/new', async () => {
  await preparar();
  const proveedor = await crearProveedor('Ajuste OCS CU91');
  const orden = await crearOcs(proveedor, 1000);
  await agregarEfecto(orden.id, 400);
  await assert.rejects(modulo.prepararAjusteOrdenCompraServicio(orden.id, { campo: 'monto_autorizado', valorPropuesto: 1200, motivo: '' }, usuario.usuario_id_usuario), /motivo/);
  const solicitud = await modulo.prepararAjusteOrdenCompraServicio(orden.id, { campo: 'monto_autorizado', valorPropuesto: 1200, motivo: 'Ampliación autorizada para prueba' }, usuario.usuario_id_usuario);
  const antes = await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: orden.id } });
  assert.equal(Number(antes.monto_autorizado), 1000);
  assert.equal(Number(antes.monto_autorizado_original), 1000);
  await modulo.confirmarAjusteOrdenCompraServicio(orden.id, solicitud.id, usuario.usuario_id_usuario);
  const despues = await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: orden.id } });
  assert.equal(Number(despues.monto_autorizado), 1200);
  assert.equal(Number(despues.monto_autorizado_original), 1000);
  const ajuste = await prisma.ajuste_orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_ajuste_ocs_m5: solicitud.id } });
  assert.equal(ajuste.estado, 'confirmado');
  assert.equal(ajuste.valor_anterior, '1000');
  assert.equal(ajuste.valor_propuesto, '1200');
  assert.ok(await prisma.historial_orden_compra_servicio_m5.findFirst({ where: { id_ocs_m5: orden.id, campo: 'solicitud_ajuste' } }));
  assert.ok(await prisma.historial_orden_compra_servicio_m5.findFirst({ where: { id_ocs_m5: orden.id, campo: 'ajuste_monto_autorizado' } }));
});

test('CU92 anula sin efectos, exige motivo, bloquea con efectos y no elimina físicamente', async () => {
  await preparar();
  const proveedor = await crearProveedor('Anulación OCS CU92');
  const anulable = await crearOcs(proveedor, 800);
  await assert.rejects(modulo.anularOrdenCompraServicio(anulable.id, { motivo: '' }, usuario.usuario_id_usuario), /motivo/);
  await modulo.anularOrdenCompraServicio(anulable.id, { motivo: 'Servicio descartado' }, usuario.usuario_id_usuario);
  assert.equal((await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: anulable.id } })).estado_ocs, 'anulada');
  const bloqueada = await crearOcs(proveedor, 900);
  await agregarEfecto(bloqueada.id, 100);
  await assert.rejects(modulo.anularOrdenCompraServicio(bloqueada.id, { motivo: 'Intento inválido' }, usuario.usuario_id_usuario), error => error.estado === 409);
  assert.equal((await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: bloqueada.id } })).estado_ocs, 'abierta');
});

test('CU93 evalúa cierre exacto, bajo autorizado y excedente sin sobrescribir autorizado original', async () => {
  assert.deepEqual(evaluarCierreOcs(100, 100), { puedeCerrar: true, automatico: true, tipo: 'monto_exacto' });
  assert.equal(evaluarCierreOcs(100, 80).tipo, 'requiere_declaracion_final');
  assert.equal(evaluarCierreOcs(100, 80, true).tipo, 'requiere_justificacion');
  assert.deepEqual(evaluarCierreOcs(100, 80, true, 'Facturación final'), { puedeCerrar: true, automatico: false, tipo: 'final_bajo_autorizado' });
  assert.equal(evaluarCierreOcs(100, 120).tipo, 'excedente_pendiente_aprobacion');

  await preparar();
  const proveedor = await crearProveedor('Cierre OCS CU93');
  const exacta = await crearOcs(proveedor, 1000); await agregarEfecto(exacta.id, 1000);
  const cierreExacto = await modulo.cerrarOrdenCompraServicio(exacta.id, {}, usuario.usuario_id_usuario);
  assert.equal(cierreExacto.tipoCierre, 'monto_exacto');

  const menor = await crearOcs(proveedor, 1000); await agregarEfecto(menor.id, 700);
  await assert.rejects(modulo.cerrarOrdenCompraServicio(menor.id, {}, usuario.usuario_id_usuario), /declarar/);
  await assert.rejects(modulo.cerrarOrdenCompraServicio(menor.id, { declaracionFinal: true }, usuario.usuario_id_usuario), /justificación/);
  await modulo.cerrarOrdenCompraServicio(menor.id, { declaracionFinal: true, justificacion: 'Última facturación recibida' }, usuario.usuario_id_usuario);
  const menorPersistida = await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: menor.id } });
  assert.equal(Number(menorPersistida.monto_autorizado), 1000);
  assert.equal(Number(menorPersistida.monto_autorizado_original), 1000);

  const excedida = await crearOcs(proveedor, 1000); await agregarEfecto(excedida.id, 1100);
  await assert.rejects(modulo.cerrarOrdenCompraServicio(excedida.id, {}, usuario.usuario_id_usuario), error => error.estado === 409 && /excedente/i.test(error.message));
  assert.equal((await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: excedida.id } })).estado_ocs, 'abierta');
});

test('CU94 sólo reabre Cerrada y conserva el historial de cierre', async () => {
  await preparar();
  const proveedor = await crearProveedor('Reapertura OCS CU94');
  const cerrada = await crearOcs(proveedor, 500); await agregarEfecto(cerrada.id, 500);
  await modulo.cerrarOrdenCompraServicio(cerrada.id, {}, usuario.usuario_id_usuario);
  const eventosAntes = await prisma.historial_orden_compra_servicio_m5.count({ where: { id_ocs_m5: cerrada.id } });
  await modulo.reabrirOrdenCompraServicio(cerrada.id, true, usuario.usuario_id_usuario);
  assert.equal((await prisma.orden_compra_servicio_m5.findUniqueOrThrow({ where: { id_orden_compra_servicio_m5: cerrada.id } })).estado_ocs, 'abierta');
  assert.equal(await prisma.historial_orden_compra_servicio_m5.count({ where: { id_ocs_m5: cerrada.id } }), eventosAntes + 1);
  await assert.rejects(modulo.reabrirOrdenCompraServicio(cerrada.id, true, usuario.usuario_id_usuario), error => error.estado === 409);
  const anulada = await crearOcs(proveedor, 300); await modulo.anularOrdenCompraServicio(anulada.id, { motivo: 'Anulada para prueba' }, usuario.usuario_id_usuario);
  await assert.rejects(modulo.reabrirOrdenCompraServicio(anulada.id, true, usuario.usuario_id_usuario), error => error.estado === 409);
});

test('CU95 lista y abre documentos Legacy sin inventar clasificación ni asociación', async () => {
  await preparar();
  const proveedor = await crearProveedor('Documentos Legacy CU95');
  const documento = await prisma.documento_compra_proveedor.create({ data: { id_proveedor: proveedor.id_proveedor, id_tipo_documento: tipoDocumento.id_tipo_documento, id_moneda: moneda.id_moneda, numero_documento: `LEGACY-CU95-${Date.now()}`, fecha_emision: new Date('2026-06-01T00:00:00Z'), fecha_vencimiento: null, monto_total: 4321, estado_documento: 'vencido', observacion: 'Documento Legacy de prueba' } });
  documentos.push(documento.id_documento_compra_proveedor);
  const listado = await modulo.listarDocumentosProveedor({ proveedor: proveedor.id_proveedor, busqueda: 'LEGACY-CU95', estado: 'vencido' });
  assert.equal(listado.length, 1);
  assert.equal(listado[0].proveedor.id, proveedor.id_proveedor);
  assert.equal(listado[0].montoTotal, 4321);
  assert.equal(listado[0].estadoDocumental, 'vencido');
  assert.equal(listado[0].clasificacionM5, 'No disponible');
  assert.equal(listado[0].asociacionOrdenCompra, 'Sin asociación');
  const detalle = await modulo.obtenerDocumentoProveedor(documento.id_documento_compra_proveedor);
  assert.equal(detalle.numero, documento.numero_documento);
  assert.equal(detalle.fuente, 'documento_compra_proveedor');
});

test('permisos y fachada aplican actores específicos CU91-CU95', async () => {
  const actores = codigo => [...matrizPermisosPorCU[codigo]].sort();
  assert.deepEqual(actores('CU91'), ['gerencia', 'secretaria']);
  assert.deepEqual(actores('CU92'), ['gerencia', 'secretaria']);
  assert.deepEqual(actores('CU93'), ['contador', 'gerencia', 'secretaria']);
  assert.deepEqual(actores('CU94'), ['gerencia']);
  assert.deepEqual(actores('CU95'), ['contador', 'gerencia', 'secretaria']);
  for (let numero = 91; numero <= 95; numero++) assert.equal(moduloPermiso(`CU${numero}`), 'M5');
  assert.equal(codigosTodosLosCU.length, 274);

  const permisosDe = perfil => Object.entries(matrizPermisosPorCU).filter(([, perfiles]) => perfiles.includes(perfil)).map(([codigo]) => codigo);
  const m5 = new Proxy({}, { get: () => async () => ({ ok: true }) });
  const ejecutarComo = async (perfil, operacion) => {
    const permisos = permisosDe(perfil);
    const autorizacion = { autorizar: async op => {
      if (!permisos.includes(operacionesPermiso[op])) throw new Error('No tienes permiso');
      return { id: usuario.usuario_id_usuario, permisos, configuracion: perfil, administrador: false };
    } };
    const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, m5);
    return fachada.ejecutar(operacion, { parametros: { id: 1, ajusteId: 1 }, cuerpo: {}, contexto: {} });
  };
  await ejecutarComo('secretaria', 'prepararAjusteOrdenCompraServicio');
  await assert.rejects(ejecutarComo('secretaria', 'confirmarAjusteOrdenCompraServicio'), /Gerencia/);
  await ejecutarComo('gerencia', 'confirmarAjusteOrdenCompraServicio');
  for (const operacion of ['anularOrdenCompraServicio']) { await ejecutarComo('gerencia', operacion); await ejecutarComo('secretaria', operacion); await assert.rejects(ejecutarComo('contador', operacion), /permiso/); }
  for (const perfil of ['gerencia', 'secretaria', 'contador']) { await ejecutarComo(perfil, 'cerrarOrdenCompraServicio'); await ejecutarComo(perfil, 'listarDocumentosProveedor'); }
  await ejecutarComo('gerencia', 'reabrirOrdenCompraServicio');
  for (const perfil of ['secretaria', 'contador']) await assert.rejects(ejecutarComo(perfil, 'reabrirOrdenCompraServicio'), /permiso/);
});
