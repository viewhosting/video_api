// Motor de Renderizado Local usando FFmpeg.wasm v0.12.x (Última versión)
// Optimizado para ejecución Same-Origin (Local)

let ffmpegInstance = null;

async function loadVideoToBlobURL(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo cargar el video de fondo');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

function seekVideo(videoEl, time) {
    return new Promise((resolve) => {
        const onSeeked = () => {
            videoEl.removeEventListener('seeked', onSeeked);
            resolve();
        };
        videoEl.addEventListener('seeked', onSeeked);
        videoEl.currentTime = time;
    });
}

function updateAnimationsForFrame(canvas, timeSec) {
    let changed = false;
    canvas.getObjects().forEach(obj => {
        if (obj.elementType === 'marquesina') {
            const speed = (obj.customProps && obj.customProps.velocidad) ? obj.customProps.velocidad : 100;
            const cLeft = (obj.customProps && obj.customProps.containerLeft !== undefined) ? obj.customProps.containerLeft : 0;
            const cWidth = (obj.customProps && obj.customProps.containerWidth !== undefined) ? obj.customProps.containerWidth : canvas.width;

            if (obj._originalLeft === undefined) obj._originalLeft = obj.left;

            // start position: right edge of container
            const startX = cLeft + cWidth;
            const newLeft = startX - (speed * timeSec);

            obj.set('left', newLeft);
            changed = true;
        }
    });
    return changed;
}

function restoreAnimations(canvas) {
    canvas.getObjects().forEach(obj => {
        if (obj._originalLeft !== undefined) obj.set('left', obj._originalLeft);
    });
    canvas.renderAll();
}

function safeHideProgress() {
    const pb = document.getElementById('render-progress-bar-container');
    if (pb) pb.style.display = 'none';
}

function safeShowProgress() {
    const pb = document.getElementById('render-progress-bar-container');
    if (pb) pb.style.display = 'block';
    const bar = document.getElementById('render-progress-bar');
    if (bar) bar.style.width = '0%';
    const log = document.getElementById('render-log');
    if (log) {
        log.style.display = 'block';
        log.innerHTML = ''; // Clean start
    }
}

function safeUpdateText(text, isLog = false) {
    const txt = document.getElementById('render-status-text');
    if (txt) txt.innerText = text;

    if (isLog) {
        const log = document.getElementById('render-log');
        if (log) {
            log.style.display = 'block';
            const entry = document.createElement('div');
            entry.style.borderBottom = '1px solid #111';
            entry.style.padding = '2px 0';
            entry.innerHTML = `<span style="color:#4f46e5; margin-right:5px;">[${new Date().toLocaleTimeString()}]</span> ${text}`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }
}

window.initFFmpeg = async function (silent = false) {
    if (ffmpegInstance) return ffmpegInstance;

    if (!silent) safeUpdateText('1. Inicializando clase FFmpeg v0.12...', true);
    const { FFmpeg } = window.FFmpegWASM;
    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
        if (!message.includes('frame=') && !message.includes('fps=')) {
            if (!silent) safeUpdateText(message, true);
        }
    });

    ffmpeg.on('progress', ({ progress }) => {
        const pct = Math.round(progress * 100);
        const bar = document.getElementById('render-progress-bar');
        if (bar) bar.style.width = `${pct}%`;
        if (!silent) safeUpdateText(`Codificando video: ${pct}%`);
    });

    try {
        if (!silent) safeUpdateText('2. Cargando motor WASM desde servidor local...', true);

        // Soporte para Proxy Protegido: Si existen las globales de handshake, las usamos
        const coreURL = window.FFMPEG_CORE_URL || `${baseURL}/ffmpeg-core.js`;
        const wasmURL = window.FFMPEG_WASM_URL || `${baseURL}/ffmpeg-core.wasm`;
        const workerURL = window.FFMPEG_WORKER_URL || `${baseURL}/ffmpeg-core.worker.js`;

        await ffmpeg.load({
            coreURL: coreURL,
            wasmURL: wasmURL,
            workerURL: workerURL
        });

        if (!silent) safeUpdateText('3. Motor FFmpeg listo ✅', true);
    } catch (err) {
        console.error('Error en load():', err);
        safeUpdateText(`❌ Error fatal: ${err.message}`, true);
        throw err;
    }

    ffmpegInstance = ffmpeg;
    return ffmpegInstance;
}

window.generateLocalVideo = async function () {
    try {
        const payload = window.generateJson();
        if (!payload) return;

        window.openRenderModalLoading();
        safeShowProgress();

        const ffmpeg = await initFFmpeg();

        const fps = 30;
        let durationSec = parseFloat(payload.fin) - parseFloat(payload.inicio) || 5;

        // Ajustar duración basada en marquesinas (para que el texto logre cruzar completamente)
        let maxMarqTime = 0;
        window.AppState.canvas.getObjects().forEach(obj => {
            if (obj.elementType === 'marquesina') {
                const speed = (obj.customProps && obj.customProps.velocidad) ? parseFloat(obj.customProps.velocidad) : 100;
                const cWidth = (obj.customProps && obj.customProps.containerWidth !== undefined) ? obj.customProps.containerWidth : window.AppState.canvas.width;
                const textWidth = obj.getScaledWidth();
                if (speed > 0) {
                    const t = (cWidth + textWidth) / speed;
                    if (t > maxMarqTime) maxMarqTime = t;
                }
            }
        });

        if (maxMarqTime > durationSec) {
            durationSec = maxMarqTime;
        }

        // Límite de seguridad
        durationSec = Math.min(durationSec, 300); // Maximo 5 minutos
        const totalFrames = Math.ceil(durationSec * fps);
        const startTime = parseFloat(payload.inicio) || 0;

        const cw = window.AppState.canvas.width;
        const ch = window.AppState.canvas.height;

        const compCanvas = document.createElement('canvas');
        compCanvas.width = cw;
        compCanvas.height = ch;
        const compCtx = compCanvas.getContext('2d');

        const videoEl = document.createElement('video');
        videoEl.crossOrigin = "anonymous";
        videoEl.muted = true;
        let hasVideo = false;
        let localVideoUrl = null;

        if (payload.video) {
            safeUpdateText('4. Preparando video base...', true);
            try {
                localVideoUrl = await loadVideoToBlobURL(payload.video);
                videoEl.src = localVideoUrl;
                await new Promise((resolve) => {
                    videoEl.onloadeddata = resolve;
                    videoEl.onerror = () => { console.warn("Error cargando video de fondo"); resolve(); };
                    videoEl.load();
                });
                hasVideo = true;
            } catch (e) {
                console.warn('No se pudo cargar el video base', e);
            }
        }

        safeUpdateText('5. Iniciando captura de fotogramas...', true);
        window.AppState.canvas.discardActiveObject();
        window.AppState.canvas.renderAll();

        for (let i = 0; i < totalFrames; i++) {
            if (i % 10 === 0 || i === totalFrames - 1) {
                safeUpdateText(`Capturando frame ${i + 1} de ${totalFrames}...`, true);
            }
            const currentTime = startTime + (i / fps);
            if (hasVideo && videoEl.readyState >= 2) {
                await seekVideo(videoEl, currentTime);
            }

            updateAnimationsForFrame(window.AppState.canvas, i / fps);
            window.AppState.canvas.renderAll();

            compCtx.fillStyle = '#000000';
            compCtx.fillRect(0, 0, cw, ch);

            if (hasVideo && videoEl.readyState >= 2) {
                try { compCtx.drawImage(videoEl, 0, 0, cw, ch); } catch (e) { }
            }

            try {
                compCtx.drawImage(window.AppState.canvas.getElement(), 0, 0, cw, ch);
            } catch (e) {
                console.error("Tainted Canvas Error:", e);
                throw new Error("El canvas está manchado (CORS).");
            }

            const frameName = `frame_${String(i).padStart(4, '0')}.jpg`;
            const blob = await new Promise(r => compCanvas.toBlob(r, 'image/jpeg', 0.9));
            const arrayBuffer = await blob.arrayBuffer();
            await ffmpeg.writeFile(frameName, new Uint8Array(arrayBuffer));

            if (i % 10 === 0) {
                const pct = Math.round((i / totalFrames) * 100);
                safeUpdateText(`Procesando fotogramas: ${pct}%`);
                const bar = document.getElementById('render-progress-bar');
                if (bar) bar.style.width = `${pct}%`;
            }
        }

        restoreAnimations(window.AppState.canvas);
        safeUpdateText('6. Iniciando codificación final (MPEG-4)...', true);

        const userCredits = payload.creditos || "Video Renderizado";
        const devCredits = "Plataforma creada por Emanuel Flores - Ventas: ventas@cdev.mx";
        const fileName = payload.nombre || "video_renderizado.mp4";

        await ffmpeg.exec([
            '-framerate', String(fps),
            '-i', 'frame_%04d.jpg',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',
            // Organización jerárquica de metadatos
            '-metadata', `title=${fileName}`,
            '-metadata', `artist=${userCredits}`,
            '-metadata', `author=${devCredits}`,
            '-metadata', `copyright=${devCredits}`,
            '-metadata', `description=${devCredits}`,
            '-metadata', `comment=${devCredits}`,
            '-metadata', `composer=${devCredits}`,
            'output.mp4'
        ]);

        const data = await ffmpeg.readFile('output.mp4');
        const outUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

        window.AppState.lastRenderBlobUrl = outUrl;

        // Actualizar el botón de descarga
        const dlBtn = document.getElementById('render-video-download');
        if (dlBtn) {
            dlBtn.href = outUrl;
            dlBtn.download = payload.nombre || "video_renderizado.mp4";
        }

        // Limpieza
        for (let i = 0; i < totalFrames; i++) {
            try { await ffmpeg.deleteFile(`frame_${String(i).padStart(4, '0')}.jpg`); } catch (e) { }
        }
        if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);

        safeHideProgress();
        safeUpdateText('7. Renderizado completado con éxito ✅', true);
        window.showRenderModalVideo(outUrl);
    } catch (e) {
        console.error("FFmpeg Render Error:", e);
        safeUpdateText(`❌ Error: ${e.message}`, true);
        safeHideProgress();
        throw e;
    }
}

// Pre-carga automática al terminar de cargar la web

// Pre-carga movida a init.js