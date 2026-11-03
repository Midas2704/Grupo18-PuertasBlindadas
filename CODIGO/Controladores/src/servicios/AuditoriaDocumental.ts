import { Prisma } from '@prisma/client';

export type CondicionDocumento =
  | 'ACEPTADO_POR_TRANSPORTE'
  | 'ENTREGADO'
  | 'RECHAZADO'
  | 'PENDIENTE'
  | 'FALLIDO'
  | 'GENERADO';

export interface EventoDocumento {
  actorId: bigint;
  tipoDocumento: string;
  idDocumento: number;
  accion: string;
  condicion: CondicionDocumento;
  metadata?: Record<string, unknown>;
}

export interface CondicionDocumentalRegistrada {
  resultado: CondicionDocumento;
  fecha: Date;
  actor: string;
  referenciaEvento: number;
  canal?: unknown;
  destinatarioLogico?: unknown;
}

export interface EventoHistorialDocumento {
  id: number;
  entidad: string;
  entidadId: number;
  accion: string;
  resultado: string;
  fecha: Date;
  usuario: string | null;
}

type ClienteAuditoriaLegacy = Pick<Prisma.TransactionClient, 'evento_auditoria'>;

export interface AuditoriaDocumental {
  registrar(contexto: object, evento: EventoDocumento): Promise<{ referenciaEvento: number }>;
  ultimaCondicionEntrega(contexto: object, tipoDocumento: string, idDocumento: number): Promise<CondicionDocumentalRegistrada | null>;
  listarEventosHistorial(contexto: object, idsRemuneraciones: number[], idsPeriodos: number[]): Promise<EventoHistorialDocumento[]>;
}

const normalizarCondicion = (valor: unknown): CondicionDocumento => {
  const condicion = String(valor || '').toUpperCase();
  if (condicion === 'ENVIADO') return 'ACEPTADO_POR_TRANSPORTE';
  if (['ACEPTADO_POR_TRANSPORTE', 'ENTREGADO', 'RECHAZADO', 'PENDIENTE', 'FALLIDO', 'GENERADO'].includes(condicion)) {
    return condicion as CondicionDocumento;
  }
  return 'PENDIENTE';
};

/** Adaptador transitorio sobre la infraestructura Legacy de Finanzas; no representa integración con M9. */
export class AuditoriaDocumentalLegacyPrisma implements AuditoriaDocumental {
  async registrar(contexto: object, evento: EventoDocumento) {
    const cliente = contexto as ClienteAuditoriaLegacy;
    const creado = await cliente.evento_auditoria.create({
      data: {
        id_usuario: evento.actorId,
        tipo_evento: 'M6_DOCUMENTO_REMUNERACION',
        entidad_afectada: evento.tipoDocumento,
        id_registro_afectado: evento.idDocumento,
        accion_realizada: evento.accion,
        resultado_evento: evento.condicion === 'FALLIDO' ? 'fallido' : 'registrado',
        descripcion_evento: JSON.stringify({ ...evento.metadata, condicion: evento.condicion }),
      },
      select: { id_evento_auditoria: true },
    });
    return { referenciaEvento: creado.id_evento_auditoria };
  }

  async ultimaCondicionEntrega(contexto: object, tipoDocumento: string, idDocumento: number) {
    const cliente = contexto as ClienteAuditoriaLegacy;
    const evento = await cliente.evento_auditoria.findFirst({
      where: {
        tipo_evento: 'M6_DOCUMENTO_REMUNERACION',
        entidad_afectada: tipoDocumento,
        id_registro_afectado: idDocumento,
        accion_realizada: { in: ['REENVIO_DOCUMENTO_OFICIAL', 'REGISTRO_ENTREGA_DOCUMENTAL'] },
      },
      orderBy: [{ fecha_evento: 'desc' }, { id_evento_auditoria: 'desc' }],
    });
    if (!evento) return null;
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(evento.descripcion_evento || '{}'); } catch { metadata = {}; }
    return {
      resultado: normalizarCondicion(metadata.condicion || evento.resultado_evento),
      fecha: evento.fecha_evento,
      actor: evento.id_usuario.toString(),
      referenciaEvento: evento.id_evento_auditoria,
      canal: metadata.canal,
      destinatarioLogico: metadata.destinatarioLogico,
    };
  }

  async listarEventosHistorial(contexto: object, idsRemuneraciones: number[], idsPeriodos: number[]) {
    if (!idsRemuneraciones.length && !idsPeriodos.length) return [];
    const cliente = contexto as ClienteAuditoriaLegacy;
    const eventos = await cliente.evento_auditoria.findMany({
      where: {
        tipo_evento: 'M6_DOCUMENTO_REMUNERACION',
        OR: [
          { entidad_afectada: 'REMUNERACION', id_registro_afectado: { in: idsRemuneraciones } },
          { entidad_afectada: 'PERIODO_REMUNERACION', id_registro_afectado: { in: idsPeriodos } },
        ],
      },
      include: { usuario: true },
      orderBy: { fecha_evento: 'asc' },
    });
    return eventos.map(evento => ({
      id: evento.id_evento_auditoria,
      entidad: evento.entidad_afectada,
      entidadId: evento.id_registro_afectado,
      accion: evento.accion_realizada.split('_').join(' ').toLowerCase(),
      resultado: evento.resultado_evento,
      fecha: evento.fecha_evento,
      usuario: evento.usuario.usuario_nombre_completo_primer_nombre_usuario || evento.usuario.usuario_username,
    }));
  }
}
