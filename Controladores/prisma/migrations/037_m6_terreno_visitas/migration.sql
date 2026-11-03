-- CU199 ancla la visita Legacy en su obra sin reemplazar servicio_terreno.
ALTER TABLE terreno.servicio_terreno
  ADD COLUMN id_obra BIGINT;

ALTER TABLE terreno.servicio_terreno
  ADD CONSTRAINT fk_servicio_terreno_id_obra
  FOREIGN KEY (id_obra) REFERENCES terreno.obra(obra_obra_id)
  ON DELETE NO ACTION ON UPDATE NO ACTION;
