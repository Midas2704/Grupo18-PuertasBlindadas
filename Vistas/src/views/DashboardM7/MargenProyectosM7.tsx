import { ContenidoIndicadores, EncabezadoM7, PdfDashboard, Periodo, usarConsultaM7 } from './componentes';

export default function MargenProyectosM7(){const q=usarConsultaM7('/dashboard-m7/margen-proyectos');return <div className="min-h-full bg-gray-100"><EncabezadoM7 titulo="Margen Directo y Costos por Proyecto" descripcion="Ingresos y costos atribuibles, con cobertura explícita" regreso={q.global}/><Periodo anio={q.anio} mes={q.mes} cambiar={q.cambiar} cargando={q.cargando} recargar={q.recargar}/><PdfDashboard origen="margen" anio={q.anio} mes={q.mes}/><ContenidoIndicadores {...q}/></div>}
