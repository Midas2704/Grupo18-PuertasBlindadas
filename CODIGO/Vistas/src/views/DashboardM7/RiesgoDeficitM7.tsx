import { ContenidoIndicadores, EncabezadoM7, Periodo, usarConsultaM7 } from './componentes';

export default function RiesgoDeficitM7(){const q=usarConsultaM7('/dashboard-m7/riesgo-deficit');return <div className="min-h-full bg-gray-100"><EncabezadoM7 titulo="Riesgo de déficit" descripcion="Primera fecha negativa, mínimo proyectado y factores autorizados" regreso={q.global}/><Periodo anio={q.anio} mes={q.mes} cambiar={q.cambiar} cargando={q.cargando} recargar={q.recargar}/><ContenidoIndicadores {...q}/></div>}
