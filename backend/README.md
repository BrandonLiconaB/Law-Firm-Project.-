# Gestor documental — Backend

API interna construida con Node.js 24, Express 5 y PostgreSQL. La base actual
incluye el servidor, conexiones PostgreSQL, transacciones, gestión de usuarios
por el administrador, catálogo de matter types y sus plantillas de documentos,
protección y recuperación de contraseñas y autenticación con sesiones.
Autenticación, usuarios y catálogo de plantillas ya están conectados con React.
La estructura PostgreSQL de matters está creada; su API, sincronización de
plantillas y conexión con React se implementarán en los siguientes bloques.

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
- `npm run test:integration`: prueba autenticación, contraseñas, usuarios,
  matter types, plantillas y estructura de matters contra la base aislada
  configurada en `TEST_DATABASE_URL`. Los datos temporales se eliminan o revierten
  según la suite; nunca se utiliza la base de desarrollo.
- `npm run test:watch`: vuelve a ejecutar pruebas cuando cambia un archivo.
- `npm run lint`: revisa la calidad estática del código.
- `npm run migrate`: aplica migraciones en `gestor_documental_dev`.
- `npm run migrate:down`: revierte una migración de desarrollo.
- `npm run migrate:test`: aplica migraciones en `gestor_documental_test`.
- `npm run migrate:create -- nombre`: crea el archivo para una migración futura.
- `npm run db:verify`: verifica esquemas, funciones, migraciones y estructura de
  tablas en ambas bases. Incluye contadores de matters sin mostrar sus datos ni
  credenciales.
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
automáticas. Cada tipo tiene una plantilla lógica propia, formada por secciones
y documentos. La creación no requiere una plantilla lista: se configura después.

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
    "updatedAt": "fecha-ISO",
    "templateRevision": 0,
    "documentCount": 0,
    "keyDocumentCount": 0,
    "templateStatus": "Template required"
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

Los contadores, la revisión y el estado de la plantilla se incluyen también en
el listado y en las respuestas de creación y edición de categorías. Se calculan
con las definiciones actuales; no son campos editables por el consumidor.
Las tablas se crean vacías, sin importar mocks ni conectar React. El cambio de
tipo de un matter todavía no está implementado en el backend.

## API de plantillas

La ruta base es `/api/matter-types/:matterTypeId/template`. No existe una tabla
independiente de templates: las secciones y documentos pertenecen directamente
al UUID de un matter type. Cambiar su nombre no modifica esa asociación.

Todas las rutas requieren una sesión sin cambio temporal de contraseña pendiente.
`ADMIN` y `MEMBER` pueden consultar; solo `ADMIN` puede modificar. Las escrituras
exigen origen autorizado y `X-CSRF-Token`; aquellas con cuerpo también exigen JSON.
Las respuestas utilizan `Cache-Control: no-store`.

| Método y ruta relativa a la base | Comportamiento |
| --- | --- |
| `GET /` | Consulta la plantilla actual completa. |
| `POST /sections` | Crea una sección al final. |
| `PATCH /sections/:sectionId` | Cambia su nombre, conservando su UUID. |
| `DELETE /sections/:sectionId` | Retira la sección y pasa sus documentos actuales a General. |
| `POST /sections/:sectionId/move` | Mueve una posición arriba o abajo. |
| `POST /documents` | Crea una definición al final de su grupo. |
| `PATCH /documents/:documentId` | Edita sus campos o cambia su sección. |
| `DELETE /documents/:documentId` | Retira la definición sin borrar su fila. |
| `POST /documents/:documentId/move` | Mueve una posición dentro de su grupo. |

### Campos y ejemplos

Crear o renombrar una sección acepta exclusivamente `{ "name": "Petitioner" }`.
Crear un documento acepta:

```json
{
  "name": "Petitioner passport",
  "description": "Copy of the identification page.",
  "sectionId": "uuid-de-la-seccion",
  "isKey": true,
  "expectedQuantity": 1
}
```

Solo `name` es obligatorio. Los valores omitidos son `description: ""`,
`sectionId: null`, `isKey: false` y `expectedQuantity: null`. Un documento sin
sección pertenece a General; General no necesita una fila en la base de datos.

Los nombres se limpian y admiten de 1 a 120 caracteres. Las descripciones se
recortan y admiten hasta 1000. No se aceptan caracteres nulos. `isKey` debe ser
booleano; `expectedQuantity` admite `null` o un entero entre 1 y 2147483647,
nunca texto numérico ni decimales. La cantidad es informativa, no una condición
para marcar documentos recibidos en un matter futuro.

`PATCH` de documento permite cualquiera de esos cinco campos y exige al menos
uno. Conserva los omitidos; `description: ""`, `sectionId: null`, `isKey: false`
y `expectedQuantity: null` son cambios explícitos válidos. Cambiar la sección
añade el documento al final del nuevo grupo y reajusta las posiciones del anterior.

Los nombres de sección son únicos dentro del tipo. Los nombres de documento
son únicos en toda la plantilla, incluyendo todas sus secciones y General.
Por ejemplo, usa `Petitioner passport` y `Beneficiary passport`, no dos
definiciones llamadas `Passport`. La unicidad ignora mayúsculas y espacios
consecutivos; otros matter types sí pueden reutilizar esos nombres.

Mover acepta exclusivamente `{ "direction": "up" }` o
`{ "direction": "down" }`. No acepta una posición arbitraria. Las posiciones
empiezan en 1 y permanecen consecutivas dentro de cada grupo. Un documento no
cambia de sección al moverlo. Intentar salir del primer o último lugar devuelve
`400 TEMPLATE_MOVE_OUT_OF_RANGE`, sin guardar cambios.

### Lectura y respuestas

`GET` devuelve esta estructura:

```json
{
  "data": {
    "matterType": {
      "id": "uuid-del-tipo",
      "name": "Family Petition",
      "description": "",
      "createdAt": "fecha-ISO",
      "updatedAt": "fecha-ISO",
      "templateRevision": 2,
      "documentCount": 1,
      "keyDocumentCount": 1,
      "templateStatus": "Ready"
    },
    "sections": [
      {
        "id": "uuid-de-la-seccion",
        "matterTypeId": "uuid-del-tipo",
        "name": "Petitioner",
        "position": 1,
        "createdAt": "fecha-ISO",
        "updatedAt": "fecha-ISO"
      }
    ],
    "documents": [
      {
        "id": "uuid-del-documento",
        "matterTypeId": "uuid-del-tipo",
        "sectionId": "uuid-de-la-seccion",
        "name": "Petitioner passport",
        "description": "Copy of the identification page.",
        "isKey": true,
        "expectedQuantity": 1,
        "position": 1,
        "createdAt": "fecha-ISO",
        "updatedAt": "fecha-ISO"
      }
    ]
  }
}
```

Las secciones siguen su orden. Los documentos siguen el orden de las secciones
y después su posición dentro de ellas; General aparece al final. No se incluyen
registros retirados. Crear devuelve `201`; editar o mover devuelve `200`, con
`{ "data": <sección o documento>, "templateRevision": <revisión> }`.
Eliminar devuelve `204`, sin cuerpo; se consulta nuevamente para leer la revisión.

El estado se deriva de los documentos actuales:

| Estado | Condición |
| --- | --- |
| `Template required` | No hay documentos. |
| `Key document required` | Hay documentos, pero ninguno es clave. |
| `Ready` | Hay al menos un documento clave. |

Esto permite configurar una plantilla incompleta por pasos. `Ready` solo indica
que su definición cumple la regla mínima; no es un estado de un matter ni
significa que un cliente entregó documentos.

### Identidad, retiros y operaciones simultáneas

Editar conserva el UUID. Eliminar establece `retired_at` en vez de borrar la
fila. Volver a crear el mismo nombre genera un UUID nuevo: no restaura la
definición anterior. No hay una ruta de restauración en este bloque.

Retirar una sección conserva sus documentos actuales y sus UUID: los coloca
después de los existentes en General, manteniendo su orden relativo. Los
documentos ya retirados conservan su referencia histórica a la sección anterior.
La clave foránea compuesta impide usar una sección de otro matter type.

Toda modificación bloquea la fila de su matter type durante una transacción.
Así se ordenan las escrituras simultáneas de esa plantilla sin bloquear otras.
La definición, los cambios de orden y el incremento de `templateRevision` se
confirman juntos. Una validación fallida, conflicto o error SQL revierte todo.
Un `PATCH` sin cambio efectivo conserva la revisión y las fechas del elemento.
La edición del nombre o descripción del matter type no aumenta esa revisión.

La consulta completa usa una sola sentencia SQL para leer metadatos, secciones
y documentos con una misma vista consistente de los datos. La vista SQL
`app.matter_type_template_summary` centraliza los contadores y el estado para
que coincidan con el catálogo. No es una copia ni una tabla adicional de datos.

Errores específicos: `404 MATTER_TYPE_NOT_FOUND`,
`404 TEMPLATE_SECTION_NOT_FOUND`, `404 TEMPLATE_DOCUMENT_NOT_FOUND`,
`400 INVALID_TEMPLATE_SECTION`, `400 TEMPLATE_MOVE_OUT_OF_RANGE`,
`409 TEMPLATE_SECTION_NAME_ALREADY_EXISTS` y
`409 TEMPLATE_DOCUMENT_NAME_ALREADY_EXISTS`. Los duplicados incluyen
`fields.name`; una sección inválida incluye `fields.sectionId`. Se reutilizan
los controles de sesión, permisos, origen, CSRF, JSON y `400 INVALID_INPUT`.

El módulo de plantillas guarda definiciones, no archivos ni información de
recepción. La conservación de UUID y filas retiradas prepara la sincronización
futura. Las tablas de matters descritas a continuación ya existen, pero todavía
no hay API de matters ni sincronización automática con estas definiciones.

## Base de datos de matters — bloque 1

Este bloque crea únicamente la estructura y sus pruebas. No añade rutas,
servicios de negocio, pantallas ni matters reales. Tampoco cambia los datos de
usuarios, tipos o plantillas existentes.

Una plantilla define **qué se pide**; `matter_documents` guarda **qué se pidió
para un matter y qué se recibió**. Su UUID de definición permite distinguir una
edición del mismo documento de otro documento nuevo que reutilice su nombre.

| Tabla | Responsabilidad |
| --- | --- |
| `app.matters` | Número, tipo, estado, modo automático/manual, revisión de plantilla, versión y responsables de creación/modificación. |
| `app.matter_sections` | Copias de secciones de la plantilla para cada matter, con su orden y posible fecha de retiro. |
| `app.matter_documents` | Copias de requisitos con estado de recepción, cantidad, comentario y datos de archivo. |
| `app.matter_status_history` | Eventos de estado o modo, con usuario, fecha y motivo técnico. No contiene notas legales. |

### Identidad y relaciones

`matter_name` es texto obligatorio de exactamente seis dígitos ASCII y único en
toda la aplicación. Por ejemplo, `001234` es válido y conserva sus ceros. No se
guarda un nombre de cliente ni se crea una tabla de clientes. El UUID interno
permanece igual cuando más adelante se corrija ese número.

Cada matter pertenece a un matter type. Sus secciones y documentos guardan
también ese tipo para que claves foráneas compuestas comprueben que proceden de
la plantilla correcta. Un documento no puede referenciar una sección de otro
matter, aunque ambos tengan el mismo tipo. `section_id = null` representa
**General**, sin crear una sección artificial.

Solo puede existir una copia de cada UUID de definición por matter, incluidos
los documentos retirados. Una definición nueva con el mismo nombre tendrá un
UUID distinto y podrá generar una copia nueva. Se añade a `template_documents`
una restricción única auxiliar `(matter_type_id, id)` para permitir esta
comprobación; no se cambian sus datos ni sus identificadores.

Las relaciones usan `ON DELETE RESTRICT` para impedir borrados accidentales de
usuarios, definiciones o matters referenciados. Esto no bloquea ediciones por
estado del matter. La futura operación administrativa de cambio de tipo deberá
reemplazar el checklist dentro de una transacción, conservando el historial.

### Estados y cantidades

Los ocho estados del matter son:

- `Pending Documents`
- `Ready to Start Drafting`
- `Ready to Draft`
- `Ready to R/S`
- `Pending Corrections`
- `Corrections Ready`
- `Accepted`
- `Sent`

`status_source` admite `Automatic` o `Manual`. La base solo permite los primeros
tres estados en modo automático. No calcula aún cuál corresponde: esa lógica
pertenecerá al servicio de matters. El estado inicial es `Pending Documents`
con modo `Automatic`.

Los documentos admiten `Pending`, `Received`, `Client Does Not Have` y
`Not Applicable`. Su cantidad esperada es un entero positivo o `null`; la
recibida es un entero no negativo o `null`. **No hay una restricción que obligue
a alcanzar la cantidad esperada para marcar Received.** Tampoco se impide editar
documentos cuando el matter está Accepted o Sent. Los comentarios pueden estar
vacíos y no se almacenan archivos.

Las copias conservan nombre, descripción, condición de documento clave,
cantidad esperada, sección y posición. `retired_at` permite separar requisitos
actuales de anteriores; al archivar un documento se exige conservar
`previous_section_name`. El bloque de sincronización posterior implementará
esas operaciones y la conservación de la recepción durante cambios de plantilla.

### Fechas, versiones e historial

Los triggers reutilizan `app.set_updated_at()` para modificar la fecha de la
fila en `matters`, `matter_sections` y `matter_documents`. No modifican por su
cuenta el estado, su fecha ni la versión del matter.

En documentos, `tracking_updated_at` y `tracking_updated_by` se reservan para
la recepción, cantidad y comentario. Así, actualizar una definición no tendrá
que aparentar una nueva entrega del usuario. El responsable de tracking puede
ser `null` al inicializar una copia; las escrituras de usuarios lo asignarán en
el futuro servicio.

`template_revision` indica la revisión aplicada al matter y comienza en cero.
`version` comienza en uno y prepara el control de ediciones simultáneas. La API
futura deberá comparar e incrementar esa versión: crear la columna no implementa
todavía la protección frente a conflictos.

El historial admite estos motivos técnicos, generados por el sistema, no
comentarios obligatorios:

- `Matter created`
- `Document updated`
- `Template updated`
- `Matter type changed`
- `Manual status selected`
- `Automatic mode enabled`

Puede registrar un cambio de modo aunque el estado siga igual. Se exige un
cambio efectivo de estado o modo, salvo en creación y cambio de tipo. El evento
inicial solo puede ser de creación hacia Pending Documents/Automatic y puede
existir como máximo uno por matter. Las restricciones validan formatos y
combinaciones básicas; el futuro servicio deberá insertar los eventos correctos
junto con cada operación. No existe aún un trigger que cree historial ni una
API que permita modificarlo.

### Qué queda para los siguientes bloques

La base valida relaciones, unicidad, formatos y valores permitidos. No valida
que una plantilla tenga al menos un documento clave al crear un matter: esa
regla requiere consultar varias filas y se implementará en el servicio. No se
añade un bloqueo a matters existentes si su plantilla deja de estar lista.

También quedan pendientes la API, permisos de edición, paginación, cálculo de
estados, sincronización de plantillas, incremento de versiones, transacciones de
cambio de tipo y conexión con React. No se activa ni elimina el código provisional
del frontend en este bloque.

Se incluyen índices para listados por fecha, tipo o estado, secciones y
documentos actuales, requisitos retirados e historial. Se revoca el acceso de
`PUBLIC` a las cuatro tablas nuevas, como en los módulos anteriores.

### Archivos y orden de lectura

1. `src/db/migrations/007_create_matters.js`: lee primero `matters`, después
   `matter_sections`, `matter_documents` y `matter_status_history`. Sigue con
   índices, triggers y comentarios; `down` deshace la estructura en orden inverso.
2. `tests/integration/matterSchema.test.js`: sus 26 pruebas muestran ejemplos
   permitidos y rechazados, conservación de cantidades y metadatos, archivo,
   relaciones y un reemplazo de tipo simulado mediante SQL. No son una API.
3. `scripts/verifyDatabases.js`: incorpora metadatos, contadores, índices,
   restricciones, triggers y comprobación de permisos públicos de estas tablas.
4. Este README y `../frontend/GUIA_DE_LECTURA.md`: documentan el alcance real y
   distinguen la estructura creada de las funcionalidades todavía pendientes.

Las pruebas nuevas abren una transacción por comprobación y siempre ejecutan
`ROLLBACK`. Comparan los contadores con su valor inicial; no vacían tablas. La
reversión `down` y reaplicación `up` se prueban exclusivamente dentro de una
transacción de la base aislada, que después se revierte. No se ejecuta `down`
sobre la base de desarrollo.

Verificación del bloque: 38 pruebas unitarias y 110 de integración del backend,
71 pruebas del frontend y 14 de conexión frontend/API: **233 aprobadas**. También
pasaron lint de ambos proyectos, compilación del frontend y comprobación del
diff. La migración `007_create_matters` quedó aplicada en desarrollo y pruebas;
las cuatro tablas nuevas quedaron vacías en ambas bases. La cuenta
administrativa de desarrollo se conservó y no quedaron usuarios, sesiones ni
contadores temporales en la base aislada.

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

Para leer las plantillas, empieza por `src/modules/templates/templates.routes.js`.
Observa cómo se hereda `matterTypeId` de la ruta montada en `app.js`, cómo se
aplican los permisos y cómo `template.validation.js` valida cada cuerpo.
Luego sigue este recorrido:

```text
templates.routes.js → templates.controller.js
→ sections.service.js / documents.service.js
→ templates.service.js (transacción y bloqueo compartidos)
→ sections.repository.js / documents.repository.js
→ PostgreSQL
```

Para la consulta completa, el recorrido es más corto: controlador →
`getTemplate` en `templates.service.js` → `findTemplate` en
`templates.repository.js`. La consulta agrupa filas relacionales en JSON para
la respuesta, pero las tablas no guardan el template como un bloque JSON.

Lee después `006_create_templates.js`: contiene las dos tablas, la revisión,
las restricciones, los índices parciales y la vista compartida con el catálogo.
Vuelve a los servicios para entender los retiros y movimientos. En particular,
el documento se busca y sus campos se combinan después de obtener el bloqueo;
así, dos ediciones parciales concurrentes no pierden los cambios de la otra.
Termina con `tests/template.validation.test.js` y
`tests/integration/templates.test.js`: sus nombres describen ejemplos de cada
regla, incluidos errores, carreras y reversión completa.

Archivos del bloque de plantillas:

- Nuevos: `src/db/migrations/006_create_templates.js` y los nueve archivos de
  `src/modules/templates/`: `template.validation.js`, `templates.routes.js`,
  `templates.controller.js`, `templates.service.js`, `templates.repository.js`,
  `sections.service.js`, `sections.repository.js`, `documents.service.js` y
  `documents.repository.js`.
- Pruebas nuevas: `tests/template.validation.test.js` y
  `tests/integration/templates.test.js`.
- Actualizados: `src/app.js`, `matterTypes.repository.js`,
  `matterTypes.service.js`, `tests/integration/matterTypes.test.js`,
  `scripts/verifyDatabases.js` y este README. Las respuestas del catálogo ahora
  incluyen el resumen de su plantilla; crear o editar una categoría obtiene
  ese resumen dentro de su propia transacción.
- Sin cambios: frontend, mocks, dependencias, autenticación y usuarios.

## Flujo de una solicitud

```text
Navegador
→ protecciones HTTP y CORS
→ analizador JSON
→ ruta
→ controller
→ service (reglas y transacciones)
→ repository (consultas SQL)
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
`PUBLIC` y no se insertan categorías de ejemplo.

La sexta migración añade `template_revision` a los tipos y crea
`app.template_sections` y `app.template_documents`, con UUID estables,
posiciones y fechas de retiro. Sus índices únicos parciales permiten reutilizar
nombres retirados sin confundir identificadores. La relación compuesta de
documento a sección asegura que ambos pertenezcan al mismo tipo. Las cantidades
son enteros positivos o nulas y las fechas se actualizan mediante triggers.
La vista `app.matter_type_template_summary` deriva contadores y estado de los
documentos actuales. Se revoca el acceso público y no se insertan ejemplos.

La séptima migración crea `app.matters`, `app.matter_sections`,
`app.matter_documents` y `app.matter_status_history`. Añade relaciones compuestas,
validación del número de seis dígitos, estados y cantidades, índices, fechas y
revocación de acceso público. La sección **Base de datos de matters — bloque 1**
detalla sus campos y los límites de este bloque. No inserta datos de ejemplo ni
implementa servicios de recepción o sincronización.

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
Las suites se ejecutan en secuencia porque varias crean un administrador
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

Las pruebas de plantillas comprueban permisos en todas sus rutas, entradas,
unicidad global de documentos, secciones del tipo correcto, posiciones y
movimientos, retiros sin borrado, conservación de UUID, reutilización de nombres
con UUID nuevos, estados derivados y revisiones. También comprueban carreras
de creación y edición, retiro simultáneo de una sección, lectura consistente
durante una escritura no confirmada y reversión cuando falla el incremento de
revisión. Solo eliminan físicamente sus propias definiciones de prueba,
después sus secciones y finalmente los tipos que crearon. No tocan los datos
ni la cuenta administrativa de desarrollo.

Las 26 pruebas de `matterSchema.test.js` comprueban directamente la estructura
PostgreSQL: formatos, referencias, estados, cantidades, metadatos de recepción,
requisitos retirados, eventos de estado, índices y permisos. Usan transacciones
siempre revertidas, incluso para comprobar `down`/`up`, y verifican que los
contadores finales coincidan con los iniciales. No sustituyen las futuras pruebas
de la API ni de sincronización de matters.

## Preparación del despliegue

La autenticación está preparada para frontend y API servidos bajo el mismo
origen en producción. Durante el desarrollo, los puertos de localhost pueden
ser distintos. Si más adelante se alojan frontend y backend en sitios distintos
(por ejemplo, dominios separados de Vercel y Render), deberá revisarse la
arquitectura de cookies o un proxy antes de conectar el frontend.
`FRONTEND_ORIGIN` debe contener solo el origen permitido, sin rutas ni barra final.
