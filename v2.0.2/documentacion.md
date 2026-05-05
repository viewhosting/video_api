# Documento de Arquitectura Técnica (TAD)

**Proyecto:** Sistema Híbrido de Composición de Video (Marca Blanca / Lote21)
**Autor:** Emanuel
**Última actualización:** Mayo 2026 — v2.0.2

---

## 1. Descripción del Sistema

Motor de composición de video lineal que permite superponer una capa gráfica interactiva (máscara basada en coordenadas y estilos) sobre un flujo de video (ej. Vimeo). El sistema renderiza el resultado final en un archivo físico `.mp4` sin pérdida de calidad para su distribución en remates. Utiliza una arquitectura híbrida (Cliente/Servidor) orientada a minimizar el consumo de recursos en la infraestructura central.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Core Gráfico (Frontend) | Vanilla JS + `Fabric.js` (Canvas API) |
| Codificación Local (Plan A) | `FFmpeg.wasm` (Web Workers, SharedArrayBuffer) |
| Backend Principal | PHP + MariaDB |
| Motor de Plantillas | Twig |
| Servidor Web | IIS (Windows Server) |
| Microservicio de Respaldo (Plan B) | Node.js (Express) + `async.queue` — **⚠ PENDIENTE** |
| Motor Headless (Plan B) | `Playwright` (Chromium) + `FFmpeg.exe` nativo — **⚠ PENDIENTE** |

---

## 3. Arquitectura de Seguridad AJAX (`AjaxGatewayController`)

**Toda** comunicación JS→PHP pasa obligatoriamente por este único punto de entrada.

### 3.1. Cabeceras de Seguridad Requeridas

Cada petición AJAX debe incluir:

| Header | Descripción |
|---|---|
| `X-Authorization-Key` | Llave estática definida en `config.php` |
| `X-Nonce` | Token encriptado AES-256-CBC, de un solo uso y rotativo |
| `X-Action` | Acción a ejecutar: `Controlador@metodo` (ej. `VideoController@saveAction`) |

### 3.2. Flujo de Validación

```
Request JS
  → Valida X-Authorization-Key (contra config.php)
  → Descifra X-Nonce y compara con $_SESSION['nonce_ajax']
  → Verifica que Controlador esté en lista blanca ($allowedControllers)
  → Invoca método privado via ReflectionMethod
  → Genera nuevo nonce encriptado
  → Devuelve JSON con { ...resultado, __new_nonce: "..." }
```

### 3.3. Cola Serial de Nonces (Frontend)

Para evitar race conditions cuando varias peticiones se disparan simultáneamente (ej. auto-guardado + acción del usuario), todas las llamadas a `window.fetchSeguro()` se serializan mediante `window._fetchSeguroQueue` (cadena de Promises). Cada petición espera a que la anterior termine y actualice `window.AJAX_NONCE` antes de ejecutarse.

### 3.4. Controladores Registrados en la Lista Blanca

- `TemplatesController` — gestión de plantillas (métodos privados: `save`, `update`, `duplicate`, `delete`)
- `VideoController` — guardado de videos renderizados

### 3.5. Invocación de Métodos Privados

Los controladores exponen sus métodos como `private` para evitar acceso directo desde rutas públicas. El Gateway usa `ReflectionMethod::setAccessible(true)` para invocarlos de forma segura desde el interior del propio backend.

---

## 4. Módulo de Gestión de Sesión y Re-apertura (`reopen_token`)

La vista del editor (`run.twig`) se abre como **nueva pestaña** (nunca iframe) desde el panel heredado (ASP Clásico). Al cargar:

1. PHP genera un `reopen_token` encriptado ligado a la sesión del usuario.
2. `run.twig` envía ese token a la ventana padre via `window.opener.postMessage()`.
3. El padre actualiza el enlace "Abrir Editor" con el token, permitiendo reabrir la pestaña sin recargar la sesión.
4. La tolerancia de sesión para usuarios logueados es de **24 horas**.
5. En caso de error de seguridad (SECURITY_VIOLATION), la pestaña hija le indica al padre que cierre la sesión, forzando un nuevo login limpio.

---

## 5. Pipeline de Renderizado y Guardado de Video

### 5.1. Plan A: Renderizado Local (Client-Side) — ✅ IMPLEMENTADO

*Flujo por defecto. Descarga la carga computacional del servidor al navegador del cliente.*

```
1. Usuario edita plantilla en Fabric.js
2. Click "Generar Video"
3. FFmpeg.wasm extrae frames del <canvas> (Web Workers)
4. FFmpeg.wasm codifica el .mp4 en memoria local (SharedArrayBuffer)
5. Se obtiene un BlobURL del video resultante
6. [AUTO] saveVideoToServerAuto(blobUrl) se dispara inmediatamente
   → Convierte BlobURL a binario (sin base64)
   → Construye FormData: video_file + nombre + remate + lote + data_json + template_id
   → Sube via XHR con eventos de progreso (xhr.upload.onprogress)
   → VideoController::saveAction valida MIME real (finfo), guarda en disco y BD
7. UI: botón "Descargar Video" se habilita al completar la subida
```

**Nota sobre el botón "Descargar Video":**
- Aparece deshabilitado con spinner desde el inicio del render.
- Se habilita solo tras subida exitosa al servidor.
- En caso de error de subida: el botón sigue habilitado y al pulsarlo reintenta la subida antes de permitir la descarga.

### 5.2. Subida Binaria al Servidor

| Parámetro | Valor |
|---|---|
| Método HTTP | `POST multipart/form-data` |
| Endpoint | `ajaxGatewayController` |
| Campo de archivo | `video_file` (Blob binario, nunca base64) |
| Validación de tipo | `finfo(FILEINFO_MIME_TYPE)` — magic bytes, no extensión |
| MIME permitidos | `video/mp4`, `video/webm`, `video/quicktime` |
| Tamaño máximo | 500 MB |
| Destino en disco | `private_videos/{nombre}_{remate}_{lote}_{timestamp}.{ext}` |
| Acceso público URL | `https://dominio/private_videos/archivo.mp4` (bypass IIS configurado) |

### 5.3. Registro en Base de Datos (`video_renders`)

| Columna | Descripción |
|---|---|
| `idClientes` | ID del cliente que generó el video |
| `template_id` | ID del template base (referencia) |
| `data_json` | **JSON evaluado** del canvas con valores reales (sin `{{variables}}`) |
| `nombre_usuario` | Nombre dado al video |
| `remate` | Nombre/número del remate |
| `lote` | Número/categoría del lote |
| `nombre_archivo` | Nombre del archivo guardado en `private_videos/` |
| `tamano_kb` | Tamaño en kilobytes |
| `fecha_creacion` | Timestamp de generación |

> **Por qué `data_json` y no solo `template_id`:** El template contiene `{{variables}}` sin resolver. El `data_json` guardado es el JSON del canvas **ya evaluado** con los valores reales del remate/lote en el momento del render, permitiendo reproducir exactamente lo que se generó.

Schema: `docs/video_renders.sql`

---

## 6. Configuración IIS (`web.config`)

Se agregó una regla de bypass para evitar que el módulo URL Rewrite de IIS intercepte las peticiones a archivos estáticos en `private_videos/`:

```xml
<rule name="Allow Private Videos" stopProcessing="true">
  <match url="^private_videos/.*$" ignoreCase="true" />
  <action type="None" />
</rule>
```

Sin esta regla, IIS enruta `/private_videos/archivo.mp4` hacia `index.php` y genera un **HTTP 500.50** (URL Rewrite Module Error).

---

## 7. Plan B: Fallback en Servidor (Server-Side) — ⚠️ PENDIENTE DE IMPLEMENTAR

> **Estado:** La arquitectura está diseñada y documentada, pero el microservicio Node.js y el motor Playwright **no han sido desarrollados aún**. El fallback actualmente usa la API remota (`generateRemote()` en `api.js`) como puente temporal.

*Mecanismo a activar cuando el benchmark detecte navegadores antiguos o lentos que no puedan ejecutar FFmpeg.wasm.*

### 7.1. Flujo Diseñado

1. **Registro y Disparo**
   - PHP guarda la tarea en MariaDB con `estado = 'pendiente'`.
   - PHP dispara una petición HTTP asíncrona (Fire-and-Forget via cURL) al microservicio Node.js enviando únicamente el `ID_Tarea`. No espera respuesta.

2. **Encolamiento (Node.js)**
   - El microservicio Express (oculto en `localhost`, puerto cerrado al exterior) recibe la petición.
   - Responde HTTP 200 a PHP al instante y empuja el `ID_Tarea` a una cola en memoria (`async.queue` con concurrencia máxima de 1 o 2 hilos).

3. **Validación Just-in-Time**
   - Cuando el `ID_Tarea` llega al inicio de la cola, Node.js hace un `SELECT` a MariaDB.
   - Si el estado ya no es `pendiente` (ej. cancelado), descarta la tarea. Si es válido, extrae el JSON evaluado.

4. **Renderizado Headless**
   - Node.js orquesta `Playwright` para levantar Chromium con `--disable-gpu` (necesario en VM sin GPU).
   - Carga el mismo motor frontend estático, inyecta el JSON y canaliza (pipe) el stream de video hacia `FFmpeg.exe` con codec por CPU (`libx264`).

5. **Cierre**
   - Node.js guarda el video en `private_videos/`, actualiza `video_renders` en MariaDB con `estado = 'completado'` y libera el slot de la cola.

### 7.2. Integridad Visual (Plan A vs Plan B)

Para garantizar resultados visualmente idénticos:
- El backend **no realiza cálculos gráficos propios**. Se limita a levantar Chromium con el mismo código Fabric.js del cliente.
- Las tipografías deben servirse siempre en formato `WOFF2` pre-cargadas antes de iniciar la captura de frames.

---

## 8. Estándares de Desarrollo

### 8.1. Agregar un nuevo endpoint AJAX

1. Crear el método en el controlador correspondiente con visibilidad **`private`**.
2. Agregar el controlador a `$allowedControllers` en `AjaxGatewayController.php`.
3. En el frontend, llamar **siempre** a `window.fetchSeguro('Controlador@metodo', payload)`.
4. Para subidas de archivos binarios, usar `window.uploadVideoConProgreso(formData, callbackProgreso)`.

### 8.2. Flujo de variables dinámicas

- Las plantillas almacenan `{{NOMBRE_VARIABLE}}` como texto literal.
- `VARIABLES_DINAMICAS` (inyectado por Twig desde PHP) resuelve las variables en el canvas en tiempo de render.
- El `data_json` que se guarda en BD **siempre debe ser el JSON evaluado** (con `window.generateJson()` en el momento del render), nunca el template con placeholders.
