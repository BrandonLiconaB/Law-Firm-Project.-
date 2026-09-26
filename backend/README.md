# Gestor documental — Backend

API interna construida con Node.js 24 y Express 5. Este primer bloque solamente
establece la base del servidor; todavía no contiene conexión con PostgreSQL,
autenticación, templates ni matters.

## Requisitos

- Node.js 24 o superior.
- npm 11 o superior.

## Preparación local

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` como `.env`.
3. Conserva `PORT=3000` y `FRONTEND_ORIGIN=http://localhost:5173` durante el
   desarrollo local.
4. Inicia el servidor con `npm run dev`.

La dirección de comprobación será:

```text
http://localhost:3000/api/health
```

## Comandos

- `npm run dev`: inicia Node en modo observación.
- `npm start`: inicia el servidor sin observación.
- `npm test`: ejecuta las pruebas automáticas.
- `npm run test:watch`: vuelve a ejecutar pruebas cuando cambia un archivo.
- `npm run lint`: revisa la calidad estática del código.

## Orden de lectura

1. `src/server.js`: abre el puerto y controla el cierre del proceso.
2. `src/app.js`: construye Express y registra los middleware y rutas.
3. `src/config/env.js`: valida la configuración recibida desde el entorno.
4. `src/config/logger.js`: evita registrar cookies, tokens y contraseñas.
5. `src/modules/health/health.routes.js`: declara `GET /api/health`.
6. `src/modules/health/health.controller.js`: construye su respuesta.
7. `src/middleware/notFound.js`: convierte rutas desconocidas en un error común.
8. `src/middleware/errorHandler.js`: transforma errores en JSON seguro.
9. `src/shared/AppError.js`: representa errores esperados de la aplicación.
10. `tests/health.test.js`: documenta el comportamiento esperado mediante pruebas.

## Flujo de una solicitud

```text
Navegador
→ protecciones HTTP y CORS
→ analizador JSON
→ ruta
→ controller
→ respuesta JSON
```

Si ninguna ruta coincide, la solicitud pasa por `notFound` y finalmente por
`errorHandler`.

## Variables reservadas para los siguientes bloques

`.env.example` ya enumera las conexiones de aplicación y migración, el tamaño del
pool y la configuración futura de sesiones. No se utilizan todavía y pueden
permanecer vacías hasta comenzar PostgreSQL.
