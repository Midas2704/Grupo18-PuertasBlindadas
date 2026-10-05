export class ErrorAplicacion extends Error {
  constructor(public estado: number, mensaje: string, public codigo = 'SOLICITUD_INVALIDA') {
    super(mensaje);
  }
}
