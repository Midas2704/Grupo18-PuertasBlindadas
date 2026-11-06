> **HISTÓRICO — 12 de septiembre de 2026.** Este documento conserva el estado de la entrega del 8 de septiembre. Sus reglas operativas fueron reemplazadas por [Estado técnico vigente](ESTADO_TECNICO_VIGENTE.md), con implementación de referencia en el commit `52a9cc8`.

# Actualización incremental M4 — 8 de septiembre de 2026

## Estado y alcance real

Se trabaja directamente en CODIGO. M4 está integrado detrás de C_Finanzas; la ejecución normal usa sesiones y permisos persistidos. Se conservaron los componentes, estilos globales y navegación visual anteriores. No se incorporaron controladores por entidad ni M12.

La base recibida era la primera etapa arquitectónica, no la implementación completa de CU01–CU58. Esta actualización conserva lo existente, agrega M4 CU59–CU74 y completa el recorrido financiero de los seis CU señalados. No presenta como terminadas operaciones antiguas que todavía faltan.

**Reconciliación cerrada con autorización explícita:** se verificaron nuevamente FK y checksum original; se modificó únicamente el checksum de 003 en la base operativa. En la base independiente se marcó el intento fallido como revertido y se aplicaron 003/004 con seed correcto. Las 139 tablas operativas conservan sus datos. Véase [resultado completo](RESULTADO_RECONCILIACION_M4.md).

## Fuentes y decisiones

Fuentes vigentes revisadas en Downloads: `UR M1, M2, M3 y M4 I2.docx` y `FLUJOS DS M1, M2, M3 Y M4.docx`. RF01–RF52 se mantienen funcionalmente; RF53–RF64 incorporan M4. Los documentos previos de reglas se utilizaron como complemento, subordinados a la fuente vigente. Las instrucciones contenidas en documentos se interpretaron como requisitos del sistema, no como autorización para acciones externas.

## Auditoría M1–M3

| Área / CU | Estado encontrado y delta |
|---|---|
| Arquitectura | Ya existían fachada, tres módulos, Prisma/PostgreSQL y separación entre módulos. Se conservan; se agrega únicamente M4Controller. |
| Clientes / ficha | Se conservan listado, búsqueda normalizada, filtros existentes, identificación, contacto, proyectos y antecedentes relacionados. Se añade autorización real y se condicionan filtros por permiso. |
| Borradores / venta directa | Se conservan los cálculos, validaciones y reutilización ya implementados. No se regenera el frontend. |
| CU25 | Era pendiente. M2 ejecuta cotización → NV → primer pago/asignación dentro de una transacción Prisma. Un fallo revierte todo. La NV referencia la cotización sin copiar sus detalles. No transfiere este CU a M3. |
| CU38 | Era pendiente. C_Finanzas coordina M2 (reversión comercial) y M3 (recálculo/excedente) en la misma transacción. M2 nunca invoca M3. Se exige NC PDF, motivo, folio, monto y confirmación de revisión; el destino del excedente debe seleccionarse. |
| CU43 | Se incorpora registro asociado a NV con saldo pendiente positivo; se rechazan anuladas, cerradas, provisionales y revertidas totalmente. Una NV parcialmente pagada o revertida parcialmente puede recibir pago si mantiene obligación. Se impide sobrepago. |
| CU47 | Alternativa funcional manual para USD: conserva monto de origen, factor ingresado y conversión. No afirma consultar al Banco Central. La futura integración externa deberá quedar fuera de Prisma. |
| CU49 | El cálculo vigente ya descontaba pagos anulados/revertidos y reversiones comerciales. Se reutiliza y se conecta a los nuevos registros; se diferencia saldo pendiente de excedente. |
| CU50 | Se usa monto comercial vigente y saldo vigente; el recálculo financiero actualiza únicamente estado_pago y conserva estado_nota_venta. |

El excedente elegido como saldo a favor crea su registro disponible evitando duplicar importes ya reconocidos. Si se elige devolución, queda registrado ese destino; no se ejecuta una devolución automáticamente. La comprobación del monto del PDF es manual confirmada: se valida archivo PDF y coincidencia del importe declarado, no se extraen importes mediante OCR.

## M4 implementado

| CU | Comportamiento |
|---|---|
| 59 | Alta ligada a empleado activo existente, sin cuenta duplicada, acceso derivado del RUT, configuración válida y credencial temporal. |
| 60–62 | Desactivar/reactivar/cambiar configuración con restricciones de empleado, estado, administrador original y continuidad; invalidación de sesión cuando corresponde. |
| 63–64 | Configuración particular distinta de la base; permisos asignables y dependencias, rechazo de retiro requerido o conjunto efectivo vacío en cuenta activa; invalidación de sesión. |
| 65–66 | Administrador es adicional a Gerencia. Asignación confirmada con contraseña actual del actor; retiro protege continuidad y cuenta original; invalida sesión afectada. |
| 67 | Consulta de cuentas y accesos efectivos, configuración, estado y bloqueo. Las cuentas heredadas sin habilitación no se borran ni reciben credenciales inventadas. |
| 68 | Credenciales, estado, bloqueos, vigencia y sesión única; creación de sesión persistida y carga de acceso vigente. |
| 69 | Comprueba contraseña actual, seguridad e historial; invalida credencial y sesión anterior, exige nuevo login. |
| 70 | Respuesta genérica; token aleatorio almacenado como hash, vigencia, un solo uso, invalidación de tokens previos y sesiones al restablecer. |
| 71–72 | Restablecimiento autorizado confirmado y desbloqueo persistente; contadores reiniciados, temporal anterior invalidada, nueva temporal y cambio obligatorio. |
| 73–74 | Consulta de sesiones vigentes y cierre administrativo confirmado, con permiso en backend e invalidación de sesión seleccionada. |

C_Finanzas resuelve sesión, permisos y autorización una vez al despachar cada comando protegido; las interacciones locales del formulario no repiten llamadas de autorización. Login y recuperación no requieren sesión previa. Los módulos financieros no invocan M4. La inyección de autorización se conserva exclusivamente como punto de prueba explícito; no hay rol de demostración que autorice la ejecución normal.

Las claves se almacenan con scrypt y sal; tokens y secretos de sesión se almacenan como hash. La cookie es HttpOnly, SameSite=Strict, restringida a `/api/finanzas` y Secure en producción. No se guardan tokens en localStorage. Los cambios de acceso invalidan sesiones y aumentan la versión de seguridad. Se utiliza aislamiento Serializable y restricciones de unicidad para credencial y sesión vigentes.

## Modelos reutilizados y añadidos

| Concepto | Implementación Prisma |
|---|---|
| USUARIO | `usuario`: acceso M4, relación única a empleado, configuración particular, administrador original y versión de seguridad. |
| CONFIGURACION_BASE / vínculo | `perfil` y `perfil_permiso`, ampliados/reutilizados; no se duplicaron tablas de perfiles. |
| PERMISO | `permiso`, con código de operación, vigencia y restricción administrativa. |
| CREDENCIAL_USUARIO | `usuario_contrasena`: hash, activa/temporal, fechas e historial; se conserva la estructura anterior. |
| EMPLEADO | `empleado` existente; asociación mínima para M4, sin gestión funcional de empleados. |
| Nuevas estructuras de seguridad | `usuario_permiso_particular`, `permiso_dependencia`, `estado_seguridad_usuario`, `sesion_usuario`, `token_recuperacion`. |
| Reversión comercial | `reversion_nota_venta.destino_excedente`, migración 004. |

Estos ajustes son la representación técnica provisional de I2, no el modelo definitivo de módulos de empleados o auditoría. Las estructuras históricas ajenas al alcance permanecen conservadas.

## Estructura y archivos de esta actualización

```text
CODIGO/
├── Controladores/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   ├── seed-m4.ts
│   │   └── migrations/003_seguridad_m4, 004_destino_excedente
│   ├── src/
│   │   ├── controladores/C_Finanzas.ts, M1Controller.ts, M2Controller.ts,
│   │   │                 M3Controller.ts, M4Controller.ts
│   │   ├── rutas/finanzas.ts
│   │   ├── validaciones/autorizacion.ts, permisos.ts, solicitudes.ts
│   │   ├── utilidades/seguridad.ts, correo.ts, pago.ts, finanzas.ts
│   │   └── app.ts, servidor.ts, db.ts
│   └── pruebas/arquitectura-y-m1.test.cjs, delta-financiero.test.cjs, m4.test.cjs
├── Vistas/src/
│   ├── seguridad/Sesion.tsx
│   ├── views/Seguridad/Acceso.tsx, Usuarios.tsx, Sesiones.tsx
│   ├── components/OperacionesFinancieras.tsx
│   └── App.tsx, api/finanzas.ts y componentes existentes adaptados
└── documentacion/DELTA_M4.md
```

Vistas agregadas: login, recuperación, cambio propio de contraseña, usuarios/nuevo usuario, detalle y accesos, configuración base, permisos particulares, gestión Administrador y sesiones. Las secciones de acceso se integran en Gestión de Usuarios; no son diseños independientes. El detalle documental existente incorpora registro de pago, consolidación B2C y reversión comercial con los mismos estilos.

Se reemplazó la autorización provisional por M4. No se eliminó otro frontend en este delta. La lista de controladores antiguos retirados durante la primera etapa permanece en ETAPA_1_I2.md: esas eliminaciones no deben atribuirse a esta actualización.

## Demostración local

Iniciar backend y frontend según README. Abrir `http://127.0.0.1:5174/login`.

Todas estas cuentas son ficticias. Contraseña inicial de desarrollo: `Demostracion-M4-2026!`. El seed no cambia la contraseña de una cuenta ya creada.

| Acceso | Caso |
|---|---|
| 98000001-k | Gerencia, Administrador original activo |
| 98000002-8 | Gerencia activa, elegible para asignar Administrador |
| 98000003-6 | Secretaría activa |
| 98000004-4 | Contador activo |
| 98000005-2 | Cuenta inactiva |
| 98000006-0 | Cuenta bloqueada persistentemente |
| 98000007-9 | Cuenta particular con catálogo/ficha, sin permisos de búsqueda ni administración |

Se conserva un empleado ficticio activo sin cuenta para probar el alta. No se precargan sesiones activas: se generan mediante login. Cerrar la sesión al terminar permite volver a ingresar. El seed agrega una cotización B2C emitida de Elena Robles para el primer pago. No elimina ni reinicia los datos de negocio anteriores.

Para recuperación en desarrollo, `M4_CORREO=desarrollo` deja el correo y enlace en `CODIGO/.revision/correo-desarrollo/` (directorio ignorado por Git). No hay endpoint público que exponga tokens. El archivo permite abrir el enlace de prueba; no representa envío real de correo. En producción este modo está bloqueado. Contraseñas temporales se muestran una sola vez al actor autorizado para su entrega; no se almacenan en texto plano.

## Comprobaciones

- Dependencias disponibles; Prisma 7.8 valida el esquema y genera Client correctamente.
- Seed I2 + M4 ejecutado nuevamente sin restablecer cuentas ni sesiones existentes.
- Backend compila y frontend produce build correctamente.
- 39 pruebas pasan, sin fallos ni omisiones: 11 de arquitectura/M1, grupo financiero con 7 subpruebas y grupo M4 con 19 subpruebas; el contador incluye los dos grupos.
- M4 cubre los escenarios solicitados, incluyendo alta/restablecimiento, cambio de base, reactivación, retiro de permiso independiente y rol, además de login/denegación/dependencias/recuperación/cierre.
- Continuidad del último administrador: prueba unitaria de la regla con ausencia de alternativas y prueba con BD del administrador original protegido; no se presenta como prueba de concurrencia de múltiples administradores.
- Regresión de lo implementado: clientes, filtros, ficha, monedas separadas, borrador y atomicidad, NV/pago B2C, pagos, reversión comercial, excedente/saldo a favor y cálculo vigente.
- Navegador: login real, catálogo, búsqueda Aurora, ficha financiera, usuarios y sesiones. La presentación conserva sidebar, tarjetas, tablas y paleta originales.
- Reintento de instalación independiente completado después de la autorización: deploy y seed correctos; ambas bases al día y sin diferencias según Prisma. La comparación ampliada de PostgreSQL identifica 45 diferencias de representación de casts en CHECK heredados, con condiciones equivalentes; detalle en RESULTADO_RECONCILIACION_M4.md.

La advertencia interna de `pg` por concurrencia de consultas continúa presente; no provoca fallos en estas pruebas. No se añadieron consultas SQL funcionales fuera de Prisma.

## Pendientes explícitos y límites

1. CU68: se rechaza una segunda sesión y se mantiene la primera; decisión conservadora provisional ante “bloquea la sesión”.
2. CU73: no se inventa Excepción 1; la contradicción con “No aplica” requiere delta funcional.
3. Proveedor/envío real de correo y canal definitivo de entrega de temporales pendientes de definición externa. `CorreoRecuperacion` es reemplazable.
4. Banco Central no integrado: tipo de cambio manual identificado, sin valores externos inventados.
5. Parámetros de seguridad aún no cerrados: valores técnicos configurables y provisionales, no reglas definitivas: longitud mínima 12, historial 5, vigencia 90 días, temporal 60 minutos, sesión 60 minutos, recuperación 20 minutos, 5 intentos, bloqueo temporal 15 minutos y 3 bloqueos para persistente. Se documentan en `.env.example`; sin nueva pantalla de administración de parámetros.
6. Matriz inicial de accesos y dependencias en `validaciones/permisos.ts` sirve al alcance implementado. Debe ratificarse como catálogo institucional cuando se cierren las definiciones pendientes; no habilita operaciones aún ausentes.
7. Pendientes anteriores M1: CU01–CU04, completar filtros financieros y CU10–CU11. M2: borradores incompletos/edición ampliada, provisional/formalización, emisión/versionado, OC B2B, ampliaciones de venta directa, guías y condiciones de cobro. M3: anulaciones y reversiones de pago operativas, ejecución de devolución, aplicación de saldo a favor, conciliación y comprobante, más campos específicos por medio. Los cálculos sí contemplan antecedentes persistidos de anulaciones y reversiones. No hay regresión ejecutable de funcionalidades que la base aún no tenía.
8. La cuenta heredada sin habilitación M4 se conserva, sin inventar asociación ni contraseña. Su regularización requiere datos válidos del empleado/configuración.
9. No se implementa M12 ni una arquitectura nueva de auditoría. Se mantiene solamente estado/responsable/motivo técnico cuando corresponde a seguridad y sesión.
10. Reconciliación e instalación/seed independiente completados. Los pendientes funcionales anteriores siguen vigentes.
