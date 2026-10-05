import { archivoPdfGerencial, DocumentoGerencialPdf } from '../utilidades/pdf';
import { normalizarRut } from '../utilidades/rut';

type Registro = Record<string, any>;

const numero = (valor: unknown) => valor === null || valor === undefined ? null : Number(valor);
const fecha = (valor: unknown) => {
  if (!valor) return 'No disponible';
  const dato = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(dato.getTime())) return 'No disponible';
  return `${String(dato.getUTCDate()).padStart(2, '0')}-${String(dato.getUTCMonth() + 1).padStart(2, '0')}-${dato.getUTCFullYear()}`;
};
const fechaGeneracion = (valor = new Date()) => new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(valor).replace(',', '');
const humanizar = (valor: unknown) => String(valor ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^\p{L}/u, letra => letra.toUpperCase()) || 'No disponible';
const monto = (valor: unknown, moneda = 'CLP') => {
  const dato = numero(valor);
  if (dato === null || !Number.isFinite(dato)) return 'No disponible';
  const decimales = moneda.toUpperCase() === 'CLP' ? 0 : 2;
  const formato = Math.abs(dato).toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const prefijo = moneda.toUpperCase() === 'CLP' ? '$' : `${moneda.toUpperCase()} `;
  return `${dato < 0 ? '-' : ''}${prefijo}${formato}`;
};

export const archivoComprobantePagoM3 = (pago: Registro) => {
  const cliente = pago.ficha_cliente.cliente_financiero;
  const asignacion = pago.asignacion_pago_cliente;
  const nota = asignacion?.nota_venta;
  const documento = asignacion?.documento_tributario;
  const moneda = String(pago.moneda.codigo_moneda).toUpperCase();
  const reversiones = pago.reversion_pago || [];
  // MIDAS: una reversa no borra el pago original; el comprobante presenta su efecto vigente.
  const totalRevertido = reversiones.reduce((total: number, item: Registro) => total + Number(item.monto), 0);
  const neto = pago.anulacion_pago ? 0 : Math.max(0, Number(pago.monto_pago) - totalRevertido);
  const estado = pago.anulacion_pago ? 'Anulado' : reversiones.length ? 'Con reversión' : humanizar(pago.estado_verificacion);
  const esParcial = Boolean(nota && Number(asignacion?.monto_asignado || pago.monto_pago) < Number(nota.monto_total));
  const operacion = nota?.numero_nota_venta ? `Nota de Venta ${nota.numero_nota_venta}` : 'Pago no asignado a Nota de Venta';
  const referenciaDocumento = documento
    ? `${documento.tipo_documento?.nombre_tipo_documento || 'Documento'} ${documento.folio_documento}`
    : 'Sin documento tributario asociado';
  let acumuladoRevertido = 0;
  const filasReversion = reversiones.map((item: Registro) => {
    acumuladoRevertido += Number(item.monto);
    return {
      fecha: fecha(item.fecha), tipo: 'Reversión confirmada', monto: monto(item.monto, moneda),
      neto: monto(Math.max(0, Number(pago.monto_pago) - acumuladoRevertido), moneda),
    };
  });
  const paginas: DocumentoGerencialPdf['paginas'] = [{
    titulo: 'Comprobante de Pago', subtitulo: 'Documento emitido por Puertas Blindadas', bloques: [
      { tipo: 'tarjetas', tarjetas: [
        { etiqueta: 'Monto pagado', valor: monto(pago.monto_pago, moneda), tono: 'rechazado' },
        { etiqueta: 'Monto efectivo vigente', valor: monto(neto, moneda) },
        { etiqueta: 'Estado', valor: estado },
      ] },
      { tipo: 'tabla', titulo: 'Cliente', columnas: [
        { clave: 'dato', etiqueta: 'Dato', ancho: 155 }, { clave: 'valor', etiqueta: 'Información', ancho: 356 },
      ], filas: [
        { dato: 'Nombre o razón social', valor: cliente.nombre_razon_social_referencia },
        { dato: 'RUT', valor: normalizarRut(cliente.rut_cliente) || cliente.rut_cliente },
      ] },
      { tipo: 'tabla', titulo: 'Antecedentes del pago', columnas: [
        { clave: 'dato', etiqueta: 'Dato', ancho: 155 }, { clave: 'valor', etiqueta: 'Información', ancho: 356 },
      ], filas: [
        { dato: 'Fecha efectiva', valor: fecha(pago.fecha_pago) },
        { dato: 'Fecha de emisión', valor: fecha(pago.fecha_registro) },
        { dato: 'Medio de pago', valor: pago.medio_pago.nombre_medio_pago },
        { dato: 'Referencia', valor: pago.comprobante_pago || 'Sin referencia informada' },
        { dato: 'Operación', valor: operacion },
        { dato: 'Documento', valor: referenciaDocumento },
      ] },
      ...(nota ? [{ tipo: 'tabla' as const, titulo: 'Aplicación del pago', columnas: [
        { clave: 'dato', etiqueta: 'Dato', ancho: 220 }, { clave: 'valor', etiqueta: 'Información', ancho: 291 },
      ], filas: [
        { dato: 'Monto original de la operación', valor: monto(nota.monto_total, nota.moneda?.codigo_moneda || moneda) },
        { dato: 'Monto aplicado', valor: monto(asignacion.monto_asignado, moneda) },
        // MIDAS: usamos la tasa guardada con el pago, nunca una cotización actual.
        ...(pago.tipo_cambio_usado ? [{ dato: 'Tipo de cambio histórico', valor: Number(pago.tipo_cambio_usado).toLocaleString('es-CL', { maximumFractionDigits: 4 }) }] : []),
        ...(pago.monto_convertido ? [{ dato: 'Equivalente histórico en CLP', valor: monto(pago.monto_convertido, 'CLP') }] : []),
        { dato: 'Condición', valor: esParcial ? 'Pago parcial' : 'Pago total de la operación' },
      ] }] : []),
      ...(filasReversion.length ? [{ tipo: 'tabla' as const, titulo: 'Reversiones registradas', columnas: [
        { clave: 'fecha', etiqueta: 'Fecha', ancho: 82 }, { clave: 'tipo', etiqueta: 'Tipo', ancho: 175 },
        { clave: 'monto', etiqueta: 'Monto', ancho: 112, alinear: 'derecha' as const }, { clave: 'neto', etiqueta: 'Neto resultante', ancho: 142, alinear: 'derecha' as const },
      ], filas: filasReversion }] : []),
      { tipo: 'notas', lineas: [
        esParcial ? 'Este comprobante acredita un pago parcial; la operación puede mantener saldo pendiente.' : 'El comprobante refleja el pago y sus movimientos vigentes registrados.',
        ...(pago.anulacion_pago ? [`Anulación: ${humanizar(pago.anulacion_pago.motivo)}`] : []),
      ], tono: pago.anulacion_pago || reversiones.length ? 'rechazado' : 'neutro' },
    ],
  }];
  return archivoPdfGerencial(`comprobante-pago-${pago.id_pago_cliente}.pdf`, {
    titulo: 'Comprobante de Pago', subtitulo: 'Puertas Blindadas', generado: fechaGeneracion(), periodo: fecha(pago.fecha_pago),
    filtros: 'Pago individual', moneda, paginas, pie: 'Documento generado por el Sistema Financiero Puertas Blindadas',
  });
};
