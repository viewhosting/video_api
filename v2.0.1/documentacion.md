# Documento de Arquitectura Técnica (TAD)

**Proyecto:** Sistema Híbrido de Composición de Video (Marca Blanca / Lote21)
**Autor:** Emanuel

## 1. Descripción del Sistema

Motor de composición de video lineal que permite superponer una capa gráfica interactiva (máscara basada en coordenadas y estilos) sobre un flujo de video (ej. Vimeo). El sistema renderiza el resultado final en un archivo físico `.mp4` sin pérdida de calidad para su distribución en remates. Utiliza una arquitectura híbrida (Cliente/Servidor) orientada a minimizar el consumo de recursos en la infraestructura central.

## 2. Stack Tecnológico Definido

* **Core Gráfico (Frontend):** Vanilla JS + `Fabric.js` (Canvas API).
* **Codificación Local (Plan A):** `FFmpeg.wasm` (ejecutado en Web Workers).
* **Backend Principal (API & DB):** PHP + MariaDB.
* **Microservicio de Respaldo (Plan B):** Node.js (Express) + `async.queue`.
* **Motor Headless (Plan B):** `Playwright` (Chromium) + `FFmpeg.exe` nativo.
* **Entorno de Servidor:** Máquina Virtual (VM) con Windows Server (sin GPU dedicada).

## 3. Flujos de Ejecución y Orquestación

### 3.1. Plan A: Renderizado Local (Client-Side)

*Flujo por defecto para descargar la carga computacional del servidor.*

1. **Aislamiento del Entorno:** El panel heredado (ASP Clásico) abre el editor web (PHP/JS) en una **nueva pestaña** o ventana (nunca en un iframe). Esto es obligatorio para inyectar cabeceras `Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy`, habilitando `SharedArrayBuffer` para FFmpeg.
2. **Composición:** El usuario edita la plantilla en `Fabric.js`. La configuración se guarda como un objeto JSON.
3. **Procesamiento:** Al exportar, un Web Worker extrae los frames del `<canvas>` y los envía a `FFmpeg.wasm`.
4. **Almacenamiento:** El navegador codifica el `.mp4` en memoria local y hace un POST al servidor PHP para guardar el binario físico y el JSON en MariaDB. La pestaña notifica al panel padre (`window.opener`) y se cierra.

### 3.2. Plan B: Fallback en Servidor (Server-Side)

*Mecanismo de seguridad activado por un benchmark fallido en navegadores antiguos/lentos.*

1. **Registro y Disparo:** * PHP guarda la tarea en MariaDB con el estado `estado = 'pendiente'`.
    * PHP dispara una petición HTTP asíncrona (Fire-and-Forget vía cURL) al microservicio Node.js enviando únicamente el `ID_Tarea`. No espera respuesta.
2. **Encolamiento (Node.js):**
    * El microservicio Express (oculto en `localhost`, puerto cerrado al exterior) recibe la petición.
    * Responde HTTP 200 a PHP al instante y empuja el `ID_Tarea` a una cola en memoria (`async.queue` con concurrencia estricta de 1 o 2 hilos máximos).
3. **Validación Just-in-Time:**
    * Cuando el `ID_Tarea` llega al inicio de la cola, Node.js hace un `SELECT` a MariaDB.
    * Si el estado ya no es 'pendiente' (ej. cancelado), se descarta la tarea. Si es válido, extrae el JSON.
4. **Renderizado Headless:**
    * Node.js orquesta `Playwright` para levantar Chromium con el flag `--disable-gpu` (necesario en VM sin gráfica).
    * Carga el mismo motor frontend estático, inyecta el JSON y canaliza (pipe) el stream de video hacia `FFmpeg.exe` utilizando el codec por CPU (`libx264`).
5. **Cierre:** Node.js sube el video renderizado, actualiza el estado en MariaDB a `completado` y libera el proceso para el siguiente elemento de la cola.

## 4. Estándares de Integridad Visual

Para garantizar que el Plan A y el Plan B produzcan resultados visualmente idénticos (mismas sombras, métricas de fuente y alineaciones):

* El backend no realiza cálculos gráficos propios. Se limita a levantar un navegador Chromium que ejecuta **exactamente el mismo código Fabric.js** que el cliente.
* Las tipografías deben servirse siempre en formato `WOFF2` pre-cargadas antes de iniciar cualquier captura de frames.
