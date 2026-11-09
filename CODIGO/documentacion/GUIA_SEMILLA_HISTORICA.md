# Guía de semilla histórica DEMO

Esta entrega amplía la semilla vigente. **La carga PostgreSQL no se ha ejecutado en este entorno**. No equivale a una certificación integral de todos los procesos. Consultar VALIDACION_SEMILLA_HISTORICA.md y las brechas de MATRIZ_COBERTURA_SEMILLA.md.

## Requisitos

Node 24, dependencias del repositorio, cliente Prisma generado y PostgreSQL con el esquema previamente provisionado por el responsable del entorno. No se crea una base ni se ejecutan migraciones automáticamente. No ejecutar CODIGO/db/schema.sql ni seed.sql como alternativa. El esquema contiene tres namespaces: finanzas, inventario y terreno. Las 51 migraciones son evidencia de estructura definida; no se supone que estén aplicadas.

Trabajar en una base local **desechable, exclusiva y sin datos operativos** cuyo nombre termine en `_demo` o `_test`. La cuenta raíz y los catálogos básicos de seguridad pueden estar aprovisionados previamente. La carga no invoca seed.ts ni seed-m4.ts: seed-m4 modifica perfiles/permisos y puede aprovisionar credenciales. Una base que ya contiene las operaciones I2 de seed.ts será rechazada. No se debe cambiar su nombre para eludir la barrera.

## Preparación y configuración

Desde CODIGO/Controladores, instalar las versiones del lockfile mediante `npm ci`, ejecutar `npm run prisma:generate` y `npm run build`. El cliente se generó y compiló aquí con Prisma 7.10.1 (rango declarado ^7.8), TypeScript 6.0.3 y Node 24.19.0. No se modificó package-lock.json.

Variables para PowerShell, utilizando credenciales **propias del entorno aislado**:

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://USUARIO_LOCAL:CLAVE_LOCAL@127.0.0.1:5432/puertas_demo'
$env:DEMO_BASE_AISLADA = 'SI'
$env:DEMO_FECHA_CORTE = '2026-10-21'
$env:DEMO_MESES = '36'
$env:DEMO_SEMILLA = '2704'
```

La fecha predeterminada es **2026-10-21**, no la del reloj. Admite 36–120 meses y una semilla entera entre 0 y 2147483647. Corte inválido, producción, URL remota, nombre sin sufijo aislado o ausencia de declaración de aislamiento bloquean la escritura antes de cargar el cliente de BD. No imprime credenciales.

Para una ventana de 36 meses al corte indicado: noviembre 2023–octubre 2026, con 2024 y 2025 completos. Fechas efectivas se acotan al día del corte; vencimientos e instalaciones programadas pueden ser futuros. Los timestamps de registro y persistencia M9 conservan la fecha real de ejecución. El mes de remuneraciones en curso queda abierto y sin pago confirmado hasta su cierre; la validación del costo oficial M7 usa el último mes completo.

## Comandos

```text
npm run db:seed:demo:preview
npm run db:seed:demo
npm run db:seed:demo:status
npm run db:seed:demo:verify
npm run db:audit:static
npm run test:demo:unit
```

`preview` no necesita DATABASE_URL, no importa Prisma ni conecta: muestra meses, cuotas previstas y limitaciones. No es una simulación SQL exacta de cada fila; los conteos completos sólo se obtienen con `status` después de la carga. `status` informa series mensuales/anuales y cortes M7 mediante el adaptador M8. `verify` ejecuta invariantes de montos, fechas, estados, stock, orígenes de caja y costos oficiales, además de mínimos y comparativas M7.

`db:seed:demo:clean` conserva su nombre pero **rechaza el borrado**. El cleaner heredado se conserva para revisar su grafo; no es alcanzable por el comando. Sus predicados no prueban propiedad exclusiva de las dependencias ni cubren nuevas relaciones de caja. La evidencia M9 es inmutable. No hay limpieza automática, ni siquiera al terminar pruebas. Usar una nueva base desechable para otro escenario; no ejecutar a mano el cleaner heredado.

## Propiedad, errores e idempotencia

La primera carga exige ausencia de registros en cada modelo operativo Prisma, con una lista explícita de catálogos y seguridad permitidos. Los catálogos compartidos permitidos tienen upserts sin actualización. No se adoptan ni modifican operaciones DEMO antiguas: también bloquean la carga si no existe el manifiesto de esta versión. Se crean siete identidades ficticias inactivas sin credenciales, sesiones ni permisos efectivos. No permiten demostrar login ni autorización; se conservan las cuentas existentes.

Un advisory lock PostgreSQL protege contra dos cargas simultáneas. Las fases mantienen sus transacciones de dominio. Tras verificar, se agrega un manifiesto técnico inactivo `DEMO_UI_MANIFIESTO_V2` en parametro_remuneracional (tipo existente PRORRATEO; no modifica el esquema). Una segunda ejecución con configuración idéntica verifica y termina sin volver a insertar o actualizar. Otro corte/semilla/versión se rechaza. Los generadores usan índices de negocio en vez de IDs físicos para calcular montos.

**No es una transacción global**: M9 se recibe mediante su contrato fuera de las transacciones operativas. Ante un error pueden quedar fases confirmadas; se detiene, no compensa ni borra. Una carga parcial sin manifiesto será rechazada en el siguiente intento. Conservarla para diagnóstico y preparar una base nueva. Esta decisión protege registros ajenos y evidencia inmutable; no se presenta como recuperación automática de errores.

## Prueba PostgreSQL explícita

Sobre la base aislada ya preparada, sin operaciones preexistentes:

```powershell
$env:DEMO_TEST_INTEGRACION = 'SI'
npm run test:demo:integration
```

Ejecuta seed dos veces, compara status, verifica e inspecciona que usuarios preexistentes y perfil_permiso permanezcan idénticos. No prepara credenciales, no despliega esquema y no limpia. Sin opt-in queda SKIP. El entry point anterior `node --test pruebas/demo-completo.focal.cjs` reutiliza estas pruebas y las unitarias, sustituyendo las antiguas aserciones de limpieza automática.

## Inspección de la estructura desplegada

`npm run db:audit:live` abre una sesión y transacción PostgreSQL de sólo lectura: tablas/vistas, columnas, constraints y validación, índices y definiciones de vistas. Para conteos opcionales: `$env:DEMO_AUDIT_CONTEOS='SI'`. El timeout de cada sentencia es de 15 segundos; un timeout falla explícitamente. Guardar su JSON localmente y contrastar con EVIDENCIA_BD_REAL.json antes de atribuir al despliegue una estructura definida en Prisma. No se ejecutó aquí por ausencia de conexión.

## Alcance funcional y pendientes

M1–M3: cartera, cotizaciones aprobadas/rechazadas/vencidas/emitidas, ventas y pagos pendientes/parciales/totales, documentos y costos. M5: proveedores, órdenes, documentos y asociación a OCS, obligaciones, pagos y caja, inventario y envíos base. M6: empleados, relaciones, esquemas, componentes y pagos históricos; honorarios pendientes. M7: series derivadas de ventas, movimientos y costos; M8: solicitudes/resoluciones, condiciones y compromisos conciliados al saldo; M9: recepción real del contrato de carga.

Las reversiones, compensaciones, reclasificaciones, todas las imputaciones/costos de envío, tarifas, deducciones, anticipos y políticas M9 no tienen todavía escenarios integrales. El stock se concilia por lote con entradas/salidas; la atribución completa de consumo y costo por OT queda pendiente. No se sustituyen estos procesos con filas aisladas. Algunas fuentes M7 publican estado actual y no reconstruyen saldos históricos: la semilla no cambia ese contrato. La matriz enumera todas las rutas y marca cobertura parcial o brecha; la sola presencia de filas nunca se considera aceptación.
