import './modules/constants.js';
import './modules/state.js';
import './modules/init.js';
import './modules/video.js';
import './modules/blocks.js';
import './modules/render.js';
import './modules/properties.js';
import './modules/ui_helpers.js';
import './modules/layers.js';
import './modules/json.js';
import './modules/api.js';
import './modules/ffmpeg_render.js';

window.addEventListener('DOMContentLoaded', () => {
    if (window.initEditor) {
        window.initEditor();
    }
});
