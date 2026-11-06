> **HISTÓRICO — 12 de septiembre de 2026.** Esta revisión corresponde a una etapa ya cerrada. El documento vigente es [Estado técnico vigente](ESTADO_TECNICO_VIGENTE.md), con implementación de referencia en el commit `52a9cc8`.

# Revisión de la reconciliación M4 — cerrada

El usuario autorizó expresamente la acción y sus verificaciones. Se ejecutó satisfactoriamente; véase [resultado](RESULTADO_RECONCILIACION_M4.md). El texto siguiente conserva la propuesta original para trazabilidad.

# Acción preparada para autorización

La revisión automática rechazó la modificación del historial de migraciones. La acción no se ejecutó. Se pide autorización específica antes de retomarla.

## Evidencia de sólo lectura

En `pblindadas_finanzas`, las cinco migraciones 000–004 terminaron correctamente. La relación existente es exactamente:

```sql
FOREIGN KEY (empleado_m4) REFERENCES finanzas.empleado(rut_empleado)
ON UPDATE CASCADE ON DELETE SET NULL
```

El archivo 003 usado inicialmente decía `REFERENCES "empleado"`. Funcionó en esa conexión porque utilizaba el esquema finanzas. En la instalación independiente que usa public para el historial, falló con “no existe la relación empleado”. El bloque transaccional se revirtió; la base de prueba no tiene esa FK y Prisma conserva el intento como fallido.

El archivo preparado ahora especifica `REFERENCES "finanzas"."empleado"`. Es la misma relación que ya existe en la base operativa; no cambia usuarios, contraseñas, permisos, clientes, pagos ni otras tablas de negocio.

## Acción exacta pendiente

1. Verificar nuevamente que la FK operativa corresponde a finanzas.empleado y que el checksum guardado corresponde al archivo original de 003.
2. Actualizar **sólo el checksum de la fila `003_seguridad_m4`** en `pblindadas_finanzas.finanzas._prisma_migrations` al checksum del archivo corregido. No cambiar fechas, registros aplicados ni las demás migraciones. Es una corrección local de esta entrega todavía no publicada.
3. En **la base independiente `verificacion_i2_20260908`**, utilizar `prisma migrate resolve --rolled-back 003_seguridad_m4` para reconocer el intento fallido ya revertido por PostgreSQL. No marcar un rollback en la base operativa.
4. Volver a ejecutar deploy, seed y comparación de esquema sobre esa base independiente; verificar nuevamente el historial operativo.

Riesgo: modificar incorrectamente el historial puede desalinear lo que Prisma cree aplicado respecto de la base. Por ello la acción está limitada a una fila, condicionada al checksum anterior y a la FK comprobada; no incluye eliminación de datos ni reinicio de la base. El historial de la instalación independiente conserva evidencia del intento fallido.
