# Gestor documental — Backend

API interna construida con Node.js 24, Express 5 y PostgreSQL. La base actual
incluye el servidor, conexiones PostgreSQL, transacciones, usuarios internos y
protección de contraseñas. Todavía no contiene sesiones, rutas de autenticación,
templates ni matters.

## Requisitos

- Node.js 24 o superior.
- npm 11 o superior.
- PostgreSQL 15 o superior.

## Preparación local

1. Crea el rol y las bases locales siguiendo la sección **PostgreSQL local**.
2. Instala las dependencias con `npm install`.
3. Copia `.env.example` como `.env`.
4. Reemplaza `replace_me` por la contraseña del rol local en las tres URLs.
5. Conserva `DATABASE_SSL=disable` durante el desarrollo local.
6. Ejecuta `npm run migrate` y `npm run migrate:test`.
7. Inicia el servidor con `npm run dev`.

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
- `npm run migrate`: aplica migraciones en `gestor_documental_dev`.
- `npm run migrate:down`: revierte una migración de desarrollo.
- `npm run migrate:test`: aplica migraciones en `gestor_documental_test`.
- `npm run migrate:create -- nombre`: crea el archivo para una migración futura.
- `npm run db:verify`: verifica esquemas, funciones y migraciones en ambas bases
  sin mostrar credenciales.
- `npm run admin:create`: crea interactivamente el único administrador inicial.

## Administrador inicial

Después de aplicar las migraciones, ejecuta:

```text
npm run admin:create
```

El comando solicita nombre completo, nombre de usuario, contraseña y
confirmación. La contraseña queda oculta mientras se escribe, nunca se recibe
como argumento y no debe añadirse a `.env`. El comando se detiene sin hacer
cambios si ya existe un administrador.

Esta cuenta pertenece a la aplicación y su contraseña es independiente de la
contraseña del rol de PostgreSQL. Los demás usuarios se crearán posteriormente
desde una ruta exclusiva del administrador; no habrá registro público.

## PostgreSQL local

El servicio local detectado es PostgreSQL 15.4. Para preparar las bases desde
PGAdmin 4:

1. Abre el servidor local registrado en PGAdmin.
2. Entra en la base `postgres` con un usuario administrador.
3. Abre **Query Tool**.
4. Escoge una contraseña privada y ejecuta esta instrucción después de reemplazar
   el texto temporal:

```sql
CREATE ROLE gestor_documental_app
  LOGIN
  PASSWORD 'REEMPLAZA_CON_UNA_CONTRASEÑA_PRIVADA'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE;
```

5. Ejecuta por separado:

```sql
CREATE DATABASE gestor_documental_dev OWNER gestor_documental_app;
```

6. Después ejecuta por separado:

```sql
CREATE DATABASE gestor_documental_test OWNER gestor_documental_app;
```

`CREATE DATABASE` debe ejecutarse fuera de una transacción. No escribas la
contraseña en este README, Git, capturas o mensajes. Si contiene caracteres como
`@`, `:`, `/`, `#` o `%`, deben codificarse al colocarla dentro de una URL.

La base de pruebas estará aislada. Las pruebas futuras podrán reconstruirla sin
afectar la información utilizada durante el desarrollo.

## Orden de lectura

1. `src/server.js`: abre el puerto y controla el cierre del proceso.
2. `src/app.js`: construye Express y registra los middleware y rutas.
3. `src/config/env.js`: valida la configuración recibida desde el entorno.
4. `src/config/logger.js`: evita registrar cookies, tokens y contraseñas.
5. `src/db/pool.js`: configura y limita conexiones PostgreSQL.
6. `src/db/transaction.js`: ejecuta operaciones con `BEGIN`, `COMMIT` y `ROLLBACK`.
7. `src/db/migrations/001_create_app_schema.js`: crea el esquema privado `app`.
8. `src/db/migrations/002_create_users.js`: crea usuarios, restricciones e
   índices.
9. `src/modules/users/user.validation.js`: normaliza y valida los datos de una
   cuenta.
10. `src/modules/auth/password.js`: genera y comprueba hashes Argon2id.
11. `src/modules/users/users.repository.js`: contiene las consultas SQL de
    usuarios.
12. `src/modules/users/users.service.js`: aplica las reglas del administrador
    inicial.
13. `scripts/createAdmin.js`: presenta el asistente privado de creación.
14. `src/modules/health/health.routes.js`: declara `GET /api/health`.
15. `src/modules/health/health.controller.js`: consulta PostgreSQL y responde.
16. `src/middleware/notFound.js`: convierte rutas desconocidas en un error común.
17. `src/middleware/errorHandler.js`: transforma errores en JSON seguro.
18. `src/shared/AppError.js`: representa errores esperados de la aplicación.
19. `tests/health.test.js`: prueba HTTP, seguridad y fallos de conexión.
20. `tests/transaction.test.js`: prueba confirmación y reversión de transacciones.
21. `tests/password.test.js`: comprueba el hash y la verificación de contraseñas.
22. `tests/user.validation.test.js`: prueba normalización y reglas de entrada.

## Flujo de una solicitud

```text
Navegador
→ protecciones HTTP y CORS
→ analizador JSON
→ ruta
→ controller
→ PostgreSQL
→ respuesta JSON
```

Si ninguna ruta coincide, la solicitud pasa por `notFound` y finalmente por
`errorHandler`.

Una respuesta saludable incluye las dos capas:

```json
{
  "data": {
    "status": "ok",
    "service": "gestor-documental-api",
    "database": "connected"
  }
}
```

Si PostgreSQL no responde, la API devuelve `503 DATABASE_UNAVAILABLE` sin exponer
la URL, usuario, contraseña ni mensaje interno de conexión.

## Migraciones

Las migraciones son el historial versionado de la base de datos. No crearemos
tablas manualmente desde PGAdmin después de preparar las dos bases vacías.

La primera migración crea:

- El esquema privado `app`.
- Una función reutilizable para actualizar `updated_at`.
- Una revocación de acceso público al esquema.

`node-pg-migrate` registra sus ejecuciones en el esquema técnico
`app_migrations`, separado de los datos de la aplicación.

La segunda migración crea `app.users` con:

- UUID como identificador interno.
- Nombre de usuario normalizado y único sin depender de mayúsculas.
- Nombre completo.
- Hash de contraseña; nunca la contraseña original.
- Rol técnico `ADMIN` o `MEMBER`.
- Fechas automáticas de creación y modificación.
- Una restricción que permite como máximo un administrador.

No incluye correo electrónico ni estado activo/inactivo. El rol técnico solo
controlará autorizaciones del sistema y no representa el cargo de una persona
dentro de la firma.

Cada migración incluye `up` y `down`. `up` aplica el cambio. `down` existe para
corregir el desarrollo, pero no debe utilizarse improvisadamente sobre datos de
producción.

## Protección de contraseñas

Las contraseñas tienen entre 12 y 128 caracteres. Se procesan con Argon2id,
memoria de 64 MiB, tres iteraciones, un grado de paralelismo y una sal distinta
generada automáticamente para cada hash.

El backend solo conservará el hash. La verificación compara una contraseña
recibida con ese hash sin intentar descifrarlo.

## Variables reservadas para sesiones

`.env.example` enumera el nombre y duración futura de las sesiones. Esas dos
variables no se utilizan todavía; se activarán en el siguiente bloque.
