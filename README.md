# CampiAmigo – Conecta y Explora el Mundo Agrícola

CampiAmigo es una plataforma web diseñada para conectar a productores agrícolas (CampiAmigos) con clientes interesados en productos frescos y de calidad. La aplicación permite explorar territorios en 3D, gestionar perfiles de usuario, administrar productos y mucho más.

## Contexto del Proyecto

En un mundo donde la conexión entre productores agrícolas y consumidores finales es cada vez más importante, CampiAmigo surge como una solución innovadora para fortalecer la red agroalimentaria. Este proyecto busca:

- **Empoderar a los productores agrícolas**: Brindándoles una plataforma para mostrar sus productos y conectarse directamente con los clientes.
- **Promover la sostenibilidad**: Reduciendo intermediarios y fomentando el consumo de productos locales.
- **Facilitar la exploración de territorios agrícolas**: A través de herramientas interactivas en 3D que permiten conocer las zonas productoras y sus características.

CampiAmigo no solo es una herramienta tecnológica, sino también un puente para fortalecer la economía local y fomentar la confianza entre productores y consumidores.

---

## Tabla de Contenidos

1. [Características](#características)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación](#instalación)
4. [Ejecución del Proyecto](#ejecución-del-proyecto)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Herramientas Utilizadas](#herramientas-utilizadas)
7. [Uso](#uso)
8. [Contribuciones](#contribuciones)
9. [Licencia](#licencia)

---

## Características

- **Exploración 3D**: Visualiza territorios agrícolas en un entorno interactivo.
- **Gestión de Usuarios**: Registra, edita y administra perfiles de usuarios y CampiAmigos.
- **Productos**: Publica, edita y visualiza productos agrícolas con soporte para modelos 3D.
- **Interfaz Intuitiva**: Diseño responsivo y accesible para una experiencia de usuario óptima.
- **Administración**: Herramientas avanzadas para administradores, como generación de reportes en PDF.

---

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente:

- [Node.js](https://nodejs.org/) (versión 16 o superior)
- [Angular CLI](https://angular.io/cli) (versión 15 o superior)
- [PNPM](https://pnpm.io/) (opcional, pero recomendado)
- Un navegador moderno (Google Chrome, Mozilla Firefox, etc.)

---

## Instalación

1. Clona este repositorio en tu máquina local:

   ```bash
   git clone https://github.com/tu-usuario/campiamigo.git
   cd campiamigo
   ```

2. Instala las dependencias del proyecto:

   ```bash
   npm install
   ```

   O si estás usando PNPM:

   ```bash
   pnpm install
   ```

---

## Ejecución del Proyecto

Para iniciar el servidor de desarrollo, ejecuta:

```bash
ng serve
```

Una vez que el servidor esté en funcionamiento, abre tu navegador y navega a `http://localhost:4200/`. La aplicación se recargará automáticamente cada vez que modifiques alguno de los archivos fuente.

---

## Estructura del Proyecto

Una breve descripción de las carpetas y archivos más importantes en el proyecto:

- `src/`: Contiene el código fuente de la aplicación.
  - `app/`: Módulo principal de la aplicación.
  - `assets/`: Archivos estáticos como imágenes y modelos 3D.
  - `environments/`: Archivos de configuración para diferentes entornos (desarrollo, producción, etc.).
- `angular.json`: Configuración del proyecto para Angular CLI.
- `package.json`: Dependencias y scripts del proyecto.

---

## Herramientas Utilizadas

En el desarrollo de CampiAmigo se utilizaron las siguientes herramientas y tecnologías:

- **Angular**: Framework para la construcción de la interfaz de usuario.
- **Node.js**: Entorno de ejecución para el servidor.
- **Express**: Framework para Node.js que maneja las peticiones del servidor.
- **MongoDB**: Base de datos NoSQL para almacenar la información de usuarios y productos.
- **Mongoose**: ODM para MongoDB y Node.js.
- **Three.js**: Biblioteca JavaScript para crear y mostrar gráficos 3D en el navegador.
- **Bootstrap**: Framework de CSS para un diseño responsivo y moderno.

---

## Uso

Después de iniciar el servidor de desarrollo, puedes comenzar a explorar las diferentes características de CampiAmigo:

- Regístrate como nuevo usuario o inicia sesión si ya tienes una cuenta.
- Explora territorios agrícolas en 3D y descubre productos frescos.
- Si eres productor, publica tus productos y gestiona tu perfil de CampiAmigo.

---

## Contribuciones

Las contribuciones son bienvenidas. Por favor, sigue estos pasos para contribuir:

1. Haz un fork del repositorio.
2. Crea una nueva rama para tu característica o corrección de bug:
   ```bash
   git checkout -b mi-nueva-caracteristica
   ```
3. Realiza tus cambios y haz commit de ellos:
   ```bash
   git commit -m "Agrega nueva característica"
   ```
4. Sube tus cambios a tu fork:
   ```bash
   git push origin mi-nueva-caracteristica
   ```
5. Crea un Pull Request en este repositorio.

---

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

¡Gracias por tu interés en CampiAmigo! Esperamos que esta plataforma sea de gran utilidad para ti.
