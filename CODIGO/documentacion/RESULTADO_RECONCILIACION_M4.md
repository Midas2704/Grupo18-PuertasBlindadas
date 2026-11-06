> **HISTÓRICO — 12 de septiembre de 2026.** Se conserva como evidencia de la reconciliación realizada. Para reglas funcionales y de seguridad actuales, consultar [Estado técnico vigente](ESTADO_TECNICO_VIGENTE.md), respaldado por el commit `52a9cc8`.

# Resultado de reconciliación M4

Fecha: 8 de septiembre de 2026. Reconciliación completada bajo la autorización explícita y limitada del usuario.

## Verificaciones y modificación operativa

Antes de modificar metadatos se comprobó, y se volvió a comprobar dentro de la transacción:

- FK validada `terreno.usuario(empleado_m4)` → `finanzas.empleado(rut_empleado)`, con ON UPDATE CASCADE y ON DELETE SET NULL.
- Checksum registrado de 003 igual al original: `5fbd8d19b02a298250cfc05417b7c9c04c6c9ade4d03d0b7cf6ca3c298066cdb`.
- Reconstrucción del archivo original a partir del corregido, deshaciendo solamente la calificación `finanzas`, con el mismo checksum original.
- Archivo corregido con checksum `927f16c958e6221b988a08b0f2e31d45e487a2d0029c000e2775120afb0f0aa0`.
- En la base independiente, intento original fallido sin fecha de finalización ni rollback previo, y ausencia de estructuras parciales de M4.

En `pblindadas_finanzas.finanzas._prisma_migrations` se actualizó exactamente una fila y exclusivamente su campo checksum. La comparación de todas las propiedades de todas las filas confirma que no cambiaron fechas, estados, identificadores, logs, contadores ni otras migraciones. No se ejecutó `resolve --rolled-back` en la base operativa.

## Instalación independiente

En `verificacion_i2_20260908`, con historial en public:

1. `prisma migrate resolve --rolled-back 003_seguridad_m4`: correcto, exclusivamente para el intento fallido ya revertido.
2. `prisma migrate deploy`: correcto; aplicó 003_seguridad_m4 y 004_destino_excedente sin errores.
3. `prisma db seed`: correcto; seed I2 y M4 completados.
4. `prisma migrate status`: esquema al día, sin pendientes en ambas bases.

Este fue un reintento limpio sobre la instalación independiente que ya tenía 000–002; no se borró ni se recreó esa base.

## Historial final

| Migración | Operativa | Independiente |
|---|---|---|
| 000_base_existente | Aplicada, sin cambios | Aplicada |
| 001_base_i2 | Aplicada, sin cambios | Aplicada |
| 002_secuencias_heredadas | Aplicada, sin cambios | Aplicada |
| 003_seguridad_m4 original fallida | No existe intento fallido | Conservada con rolled_back_at y sin finished_at |
| 003_seguridad_m4 vigente | Aplicada; sólo checksum reconciliado | Nueva aplicación correcta, finished_at presente, rolled_back_at nulo |
| 004_destino_excedente | Aplicada, sin cambios | Aplicada correctamente |

La operativa conserva cinco filas. La independiente tiene seis: cinco aplicaciones correctas y el intento fallido revertido que se conserva como antecedente. **003_seguridad_m4 está correctamente aplicada en ambas**, con el checksum corregido. El [historial detallado](verificacion_m4/historial_final.json) incluye fechas UTC y checksums.

## Datos y validación final

Se compararon recuentos y hashes SHA-256 del contenido completo de las 139 tablas operativas, excluyendo únicamente `_prisma_migrations`. La captura anterior y la posterior a reconciliación y pruebas son idénticas: no cambió ningún registro de negocio preexistente ni quedaron datos de pruebas.

El seed se ejecutó solamente en la base independiente durante esta reconciliación. Las pruebas crean y eliminan sus propios registros; los contadores de secuencias pueden avanzar por esas inserciones de prueba, sin cambiar registros de negocio. No se restablecieron contraseñas, permisos ni sesiones existentes.

- Backend: build correcto.
- Frontend: build correcto, 1762 módulos procesados.
- Pruebas: **39 aprobadas, 0 fallos, 0 omitidas**.
- Persiste la advertencia de deprecación de consultas internas concurrentes del adaptador `pg`; no produce fallos.

## Comparación de esquemas

Prisma devuelve una migración vacía al comparar **cada base** con `schema.prisma`.

La comparación ampliada de catálogos PostgreSQL verificó en ambas bases 139 tablas y 2 vistas, 1075 columnas, 926 restricciones, 216 índices y 114 secuencias. No hay diferencias en tablas/vistas, columnas, índices, definiciones de vistas ni configuración de secuencias; tampoco funciones, triggers propios o enumeraciones en estos esquemas.

Se detectaron **45 diferencias textuales** en restricciones CHECK heredadas: la operativa convierte un array varchar completo a text[], mientras la instalación independiente convierte cada literal varchar a text. Coinciden nombres, columnas, valores permitidos, tipo de restricción y validación. Las condiciones resultan equivalentes; no se alteraron esas restricciones para igualar su representación. El [detalle de diferencias](verificacion_m4/comparacion_esquemas.json) conserva ambas definiciones.

La ubicación del historial Prisma sigue siendo distinta de forma intencional: finanzas en la base operativa y public en la independiente. No se trasladó el historial ni se intentó igualar datos, propietarios o permisos de conexión entre las bases.

La reconciliación técnica queda cerrada. Esto no amplía el alcance funcional ni elimina los pendientes M1–M3 y las definiciones externas documentadas en DELTA_M4.md.
