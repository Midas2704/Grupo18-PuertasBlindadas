import { PrismaClient } from '@prisma/client';

/** Completes links between actual fixture payments and their cash ledger entries. */
export async function completarTrazabilidadDemo(db: PrismaClient) {
  await db.$transaction(async tx => {
    const moneda = await tx.moneda.findUniqueOrThrow({ where: { codigo_moneda: 'CLP' } });
    async function movimiento(entidad: string, id: number, observacion: string, fecha: Date, monto: number, ingreso: boolean) {
      let fila = await tx.movimiento_financiero.findFirst({ where: { observacion } });
      if (!fila) fila = await tx.movimiento_financiero.create({ data: { id_moneda: moneda.id_moneda, fecha_movimiento: fecha,
        tipo_movimiento_financiero: ingreso ? 'PAGO_CLIENTE' : entidad === 'pago_remuneracion' ? 'PAGO_REMUNERACION' : 'PAGO_PROVEEDOR',
        naturaleza_movimiento: ingreso ? 'ingreso' : 'egreso', motivo_movimiento: `DEMO-UI pago registrado ${entidad}`, monto_movimiento: monto, estado_movimiento: 'registrado', observacion } });
      if (!await tx.origen_movimiento_financiero.findFirst({ where: { id_movimiento_financiero: fila.id_movimiento_financiero, entidad_origen: entidad, id_registro_origen: id } })) await tx.origen_movimiento_financiero.create({ data: {
        id_movimiento_financiero: fila.id_movimiento_financiero, entidad_origen: entidad, id_registro_origen: id, descripcion_origen: 'DEMO-UI origen verificable' } });
    }
    const pagos = await tx.pago_cliente.findMany({ where: { referencia_demostracion: { startsWith: 'DEMO-UI-PAGO-' } } });
    for (const p of pagos) {
      const clave = p.referencia_demostracion!.slice('DEMO-UI-PAGO-'.length);
      await movimiento('pago_cliente',p.id_pago_cliente,`DEMO-UI Movimiento ${clave.includes('-') ? 'venta ' : ''}${clave}`,p.fecha_pago,Number(p.monto_pago),true);
    }
    const documentos = await tx.documento_proveedor_m5.findMany({ where: { folio_normalizado: { startsWith: 'DEMO-UI-DOC-' } } });
    for (const d of documentos) {
      const obligacion = await tx.obligacion_proveedor_m5.findUniqueOrThrow({ where: { id_documento_m5: d.id_documento_m5 } });
      const aplicaciones = await tx.movimiento_pago_proveedor_m5.findMany({ where: { id_obligacion_m5: obligacion.id_obligacion_m5, estado: 'Vigente' } });
      for (const a of aplicaciones) {
        const operacion = await tx.operacion_pago_proveedor_m5.findUniqueOrThrow({ where: { id_operacion_pago_m5: a.id_operacion_pago_m5 } });
        if (operacion.estado !== 'confirmada') continue;
        const clave = d.folio_normalizado.slice('DEMO-UI-DOC-'.length);
        await movimiento('operacion_pago_proveedor_m5',operacion.id_operacion_pago_m5,`DEMO-UI Movimiento proveedor ${clave.includes('-') ? '' : 'base '}${clave}`,operacion.fecha_efectiva_pago!,Number(a.equivalente_clp),false);
      }
      const clave = d.folio_normalizado.slice('DEMO-UI-DOC-'.length);
      const orden = await tx.orden_compra_servicio_m5.findFirst({ where: { referencia: `DEMO-UI-OCS-${clave}` } });
      if (orden && !await tx.asociacion_documento_oc_m5.findFirst({ where: { id_documento_m5: d.id_documento_m5, id_ocs_m5: orden.id_orden_compra_servicio_m5 } })) await tx.asociacion_documento_oc_m5.create({ data: {
        id_documento_m5: d.id_documento_m5, tipo_orden: 'OCS', id_ocs_m5: orden.id_orden_compra_servicio_m5, monto_asignado: d.monto_total,
        estado_diferencia: Number(d.monto_total) === Number(orden.monto_autorizado) ? 'exacta' : 'parcial', es_documento_final: true,
        justificacion: 'DEMO-UI documento final por costo efectivo de suministro', monto_disponible_snapshot: orden.monto_autorizado } });
    }
    for (const p of await tx.pago_remuneracion.findMany({ where: { clave_idempotencia: { startsWith: 'DEMO-UI:PAGO-REM:' }, estado: 'CONFIRMADO' } })) {
      await movimiento('pago_remuneracion',p.id_pago_remuneracion,`DEMO-UI Movimiento remuneracion ${p.clave_idempotencia}`,p.confirmado_en!,Number(p.monto),false);
    }
  }, { timeout: 300000 });
}
