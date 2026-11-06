const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../dist/db');
const { M5Controller, calcularSaldoObligacion } = require('../dist/controladores/M5Controller');
const { C_Finanzas } = require('../dist/controladores/C_Finanzas');
const { matrizPermisosPorCU, codigosTodosLosCU } = require('../dist/validaciones/permisos');

test('M5 P8 CU127-CU131 gestiona respaldos, ajustes y saldos a favor', async t => {
  const modulo = new M5Controller({ obtenerTipoCambio: async () => 900 });
  const ids = { proveedores: [], documentos: [], obligaciones: [], operaciones: [], medios: [], ocs: [] };
  let usuario, pais, tipoId, tipoDoc, moneda, usd, medio;
  const folio = prefijo => `${prefijo}-${randomUUID()}`;
  const evidencia = nombre => ({ motivo: 'Rectificación documental verificada', nombreArchivo: nombre, contenido: 'data:application/pdf;base64,UERG' });
  try {
    [usuario, pais, tipoId, tipoDoc, moneda, usd] = await Promise.all([
      prisma.usuario.findFirstOrThrow({ where: { administrador_original: true } }),
      prisma.pais.findFirstOrThrow({ where: { estado_pais: 'activo' } }),
      prisma.tipo_identificador.findFirstOrThrow({ where: { estado_tipo_identificador: 'activo' } }),
      prisma.tipo_documento.findFirstOrThrow({ where: { aplica_compra: true } }),
      prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } }),
      prisma.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'USD' } }),
    ]);
    medio = await prisma.medio_pago.findFirst({ where: { estado_medio_pago: 'activo' } });
    if (!medio) { medio = await prisma.medio_pago.create({ data: { nombre_medio_pago: folio('P8'), estado_medio_pago: 'activo' } }); ids.medios.push(medio.id_medio_pago); }
    const proveedor = await prisma.proveedor.create({ data: { id_pais: pais.id_pais, id_tipo_identificador: tipoId.id_tipo_identificador, identificador_tributario: folio('P8-ID'), nombre_razon_social: folio('Proveedor P8'), tipo_proveedor_m5: 'Servicios', estado_proveedor: 'activo' } });
    ids.proveedores.push(proveedor.id_proveedor);
    const crearObligacion = async (monto, divisa = moneda) => {
      const documento = await prisma.documento_proveedor_m5.create({ data: { id_proveedor: proveedor.id_proveedor, clase: 'definitivo', id_tipo_documento: tipoDoc.id_tipo_documento, folio: folio('FAC'), folio_normalizado: folio('FAC-N'), fecha_emision: new Date('2026-09-01T00:00:00Z'), id_moneda: divisa.id_moneda, monto_total: monto, estado: 'confirmado', creado_por: usuario.usuario_id_usuario } });
      ids.documentos.push(documento.id_documento_m5);
      const obligacion = await prisma.obligacion_proveedor_m5.create({ data: { id_documento_m5: documento.id_documento_m5, id_proveedor: proveedor.id_proveedor, monto_original: monto, id_moneda: divisa.id_moneda, saldo_inicial: monto, saldo_actual: monto, fecha_emision: documento.fecha_emision, fecha_vencimiento: new Date('2026-09-10T00:00:00Z'), estado_pago: 'Pendiente', condicion_temporal: 'Vencida', generado_por: usuario.usuario_id_usuario } });
      ids.obligaciones.push(obligacion.id_obligacion_m5);
      return obligacion;
    };

    const deudaPago = await crearObligacion(40);
    let pago = await modulo.crearOperacionPago({ idProveedor: proveedor.id_proveedor, fechaEfectivaPago: '2026-09-20' }, usuario.usuario_id_usuario); ids.operaciones.push(pago.id);
    pago = await modulo.agregarMovimientoPago(pago.id, { idObligacion: deudaPago.id_obligacion_m5, idMedioPago: medio.id_medio_pago, montoAplicado: 40 });
    pago = await modulo.adjuntarRespaldoPago(pago.id, { nombreArchivo: 'original.pdf', contenido: 'data:application/pdf;base64,UERG', operacion: true, movimientos: pago.movimientos.map(item => item.id) }, usuario.usuario_id_usuario);
    await modulo.prepararOperacionPago(pago.id, usuario.usuario_id_usuario); pago = await modulo.confirmarOperacionPago(pago.id, usuario.usuario_id_usuario);

    await t.test('CU127 conserva respaldo histórico y registra motivo, actor y fecha', async () => {
      const anterior = pago.respaldos[0];
      const saldoAntes = (await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deudaPago.id_obligacion_m5 } })).saldo_actual.toNumber();
      await prisma.proveedor.update({ where: { id_proveedor: proveedor.id_proveedor }, data: { estado_proveedor: 'inactivo' } });
      await assert.rejects(modulo.reemplazarRespaldoPago(pago.id, anterior.id, { nombreArchivo: 'sin-motivo.pdf', contenido: 'data:application/pdf;base64,UERG' }, usuario.usuario_id_usuario), error => error.estado === 400);
      pago = await modulo.reemplazarRespaldoPago(pago.id, anterior.id, evidencia('reemplazo.pdf'), usuario.usuario_id_usuario);
      assert.equal(pago.historialRespaldos.length, 1);
      assert.equal(pago.historialRespaldos[0].anterior.id, anterior.id);
      assert.equal(pago.historialRespaldos[0].nuevo.nombre, 'reemplazo.pdf');
      assert.ok(pago.respaldos.some(item => item.id === anterior.id));
      assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deudaPago.id_obligacion_m5 } })).saldo_actual.toNumber(), saldoAntes);
      assert.equal(pago.movimientos[0].conciliacion.estado, 'pendiente');
      await prisma.proveedor.update({ where: { id_proveedor: proveedor.id_proveedor }, data: { estado_proveedor: 'activo' } });
    });

    const deuda = await crearObligacion(100);
    let nc, nd;
    await t.test('CU128 aplica NC hasta la deuda y separa el excedente como saldo a favor', async () => {
      const numero = folio('NC');
      nc = await modulo.registrarNotaCredito({ idObligacion: deuda.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: numero, fechaEmision: '2026-09-20', monto: 120 }, usuario.usuario_id_usuario);
      ids.documentos.push((await prisma.ajuste_obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_ajuste_obligacion_m5: nc.id } })).id_documento_ajuste_m5);
      assert.equal(nc.montoAplicado, 100); assert.equal(nc.montoSaldoFavor, 20); assert.equal(nc.saldoFavor.disponible, 20);
      assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deuda.id_obligacion_m5 } })).saldo_actual.toNumber(), 0);
      assert.equal((await modulo.listarCuentasPorPagar({ proveedor: proveedor.id_proveedor })).find(item => item.id === deuda.id_obligacion_m5).saldoActual, 0);
      assert.equal(await prisma.obligacion_proveedor_m5.count({ where: { id_proveedor: proveedor.id_proveedor } }), 2);
      await assert.rejects(modulo.registrarNotaCredito({ idObligacion: deuda.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: folio('NC-CERO'), fechaEmision: '2026-09-20', monto: 0 }, usuario.usuario_id_usuario), error => error.estado === 400);
      await assert.rejects(modulo.registrarNotaCredito({ idObligacion: deuda.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: numero, fechaEmision: '2026-09-20', monto: 1 }, usuario.usuario_id_usuario), error => error.estado === 409);
      await prisma.proveedor.update({ where: { id_proveedor: proveedor.id_proveedor }, data: { estado_proveedor: 'inactivo' } });
      await assert.rejects(modulo.registrarNotaCredito({ idObligacion: deuda.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: folio('NC-INACTIVA'), fechaEmision: '2026-09-20', monto: 1 }, usuario.usuario_id_usuario), error => error.estado === 409);
      await prisma.proveedor.update({ where: { id_proveedor: proveedor.id_proveedor }, data: { estado_proveedor: 'activo' } });
    });

    await t.test('CU129 ND aumenta la deuda y usa la fórmula única', async () => {
      nd = await modulo.registrarNotaDebito({ idObligacion: deuda.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: folio('ND'), fechaEmision: '2026-09-20', monto: 50 }, usuario.usuario_id_usuario);
      ids.documentos.push((await prisma.ajuste_obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_ajuste_obligacion_m5: nd.id } })).id_documento_ajuste_m5);
      assert.equal(nd.estado, 'confirmado');
      assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deuda.id_obligacion_m5 } })).saldo_actual.toNumber(), 50);
      assert.equal((await modulo.listarCuentasPorPagar({ proveedor: proveedor.id_proveedor })).find(item => item.id === deuda.id_obligacion_m5).saldoActual, 50);
      assert.equal((await modulo.listarProveedores({ estado: 'todos' })).find(item => item.idProveedor === proveedor.id_proveedor).situacionFinanciera, 'Vencida');
      assert.equal((await prisma.saldo_favor_proveedor_m5.findUniqueOrThrow({ where: { id_saldo_favor_m5: nc.saldoFavor.id } })).monto_disponible.toNumber(), 20);
      assert.equal(calcularSaldoObligacion(100, [], [{ tipo: 'NC', monto: 100 }, { tipo: 'ND', monto: 50 }]).toNumber(), 50);
      assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deuda.id_obligacion_m5 } })).monto_original.toNumber(), 100);
    });

    await t.test('CU129 reutiliza CU99-CU100 y no aplica un excedente OCS pendiente', async () => {
      const deudaExceso = await crearObligacion(100);
      const ocs = await prisma.orden_compra_servicio_m5.create({ data: { id_proveedor: proveedor.id_proveedor, id_moneda: moneda.id_moneda, monto_autorizado: 100, monto_autorizado_original: 100, estado_ocs: 'cerrada', creado_por: usuario.usuario_id_usuario } }); ids.ocs.push(ocs.id_orden_compra_servicio_m5);
      await prisma.asociacion_documento_oc_m5.create({ data: { id_documento_m5: deudaExceso.id_documento_m5, tipo_orden: 'OCS', id_ocs_m5: ocs.id_orden_compra_servicio_m5, monto_asignado: 100, monto_disponible_snapshot: 100, estado_diferencia: 'exacta', estado_excedente: 'no_aplica' } });
      await prisma.efecto_financiero_ocs_m5.create({ data: { id_ocs_m5: ocs.id_orden_compra_servicio_m5, tipo_efecto: 'documento_definitivo', referencia: folio('EFECTO'), monto_documentado: 100 } });
      const pendiente = await modulo.registrarNotaDebito({ idObligacion: deudaExceso.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: folio('ND-EXC'), fechaEmision: '2026-09-20', monto: 20, justificacion: 'Aumento contractual documentado' }, usuario.usuario_id_usuario);
      const registro = await prisma.ajuste_obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_ajuste_obligacion_m5: pendiente.id } }); ids.documentos.push(registro.id_documento_ajuste_m5);
      assert.equal(pendiente.estado, 'pendiente_excedente'); assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deudaExceso.id_obligacion_m5 } })).saldo_actual.toNumber(), 100);
      const asociacion = await prisma.asociacion_documento_oc_m5.findFirstOrThrow({ where: { id_documento_m5: registro.id_documento_ajuste_m5, estado_excedente: 'pendiente' } });
      await assert.rejects(modulo.resolverExcedenteDocumento(registro.id_documento_ajuste_m5, asociacion.id_asociacion_m5, { aprobar: true }, usuario.usuario_id_usuario, 'contador'), error => error.estado === 403);
      await modulo.resolverExcedenteDocumento(registro.id_documento_ajuste_m5, asociacion.id_asociacion_m5, { aprobar: true }, usuario.usuario_id_usuario, 'gerencia');
      assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deudaExceso.id_obligacion_m5 } })).saldo_actual.toNumber(), 120);
    });

    await t.test('CU130 anula ND y NC sin borrar trazabilidad ni crear crédito impropio', async () => {
      nd = await modulo.anularAjusteObligacion(nd.id, evidencia('anula-nd.pdf'), usuario.usuario_id_usuario);
      assert.equal(nd.estado, 'anulado'); assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deuda.id_obligacion_m5 } })).saldo_actual.toNumber(), 0);
      nc = await modulo.anularAjusteObligacion(nc.id, evidencia('anula-nc.pdf'), usuario.usuario_id_usuario);
      assert.equal(nc.estado, 'anulado'); assert.equal(nc.saldoFavor.estado, 'anulado');
      assert.equal((await prisma.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_obligacion_m5: deuda.id_obligacion_m5 } })).saldo_actual.toNumber(), 100);
      assert.ok(await prisma.documento_proveedor_m5.findUnique({ where: { id_documento_m5: (await prisma.ajuste_obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_ajuste_obligacion_m5: nc.id } })).id_documento_ajuste_m5 } }));
      await assert.rejects(modulo.anularAjusteObligacion(nc.id, evidencia('doble.pdf'), usuario.usuario_id_usuario), error => error.estado === 409);
      await assert.rejects(modulo.anularAjusteObligacion(nd.id, { nombreArchivo: 'sin-motivo.pdf', contenido: 'data:application/pdf;base64,UERG' }, usuario.usuario_id_usuario), error => error.estado === 400);
    });

    await t.test('CU131 consulta por moneda sin consumir saldo y admite proveedor inactivo', async () => {
      const deudaClp = await crearObligacion(10);
      const deudaUsd = await crearObligacion(10, usd);
      const creditoClp = await modulo.registrarNotaCredito({ idObligacion: deudaClp.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: moneda.id_moneda, folio: folio('NC-CLP'), fechaEmision: '2026-09-20', monto: 15 }, usuario.usuario_id_usuario);
      const creditoUsd = await modulo.registrarNotaCredito({ idObligacion: deudaUsd.id_obligacion_m5, idTipoDocumento: tipoDoc.id_tipo_documento, idMoneda: usd.id_moneda, folio: folio('NC-USD'), fechaEmision: '2026-09-20', monto: 17 }, usuario.usuario_id_usuario);
      for (const credito of [creditoClp, creditoUsd]) ids.documentos.push((await prisma.ajuste_obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_ajuste_obligacion_m5: credito.id } })).id_documento_ajuste_m5);
      await prisma.proveedor.update({ where: { id_proveedor: proveedor.id_proveedor }, data: { estado_proveedor: 'inactivo' } });
      const consulta = await modulo.consultarSaldosFavorProveedor(proveedor.id_proveedor);
      assert.equal(consulta.proveedor.estado, 'inactivo'); assert.equal(consulta.saldos.length, 3);
      assert.deepEqual(consulta.totalesPorMoneda.sort((a, b) => a.moneda.localeCompare(b.moneda)), [{ moneda: 'CLP', montoDisponible: 5 }, { moneda: 'USD', montoDisponible: 7 }]);
      assert.ok(consulta.saldos.every(item => item.origen === 'Nota de Crédito'));
      assert.equal((await prisma.saldo_favor_proveedor_m5.findUniqueOrThrow({ where: { id_saldo_favor_m5: creditoUsd.saldoFavor.id } })).monto_disponible.toNumber(), 7);
    });

    await t.test('permisos llegan a CU131 y Secretaría no ejecuta CU127/CU130', async () => {
      assert.equal(codigosTodosLosCU.length, 274);
      for (const cu of ['CU127', 'CU130']) assert.deepEqual([...matrizPermisosPorCU[cu]].sort(), ['contador', 'gerencia']);
      for (const cu of ['CU128', 'CU129', 'CU131']) assert.deepEqual([...matrizPermisosPorCU[cu]].sort(), ['contador', 'gerencia', 'secretaria']);
      let llamada = false;
      const fachada = new C_Finanzas({ autorizar: async () => ({ id: usuario.usuario_id_usuario, sesion: 'x', permisos: ['CU127'], configuracion: 'secretaria', administrador: false, cambiarClave: false, nombre: 'S', acceso: 's' }) }, {}, {}, {}, {}, { reemplazarRespaldoPago: async () => { llamada = true; } });
      await assert.rejects(fachada.ejecutar('reemplazarRespaldoPago', { parametros: { id: '1', respaldoId: '1' }, cuerpo: {}, contexto: {} }), error => error.estado === 403);
      assert.equal(llamada, false);
    });
  } finally {
    const ajustes = await prisma.ajuste_obligacion_proveedor_m5.findMany({ where: { id_proveedor: { in: ids.proveedores } } });
    const operaciones = ids.operaciones;
    const movimientos = await prisma.movimiento_pago_proveedor_m5.findMany({ where: { id_operacion_pago_m5: { in: operaciones } } });
    const movIds = movimientos.map(item => item.id_movimiento_pago_m5);
    const asociaciones = await prisma.asociacion_respaldo_pago_m5.findMany({ where: { OR: [{ id_operacion_pago_m5: { in: operaciones } }, { id_movimiento_pago_m5: { in: movIds } }] } });
    const historial = await prisma.historial_respaldo_pago_m5.findMany({ where: { id_operacion_pago_m5: { in: operaciones } } });
    const respaldos = [...new Set([...asociaciones.map(item => item.id_respaldo_pago_m5), ...historial.flatMap(item => [item.id_respaldo_anterior, item.id_respaldo_nuevo]), ...ajustes.map(item => item.id_respaldo_anulacion).filter(Boolean)])];
    await prisma.historial_respaldo_pago_m5.deleteMany({ where: { id_operacion_pago_m5: { in: operaciones } } });
    await prisma.asociacion_respaldo_pago_m5.deleteMany({ where: { id_asociacion_respaldo_m5: { in: asociaciones.map(item => item.id_asociacion_respaldo_m5) } } });
    await prisma.movimiento_pago_proveedor_m5.deleteMany({ where: { id_operacion_pago_m5: { in: operaciones } } });
    await prisma.operacion_pago_proveedor_m5.deleteMany({ where: { id_operacion_pago_m5: { in: operaciones } } });
    await prisma.saldo_favor_proveedor_m5.deleteMany({ where: { id_proveedor: { in: ids.proveedores } } });
    await prisma.ajuste_obligacion_proveedor_m5.deleteMany({ where: { id_proveedor: { in: ids.proveedores } } });
    await prisma.efecto_financiero_ocs_m5.deleteMany({ where: { id_ocs_m5: { in: ids.ocs } } });
    await prisma.respaldo_pago_proveedor_m5.deleteMany({ where: { id_respaldo_pago_m5: { in: respaldos } } });
    await prisma.obligacion_proveedor_m5.deleteMany({ where: { id_obligacion_m5: { in: ids.obligaciones } } });
    await prisma.asociacion_documento_oc_m5.deleteMany({ where: { id_documento_m5: { in: ids.documentos } } });
    await prisma.documento_proveedor_m5.deleteMany({ where: { id_documento_m5: { in: ids.documentos } } });
    await prisma.orden_compra_servicio_m5.deleteMany({ where: { id_orden_compra_servicio_m5: { in: ids.ocs } } });
    await prisma.historial_proveedor_m5.deleteMany({ where: { id_proveedor: { in: ids.proveedores } } });
    await prisma.proveedor.deleteMany({ where: { id_proveedor: { in: ids.proveedores } } });
    await prisma.medio_pago.deleteMany({ where: { id_medio_pago: { in: ids.medios } } });
    await prisma.$disconnect();
  }
});
