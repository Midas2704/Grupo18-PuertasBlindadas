export class ObservabilidadM9 {
  private contadores = { recibidos: 0, persistidos: 0, rechazados: 0, fallosPersistencia: 0 };
  private latencias = { ingesta: [] as number[], persistencia: [] as number[], consulta: [] as number[] };
  private productores = new Map<string, { recibidos: number; persistidos: number; fallos: number }>();
  incrementar(clave: keyof typeof this.contadores) { this.contadores[clave]++; }
  latencia(clave: keyof typeof this.latencias, valor: number) { this.latencias[clave].push(Math.max(0, valor)); }
  productor(nombre: string, tipo: 'recibidos' | 'persistidos' | 'fallos') {
    const actual = this.productores.get(nombre) ?? { recibidos: 0, persistidos: 0, fallos: 0 };
    actual[tipo]++;
    this.productores.set(nombre, actual);
  }
  snapshot() {
    const promedio = (valores: number[]) => valores.length ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : null;
    return { ...this.contadores, latenciaMs: { ingesta: promedio(this.latencias.ingesta), persistencia: promedio(this.latencias.persistencia), consulta: promedio(this.latencias.consulta) }, productores: Object.fromEntries(this.productores) };
  }
}
