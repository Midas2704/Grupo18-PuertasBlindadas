/** Catálogo técnico de operaciones implementadas. Los perfiles no se editan desde la interfaz. */
// Midas dijo que este catálogo no se toca a la ligera
export const operacionesPermiso: Record<string, string> = {
 buscarClientes:'CU06',filtrarEstado:'CU07',filtrarFinanzas:'CU08',listarClientes:'CU05', abrirFicha:'CU09', dashboard:'CU05', crearCliente:'CU01', actualizarCliente:'CU02', desactivarCliente:'CU03', reactivarCliente:'CU04', inventario:'CU15', productos:'CU14', monedas:'CU28',
 bandeja:'CU20', historial:'CU20', guardarCotizacion:'CU19', editarCotizacion:'CU20', crearVentaDirecta:'CU27', registrarClienteDesdeCotizacion:'CU13', emitirCotizacion:'CU18', reactivarCotizacion:'CU21', formalizarClienteB2C:'CU23', aprobarCotizacionB2B:'CU24', configurarEtapasCobro:'CU40', modificarGuia:'CU35', definirCondicionesCobro:'CU39', configurarUmbral:'CU41', consultarUmbral:'CU41',
 anularVenta:'CU37', registrarDocumento:'CU36', descartarBorrador:'CU22', aprobarCotizacion:'CU24', aprobarVenta:'CU27', tipoCambio:'CU47',
 consultarPago:'CU55', consultarSaldo:'CU49', catalogosPago:'CU45', contextoPago:'CU42', consolidarB2C:'CU25', revertirVenta:'CU38', registrarPago:'CU43', anularPago:'CU51', revertirPago:'CU52', aplicarSaldoFavor:'CU54', consultarMorosidad:'CU56', generarComprobante:'CU57', conciliarPago:'CU58',
 usuarios:'CU67', catalogosUsuarios:'CU59', registrarUsuario:'CU59', desactivarUsuario:'CU60', reactivarUsuario:'CU61',
 cambiarConfiguracion:'CU62', asignarPermisos:'CU63', retirarPermisos:'CU64', asignarAdministrador:'CU65', retirarAdministrador:'CU66',
 restablecerClave:'CU71', desbloquearUsuario:'CU72', consultarSesiones:'CU73', cerrarSesionAdministrativa:'CU74',
};

/** Operaciones sobre cuentas y seguridad ajenas: Gerencia por sí sola no basta. */
export const codigosQueRequierenAdministrador = new Set([
 'CU59','CU60','CU61','CU62','CU63','CU64','CU65','CU66','CU71','CU72','CU74',
]);
export const operacionesQueRequierenAdministrador = new Set(
 Object.entries(operacionesPermiso)
  .filter(([,codigo]) => codigosQueRequierenAdministrador.has(codigo))
  .map(([operacion]) => operacion),
);
export const permisosM4 = Array.from({length:16}, (_, indice) => `CU${indice + 59}`).filter(codigo => !['CU68','CU69','CU70'].includes(codigo));
export const codigosImplementados = [...new Set([...Object.values(operacionesPermiso), 'CU31','CU33'])];
/** El perfil Administrador representa acceso integral a la matriz CU01–CU74. */
// parece exagerado, pero mantiene la matriz completa en un solo lugar
export const codigosTodosLosCU = Array.from({ length: 74 }, (_, indice) => `CU${String(indice + 1).padStart(2, '0')}`);
export const dependenciasPermiso: Record<string, string[]> = {
 CU02:['CU05'],CU03:['CU05'],CU04:['CU05'],CU06:['CU05'],CU07:['CU05'],CU08:['CU05'],CU09:['CU05'], CU20:['CU05'], CU19:['CU05','CU14','CU15','CU28'], CU27:['CU05'], CU22:['CU20'], CU24:['CU20'], CU25:['CU20'], CU35:['CU09'],CU36:['CU09'],CU37:['CU09'],CU38:['CU09'],CU39:['CU09'],CU41:['CU09'],
 CU13:['CU19'],CU18:['CU19'],CU21:['CU20'],CU23:['CU09'],CU31:['CU19'], CU33:['CU27'], CU40:['CU09'],CU42:['CU05'],CU43:['CU05','CU49','CU45'], CU51:['CU43'],CU52:['CU43'],CU54:['CU43'],CU56:['CU49'],CU57:['CU55'],CU58:['CU43'],
 CU60:['CU67'],CU61:['CU67'],CU62:['CU67'],CU63:['CU67'],CU64:['CU67'],CU65:['CU67'],CU66:['CU67'],CU71:['CU67'],CU72:['CU67'],CU74:['CU73'],
};
type PerfilFuncional = 'gerencia' | 'secretaria' | 'contador';
const G: readonly PerfilFuncional[] = ['gerencia'];
const GS: readonly PerfilFuncional[] = ['gerencia','secretaria'];
const GC: readonly PerfilFuncional[] = ['gerencia','contador'];
const GSC: readonly PerfilFuncional[] = ['gerencia','secretaria','contador'];

/** Matriz funcional completa según los actores de cada CU en el flujo vigente. */
export const matrizPermisosPorCU: Record<string, readonly PerfilFuncional[]> = {
 CU01:G,CU02:G,CU03:G,CU04:G,CU05:GSC,CU06:GSC,CU07:GSC,CU08:GSC,CU09:GSC,CU10:GSC,CU11:GSC,
 CU12:GS,CU13:G,CU14:GS,CU15:GS,CU16:GS,CU17:GS,CU18:GS,CU19:GS,CU20:GS,CU21:GS,CU22:GS,CU23:G,
 CU24:GS,CU25:GS,CU26:GS,CU27:GS,CU28:GS,CU29:GS,CU30:GS,CU31:G,CU32:GS,CU33:G,CU34:GS,CU35:GS,
 CU36:GS,CU37:GC,CU38:GC,CU39:GS,CU40:GS,CU41:G,
 CU42:GSC,CU43:GSC,CU44:GSC,CU45:GSC,CU46:GSC,CU47:GSC,CU48:GSC,CU49:GSC,CU50:GSC,
 CU51:GC,CU52:GC,CU53:GC,CU54:GC,CU55:GSC,CU56:GSC,CU57:GC,CU58:GC,
 CU59:G,CU60:G,CU61:G,CU62:G,CU63:G,CU64:G,CU65:G,CU66:G,CU67:G,
 CU68:GSC,CU69:GSC,CU70:GSC,CU71:G,CU72:G,CU73:G,CU74:G,
};

const operacionesPersonales = new Set(['CU68','CU69','CU70']);
const codigosDe = (perfil: PerfilFuncional) => codigosTodosLosCU.filter(codigo => !operacionesPersonales.has(codigo) && matrizPermisosPorCU[codigo]?.includes(perfil));
export const codigosGerencia = codigosDe('gerencia');
export const codigosSecretaria = codigosDe('secretaria');
export const codigosContador = codigosDe('contador');

