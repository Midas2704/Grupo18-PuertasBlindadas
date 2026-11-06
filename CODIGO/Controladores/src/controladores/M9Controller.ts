import { randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../utilidades/ErrorAplicacion';
import { crearInformeAuditoriaM9 } from '../m9/informeAuditoriaPdf';
import { archivoAuditoriaM9Csv } from '../m9/exportacionAuditoriaCsv';
import { ObservabilidadM9 } from '../m9/observabilidad';
import { DiagnosticosM9, DiagnosticosMemoriaM9, FuentePendientesM9, FuenteRetryM9, PendientesMemoriaM9, RelojM9, RelojSistemaM9, RetryMemoriaM9, SenalesM9, SenalesMemoriaM9 } from '../m9/puertos';
import { RepositorioAuditoriaM9, RepositorioAuditoriaM9Prisma } from '../m9/RepositorioAuditoriaM9';
import { RepositorioRetryM9Prisma } from '../m9/RepositorioRetryM9';
import { MotorPoliticasM9, RepositorioPoliticasPrismaM9 } from '../m9/politicas';
import { deltaMinimo, enmascarar, fechaConZona, hashM9, normalizarResultado, textoSeguro, validarSinSecretos } from '../m9/seguridad';
import { CONFIGURACION_M9, ConfiguracionM9, EventoEntradaM9, EventoNormalizadoM9, EventoPersistidoM9, FiltrosM9, JsonM9, ScopeM9 } from '../m9/tipos';

type DependenciasM9 = {
  repositorio?: RepositorioAuditoriaM9;
  reloj?: RelojM9;
  diagnosticos?: DiagnosticosM9;
  pendientes?: FuentePendientesM9;
  retry?: FuenteRetryM9;
  senales?: SenalesM9;
  observabilidad?: ObservabilidadM9;
  configuracion?: ConfiguracionM9;
  politicas?: MotorPoliticasM9;
};

const materialContenido = (evento: Omit<EventoNormalizadoM9, 'fechaPersistencia' | 'hashContenido' | 'hashIntegridad'>) => evento;
const materialIntegridad = (evento: Omit<EventoNormalizadoM9, 'hashIntegridad'>) => evento;
const textoOpcional = (valor: unknown, maximo: number) => valor === undefined || valor === null || valor === '' ? null : textoSeguro(valor, 'Texto', maximo);

export class M9Controller {
  readonly repositorio: RepositorioAuditoriaM9;
  readonly reloj: RelojM9;
  readonly diagnosticos: DiagnosticosM9;
  readonly pendientes: FuentePendientesM9;
  readonly retry: FuenteRetryM9;
  readonly senales: SenalesM9;
  readonly observabilidad: ObservabilidadM9;
  readonly configuracion: ConfiguracionM9;
  readonly politicas: MotorPoliticasM9;

  constructor(dependencias: DependenciasM9 = {}) {
    this.repositorio = dependencias.repositorio ?? new RepositorioAuditoriaM9Prisma();
    this.reloj = dependencias.reloj ?? new RelojSistemaM9();
    this.diagnosticos = dependencias.diagnosticos ?? new DiagnosticosMemoriaM9();
    this.pendientes = dependencias.pendientes ?? new RepositorioRetryM9Prisma();
    this.retry = dependencias.retry ?? new RetryMemoriaM9();
    this.senales = dependencias.senales ?? new SenalesMemoriaM9();
    this.observabilidad = dependencias.observabilidad ?? new ObservabilidadM9();
    this.configuracion = dependencias.configuracion ?? CONFIGURACION_M9;
    this.politicas = dependencias.politicas ?? new MotorPoliticasM9(new RepositorioPoliticasPrismaM9());
  }

  private diagnosticar(codigo: string, entrada?: Partial<EventoEntradaM9>) {
    this.diagnosticos.registrar({ codigo, fecha: this.reloj.ahora(), productor: entrada?.productor, identidadLogica: entrada?.identidadLogica });
  }

  private async normalizar(entrada: EventoEntradaM9, omitirOrden = false): Promise<EventoNormalizadoM9> {
    validarSinSecretos(entrada);
    if (entrada.capacidad !== 'EMITIR_EVENTO_M9') throw new ErrorAplicacion(403, 'Capacidad técnica insuficiente', 'M9_MINIMO_PRIVILEGIO');
    const identidadLogica = textoSeguro(entrada.identidadLogica, 'Identidad lógica', 160);
    const versionContrato = textoSeguro(entrada.versionContrato, 'Versión', 20);
    if (!this.configuracion.versionesSoportadas.includes(versionContrato)) throw new ErrorAplicacion(400, 'Versión de contrato no soportada', 'M9_VERSION_INVALIDA');
    const productor = textoSeguro(entrada.productor, 'Productor', 80);
    const modulo = textoSeguro(entrada.modulo, 'Módulo', 40);
    const operacion = textoSeguro(entrada.operacion, 'Operación', 100);
    if (!entrada.ejecutor || !['HUMANO', 'SISTEMA'].includes(entrada.ejecutor.tipo)) throw new ErrorAplicacion(400, 'Ejecutor inválido', 'M9_NUCLEO_INCOMPLETO');
    const fechaOcurrencia = fechaConZona(textoSeguro(entrada.ocurridoEn, 'Ocurrencia', 60), textoSeguro(entrada.zonaHoraria, 'Zona horaria', 80));
    if (entrada.motivoRequerido && !entrada.motivo?.trim()) throw new ErrorAplicacion(400, 'El motivo es obligatorio', 'M9_MOTIVO_REQUERIDO');
    if (entrada.secuencia !== undefined && (!Number.isSafeInteger(entrada.secuencia) || entrada.secuencia < 0)) throw new ErrorAplicacion(400, 'Secuencia inválida', 'M9_SECUENCIA_INVALIDA');
    if (entrada.eventoOrigenId && entrada.eventoCorrectivoId) throw new ErrorAplicacion(400, 'Un evento no puede ser derivado y correctivo simultáneamente', 'M9_REFERENCIA_INVALIDA');
    if (entrada.eventoOrigenId && !await this.repositorio.porId(entrada.eventoOrigenId)) throw new ErrorAplicacion(400, 'Evento origen inexistente', 'M9_REFERENCIA_INVALIDA');
    if (entrada.eventoCorrectivoId && !await this.repositorio.porId(entrada.eventoCorrectivoId)) throw new ErrorAplicacion(400, 'Evento original inexistente', 'M9_REFERENCIA_INVALIDA');
    const entidadTipo = entrada.referencia ? textoSeguro(entrada.referencia.tipo, 'Tipo de entidad', 80) : null;
    const entidadReferencia = entrada.referencia ? textoSeguro(entrada.referencia.id, 'Referencia', 160) : null;
    if (entrada.secuencia !== undefined && !omitirOrden) {
      const ultima = await this.repositorio.ultimaSecuencia(productor, entidadTipo, entidadReferencia);
      if (ultima !== null && entrada.secuencia <= ultima) throw new ErrorAplicacion(409, 'Evento fuera de orden', 'M9_EVENTO_FUERA_DE_ORDEN');
    }
    const delta = deltaMinimo(entrada.anterior, entrada.nuevo);
    const metadatos = entrada.metadatos ? Object.fromEntries(Object.entries(entrada.metadatos).filter(([clave]) => this.configuracion.metadatosPermitidos.includes(clave))) : null;
    const base = {
      identidadLogica, versionContrato, fechaOcurrencia, zonaHoraria: entrada.zonaHoraria,
      ejecutorTipo: entrada.ejecutor.tipo, ejecutorReferencia: textoOpcional(entrada.ejecutor.referencia, 120),
      productor, modulo, operacion, resultado: normalizarResultado(entrada.resultado), entidadTipo, entidadReferencia,
      secuencia: entrada.secuencia ?? null, anterior: delta.anterior, nuevo: delta.nuevo,
      motivo: textoOpcional(entrada.motivo, this.configuracion.maximoTexto), causa: textoOpcional(entrada.causa, this.configuracion.maximoTexto),
      eventoOrigenId: entrada.eventoOrigenId ?? null, eventoCorrectivoId: entrada.eventoCorrectivoId ?? null,
      contextoTerminal: entrada.contextoTerminal === true, eventoPrivacidad: entrada.eventoPrivacidad === true,
      metadatos: Object.keys(metadatos ?? {}).length ? metadatos : null,
    } satisfies Omit<EventoNormalizadoM9, 'fechaPersistencia' | 'hashContenido' | 'hashIntegridad'>;
    const hashContenido = hashM9(materialContenido(base));
    const conPersistencia = { ...base, fechaPersistencia: this.reloj.ahora(), hashContenido };
    return { ...conPersistencia, hashIntegridad: hashM9(materialIntegridad(conPersistencia)) };
  }

  async recibir(entrada: EventoEntradaM9) {
    const inicio = Date.now();
    this.observabilidad.incrementar('recibidos');
    if (entrada?.productor) this.observabilidad.productor(entrada.productor, 'recibidos');
    let normalizado: EventoNormalizadoM9;
    try {
      validarSinSecretos(entrada);
      const identidad = textoSeguro(entrada.identidadLogica, 'Identidad lógica', 160);
      const existente = await this.repositorio.porIdentidad(identidad);
      normalizado = await this.normalizar(entrada, Boolean(existente));
      if (existente) {
        if (existente.hashContenido !== normalizado.hashContenido) throw new ErrorAplicacion(409, 'Identidad lógica duplicada con contenido distinto', 'M9_DUPLICADO_CONFLICTIVO');
        return { estado: 'PERSISTIDO' as const, evento: this.verificarIntegridad(existente), reintento: true };
      }
    } catch (error) {
      this.observabilidad.incrementar('rechazados');
      this.diagnosticar(error instanceof ErrorAplicacion ? error.codigo : 'M9_EVENTO_INVALIDO', entrada);
      throw error;
    } finally {
      this.observabilidad.latencia('ingesta', Date.now() - inicio);
    }

    const inicioPersistencia = Date.now();
    try {
      const evento = await this.repositorio.crear(normalizado);
      this.observabilidad.incrementar('persistidos');
      this.observabilidad.productor(normalizado.productor, 'persistidos');
      return { estado: 'PERSISTIDO' as const, evento: this.verificarIntegridad(evento), reintento: false };
    } catch {
      this.observabilidad.incrementar('fallosPersistencia');
      this.observabilidad.productor(normalizado.productor, 'fallos');
      this.diagnosticar('M9_FALLO_PERSISTENCIA', entrada);
      if (entrada.critico) {
        this.senales.emitir({ tipo: 'FALLO_CRITICO', productor: normalizado.productor, identidadLogica: normalizado.identidadLogica });
        throw new ErrorAplicacion(503, 'No fue posible confirmar la evidencia crítica', 'M9_FALLO_CRITICO');
      }
      await this.pendientes.guardar({ identidadLogica: normalizado.identidadLogica, versionContrato: normalizado.versionContrato, ocurridoEn: entrada.ocurridoEn, zonaHoraria: normalizado.zonaHoraria, productor: normalizado.productor, modulo: normalizado.modulo, operacion: normalizado.operacion, resultado: normalizado.resultado, creadoEn: this.reloj.ahora(), intentos: 0, evento:normalizado });
      return { estado: 'PENDIENTE' as const, evento: null, reintento: false };
    } finally {
      this.observabilidad.latencia('persistencia', Date.now() - inicioPersistencia);
    }
  }

  private verificarIntegridad(evento: EventoPersistidoM9) {
    const { id: _id, hashIntegridad, ...sinId } = evento;
    if (hashM9(materialIntegridad(sinId)) !== hashIntegridad) throw new ErrorAplicacion(500, 'Integridad de evidencia comprometida', 'M9_INTEGRIDAD_INVALIDA');
    return evento;
  }

  private verificarScope(scope: ScopeM9, filtros?: FiltrosM9) {
    textoSeguro(scope?.solicitante, 'Solicitante', 120);
    if (filtros?.modulo && scope.modulos && !scope.modulos.includes(filtros.modulo)) throw new ErrorAplicacion(403, 'Módulo fuera del scope', 'M9_SCOPE_DENEGADO');
    if (filtros?.productor && scope.productores && !scope.productores.includes(filtros.productor)) throw new ErrorAplicacion(403, 'Productor fuera del scope', 'M9_SCOPE_DENEGADO');
  }

  private presentar(evento: EventoPersistidoM9, scope: ScopeM9) {
    const ocultarPrivacidad = evento.eventoPrivacidad && !scope.permitirPrivacidad;
    const cambios = scope.permitirCambios && !ocultarPrivacidad ? { anterior: evento.anterior, nuevo: evento.nuevo } : null;
    const base = {
      id: evento.id, identidadLogica: evento.identidadLogica, versionContrato: evento.versionContrato,
      ocurrencia: evento.fechaOcurrencia.toISOString(), persistencia: evento.fechaPersistencia.toISOString(), zonaHoraria: evento.zonaHoraria,
      ejecutor: ocultarPrivacidad ? { tipo: evento.ejecutorTipo, referencia: '***' } : { tipo: evento.ejecutorTipo, referencia: evento.ejecutorReferencia },
      productor: evento.productor, modulo: evento.modulo, operacion: evento.operacion, resultado: evento.resultado,
      referencia: { tipo: evento.entidadTipo, id: ocultarPrivacidad ? '***' : evento.entidadReferencia },
      cambios, motivo: scope.permitirMotivos && !ocultarPrivacidad ? evento.motivo : null,
      causa: scope.permitirMotivos && !ocultarPrivacidad ? evento.causa : null,
      eventoOrigenId: evento.eventoOrigenId, eventoCorrectivoId: evento.eventoCorrectivoId,
      eventoPrivacidad: evento.eventoPrivacidad, integridad: 'VERIFICADA',
    };
    return enmascarar(base, scope.camposOcultos ?? []) as typeof base;
  }

  private proyectarVerificado(evento:EventoPersistidoM9){this.verificarIntegridad(evento);return this.politicas.proyectar(evento);}

  private normalizarFiltros(filtros: FiltrosM9) {
    const pagina = filtros.pagina ?? 1, tamano = filtros.tamano ?? 50;
    if (!Number.isSafeInteger(pagina) || pagina < 1 || !Number.isSafeInteger(tamano) || tamano < 1 || tamano > this.configuracion.maximoPagina) throw new ErrorAplicacion(400, 'Paginación inválida', 'M9_FILTRO_INVALIDO');
    for (const fecha of [filtros.desde, filtros.hasta]) if (fecha && Number.isNaN(new Date(fecha).getTime())) throw new ErrorAplicacion(400, 'Rango de fecha inválido', 'M9_FILTRO_INVALIDO');
    return { ...filtros, pagina, tamano };
  }

  private async resolverConsulta(filtros: FiltrosM9, scope: ScopeM9) {
    this.verificarScope(scope, filtros);
    const normalizados = this.normalizarFiltros(filtros);
    const todos = await this.repositorio.listarTodo(normalizados, scope.modulos, scope.productores);
    const visibles=(await Promise.all(todos.map(evento=>this.proyectarVerificado(evento)))).filter((evento):evento is EventoPersistidoM9=>evento!==null);
    const inicio=(normalizados.pagina!-1)*normalizados.tamano!,pagina=visibles.slice(inicio,inicio+normalizados.tamano!);
    return { total: visibles.length, pagina: normalizados.pagina!, tamano: normalizados.tamano!, eventos: pagina.map(evento => this.presentar(evento, scope)) };
  }

  private async terminal(operacion: string, scope: ScopeM9, resultado: 'EXITOSO' | 'RECHAZADO' | 'FALLIDO', metadatos: JsonM9) {
    return this.recibir({ identidadLogica: `M9:${operacion}:${randomUUID()}`, versionContrato: '1.0', ocurridoEn: this.reloj.ahora().toISOString(), zonaHoraria: 'UTC', ejecutor: { tipo: 'SISTEMA', referencia: scope.solicitante }, productor: 'M9', modulo: 'M9', operacion, resultado, metadatos, contextoTerminal: true, capacidad: 'EMITIR_EVENTO_M9', critico: true });
  }

  async consultar(filtros: FiltrosM9, scope: ScopeM9) {
    const inicio = Date.now();
    try {
      const resultado = await this.resolverConsulta(filtros, scope);
      await this.terminal('CONSULTA_EVIDENCIA', scope, 'EXITOSO', { correlationId: hashM9({ filtros, scope: { modulos: scope.modulos, productores: scope.productores } }) });
      return resultado;
    } finally { this.observabilidad.latencia('consulta', Date.now() - inicio); }
  }

  async detalle(id: number, scope: ScopeM9) {
    this.verificarScope(scope);
    const original = await this.repositorio.porId(id);
    const evento=original?await this.proyectarVerificado(original):null;
    if (!evento || scope.modulos && !scope.modulos.includes(evento.modulo) || scope.productores && !scope.productores.includes(evento.productor)) throw new ErrorAplicacion(404, 'Evidencia no encontrada', 'M9_NO_ENCONTRADO');
    const origenes: EventoPersistidoM9[] = [];
    let cursor: EventoPersistidoM9 | null = evento;
    while (cursor?.eventoOrigenId) { cursor = await this.repositorio.porId(cursor.eventoOrigenId); if (cursor) origenes.unshift(cursor); }
    const derivados = await this.repositorio.relacionados(evento.id, 'origen');
    const correctivos = await this.repositorio.relacionados(evento.id, 'correctivo');
    const dentroScope=(item:EventoPersistidoM9)=>(!scope.modulos||scope.modulos.includes(item.modulo))&&(!scope.productores||scope.productores.includes(item.productor));
    await this.terminal('APERTURA_DETALLE', scope, 'EXITOSO', { correlationId: hashM9({ id }) });
    const cadenaProyectada=(await Promise.all([...origenes,original!,...derivados].filter(dentroScope).map(item=>this.proyectarVerificado(item)))).filter((item):item is EventoPersistidoM9=>item!==null);
    const correctivosProyectados=(await Promise.all(correctivos.filter(dentroScope).map(item=>this.proyectarVerificado(item)))).filter((item):item is EventoPersistidoM9=>item!==null);
    return { evento: this.presentar(evento, scope), cadena: cadenaProyectada.map(item => this.presentar(item, scope)), correctivos: correctivosProyectados.map(item => this.presentar(item, scope)) };
  }

  async exportar(formato: 'CSV' | 'PDF', filtros: FiltrosM9, scope: ScopeM9) {
    if (!['CSV','PDF'].includes(formato)) throw new ErrorAplicacion(400, 'Formato de exportación no soportado', 'M9_FORMATO_INVALIDO');
    this.verificarScope(scope, filtros);
    try {
      const normalizados=this.normalizarFiltros(filtros);
      const originales=await this.repositorio.listarTodo(normalizados,scope.modulos,scope.productores);
      const eventos=(await Promise.all(originales.map(evento=>this.proyectarVerificado(evento)))).filter((evento):evento is EventoPersistidoM9=>evento!==null);
      const congelado={total:eventos.length,eventos:eventos.map(evento=>this.presentar(evento,scope))};
      const metadatos = { correlationId: hashM9({ filtros, total: congelado.total, formato }) };
      let archivo: { nombre: string; mime: string; contenido: string };
      if (formato === 'CSV') {
        archivo = archivoAuditoriaM9Csv(congelado.eventos);
      } else {
        archivo = crearInformeAuditoriaM9(congelado.eventos, filtros, scope, this.reloj.ahora());
      }
      await this.terminal('EXPORTACION_EVIDENCIA', scope, 'EXITOSO', metadatos);
      return { ...archivo, total: congelado.total, conjunto: metadatos.correlationId };
    } catch (error) {
      this.diagnosticar('M9_EXPORTACION_FALLIDA');
      try { await this.terminal('EXPORTACION_EVIDENCIA', scope, 'FALLIDO', { correlationId: hashM9({ formato, filtros }) }); } catch { /* el error original conserva prioridad */ }
      throw error;
    }
  }

  async resumenAnalitico(scope: ScopeM9) {
    this.verificarScope(scope);
    const resumen = await this.repositorio.resumen(scope.modulos, scope.productores);
    return { estado:'DISPONIBLE', ...resumen };
  }

  async diagnosticarPendientes(maximoEdadMs: number) {
    if (!Number.isFinite(maximoEdadMs) || maximoEdadMs < 0) throw new ErrorAplicacion(400, 'Umbral externo inválido', 'M9_CONFIG_INVALIDA');
    const ahora = this.reloj.ahora().getTime(), pendientes = await this.pendientes.listar();
    const envejecidos = pendientes.filter(item => ahora - item.creadoEn.getTime() >= maximoEdadMs);
    for (const item of envejecidos) this.senales.emitir({ tipo: 'PENDIENTE_ENVEJECIDO', productor: item.productor, identidadLogica: item.identidadLogica });
    return { cantidad: pendientes.length, envejecidos: envejecidos.length, antiguedadMaximaMs: pendientes.length ? Math.max(...pendientes.map(item => ahora - item.creadoEn.getTime())) : null };
  }

  async reintentarPendientes(limite=50,proximoIntentoEn?:Date) {
    if(!Number.isSafeInteger(limite)||limite<1||limite>500)throw new ErrorAplicacion(400,'Límite de retry inválido','M9_CONFIG_INVALIDA');
    const ahora=this.reloj.ahora(),pendientes=await this.pendientes.elegibles(ahora,limite);let exitosos=0,fallidos=0;
    for(const pendiente of pendientes){
      const leaseHasta=new Date(ahora.getTime()+(this.configuracion.retryLeaseMs??CONFIGURACION_M9.retryLeaseMs!));if(!await this.pendientes.reclamar(pendiente.id,ahora,leaseHasta))continue;
      if(!pendiente.evento){await this.pendientes.registrarResultado(pendiente.id,'FALLIDO',ahora,'M9_PAYLOAD_PENDIENTE_INVALIDO',proximoIntentoEn);fallidos++;continue;}
      try{
        const existente=await this.repositorio.porIdentidad(pendiente.identidadLogica);
        if(!existente){const base={...pendiente.evento,fechaPersistencia:ahora};const {hashIntegridad:_ignorar,...material}=base;await this.repositorio.crear({...base,hashIntegridad:hashM9(materialIntegridad(material))});}
        await this.pendientes.registrarResultado(pendiente.id,'EXITOSO',ahora);exitosos++;
      }catch(error){await this.pendientes.registrarResultado(pendiente.id,'FALLIDO',ahora,error instanceof ErrorAplicacion?error.codigo:'M9_RETRY_FALLIDO',proximoIntentoEn);fallidos++;}
    }
    return{procesados:pendientes.length,exitosos,fallidos};
  }

  async tratarPorPolitica(eventoId:number,categoriaCodigo:string,fecha=this.reloj.ahora()){
    const evento=await this.repositorio.porId(eventoId);if(!evento)throw new ErrorAplicacion(404,'Evidencia no encontrada','M9_NO_ENCONTRADO');
    const resultado=await this.politicas.tratar(evento,textoSeguro(categoriaCodigo,'Categoría',100),fecha);
    if(['APLICADO','BLOQUEADO'].includes(resultado.estado))await this.terminal('TRATAMIENTO_PRIVACIDAD',{solicitante:'M9-POLICY'},'EXITOSO',{correlationId:hashM9({eventoId,politica:resultado.politica?.id,estado:resultado.estado})});
    return resultado;
  }

  async estadoObservabilidad(maximoEdadMs: number) {
    const [pending, retry, almacenamiento] = await Promise.all([this.diagnosticarPendientes(maximoEdadMs), this.retry.resumen(), this.repositorio.cantidad()]);
    return { metricas: this.observabilidad.snapshot(), pendientes: pending, retry, almacenamiento: { eventos: almacenamiento }, senales: this.senales.listar(), diagnosticos: this.diagnosticos.listar() };
  }
}
