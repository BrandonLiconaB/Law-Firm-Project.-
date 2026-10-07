# Guía de lectura del frontend

Esta guía es el mapa de lectura de **Gestor documental**. No necesitas memorizar
todos los archivos: identifica quién recibe una acción, quién la procesa y dónde
terminan guardándose los datos.

## 1. Qué está conectado actualmente

El frontend usa React, JavaScript, React Router, Vite y CSS Modules. La sesión,
los usuarios, los matter types, las secciones y los documentos de plantillas están conectados
con Node/Express y PostgreSQL. Los cambios confirmados por el servidor permanecen
al recargar la página.

Matters muestra **Connection pending**. Sus pantallas
anteriores y mocks se conservan para el siguiente bloque y para pruebas de reglas;
no están registrados como pantallas operativas ni se importan al proveedor actual.
No se ha realizado el despliegue. La sincronización de plantillas con matters
todavía no está implementada en el backend.

Usuarios ya permite listar cuentas paginadas, crearlas, consultar su ficha y
restablecer contraseñas de MEMBER, solo para ADMIN. No tiene correo, estado
activo/inactivo, selector de rol ni edición de identidad. `EditUserPage.jsx`
pertenece al directorio antiguo y sigue sin ruta; los mocks no se usan en este módulo.

## 2. Cómo iniciar el proyecto local

Usa dos terminales desde sus respectivas carpetas:

```text
backend:  npm run dev
frontend: npm run dev
```

Abre `http://localhost:5173`. El backend debe estar en el puerto 3000 y tener
`FRONTEND_ORIGIN=http://localhost:5173`, como está configurado actualmente.
Utiliza el username y contraseña del administrador que creaste; no una cuenta
de ejemplo. No introduzcas esa contraseña en archivos de configuración.

`frontend/.env.example` documenta dos valores públicos:

- `VITE_API_URL=/api`: prefijo de las solicitudes del navegador.
- `VITE_PROXY_TARGET=http://localhost:3000`: destino del proxy local de Vite.

Los valores predeterminados permiten iniciar sin crear un `.env` del frontend.
Si necesitas cambiarlos, copia `.env.example` a `.env` y reinicia Vite. Nunca
coloques contraseñas, secretos o URLs de PostgreSQL en variables `VITE_`: son
configuración pública. Usa `localhost`, no alternes con `127.0.0.1` en el navegador.

El proxy mantiene `/api` bajo el mismo origen del navegador y reenvía la solicitud
a Express. Funciona en desarrollo y en la vista previa local de Vite; no se
convierte en un proxy de producción al compilar. Esa configuración se decidirá
en el bloque de despliegue. `npm run dev` y `npm run preview` utilizan el mismo
puerto; no pueden ejecutarse simultáneamente.

## 3. Mapa mental y orden de entrada

```text
index.html
→ src/main.jsx (React, StrictMode y estilos globales)
→ src/app/App.jsx
  → AuthProvider (sesión)
  → RouterProvider → src/routes/router.jsx
    → SessionBoundary (comprobación inicial / error / reintento)
    → LoginPage o ChangePasswordPage
    → AuthGate (solo usuarios autenticados sin contraseña temporal)
      → AppDataProvider (catálogo real, aislado por usuario)
      → AppLayout → Outlet → página actual
        → AdminGate → UsersProvider → pantalla de usuarios (solo en sus rutas)
```

`AuthGate` crea el proveedor de catálogo después de autenticar. Al salir, ese
espacio se desmonta: no queda el catálogo de otro usuario visible en un nuevo
inicio de sesión. `AdminGate` restringe formularios; las consultas del catálogo
son comunes. Las rutas siguen usando `/admin/` por compatibilidad con el frontend,
pero eso no implica que todas sean exclusivas del administrador.

| URL | Pantalla y comportamiento |
| --- | --- |
| `/login` | Acceso con username y contraseña. |
| `/change-password` | Cambio personal; obligatorio para contraseña temporal. |
| `/admin/matter-types` | Catálogo real, visible a ADMIN y MEMBER. |
| `/admin/matter-types/new` | Creación, solo ADMIN. |
| `/admin/matter-types/:matterTypeId/edit` | Edición, solo ADMIN. |
| `/admin/templates` | Resúmenes reales de las plantillas. |
| `/admin/templates/:matterTypeId` | Lectura común; acciones solo para ADMIN. |
| `/admin/templates/:matterTypeId/documents/new` | Creación, solo ADMIN. |
| `/admin/templates/:matterTypeId/documents/:documentId/edit` | Edición, solo ADMIN. |
| `/matters/*` | Conexión pendiente, sin registros ficticios. |
| `/admin/users?page=1` | Listado real, 20 cuentas por página, solo ADMIN. |
| `/admin/users/new` | Creación con contraseña temporal, solo ADMIN. |
| `/admin/users/:userId` | Ficha de cuenta, solo ADMIN. |
| `/admin/users/:userId/reset-password` | Restablecimiento de MEMBER, solo ADMIN. |

## 4. Primera pasada: la sesión

Lee en este orden:

1. `src/api/apiClient.js`: `fetch`, cookies, JSON, CSRF y errores comunes.
2. `src/features/auth/services/authSession.js`: restaurar, entrar, salir y cambiar
   contraseña. Aquí vive el estado de sesión, independiente de React.
3. `AuthContext.js` y `useAuth.js`: canal y hook de acceso al contexto.
4. `AuthProvider.jsx`: adapta ese estado a React mediante `useSyncExternalStore`.
5. `components/AuthGate.jsx`: barreras de sesión y permisos.
6. `pages/LoginPage.jsx` y `pages/ChangePasswordPage.jsx`: formularios controlados.
7. `src/layouts/AppLayout.jsx`: identidad real, navegación y cierre de sesión.

El cliente envía `credentials: 'include'`; el navegador administra la cookie
HttpOnly. El token CSRF recibido del servidor permanece en una variable privada
de `authSession`, y se añade a las escrituras. No se usan `localStorage` ni
`sessionStorage` para autenticación. Las contraseñas viven solo en los inputs
mientras se envían y se limpian después del intento.

La sesión se comprueba con `/auth/me` al iniciar. Un fallo de conexión permite
reintentar sin fingir que no existe sesión. Un 401 en una ruta protegida vuelve
al login. La fecha absoluta anunciada por el servidor también programa el cierre
del estado frontend; consultar o navegar no renueva la sesión.

`version` evita que un error 401 de una petición antigua cierre una sesión nueva.
El backend sigue siendo la autoridad: ocultar un botón no reemplaza sus permisos.

## 5. Segunda pasada: los datos del catálogo

Sigue este recorrido:

```text
Página → useAppData → AppDataProvider → catalogStore → apiClient
→ Express → PostgreSQL → respuesta → catalogStore → nuevo render
```

Lee `src/app/providers/AppDataProvider.jsx`, después
`src/features/catalog/catalogStore.js`, `CatalogBoundary.jsx` y `useTemplate.js`.

El proveedor ya no simula una base de datos. Solo conecta el contexto con el
store. `catalogStore` mantiene una copia de las respuestas del servidor:

- `matterTypes`: resúmenes, con contadores, estado y revisión de plantilla.
- `templates`: secciones y documentos completos, consultados al abrir una plantilla.
- `status` y `error`: estado de carga del catálogo.
- `isMutating`: indica que una escritura está en curso.

El listado paginado del backend se recorre por páginas de 100. No se consulta
cada plantilla completa para calcular sus tarjetas: se usan sus contadores.
`matterTypeTemplateStatus.js` admite estos resúmenes y conserva compatibilidad
con las definiciones de las pruebas anteriores.

`useSyncExternalStore` conecta una fuente de estado externa con React. El store
ofrece `subscribe` para avisar de cambios y `getSnapshot` para leer una referencia
estable. Cada publicación crea una referencia nueva y React vuelve a renderizar.
No es otra base de datos ni una biblioteca adicional.

Las escrituras no son optimistas: esperan la confirmación HTTP. Después de editar
una plantilla se consulta su definición completa, para obtener el orden, las
secciones y los contadores que realmente guardó el servidor. Si el guardado
funciona pero esa consulta falla, la interfaz dice **Your change was saved** y
ofrece recargar, sin recomendar repetir la creación.

Las versiones de lectura evitan reemplazar respuestas nuevas con respuestas
antiguas. Un catálogo desmontado deja de publicar datos. No hay actualizaciones
en tiempo real entre navegadores en este bloque: recarga para ver los cambios
de otro usuario.

## 6. Sigue una funcionalidad completa: añadir un documento

1. `router.jsx` abre `NewTemplateDocumentPage` bajo `AdminGate`.
2. La página llama `useTemplate(matterTypeId)` para cargar la definición real.
3. `TemplateDocumentForm` mantiene campos locales y valida la entrada.
4. Al enviar, ejecuta `onSubmit` y espera su resultado.
5. La página llama `createTemplateDocument` del store.
6. El store envía `POST /api/matter-types/:id/template/documents` con JSON y CSRF.
7. Express valida permisos y datos y confirma la transacción en PostgreSQL.
8. El store consulta la plantilla actual y actualiza su copia local.
9. Solo después de confirmar la escritura, la página navega al detalle.

Para una edición cambia el método a `PATCH`; el UUID permanece. Una eliminación
usa `DELETE` sin cuerpo, recibe 204 y consulta de nuevo. Retira la definición;
no borra su fila. Al retirar una sección, el backend mueve sus documentos a General.

## 7. Formularios, errores y estilos

Lee `src/hooks/useAsyncAction.js`: evita envíos duplicados mientras la operación
está pendiente y convierte un rechazo en un error visible. Los formularios
mantienen sus valores no sensibles cuando falla un guardado; puedes corregirlos o reintentar.
Los errores `fields` del servidor aparecen junto a sus campos.

`RequestFeedback.jsx` reutiliza presentación de carga, error y reintento.
`ButtonLink` admite un estado deshabilitado para no navegar durante un envío.
En el detalle, los botones de movimiento, retiro y creación se deshabilitan
durante una escritura; el backend también resuelve la concurrencia real.

Para entender un componente, busca imports → props → estado → datos derivados
→ handlers → JSX → CSS. La página relaciona URL y datos; el formulario recibe
props y callbacks; el store coordina solicitudes; el backend aplica reglas.

Lee estilos generales en este orden: `tokens.css`, `reset.css`, `global.css` y
luego el CSS Module del componente. `AuthPage.module.css` reutiliza los colores,
radios y sombras existentes. El menú móvil usa el booleano `inert` para impedir
enfocar elementos del menú oculto.

## 8. Archivos del bloque de conexión

### Nuevos

- `src/api/apiClient.js`.
- `src/features/auth/AuthContext.js`, `useAuth.js`, `AuthProvider.jsx`.
- `src/features/auth/services/authSession.js`.
- `src/features/auth/components/AuthGate.jsx`.
- `src/features/auth/pages/LoginPage.jsx`, `ChangePasswordPage.jsx`, `AuthPage.module.css`.
- `src/features/catalog/catalogStore.js`, `CatalogBoundary.jsx`, `useTemplate.js`.
- `src/components/common/ConnectionPendingPage.jsx`, `RequestFeedback.jsx` y su CSS.
- `src/hooks/useAsyncAction.js` y `.env.example`.
- `tests/apiSession.test.mjs`, `tests/catalogStore.test.mjs`.
- `tests/connectedViews.test.mjs`: permisos visibles, resúmenes, menú móvil y contraseña temporal.
- `tests/integration/connectedCatalog.test.mjs`.
- `tests/support/backendFixture.mjs` y `qaServer.mjs`.

### Actualizados

- Entrada y estado: `App.jsx`, `AppDataProvider.jsx`, `router.jsx`.
- Layout: `AppLayout.jsx` y su CSS; identidad real y opciones de sesión.
- Reutilización: `ButtonLink.jsx` y `matterTypeTemplateStatus.js`.
- Matter types: `MatterTypeForm.jsx`, `MatterTypesPage.jsx`, `NewMatterTypePage.jsx`, `EditMatterTypePage.jsx`.
- Plantillas: `TemplateSectionForm.jsx`, `TemplateDocumentForm.jsx`, `TemplatesPage.jsx` y su CSS,
  `TemplateDetailPage.jsx`, `NewTemplateDocumentPage.jsx`, `EditTemplateDocumentPage.jsx`.
- Configuración: `vite.config.js`, `eslint.config.js`, `package.json` y esta guía.
- Prueba anterior: `tests/matterReport.test.mjs` deshabilita también WebSocket
  en el servidor de transformación JSX, para ejecutar varias suites sin disputar un puerto.

No se añaden dependencias ni migraciones en este bloque. No se cambia el código
del backend, se despliega, se sube a Git ni se eliminan los mocks y módulos anteriores.

## 9. Pruebas y rutina de lectura

```text
npm run lint
npm test
npm run test:integration
npm run build
```

`npm test` no necesita PostgreSQL. Prueba sesión, HTTP, store y las reglas e
informe conservados del frontend anterior. `test:integration` carga el `.env`
del backend y usa únicamente `TEST_DATABASE_URL`: rechaza desarrollo y bases
sin sufijo `_test`. Utiliza la API real con cuentas ficticias, cookies y CSRF,
y elimina sus propios registros. Requiere las migraciones aplicadas y que
ninguna otra suite esté ocupando el administrador único de la base de pruebas.

`npm run qa:server` es solo un auxiliar de revisión: abre una API de pruebas en
3001 con cuentas ficticias para un frontend de revisión en 3173. No lo uses para
datos reales ni como servidor normal. Escribe `stop` o termínalo con Ctrl+C y espera el mensaje
de limpieza; un cierre forzado puede dejar fixtures en la base de pruebas.

Para incorporarte a un proyecto grande: identifica comandos, entrada, rutas y
estado; escoge una acción y síguela hasta su persistencia; lee una prueba de esa
acción; ejecuta la aplicación y confirma tu mapa. Luego repite con otra función.
La pregunta clave es: **¿quién recibe la acción, quién valida, qué cambia y dónde
se guarda?**

## 10. Resultado de la auditoría de dependencias de este bloque

`npm audit --audit-level=moderate` reportó seis paquetes con alertas: dos de
severidad moderada y cuatro alta. El lockfile no se modificó y no se ejecutó
`npm audit fix`; las actualizaciones se evaluarán en un bloque aprobado antes
del despliegue. Una alerta de biblioteca no demuestra por sí sola que esta
aplicación sea explotable en su configuración actual.

Paquetes señalados por el reporte:

- `baseline-browser-mapping` (moderada).
- `brace-expansion` (alta).
- `browserslist` (alta).
- `nanoid` (alta).
- `postcss` (moderada).
- `react-router` (alta; el aviso del reporte se refiere al modo RSC).

Vuelve a ejecutar la auditoría al abordar ese bloque: las alertas y las versiones
disponibles pueden cambiar. No uses `npm audit fix --force` sin revisar sus cambios.

## 11. Bloque de gestión de usuarios: recorrido de lectura

Este módulo no usa `AppDataProvider` ni `catalogStore`. Tiene su propio estado:

```text
router.jsx → AdminGate → UsersProvider → UsersPage / NewUserPage / UserDetailPage / ResetUserPasswordPage
→ useUsers / useUser → usersStore → apiClient → Express → PostgreSQL
```

Lee en este orden:

1. Las cuatro rutas de usuarios en `src/routes/router.jsx`.
2. `src/features/users/services/usersStore.js`: consultas, escrituras y copia local.
3. `UsersContext.js`, `useUsers.js` y `UsersProvider.jsx`: acceso y adaptación a React.
4. `pages/UsersPage.jsx`: el parámetro `?page=` selecciona una página de 20;
   el total y el número de páginas provienen del servidor, no se calculan a partir
   de las filas visibles. `useEffect` consulta cuando cambia la página.
   Se retira la búsqueda por correo del directorio de ejemplo: la API actual no
   tiene búsqueda de usuarios y filtrar solo una página no sería una búsqueda global.
5. `useUser.js` y `pages/UserDetailPage.jsx`: consulta individual, carga, error,
   cuenta ausente, fechas y disponibilidad del restablecimiento para MEMBER.
6. `pages/NewUserPage.jsx` y `components/UserForm.jsx`: estado controlado,
   validación, `await createUser` y navegación tras la respuesta 201.
7. `pages/ResetUserPasswordPage.jsx` y `components/PasswordResetForm.jsx`:
   autorización con la contraseña actual de ADMIN y asignación de una temporal.
8. `utils/userValidation.js` y `components/UserFormField.jsx`: restricciones
   compartidas, errores por campo, labels y descripciones accesibles.
9. Las tres pruebas del módulo, para ver ejemplos de éxito y de fallos.

El snapshot contiene `list`, `details` e `isMutating`. Los datos públicos de
cuenta son `id`, `fullName`, `username`, `systemRole`, `mustChangePassword`,
`createdAt` y `updatedAt`. No contiene contraseñas ni hashes. El rol se muestra
como información del administrador, no como una opción modificable.

`listVersion` evita que una respuesta vieja de página 1 reemplace a página 2.
`detailVersions` evita que una ficha anterior al reset reemplace la nueva.
`epoch` identifica la vida del proveedor: una respuesta que llega después de
desmontarlo no puede publicar datos ni confirmar navegación. La activación en
`useLayoutEffect` ocurre antes de las consultas de las páginas y contempla el
ciclo adicional de montaje/desmontaje de StrictMode en desarrollo.

En creación se envían exclusivamente `{ fullName, username, password }`.
`username` se normaliza a minúsculas y se recorta; se permiten 3–50 letras ASCII,
números, puntos, guiones y guiones bajos. El nombre se recorta y admite 2–120
caracteres. La contraseña admite 12–128 caracteres y **no se recorta**. La
confirmación solo sirve para validar el formulario: no se envía a la API.
PostgreSQL decide si el username ya existe; no se intenta comprobarlo consultando
solo la página visible. El error `USERNAME_ALREADY_EXISTS` aparece junto al campo.

El reset envía `{ administratorPassword, newPassword }` y espera el 204. El
servidor verifica la contraseña del administrador, impide restablecer ADMIN,
revoca las sesiones del MEMBER y exige que reemplace la contraseña temporal.
La interfaz no implementa esas reglas por su cuenta. Después consulta la ficha;
si esta consulta falla, muestra que **el restablecimiento sí fue confirmado** y
ofrece reintentar solo la lectura. No repite POST automáticamente.

Los formularios limpian sus contraseñas tras cada intento que llega al servidor,
sea exitoso o fallido; nombre y username permanecen si falla la creación. Una
validación local no envía nada y permite corregir el input. No hay envío de
correos ni recuperación por email: debes comunicar la contraseña temporal de
forma privada y conservarla tú antes de enviar el formulario, ya que no se vuelve
a mostrar. La pantalla de cambio personal existente completa el acceso inicial.

Archivos nuevos de este bloque:

- `src/features/users/UsersContext.js`, `UsersProvider.jsx`, `useUsers.js`, `useUser.js`.
- `src/features/users/services/usersStore.js`.
- `src/features/users/components/UserFormField.jsx`, `PasswordResetForm.jsx`.
- `src/features/users/pages/UserDetailPage.jsx`, `ResetUserPasswordPage.jsx`.
- `tests/usersStore.test.mjs`, `tests/usersViews.test.mjs`.
- `tests/integration/connectedUsers.test.mjs`.

Archivos actualizados de este bloque:

- `src/features/users/pages/UsersPage.jsx`, `NewUserPage.jsx` y sus CSS Modules.
- `src/features/users/components/UserForm.jsx`, su CSS y `utils/userValidation.js`.
- `src/routes/router.jsx` y `src/features/auth/components/AuthGate.jsx`.
- `tests/support/backendFixture.mjs`: registra los IDs creados por su API para
  eliminarlos y limpiar sesiones/contadores de prueba, sin tocar desarrollo.
- `tests/support/qaServer.mjs`: admite `stop` para cerrar y limpiar de forma ordenada.
- Esta guía.

No se cambian endpoints del backend, tablas, dependencias ni archivos de entorno.
No se hacen commits, despliegue ni limpieza global de mocks en este bloque.

Verificación realizada: 71 pruebas del frontend, 14 pruebas de conexión frontend/API
y 122 del backend (38 unitarias y 84 de integración), todas aprobadas: 207 en total.
También pasaron lint, compilación y comprobación del diff. Se revisaron listado,
formularios y permisos en el navegador, con adaptación móvil. La creación y el
restablecimiento de credenciales ficticias se probaron mediante la API aislada,
no modificando cuentas reales desde el navegador. Al terminar, la base de pruebas
quedó sin usuarios, sesiones ni contadores ficticios, y el administrador de
desarrollo permaneció intacto.
