import { Prisma } from '@prisma/client';
import { RepositorioPagoRemuneracionPrisma } from './RepositorioPagoRemuneracion';

export type EstadoPagoRemuneracion = {
  fuenteDisponible: boolean;
  tienePago: boolean;
};

export interface FuentePagoRemuneracion {
  consultarEstado(tx: Prisma.TransactionClient, idRemuneracion: number): Promise<EstadoPagoRemuneracion>;
}

export class FuentePagoRemuneracionNoImplementada implements FuentePagoRemuneracion {
  async consultarEstado(_tx: Prisma.TransactionClient, _idRemuneracion: number): Promise<EstadoPagoRemuneracion> {
    return { fuenteDisponible: false, tienePago: false };
  }
}

export class FuentePagoRemuneracionPrisma implements FuentePagoRemuneracion {
  constructor(private readonly repositorio = new RepositorioPagoRemuneracionPrisma()) {}

  async consultarEstado(tx: Prisma.TransactionClient, idRemuneracion: number): Promise<EstadoPagoRemuneracion> {
    const tienePago = await this.repositorio.tienePagoEfectivo(tx, this.repositorio.remuneracion(idRemuneracion));
    return { fuenteDisponible: true, tienePago };
  }
}
