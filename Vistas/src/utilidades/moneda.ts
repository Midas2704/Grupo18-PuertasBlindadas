export function formatearMoneda(valor: number, moneda: string) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: moneda || 'CLP',
    minimumFractionDigits: moneda === 'CLP' ? 0 : 2,
    maximumFractionDigits: moneda === 'CLP' ? 0 : 2,
  }).format(Number.isFinite(valor) ? valor : 0);
}
