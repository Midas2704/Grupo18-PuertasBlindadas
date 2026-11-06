-- CU173 conserva una decisión independiente por incidencia, sin mover el retrabajo desde Terreno.
ALTER TABLE finanzas.tratamiento_remuneracional_ejecucion
  DROP CONSTRAINT fk_tratamiento_incidencia,
  DROP CONSTRAINT fk_tratamiento_resolutor,
  DROP CONSTRAINT uq_tratamiento_remuneracional_incidencia,
  DROP COLUMN id_incidencia_retrabajo,
  DROP COLUMN id_usuario_resolutor,
  DROP COLUMN fecha_resolucion;

ALTER TABLE terreno.incidencia_retrabajo_tarea
  ADD COLUMN causa_referencia TEXT;

ALTER TABLE finanzas.tarifa_esquema_remuneracional
  ADD COLUMN tipo_aplicacion VARCHAR(20),
  ADD CONSTRAINT ck_tarifa_esquema_tipo_aplicacion
    CHECK (tipo_aplicacion IS NULL OR tipo_aplicacion IN ('global', 'por_unidad')),
  ADD CONSTRAINT ck_tarifa_esquema_aplicacion_unidad
    CHECK (
      tipo_aplicacion IS NULL
      OR (tipo_aplicacion = 'global' AND unidad IS NULL)
      OR (tipo_aplicacion = 'por_unidad' AND unidad IS NOT NULL)
    );

CREATE TABLE finanzas.decision_remuneracional_retrabajo (
  id_decision_retrabajo SERIAL PRIMARY KEY,
  id_incidencia_retrabajo BIGINT NOT NULL,
  id_tratamiento_remuneracional INTEGER NOT NULL,
  decision VARCHAR(30) NOT NULL,
  motivo TEXT NOT NULL,
  id_usuario_resolutor BIGINT NOT NULL,
  fecha_resolucion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_decision_remuneracional_incidencia UNIQUE (id_incidencia_retrabajo),
  CONSTRAINT ck_decision_remuneracional_retrabajo
    CHECK (decision IN ('remunerable', 'no_remunerable')),
  CONSTRAINT fk_decision_retrabajo_incidencia
    FOREIGN KEY (id_incidencia_retrabajo) REFERENCES terreno.incidencia_retrabajo_tarea(id_incidencia_retrabajo) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_decision_retrabajo_tratamiento
    FOREIGN KEY (id_tratamiento_remuneracional) REFERENCES finanzas.tratamiento_remuneracional_ejecucion(id_tratamiento_remuneracional) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_decision_retrabajo_resolutor
    FOREIGN KEY (id_usuario_resolutor) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX idx_decision_retrabajo_tratamiento
  ON finanzas.decision_remuneracional_retrabajo(id_tratamiento_remuneracional);
