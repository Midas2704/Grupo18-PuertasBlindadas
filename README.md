# Modulo Financiero - Puertas Blindadas (Grupo 18)

Repositorio oficial del Módulo de Finanzas del ERP para Puertas Blindadas.

# Integrantes:
- Sebastián Benjamín Bravo Núñez
- Gianella Belén Catalán Canales  
- Vicente Andrés Hernández Olea
- Daniella Rosa Catalina Lecanda Garnham 
- Angella Javiera Sánchez Lopéz 

## Estructura del Proyecto

El proyecto está dividido en dos partes principales dentro de la carpeta `/CODIGO`:

- **/CODIGO/Controladores**: API REST construida con Node.js, Express, TypeScript y Prisma ORM. Gestiona la lógica de negocio, integración con base de datos PostgreSQL (Raspberry Pi) y el módulo de transacciones financieras.
- **/CODIGO/Vistas**: Aplicación web interactiva construida con React, TypeScript, Vite y Tailwind CSS. Incluye el sistema de diseño y las interfaces para gestión de cotizaciones, notas de venta, clientes y dashboard principal.

## Tecnologías Utilizadas

- **Capa de Vistas**: React 19, Vite, Tailwind CSS, React Router DOM, Lucide React.
- **Capa de Controladores**: Node.js, Express, TypeScript, Prisma (ORM), PostgreSQL.
- **Capa de Persistencia**: PostgreSQL (Desplegada en entorno local/Raspberry Pi).

## Guía de Instalación y Ejecución

Para levantar el entorno de desarrollo local, es necesario instalar las dependencias y correr ambos servicios (API y Vistas) en paralelo.

### 1. Clonar el repositorio
```bash
git clone https://github.com/Midas2704/Grupo18-SistemaFinanciero-PuertasBlindadas.git
cd Grupo18-SistemaFinanciero-PuertasBlindadas
```

### 2. Levantar la Capa de Persistencia (Base de Datos)
Para inicializar la base de datos PostgreSQL, se debe ejecutar el script SQL ubicado en la raíz del proyecto: `Base_de_datos_Tres_Schemas.sql`. Este documento contiene todas las instrucciones necesarias para generar las tablas y relaciones de los esquemas utilizados por el sistema.

### 3. Configurar y Ejecutar la capa de controladores
```bash
cd CODIGO/Controladores
npm install

# Configurar variables de entorno requeridas en el archivo .env
# Ejemplo: DATABASE_URL="postgresql://user:pass@host:5432/db"

# Levantar el servidor en modo desarrollo
npm run dev
```
El backend estará disponible por defecto en `http://localhost:3000`.

### 4. Configurar y Ejecutar la capa de vistas
Abre una nueva pestaña en tu terminal y ejecuta:
```bash
cd CODIGO/Vistas
npm install

# Levantar el servidor de desarrollo de Vite
npm run dev
```
La aplicación web estará disponible por defecto en `http://localhost:5173`.

## Capa de Persistencia y Scripts (Prisma)

El proyecto utiliza Prisma ORM. Algunos de los comandos y scripts útiles disponibles en `/CODIGO/Controladores`:
- `npx prisma db pull`: Sincroniza el esquema de Prisma desde la base de datos externa.
- `npx prisma generate`: Genera el cliente de Prisma actualizado.
- `npx prisma studio`: Abre la interfaz visual de la base de datos en el navegador.

Adicionalmente, los scripts para la carga inicial de datos (seeding) masivos o de limpieza se encuentran ubicados en `CODIGO/Controladores/scripts` (ej. `massive_seed_v2.js`) y `CODIGO/Controladores/prisma/seed.ts`.

## Documentación Adicional

El repositorio incluye la documentación oficial exigida a lo largo de las distintas fases del proyecto, separada en las siguientes carpetas:

### 📁 /Documento 0
Contiene todos los entregables iniciales relacionados con la formulación del proyecto, levantamiento de requerimientos y conformación del equipo.
- **Documentos principales:** Informe inicial de requerimientos (`Documento0_EquipoFinanzas...docx`) y la presentación del inicial (`Sistema Financiero Puertas Blindadas.pptx`).
- **Validación:** Evidencia de la aceptación de requerimientos por parte del cliente (`Correo Aceptacion...png`).
- **Subcarpetas:** `CV` (Currículums del equipo) y `Anexo`.

### 📁 /Incremento1
Contiene todas las herramientas, informes y diagramas entregados correspondientes al primer incremento de desarrollo.
- **Documentos principales:** El informe oficial del incremento (`Informe Incremento 1...docx`) y la presentación del mismo (`Puertas Blindadas Sistema financiero.pptx`).
- **Multimedia:** Video de demostración funcional del primer incremento (`Demostracion Incremento 1.mp4`).
- **Subcarpetas de Arquitectura y Diseño:**
  - `Diagramas Casos de Uso`: Modelamiento de la interacción de los actores con el sistema.
  - `Diagramas de Secuencia`: Flujo de operaciones internos del sistema financiero.
  - `Anexo`: Diseños de arquitectura adicionales, incluyendo diagramas de componentes, despliegue, navegación y MERE.
  - `Retrospectiva`: Documentación sobre la retrospectiva ágil del equipo en esta iteración.

---
*Desarrollado bajo los estándares y lineamientos de la Facultad de Ingeniería.*
