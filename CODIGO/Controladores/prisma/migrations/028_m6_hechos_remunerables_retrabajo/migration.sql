-- Habilitadores técnicos mínimos de Terreno. No implementan CU208, CU209, CU212 ni CU213.
CREATE TABLE terreno.ejecucion_tarea (
  id_ejecucion_tarea BIGSERIAL PRIMARY KEY,
  id_tarea BIGINT NOT NULL,
  id_usuario_ejecutor BIGINT NOT NULL,
  fecha_ejecucion TIMESTAMPTZ NOT NULL,
  estado_ejecucion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  estado_validacion_productiva VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  cantidad NUMERIC(14,4),
  unidad VARCHAR(30),
  CONSTRAINT ck_ejecucion_tarea_estado
    CHECK (estado_ejecucion IN ('pendiente', 'en_ejecucion', 'terminada', 'anulada')),
  CONSTRAINT ck_ejecucion_tarea_validacion
    CHECK (estado_validacion_productiva IN ('pendiente', 'validada', 'rechazada', 'devuelta')),
  CONSTRAINT ck_ejecucion_tarea_cantidad
    CHECK (cantidad IS NULL OR cantidad >= 0),
  CONSTRAINT ck_ejecucion_tarea_cantidad_unidad
    CHECK ((cantidad IS NULL AND unidad IS NULL) OR (cantidad IS NOT NULL AND unidad IS NOT NULL)),
  CONSTRAINT fk_ejecucion_tarea_tarea
    FOREIGN KEY (id_tarea) REFERENCES terreno.tarea(tarea_tarea_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ejecucion_tarea_ejecutor
    FOREIGN KEY (id_usuario_ejecutor) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT
);

CREATE INDEX idx_ejecucion_tarea_revision_m6
  ON terreno.ejecucion_tarea(estado_ejecucion, estado_validacion_productiva, fecha_ejecucion);
CREATE INDEX idx_ejecucion_tarea_ejecutor
  ON terreno.ejecucion_tarea(id_usuario_ejecutor, fecha_ejecucion);

CREATE TABLE terreno.incidencia_retrabajo_tarea (
  id_incidencia_retrabajo BIGSERIAL PRIMARY KEY,
  id_ejecucion_tarea BIGINT NOT NULL,
  descripcion TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  responsabilidad VARCHAR(120),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_incidencia_retrabajo_estado
    CHECK (estado IN ('pendiente', 'corregida', 'cerrada')),
  CONSTRAINT fk_incidencia_retrabajo_ejecucion
    FOREIGN KEY (id_ejecucion_tarea) REFERENCES terreno.ejecucion_tarea(id_ejecucion_tarea) ON DELETE RESTRICT
);

CREATE INDEX idx_incidencia_retrabajo_pendiente
  ON terreno.incidencia_retrabajo_tarea(estado, fecha_registro);
CREATE INDEX idx_incidencia_retrabajo_ejecucion
  ON terreno.incidencia_retrabajo_tarea(id_ejecucion_tarea);

ALTER TABLE finanzas.tarifa_esquema_remuneracional
  ADD COLUMN unidad VARCHAR(30);

CREATE TABLE finanzas.tratamiento_remuneracional_ejecucion (
  id_tratamiento_remuneracional SERIAL PRIMARY KEY,
  id_ejecucion_tarea BIGINT NOT NULL,
  id_incidencia_retrabajo BIGINT,
  id_empleado INTEGER,
  estado_remunerabilidad VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  estado_valorizacion VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  motivo TEXT,
  id_esquema INTEGER,
  id_tarifa INTEGER,
  valor_propuesto NUMERIC(14,4),
  id_usuario_resolutor BIGINT,
  fecha_resolucion TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tratamiento_remuneracional_ejecucion UNIQUE (id_ejecucion_tarea),
  CONSTRAINT uq_tratamiento_remuneracional_incidencia UNIQUE (id_incidencia_retrabajo),
  CONSTRAINT ck_tratamiento_remunerabilidad
    CHECK (estado_remunerabilidad IN ('pendiente', 'remunerable', 'no_remunerable', 'conflicto')),
  CONSTRAINT ck_tratamiento_valorizacion
    CHECK (estado_valorizacion IN ('pendiente', 'valorizado', 'conflicto', 'no_aplica')),
  CONSTRAINT ck_tratamiento_valor
    CHECK (valor_propuesto IS NULL OR valor_propuesto >= 0),
  CONSTRAINT fk_tratamiento_ejecucion
    FOREIGN KEY (id_ejecucion_tarea) REFERENCES terreno.ejecucion_tarea(id_ejecucion_tarea) ON DELETE RESTRICT,
  CONSTRAINT fk_tratamiento_incidencia
    FOREIGN KEY (id_incidencia_retrabajo) REFERENCES terreno.incidencia_retrabajo_tarea(id_incidencia_retrabajo) ON DELETE RESTRICT,
  CONSTRAINT fk_tratamiento_empleado
    FOREIGN KEY (id_empleado) REFERENCES finanzas.empleado(id_empleado) ON DELETE RESTRICT,
  CONSTRAINT fk_tratamiento_esquema
    FOREIGN KEY (id_esquema) REFERENCES finanzas.esquema_remuneracional(id_esquema_remuneracional) ON DELETE RESTRICT,
  CONSTRAINT fk_tratamiento_tarifa
    FOREIGN KEY (id_tarifa) REFERENCES finanzas.tarifa_esquema_remuneracional(id_tarifa_esquema) ON DELETE RESTRICT,
  CONSTRAINT fk_tratamiento_resolutor
    FOREIGN KEY (id_usuario_resolutor) REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT
);

CREATE INDEX idx_tratamiento_remuneracional_estado
  ON finanzas.tratamiento_remuneracional_ejecucion(estado_remunerabilidad, estado_valorizacion);
CREATE INDEX idx_tratamiento_remuneracional_empleado
  ON finanzas.tratamiento_remuneracional_ejecucion(id_empleado);
