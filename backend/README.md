# Gestor documental — Backend

API interna construida con Node.js 24, Express 5 y PostgreSQL. La base actual
incluye el servidor, conexiones PostgreSQL, transacciones, gestión de usuarios
por el administrador, catálogo de matter types, protección y recuperación de
contraseñas y autenticación con sesiones. Templates y matters
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
- `npm run test:integration`: prueba autenticación, contraseñas, usuarios y
  matter types contra la base aislada configurada en `TEST_DATABASE_URL`,
  creando y eliminando cuentas y registros temporales.
- `npm run test:watch`: vuelve a ejecutar pruebas cuando cambia un archivo.
- `npm run lint`: revisa la calidad estática del código.
- `npm run migrate`: aplica migraciones en `gestor_documental_dev`.
- `npm run migrate:down`: revierte una migración de desarrollo.
- `npm run migrate:test`: aplica migraciones en `gestor_documental_test`.
- `npm run migrate:create -- nombre`: crea el archivo para una migración futura.
- `npm run db:verify`: verifica esquemas, funciones y migraciones en ambas bases
  sin mostrar credenciales.
- `npm run admin:create`: crea interactivamente el único administrador inicial.
- `npm run admin:reset-password`: recupera interactivamente la contraseña del
  administrador existente; no crea una cuenta nueva.

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
| `POST /api/users/:id/reset-password` | Asigna una contraseña temporal a un `MEMBER`. |

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
    "mustChangePassword": true,
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

La conexión de la interfaz React se realizará en su bloque correspondiente.

## API de matter types

El catálogo identifica categorías como `Family Petition`, no números de matters.
Cada tipo tiene un UUID interno estable, un nombre, una descripción y fechas
automáticas. La creación no requiere una plantilla lista: sus secciones y
documentos se implementarán en el siguiente bloque.

| Método y ruta | Permiso y comportamiento |
| --- | --- |
| `GET /api/matter-types?page=1&limit=20` | `ADMIN` y `MEMBER`: listado paginado. |
| `GET /api/matter-types/:id` | `ADMIN` y `MEMBER`: consulta por UUID. |
| `POST /api/matter-types` | `ADMIN`: crea una categoría. |
| `PATCH /api/matter-types/:id` | `ADMIN`: modifica nombre y/o descripción. |

Todas requieren una sesión vigente sin cambio de contraseña temporal pendiente.
Las escrituras también exigen JSON, el origen autorizado y `X-CSRF-Token`.
No hay ruta de eliminación ni campos de rol, estado activo o contenido de
plantilla. Las respuestas utilizan `Cache-Control: no-store`.

Para crear se aceptan exclusivamente estos campos:

```json
{
  "name": "Family Petition",
  "description": "Document checklist category for family petitions."
}
```

El nombre es obligatorio, de 1 a 120 caracteres tras limpiar espacios iniciales,
finales y consecutivos. Conserva su capitalización para mostrarlo. La descripción
es opcional, se recorta y admite hasta 1000 caracteres; si se omite, se guarda
como `""`. Ningún campo de texto acepta caracteres nulos.

`Family Petition`, `FAMILY PETITION` y ` family   petition ` son el mismo nombre
a efectos de unicidad. La API limpia antes de escribir; PostgreSQL exige el
nombre limpio mediante un `CHECK` y evita duplicados mediante un índice único
en `lower(name)`. Las dos protecciones siguen siendo efectivas si se evita la
API o llegan solicitudes simultáneas.

La creación devuelve `201` y `Location: /api/matter-types/<uuid>`. La consulta
individual y la edición devuelven `200`. Comparten este cuerpo:

```json
{
  "data": {
    "id": "identificador-uuid",
    "name": "Family Petition",
    "description": "Document checklist category for family petitions.",
    "createdAt": "fecha-ISO",
    "updatedAt": "fecha-ISO"
  }
}
```

`PATCH` admite solo `name`, solo `description` o ambos. Debe incluir al menos
uno; un cuerpo vacío se rechaza. Los campos omitidos permanecen intactos.
Enviar `description: ""` borra intencionalmente su contenido; enviar `null` no
es válido. El UUID y `createdAt` se conservan al renombrar. `updatedAt` se
actualiza con el trigger compartido de PostgreSQL.

Las ediciones parciales actualizan directamente los campos enviados, sin leer
el registro y reescribirlo completo. Así, una edición concurrente del nombre
y otra de la descripción conservan ambos cambios. Si se intenta usar un nombre
duplicado, ninguna parte de esa edición se guarda.

El listado ordena por `lower(name)` y UUID ascendente. Los valores predeterminados
son página 1 y límite 20; el máximo por página es 100 y la página máxima es
100000. Solo acepta los parámetros `page` y `limit`, como enteros positivos.
El cuerpo contiene `data` y `pagination` (`page`, `limit`, `total`, `totalPages`),
igual que el listado de usuarios. Total y página se calculan en una sola consulta;
una página fuera de rango devuelve `data: []` manteniendo el total.

Errores específicos: `400 INVALID_INPUT`, `404 MATTER_TYPE_NOT_FOUND` y
`409 MATTER_TYPE_NAME_ALREADY_EXISTS`. Se reutilizan los errores de sesión,
permisos, contraseña temporal, origen, CSRF y tipo de contenido. Los conflictos
de nombre incluyen `fields.name`, sin exponer detalles SQL ni valores privados.

La tabla se crea vacía. Este bloque no importa mocks, conecta React ni decide
si una plantilla está lista; tampoco permite cambiar el tipo de un matter.

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
`src/modules/auth/auth.routes.js`. Allí encontrarás las rutas y el orden
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

Para leer el bloque de contraseñas, recorre primero las rutas y luego
`password.validation.js` → `password.service.js` → `password.repository.js`.
La validación define los cuerpos permitidos; el servicio verifica las
credenciales y decide la operación; el repositorio bloquea la fila del usuario,
actualiza el hash y elimina sus sesiones dentro de la misma transacción.

Después vuelve a `auth.service.js`: el login comprueba el hash antes de abrir
la transacción y lo vuelve a comparar bajo un bloqueo compartido antes de crear
la sesión. Finalmente lee `scripts/resetAdminPassword.js` para el asistente de
recuperación y `tests/integration/password.test.js` para los ejemplos completos.

Archivos del bloque de cambio y recuperación de contraseñas:

- Nuevos: `src/db/migrations/004_add_password_change_requirement.js`,
  `src/modules/auth/password.validation.js`, `password.repository.js`,
  `password.service.js` y `scripts/resetAdminPassword.js`.
- Autenticación actualizada: `auth.routes.js`, `auth.controller.js`,
  `auth.middleware.js`, `auth.repository.js`, `auth.service.js`,
  `auth.constants.js` y `auth.tokens.js`.
- Usuarios actualizados: `users.routes.js`, `users.controller.js`,
  `users.service.js` y `users.repository.js`.
- Protección y configuración: `src/config/logger.js`, `package.json` y
  `scripts/verifyDatabases.js`. No se añaden dependencias.
- Pruebas nuevas: `tests/password.validation.test.js` y
  `tests/integration/password.test.js`; actualizadas: `tests/auth.tokens.test.js`,
  `tests/integration/auth.test.js` y `tests/integration/users.test.js`.
- Documentación: este README. El frontend no cambia en este bloque.

Para leer el catálogo de matter types, empieza por
`src/modules/matterTypes/matterTypes.routes.js`: las dos consultas son comunes,
mientras que cada escritura añade el permiso de administrador y CSRF. Sigue
`matterTypes.controller.js` → `matterTypes.service.js` →
`matterTypes.repository.js`. La validación está en `matterType.validation.js`.

En el repositorio, `COALESCE` conserva los campos que no llegaron en el `PATCH`;
una descripción vacía sí se escribe porque es un valor, no una ausencia.
En el servicio, el error de unicidad de PostgreSQL se transforma en un conflicto
HTTP comprensible. La base de datos resuelve la carrera entre dos nombres iguales.

Archivos de este bloque:

- Nuevos: `src/db/migrations/005_create_matter_types.js` y los cinco archivos de
  `src/modules/matterTypes/`: `matterTypes.routes.js`, `matterTypes.controller.js`,
  `matterTypes.service.js`, `matterTypes.repository.js` y `matterType.validation.js`.
- Pruebas nuevas: `tests/matterType.validation.test.js` y
  `tests/integration/matterTypes.test.js`.
- Actualizados: `src/app.js` registra el módulo,
  `scripts/verifyDatabases.js` comprueba su estructura y cantidad de registros,
  y este README explica el contrato y orden de lectura.
- No cambian dependencias, frontend, mocks ni los archivos del bloque de usuarios
  y contraseñas.

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

La cuarta migración añade `must_change_password` a `app.users`, un booleano
obligatorio con valor predeterminado `false`. No cambia los hashes ni impone
un cambio de contraseña a las cuentas existentes. Los usuarios nuevos creados
por la API y los restablecimientos administrativos sí fijan el indicador en
`true`. La tabla de límites también se reutiliza para operaciones de contraseña
con claves distintas de las del login.

La quinta migración crea `app.matter_types`. Contiene UUID, nombre, descripción
y fechas; añade validación de nombres limpios, unicidad sin distinguir mayúsculas,
límite de descripción y el trigger de `updated_at`. Se revoca el acceso de
`PUBLIC` y no se insertan categorías de ejemplo. No hay relaciones con templates
o matters todavía.

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
| `POST /api/auth/change-password` | Cambia la contraseña propia y revoca todas sus sesiones. |

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
      "systemRole": "MEMBER",
      "mustChangePassword": false
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

## Cambio y recuperación de contraseñas

Una contraseña asignada al crear un `MEMBER` o al restablecerlo es temporal.
El login sigue permitido, pero devuelve `mustChangePassword: true`. Esa sesión
solo puede consultar `/api/auth/me`, cambiar la contraseña propia y cerrar
sesión. Las demás rutas protegidas por `createRequireAuth` devuelven
`403 PASSWORD_CHANGE_REQUIRED`. No es un estado activo/inactivo del usuario.

### Cambio personal

`POST /api/auth/change-password` acepta exclusivamente:

```json
{
  "currentPassword": "contraseña actual del usuario",
  "newPassword": "nueva contraseña privada"
}
```

Requiere sesión, JSON, origen autorizado y `X-CSRF-Token`. Sirve para `ADMIN`
y `MEMBER`, incluyendo usuarios con contraseña temporal. Comprueba la
contraseña actual y exige una nueva diferente, de 12 a 128 caracteres, sin
recortarla. Guarda su hash, pone `mustChangePassword` en `false`, revoca todas
las sesiones del usuario y borra la cookie actual. Devuelve `204`, sin cuerpo;
después se debe iniciar sesión con la nueva contraseña.

Una prueba incorrecta devuelve `400 CURRENT_PASSWORD_INCORRECT`; conservar la
misma contraseña devuelve `400 PASSWORD_UNCHANGED`. Ningún intento fallido
modifica el hash ni revoca sesiones. Se permiten cinco intentos válidos en
formato por usuario durante una ventana fija de 15 minutos.

### Restablecimiento por el administrador

`POST /api/users/:id/reset-password` acepta exclusivamente:

```json
{
  "administratorPassword": "contraseña actual del administrador",
  "newPassword": "contraseña temporal para el miembro"
}
```

Exige los mismos controles HTTP y una sesión `ADMIN` sin cambio pendiente.
Vuelve a comprobar la contraseña del administrador y solo permite un destino
`MEMBER`. No sirve para restablecer al propio administrador. Guarda el hash
temporal, activa `mustChangePassword` y revoca todas las sesiones del miembro;
la sesión administrativa permanece vigente. Devuelve `204`, sin cuerpo.

La prueba administrativa incorrecta devuelve `400 ADMIN_PASSWORD_INCORRECT`,
un destino inexistente `404 USER_NOT_FOUND` y un destino no `MEMBER`
`400 PASSWORD_RESET_NOT_ALLOWED`. No se permite reutilizar la contraseña actual
del miembro. El límite es de diez intentos válidos en formato por administrador
en 15 minutos, independiente de su límite de cambio personal.

Ambos límites cuentan éxitos y fallos, se guardan en PostgreSQL y sobreviven a
reinicios o al cambio de dispositivo. Al superar el límite, la API devuelve
`429 PASSWORD_RATE_LIMITED` y `Retry-After` en segundos. Las validaciones no
devuelven los valores enviados y los logs ocultan los campos de contraseñas.

### Recuperación del administrador desde la terminal

Usa `npm run admin:reset-password` **solo si olvidaste la contraseña del
administrador**. Solicita su username, una nueva contraseña y su confirmación;
las dos entradas de contraseña son ocultas. No necesita la contraseña anterior,
no acepta contraseñas en argumentos o variables de entorno y no expone una
ruta HTTP de recuperación. La seguridad de este mecanismo depende de restringir
el acceso al equipo y a las credenciales de PostgreSQL.

Solo recupera un administrador que ya exista. Revoca todas sus sesiones y deja
`mustChangePassword` en `false`, porque ya elegiste su contraseña personal.
En este bloque no se ejecutó ninguna recuperación sobre la cuenta real.

### Operaciones simultáneas y reversión

El cambio de hash, indicador temporal y revocación se confirman juntos. Si una
parte falla, `ROLLBACK` conserva la contraseña y sesiones anteriores.
La sesión y permisos se vuelven a comprobar dentro de la transacción.

El login mantiene un bloqueo `FOR SHARE` sobre la fila del usuario hasta crear
su sesión. Los cambios usan `FOR UPDATE`, incompatible con ese bloqueo: si el
login termina primero, el cambio posterior elimina su sesión; si el cambio
termina primero, el login detecta que su hash previo ya no coincide y rechaza
las credenciales antiguas. No queda una sesión válida creada con la contraseña
anterior después de completar el cambio. Son bloqueos por fila, no de toda la
tabla. Referencia: [bloqueos de PostgreSQL 15](https://www.postgresql.org/docs/15/explicit-locking.html).

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
Las pruebas de contraseñas comprueban cambios personales, contraseñas
temporales, permisos de restablecimiento, revocación de todos los dispositivos,
límites persistentes, recuperación del administrador ficticio, transacciones
fallidas y ambos órdenes de una carrera entre login y restablecimiento. La
contraseña del administrador de desarrollo no se usa ni se modifica en ellas.
El catálogo se prueba con tipos temporales: permisos de lectura y escritura,
limpieza de nombres, límites de campos, protección SQL, ediciones parciales,
unicidad en creación y edición concurrentes, paginación alfabética, persistencia
al recrear la API y errores seguros. Se eliminan únicamente los registros
identificados como creados por la suite; no se vacía la tabla completa.

## Preparación del despliegue

La autenticación está preparada para frontend y API servidos bajo el mismo
origen en producción. Durante el desarrollo, los puertos de localhost pueden
ser distintos. Si más adelante se alojan frontend y backend en sitios distintos
(por ejemplo, dominios separados de Vercel y Render), deberá revisarse la
arquitectura de cookies o un proxy antes de conectar el frontend.
`FRONTEND_ORIGIN` debe contener solo el origen permitido, sin rutas ni barra final.
