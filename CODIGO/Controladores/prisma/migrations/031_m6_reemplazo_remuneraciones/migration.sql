-- Corrige la cardinalidad del scaffolding sin implementar el flujo de reemplazo CU182.
ALTER TABLE finanzas.remuneracion
  DROP CONSTRAINT uq_remuneracion_periodo_empleado,
  ADD COLUMN reemplaza_a_id INTEGER,
  ADD CONSTRAINT uq_remuneracion_identidad_contexto
    UNIQUE (id_remuneracion, id_periodo_remuneracion, id_empleado),
  ADD CONSTRAINT uq_remuneracion_reemplazo_contexto
    UNIQUE (reemplaza_a_id, id_periodo_remuneracion, id_empleado),
  ADD CONSTRAINT ck_remuneracion_reemplazo_orden
    CHECK (reemplaza_a_id IS NULL OR reemplaza_a_id < id_remuneracion),
  ADD CONSTRAINT fk_remuneracion_reemplaza_a
    FOREIGN KEY (reemplaza_a_id, id_periodo_remuneracion, id_empleado)
    REFERENCES finanzas.remuneracion(id_remuneracion, id_periodo_remuneracion, id_empleado)
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX uq_remuneracion_actual_periodo_empleado
  ON finanzas.remuneracion(id_periodo_remuneracion, id_empleado)
  WHERE estado <> 'reemplazada';

CREATE INDEX idx_remuneracion_periodo_empleado
  ON finanzas.remuneracion(id_periodo_remuneracion, id_empleado);
