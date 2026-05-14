// --- BACKGROUND VIDEO LOGIC ---
window.updateBackgroundVideo = function (overrideUrl = null) {
    const inputVal = document.getElementById('video-url-input').value.trim();
    const rawUrl = overrideUrl || inputVal;
    const url = window.evaluateVariables ? window.evaluateVariables(rawUrl) : rawUrl;

    const retryBtn = document.getElementById('retry-video-btn');

    retryBtn.style.display = 'none';
    document.getElementById('video-url-input').style.borderColor = 'var(--border)';

    if (url === window.AppState.currentVideoUrl && url !== "") {
        window.AppState.videoEl.src = "";
        window.AppState.videoEl.src = url;
    } else {
        window.AppState.currentVideoUrl = url;
        window.AppState.bgPreviewTimeSec = 0;
    }

    if (!url) {
        window.AppState.canvas.setBackgroundColor('#000000', window.AppState.canvas.renderAll.bind(window.AppState.canvas));
        if (window.AppState.videoEl) {
            window.AppState.videoEl.pause();
            window.AppState.videoEl.removeAttribute('src');
            window.AppState.videoEl.load();
        }
        const label = document.getElementById('top-header-video-label');
        if (label) {
            label.innerText = 'Sin video de fondo';
        }
        return;
    }

    if (!window.AppState.videoEl) {
        console.warn("No bg-video-el element found");
        return;
    }

    window.AppState.canvas.setBackgroundColor('rgba(0,0,0,0)', window.AppState.canvas.renderAll.bind(window.AppState.canvas));

    window.AppState.videoEl.onloadedmetadata = function () {
        retryBtn.style.display = 'none';

        let targetTime = 0;
        if (window.AppState.bgPreviewTimeSec > 0 && window.AppState.videoEl.duration && window.AppState.bgPreviewTimeSec < window.AppState.videoEl.duration) {
            targetTime = window.AppState.bgPreviewTimeSec;
        }
        try {
            window.AppState.videoEl.currentTime = targetTime;
        } catch (e) {
            console.error("Error setting preview time:", e);
        }

        if (window.AppState.bgVideoLooping) {
            window.AppState.videoEl.loop = true;
            window.AppState.videoEl.play().catch(() => { });
        } else {
            window.AppState.videoEl.loop = false;
            // Reproducir un instante para asegurar un frame y luego pausar
            window.AppState.videoEl.play().then(() => {
                setTimeout(() => {
                    window.AppState.videoEl.pause();
                }, 50);
            }).catch(() => { });
        }
    };

    window.AppState.videoEl.onerror = function (e) {
        handleVideoError(e);
    };

    window.AppState.videoEl.crossOrigin = "anonymous";
    window.AppState.videoEl.src = url;
    window.AppState.videoEl.load();

    const label = document.getElementById('top-header-video-label');
    if (label) {
        label.innerText = 'Video fondo: ' + url;
    }
}

window.retryVideo = function () {
    // Force update
    updateBackgroundVideo();
}

window.handleVideoError = function (e) {
    const retryBtn = document.getElementById('retry-video-btn');
    const input = document.getElementById('video-url-input');

    retryBtn.style.display = 'block';
    input.style.borderColor = '#d9534f';

    // Optional: Show a toast or alert, but the button is the requested UI
    console.warn("Video load failed. User can retry.");
}

window.toggleBackgroundLoop = function () {
    const url = document.getElementById('video-url-input').value.trim();
    if (!url) return;
    const btn = document.getElementById('bg-loop-btn');
    window.AppState.bgVideoLooping = !window.AppState.bgVideoLooping;
    if (window.AppState.bgVideoLooping) {
        if (!window.AppState.currentVideoUrl) {
            updateBackgroundVideo(url);
        } else if (window.AppState.videoEl.src !== window.AppState.currentVideoUrl) {
            updateBackgroundVideo(window.AppState.currentVideoUrl);
        } else {
            window.AppState.videoEl.loop = true;
            if (window.AppState.videoEl.readyState >= 2) {
                if (window.AppState.bgPreviewTimeSec > 0 && window.AppState.bgPreviewTimeSec < window.AppState.videoEl.duration) {
                    try { window.AppState.videoEl.currentTime = window.AppState.bgPreviewTimeSec; } catch (e) { }
                }
                window.AppState.videoEl.play().catch(() => { });
            } else {
                updateBackgroundVideo(window.AppState.currentVideoUrl || url);
            }
        }
        if (btn) btn.innerHTML = '<i class="fas fa-stop-circle"></i>';
    } else {
        window.AppState.videoEl.loop = false;
        window.AppState.videoEl.pause();
        if (window.AppState.bgPreviewTimeSec > 0) {
            try { window.AppState.videoEl.currentTime = window.AppState.bgPreviewTimeSec; } catch (e) { }
        }
        if (btn) btn.innerHTML = '<i class="fas fa-redo-alt"></i>';
    }
}

window.openVideoPreviewModal = function () {
    const input = document.getElementById('video-url-input');
    const url = input.value.trim();
    if (!url) return;
    const modal = document.getElementById('video-preview-modal');
    const player = document.getElementById('video-preview-player');
    modal.style.display = 'flex';
    if (player.src !== url) {
        player.src = url;
        player.load();
    }
    try {
        if (window.AppState.bgPreviewTimeSec > 0) {
            player.currentTime = window.AppState.bgPreviewTimeSec;
        } else {
            player.currentTime = 0;
        }
    } catch (e) { }
    player.play().catch(() => { });
}

window.closeVideoPreviewModal = function () {
    const modal = document.getElementById('video-preview-modal');
    const player = document.getElementById('video-preview-player');
    player.pause();
    modal.style.display = 'none';
}

window.applyVideoPreviewTime = function () {
    const player = document.getElementById('video-preview-player');
    window.AppState.bgPreviewTimeSec = player.currentTime || 0;
    closeVideoPreviewModal();
    if (window.AppState.currentVideoUrl) {
        updateBackgroundVideo(window.AppState.currentVideoUrl);
    } else {
        const url = document.getElementById('video-url-input').value.trim();
        if (url) updateBackgroundVideo(url);
    }
}

window.resetVideoPreviewTime = function () {
    window.AppState.bgPreviewTimeSec = 0;
    const player = document.getElementById('video-preview-player');
    try {
        player.currentTime = 0;
    } catch (e) { }
    if (window.AppState.currentVideoUrl) {
        updateBackgroundVideo(window.AppState.currentVideoUrl);
    }
}

