CREATE TABLE "finanzas"."evento_auditoria_m9" (
  "id_evento_m9" SERIAL PRIMARY KEY,
  "identidad_logica" VARCHAR(160) NOT NULL UNIQUE,
  "version_contrato" VARCHAR(20) NOT NULL,
  "fecha_ocurrencia" TIMESTAMPTZ(6) NOT NULL,
  "zona_horaria" VARCHAR(80) NOT NULL,
  "fecha_persistencia" TIMESTAMPTZ(6) NOT NULL,
  "ejecutor_tipo" VARCHAR(10) NOT NULL,
  "ejecutor_referencia" VARCHAR(120),
  "productor" VARCHAR(80) NOT NULL,
  "modulo_origen" VARCHAR(40) NOT NULL,
  "operacion" VARCHAR(100) NOT NULL,
  "resultado" VARCHAR(10) NOT NULL,
  "entidad_tipo" VARCHAR(80),
  "entidad_referencia" VARCHAR(160),
  "secuencia" INTEGER,
  "valores_anteriores" JSONB,
  "valores_nuevos" JSONB,
  "motivo" TEXT,
  "causa" TEXT,
  "id_evento_origen" INTEGER,
  "id_evento_correctivo" INTEGER,
  "contexto_terminal" BOOLEAN NOT NULL DEFAULT FALSE,
  "evento_privacidad" BOOLEAN NOT NULL DEFAULT FALSE,
  "metadatos_tecnicos" JSONB,
  "hash_contenido" CHAR(64) NOT NULL,
  "hash_integridad" CHAR(64) NOT NULL,
  CONSTRAINT "chk_m9_ejecutor" CHECK ("ejecutor_tipo" IN ('HUMANO','SISTEMA')),
  CONSTRAINT "chk_m9_resultado" CHECK ("resultado" IN ('EXITOSO','RECHAZADO','FALLIDO')),
  CONSTRAINT "chk_m9_secuencia" CHECK ("secuencia" IS NULL OR "secuencia" >= 0),
  CONSTRAINT "fk_m9_evento_origen" FOREIGN KEY ("id_evento_origen") REFERENCES "finanzas"."evento_auditoria_m9"("id_evento_m9") ON DELETE RESTRICT,
  CONSTRAINT "fk_m9_evento_correctivo" FOREIGN KEY ("id_evento_correctivo") REFERENCES "finanzas"."evento_auditoria_m9"("id_evento_m9") ON DELETE RESTRICT
);

CREATE INDEX "idx_m9_ocurrencia" ON "finanzas"."evento_auditoria_m9" ("fecha_ocurrencia", "id_evento_m9");
CREATE INDEX "idx_m9_clasificacion" ON "finanzas"."evento_auditoria_m9" ("modulo_origen", "operacion", "resultado");
CREATE INDEX "idx_m9_entidad" ON "finanzas"."evento_auditoria_m9" ("entidad_tipo", "entidad_referencia");
CREATE INDEX "idx_m9_productor_secuencia" ON "finanzas"."evento_auditoria_m9" ("productor", "secuencia");

CREATE FUNCTION "finanzas"."bloquear_mutacion_evento_auditoria_m9"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La evidencia M9 es inmutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_m9_evento_inmutable"
BEFORE UPDATE OR DELETE ON "finanzas"."evento_auditoria_m9"
FOR EACH ROW EXECUTE FUNCTION "finanzas"."bloquear_mutacion_evento_auditoria_m9"();
