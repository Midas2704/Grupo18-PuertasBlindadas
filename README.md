# Módulo Financiero — Puertas Blindadas (Grupo 18)

Repositorio del **Módulo de Finanzas del ERP de Puertas Blindadas**, desarrollado por el Grupo 18 a través de tres incrementos de software.

## Integrantes

- Sebastián Benjamín Bravo Núñez
- Gianella Belén Catalán Canales
- Vicente Andrés Hernández Olea
- Daniella Rosa Catalina Lecanda Garnham
- Angella Javiera Sánchez López
- Valentín Ignacio García Farías

## Estado del proyecto

El proyecto cuenta actualmente con **tres incrementos de desarrollo**.

| Incremento | Módulos principales | Alcance general |
| --- | --- | --- |
| **Incremento 1** | M1, M2 y M3 | Clientes, cotizaciones/notas de venta y pagos |
| **Incremento 2** | M4, M5 y M6 | Seguridad y permisos, proveedores/egresos y remuneraciones |
| **Incremento 3** | M7, M8 y M9 | Dashboard gerencial, crédito y auditoría |

La versión actual incorpora el desarrollo funcional alcanzado durante los tres incrementos, junto con pruebas automatizadas, migraciones, exportaciones documentales y documentación técnica del proyecto.

---

## Incremento 1

### M1 — Clientes
- registro y administración de clientes;
- actualización, activación y desactivación;
- búsqueda y filtrado;
- catálogo de clientes;
- ficha financiera y antecedentes asociados.

### M2 — Cotizaciones y Notas de Venta
- creación y administración de cotizaciones;
- armado de cotizaciones;
- generación y gestión de notas de venta;
- manejo de cantidades, montos y monedas;
- ventas directas;
- flujo comercial asociado a las operaciones de venta.

### M3 — Pagos
- registro de pagos;
- pagos parciales;
- seguimiento de saldos;
- reversas;
- operaciones multimoneda;
- comprobantes de pago en PDF.

---

## Incremento 2

### M4 — Seguridad y Permisos
- autenticación;
- sesiones;
- autorización;
- control de permisos;
- protección de funcionalidades y endpoints según perfil.

### M5 — Proveedores, Egresos y Cuentas por Pagar
- catálogo y ficha de proveedores;
- órdenes de compra y servicios;
- documentos y obligaciones;
- cuentas por pagar;
- pagos a proveedores;
- envíos e importaciones;
- ajustes, compensaciones y reclasificaciones;
- caja chica y categorías de egreso.

### M6 — Remuneraciones
- catálogo y ficha de empleados;
- relaciones laborales;
- esquemas remuneracionales;
- haberes y deducciones;
- parámetros y configuraciones;
- periodos de remuneración;
- cálculo y registro de pagos;
- honorarios;
- anticipos;
- documentos y liquidaciones de remuneraciones;
- integración con información proveniente de terreno cuando corresponde.

---

## Incremento 3

### M7 — Dashboard Gerencial
- panel general financiero;
- indicadores y resúmenes;
- ventas;
- cuentas por cobrar;
- cuentas por pagar;
- liquidez;
- exposición de proyectos;
- centro de atención;
- información histórica y comparaciones por periodo;
- exportaciones gerenciales en PDF.

El dashboard consolida información proveniente de distintos módulos sin reemplazar a los módulos propietarios de cada dato.

### M8 — Crédito
- solicitudes crediticias;
- evaluación y administración de crédito;
- límite global;
- exposición utilizada;
- estados y condiciones de crédito;
- integración de información crediticia;
- exportación a CSV.

### M9 — Auditoría
- registro de operaciones auditables;
- consulta de eventos;
- filtros;
- trazabilidad por módulo, operación y resultado;
- identificación del ejecutor;
- exportaciones en PDF y CSV;
- mecanismos de integridad y confiabilidad del registro.

M9 funciona como mecanismo transversal de auditoría del sistema.

---

## Arquitectura del proyecto

La versión actual del código se encuentra consolidada principalmente en:

```text
CODIGO/
├── Controladores/
└── Vistas/
```

### `CODIGO/Controladores`

Backend desarrollado con:

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

Contiene controladores modulares `M1Controller` a `M9Controller`, servicios, validaciones, utilidades, pruebas, scripts y migraciones Prisma.

### `CODIGO/Vistas`

Frontend desarrollado con:

- React
- TypeScript
- Vite
- React Router
- Recharts
- Lucide React
- Tailwind CSS

Incluye vistas para clientes, cotizaciones, pagos, proveedores, remuneraciones, dashboard, crédito, auditoría y seguridad.

---

## Tecnologías utilizadas

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Recharts, Lucide React, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Pruebas | Node Test Runner |
| Control de versiones | Git y GitHub |

---

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/Midas2704/Grupo18-PuertasBlindadas.git
cd Grupo18-PuertasBlindadas
```

### 2. Backend

```bash
cd CODIGO/Controladores
npm install
npm run prisma:generate
npm run dev
```

La conexión a PostgreSQL se configura mediante `DATABASE_URL` en el archivo `.env`.

Ejemplo:

```env
DATABASE_URL="postgresql://usuario:password@host:5432/base_datos"
```

No se incluyen credenciales reales en el repositorio.

Para aplicar migraciones:

```bash
npm run db:migrate
```

### 3. Frontend

En otra terminal:

```bash
cd CODIGO/Vistas
npm install
npm run dev
```

Vite mostrará en consola la dirección local disponible.

---

## Comandos útiles

### Backend

Desde `CODIGO/Controladores`:

```bash
npm run dev
npm run build
npm test
npm run prisma:validate
npm run prisma:generate
npm run prisma:studio
npm run db:migrate
```

### Datos de demostración

```bash
npm run db:seed:demo
npm run db:seed:demo:status
npm run db:seed:demo:verify
npm run db:seed:demo:clean
```

### Frontend

Desde `CODIGO/Vistas`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

---

## Base de datos y Prisma

Las migraciones se encuentran en:

```text
CODIGO/Controladores/prisma/migrations/
```

El repositorio también conserva `Base_de_datos_Tres_Schemas.sql` como parte de la documentación y evolución histórica de la solución.

---

## Pruebas

La suite automatizada del backend se encuentra en:

```text
CODIGO/Controladores/pruebas/
```

Para ejecutarla:

```bash
cd CODIGO/Controladores
npm test
```

Para validar las compilaciones:

```bash
# Backend
cd CODIGO/Controladores
npm run build

# Frontend
cd ../Vistas
npm run build
```

---

## Documentación del proyecto

### `Documento 0/`
Antecedentes iniciales del proyecto, levantamiento de requerimientos, documentos base, anexos y antecedentes del equipo.

### `Incremento1/`
Documentación del primer incremento, incluyendo informe, presentación, demostración, diagramas y anexos de arquitectura y diseño.

### `Incremento 2/`
Documentación del segundo incremento:
- informe;
- presentación;
- diagramas de casos de uso;
- diagramas de secuencia;
- anexos.

### `Diagramas Caso de Uso/`
Contiene los diagramas de casos de uso incorporados durante la tercera entrega y la actualización documental del alcance funcional.

La documentación formal del tercer incremento puede consolidarse en una carpeta `Incremento 3/` cuando se incorporen informe, presentación, anexos y demás entregables.

---

## Organización funcional

```text
M1  Clientes
M2  Cotizaciones y Notas de Venta
M3  Pagos
M4  Seguridad y Permisos
M5  Proveedores, Egresos y Cuentas por Pagar
M6  Remuneraciones
M7  Dashboard Gerencial
M8  Crédito
M9  Auditoría
```

---

## Consideraciones

- No versionar archivos `.env`, credenciales ni secretos.
- Mantener fuera de Git `node_modules`, compilados, archivos temporales y salidas generadas.
- Mantener cambios de base de datos mediante migraciones controladas.
- Respetar la separación de responsabilidades entre módulos.
- La auditoría transversal pertenece a M9.
- Las exportaciones documentales deben reflejar datos reales disponibles en el sistema.

---

## Repositorio

`Midas2704/Grupo18-PuertasBlindadas`

---

*Proyecto desarrollado por el Grupo 18 para Puertas Blindadas.*
