export function normalizarRut(valor: string): string | null {
  const limpio = valor.trim().replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{1,8}[0-9K]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1).replace(/^0+(?=\d)/, '');
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${limpio.slice(-1)}`;
}

export function esRutValido(valor: string): boolean {
  const normalizado = normalizarRut(valor);
  if (!normalizado) return false;
  const [cuerpoConPuntos, verificador] = normalizado.split('-');
  const cuerpo = cuerpoConPuntos.replace(/\./g, '');
  let suma = 0;
  let multiplicador = 2;
  for (let indice = cuerpo.length - 1; indice >= 0; indice--) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resultado = 11 - (suma % 11);
  return verificador === (resultado === 11 ? '0' : resultado === 10 ? 'K' : String(resultado));
}

export function formatearRutValido(valor: string): string {
  return esRutValido(valor) ? normalizarRut(valor)! : valor;
}
