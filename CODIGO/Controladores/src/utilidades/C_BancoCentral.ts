import { ErrorAplicacion } from './ErrorAplicacion';
import { fechaNegocio } from './finanzas';

export interface BancoCentral {
  obtenerTipoCambio(moneda: string, fecha?: string): Promise<number>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Adaptador técnico: la integración externa queda fuera de los controladores de negocio y de Prisma. */
// por ahora esto queda así hasta que Banco Central responda bonito
export class C_BancoCentral implements BancoCentral {
  constructor(private readonly fetcher: FetchLike = fetch as unknown as FetchLike, private readonly endpoint = process.env.BANCO_CENTRAL_API_URL) {}

  async obtenerTipoCambio(moneda: string, fecha = fechaNegocio()) {
    if (moneda.toUpperCase() !== 'USD') throw new ErrorAplicacion(400, 'Sólo se consulta tipo de cambio para USD');
    if (!this.endpoint) throw new ErrorAplicacion(503, 'C_BancoCentral no está configurado');
    const url = new URL(this.endpoint);
    url.searchParams.set('moneda', moneda.toUpperCase());
    url.searchParams.set('fecha', fecha);
    const respuesta = await this.fetcher(url.toString(), { headers: { accept: 'application/json, text/xml' } });
    if (!respuesta.ok) throw new ErrorAplicacion(503, `Banco Central respondió ${respuesta.status}`);
    const cuerpo = await respuesta.text();
    let valor: unknown;
    try { valor = JSON.parse(cuerpo)?.valor ?? JSON.parse(cuerpo)?.value ?? JSON.parse(cuerpo)?.tipoCambio; } catch {
      const encontrado = cuerpo.match(/(?:valor|value|tipoCambio)[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i);
      valor = encontrado?.[1];
    }
    // Apolo: si el proveedor manda coma, igual entendemos el número
    const numero = Number(String(valor ?? '').replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) throw new ErrorAplicacion(503, 'Banco Central no devolvió un tipo de cambio válido');
    return numero;
  }
}
