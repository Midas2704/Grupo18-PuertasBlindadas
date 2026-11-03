> **HISTÓRICO — 12 de septiembre de 2026.** Describe la primera etapa I2 y se mantiene para trazabilidad. Fue reemplazado como referencia operativa por [Estado técnico vigente](ESTADO_TECNICO_VIGENTE.md), respaldado por el commit `52a9cc8`.

# Entrega de la primera etapa I2

## Resultado y alcance

Se modificó directamente `Grupo18-SistemaFinanciero-PuertasBlindadas/CODIGO`. La base antigua y sus datos se conservaron. La arquitectura está activa y el recorrido vertical de M1 funciona con PostgreSQL: listado, búsqueda por nombre/RUT, filtros de estado y apertura de ficha, incluyendo clientes provisionales sin RUT.

Sólo hay cuatro controladores principales: `C_Finanzas`, `M1Controller`, `M2Controller`, `M3Controller`. Los módulos no se llaman entre sí. Todas las rutas frontend/backend pasan por la fachada. Los nombres ingleses de algunas rutas y propiedades de respuesta son alias de compatibilidad del frontend antiguo; no representan controladores adicionales.

```text
Vista → /api/finanzas → C_Finanzas → controlador modular → Prisma → PostgreSQL
Vista ← respuesta JSON ← C_Finanzas ← controlador modular ← Prisma ← PostgreSQL
```

No se implementaron módulos de usuarios, remuneraciones, tesorería, M7 ni M12. Las tablas antiguas de esos ámbitos se conservaron para evitar pérdida de información y relaciones.

## Fuentes y decisiones

La fuente principal fue `Flujos M1, M2 y M3 I2.docx`, adjuntado por el usuario. La solicitud menciona un PDF; no se encontró ese PDF con ese nombre en Descargas. Se utilizó el DOCX disponible, sin asumir que existe otra versión idéntica.

Se contrastaron `Reglas_de_Negocio_M1_M2_M3_M4_I2.docx` y `Matriz_Reglas_de_Negocio_Para_Codigo_M1_M4.docx`, limitando la aplicación a M1–M3. Los documentos son fuentes de comportamiento, no instrucciones para ampliar el alcance de programación.

También se encontró `RF_CU M1, M2, M3 y M4 definitivo entrega I2_FORMATO_RUBRICA.docx` en Descargas y se contrastaron sus RF de M1–M3 con los flujos. Su vigencia relativa no fue confirmada por el usuario; ante diferencias prevalecen los flujos proporcionados. El documento de flujos cita otra versión denominada `M1_M2_M3_Requerimientos_y_Casos_de_Uso_Definitivo_Limpio.docx`, que no se localizó con ese nombre. Antes de cerrar todos los CU se debe fijar una versión documental única. No se implementó M4 por aparecer en documentos compartidos.

Se revisaron el esquema Prisma previo, los SQL históricos, la estructura PostgreSQL disponible, controladores y rutas antiguas, las vistas conectadas y la guía visual existente. Las extracciones y el respaldo previo permanecen en `.revision`, excluido de Git; no se incorporan documentos personales al proyecto.

Decisiones aplicadas:

- Activo/Inactivo y formal/provisional son dimensiones independientes. Un provisional activo se muestra como Incompleto y conserva su identificador interno aunque no tenga RUT.
- El RUT heredado se busca con o sin puntos sin reescribir identidades existentes.
- La ficha recupera cliente, cotizaciones, NV, pagos y proyectos. Distingue saldo pendiente, deuda no vencida y obligaciones morosas.
- El vencimiento final de la NV determina la mora; los hitos intermedios no crean deudas independientes. Se usa la fecha de negocio de Santiago. Los campos PostgreSQL `date` se muestran sin desplazarlos por zona horaria.
- Se conserva el monto original de la NV. El monto vigente descuenta reversiones comerciales. Los pagos anulados/rechazados no tienen efecto; las reversiones financieras reducen su efecto. Conciliar no cambia el saldo.
- Los importes se calculan con Decimal en el servidor. Se agrupan por moneda, nunca sumando CLP, USD o moneda histórica distinta. Los escalares de compatibilidad del dashboard son exclusivamente CLP.
- El saldo negativo por reducción comercial se expone como excedente; no se decide automáticamente su devolución ni se crea crédito por cuenta del usuario.
- Las cotizaciones creadas desde el formulario existente quedan en Borrador. La edición conserva los precios unitarios usados, valida que los materiales pertenezcan al borrador y recalcula costos, margen, descuento e IVA. Las emitidas no se editan con este procedimiento.
- La aprobación genérica antigua no equivale a aceptación B2B con OC o consolidación B2C con primer pago. Esas operaciones devuelven una explicación de etapa pendiente, sin aprobar indebidamente.
- La venta directa conserva su moneda comercial. Se retiró la conversión anticipada y la dependencia de una tasa ficticia. La captura/confirmación del tipo de cambio pertenece al futuro registro de pago M3; no se añadió ninguna API externa.

## Estructura final relevante

```text
CODIGO/
├── README.md
├── documentacion/ETAPA_1_I2.md
├── Controladores/
│   ├── .env.example
│   ├── package.json / package-lock.json
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   │       ├── 000_base_existente/migration.sql
│   │       ├── 001_base_i2/migration.sql
│   │       ├── 002_secuencias_heredadas/migration.sql
│   │       └── migration_lock.toml
│   ├── pruebas/arquitectura-y-m1.test.cjs
│   ├── scripts/limpiar-compilacion.cjs
│   └── src/
│       ├── controladores/
│       │   ├── C_Finanzas.ts
│       │   ├── M1Controller.ts
│       │   ├── M2Controller.ts
│       │   └── M3Controller.ts
│       ├── rutas/finanzas.ts
│       ├── validaciones/{autorizacion,solicitudes}.ts
│       ├── utilidades/{finanzas,ErrorAplicacion}.ts
│       ├── db.ts
│       ├── app.ts
│       └── servidor.ts
├── Vistas/
│   ├── vite.config.ts
│   └── src/
│       ├── api/finanzas.ts
│       ├── components/ModalDetalleDocumento.tsx
│       └── views/ (se conservan las pantallas existentes)
└── db/
    ├── README.md
    ├── setup.ps1
    └── schema.sql / seed.sql (referencias históricas, no ejecutar)
```

`db.ts` configura una instancia Prisma con su adaptador PostgreSQL. No es un controlador genérico de datos. Las utilidades financieras son funciones puras y definiciones de relaciones; no ejecutan consultas. Las rutas sólo adaptan HTTP y llaman a la fachada.

## Esquema y entidades

El esquema completo está en `Controladores/prisma/schema.prisma`. Se mantienen los esquemas PostgreSQL `finanzas`, `terreno` e `inventario` y sus tablas existentes. La extensión se apoya en relaciones reales en lugar de crear una segunda base de clientes o ventas.

| Entidad de flujos | Implementación y reutilización |
|---|---|
| TIPO_CLIENTE / CLIENTE | `tipo_cliente_financiero`, `cliente_financiero`, `ficha_cliente`; se conserva la relación con `terreno.cliente`, ahora opcional para provisionales sin RUT |
| PROYECTO | `terreno.proyecto` existente; consulta por identidad del cliente y relación opcional de contexto en NV |
| COTIZACION / DETALLE_COTIZACION | `cotizacion`, `detalle_cotizacion`, `detalle_costo_material_cotizacion`; costos históricos, margen, moneda, descuento y tratamiento tributario |
| NOTA_VENTA | `nota_venta`; enlace único opcional a cotización, importes históricos conservados y fecha final de vencimiento |
| PAGO_CLIENTE / ASIGNACION_PAGO_CLIENTE | Tablas existentes; cada pago tiene una asignación única a una NV, con categoría/cuotas y datos adicionales provisionales |
| DOCUMENTO_TRIBUTARIO | Tabla existente; `documento_tributario_nota_venta` permite relación múltiple y conserva el enlace principal antiguo |
| GUIA_DESPACHO / CONDICION_COBRO_NV | `guia_despacho`, `condicion_cobro_nv` provisionales, asociados a NV |
| REVERSIÓN_NOTA_VENTA | `reversion_nota_venta`, con monto, motivo, respaldo y folio; no sobrescribe la NV |
| ANULACION_PAGO / REVERSIÓN_PAGO | `anulacion_pago`, `reversion_pago`, separadas y vinculadas al pago original |
| SALDO_FAVOR_CLIENTE / APLICACION_SALDO_FAVOR | `saldo_favor_cliente`, `aplicacion_saldo_favor`, con origen y destino trazables |
| CONCILIACION / DETALLE_CONCILIACION | Se reutilizan ambas tablas; se permite asociar pago y evidencia sin implementar tesorería |
| Catálogos y preparación | Moneda, medio de pago, tipo de documento existentes; categoría de pago, cuotas habilitadas y umbral Por vencer; versión de cotización y OC B2B |

Las nuevas estructuras están marcadas como provisionales mediante comentarios Prisma. Tener una tabla no significa tener implementado su CU. En especial están pendientes las reglas completas de documentos, medios de pago, trazabilidad de usuario definitivo, validaciones entre monedas y calendario de días hábiles. No se asigna un umbral comercial arbitrario como comportamiento activo: la configuración y su uso se cerrarán en CU41; el requerimiento candidato menciona cinco días hábiles iniciales.

El saldo expuesto es calculado desde registros relacionados; no se confía en saldos históricos almacenados manualmente. La columna antigua `estado_pago` se conserva por compatibilidad, pero la respuesta incorpora `estadoPago` calculado sin cambiar `estado_nota_venta`. La actualización persistida y atómica del estado al registrar operaciones se incorporará con M3.

Las NV antiguas sin fecha final se identifican en la respuesta con `fechaVencimientoPendiente`. Su deuda no se marca morosa sin una fecha; queda pendiente completar ese antecedente. Las inconsistencias monetarias o importes históricos ya borrados por el sistema antiguo no se reconstruyen inventando valores. Las vistas SQL antiguas se conservan como antecedentes, pero no alimentan los nuevos controladores.

## Migraciones y conservación de datos

Se creó un respaldo local previo ` .revision/respaldo-antes-i2.dump` y se comprobó que no existían cotizaciones con varias NV ni pagos con múltiples asignaciones antes de aplicar las restricciones únicas. No se borraron clientes, ventas ni pagos previos.

1. `000_base_existente`: baseline del esquema PostgreSQL encontrado, incluidas sus restricciones y relaciones. En la base antigua se marcó como aplicada; no se ejecutó encima de tablas existentes.
2. `001_base_i2`: ampliación aditiva, relaciones, estados y restricciones para I2. Conserva el enlace documental antiguo y completa la tabla asociativa desde él.
3. `002_secuencias_heredadas`: repara secuencias que los seeds antiguos no habían avanzado al insertar identificadores explícitos. No modifica registros ni reduce contadores.

Para una base **vacía**, crear previamente la base PostgreSQL, configurar URL con `schema=public` y ejecutar `db/setup.ps1`. Ese recorrido completo se comprobó en `verificacion_i2_20260908`, una base local independiente; quedó disponible para inspección. No se mezcló con la base del proyecto.

Para **otra copia antigua**, respaldar y comparar primero su esquema con el baseline, revisar las dos restricciones únicas y las asignaciones sin NV. Resolver discrepancias preservando información antes de aplicar restricciones. Sólo si la copia coincide con el baseline, registrar:

```powershell
cd Controladores
npx prisma migrate resolve --applied 000_base_existente
npm run db:migrate
npm run db:seed
```

No marcar indiscriminadamente migraciones como aplicadas. La base de trabajo actual ya tiene las tres registradas. No necesita repetir `resolve`. Véase el [procedimiento oficial de baseline de Prisma](https://docs.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining).

## Seed de demostración

El seed usa Prisma y una transacción. Sus altas se identifican y se reutilizan en siguientes ejecuciones; `update: {}` evita sobreescribir información previa. No elimina datos ni rellena masivamente todas las tablas.

Incluye cinco clientes ficticios: Taller Aurora B2B activo, Elena Robles B2C activa, Comercial Inactiva, Cliente Incompleto B2C provisional y Sin movimientos. Incluye proyectos, tres cotizaciones, cinco NV, cuatro pagos relacionados, documentos, una reversión comercial, una reversión parcial de pago y un pago anulado. Los nombres, contactos `example.invalid` y respaldos `demo://` indican demostración; estos últimos no son PDFs reales ni validaciones documentales de producción.

Ejemplo Aurora al verificar la entrega: NV original CLP 119.000 menos reversión CLP 19.000 = comercial vigente CLP 100.000. Pago CLP 19.000 menos reversión CLP 4.000 = efecto CLP 15.000. Pago anulado CLP 5.000 = efecto cero. Quedan CLP 85.000 morosos, más otra NV con CLP 59.500 no vencidos. Total pendiente CLP 144.500. Otra NV USD 1.000 con pago USD 250 deja USD 750 separados. La NV anulada retiene su original CLP 83.300.

## Interfaz y autorización provisional

La fachada llama una sola vez a la interfaz `Autorizacion.autorizar`. El adaptador actual requiere `AUTORIZACION_PROVISIONAL=local`, conexión de loopback y entorno distinto de producción. No confía en un rol enviado desde la Vista. Para incorporar autorización definitiva se reemplaza/injecta esa interfaz; no se cambia la jerarquía de controladores.

Se conserva el diseño: sidebar negro, colores, layout, tipografía, botones, tarjetas y tablas. Cambios necesarios en las vistas: uso del cliente HTTP común; selector de estado; identificación de incompletos; monedas separadas; situación financiera real; proyectos y pagos relacionados; motivo de anulación en lugar de una supuesta NC suficiente; fechas sin desplazamiento. El catálogo de monedas del formulario ahora procede de PostgreSQL. La interfaz de aceptación completa, los permisos por rol y los nuevos formularios quedan para las etapas de CU.

Rutas M1 principales: `GET /api/finanzas/clientes`, con `busqueda`, `estado=activos|inactivos|todos`, `deuda`, `morosos`; `GET /api/finanzas/clientes/id-{id}/ficha`. Se mantiene el alias `/clients` y la ficha por RUT heredada. Los endpoints M2/M3 se encuentran en `src/rutas/finanzas.ts`; todos pasan por `C_Finanzas`.

## Archivos reemplazados y motivo

| Componentes antiguos | Sustitución y razón |
|---|---|
| `src/controllers/clients.controller.ts` | Lógica válida de catálogo/ficha en M1Controller, con saldos derivados y provisionales |
| `billing.controller.ts` | Lecturas, borradores, edición, venta directa, vinculación documental y anulación sin pagos en M2Controller; se retiraron aprobaciones genéricas, conversión anticipada y alteración destructiva de montos |
| `dashboard.controller.ts` | Consultas M1/M2 coordinadas exclusivamente por C_Finanzas |
| `finanzas.controller.ts` | Fachada C_Finanzas con autorización y derivación real |
| `payments.controller.ts` | Se eliminó el esqueleto paralelo; preparación y consultas en M3Controller |
| `VerifUsuarioController.ts`, `auth.controller.ts` | Esqueletos eliminados; interfaz provisional reemplazable, sin inventar módulo de usuarios |
| `operario`, `productividad`, `remuneracion`, `tarea`, `treasury` controllers | Esqueletos fuera de M1–M3 eliminados; sus datos históricos se conservan |
| `src/index.ts` | `app.ts`, `servidor.ts` y rutas que sólo invocan la fachada |
| Antiguo `src/db.ts` | Prisma compartido, sin credenciales incrustadas ni consultas SQL funcionales |
| `seed-massive.*`, artefactos compilados `prisma/seed.*` antiguos | Seed TypeScript único, idempotente y no destructivo; no quedan copias JS antiguas ejecutables como alternativa |
| `scripts/clean_db.js`, `massive_seed*.js`, `view_query*.js`, `create_client_test.js` | Retirados por limpieza destructiva/consultas antiguas o pruebas manuales con escritura; sustituidos por migraciones, seed y pruebas de regresión |
| `db/setup.ps1`, `db/pgpass.tmp` | Instalación por Prisma; archivo temporal de conexión eliminado |

Otros cambios: `.gitignore`, configuración y scripts backend, esquema/migraciones/seed, cuatro controladores, rutas, validaciones y utilidades, pruebas, documentación y cliente HTTP frontend. Se adaptaron `CatalogoClientes`, `VerFicha`, `ArmarCotizacion`, `NotaDeVentaDirecta`, `BandejaAprobacionGerencia`, `DashboardPrincipal`, `ModalDetalleDocumento` y el proxy Vite. No se sustituyeron los estilos globales ni el contenedor lateral.

## Verificación realizada

- Dependencias instaladas; backend y frontend compilan.
- `prisma validate` correcto; Prisma Client 7.8 generado.
- Migraciones aplicadas a la base existente y también desde cero en base independiente.
- Seed ejecutado repetidamente en base existente y correctamente en base vacía.
- Comparación de base con `schema.prisma`: migración vacía, sin diferencias detectadas por Prisma.
- Once pruebas pasan: jerarquía/controladores únicos, coordinación y autorización, bloqueo por autorización denegada, listado/búsqueda/filtros, provisional, errores, ficha y monedas, protección de NV con pagos, borrador/recalculo/inmutabilidad y RUT heredado.
- Comprobación real en navegador de listado, búsqueda Aurora y ficha financiera; se mantiene el aspecto visual original.
- Backend local en 3000 y frontend en 5174. No se publicó en Internet.

El adaptador PostgreSQL emite una advertencia de deprecación sobre consultas internas concurrentes durante algunas lecturas transaccionales. Las pruebas pasan; revisar compatibilidad antes de actualizar `pg` a una futura versión mayor. No existe SQL directo funcional en la aplicación.

## Pendientes de la siguiente etapa

1. M1: altas, actualización, desactivación con validación de procesos no finales y reactivación (CU01–CU04); completar los tres filtros financieros de CU08, filtros/orden por antecedentes CU10 y actividad CU11. Lo implementado no cierra todo M1. El catálogo actual conserva los filtros antiguos Con deuda/Morosos y añade estado; su búsqueda normalizada se hace sobre los resultados recuperados, sin paginación todavía.
2. M2: borrador incompleto y edición ampliada, cliente provisional desde cotización y formalización, precio manual/costo ajustado, emisión, versionado/reactivación, OC B2B y consolidación B2C atómica mediante la fachada. Reutilizar cotización al crear NV sin duplicar detalles. El formulario antiguo aún selecciona clientes formales y exige productos/materiales completos.
3. M2: completar venta directa con concepto y contexto opcional de proyecto/producto, guías y documentos tributarios con campos y validaciones completas, reversiones con NC PDF, condiciones de cobro y umbral Por vencer. La vinculación documental conservada sólo es compatibilidad básica, no cierre de CU34–CU41.
4. M3: implementar CU42–CU58 por etapas: registro transaccional, categoría sugerida, datos por medio, cuotas, tipo de cambio del pago, documento existente del mismo cliente, rechazo de sobrepago, anulaciones/reversiones trazables, saldo a favor y aplicación, conciliación y comprobante. La lectura y el cálculo de saldo están preparados; no hay aún una nueva pantalla operativa completa de pagos.
5. Fijar versión de requerimientos, validar el esquema provisional y completar campos de auditoría con la futura identidad autorizada. Sustituir el adaptador local antes de cualquier exposición externa. Mantener integración externa de tipo de cambio separada de Prisma cuando corresponda.

Importante: los controladores antiguos equivalentes no se mantienen como arquitectura paralela. Su lógica válida se migra al M1Controller, M2Controller o M3Controller correspondiente y la Vista pasa por C_Finanzas.
