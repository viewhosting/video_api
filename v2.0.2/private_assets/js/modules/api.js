// --- REMOTE RENDER (API) ---
window.AppState.lastRenderBlobUrl = null;

window.openRenderModalLoading = function () {
    const modal = document.getElementById('render-modal');
    const fab = document.getElementById('render-modal-toggle-fab');
    const statusText = document.getElementById('render-status-text');
    if (statusText) statusText.innerText = 'Generando…';

    const progressContainer = document.getElementById('render-progress-bar-container');
    if (progressContainer) progressContainer.style.display = 'none';

    const logContainer = document.getElementById('render-log');
    if (logContainer) {
        logContainer.style.display = 'none';
        logContainer.innerHTML = '';
    }
    document.getElementById('render-video-wrap').style.display = 'none';
    document.getElementById('render-error').style.display = 'none';
    window.AppState.renderVideoCollapsed = false;
    window.AppState.renderModalHidden = false;
    const btn = document.getElementById('render-toggle-btn');
    if (btn) btn.innerHTML = '<i class="fas fa-compress"></i>';
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
}

window.showRenderModalVideo = function (url) {
    const modal = document.getElementById('render-modal');
    const videoElOut = document.getElementById('render-video');
    const linkEl = document.getElementById('render-video-link');
    document.getElementById('render-status').style.display = 'none';
    document.getElementById('render-error').style.display = 'none';
    document.getElementById('render-video-wrap').style.display = 'block';
    videoElOut.src = url;
    linkEl.href = url;
    if (!window.AppState.renderModalHidden) {
        modal.style.display = 'flex';
    }
}

window.showRenderModalError = function (errObj) {
    const modal = document.getElementById('render-modal');
    const pre = document.getElementById('render-error');
    document.getElementById('render-status').style.display = 'none';
    document.getElementById('render-video-wrap').style.display = 'none';
    pre.style.display = 'block';
    try {
        pre.textContent = typeof errObj === 'string' ? errObj : JSON.stringify(errObj, null, 2);
    } catch {
        pre.textContent = String(errObj);
    }
    if (!window.AppState.renderModalHidden) {
        modal.style.display = 'flex';
    }
}

window.closeRenderModal = function () {
    const modal = document.getElementById('render-modal');
    const fab = document.getElementById('render-modal-toggle-fab');
    const videoOut = document.getElementById('render-video');
    videoOut.pause();
    videoOut.src = '';
    if (window.AppState.lastRenderBlobUrl) {
        URL.revokeObjectURL(window.AppState.lastRenderBlobUrl);
        window.AppState.lastRenderBlobUrl = null;
    }
    modal.style.display = 'none';
    window.AppState.renderModalHidden = false;
    if (fab) fab.style.display = 'none';
}

window.minimizeRenderModal = function () {
    const modal = document.getElementById('render-modal');
    const fab = document.getElementById('render-modal-toggle-fab');
    window.AppState.renderModalHidden = true;
    modal.style.display = 'none';
    if (fab) fab.style.display = 'block';
}

window.restoreRenderModal = function () {
    const modal = document.getElementById('render-modal');
    const fab = document.getElementById('render-modal-toggle-fab');
    window.AppState.renderModalHidden = false;
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
}

window.toggleRenderVideo = function () {
    const wrap = document.getElementById('render-video-wrap');
    const btn = document.getElementById('render-toggle-btn');
    if (!wrap || !btn) return;
    window.AppState.renderVideoCollapsed = !window.AppState.renderVideoCollapsed;
    if (window.AppState.renderVideoCollapsed) {
        wrap.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-expand"></i>';
    } else {
        wrap.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-compress"></i>';
    }
}

window.generateRemote = async function () {
    try {
        const payload = window.generateJson();
        openRenderModalLoading();
        const resp = await fetch('https://apis.clientesunikms.com/video_api/render', {
            method: 'POST',
            headers: {
                'Authorization': 'SantanderZXJjaW483847FsMUBzcG9ydHNzdW1taXQuY2FkYXNkOW0uYnI6U3FzZGYzNDU1RE5XQVhZRVhXUllNVW1wdUNlMmVsbGRxQ0pWTHpWQ21aQ2RrQ3c9PQ==-',
                'Content-Type': 'application/json',
                'Accept': 'application/json, video/mp4, */*'
            },
            body: JSON.stringify(payload)
        });
        const ctype = (resp.headers.get('content-type') || '').toLowerCase();
        if (!resp.ok) {
            if (ctype.includes('application/json')) {
                const errJson = await resp.json();
                showRenderModalError(errJson);
            } else {
                const errText = await resp.text();
                showRenderModalError(errText || ('HTTP ' + resp.status));
            }
            return;
        }
        if (ctype.includes('application/json')) {
            const data = await resp.json();
            const videoUrl =
                data.video_url || data.url || data.video ||
                (data.output && (data.output.url || data.output.video_url)) ||
                (Array.isArray(data.results) && data.results.length && (data.results[0].url || data.results[0].video_url)) ||
                null;
            if (videoUrl && typeof videoUrl === 'string') {
                showRenderModalVideo(videoUrl);
            } else {
                showRenderModalError(data);
            }
        } else {
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            window.AppState.lastRenderBlobUrl = url;
            showRenderModalVideo(url);
        }
    } catch (e) {
        window.showRenderModalError({ error: e?.message || String(e) });
    }
}

window.generateVideoRouter = async function () {
    // Intentar Plan A: Local FFmpeg.wasm
    try {
        if (typeof window.generateLocalVideo === 'function') {
            // Chequeo de seguridad: si SharedArrayBuffer no existe, la versión multicore de FFmpeg va a fallar.
            if (typeof SharedArrayBuffer === 'undefined') {
                console.warn('SharedArrayBuffer no está disponible. Posible fallo por falta de cabeceras COOP/COEP. Intentando de todas formas (puede usar version single-thread si está configurada).');
            }
            await window.generateLocalVideo();
        } else {
            console.warn('generateLocalVideo no está definido. Usando Plan B (Backend).');
            await window.generateRemote();
        }
    } catch (err) {
        console.error('Fallo el Plan A (Render Local):', err);
        console.log('Iniciando Plan B (Render Backend)...');
        // Fallback al Plan B
        await window.generateRemote();
    }
}
