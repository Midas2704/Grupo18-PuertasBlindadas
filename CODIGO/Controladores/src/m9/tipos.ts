export type ResultadoM9 = 'EXITOSO' | 'RECHAZADO' | 'FALLIDO';
export type EjecutorM9 = { tipo: 'HUMANO' | 'SISTEMA'; referencia?: string };
export type JsonM9 = Record<string, unknown>;

export type EventoEntradaM9 = {
  identidadLogica: string;
  versionContrato: string;
  ocurridoEn: string;
  zonaHoraria: string;
  ejecutor: EjecutorM9;
  productor: string;
  modulo: string;
  operacion: string;
  resultado: string;
  referencia?: { tipo: string; id: string };
  secuencia?: number;
  anterior?: JsonM9;
  nuevo?: JsonM9;
  motivo?: string;
  motivoRequerido?: boolean;
  causa?: string;
  eventoOrigenId?: number;
  eventoCorrectivoId?: number;
  eventoPrivacidad?: boolean;
  metadatos?: JsonM9;
  critico?: boolean;
  contextoTerminal?: boolean;
  capacidad?: 'EMITIR_EVENTO_M9';
};

export type EventoNormalizadoM9 = {
  identidadLogica: string;
  versionContrato: string;
  fechaOcurrencia: Date;
  zonaHoraria: string;
  fechaPersistencia: Date;
  ejecutorTipo: 'HUMANO' | 'SISTEMA';
  ejecutorReferencia: string | null;
  productor: string;
  modulo: string;
  operacion: string;
  resultado: ResultadoM9;
  entidadTipo: string | null;
  entidadReferencia: string | null;
  secuencia: number | null;
  anterior: JsonM9 | null;
  nuevo: JsonM9 | null;
  motivo: string | null;
  causa: string | null;
  eventoOrigenId: number | null;
  eventoCorrectivoId: number | null;
  contextoTerminal: boolean;
  eventoPrivacidad: boolean;
  metadatos: JsonM9 | null;
  hashContenido: string;
  hashIntegridad: string;
};

export type EventoPersistidoM9 = EventoNormalizadoM9 & { id: number };

export type FiltrosM9 = {
  desde?: string;
  hasta?: string;
  modulo?: string;
  productor?: string;
  operacion?: string;
  resultado?: ResultadoM9;
  ejecutor?: string;
  entidadTipo?: string;
  entidadReferencia?: string;
  identidadLogica?: string;
  buscar?: string;
  pagina?: number;
  tamano?: number;
  orden?: 'asc' | 'desc';
};

export type ScopeM9 = {
  solicitante: string;
  modulos?: string[];
  productores?: string[];
  permitirCambios?: boolean;
  permitirMotivos?: boolean;
  permitirPrivacidad?: boolean;
  camposOcultos?: string[];
};

export type ConfiguracionM9 = {
  versionesSoportadas: string[];
  metadatosPermitidos: string[];
  maximoPagina: number;
  maximoTexto: number;
  retryLeaseMs?: number;
};

export const CONFIGURACION_M9: ConfiguracionM9 = {
  versionesSoportadas: ['1.0'],
  metadatosPermitidos: ['correlationId', 'requestId', 'sourceVersion', 'traceId'],
  maximoPagina: 200,
  maximoTexto: 4000,
  retryLeaseMs: Number(process.env.M9_RETRY_LEASE_MS ?? 30000),
};
