INSERT INTO "finanzas"."afp" ("nombre_afp", "estado_afp")
VALUES
  ('Capital', 'activo'),
  ('Cuprum', 'activo'),
  ('Habitat', 'activo'),
  ('Modelo', 'activo'),
  ('PlanVital', 'activo'),
  ('Provida', 'activo'),
  ('Uno', 'activo')
ON CONFLICT ("nombre_afp") DO UPDATE
SET "estado_afp" = EXCLUDED."estado_afp";

INSERT INTO "finanzas"."prevision_salud"
  ("nombre_prevision_salud", "tipo_prevision_salud", "estado_prevision_salud")
VALUES
  ('Fonasa', 'FONASA', 'activo'),
  ('DIPRECA', 'DIPRECA', 'activo'),
  ('Otro', 'OTRO', 'activo'),
  ('Banmédica', 'ISAPRE', 'activo'),
  ('Colmena Golden Cross', 'ISAPRE', 'activo'),
  ('Consalud', 'ISAPRE', 'activo'),
  ('Cruz Blanca', 'ISAPRE', 'activo'),
  ('Nueva Masvida', 'ISAPRE', 'activo'),
  ('Vida Tres', 'ISAPRE', 'activo'),
  ('Esencial', 'ISAPRE', 'activo'),
  ('Isalud', 'ISAPRE', 'activo'),
  ('Fundación', 'ISAPRE', 'activo'),
  ('Cruz del Norte', 'ISAPRE', 'activo')
ON CONFLICT ("nombre_prevision_salud") DO UPDATE
SET
  "tipo_prevision_salud" = EXCLUDED."tipo_prevision_salud",
  "estado_prevision_salud" = EXCLUDED."estado_prevision_salud";
