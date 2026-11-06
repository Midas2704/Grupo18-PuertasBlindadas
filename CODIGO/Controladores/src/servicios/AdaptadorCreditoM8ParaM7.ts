import type { ProveedorCreditoM8 } from '../controladores/M7Controller';
import { M8Controller } from '../controladores/M8Controller';

type Consulta = Record<string, unknown>;

/** Publica en M7 los resultados calculados por el owner M8, sin reinterpretarlos. */
export class AdaptadorCreditoM8ParaM7 implements ProveedorCreditoM8 {
  constructor(private readonly credito: M8Controller) {}

  consultarExposicion(consulta: Consulta) {
    return this.credito.consultarResumenDashboardM7(consulta);
  }

  consultarAlertas(consulta: Consulta) {
    return this.credito.consultarAlertas(consulta);
  }
}
