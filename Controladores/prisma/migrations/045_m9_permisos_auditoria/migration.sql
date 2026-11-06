INSERT INTO "terreno"."permiso" (
  "permiso_modulo", "permiso_accion", "permiso_descripcion",
  "permiso_nombre_del_permiso", "codigo_m4", "activo_m4", "requiere_administrador"
)
VALUES
  ('M9', 'consultar auditoria', 'Consultar evidencia de Auditoría dentro del alcance autorizado', 'Consultar Auditoría', 'CU355', TRUE, FALSE),
  ('M9', 'exportar auditoria', 'Exportar evidencia de Auditoría dentro del alcance autorizado', 'Exportar Auditoría', 'CU359', TRUE, FALSE)
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
JOIN "terreno"."permiso" permiso ON permiso."codigo_m4" IN ('CU355', 'CU359')
WHERE (permiso."codigo_m4" = 'CU355' AND perfil."codigo_m4" IN ('gerencia', 'secretaria', 'contador'))
   OR (permiso."codigo_m4" = 'CU359' AND perfil."codigo_m4" IN ('gerencia', 'contador'))
ON CONFLICT ("perfil_id_perfil", "permiso_id_permiso") DO UPDATE SET "perfil_permiso_activo" = TRUE;

INSERT INTO "terreno"."permiso_dependencia" ("id_permiso", "id_requerido")
SELECT exportar."permiso_id_permiso", consultar."permiso_id_permiso"
FROM "terreno"."permiso" exportar
JOIN "terreno"."permiso" consultar ON consultar."codigo_m4" = 'CU355'
WHERE exportar."codigo_m4" = 'CU359'
ON CONFLICT ("id_permiso", "id_requerido") DO NOTHING;
