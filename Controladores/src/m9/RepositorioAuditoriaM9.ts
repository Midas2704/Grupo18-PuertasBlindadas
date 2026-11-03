import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { EventoNormalizadoM9, EventoPersistidoM9, FiltrosM9 } from './tipos';

export interface RepositorioAuditoriaM9 {
  crear(evento: EventoNormalizadoM9): Promise<EventoPersistidoM9>;
  porIdentidad(identidad: string): Promise<EventoPersistidoM9 | null>;
  porId(id: number): Promise<EventoPersistidoM9 | null>;
  ultimaSecuencia(productor: string, entidadTipo: string | null, entidadReferencia: string | null): Promise<number | null>;
  listar(filtros: FiltrosM9, modulos?: string[], productores?: string[]): Promise<{ total: number; eventos: EventoPersistidoM9[] }>;
  listarTodo(filtros: FiltrosM9, modulos?: string[], productores?: string[]): Promise<EventoPersistidoM9[]>;
  relacionados(id: number, tipo: 'origen' | 'correctivo'): Promise<EventoPersistidoM9[]>;
  resumen(modulos?: string[], productores?: string[]): Promise<{ total:number; porResultado:Record<string,number>; porModulo:Record<string,number> }>;
  cantidad(): Promise<number>;
}

type FilaM9 = Awaited<ReturnType<typeof prisma.evento_auditoria_m9.findFirst>>;
const json = (valor: Prisma.JsonValue | null) => valor as Record<string, unknown> | null;
const entradaJson = (valor: Record<string, unknown> | null) => valor === null ? Prisma.JsonNull : valor as Prisma.InputJsonValue;
const mapear = (fila: NonNullable<FilaM9>): EventoPersistidoM9 => ({
  id: fila.id_evento_m9,
  identidadLogica: fila.identidad_logica,
  versionContrato: fila.version_contrato,
  fechaOcurrencia: fila.fecha_ocurrencia,
  zonaHoraria: fila.zona_horaria,
  fechaPersistencia: fila.fecha_persistencia,
  ejecutorTipo: fila.ejecutor_tipo as 'HUMANO' | 'SISTEMA',
  ejecutorReferencia: fila.ejecutor_referencia,
  productor: fila.productor,
  modulo: fila.modulo_origen,
  operacion: fila.operacion,
  resultado: fila.resultado as EventoPersistidoM9['resultado'],
  entidadTipo: fila.entidad_tipo,
  entidadReferencia: fila.entidad_referencia,
  secuencia: fila.secuencia,
  anterior: json(fila.valores_anteriores),
  nuevo: json(fila.valores_nuevos),
  motivo: fila.motivo,
  causa: fila.causa,
  eventoOrigenId: fila.id_evento_origen,
  eventoCorrectivoId: fila.id_evento_correctivo,
  contextoTerminal: fila.contexto_terminal,
  eventoPrivacidad: fila.evento_privacidad,
  metadatos: json(fila.metadatos_tecnicos),
  hashContenido: fila.hash_contenido,
  hashIntegridad: fila.hash_integridad,
});

const datos = (evento: EventoNormalizadoM9): Prisma.evento_auditoria_m9CreateInput => ({
  identidad_logica: evento.identidadLogica,
  version_contrato: evento.versionContrato,
  fecha_ocurrencia: evento.fechaOcurrencia,
  zona_horaria: evento.zonaHoraria,
  fecha_persistencia: evento.fechaPersistencia,
  ejecutor_tipo: evento.ejecutorTipo,
  ejecutor_referencia: evento.ejecutorReferencia,
  productor: evento.productor,
  modulo_origen: evento.modulo,
  operacion: evento.operacion,
  resultado: evento.resultado,
  entidad_tipo: evento.entidadTipo,
  entidad_referencia: evento.entidadReferencia,
  secuencia: evento.secuencia,
  valores_anteriores: entradaJson(evento.anterior),
  valores_nuevos: entradaJson(evento.nuevo),
  motivo: evento.motivo,
  causa: evento.causa,
  contexto_terminal: evento.contextoTerminal,
  evento_privacidad: evento.eventoPrivacidad,
  metadatos_tecnicos: entradaJson(evento.metadatos),
  hash_contenido: evento.hashContenido,
  hash_integridad: evento.hashIntegridad,
  ...(evento.eventoOrigenId ? { evento_origen: { connect: { id_evento_m9: evento.eventoOrigenId } } } : {}),
  ...(evento.eventoCorrectivoId ? { evento_correctivo: { connect: { id_evento_m9: evento.eventoCorrectivoId } } } : {}),
});

export class RepositorioAuditoriaM9Prisma implements RepositorioAuditoriaM9 {
  async crear(evento: EventoNormalizadoM9) { return mapear(await prisma.evento_auditoria_m9.create({ data: datos(evento) })); }
  async porIdentidad(identidad: string) { const fila = await prisma.evento_auditoria_m9.findUnique({ where: { identidad_logica: identidad } }); return fila ? mapear(fila) : null; }
  async porId(id: number) { const fila = await prisma.evento_auditoria_m9.findUnique({ where: { id_evento_m9: id } }); return fila ? mapear(fila) : null; }
  async ultimaSecuencia(productor: string, entidadTipo: string | null, entidadReferencia: string | null) {
    const fila = await prisma.evento_auditoria_m9.findFirst({ where: { productor, entidad_tipo: entidadTipo, entidad_referencia: entidadReferencia, secuencia: { not: null } }, orderBy: { secuencia: 'desc' } });
    return fila?.secuencia ?? null;
  }
  async listar(filtros: FiltrosM9, modulos?: string[], productores?: string[]) {
    const pagina = Math.max(1, filtros.pagina ?? 1), tamano = Math.max(1, filtros.tamano ?? 50);
    const where: Prisma.evento_auditoria_m9WhereInput = {
      ...(modulos ? { modulo_origen: { in: modulos } } : {}),
      ...(productores ? { productor: { in: productores } } : {}),
      ...(filtros.modulo ? { modulo_origen: filtros.modulo } : {}),
      ...(filtros.productor ? { productor: filtros.productor } : {}),
      ...(filtros.operacion ? { operacion: filtros.operacion } : {}),
      ...(filtros.resultado ? { resultado: filtros.resultado } : {}),
      ...(filtros.ejecutor ? { ejecutor_referencia: filtros.ejecutor } : {}),
      ...(filtros.entidadTipo ? { entidad_tipo: filtros.entidadTipo } : {}),
      ...(filtros.entidadReferencia ? { entidad_referencia: filtros.entidadReferencia } : {}),
      ...(filtros.identidadLogica ? { identidad_logica: filtros.identidadLogica } : {}),
      ...(filtros.desde || filtros.hasta ? { fecha_ocurrencia: { ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}), ...(filtros.hasta ? { lte: new Date(filtros.hasta) } : {}) } } : {}),
      ...(filtros.buscar ? { OR: [{ identidad_logica: { contains: filtros.buscar, mode: 'insensitive' } }, { entidad_referencia: { contains: filtros.buscar, mode: 'insensitive' } }] } : {}),
    };
    const [total, filas] = await Promise.all([
      prisma.evento_auditoria_m9.count({ where }),
      prisma.evento_auditoria_m9.findMany({ where, orderBy: [{ fecha_ocurrencia: filtros.orden ?? 'desc' }, { id_evento_m9: filtros.orden ?? 'desc' }], skip: (pagina - 1) * tamano, take: tamano }),
    ]);
    return { total, eventos: filas.map(mapear) };
  }
  async listarTodo(filtros: FiltrosM9, modulos?: string[], productores?: string[]) {
    const pagina = await this.listar({ ...filtros, pagina:1, tamano:Math.max(1, await prisma.evento_auditoria_m9.count()) }, modulos, productores);
    if (pagina.eventos.length === pagina.total) return pagina.eventos;
    const lotes: EventoPersistidoM9[]=[...pagina.eventos];
    for(let numero=2;lotes.length<pagina.total;numero++) lotes.push(...(await this.listar({...filtros,pagina:numero,tamano:200},modulos,productores)).eventos);
    return lotes;
  }
  async relacionados(id: number, tipo: 'origen' | 'correctivo') {
    const filas = await prisma.evento_auditoria_m9.findMany({ where: tipo === 'origen' ? { id_evento_origen: id } : { id_evento_correctivo: id }, orderBy: [{ fecha_ocurrencia: 'asc' }, { id_evento_m9: 'asc' }] });
    return filas.map(mapear);
  }
  async resumen(modulos?: string[], productores?: string[]) {
    const where: Prisma.evento_auditoria_m9WhereInput = { ...(modulos ? { modulo_origen:{in:modulos} } : {}), ...(productores ? { productor:{in:productores} } : {}) };
    const [total, resultados, modulosAgrupados] = await Promise.all([
      prisma.evento_auditoria_m9.count({where}),
      prisma.evento_auditoria_m9.groupBy({by:['resultado'],where,_count:{_all:true}}),
      prisma.evento_auditoria_m9.groupBy({by:['modulo_origen'],where,_count:{_all:true}}),
    ]);
    return { total, porResultado:Object.fromEntries(resultados.map(item=>[item.resultado,item._count._all])), porModulo:Object.fromEntries(modulosAgrupados.map(item=>[item.modulo_origen,item._count._all])) };
  }
  cantidad() { return prisma.evento_auditoria_m9.count(); }
}

export class RepositorioAuditoriaM9Memoria implements RepositorioAuditoriaM9 {
  private eventos: EventoPersistidoM9[] = [];
  fallarPersistencia = false;
  async crear(evento: EventoNormalizadoM9) {
    if (this.fallarPersistencia) throw new Error('persistencia no disponible');
    const creado = { ...evento, id: this.eventos.length + 1 };
    this.eventos.push(creado);
    return { ...creado };
  }
  async porIdentidad(identidad: string) { return this.eventos.find(evento => evento.identidadLogica === identidad) ?? null; }
  async porId(id: number) { return this.eventos.find(evento => evento.id === id) ?? null; }
  async ultimaSecuencia(productor: string, entidadTipo: string | null, entidadReferencia: string | null) { return this.eventos.filter(e => e.productor === productor && e.entidadTipo === entidadTipo && e.entidadReferencia === entidadReferencia && e.secuencia !== null).reduce<number | null>((maximo, e) => maximo === null || e.secuencia! > maximo ? e.secuencia! : maximo, null); }
  async listar(f: FiltrosM9, modulos?: string[], productores?: string[]) {
    let eventos = this.eventos.filter(e => (!modulos || modulos.includes(e.modulo)) && (!productores || productores.includes(e.productor)) && (!f.modulo || e.modulo === f.modulo) && (!f.productor || e.productor === f.productor) && (!f.operacion || e.operacion === f.operacion) && (!f.resultado || e.resultado === f.resultado) && (!f.ejecutor || e.ejecutorReferencia === f.ejecutor) && (!f.entidadTipo || e.entidadTipo === f.entidadTipo) && (!f.entidadReferencia || e.entidadReferencia === f.entidadReferencia) && (!f.identidadLogica || e.identidadLogica === f.identidadLogica) && (!f.buscar || e.identidadLogica.includes(f.buscar) || e.entidadReferencia?.includes(f.buscar)));
    eventos = eventos.sort((a, b) => (a.fechaOcurrencia.getTime() - b.fechaOcurrencia.getTime()) * (f.orden === 'asc' ? 1 : -1));
    const total = eventos.length, pagina = f.pagina ?? 1, tamano = f.tamano ?? 50;
    return { total, eventos: eventos.slice((pagina - 1) * tamano, pagina * tamano).map(e => ({ ...e })) };
  }
  async listarTodo(f: FiltrosM9, modulos?: string[], productores?: string[]) { const total=await this.listar({...f,pagina:1,tamano:Number.MAX_SAFE_INTEGER},modulos,productores);return total.eventos; }
  async relacionados(id: number, tipo: 'origen' | 'correctivo') { return this.eventos.filter(e => tipo === 'origen' ? e.eventoOrigenId === id : e.eventoCorrectivoId === id).sort((a, b) => a.fechaOcurrencia.getTime() - b.fechaOcurrencia.getTime()); }
  async resumen(modulos?: string[], productores?: string[]) {
    const eventos=this.eventos.filter(e=>(!modulos||modulos.includes(e.modulo))&&(!productores||productores.includes(e.productor)));
    const contar=(valores:string[])=>valores.reduce<Record<string,number>>((r,v)=>(r[v]=(r[v]??0)+1,r),{});
    return {total:eventos.length,porResultado:contar(eventos.map(e=>e.resultado)),porModulo:contar(eventos.map(e=>e.modulo))};
  }
  async cantidad() { return this.eventos.length; }
}
