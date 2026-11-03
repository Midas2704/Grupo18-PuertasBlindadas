# Validación de semilla histórica

Fecha de revisión: 21 de octubre de 2026 (America/Santiago). Repositorio Midas2704/PuertasBlindadas, commit base `de9a40ec39a57b38a80eb31efd03673776bc890a`.

## Resultado y límites de aceptación

**Implementación y análisis estático realizados; validación integral PostgreSQL PENDIENTE.** No se insertaron filas durante esta tarea. No había DATABASE_URL, .env, psql ni Docker configurados. No se consultó una base desplegada, no se aplicaron migraciones, no se ejecutaron clean ni SQL de inicialización y no se alteraron cuentas, permisos ni servicios productivos.

La ausencia de servidor no se presenta como éxito de integridad, idempotencia o indicadores. Las funciones nuevas compilan y cuentan con pruebas locales. Hay brechas funcionales reales adicionales al entorno, enumeradas abajo y por endpoint en la matriz. La entrega **no satisface todavía todos los criterios finales de aceptación**.

## Mapeo comprobado en código

Se inventariaron 223 modelos, 2 vistas, 51 migraciones y 356 rutas. Se rastrearon consumidores en 50 archivos backend de ejecución, además de frontend, pruebas, scripts y documentación. La clasificación es estática:

| Clasificación | Cantidad |
| --- | --- |
| ACTIVA | 156 |
| ACTIVA INDIRECTA | 33 |
| HISTÓRICA/LEGACY | 4 |
| NO UTILIZADA | 31 |
| PENDIENTE | 1 |

Los catálogos estructurales con consultas comprobadas están clasificados ACTIVA/ACTIVA INDIRECTA; no se fuerza una categoría ESTRUCTURAL exclusiva si hay consumidores directos. NO UTILIZADA significa sin referencia funcional localizada tras rastrear consultas, aliases de repositorios, relaciones FK y vistas. No habilita eliminarla. Tablas y vistas sin consumidores actuales no se poblaron por cuota.

Ejemplos de actividad directa: cliente_financiero, cotizacion, nota_venta, pago_cliente, documento_proveedor_m5, obligacion_proveedor_m5, remuneracion, pago_remuneracion, compromiso_credito_m8 y evento_auditoria_m9. Lote/factura_compra son dependencias indirectas del inventario. Ejemplos sin uso localizado: detalle_conciliacion, detalle_costo_proyecto_documento_proveedor, detalle_documento_compra_proveedor, detalle_liquidacion_remuneracion, origen_alerta_financiera, alerta_faltante_pedido, alerta_inventario, alerta_inventario_nivel_prioridad, alerta_inventario_tipo_alerta, anaquel, insumo_estandar_proceso, lote_fecha_pedido, material_codigo_barras, material_producto_terminado, material_proveedor, notificacion, producto_terminado, reporte, reporte_movimiento_inventario, adicionales_pagados, detalles_herraje, especificacion_metalmecanica, especificacion_proyecto_terreno, especificacion_terminaciones, hoja_doble, hoja_simple, notificacion_tecnico, notificacion_terreno, prestamo_herramientas, servicio_tterreno_herramientas_materiales, tarea_tipo.

## Brechas de la semilla anterior y cambios

- Histórico de 25 meses ligado al reloj → configuración fija de corte, 36–120 meses y PRNG por claves de negocio con semilla explícita.
- Importes dependientes del ID de producto → cálculo por posición estable de catálogo.
- Actualizaciones por RUT/SKU sin prueba de propiedad → preflight de cada modelo operativo, aislamiento local y rechazo de cargas heredadas/parciales.
- Upserts en AFP/Fonasa → conservación de valores preexistentes, sin actualización de catálogos compartidos permitidos.
- Cinco categorías/esquemas/haberes → siete. Se crean siete identidades inactivas sin acceso; no se modifican credenciales ni permisos existentes.
- Pago inicial pendiente pese a abono, pago en venta anulada y efectivo posterior al corte → estado conciliado, venta inicial pendiente sin pago y acotación de fechas efectivas.
- Obligaciones que descontaban borradores → sólo movimientos vigentes confirmados reducen saldos. Una operación por obligación evita mezclar totales cuando varias fechas se acotan al mismo día.
- Stock fijo y movimientos anteriores al lote → entradas posteriores a recepción, salidas explícitas y saldo físico derivado de movimientos. La atribución de consumo por OT sigue pendiente.
- Nóminas duplicadas entre bootstrap e histórico y cierres futuros → una generación histórica, componentes conciliados, mes incompleto abierto sin pago confirmado.
- Compromisos M8 como porcentaje arbitrario de la venta → saldo de nota menos asignaciones; cupo individual y límite global suficientes para la exposición generada.
- Caja sin procedencia → origen_movimiento_financiero vinculado a cobros, pagos de proveedores y remuneraciones confirmadas. Documentos de proveedor se enlazan con su OCS.
- M9 conserva el contrato recibir, minimización y hash del módulo; los eventos describen la carga ficticia y no simulan transiciones comerciales ejecutadas por servicios que no fueron llamados.
- Comandos anteriores conservados; preview añadido sin BD. clean falla de forma cerrada porque el grafo heredado no acredita propiedad exclusiva. Se retiró la limpieza automática de la prueba focal.
- Manifiesto de versión/corte/semilla al terminar la verificación; repetición idéntica verifica sin resembrar. Advisory lock evita carreras entre cargas.
- Se añadieron sólo anotaciones de retorno Express/Router para evitar errores de portabilidad TS2883 con pnpm. No se cambió lógica funcional ni esquema Prisma.

## Cantidades previstas y cantidades reales

Las cantidades siguientes proceden de `preview`, ejecutado sin conexión. **Insertadas durante esta tarea: 0. Cantidades existentes en un despliegue: NO COMPROBADAS.** No confundir estas previsiones con una carga exitosa.

| Entidad / cuota de demostración | Prevista | Insertada aquí |
| --- | --- | --- |
| clientes | 60 | 0 |
| usuariosFicticiosSinAcceso | 7 | 0 |
| materiales | 30 | 0 |
| items | 13 | 0 |
| proveedores | 15 | 0 |
| cotizaciones | 474 | 0 |
| notas | 310 | 0 |
| pagosCliente | 276 | 0 |
| periodosRemuneracion | 36 | 0 |
| remuneraciones | 563 | 0 |
| documentosProveedor | 149 | 0 |
| categoriasEgreso | 7 | 0 |
| esquemas | 7 | 0 |
| honorariosPrestadores | 10 | 0 |
| obras | 40 | 0 |

Se esperan además 36 períodos, dos componentes por remuneración, 35 posiciones de stock y 275 movimientos de inventario para el corte predeterminado. Las cantidades son expectativas del código y deben contrastarse con status; no son mediciones. Las cantidades exactas de todas las relaciones no se anuncian como verificadas.

### Distribución mensual prevista (excluye cinco cotizaciones/notas bootstrap)

| Mes | Cotizaciones | Ventas | Cobros cliente | Compras M5 | Gastos caja |
| --- | --- | --- | --- | --- | --- |
| 2023-11 | 16 | 13 | 12 | 4 | 3 |
| 2023-12 | 17 | 11 | 10 | 4 | 3 |
| 2024-01 | 8 | 5 | 4 | 4 | 3 |
| 2024-02 | 8 | 6 | 6 | 4 | 3 |
| 2024-03 | 10 | 6 | 6 | 4 | 3 |
| 2024-04 | 9 | 5 | 4 | 4 | 3 |
| 2024-05 | 12 | 7 | 6 | 4 | 3 |
| 2024-06 | 12 | 8 | 8 | 4 | 3 |
| 2024-07 | 10 | 6 | 5 | 4 | 3 |
| 2024-08 | 11 | 6 | 5 | 4 | 3 |
| 2024-09 | 14 | 11 | 10 | 4 | 3 |
| 2024-10 | 15 | 10 | 9 | 4 | 3 |
| 2024-11 | 18 | 12 | 10 | 4 | 3 |
| 2024-12 | 19 | 14 | 12 | 4 | 3 |
| 2025-01 | 10 | 6 | 6 | 4 | 3 |
| 2025-02 | 10 | 6 | 5 | 4 | 3 |
| 2025-03 | 12 | 7 | 6 | 4 | 3 |
| 2025-04 | 13 | 9 | 9 | 4 | 3 |
| 2025-05 | 14 | 7 | 6 | 4 | 3 |
| 2025-06 | 14 | 8 | 6 | 4 | 3 |
| 2025-07 | 15 | 11 | 10 | 4 | 3 |
| 2025-08 | 13 | 8 | 7 | 4 | 3 |
| 2025-09 | 16 | 10 | 8 | 4 | 3 |
| 2025-10 | 17 | 14 | 12 | 4 | 3 |
| 2025-11 | 17 | 11 | 10 | 4 | 3 |
| 2025-12 | 18 | 12 | 11 | 4 | 3 |
| 2026-01 | 9 | 6 | 5 | 4 | 3 |
| 2026-02 | 9 | 5 | 5 | 4 | 3 |
| 2026-03 | 11 | 7 | 6 | 4 | 3 |
| 2026-04 | 12 | 6 | 5 | 4 | 3 |
| 2026-05 | 13 | 9 | 9 | 4 | 3 |
| 2026-06 | 13 | 8 | 7 | 4 | 3 |
| 2026-07 | 11 | 6 | 5 | 4 | 3 |
| 2026-08 | 12 | 8 | 8 | 4 | 3 |
| 2026-09 | 15 | 11 | 10 | 4 | 3 |
| 2026-10 | 16 | 10 | 9 | 4 | 3 |

### Distribución anual prevista (excluye bootstrap)

| Año | Meses | Cotizaciones | Ventas | Compras M5 |
| --- | --- | --- | --- | --- |
| 2023 | 2 | 33 | 24 | 8 |
| 2024 | 12 | 146 | 96 | 48 |
| 2025 | 12 | 169 | 109 | 48 |
| 2026 | 10 | 121 | 76 | 40 |

Ventana prevista: noviembre 2023–octubre 2026. 2024 y 2025 completos. La prueba local valida consecutividad, años completos, variación de cantidades y configuración de cortes tempranos/bisiestos. La cobertura temporal de filas SQL y montos mensuales/anuales sigue NO EJECUTADA. El generador de montos varía precios, cantidades, estacionalidad, crecimiento, contracción, costo y condiciones de cobro; no se afirma una serie monetaria real sin ejecutar la carga.

## Verificaciones ejecutadas

| Verificación | Resultado | Evidencia / alcance |
| --- | --- | --- |
| Generación cliente Prisma | PASÓ | Prisma 7.10.1, sin conexión SQL |
| Validación de schema.prisma | PASÓ | prisma validate; esquema sin cambios |
| Compilación backend | PASÓ | tsc; se corrigieron únicamente retornos tipados Express/Router |
| Compilación frontend | PASÓ | tsc -b y vite build; aviso de bundle superior a 500 kB |
| Pruebas nuevas sin BD | PASÓ: 8/8 | RESULTADO_PRUEBAS_DEMO.txt |
| Integración nueva PostgreSQL | NO EJECUTADA: 1 SKIP | Falta servidor/conexión; opt-in DEMO_TEST_INTEGRACION=SI |
| Pruebas existentes de privacidad M9 en memoria | PASÓ: 8/8 (incluye padre) | RESULTADO_PRUEBAS_M9_MEMORIA.txt |
| Prueba existente PDF M9 | FALLÓ por entorno | P1001: tratamiento_privacidad_m9 requiere PostgreSQL; consulta a 127.0.0.1:1 falló; no se modificó el test para ocultarlo |
| Suite completa existente | NO EJECUTADA | Gran parte crea/borra fixtures SQL; requiere base aislada preparada |
| Introspección desplegada y conteos | NO EJECUTADA | db:audit:live preparado; no se presupone igualdad con Prisma |
| Doble ejecución y registros ajenos intactos | NO EJECUTADA | Prueba preparada: compara dos status y huellas de todos los registros preexistentes |
| FK, CHECK y UNIQUE en PostgreSQL | NO EJECUTADA | Verificador lee constraints no validadas e invariantes; el servidor debe aplicar restricciones |
| M7/M8 con datos SQL reales ficticios | NO EJECUTADA | verify usa controlador real y adaptador, verifica importes positivos y distintos cortes |
| Inmutabilidad/hash M9 sobre PostgreSQL | NO EJECUTADA | Contrato reutilizado; la prueba durable existente requiere servidor |
| Previsualización sin DATABASE_URL | PASÓ | Prueba inicia el CLI sin URL y obtiene 36 meses |
| git diff --check | PASÓ | Sin errores de espacios de parche al revisar |

Los primeros intentos de instalación/generación/build encontraron restricciones de red y spawn EPERM del sandbox. Se repitieron con ejecución permitida y finalizaron correctamente. El primer tsc falló sin cliente Prisma generado; el posterior detectó TS2883, corregido con anotaciones explícitas. Estos errores intermedios no sustituyen el resultado final de compilación. Se instalaron dependencias dentro del rango permitido por package.json con pnpm; no se cambió el lockfile original. Una ejecución con npm ci debe volver a validar las versiones fijadas allí.

## Cobertura funcional y brechas pendientes

M1–M3: cartera recurrente/ocasional, cotizaciones de varios estados, ventas, documentos, cobros y saldos. M5: proveedores, OCS y detalles, documentos/obligaciones y pagos, inventario, envíos base y caja chica. M6: empleados y períodos históricos con remuneración/componentes y pagos; honorarios pendientes. M7: ventas y comparativas, caja con origen, cuentas por cobrar/pagar, costos y márgenes, operación e inventario con filtros. M8: solicitudes de cinco estados, resoluciones, cupos, suspensión y compromisos con saldo. M9: eventos de carga recibidos por su contrato.

Esto describe **escenarios codificados, no demostraciones funcionales ejecutadas**. Ver matriz de 356 endpoints. No se declara cobertura completa por módulo.

- Faltan escenarios integrales de anulaciones/reversiones, saldos a favor/compensaciones, conciliaciones, imputaciones/reclasificaciones/reasignaciones y todos los costos de importación.
- Faltan tarifas/esquemas por cargo, hechos remunerables y su tratamiento de retrabajos, anticipos/regularizaciones y deducciones legales/recurrentes completas. Los importes laborales ficticios no certifican cálculo legal.
- Las identidades DEMO no tienen login ni permisos efectivos. La provisión de escenarios de autorización por servicios M4 requiere una tarea aislada específica; no se adoptan credenciales existentes.
- Faltan todas las políticas/retenciones/retry/alertas M9 y evidencia comercial emitida por cada productor de dominio. La recepción del contrato de carga no cubre esas funcionalidades.
- Falta atribución consistente de las salidas de inventario a cada OT/costo; la conciliación por lote evita saldos arbitrarios, pero no acredita ese recorrido completo.
- M7 documenta fuentes NO_HISTORIZABLE/CORTE_DISPONIBLE para CxC/CxP/crédito/inventario. No se fabricaron snapshots para aparentar otra capacidad. Algunas alertas y desgloses permanecen parciales.
- No se cumplen siete filas en todas las tablas activas: las brechas no son excepciones justificadas. Se distingue debajo lo que sí admite menor cardinalidad.
- La carga por fases puede quedar parcial; el siguiente intento se bloquea. No existe recuperación/reanudación automática. clean permanece bloqueado mientras no haya un ledger de propiedad completo, sin proponer ni ejecutar migraciones durante esta tarea.

## Excepciones legítimas de cardinalidad

CLP única moneda efectiva del escenario; dos segmentos B2B/B2C; dos vínculos laborales; un país y un tipo de identificador ficticios; una bodega; un límite global; una configuración por período; relaciones estrictas 1:1 siguen al padre. Tipos legales de documento, previsiones y medios de pago no se inflan para cumplir cuotas. Siete AFP corresponden al catálogo observado en el código, no a una verificación regulatoria externa. Las tablas sin escenario que sí permitirían siete registros permanecen como BRECHA, no como excepción.

## Evidencia de idempotencia y no afectación

La implementación guarda configuración y versión al finalizar; una carga idéntica entra sólo en verify y no repite operaciones. Rechaza cambios de escenario. La prueba de integración ejecuta dos cargas y compara resúmenes, huellas de todos los registros preexistentes, usuarios y permisos. **No fue ejecutada**: no se acredita idempotencia SQL mediante tests estáticos. Los tiempos reales de persistencia y secuencias no forman parte del PRNG. Los registros de auditoría no se actualizan ni eliminan.

## Archivos y próximos controles necesarios

Código: src/administracion/sembrarDemoCompleto.ts (CLI compatible), demoCompletoDatos.ts (generador extendido), demo/configuracion.ts, seguridad.ts, trazabilidad.ts y verificacion.ts. Herramientas: scripts/auditar-bd.cjs y auditar-bd-live.cjs. Pruebas: demo-historico.test.cjs, demo-historico.integration.cjs y entry point demo-completo.focal.cjs. Integración de comandos en package.json. Documentos: MAPA_BD_REAL.md, MATRIZ_COBERTURA_SEMILLA.md, esta validación y GUIA_SEMILLA_HISTORICA.md; EVIDENCIA_BD_REAL.json y PREVISION_SEMILLA_HISTORICA.json.

Para la aceptación restante: provisionar una base local vacía con esquema y cuenta de pruebas, ejecutar la integración explícita, capturar status/verify e introspección real, corregir los fallos que aparezcan y completar escenarios de las tablas activas aún sin datos mediante sus servicios de dominio. No publicar esta entrega como demostración integral certificada antes de esos controles.
