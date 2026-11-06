import { PrismaClient, Prisma } from '@prisma/client';
import { esRutValido } from '../../utilidades/rut';

/** Read-only invariants over DEMO ownership predicates. Never repairs data. */
export async function comprobarIntegridadDemo(db: PrismaClient, corte: Date) {
  const fallos: string[] = [];
  const clientes = await db.cliente.findMany({ where: { cliente_correo: { startsWith: 'demo-ui-cliente', endsWith: '@example.invalid' } } });
  const empleados = await db.empleado.findMany({ where: { correo_particular: { startsWith: 'demo-ui-empleado', endsWith: '@example.invalid' } } });
  if (clientes.some(c => !esRutValido(c.cliente_cliente_rut)) || empleados.some(e => !esRutValido(e.rut_empleado))) fallos.push('RUT DEMO inválido');
  const notas = await db.nota_venta.findMany({ where: { numero_nota_venta: { startsWith: 'DEMO-UI-NV-' } }, include: {
    asignacion_pago_cliente: { include: { pago_cliente: true } }, cotizacion: true,
  } });
  for (const n of notas) {
    const total = Number(n.monto_total), pagado = n.asignacion_pago_cliente.reduce((s, a) => s + Number(a.monto_asignado), 0);
    if (Math.abs(total - Number(n.monto_neto) - Number(n.monto_impuesto)) > .01 || pagado > total + .01) fallos.push(`Montos NV ${n.numero_nota_venta}`);
    if (n.fecha_emision > corte || (n.cotizacion && n.cotizacion.fecha_emision > n.fecha_emision)) fallos.push(`Cronología NV ${n.numero_nota_venta}`);
    if (n.estado_nota_venta !== 'anulada' && n.estado_pago !== (pagado === 0 ? 'pendiente' : Math.abs(total - pagado) < .01 ? 'pagada' : 'parcial')) fallos.push(`Estado pago NV ${n.numero_nota_venta}`);
    for (const a of n.asignacion_pago_cliente) if (a.pago_cliente.fecha_pago < n.fecha_emision || a.pago_cliente.fecha_pago > corte || Number(a.monto_asignado) > Number(a.pago_cliente.monto_pago)) fallos.push(`Asignación NV ${n.numero_nota_venta}`);
  }
  const documentos = await db.documento_proveedor_m5.findMany({ where: { folio_normalizado: { startsWith: 'DEMO-UI-DOC-' } }, select: { id_documento_m5: true } });
  const obligaciones = await db.obligacion_proveedor_m5.findMany({ where: { id_documento_m5: { in: documentos.map(d => d.id_documento_m5) } } });
  for (const o of obligaciones) {
    const aplicaciones = await db.movimiento_pago_proveedor_m5.findMany({ where: { id_obligacion_m5: o.id_obligacion_m5, estado: 'Vigente' } });
    const pagado = aplicaciones.reduce((s, a) => s + Number(a.monto_aplicado), 0);
    if (Math.abs(Number(o.monto_original) - pagado - Number(o.saldo_actual)) > .01 || Number(o.saldo_actual) < 0) fallos.push(`Saldo obligación ${o.id_obligacion_m5}`);
    if (o.estado_pago !== (pagado === 0 ? 'Pendiente' : Number(o.saldo_actual) === 0 ? 'Pagada' : 'Parcial')) fallos.push(`Estado obligación ${o.id_obligacion_m5}`);
  }
  const proveedores = await db.proveedor.findMany({ where: { identificador_tributario: { startsWith: 'DEMO-UI-PROV-' } }, select: { id_proveedor: true } });
  const operaciones = await db.operacion_pago_proveedor_m5.findMany({ where: { id_proveedor: { in: proveedores.map(p => p.id_proveedor) }, estado: 'confirmada' } });
  for (const o of operaciones) {
    const suma = await db.movimiento_pago_proveedor_m5.aggregate({ where: { id_operacion_pago_m5: o.id_operacion_pago_m5, estado: 'Vigente' }, _sum: { equivalente_clp: true } });
    if (Math.abs(Number(o.total_confirmado) - Number(suma._sum.equivalente_clp)) > .01 || (o.fecha_efectiva_pago && o.fecha_efectiva_pago > corte)) fallos.push(`Operación proveedor ${o.id_operacion_pago_m5}`);
  }
  const stock = await db.inventario_bodega.findMany({ where: { material_sku: { startsWith: 'DEMOUI-MAT-' } } });
  for (const fila of stock) {
    const movimientos = await db.movimiento_inventario.findMany({ where: { material_sku: fila.material_sku, lote_id_lote: fila.lote_id_lote, bodega_id_bodega: fila.bodega_id_bodega }, include: { movimiento_inventario_tipo_movimiento: true } });
    const saldo = movimientos.reduce((s, m) => s + Number(m.movimiento_inventario_cantidad) * (m.movimiento_inventario_tipo_movimiento?.movimiento_inventario_tipo_movimiento_nombre?.includes('Salida') ? -1 : 1), 0);
    if (Math.abs(saldo - Number(fila.inventario_bodega_cantidad_fisica)) > .0001 || Number(fila.inventario_bodega_cantidad_reservada) > saldo || saldo < 0) fallos.push(`Stock ${fila.material_sku}/${fila.lote_id_lote}`);
    if (movimientos.some(m => m.movimiento_inventario_fecha_hora && m.movimiento_inventario_fecha_hora > corte)) fallos.push(`Fecha stock ${fila.material_sku}`);
  }
  const remuneraciones = await db.remuneracion.findMany({ where: { componentes: { some: { clave_negocio: { startsWith: 'DEMO-UI:' } } } }, include: { componentes: true, periodo: true, empleado: true } });
  for (const r of remuneraciones) {
    if (Number(r.total_haberes) - Number(r.total_deducciones) !== Number(r.liquido_preliminar) || (r.cerrado_en && r.cerrado_en > corte) || (r.empleado.fecha_ingreso && r.empleado.fecha_ingreso > r.periodo.fecha_fin)) fallos.push(`Remuneración ${r.id_remuneracion}`);
    const sueldo = r.componentes.filter(c => c.tipo === 'SUELDO_BASE').reduce((s, c) => s + Number(c.monto), 0);
    if (Math.abs(sueldo - Number(r.total_haberes)) > .01) fallos.push(`Componentes remuneración ${r.id_remuneracion}`);
    const pagos = await db.pago_remuneracion.aggregate({ where: { origen_tipo: 'REMUNERACION', origen_id: r.id_remuneracion, estado: 'CONFIRMADO' }, _sum: { monto: true } });
    if (Number(pagos._sum.monto) > Number(r.liquido_preliminar)) fallos.push(`Sobrepago remuneración ${r.id_remuneracion}`);
  }
  const compromisos = await db.compromiso_credito_m8.findMany({ where: { condiciones: { startsWith: 'DEMO-UI' } } });
  for (const c of compromisos) {
    const nota = notas.find(n => n.id_nota_venta === c.id_nota_venta);
    const saldo = nota ? Number(nota.monto_total) - nota.asignacion_pago_cliente.reduce((s, a) => s + Number(a.monto_asignado), 0) : -1;
    if (Math.abs(Number(c.monto_pendiente) - saldo) > .01 || saldo < 0 || Number(c.monto_pendiente) > Number(c.monto_original)) fallos.push(`Compromiso M8 ${c.id_nota_venta}`);
  }
  const proveedoresFecha = await db.documento_proveedor_m5.findMany({ where: { folio_normalizado: { startsWith: 'DEMO-UI-DOC-' } } });
  for (const d of proveedoresFecha) if (d.fecha_emision > corte || (d.fecha_confirmacion && d.fecha_confirmacion > corte) || (d.fecha_vencimiento && d.fecha_vencimiento < d.fecha_emision)) fallos.push(`Fecha documento proveedor ${d.folio}`);
  const movimientos = await db.movimiento_financiero.findMany({ where: { observacion: { startsWith: 'DEMO-UI Movimiento ' } }, include: { origen_movimiento_financiero: true } });
  for (const m of movimientos) {
    if (m.fecha_movimiento > corte || m.origen_movimiento_financiero.length !== 1) { fallos.push(`Trazabilidad caja ${m.id_movimiento_financiero}`); continue; }
    const origen = m.origen_movimiento_financiero[0];
    const monto = origen.entidad_origen === 'pago_cliente' ? (await db.pago_cliente.findUnique({ where: { id_pago_cliente: origen.id_registro_origen } }))?.monto_pago
      : origen.entidad_origen === 'pago_remuneracion' ? (await db.pago_remuneracion.findUnique({ where: { id_pago_remuneracion: origen.id_registro_origen } }))?.monto
      : (await db.operacion_pago_proveedor_m5.findUnique({ where: { id_operacion_pago_m5: origen.id_registro_origen } }))?.total_confirmado;
    if (monto === undefined || Math.abs(Number(monto) - Number(m.monto_movimiento)) > .01) fallos.push(`Origen caja ${m.id_movimiento_financiero}`);
  }
  // PostgreSQL checks presence and validation of actual FK/CHECK constraints; no DDL.
  const restricciones = await db.$queryRaw<Array<{ esquema: string; tabla: string; nombre: string }>>(Prisma.sql`
    SELECT n.nspname AS esquema, t.relname AS tabla, c.conname AS nombre
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname IN ('finanzas','terreno','inventario') AND c.contype IN ('f','c') AND NOT c.convalidated`);
  if (restricciones.length) fallos.push(`${restricciones.length} restricciones PostgreSQL sin validar`);
  if (fallos.length) throw new Error(`Integridad DEMO FALLÓ:\n${fallos.join('\n')}`);
  return { estado: 'PASO', notas: notas.length, obligaciones: obligaciones.length, stock: stock.length, remuneraciones: remuneraciones.length, compromisos: compromisos.length };
}
