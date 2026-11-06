import { archivoPdfInforme, InformePdf, TonoInformePdf } from '../utilidades/pdf';
import { FiltrosM9, ScopeM9 } from './tipos';

export type EventoPresentadoM9 = {
  id?: unknown;
  ocurrencia?: unknown;
  modulo?: unknown;
  operacion?: unknown;
  resultado?: unknown;
  referencia?: { tipo?: unknown; id?: unknown } | null;
  ejecutor?: { tipo?: unknown; referencia?: unknown } | null;
};

const etiquetas: Record<string, string> = {
  AUDITORIA: 'Auditoría', CONSULTA: 'Consulta', EVIDENCIA: 'evidencia', EXPORTACION: 'Exportación',
  DASHBOARD: 'Dashboard', CONFIRMADA: 'confirmada', MODULO: 'módulo', CREACION: 'creación',
  ACTUALIZACION: 'actualización', ELIMINACION: 'eliminación', CREDITO: 'crédito', RECHAZADO: 'Rechazado',
  EXITOSO: 'Exitoso', FALLIDO: 'Fallido', SISTEMA: 'Sistema', HUMANO: 'Usuario',
};

export const humanizarM9 = (valor: unknown) => {
  const original = String(valor ?? '').trim();
  if (!original) return '—';
  const frases: Record<string, string> = {
    CONSULTA_EVIDENCIA: 'Consulta de evidencia',
    EXPORTACION_DASHBOARD_CONFIRMADA: 'Exportación de Dashboard confirmada',
  };
  if (frases[original.toUpperCase()]) return frases[original.toUpperCase()];
  const escenario = original.match(/^DEMO[-_]UI[-_]ESCENARIO[-_](\d+)$/i);
  if (escenario) return `Escenario de demostración ${escenario[1]}`;
  return original.replace(/[-_]+/g, ' ').split(/\s+/).filter(Boolean).map((palabra, indice) => {
    const clave = palabra.toUpperCase(); const traducida = etiquetas[clave] || palabra.toLocaleLowerCase('es-CL');
    return indice === 0 ? traducida.charAt(0).toLocaleUpperCase('es-CL') + traducida.slice(1) : traducida;
  }).join(' ');
};

export const fechaInformeM9 = (valor: unknown, incluirHora = true) => {
  const fecha = new Date(String(valor ?? ''));
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', incluirHora
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(fecha).replace(',', '');
};

const solicitanteInforme = (scope: ScopeM9) => {
  const solicitante = String(scope.solicitante || '').trim();
  if (!solicitante) return 'Sistema';
  return /^\d+$/.test(solicitante) ? `Usuario #${solicitante}` : humanizarM9(solicitante);
};

export const referenciaInformeM9 = (evento: EventoPresentadoM9) => {
  // MIDAS: respetamos el enmascarado resuelto por M9; presentación nunca recupera datos restringidos.
  const tipo = evento.referencia?.tipo, id = evento.referencia?.id;
  if (id === null || id === undefined || id === '' || id === '***') return id === '***' ? 'Restringida' : '—';
  return tipo ? `${humanizarM9(tipo)} ${String(id)}` : String(id);
};

export const ejecutorInformeM9 = (evento: EventoPresentadoM9) => {
  const tipo = String(evento.ejecutor?.tipo || '').toUpperCase(), referencia = String(evento.ejecutor?.referencia ?? '').trim();
  if (referencia === '***') return 'Restringido';
  if (tipo === 'SISTEMA') return referencia && referencia.toUpperCase() !== 'SISTEMA' ? `Sistema (${humanizarM9(referencia)})` : 'Sistema';
  if (/^\d+$/.test(referencia)) return `Usuario #${referencia}`;
  const pareceClaveTecnica = /^[A-Z0-9_-]+$/.test(referencia);
  return referencia ? (pareceClaveTecnica ? humanizarM9(referencia) : referencia) : tipo === 'HUMANO' ? 'Usuario' : 'Sistema';
};

const tonoResultado = (resultado: string): TonoInformePdf => resultado === 'EXITOSO' ? 'exitoso' : resultado === 'RECHAZADO' ? 'rechazado' : resultado === 'FALLIDO' ? 'fallido' : 'neutro';

const filtrosInforme = (filtros: FiltrosM9) => {
  const definiciones: Array<[keyof FiltrosM9, string, (valor: unknown) => string]> = [
    ['modulo', 'Módulo', humanizarM9], ['resultado', 'Resultado', humanizarM9], ['buscar', 'Búsqueda', valor => String(valor)],
    ['desde', 'Desde', valor => fechaInformeM9(valor, false)], ['hasta', 'Hasta', valor => fechaInformeM9(valor, false)],
    ['productor', 'Productor', humanizarM9], ['operacion', 'Operación', humanizarM9], ['ejecutor', 'Ejecutor', humanizarM9],
    ['entidadTipo', 'Tipo de entidad', humanizarM9], ['entidadReferencia', 'Referencia', valor => String(valor)],
    ['identidadLogica', 'Identidad lógica', valor => String(valor)],
  ];
  return definiciones.flatMap(([clave, etiqueta, presentar]) => filtros[clave] === undefined || filtros[clave] === null || filtros[clave] === '' ? [] : [{ etiqueta, valor: presentar(filtros[clave]) }]);
};

export function crearInformeAuditoriaM9(eventosEntrada: EventoPresentadoM9[], filtros: FiltrosM9, scope: ScopeM9, generadoEn: Date) {
  // MIDAS: el informe trabaja con eventos ya filtrados y autorizados, sin volver a consultar evidencia.
  const eventos = eventosEntrada.map(evento => ({ ...evento, resultadoNormalizado: String(evento.resultado || '').toUpperCase(), moduloNormalizado: String(evento.modulo || 'SIN_MODULO').toUpperCase() }));
  const resultadosBase = ['EXITOSO', 'RECHAZADO', 'FALLIDO'];
  const plurales: Record<string, string> = { EXITOSO: 'Exitosos', RECHAZADO: 'Rechazados', FALLIDO: 'Fallidos' };
  const resultados = resultadosBase.map(resultado => {
    const cantidad = eventos.filter(evento => evento.resultadoNormalizado === resultado).length;
    return { etiqueta: plurales[resultado], cantidad, porcentaje: eventos.length ? cantidad / eventos.length * 100 : 0, tono: tonoResultado(resultado) };
  });
  const modulos = [...eventos.reduce((mapa, evento) => mapa.set(evento.moduloNormalizado, (mapa.get(evento.moduloNormalizado) || 0) + 1), new Map<string, number>())]
    .map(([etiqueta, cantidad]) => ({ etiqueta, cantidad })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true }));
  const filtrosPresentados = filtrosInforme(filtros);
  const periodo = filtros.desde || filtros.hasta ? `${filtros.desde ? fechaInformeM9(filtros.desde, false) : 'Inicio'} a ${filtros.hasta ? fechaInformeM9(filtros.hasta, false) : 'Actualidad'}` : 'Todos los eventos visibles';
  const tarjetas = [
    { etiqueta: 'Total de eventos', valor: String(eventos.length), tono: 'neutro' as const },
    ...resultados.map(resultado => ({ etiqueta: resultado.etiqueta, valor: String(resultado.cantidad), detalle: `${resultado.porcentaje.toFixed(1).replace('.', ',')}%`, tono: resultado.tono })),
    { etiqueta: 'Módulos involucrados', valor: String(modulos.length), tono: 'neutro' as const },
  ];
  const informe: InformePdf = {
    titulo: 'Informe de Auditoría', subtitulo: 'Puertas Blindadas - Módulo de Auditoría M9', generado: fechaInformeM9(generadoEn), periodo,
    solicitante: solicitanteInforme(scope), total: eventos.length, filtros: filtrosPresentados, tarjetas, modulos, resultados,
    tabla: {
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha y hora', ancho: 90 }, { clave: 'modulo', etiqueta: 'Módulo', ancho: 40 },
        { clave: 'operacion', etiqueta: 'Operación', ancho: 135 }, { clave: 'resultado', etiqueta: 'Resultado', ancho: 60 },
        { clave: 'referencia', etiqueta: 'Referencia', ancho: 95 }, { clave: 'ejecutor', etiqueta: 'Ejecutor', ancho: 91 },
      ],
      filas: eventos.map(evento => ({ fecha: fechaInformeM9(evento.ocurrencia), modulo: humanizarM9(evento.modulo), operacion: humanizarM9(evento.operacion), resultado: humanizarM9(evento.resultado), referencia: referenciaInformeM9(evento), ejecutor: ejecutorInformeM9(evento), tonoResultado: tonoResultado(evento.resultadoNormalizado) })),
    },
    pie: 'Documento generado por el Sistema Financiero Puertas Blindadas',
  };
  return archivoPdfInforme('auditoria-m9.pdf', informe);
}
