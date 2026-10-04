# Gestor documental — Backend

API interna construida con Node.js 24, Express 5 y PostgreSQL. La base actual
incluye el servidor, conexiones PostgreSQL, transacciones, gestión de usuarios
por el administrador, protección de contraseñas y autenticación con sesiones. Templates y matters
se implementarán en los siguientes bloques.

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
- `npm test`: ejecuta pruebas unitarias y HTTP sin conectarse a PostgreSQL real.
- `npm run test:integration`: prueba autenticación y gestión de usuarios contra la base aislada
  configurada en `TEST_DATABASE_URL`, creando y eliminando cuentas temporales.
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
contraseña del rol de PostgreSQL. Los demás usuarios se crean mediante
`POST /api/users`, una ruta exclusiva del administrador.

## API de usuarios

Todas estas rutas requieren una sesión vigente y el rol `ADMIN`:

| Método y ruta | Comportamiento |
| --- | --- |
| `POST /api/users` | Crea una cuenta `MEMBER`. |
| `GET /api/users?page=1&limit=20` | Devuelve un listado paginado. |
| `GET /api/users/:id` | Consulta una cuenta por su UUID. |

La creación requiere JSON, el origen autorizado y `X-CSRF-Token` de la sesión
administrativa. Se aceptan exclusivamente `username`, `fullName` y `password`.
El username se guarda en minúsculas; nombre y username se recortan, pero la
contraseña conserva exactamente sus caracteres. La cuenta se crea siempre como
`MEMBER`; no se puede enviar un rol, correo ni estado activo/inactivo.

Una creación correcta devuelve `201` y una cabecera `Location` con la ruta de
consulta de la nueva cuenta. Su cuerpo tiene esta forma:

```json
{
  "data": {
    "id": "identificador-uuid",
    "username": "team.member",
    "fullName": "Team Member",
    "systemRole": "MEMBER",
    "createdAt": "fecha-ISO",
    "updatedAt": "fecha-ISO"
  }
}
```

La consulta individual devuelve el mismo formato. Las respuestas excluyen
contraseñas, hashes y datos de sesiones y usan `Cache-Control: no-store`.
Los usuarios `MEMBER` pueden consultar su sesión mediante `/api/auth/me`, pero
las rutas administrativas de usuarios requieren `ADMIN`.

El listado ordena por fecha de creación descendente y UUID descendente para
mantener un orden estable. La página predeterminada es 1, el tamaño predeterminado
es 20 y el máximo es 100. Ambos parámetros deben ser enteros positivos; la
página tiene un máximo técnico de 100000. Devuelve:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Una página fuera del listado devuelve un arreglo vacío y conserva el total.
La consulta SQL calcula total y página en una misma operación para que compartan
la misma vista de los datos ante creaciones simultáneas.

Errores esperados: `401 AUTHENTICATION_REQUIRED`, `403 ADMIN_REQUIRED`,
`403 INVALID_CSRF_TOKEN`, `403 ORIGIN_NOT_ALLOWED`, `415 JSON_REQUIRED`,
`400 INVALID_INPUT`, `409 USERNAME_ALREADY_EXISTS` y `404 USER_NOT_FOUND`.
Los errores de validación incluyen un objeto `fields` con mensajes por campo,
sin incluir sus valores. PostgreSQL resuelve la unicidad del username incluso
cuando llegan dos creaciones simultáneas.

Este bloque reutiliza la tabla existente; no requiere una migración nueva.
La conexión de la interfaz React se realizará en su bloque correspondiente.

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

Para leer el bloque de autenticación, empieza por
`src/modules/auth/auth.routes.js`. Allí encontrarás las tres rutas y el orden
de sus controles. Después sigue este recorrido:

```text
auth.routes.js
→ auth.middleware.js (origen, datos, límites, sesión, permisos y CSRF)
→ auth.controller.js (solicitud y respuesta HTTP)
→ auth.service.js (verificación de contraseña y creación de sesión)
→ auth.repository.js (consultas PostgreSQL)
```

Los auxiliares son `auth.cookies.js` para leer, emitir y borrar cookies,
`auth.tokens.js` para generar y comparar tokens, `auth.validation.js` para
validar el login y `auth.constants.js` para los límites y frecuencias.
`auth.maintenance.js` inicia la limpieza al abrir el servidor y la repite cada
15 minutos, sin ejecuciones superpuestas.

Finalmente revisa `003_create_authentication.js` para ver la estructura de las
tablas y `tests/integration/auth.test.js` para observar el comportamiento completo.

Para leer la API de usuarios, sigue `users.routes.js` → `users.controller.js` →
`users.service.js` → `users.repository.js`. Las rutas aplican autenticación y
permiso de administrador antes de llamar a los controladores; al crear una
cuenta también exigen CSRF. `user.validation.js` define los formatos y
`src/middleware/validateRequest.js` conserva los datos validados en
`req.validated` sin sustituir el cuerpo, los parámetros o la query de Express.

Archivos del bloque de creación y consulta de usuarios:

- Nuevos: `users.routes.js`, `users.controller.js` y
  `src/middleware/validateRequest.js`.
- Actualizados: `user.validation.js`, `users.service.js`, `users.repository.js`
  y `src/app.js`.
- Pruebas: nuevo `tests/integration/users.test.js`, ampliación de
  `tests/user.validation.test.js` y helper compartido
  `tests/integration/testDatabase.js`, reutilizado por `auth.test.js`.
- Configuración y documentación: `package.json` ejecuta las suites de
  integración en secuencia; este README describe el contrato de la API.

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

La tercera migración crea `app.auth_sessions` y `app.auth_login_limits`.
La primera relaciona cada sesión con un usuario y conserva el hash de su token,
un token CSRF independiente y fechas de creación y expiración. La segunda
conserva contadores temporales de login mediante claves derivadas de IP y
username, sin guardar esos valores directamente en sus filas.

Cada migración incluye `up` y `down`. `up` aplica el cambio. `down` existe para
corregir el desarrollo, pero no debe utilizarse improvisadamente sobre datos de
producción.

## Protección de contraseñas

Las contraseñas tienen entre 12 y 128 caracteres. Se procesan con Argon2id,
memoria de 64 MiB, tres iteraciones, un grado de paralelismo y una sal distinta
generada automáticamente para cada hash.

El backend solo conservará el hash. La verificación compara una contraseña
recibida con ese hash sin intentar descifrarlo.

## Autenticación y sesiones

Las rutas disponibles son:

| Método y ruta | Comportamiento |
| --- | --- |
| `POST /api/auth/login` | Valida credenciales y emite una cookie de sesión. |
| `GET /api/auth/me` | Devuelve el usuario, token CSRF y expiración de su sesión. |
| `POST /api/auth/logout` | Revoca la sesión actual y borra su cookie. |

El login requiere JSON y una cabecera `Origin` exactamente igual a
`FRONTEND_ORIGIN`. Su cuerpo contiene `username` y `password`. Una cuenta
inexistente y una contraseña incorrecta generan el mismo error
`401 INVALID_CREDENTIALS`; también se realiza una verificación Argon2id para
cuentas inexistentes.

Las respuestas de login y `/me` tienen esta forma:

```json
{
  "data": {
    "user": {
      "id": "identificador-uuid",
      "username": "usuario",
      "fullName": "Nombre completo",
      "systemRole": "MEMBER"
    },
    "csrfToken": "token-aleatorio-de-64-caracteres",
    "expiresAt": "fecha-ISO"
  }
}
```

El token de sesión se entrega únicamente mediante una cookie `HttpOnly`, con
`SameSite=Lax`, `Path=/` y sin `Domain`. En producción también lleva `Secure`,
por lo que requiere HTTPS. La cookie permite al servidor identificar la sesión;
el token CSRF de la respuesta se envía mediante `X-CSRF-Token` al modificar datos.
Los tokens no deben colocarse en URLs, logs ni almacenamiento local del navegador.
Las respuestas de autenticación usan `Cache-Control: no-store`.

`SESSION_COOKIE_NAME` define el nombre de la cookie y `SESSION_TTL_HOURS` su
duración absoluta (12 horas por defecto, entre 1 y 24). Consultar `/me` no renueva
la duración. Cada login genera tokens nuevos y reemplaza la sesión que ese
navegador enviaba previamente. Los demás dispositivos conservan sus sesiones.
Logout requiere la cookie, el origen permitido y su token CSRF; devuelve `204`.

Las sesiones están en PostgreSQL y sobreviven a reinicios del backend. Una sesión
vencida siempre devuelve `401`, incluso antes de que la limpieza elimine su fila.
Las sesiones y contadores vencidos se limpian al arrancar el servidor y cada
15 minutos mientras se encuentra en ejecución. Si Render está suspendido,
la limpieza se reanudará cuando despierte; la expiración sigue siendo efectiva.

`createRequireAuth(database)` consulta sesión y usuario en cada solicitud.
`requireAdmin` comprueba el rol actual y `requireCsrf` verifica operaciones
que modifican datos. Estas funciones serán reutilizadas por futuras rutas.

## Límites de login

Se permiten 10 intentos válidos en formato por combinación de username e IP y
50 por IP en ventanas fijas de 15 minutos. Se cuentan tanto éxitos como fallos.
Al superar el límite se devuelve `429 LOGIN_RATE_LIMITED` y `Retry-After`, en
segundos. Una nueva solicitud no prolonga una ventana que ya comenzó.

Los incrementos se realizan atómicamente con `INSERT ... ON CONFLICT` en
PostgreSQL. Los límites sobreviven a reinicios y no requieren Redis. La IP se
obtiene de Express: localmente no se confían cabeceras de proxy; en producción
el servidor está configurado para un salto de proxy, que deberá comprobarse
al preparar el despliegue.

## Pruebas de integración

Ejecuta `npm run migrate:test` antes de `npm run test:integration`. El comando
carga `.env`, pero dirige las consultas de las pruebas a `TEST_DATABASE_URL`.
Se detiene si esta URL coincide con la base de desarrollo o si el nombre de
la base de pruebas no termina en `_test`.

Las pruebas usan credenciales ficticias y eliminan sus usuarios temporales al
terminar; sus sesiones se eliminan en cascada. La base de pruebas se reserva
para estas comprobaciones y no necesita un administrador permanente.
Las suites se ejecutan en secuencia porque cada una crea un administrador
temporal y la base admite solamente uno. El helper `testDatabase.js` comparte
la validación de configuración y la creación del pool aislado.

Se comprueban login, cookies, expiración, persistencia al recrear la API,
rotación de tokens, logout por dispositivo, permisos vigentes, CSRF, límites
bajo solicitudes simultáneas y limpieza de datos vencidos.
También se comprueban creación por administrador, rechazo de usuarios comunes,
campos públicos, acceso de cuentas nuevas, unicidad concurrente, paginación y
validación de entrada.

## Preparación del despliegue

La autenticación está preparada para frontend y API servidos bajo el mismo
origen en producción. Durante el desarrollo, los puertos de localhost pueden
ser distintos. Si más adelante se alojan frontend y backend en sitios distintos
(por ejemplo, dominios separados de Vercel y Render), deberá revisarse la
arquitectura de cookies o un proxy antes de conectar el frontend.
`FRONTEND_ORIGIN` debe contener solo el origen permitido, sin rutas ni barra final.
