import { archivoCsvAdministrativo } from '../utilidades/csv';
import { ejecutorInformeM9, EventoPresentadoM9, fechaInformeM9, humanizarM9, referenciaInformeM9 } from './informeAuditoriaPdf';

// MIDAS: exportamos el conjunto ya autorizado; este helper no amplía el alcance de Auditoría.
export const archivoAuditoriaM9Csv = (eventos: EventoPresentadoM9[]) => archivoCsvAdministrativo('auditoria-m9.csv', eventos, [
  { encabezado: 'Fecha y hora', valor: evento => fechaInformeM9(evento.ocurrencia) },
  { encabezado: 'Módulo', valor: evento => humanizarM9(evento.modulo) },
  { encabezado: 'Operación', valor: evento => humanizarM9(evento.operacion) },
  { encabezado: 'Resultado', valor: evento => humanizarM9(evento.resultado) },
  { encabezado: 'Referencia', valor: evento => referenciaInformeM9(evento) },
  { encabezado: 'Ejecutor', valor: evento => ejecutorInformeM9(evento) },
]);
