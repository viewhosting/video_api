import './modules/constants.js';
import './modules/state.js';
import './modules/init.js';
import './modules/ui_helpers.js';
import './modules/blocks/registry.js';
import './modules/blocks/base_classes.js';
import './modules/blocks/mapa.js';
import './modules/blocks/marquesina.js';
import './modules/blocks/video.js';
import './modules/blocks/texto_dos_columnas.js';
import './modules/blocks/texto_varias_columnas.js';
import './modules/blocks/rectangulo.js';
import './modules/blocks/common.js'; // Texto e Imagen
import './modules/video.js';
import './modules/blocks.js';
import './modules/render.js';
import './modules/properties.js';
import './modules/layers.js';
import './modules/json/common.js';
import './modules/json/exporter.js';
import './modules/json/importer.js';
import './modules/api.js';
import './modules/ffmpeg_render.js';

window.addEventListener('DOMContentLoaded', () => {
    if (window.initEditor) {
        window.initEditor();
    }
});
