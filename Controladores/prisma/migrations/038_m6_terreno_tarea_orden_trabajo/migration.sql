ALTER TABLE terreno.tarea
  ADD COLUMN id_orden_trabajo BIGINT;

CREATE INDEX idx_tarea_orden_trabajo
  ON terreno.tarea (id_orden_trabajo);

ALTER TABLE terreno.tarea
  ADD CONSTRAINT fk_tarea_orden_trabajo
  FOREIGN KEY (id_orden_trabajo)
  REFERENCES inventario.orden_trabajo (orden_trabajo_id_orden)
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;
