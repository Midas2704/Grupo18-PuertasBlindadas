const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/db');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { M5Controller, calcularFechaVencimientoProveedor, ocsTieneEfectosFinancieros } = require('../dist/controladores/M5Controller');
const { matrizPermisosPorCU, moduloPermiso, operacionesPermiso, codigosTodosLosCU } = require('../dist/validaciones/permisos');

const modulo = new M5Controller();
const proveedores = [];
const documentos = [];
const pagos = [];
const ordenes = [];
let usuario;
let pais;
let tipoIdentificador;
let moneda;
let tipoDocumento;
let medioPago;
let secuencia = 0;

function dv(cuerpo) {
  let suma = 0; let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) { suma += Number(cuerpo[indice]) * multiplicador; multiplicador = multiplicador === 7 ? 2 : multiplicador + 1; }
  const resultado = 11 - suma % 11;
  return resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado);
}

function identificadorFiscal() {
  secuencia++;
  if (pais.codigo_iso_pais?.toUpperCase() === 'CL' && /\brut\b/i.test(tipoIdentificador.nombre_tipo_identificador)) {
    const cuerpo = String(78000000 + Number(String(Date.now()).slice(-5)) + secuencia);
    return `${cuerpo}-${dv(cuerpo)}`;
  }
  return `M5-P2-${Date.now()}-${secuencia}`;
}

async function preparar() {
  if (usuario) return;
  [usuario, pais, tipoIdentificador, moneda, tipoDocumento, medioPago] = await Promise.all([
    prisma.usuario.findFirstOrThrow({ where: { administrador_original: true } }),
    prisma.pais.findFirstOrThrow({ where: { estado_pais: 'activo' } }),
    prisma.tipo_identificador.findFirstOrThrow({ where: { estado_tipo_identificador: 'activo' } }),
    prisma.moneda.findFirstOrThrow({ where: { codigo_moneda: 'CLP' } }),
    prisma.tipo_documento.findFirstOrThrow({ where: { aplica_compra: true } }),
    prisma.medio_pago.findFirstOrThrow(),
  ]);
}

async function crearProveedor(nombre, estado = 'activo') {
  const proveedor = await prisma.proveedor.create({ data: {
    id_pais: pais.id_pais,
    id_tipo_identificador: tipoIdentificador.id_tipo_identificador,
    identificador_tributario: identificadorFiscal(),
    nombre_razon_social: nombre,
    tipo_proveedor_m5: 'Servicios',
    estado_proveedor: estado,
  } });
  proveedores.push(proveedor.id_proveedor);
  return proveedor;
}

async function crearDocumento(idProveedor, total, fecha, numero) {
  const documento = await prisma.documento_compra_proveedor.create({ data: {
    id_proveedor: idProveedor,
    id_tipo_documento: tipoDocumento.id_tipo_documento,
    id_moneda: moneda.id_moneda,
    numero_documento: numero,
    fecha_emision: fecha,
    fecha_vencimiento: new Date('2027-01-31T00:00:00Z'),
    monto_total: total,
    estado_documento: 'pendiente_pago',
  } });
  documentos.push(documento.id_documento_compra_proveedor);
  return documento;
}

after(async () => {
  if (ordenes.length) {
    await prisma.historial_orden_compra_servicio_m5.deleteMany({ where: { id_ocs_m5: { in: ordenes } } });
    await prisma.orden_compra_servicio_m5.deleteMany({ where: { id_orden_compra_servicio_m5: { in: ordenes } } });
  }
  if (pagos.length) {
    await prisma.asignacion_pago_proveedor.deleteMany({ where: { id_pago_proveedor: { in: pagos } } });
    await prisma.pago_proveedor.deleteMany({ where: { id_pago_proveedor: { in: pagos } } });
  }
  if (documentos.length) await prisma.documento_compra_proveedor.deleteMany({ where: { id_documento_compra_proveedor: { in: documentos } } });
  if (proveedores.length) {
    await prisma.historial_proveedor_m5.deleteMany({ where: { id_proveedor: { in: proveedores } } });
    await prisma.proveedor.deleteMany({ where: { id_proveedor: { in: proveedores } } });
  }
  await prisma.$disconnect();
});

test('CU85 filtra tipos y ordena antecedentes ascendente y descendente', async () => {
  await preparar();
  const proveedor = await crearProveedor('Antecedentes CU85');
  await prisma.historial_proveedor_m5.createMany({ data: [
    { id_proveedor: proveedor.id_proveedor, campo: 'contacto', valor_nuevo: 'Primero', usuario_id_usuario: usuario.usuario_id_usuario, fecha_hora: new Date('2026-01-01T10:00:00Z') },
    { id_proveedor: proveedor.id_proveedor, campo: 'contacto', valor_nuevo: 'Segundo', usuario_id_usuario: usuario.usuario_id_usuario, fecha_hora: new Date('2026-02-01T10:00:00Z') },
  ] });
  await crearDocumento(proveedor.id_proveedor, 100, new Date('2026-03-01T00:00:00Z'), `CU85-${Date.now()}`);
  const ascendente = await modulo.abrirFichaProveedor(proveedor.id_proveedor, { tipoAntecedente: 'historial', direccion: 'asc' });
  const descendente = await modulo.abrirFichaProveedor(proveedor.id_proveedor, { tipoAntecedente: 'historial', direccion: 'desc' });
  assert.equal(ascendente.antecedentes.documentos.length, 0);
  assert.deepEqual(ascendente.historial.map(item => item.valorNuevo), ['Primero', 'Segundo']);
  assert.deepEqual(descendente.historial.map(item => item.valorNuevo), ['Segundo', 'Primero']);
  const documentosFiltrados = await modulo.abrirFichaProveedor(proveedor.id_proveedor, { tipoAntecedente: 'documentos', direccion: 'asc' });
  assert.equal(documentosFiltrados.historial.length, 0);
  assert.equal(documentosFiltrados.antecedentes.documentos.length, 1);
});

test('CU85 y CU86 sólo se exigen al usar sus parámetros específicos', async () => {
  const actor = { id: 1n, permisos: [], configuracion: 'gerencia', administrador: false };
  const m4 = { autorizar: async (_operacion, _contexto, adicionales = []) => { if (adicionales.length) throw new Error(`Faltan ${adicionales.join(',')}`); return actor; } };
  const m5 = { abrirFichaProveedor: async () => ({ ok: true }), listarProveedores: async () => [] };
  const fachada = new C_Finanzas(undefined, {}, {}, {}, m4, m5);
  await fachada.ejecutar('abrirFichaProveedor', { parametros: { id: 1 }, consulta: {}, contexto: {} });
  await assert.rejects(fachada.ejecutar('abrirFichaProveedor', { parametros: { id: 1 }, consulta: { tipoAntecedente: 'pagos' }, contexto: {} }), /CU85/);
  await fachada.ejecutar('listarProveedores', { consulta: {}, contexto: {} });
  await assert.rejects(fachada.ejecutar('listarProveedores', { consulta: { ordenar: 'razonSocial' }, contexto: {} }), /CU86/);
});

test('CU86 ordena estable por razón social, identificador y saldo combinando filtros vigentes', async () => {
  await preparar();
  const zeta = await crearProveedor('Orden CU86 Zeta');
  const alfa = await crearProveedor('Orden CU86 Alfa');
  await crearDocumento(zeta.id_proveedor, 300, new Date('2026-04-01T00:00:00Z'), `CU86-Z-${Date.now()}`);
  await crearDocumento(alfa.id_proveedor, 100, new Date('2026-04-02T00:00:00Z'), `CU86-A-${Date.now()}`);
  const consulta = { busqueda: 'Orden CU86', estado: 'activo', situacion: 'por pagar' };
  const asc = await modulo.listarProveedores({ ...consulta, ordenar: 'razonSocial', direccion: 'asc' });
  const desc = await modulo.listarProveedores({ ...consulta, ordenar: 'razonSocial', direccion: 'desc' });
  assert.deepEqual(asc.map(item => item.razonSocial), ['Orden CU86 Alfa', 'Orden CU86 Zeta']);
  assert.deepEqual(desc.map(item => item.razonSocial), ['Orden CU86 Zeta', 'Orden CU86 Alfa']);
  const porSaldo = await modulo.listarProveedores({ ...consulta, ordenar: 'saldoPendiente', direccion: 'asc' });
  assert.deepEqual(porSaldo.map(item => item.saldoPendienteTotal), [100, 300]);
  const porIdentificador = await modulo.listarProveedores({ ...consulta, ordenar: 'identificador', direccion: 'asc' });
  assert.equal(porIdentificador.length, 2);
  assert.ok(porIdentificador[0].identificadorFiscal.localeCompare(porIdentificador[1].identificadorFiscal, 'es-CL', { numeric: true }) <= 0);
  assert.deepEqual((await prisma.proveedor.findMany({ where: { id_proveedor: { in: [zeta.id_proveedor, alfa.id_proveedor] } }, orderBy: { id_proveedor: 'asc' } })).map(item => item.nombre_razon_social), ['Orden CU86 Zeta', 'Orden CU86 Alfa']);
});

test('CU87 guarda política estructurada, traza old/new y no altera documentos históricos', async () => {
  await preparar();
  const proveedor = await crearProveedor('Condición CU87');
  const documento = await crearDocumento(proveedor.id_proveedor, 900, new Date('2026-05-01T00:00:00Z'), `CU87-${Date.now()}`);
  const vencimientoOriginal = documento.fecha_vencimiento.toISOString();
  const primera = await modulo.actualizarCondicionPagoProveedor(proveedor.id_proveedor, { dias: 0, tipoComputo: 'DIAS_CORRIDOS' }, usuario.usuario_id_usuario);
  assert.equal(primera.condicionPago.dias, 0);
  await modulo.actualizarCondicionPagoProveedor(proveedor.id_proveedor, { dias: 1, tipoComputo: 'DIAS_HABILES' }, usuario.usuario_id_usuario);
  await assert.rejects(modulo.actualizarCondicionPagoProveedor(proveedor.id_proveedor, { dias: -1, tipoComputo: 'DIAS_CORRIDOS' }, usuario.usuario_id_usuario), /entero/);
  await assert.rejects(modulo.actualizarCondicionPagoProveedor(proveedor.id_proveedor, { dias: 1.5, tipoComputo: 'DIAS_CORRIDOS' }, usuario.usuario_id_usuario), /entero/);
  const trazas = await prisma.historial_proveedor_m5.findMany({ where: { id_proveedor: proveedor.id_proveedor, campo: 'condicion_pago' }, orderBy: { fecha_hora: 'asc' } });
  assert.equal(trazas.length, 2);
  assert.deepEqual(JSON.parse(trazas[1].valor_anterior), { dias: 0, tipoComputo: 'DIAS_CORRIDOS' });
  assert.deepEqual(JSON.parse(trazas[1].valor_nuevo), { dias: 1, tipoComputo: 'DIAS_HABILES' });
  assert.equal((await prisma.documento_compra_proveedor.findUniqueOrThrow({ where: { id_documento_compra_proveedor: documento.id_documento_compra_proveedor } })).fecha_vencimiento.toISOString(), vencimientoOriginal);
  assert.equal(calcularFechaVencimientoProveedor(new Date('2026-09-17T00:00:00Z'), 1, 'DIAS_CORRIDOS').toISOString().slice(0, 10), '2026-09-18');
  assert.equal(calcularFechaVencimientoProveedor(new Date('2026-09-17T00:00:00Z'), 1, 'DIAS_HABILES').toISOString().slice(0, 10), '2026-09-21');
});

test('CU88-CU90 crean, consultan y modifican OCS abierta sin alterar campos inmutables', async () => {
  await preparar();
  const activo = await crearProveedor('Servicios OCS Activo');
  const otroActivo = await crearProveedor('Servicios OCS Alternativo');
  const inactivo = await crearProveedor('Servicios OCS Inactivo', 'inactivo');
  const bloqueado = await crearProveedor('Servicios OCS Bloqueado', 'bloqueado');
  await assert.rejects(modulo.crearOrdenCompraServicio({ idProveedor: activo.id_proveedor, montoAutorizado: 0 }, usuario.usuario_id_usuario), /mayor que cero/);
  await assert.rejects(modulo.crearOrdenCompraServicio({ idProveedor: inactivo.id_proveedor, montoAutorizado: 100 }, usuario.usuario_id_usuario), error => error.estado === 409);
  await assert.rejects(modulo.crearOrdenCompraServicio({ idProveedor: bloqueado.id_proveedor, montoAutorizado: 100 }, usuario.usuario_id_usuario), error => error.estado === 409);
  const creada = await modulo.crearOrdenCompraServicio({ idProveedor: activo.id_proveedor, montoAutorizado: 125000, referencia: 'Prueba CU89', periodo: '2026-09' }, usuario.usuario_id_usuario);
  ordenes.push(creada.id);
  assert.equal(creada.estado, 'abierta');
  assert.equal(creada.montoDocumentado, 0);
  assert.equal(creada.saldoDisponible, 125000);
  assert.equal(await prisma.$transaction(tx => ocsTieneEfectosFinancieros(tx, creada.id)), false);
  const listado = await modulo.listarOrdenesCompraServicios();
  assert.ok(listado.some(item => item.id === creada.id));
  const detalle = await modulo.obtenerOrdenCompraServicio(creada.id);
  const inmutables = { id: detalle.id, creador: detalle.creadoPor.id, fecha: new Date(detalle.fechaCreacion).toISOString() };
  const modificada = await modulo.modificarOrdenCompraServicio(creada.id, { idProveedor: otroActivo.id_proveedor, montoAutorizado: 150000, descripcion: 'Descripción modificada' }, usuario.usuario_id_usuario);
  assert.equal(modificada.proveedor.id, otroActivo.id_proveedor);
  assert.equal(modificada.montoAutorizado, 150000);
  assert.equal(modificada.id, inmutables.id);
  assert.equal(modificada.creadoPor.id, inmutables.creador);
  assert.equal(new Date(modificada.fechaCreacion).toISOString(), inmutables.fecha);
  assert.ok(modificada.historial.some(item => item.campo === 'monto_autorizado'));
  assert.ok(modificada.historial.some(item => item.campo === 'proveedor'));
  await assert.rejects(modulo.modificarOrdenCompraServicio(creada.id, { estado: 'cerrada' }, usuario.usuario_id_usuario), /No puede modificarse/);
});

test('permisos CU85-CU90 respetan actores, operaciones y módulo M5', () => {
  const actores = codigo => [...matrizPermisosPorCU[codigo]].sort();
  for (const codigo of ['CU85', 'CU86', 'CU88']) assert.deepEqual(actores(codigo), ['contador', 'gerencia', 'secretaria']);
  assert.deepEqual(actores('CU87'), ['contador', 'gerencia']);
  for (const codigo of ['CU89', 'CU90']) assert.deepEqual(actores(codigo), ['gerencia', 'secretaria']);
  for (let numero = 85; numero <= 90; numero++) assert.equal(moduloPermiso(`CU${numero}`), 'M5');
  assert.equal(codigosTodosLosCU.length, 274);
  assert.equal(operacionesPermiso.actualizarCondicionPagoProveedor, 'CU87');
  assert.equal(operacionesPermiso.listarOrdenesCompraServicios, 'CU88');
  assert.equal(operacionesPermiso.crearOrdenCompraServicio, 'CU89');
  assert.equal(operacionesPermiso.modificarOrdenCompraServicio, 'CU90');
});

test('fachada aplica actores CU87-CU90 sin trasladar autorización al controlador', async () => {
  const permisosDe = perfil => Object.entries(matrizPermisosPorCU).filter(([, actores]) => actores.includes(perfil)).map(([codigo]) => codigo);
  const m5 = {
    actualizarCondicionPagoProveedor: async () => ({ ok: true }),
    listarOrdenesCompraServicios: async () => [],
    crearOrdenCompraServicio: async () => ({ ok: true }),
    modificarOrdenCompraServicio: async () => ({ ok: true }),
  };
  const ejecutarComo = async (perfil, operacion) => {
    const permisos = permisosDe(perfil);
    const autorizacion = { autorizar: async op => {
      if (!permisos.includes(operacionesPermiso[op])) throw new Error('No tienes permiso');
      return { id: usuario.usuario_id_usuario, permisos, configuracion: perfil, administrador: false };
    } };
    const fachada = new C_Finanzas(autorizacion, {}, {}, {}, {}, m5);
    return fachada.ejecutar(operacion, { parametros: { id: 1 }, cuerpo: {}, contexto: {} });
  };
  for (const perfil of ['gerencia', 'contador']) await ejecutarComo(perfil, 'actualizarCondicionPagoProveedor');
  await assert.rejects(ejecutarComo('secretaria', 'actualizarCondicionPagoProveedor'), /permiso/);
  for (const perfil of ['gerencia', 'secretaria', 'contador']) await ejecutarComo(perfil, 'listarOrdenesCompraServicios');
  for (const operacion of ['crearOrdenCompraServicio', 'modificarOrdenCompraServicio']) {
    for (const perfil of ['gerencia', 'secretaria']) await ejecutarComo(perfil, operacion);
    await assert.rejects(ejecutarComo('contador', operacion), /permiso/);
  }
});
