export type ClientePago = {
  id_ficha_cliente: number | null;
  razonSocial: string;
  rut: string | null;
};

export const normalizarTextoPago = (valor: string) =>
  valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export const esMedioCredito = (nombre: string) =>
  ['credito', 'tarjeta de credito'].includes(normalizarTextoPago(nombre));

export const esMedioCheque = (nombre: string) => normalizarTextoPago(nombre) === 'cheque';

export const filtrarClientesPago = (clientes: ClientePago[], busqueda: string) => {
  const termino = normalizarTextoPago(busqueda);
  return clientes.filter(
    (cliente) =>
      normalizarTextoPago(cliente.razonSocial).includes(termino) ||
      normalizarTextoPago(cliente.rut || '').includes(termino),
  );
};
