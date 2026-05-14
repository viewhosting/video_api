// --- GLOBAL VARIABLES ---
window.AppState = {
    canvas: null,
    activeObject: null,
    videoEl: document.getElementById('bg-video-el'),
    currentVideoUrl: "",
    renderVideoCollapsed: false,
    renderModalHidden: false,
    bgPreviewTimeSec: 0,
    bgVideoLooping: false,
    blockConfigs: {},
    workspaceZoom: 1,
    lastRenderBlobUrl: null
};
