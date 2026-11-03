const test = require('node:test');
const assert = require('node:assert/strict');
const { archivoCreditoM8Csv } = require('../dist/m8/exportacionCreditoCsv');
const { archivoAuditoriaM9Csv } = require('../dist/m9/exportacionAuditoriaCsv');
const { crearCsvAdministrativo } = require('../dist/utilidades/csv');

const decodificar = archivo => Buffer.from(archivo.contenido.split(',')[1], 'base64').toString('utf8');

test('CSV administrativos M8 y M9 son legibles y seguros para planillas', async t => {
  await t.test('M8 aplana solicitudes sin JSON y conserva una fila por registro', () => {
    const filas = [{
      id: 17, tipo: 'EXCEPCION', estado: 'APROBADA', fechaCreacion: '2026-09-03T14:20:00Z', fechaActualizacion: '2026-09-04T15:30:00Z',
      motivo: '=SUM(A1:A2)', condicionesSolicitadas: 'Pago a 30 días', antecedentes: 'Cliente Peña, Sur',
      solicitante: { id: '8', nombre: 'María Ñancupil' }, cliente: { idFicha: 3, idCliente: 9, nombre: 'Comercial Peña, Sur', rut: '76.543.210-3', clasificacion: 'B2B' },
      contextoComercial: { notaVenta: { numero: 'NV-17', monto: 1250000, moneda: 'CLP' } }, resolucion: { decision: 'APROBADA', fecha: '2026-09-05T11:00:00Z' },
    }];
    const csv = decodificar(archivoCreditoM8Csv('solicitudes', filas));
    assert.ok(csv.startsWith('\uFEFFSolicitud,Tipo,Estado,Fecha de creación'));
    for (const texto of ['Cliente', 'Monto comercial', 'Moneda comercial', 'Excepción', 'Aprobada', 'María Ñancupil', 'CLP', "'=SUM(A1:A2)"]) assert.match(csv, new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(csv, /\{"|\["|idFicha|contextoComercial|true|false/);
    assert.equal(csv.split('\r\n').length, 2);
    assert.match(csv, /"Comercial Peña, Sur"/);
  });

  await t.test('M8 expresa montos CLP y estados humanos para cliente y exposición', () => {
    const cliente = decodificar(archivoCreditoM8Csv('cliente', [{ cliente: { nombre: 'Inmobiliaria Ñuble', rut: '77.111.222-3' }, habilitado: true, cupo: 5000000, utilizado: 1250000, disponible: 3750000, vigencia: { desde: '2026-01-01', hasta: '2026-12-31' }, suspension: { suspendido: false }, sobreCupo: false, morosidad: { estado: 'DISPONIBLE', cantidad: 0 } }]));
    assert.match(cliente, /Estado de crédito,Cupo autorizado CLP,Exposición utilizada CLP,Capacidad disponible CLP/);
    assert.match(cliente, /Activo,5000000,1250000,3750000/); assert.match(cliente, /No,Disponible,0/);
    const global = decodificar(archivoCreditoM8Csv('credito', [{ estado: 'DISPONIBLE', limiteGlobal: 18000000, exposicionUtilizada: 4500000, capacidadDisponible: 13500000, cupoTotalAgregado: 22000000, cupoUtilizadoAgregado: 4500000, cupoDisponibleAgregado: 17500000, avisoCapacidadProxima: 'CONDICIONADO_F047_NO_IMPLEMENTADO' }]));
    assert.match(global, /Límite global CLP/); assert.doesNotMatch(global, /limiteGlobal|exposicionUtilizada/);
  });

  await t.test('M9 exporta sólo columnas administrativas, humaniza y neutraliza fórmulas', () => {
    const eventos = [
      { ocurrencia: '2026-10-03T14:25:00Z', modulo: 'M9', operacion: 'CONSULTA_EVIDENCIA', resultado: 'EXITOSO', referencia: { id: '=CMD()' }, ejecutor: { tipo: 'HUMANO', referencia: 'María Ñancupil' } },
      { ocurrencia: '2026-10-03T15:25:00Z', modulo: 'M7', operacion: 'EXPORTACION_DASHBOARD_CONFIRMADA', resultado: 'RECHAZADO', referencia: null, ejecutor: { tipo: 'SISTEMA', referencia: 'SISTEMA' } },
    ];
    const csv = decodificar(archivoAuditoriaM9Csv(eventos));
    assert.ok(csv.startsWith('\uFEFFFecha y hora,Módulo,Operación,Resultado,Referencia,Ejecutor'));
    for (const texto of ['Consulta de evidencia', 'Exportación de Dashboard confirmada', 'Exitoso', 'Rechazado', 'María Ñancupil', "'=CMD()", 'Sistema']) assert.match(csv, new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(csv, /identidadLogica|hash|payload|metadatos|\{"|undefined|null/);
    assert.equal(csv.split('\r\n').length, 3);
  });

  await t.test('neutraliza fórmulas de texto aun con blancos iniciales sin alterar números ni texto normal', () => {
    const peligrosos = ['=1+1', '+SUM(A1:A2)', '-CMD', '@SUM(A1:A2)', ' =1+1', '   +CMD', '\t=1+1', '\r@SUM(A1:A2)', '\n=1+1'];
    const csv = crearCsvAdministrativo(
      [...peligrosos.map(valor => ({ valor })), { valor: -150000 }, { valor: 'ABC-123' }, { valor: 'persona@example.invalid' }, { valor: 'Peña, Ñuble "Sur"' }],
      [{ encabezado: 'Valor', valor: fila => fila.valor }],
    );
    for (const peligroso of peligrosos) {
      const neutralizado = `'${peligroso}`.replace(/\r\n|\r|\n/g, ' ');
      assert.ok(csv.includes(neutralizado), `Debe neutralizar ${JSON.stringify(peligroso)}`);
    }
    assert.match(csv, /(?:^|\r\n)-150000(?:\r\n|$)/);
    assert.match(csv, /(?:^|\r\n)ABC-123(?:\r\n|$)/);
    assert.match(csv, /(?:^|\r\n)persona@example\.invalid(?:\r\n|$)/);
    assert.match(csv, /"Peña, Ñuble ""Sur"""/);
  });
});
