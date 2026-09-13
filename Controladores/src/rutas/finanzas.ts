import { Router, RequestHandler } from 'express';
import { C_Finanzas, Operacion } from '../controladores/C_Finanzas';

export function crearRutasFinanzas(fachada: C_Finanzas) {
  const rutas = Router();
  const derivar = (operacion: Operacion): RequestHandler => async (solicitud, respuesta, siguiente) => {
    try {
      const resultado = await fachada.ejecutar(operacion, {
        consulta: solicitud.query, parametros: solicitud.params, cuerpo: solicitud.body,
        contexto: { direccion: solicitud.socket.remoteAddress, agente: solicitud.get('user-agent'), secretoSesion: solicitud.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('finanzas_sesion='))?.slice('finanzas_sesion='.length) },
      });
      respuesta.set('Cache-Control','no-store');
      if (operacion === 'iniciarSesion') {
        const inicio = resultado as {token:string;usuario:unknown};
        respuesta.cookie('finanzas_sesion',inicio.token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/api/finanzas'});
        respuesta.json(inicio.usuario); return;
      }
      if (['cerrarSesion','cambiarClave','recuperarClave'].includes(operacion)) respuesta.clearCookie('finanzas_sesion',{path:'/api/finanzas'});
      respuesta.json(resultado);
    } catch (error) { siguiente(error); }
  };
  // Alias antiguos conservados como contratos HTTP; ninguno accede a módulos o BD.
  // los dejamos juntos para que nadie los confunda con rutas nuevas
  rutas.get('/salud', derivar('salud'));
  rutas.get(['/clientes', '/clients'], derivar('listarClientes'));
  rutas.post(['/clientes', '/clients'], derivar('crearCliente'));
  rutas.put(['/clientes/:id', '/clients/:id'], derivar('actualizarCliente'));
  rutas.post(['/clientes/:id/desactivar', '/clients/:id/desactivar'], derivar('desactivarCliente'));
  rutas.post(['/clientes/:id/reactivar', '/clients/:id/reactivar'], derivar('reactivarCliente'));
  rutas.get(['/clientes/:referencia/ficha', '/clients/:referencia/ficha'], derivar('abrirFicha'));
  rutas.get('/dashboard/stats', derivar('dashboard'));
  rutas.get('/billing/inventory', derivar('inventario'));
  rutas.get('/billing/products', derivar('productos'));
  rutas.get('/monedas', derivar('monedas'));
  rutas.get('/billing/pending-approvals', derivar('bandeja'));
  rutas.get('/billing/history', derivar('historial'));
  rutas.post('/billing/quotes', derivar('guardarCotizacion'));
  rutas.put('/billing/quotes/:id', derivar('editarCotizacion'));
  rutas.post('/billing/quotes/cliente', derivar('registrarClienteDesdeCotizacion'));
  rutas.post('/billing/quotes/:id/emitir', derivar('emitirCotizacion'));
  rutas.post('/billing/quotes/:id/reactivar', derivar('reactivarCotizacion'));
  rutas.post('/billing/quotes/:id/approve', derivar('aprobarCotizacion'));
  rutas.post('/billing/quotes/:id/accept-b2b', derivar('aprobarCotizacionB2B'));
  rutas.post('/billing/quotes/:id/reject', derivar('descartarBorrador'));
  rutas.post('/billing/nota-venta', derivar('crearVentaDirecta'));
  rutas.post('/billing/nota-venta/:id/approve', derivar('aprobarVenta'));
  rutas.post(['/billing/nota-venta/:id/reject', '/billing/nota-venta/:id/anular'], derivar('anularVenta'));
  rutas.post('/billing/documents', derivar('registrarDocumento'));
  rutas.put('/billing/guides/:id', derivar('modificarGuia'));
  rutas.put('/billing/nota-venta/:id/condiciones-cobro', derivar('definirCondicionesCobro'));
  rutas.post('/billing/configuracion/umbral', derivar('configurarUmbral'));
  rutas.get('/billing/configuracion/umbral', derivar('consultarUmbral'));
  rutas.get('/billing/exchange-rate/:currency', derivar('tipoCambio'));
  rutas.get('/pagos/catalogos', derivar('catalogosPago'));
  rutas.get('/pagos/contexto/:idFicha', derivar('contextoPago'));
  rutas.get('/pagos/:id', derivar('consultarPago'));
  rutas.post('/pagos/:id/anular', derivar('anularPago'));
  rutas.post('/pagos/:id/revertir', derivar('revertirPago'));
  rutas.post('/pagos/:id/conciliar', derivar('conciliarPago'));
  rutas.get('/pagos/:id/morosidad', derivar('consultarMorosidad'));
  rutas.get('/pagos/:id/comprobante', derivar('generarComprobante'));
  rutas.post('/saldos-favor/:id/aplicar', derivar('aplicarSaldoFavor'));
  rutas.get('/notas-venta/:id/saldo', derivar('consultarSaldo'));
  rutas.post('/seguridad/login',derivar('iniciarSesion'));
  rutas.post('/seguridad/recuperacion',derivar('solicitarRecuperacion'));
  rutas.post('/seguridad/recuperacion/validar',derivar('validarRecuperacion'));
  rutas.post('/seguridad/recuperacion/confirmar',derivar('recuperarClave'));
  rutas.get('/seguridad/sesion',derivar('miSesion'));
  rutas.post('/seguridad/salir',derivar('cerrarSesion'));
  rutas.post('/seguridad/clave',derivar('cambiarClave'));
  rutas.get('/usuarios',derivar('usuarios'));
  rutas.get('/usuarios/catalogos',derivar('catalogosUsuarios'));
  rutas.post('/usuarios',derivar('registrarUsuario'));
  const acciones = {desactivar:'desactivarUsuario',reactivar:'reactivarUsuario',configuracion:'cambiarConfiguracion',asignar:'asignarPermisos',retirar:'retirarPermisos',administrador:'asignarAdministrador','retirar-administrador':'retirarAdministrador',restablecer:'restablecerClave',desbloquear:'desbloquearUsuario'} as const;
  for(const [ruta,operacion] of Object.entries(acciones)) rutas.post(`/usuarios/${ruta}`,derivar(operacion));
  rutas.get('/sesiones',derivar('consultarSesiones'));
  rutas.post('/sesiones/cerrar',derivar('cerrarSesionAdministrativa'));
  rutas.post('/cotizaciones/:id/consolidar-b2c',derivar('consolidarB2C'));
  rutas.post('/notas-venta/:id/etapas-cobro',derivar('configurarEtapasCobro'));
  rutas.post('/clientes/formalizar',derivar('formalizarClienteB2C'));
  rutas.post('/notas-venta/:id/revertir',derivar('revertirVenta'));
  rutas.post('/pagos',derivar('registrarPago'));
  return rutas;
}
