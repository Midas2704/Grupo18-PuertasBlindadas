CREATE TABLE "finanzas"."solicitud_crediticia_m8" (
  "id_solicitud_crediticia" SERIAL PRIMARY KEY,
  "id_ficha_cliente" INTEGER NOT NULL,
  "tipo_solicitud" VARCHAR(20) NOT NULL,
  "estado_solicitud" VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  "id_usuario_solicitante" BIGINT,
  "id_cotizacion" INTEGER,
  "id_nota_venta" INTEGER,
  "referencia_contexto" VARCHAR(120),
  "antecedentes_resumen" TEXT,
  "fecha_creacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_actualizacion" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_solicitud_crediticia_m8_tipo" CHECK ("tipo_solicitud" IN ('INICIAL', 'EXCEPCION')),
  CONSTRAINT "chk_solicitud_crediticia_m8_estado" CHECK ("estado_solicitud" IN ('BORRADOR', 'PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
  CONSTRAINT "fk_solicitud_crediticia_m8_ficha" FOREIGN KEY ("id_ficha_cliente") REFERENCES "finanzas"."ficha_cliente"("id_ficha_cliente") ON DELETE RESTRICT,
  CONSTRAINT "fk_solicitud_crediticia_m8_solicitante" FOREIGN KEY ("id_usuario_solicitante") REFERENCES "terreno"."usuario"("usuario_id_usuario") ON DELETE RESTRICT,
  CONSTRAINT "fk_solicitud_crediticia_m8_cotizacion" FOREIGN KEY ("id_cotizacion") REFERENCES "finanzas"."cotizacion"("id_cotizacion") ON DELETE RESTRICT,
  CONSTRAINT "fk_solicitud_crediticia_m8_nota_venta" FOREIGN KEY ("id_nota_venta") REFERENCES "finanzas"."nota_venta"("id_nota_venta") ON DELETE RESTRICT
);

CREATE INDEX "idx_solicitud_crediticia_m8_bandeja" ON "finanzas"."solicitud_crediticia_m8" ("estado_solicitud", "tipo_solicitud", "fecha_creacion");
CREATE INDEX "idx_solicitud_crediticia_m8_cliente" ON "finanzas"."solicitud_crediticia_m8" ("id_ficha_cliente");
CREATE INDEX "idx_solicitud_crediticia_m8_solicitante" ON "finanzas"."solicitud_crediticia_m8" ("id_usuario_solicitante");

INSERT INTO "terreno"."permiso" (
  "permiso_modulo", "permiso_accion", "permiso_descripcion", "permiso_nombre_del_permiso",
  "codigo_m4", "activo_m4", "requiere_administrador"
) VALUES (
  'M8', 'consultar solicitudes crediticias', 'Consulta de bandeja y detalle de solicitudes crediticias', 'CU259',
  'CU259', TRUE, FALSE
)
ON CONFLICT ("codigo_m4") DO UPDATE SET
  "permiso_modulo" = EXCLUDED."permiso_modulo",
  "permiso_accion" = EXCLUDED."permiso_accion",
  "permiso_descripcion" = EXCLUDED."permiso_descripcion",
  "permiso_nombre_del_permiso" = EXCLUDED."permiso_nombre_del_permiso",
  "activo_m4" = TRUE,
  "requiere_administrador" = FALSE;

INSERT INTO "terreno"."perfil_permiso" ("perfil_id_perfil", "permiso_id_permiso", "perfil_permiso_activo")
SELECT perfil."perfil_id_perfil", permiso."permiso_id_permiso", TRUE
FROM "terreno"."perfil" perfil
JOIN "terreno"."permiso" permiso ON permiso."codigo_m4" = 'CU259'
WHERE perfil."codigo_m4" IN ('gerencia', 'secretaria')
ON CONFLICT ("perfil_id_perfil", "permiso_id_permiso") DO UPDATE SET "perfil_permiso_activo" = TRUE;
