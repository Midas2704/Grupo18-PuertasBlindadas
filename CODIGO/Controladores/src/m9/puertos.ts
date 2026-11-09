import { EventoEntradaM9, EventoNormalizadoM9 } from './tipos';

export interface RelojM9 { ahora(): Date }
export class RelojSistemaM9 implements RelojM9 { ahora() { return new Date(); } }
export class RelojFijoM9 implements RelojM9 {
  constructor(private instante: Date) {}
  ahora() { return new Date(this.instante); }
  fijar(instante: Date) { this.instante = new Date(instante); }
}

export type DiagnosticoM9 = { codigo: string; fecha: Date; productor?: string; identidadLogica?: string };
export interface DiagnosticosM9 { registrar(item: DiagnosticoM9): void; listar(): DiagnosticoM9[] }
export class DiagnosticosMemoriaM9 implements DiagnosticosM9 {
  private items: DiagnosticoM9[] = [];
  registrar(item: DiagnosticoM9) { this.items.push({ ...item }); }
  listar() { return this.items.map(item => ({ ...item })); }
}

export type NuevoPendienteM9 = Pick<EventoEntradaM9, 'identidadLogica' | 'versionContrato' | 'ocurridoEn' | 'zonaHoraria' | 'productor' | 'modulo' | 'operacion' | 'resultado'> & { creadoEn: Date; intentos: number; evento?: EventoNormalizadoM9 };
export type PendienteM9 = NuevoPendienteM9 & { id: number; estado: 'PENDIENTE' | 'REINTENTANDO' | 'RESUELTO'; proximoIntentoEn: Date; resueltoEn: Date | null; ultimoErrorCodigo: string | null; ultimoErrorEn: Date | null };
export interface FuentePendientesM9 {
  guardar(item: NuevoPendienteM9): Promise<void>;
  listar(): Promise<PendienteM9[]>;
  elegibles(ahora: Date, limite: number): Promise<PendienteM9[]>;
  reclamar(id: number, ahora: Date, leaseHasta: Date): Promise<boolean>;
  registrarResultado(id: number, resultado: 'EXITOSO' | 'FALLIDO', fecha: Date, errorCodigo?: string, proximoIntentoEn?: Date): Promise<void>;
}
export class PendientesMemoriaM9 implements FuentePendientesM9 {
  private items: PendienteM9[] = [];
  async guardar(item: NuevoPendienteM9) {
    if (!this.items.some(actual => actual.identidadLogica === item.identidadLogica)) this.items.push({ ...item, id:this.items.length + 1, estado:'PENDIENTE', proximoIntentoEn:new Date(item.creadoEn), resueltoEn:null, ultimoErrorCodigo:null, ultimoErrorEn:null });
  }
  async listar() { return this.items.map(item => ({ ...item })); }
  async elegibles(ahora: Date, limite: number) { return this.items.filter(item => item.estado !== 'RESUELTO' && item.proximoIntentoEn <= ahora).slice(0, limite).map(item => ({ ...item })); }
  async reclamar(id:number,ahora:Date,leaseHasta:Date){const item=this.items.find(actual=>actual.id===id&&actual.estado!=='RESUELTO'&&actual.proximoIntentoEn<=ahora);if(!item)return false;item.estado='REINTENTANDO';item.proximoIntentoEn=new Date(leaseHasta);return true;}
  async registrarResultado(id: number, resultado: 'EXITOSO' | 'FALLIDO', fecha: Date, errorCodigo?: string, proximoIntentoEn?: Date) {
    const item=this.items.find(actual=>actual.id===id); if(!item) return;
    item.intentos++; item.ultimoErrorCodigo=resultado==='FALLIDO' ? errorCodigo ?? 'M9_RETRY_FALLIDO' : null; item.ultimoErrorEn=resultado==='FALLIDO' ? new Date(fecha) : null;
    if(resultado==='EXITOSO'){item.estado='RESUELTO';item.resueltoEn=new Date(fecha);}else{item.estado='PENDIENTE';item.proximoIntentoEn=new Date(proximoIntentoEn ?? fecha);}
  }
}

export interface FuenteRetryM9 { resumen(): Promise<{ exitosos: number; fallidos: number }> }
export class RetryMemoriaM9 implements FuenteRetryM9 {
  constructor(private estado = { exitosos: 0, fallidos: 0 }) {}
  async resumen() { return { ...this.estado }; }
  fijar(estado: { exitosos: number; fallidos: number }) { this.estado = { ...estado }; }
}

export type SenalM9 = { tipo: 'FALLO_CRITICO' | 'PENDIENTE_ENVEJECIDO' | 'ALERTA_TECNICA'; productor: string; identidadLogica?: string; codigoConfiguracion?: string; metrica?: string };
export interface SenalesM9 { emitir(senal: SenalM9): void; listar(): SenalM9[] }
export class SenalesMemoriaM9 implements SenalesM9 {
  private senales: SenalM9[] = [];
  emitir(senal: SenalM9) { this.senales.push({ ...senal }); }
  listar() { return this.senales.map(senal => ({ ...senal })); }
}
