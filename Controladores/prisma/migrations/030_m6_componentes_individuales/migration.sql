-- Scaffolding individual para CU174-CU177. No implementa población, cálculo ni cierre CU178-CU180.
CREATE TABLE finanzas.periodo_remuneracion (
  id_periodo_remuneracion SERIAL PRIMARY KEY,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_periodo_remuneracion_anio_mes UNIQUE (anio, mes),
  CONSTRAINT ck_periodo_remuneracion_mes CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT ck_periodo_remuneracion_fechas CHECK (fecha_inicio <= fecha_fin)
);

CREATE TABLE finanzas.remuneracion (
  id_remuneracion SERIAL PRIMARY KEY,
  id_periodo_remuneracion INTEGER NOT NULL,
  id_empleado INTEGER NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
  creado_por BIGINT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_remuneracion_periodo_empleado UNIQUE (id_periodo_remuneracion, id_empleado),
  CONSTRAINT ck_remuneracion_estado CHECK (estado IN ('abierta', 'cerrada', 'reemplazada')),
  CONSTRAINT fk_remuneracion_periodo FOREIGN KEY (id_periodo_remuneracion)
    REFERENCES finanzas.periodo_remuneracion(id_periodo_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_remuneracion_empleado FOREIGN KEY (id_empleado)
    REFERENCES finanzas.empleado(id_empleado) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_remuneracion_creador FOREIGN KEY (creado_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX idx_remuneracion_empleado_estado
  ON finanzas.remuneracion(id_empleado, estado);

CREATE TABLE finanzas.componente_remuneracion (
  id_componente_remuneracion SERIAL PRIMARY KEY,
  id_remuneracion INTEGER NOT NULL,
  id_concepto INTEGER,
  tipo VARCHAR(40) NOT NULL,
  modalidad VARCHAR(30) NOT NULL DEFAULT 'MONTO',
  descripcion TEXT NOT NULL,
  monto NUMERIC(14,4),
  direccion VARCHAR(20),
  fuente_tipo VARCHAR(30) NOT NULL,
  clave_negocio VARCHAR(120),
  referencia_origen VARCHAR(200),
  version_origen VARCHAR(100),
  fecha_origen DATE,
  estado_revision VARCHAR(30) NOT NULL DEFAULT 'propuesto',
  motivo TEXT,
  id_componente_origen INTEGER,
  tipo_relacion VARCHAR(30),
  creado_por BIGINT NOT NULL,
  revisado_por BIGINT,
  fecha_revision TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_componente_remuneracion_tipo CHECK (tipo IN (
    'EXCEPCIONAL_POSITIVO', 'VARIABLE_ADMINISTRATIVA', 'VARIABLE_COMERCIAL',
    'VALOR_EXTERNO', 'AJUSTE_MANUAL', 'PRORRATEO'
  )),
  CONSTRAINT ck_componente_remuneracion_modalidad CHECK (modalidad IN ('MONTO', 'REGLA_TEMPORAL')),
  CONSTRAINT ck_componente_remuneracion_estado CHECK (estado_revision IN (
    'propuesto', 'aprobado', 'rechazado', 'conflicto', 'pendiente_valorizacion', 'reemplazado'
  )),
  CONSTRAINT ck_componente_remuneracion_monto CHECK (monto IS NULL OR monto >= 0),
  CONSTRAINT ck_componente_remuneracion_direccion CHECK (direccion IS NULL OR direccion IN ('POSITIVO', 'NEGATIVO')),
  CONSTRAINT ck_componente_remuneracion_ajuste CHECK (
    (tipo = 'AJUSTE_MANUAL' AND direccion IS NOT NULL AND monto IS NOT NULL)
    OR (tipo <> 'AJUSTE_MANUAL' AND direccion IS NULL)
  ),
  CONSTRAINT ck_componente_remuneracion_regla CHECK (
    modalidad <> 'REGLA_TEMPORAL'
    OR (tipo = 'EXCEPCIONAL_POSITIVO' AND monto IS NULL AND estado_revision = 'pendiente_valorizacion')
  ),
  CONSTRAINT ck_componente_remuneracion_revision CHECK (
    estado_revision NOT IN ('aprobado', 'rechazado')
    OR (revisado_por IS NOT NULL AND fecha_revision IS NOT NULL)
  ),
  CONSTRAINT fk_componente_remuneracion FOREIGN KEY (id_remuneracion)
    REFERENCES finanzas.remuneracion(id_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_componente_concepto FOREIGN KEY (id_concepto)
    REFERENCES finanzas.concepto_remuneracion(id_concepto_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_componente_creador FOREIGN KEY (creado_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_componente_revisor FOREIGN KEY (revisado_por)
    REFERENCES terreno.usuario(usuario_id_usuario) ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT fk_componente_origen FOREIGN KEY (id_componente_origen)
    REFERENCES finanzas.componente_remuneracion(id_componente_remuneracion) ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX idx_componente_remuneracion_contexto
  ON finanzas.componente_remuneracion(id_remuneracion, tipo, estado_revision);
CREATE INDEX idx_componente_remuneracion_clave
  ON finanzas.componente_remuneracion(clave_negocio);
CREATE UNIQUE INDEX uq_componente_externo_version
  ON finanzas.componente_remuneracion(id_remuneracion, fuente_tipo, referencia_origen, version_origen)
  WHERE tipo = 'VALOR_EXTERNO' AND referencia_origen IS NOT NULL AND version_origen IS NOT NULL;
CREATE UNIQUE INDEX uq_componente_prorrateo_activo
  ON finanzas.componente_remuneracion(id_remuneracion)
  WHERE tipo = 'PRORRATEO' AND estado_revision IN ('propuesto', 'aprobado', 'conflicto', 'pendiente_valorizacion');
