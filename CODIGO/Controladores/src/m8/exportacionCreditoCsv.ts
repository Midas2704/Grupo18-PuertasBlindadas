import { archivoCsvAdministrativo, ColumnaCsv, fechaCsv, humanizarCsv } from '../utilidades/csv';

type Registro = Record<string, any>;
const siNo = (valor: unknown) => valor ? 'Sí' : 'No';
const estadoCredito = (fila: Registro) => !fila.habilitado ? 'No habilitado' : fila.suspension?.suspendido ? 'Suspendido' : 'Activo';

const columnasSolicitudes: ColumnaCsv<Registro>[] = [
  { encabezado: 'Solicitud', valor: fila => fila.id ? `#${fila.id}` : '' },
  { encabezado: 'Tipo', valor: fila => humanizarCsv(fila.tipo) },
  { encabezado: 'Estado', valor: fila => humanizarCsv(fila.estado) },
  { encabezado: 'Fecha de creación', valor: fila => fechaCsv(fila.fechaCreacion, true) },
  { encabezado: 'Última actualización', valor: fila => fechaCsv(fila.fechaActualizacion, true) },
  { encabezado: 'Cliente', valor: fila => fila.cliente?.nombre },
  { encabezado: 'RUT', valor: fila => fila.cliente?.rut },
  { encabezado: 'Clasificación', valor: fila => fila.cliente?.clasificacion },
  { encabezado: 'Solicitante', valor: fila => fila.solicitante?.nombre || 'Sistema' },
  { encabezado: 'Motivo', valor: fila => fila.motivo },
  { encabezado: 'Condiciones solicitadas', valor: fila => fila.condicionesSolicitadas },
  { encabezado: 'Antecedentes', valor: fila => fila.antecedentes },
  { encabezado: 'Referencia comercial', valor: fila => fila.contextoComercial?.notaVenta?.numero || fila.contextoComercial?.referencia || (fila.contextoComercial?.cotizacion?.id ? `Cotización #${fila.contextoComercial.cotizacion.id}` : '') },
  { encabezado: 'Monto comercial', valor: fila => fila.contextoComercial?.notaVenta?.monto ?? fila.contextoComercial?.cotizacion?.monto ?? '' },
  { encabezado: 'Moneda comercial', valor: fila => fila.contextoComercial?.notaVenta?.moneda || fila.contextoComercial?.cotizacion?.moneda || '' },
  { encabezado: 'Decisión', valor: fila => humanizarCsv(fila.resolucion?.decision) },
  { encabezado: 'Fecha de resolución', valor: fila => fechaCsv(fila.resolucion?.fecha, true) },
];

const columnasCliente: ColumnaCsv<Registro>[] = [
  { encabezado: 'Cliente', valor: fila => fila.cliente?.nombre }, { encabezado: 'RUT', valor: fila => fila.cliente?.rut },
  { encabezado: 'Estado de crédito', valor: estadoCredito }, { encabezado: 'Cupo autorizado CLP', valor: fila => fila.cupo },
  { encabezado: 'Exposición utilizada CLP', valor: fila => fila.utilizado }, { encabezado: 'Capacidad disponible CLP', valor: fila => fila.disponible },
  { encabezado: 'Vigencia desde', valor: fila => fechaCsv(fila.vigencia?.desde) }, { encabezado: 'Vigencia hasta', valor: fila => fechaCsv(fila.vigencia?.hasta) },
  { encabezado: 'Sobre cupo', valor: fila => siNo(fila.sobreCupo) }, { encabezado: 'Estado de morosidad', valor: fila => humanizarCsv(fila.morosidad?.estado) },
  { encabezado: 'Obligaciones morosas', valor: fila => fila.morosidad?.cantidad ?? 0 },
];

const columnasCredito: ColumnaCsv<Registro>[] = [
  { encabezado: 'Estado de la fuente', valor: fila => humanizarCsv(fila.estado) },
  { encabezado: 'Límite global CLP', valor: fila => fila.limiteGlobal },
  { encabezado: 'Exposición utilizada CLP', valor: fila => fila.exposicionUtilizada },
  { encabezado: 'Capacidad disponible CLP', valor: fila => fila.capacidadDisponible },
  { encabezado: 'Total de cupos autorizados CLP', valor: fila => fila.cupoTotalAgregado },
  { encabezado: 'Cupo utilizado CLP', valor: fila => fila.cupoUtilizadoAgregado },
  { encabezado: 'Cupo disponible CLP', valor: fila => fila.cupoDisponibleAgregado },
  { encabezado: 'Aviso de capacidad', valor: fila => humanizarCsv(fila.avisoCapacidadProxima) },
];

export const archivoCreditoM8Csv = (origen: string, filas: Registro[]) => {
  // MIDAS: la exportación presenta decisiones de M8; no vuelve a calcular cupos ni exposición.
  const columnas = origen === 'solicitudes' ? columnasSolicitudes : origen === 'cliente' ? columnasCliente : columnasCredito;
  return archivoCsvAdministrativo(`credito-${origen}.csv`, filas, columnas);
};
