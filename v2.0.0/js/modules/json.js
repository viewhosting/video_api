// --- JSON HANDLING ---

window.showSettingsModal = function () {
    document.getElementById('settings-modal').style.display = 'flex';
}

window.closeSettingsModal = function () {
    document.getElementById('settings-modal').style.display = 'none';
}

window.showJsonModal = function () {
    const json = generateJson();
    document.getElementById('json-textarea').value = JSON.stringify(json, null, 4);
    document.getElementById('json-modal').style.display = 'flex';
}

window.closeJsonModal = function () {
    document.getElementById('json-modal').style.display = 'none';
}

window.generateJson = function () {
    const output = {
        json: true,
        nombre: document.getElementById('conf-nombre').value || "render_remoto.mp4",
        inicio: document.getElementById('conf-inicio').value || "0",
        fin: document.getElementById('conf-fin').value || "5",
        ancho: window.AppState.canvas.width,
        alto: window.AppState.canvas.height,
        zoom: parseFloat(document.getElementById('conf-zoom').value) || 2,
        video: document.getElementById('video-url-input').value.trim(),
        logo: document.getElementById('conf-logo').value.trim(),
        audio: document.getElementById('conf-audio').value.trim(),
        layout: {}
    };

    // Group objects by Block ID
    const fabricBlocks = {};
    window.AppState.canvas.getObjects().forEach(obj => {
        if (obj.isMarquesinaOverlay) return;
        const bid = obj.blockId || 'bloque_1';
        if (!fabricBlocks[bid]) fabricBlocks[bid] = [];
        fabricBlocks[bid].push(obj);
    });

    // Process each block
    Object.keys(fabricBlocks).forEach(bid => {
        output.layout[bid] = [];
        const groupObjs = fabricBlocks[bid];
        const refObj = groupObjs[0];

        const cfg = window.AppState.blockConfigs[bid] || {};
        const meta = { tipo: 'bloque_meta' };
        if (cfg.inicio !== undefined && cfg.inicio !== '') meta.inicio = cfg.inicio;
        if (cfg.fin !== undefined && cfg.fin !== '') meta.fin = cfg.fin;
        if (cfg.efecto_inicio !== undefined && cfg.efecto_inicio !== '') meta.efecto_inicio = cfg.efecto_inicio;
        if (cfg.efecto_fin !== undefined && cfg.efecto_fin !== '') meta.efecto_fin = cfg.efecto_fin;
        if (cfg.duracion !== undefined && cfg.duracion !== '') meta.duracion = cfg.duracion;
        output.layout[bid].push(meta);

        groupObjs.forEach(obj => {
            const schema = mapFabricToSchema(obj, refObj);
            output.layout[bid].push(schema);
        });
    });

    return output;
}

window.getGlobalDurationForTimeline = function () {
    const inicioEl = document.getElementById('conf-inicio');
    const finEl = document.getElementById('conf-fin');
    let start = 0;
    let end = 0;
    if (inicioEl && inicioEl.value !== '') {
        const v = parseFloat(inicioEl.value);
        if (!isNaN(v) && v >= 0) start = v;
    }
    if (finEl && finEl.value !== '') {
        const v = parseFloat(finEl.value);
        if (!isNaN(v) && v > start) end = v;
    }
    if (end <= start) {
        end = start + 10;
    }
    return { start, end, total: end - start };
}

window.getBlockWindowForTimeline = function (bid) {
    const cfg = window.AppState.blockConfigs[bid] || {};
    const global = getGlobalDurationForTimeline();
    let inicio = null;
    let fin = null;
    let dur = null;

    if (cfg.inicio !== undefined && cfg.inicio !== '') {
        const v = parseFloat(cfg.inicio);
        if (!isNaN(v)) inicio = v;
    }
    if (cfg.fin !== undefined && cfg.fin !== '') {
        const v = parseFloat(cfg.fin);
        if (!isNaN(v)) fin = v;
    }
    if (cfg.duracion !== undefined && cfg.duracion !== '') {
        const v = parseFloat(cfg.duracion);
        if (!isNaN(v)) dur = v;
    }

    let start = global.start;
    let end = global.end;

    if (inicio !== null && fin !== null) {
        start = inicio;
        end = fin;
    } else if (dur !== null) {
        start = global.start;
        end = global.start + dur;
    }

    if (end > global.end) end = global.end;
    if (end <= start) end = start;

    return { start, end, total: global.total };
}

window.updateTimelineFromBlocks = function () {
    const durationLabel = document.getElementById('timeline-duration-label');
    const blocks = getBlocks();
    const global = getGlobalDurationForTimeline();

    if (durationLabel) {
        durationLabel.innerText = 'Duración estimada: ' + global.total.toFixed(1) + 's';
    }
}

window.mapFabricToSchema = function (obj, refObj) {
    // Get Top-Left coordinates regardless of origin
    const p = obj.getPointByOrigin('left', 'top');
    const absLeft = p.x;
    const absTop = p.y;

    let posX = Math.round(absLeft);
    let posY = Math.round(absTop);

    // --- RELATIVE POSITIONING LOGIC ---
    if (refObj && obj !== refObj) {
        // Get Ref Top-Left
        const refP = refObj.getPointByOrigin('left', 'top');
        const refLeft = refP.x;
        const refTop = refP.y;

        // Calculate relative pixel offsets
        posX = Math.round(absLeft - refLeft);
        posY = Math.round(absTop - refTop);
    }

    // Handle Alignment Overrides (Global)
    if (obj.customProps) {
        // Para marquesina usamos alignX/alignY solo como meta-datos de UI;
        // la posición final se calcula aparte para no usar tokens no soportados.
        if (obj.customProps.alignX && obj.elementType !== 'marquesina') posX = obj.customProps.alignX;
        if (obj.customProps.alignY && obj.elementType !== 'marquesina') posY = obj.customProps.alignY;
    }

    const el = {
        tipo: obj.elementType || (obj.type === 'rect' ? 'rectangulo' : 'texto')
    };

    // Posición para primer elemento del bloque: manejo especial por tipo
    if (refObj && obj === refObj && obj.elementType === 'marquesina') {
        let posXStr = String(posX);
        let posYStr = String(posY);

        if (obj.customProps && obj.customProps.alignX === 'center') {
            posXStr = 'center';
        }
        if (obj.customProps && obj.customProps.alignX === 'left') {
            posXStr = 'left';
        }
        if (obj.customProps && obj.customProps.alignX === 'right') {
            posXStr = 'right';
        }

        if (obj.customProps && obj.customProps.alignY === 'center') {
            posYStr = 'center';
        } else {
            const yPct = Math.round((absTop / window.AppState.canvas.height) * 100);
            posYStr = `${yPct}%`;
        }
        el.posicion = `${posXStr}, ${posYStr}`;
    } else if (refObj && obj === refObj && obj.elementType === 'texto_varias_columnas') {
        // N Cols: si está centrado en X, usar "center" (como el ejemplo)
        if (obj.customProps && obj.customProps.alignX === 'center') {
            el.posicion = 'center';
        } else {
            el.posicion = `${posX}, ${posY}`;
        }
    } else {
        el.posicion = `${posX}, ${posY}`;
    }

    if (el.tipo === 'texto_varias_columnas') {
        const posNorm = (el.posicion || '').toLowerCase().replace(/\s+/g, '');
        if (posNorm === 'center,center') {
            el.posicion = 'center';
        }
    }

    // Size
    if (obj.elementType === 'texto_varias_columnas') {
        el.size = `${Math.round(obj.getScaledWidth())}, ${Math.round(obj.getScaledHeight())}`;
        
        if (obj.customProps && typeof obj.customProps.gap !== 'undefined') {
            el.gap = parseInt(obj.customProps.gap) || 0;
        }
        if (obj.customProps && obj.customProps.padding) {
            el.padding = obj.customProps.padding;
        }
    } else if (obj.type === 'rect' || obj.elementType === 'imagen') {
        el.size = `${Math.round(obj.getScaledWidth())}, ${Math.round(obj.getScaledHeight())}`;
    } else if (obj.elementType === 'texto_dos_columnas') {
        el.size = `${Math.round(obj.getScaledWidth())}, ${Math.round(obj.getScaledHeight())}`;
    } else if (obj.type === 'textbox' || obj.type === 'text') {
        // Texto normal / marquesina
        el.size_texto = obj.fontSize;
        if (obj.type === 'textbox' && obj.elementType !== 'marquesina' && obj.elementType !== 'texto_varias_columnas') {
            let exportedWidth = Math.round(obj.width);
            if (refObj && obj !== refObj && refObj.type === 'rect') {
                exportedWidth = Math.round(refObj.getScaledWidth());
            }
            el.width = exportedWidth;
        }
    }

    // Colors
    if (el.tipo !== 'texto_varias_columnas') {
        if (obj.fill && typeof obj.fill === 'string') el.color = obj.fill;
    }
    if (obj.opacity !== 1) el.transparencia = 1 - obj.opacity;

    // Type specifics
    if (el.tipo === 'rectangulo') {
        // radius
        if (obj.customProps && obj.customProps.radius) {
            el.radius = obj.customProps.radius;
        } else if (obj.rx || obj.ry) {
            el.radius = Math.round((obj.rx + obj.ry) / 2);
        }
    } else if (el.tipo === 'imagen' || el.tipo === 'video') {
        // Soporte de radius para imágenes (se aplica en backend)
        if (obj.customProps && obj.customProps.radius) {
            el.radius = obj.customProps.radius;
        }
    }

    if (el.tipo === 'marquesina') {
        // Valores por defecto para asegurar llaves completas
        el.velocidad = 100;
        el.bg_color = '#000000';
        el.transparencia = 0;
        el.padding = '0, 0, 0, 0';
        el.radius = '0, 0, 0, 0';

        // size: usar el custom si existe (permite %), si no, derivar del objeto (px)
        if (obj.customProps && obj.customProps.size) {
            el.size = obj.customProps.size;
        } else {
            el.size = `${Math.round(obj.getScaledWidth())}, ${Math.round(obj.getScaledHeight())}`;
        }

        // Sobrescribir con custom props si están presentes
        if (obj.customProps) {
            if (obj.customProps.velocidad !== undefined) el.velocidad = obj.customProps.velocidad;
            if (obj.customProps.bg_color) el.bg_color = obj.customProps.bg_color;
            if (obj.customProps.transparencia !== undefined) el.transparencia = obj.customProps.transparencia;
            if (obj.customProps.padding) el.padding = obj.customProps.padding;
            if (obj.customProps.margin) el.margin = obj.customProps.margin; // opcional
            if (obj.customProps.radius) el.radius = obj.customProps.radius;
        }
    }

    if (el.tipo === 'texto' || el.tipo === 'marquesina') {
        el.contenido = obj.text;
        el.tipografia = obj.fontFamily.toLowerCase();
        el.peso = WEIGHT_MAP[obj.fontWeight] || 'regular';
        if (obj.backgroundColor) el.fondo_texto = obj.backgroundColor;
        if (obj.textAlign) el.alineacion = obj.textAlign;
    }

    if (el.tipo === 'imagen' || el.tipo === 'video') {
        let imgUrl = null;
        if (obj.customProps && obj.customProps.contenido) {
            imgUrl = obj.customProps.contenido;
        } else if (typeof obj.getSrc === 'function') {
            imgUrl = obj.getSrc();
        }
        if (imgUrl) {
            el.contenido = imgUrl;
        }
    }

    // Merge Custom Props
    if (obj.customProps) {
        Object.assign(el, obj.customProps);
    }

    // Export Shadow (if exists in Fabric object)
    if (obj.shadow && obj.shadow instanceof fabric.Shadow) {
        const s = obj.shadow;
        el.sombra = `${s.blur}, ${s.offsetX}, ${s.offsetY}, ${s.color}`;
    }

    // Cleanup specific props
    if (obj.customProps) {
        if (el.tipo !== 'marquesina' && el.tipo !== 'texto_varias_columnas' && el.tipo !== 'imagen' && el.tipo !== 'video') {
            delete el.margin;
            delete el.margin_x;
            delete el.margin_y;
            delete el.margin_top;
            delete el.margin_left;
            delete el.margin_bottom;
            delete el.margin_right;
            delete el.padding;
        }
        delete el.alignX;
        delete el.alignY;
    }

    return el;
}

window.loadJsonFromModal = async function () {
    try {
        const raw = document.getElementById('json-textarea').value;
        const data = JSON.parse(raw);

        // Clear and Setup
        window.AppState.canvas.clear();
        window.AppState.canvas.setWidth(data.ancho || 1024);
        window.AppState.canvas.setHeight(data.alto || 820);
        document.getElementById('canvas-size-display').innerText = `${window.AppState.canvas.width} x ${window.AppState.canvas.height}`;

        // Load Video URL
        if (data.video) {
            document.getElementById('video-url-input').value = data.video;
            updateBackgroundVideo();
        } else {
            document.getElementById('video-url-input').value = "";
            updateBackgroundVideo();
        }

        // Load Global Config
        if (data.nombre) document.getElementById('conf-nombre').value = data.nombre;
        if (data.inicio) document.getElementById('conf-inicio').value = data.inicio;
        if (data.fin) document.getElementById('conf-fin').value = data.fin;
        if (data.zoom) document.getElementById('conf-zoom').value = data.zoom;
        if (data.logo) document.getElementById('conf-logo').value = data.logo;
        if (data.audio) document.getElementById('conf-audio').value = data.audio;

        window.AppState.blockConfigs = {};

        if (data.layout) {
            // 1. Pre-load all fonts before generating objects so dimensions are exact
            if (window.ensureFontLoaded) {
                const fontPromises = [];
                for (const elements of Object.values(data.layout)) {
                    if (Array.isArray(elements)) {
                        elements.forEach(el => {
                            if (el && el.tipografia) {
                                fontPromises.push(window.ensureFontLoaded(el.tipografia, el.peso));
                            }
                        });
                    }
                }
                await Promise.all(fontPromises);
            }

            // 2. Generate Fabric objects
            for (const [blockId, elements] of Object.entries(data.layout)) {
                let meta = null;
                const arr = Array.isArray(elements) ? elements : [];
                const cleaned = [];

                arr.forEach(el => {
                    if (el && el.tipo === 'bloque_meta') {
                        meta = el;
                    } else {
                        cleaned.push(el);
                    }
                });

                window.AppState.blockConfigs[blockId] = {
                    inicio: meta && meta.inicio !== undefined ? meta.inicio : '',
                    fin: meta && meta.fin !== undefined ? meta.fin : '',
                    efecto_inicio: meta && meta.efecto_inicio !== undefined ? meta.efecto_inicio : '',
                    efecto_fin: meta && meta.efecto_fin !== undefined ? meta.efecto_fin : '',
                    duracion: meta && meta.duracion !== undefined ? meta.duracion : ''
                };

                cleaned.forEach(el => createObjectFromSchema(blockId, el));
            }
        }

        window.AppState.canvas.requestRenderAll();
        updateLayersList();
        closeJsonModal();

    } catch (e) {
        alert('JSON Inválido: ' + e.message);
    }
}

window.parseValue = function (valStr, referenceSize) {
    if (valStr === undefined || valStr === null || valStr === '') return 0;
    valStr = String(valStr).trim().toLowerCase();
    if (valStr.endsWith('%')) {
        const percent = parseFloat(valStr.replace('%', '')) / 100.0;
        return referenceSize * percent;
    }
    const num = parseFloat(valStr);
    return isNaN(num) ? 0 : num;
};

window.createObjectFromSchema = function (blockId, el) {
    // Find existing objects in this block to determine if this is the first one or subsequent
    const existingInBlock = window.AppState.canvas.getObjects().filter(o => o.blockId === blockId && !o.isMarquesinaOverlay);
    const isFirst = existingInBlock.length === 0;

    let left = 0, top = 0;
    const posParts = String(el.posicion || '0,0').split(',');

    if (isFirst) {
        const rawX = posParts[0] ? posParts[0].trim().toLowerCase() : '0';
        const rawY = posParts[1] ? posParts[1].trim().toLowerCase() : '0';

        if (rawX === 'center') left = window.AppState.canvas.width / 2;
        else if (rawX === 'left') left = 0;
        else if (rawX === 'right') left = window.AppState.canvas.width;
        else left = window.parseValue(rawX, window.AppState.canvas.width);

        if (rawY === 'center') top = window.AppState.canvas.height / 2;
        else if (rawY === 'top') top = 0;
        else if (rawY === 'bottom') top = window.AppState.canvas.height;
        else top = window.parseValue(rawY, window.AppState.canvas.height);
    } else {
        // Relative to first
        const refObj = existingInBlock[0];
        const refLeft = refObj.left;
        const refTop = refObj.top;

        // X
        const valX = posParts[0] ? posParts[0].trim().toLowerCase() : '0';
        if (valX !== 'center' && valX !== 'left' && valX !== 'right') {
            left = refLeft + window.parseValue(valX, window.AppState.canvas.width);
        } else {
            left = refLeft; // Placeholder
        }

        // Y
        const valY = posParts[1] ? posParts[1].trim().toLowerCase() : '0';
        if (valY !== 'center' && valY !== 'top' && valY !== 'bottom') {
            top = refTop + window.parseValue(valY, window.AppState.canvas.height);
        } else {
            top = refTop; // Placeholder
        }
    }

    let obj;

    if (el.tipo === 'rectangulo') {
        let w = 100, h = 50;
        if (el.size) {
            const sParts = String(el.size).split(',');
            w = window.parseValue(sParts[0], window.AppState.canvas.width);
            h = window.parseValue(sParts[1] !== undefined ? sParts[1] : sParts[0], window.AppState.canvas.height);
        }

        // Radius handling
        let rx = 0, ry = 0;
        let customRadius = null;

        if (el.radius !== undefined && el.radius !== null) {
            const rStr = String(el.radius);
            if (rStr.includes(',')) {
                // Complex radius
                customRadius = rStr;
                // Visualization: max
                const parts = rStr.split(',').map(p => parseInt(p.trim()));
                const maxR = parts.length > 0 ? Math.max(...parts.filter(n => !isNaN(n))) : 0;
                rx = maxR; ry = maxR;
            } else {
                rx = parseInt(rStr);
                ry = rx;
                customRadius = rx;
            }
        }

        obj = new fabric.Rect({
            left, top, width: w, height: h,
            fill: el.color || '#000000',
            opacity: el.transparencia ? (1 - el.transparencia) : 1,
            rx, ry
        });

        if (customRadius !== null) {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = customRadius;
        }

    } else if (el.tipo === 'texto' || el.tipo === 'marquesina') {
        const txtAlign = el.alineacion || 'left';
        const textOptions = {
            left, top,
            fontSize: el.size_texto || 40,
            fontFamily: window.normalizeCssFamily ? window.normalizeCssFamily(el.tipografia) : (el.tipografia || 'Arial'),
            fontWeight: (function (w) {
                const map = { 'thin': 100, 'extralight': 200, 'light': 300, 'regular': 400, 'normal': 400, 'medium': 500, 'semibold': 600, 'bold': 700, 'extrabold': 800, 'black': 900 };
                return parseInt(w) || map[String(w || '').toLowerCase()] || 400;
            })(el.peso),
            fill: el.color || '#FFFFFF',
            backgroundColor: el.fondo_texto || '',
            opacity: el.transparencia ? (1 - el.transparencia) : 1,
            textAlign: txtAlign
        };

        if (el.tipo === 'marquesina') {
            // Usar fabric.Text para evitar que haga wrap (saltos de línea)
            obj = new fabric.Text(el.contenido || 'Texto', { ...textOptions, objectCaching: false });

            if (el.size) {
                if (!obj.customProps) obj.customProps = {};
                obj.customProps.size = el.size;
            }
        } else {
            obj = new fabric.Textbox(el.contenido || 'Texto', { ...textOptions, objectCaching: false });

            const refInBlock = existingInBlock[0];
            const shouldLockToRect = !isFirst && refInBlock && refInBlock.type === 'rect';

            if (shouldLockToRect) {
                obj.set('width', refInBlock.getScaledWidth());
            } else if (el.width) {
                obj.set('width', parseInt(el.width));
            }
        }

        if (el.radius) {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = el.radius;
        }

        if (isFirst && String(el.posicion).includes('center')) obj.originX = 'center';

    } else if (el.tipo === 'imagen') {
        const isSVG = String(el.contenido || '').toLowerCase().endsWith('.svg');
        if (isSVG) {
            fabric.loadSVGFromURL(el.contenido, function (objects, options) {
                const svgObj = fabric.util.groupSVGElements(objects, options);
                svgObj.set({ left, top });
                if (el.size) {
                    const sParts = String(el.size).split(',');
                    svgObj.scaleToWidth(window.parseValue(sParts[0], window.AppState.canvas.width));
                    svgObj.scaleToHeight(window.parseValue(sParts[1] !== undefined ? sParts[1] : sParts[0], window.AppState.canvas.height));
                }
                finalizeObjectCreation(svgObj, blockId, el, isFirst, existingInBlock[0], posParts);
            }, null, { crossOrigin: 'anonymous' });
        } else {
            fabric.Image.fromURL(el.contenido || 'https://via.placeholder.com/100', function (img) {
                img.set({ left, top });
                if (el.size) {
                    const sParts = String(el.size).split(',');
                    img.scaleToWidth(window.parseValue(sParts[0], window.AppState.canvas.width));
                    img.scaleToHeight(window.parseValue(sParts[1] !== undefined ? sParts[1] : sParts[0], window.AppState.canvas.height));
                }
                finalizeObjectCreation(img, blockId, el, isFirst, existingInBlock[0], posParts);
            }, { crossOrigin: 'anonymous' });
        }
        return;
    } else if (el.tipo === 'video') {
        let w = 200, h = 112;
        if (el.size) {
            const sParts = String(el.size).split(',');
            const pw = window.parseValue(sParts[0], window.AppState.canvas.width);
            const ph = window.parseValue(sParts[1] !== undefined ? sParts[1] : sParts[0], window.AppState.canvas.height);
            if (!isNaN(pw) && pw > 0) w = pw;
            if (!isNaN(ph) && ph > 0) h = ph;
        }
        obj = new fabric.Rect({
            left, top,
            width: w,
            height: h,
            fill: '#000000',
            stroke: '#ffffff',
            strokeDashArray: [6, 4],
            opacity: el.transparencia ? (1 - el.transparencia) : 1
        });
        if (!obj.customProps) obj.customProps = {};
        if (el.contenido) obj.customProps.contenido = el.contenido;
        if (el.radius) obj.customProps.radius = el.radius;
        if (el.padding) obj.customProps.padding = el.padding;
        if (el.margin) obj.customProps.margin = el.margin;
    } else if (el.tipo === 'texto_dos_columnas') {
        let w = 400, h = 60;
        if (el.size) {
            const sParts = String(el.size).split(',');
            const pw = window.parseValue(sParts[0], window.AppState.canvas.width);
            const ph = window.parseValue(sParts[1] !== undefined ? sParts[1] : sParts[0], window.AppState.canvas.height);
            if (!isNaN(pw) && pw > 0) w = pw;
            if (!isNaN(ph) && ph > 0) h = ph;
        }
        const bg = new fabric.Rect({ width: w, height: h, fill: '#333', opacity: 0.5 });
        const t1 = new fabric.Text('COL 1', { fontSize: 24, fill: '#fff', left: 10, top: 15 });
        const t2 = new fabric.Text('COL 2', { fontSize: 24, fill: '#fff', left: (w / 2) + 10, top: 15 });

        obj = new fabric.Group([bg, t1, t2], { left, top });
        obj.customProps = JSON.parse(JSON.stringify(el));
    } else if (el.tipo === 'texto_varias_columnas') {
        let w = 800;
        let h = 50;
        if (el.size) {
            const sParts = String(el.size).split(',');
            const pw = window.parseValue(sParts[0], window.AppState.canvas.width);
            const ph = window.parseValue(sParts[1] || sParts[0], window.AppState.canvas.height);
            if (!isNaN(pw) && pw > 0) w = pw;
            if (!isNaN(ph) && ph > 0) h = ph;
        }

        // Custom Class for Multi-Column Rendering
        if (!fabric.MultiColumnText) {
            fabric.MultiColumnText = fabric.util.createClass(fabric.Rect, {
                type: 'texto_varias_columnas',
                _render: function(ctx) {
                    // 1. Draw the main container background (the Rect itself)
                    this.callSuper('_render', ctx);
                    
                    if (!this.customProps || !this.customProps.columnas) return;

                    const cols = this.customProps.columnas;
                    const totalW = this.width;
                    const totalH = this.height;
                    let currentX = -totalW / 2;

                    cols.forEach(col => {
                        let colW = 100;
                        if (String(col.width).includes('%')) {
                            colW = (parseFloat(col.width) / 100) * totalW;
                        } else {
                            colW = parseFloat(col.width) || 100;
                        }

                        ctx.save();
                        
                        // 2. Draw Column Background
                        if (col.bg_color) {
                            ctx.save();
                            const opacity = col.bg_transparencia != null ? col.bg_transparencia : 1;
                            ctx.globalAlpha = opacity;
                            ctx.fillStyle = col.bg_color;
                            ctx.fillRect(currentX, -totalH/2, colW, totalH);
                            ctx.restore();
                        }

                        // 3. Draw Column Borders
                        if (col.borde_grosor > 0) {
                            ctx.save();
                            const bOpacity = col.borde_transparencia != null ? col.borde_transparencia : 1;
                            ctx.globalAlpha = bOpacity;
                            ctx.strokeStyle = col.borde_color || '#FFFFFF';
                            ctx.lineWidth = col.borde_grosor;
                            
                            const sides = String(col.borde_lados || 'all').toLowerCase();
                            const x1 = currentX;
                            const x2 = currentX + colW;
                            const y1 = -totalH / 2;
                            const y2 = totalH / 2;

                            ctx.beginPath();
                            if (sides.includes('all')) {
                                ctx.strokeRect(x1, y1, colW, totalH);
                            } else {
                                if (sides.includes('top')) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); }
                                if (sides.includes('bottom')) { ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); }
                                if (sides.includes('left')) { ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); }
                                if (sides.includes('right')) { ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); }
                            }
                            ctx.stroke();
                            ctx.restore();
                        }

                        // 4. Render Column Text
                        const fontSize = col.size_texto || 18;
                        const fontWeight = col.peso || 'bold';
                        const fontFamily = col.tipografia || 'Montserrat';
                        const color = col.color || '#FFFFFF';
                        const align = col.alineacion || 'center';

                        // Map weights if they are strings like 'bold'
                        const weightMap = { 'thin': 100, 'light': 300, 'regular': 400, 'medium': 500, 'bold': 700, 'extrabold': 800, 'black': 900 };
                        const finalWeight = weightMap[fontWeight.toLowerCase()] || fontWeight;

                        ctx.font = `${finalWeight} ${fontSize}px "${fontFamily}"`;
                        ctx.fillStyle = color;
                        ctx.textBaseline = 'middle';
                        ctx.textAlign = align;

                        let textX = currentX;
                        if (align === 'center') textX += colW / 2;
                        else if (align === 'right') textX += colW;

                        // Add small padding for left/right alignment
                        if (align === 'left') textX += 5;
                        if (align === 'right') textX -= 5;

                        ctx.fillText(col.contenido || '', textX, 0);
                        
                        ctx.restore();
                        currentX += colW;
                    });
                }
            });
        }

        obj = new fabric.MultiColumnText({
            left, top, width: w, height: h,
            fill: el.bg_color || 'rgba(68, 68, 68, 0.5)',
            rx: 5, ry: 5,
            objectCaching: false
        });
        obj.customProps = JSON.parse(JSON.stringify(el));
    } else {
        // Fallback
        obj = new fabric.Textbox(`[${el.tipo}]`, {
            left, top, fontSize: 20, fill: 'yellow', backgroundColor: '#444'
        });
        obj.customProps = JSON.parse(JSON.stringify(el));
    }

    if (obj) {
        finalizeObjectCreation(obj, blockId, el, isFirst, existingInBlock[0], posParts);
    }
}

window.finalizeObjectCreation = function (obj, blockId, el, isFirst, refObj, posParts) {
    obj.blockId = blockId;
    obj.elementType = el.tipo;

    // Restore Custom Props
    const standardKeys = ['tipo', 'posicion', 'size', 'size_texto', 'color', 'transparencia', 'tipografia', 'peso', 'fondo_texto', 'radius', 'sombra'];
    if (!obj.customProps) obj.customProps = {};
    for (let key in el) {
        if (!standardKeys.includes(key)) {
            obj.customProps[key] = el[key];
        }
    }

    // Gradient Support
    if (el.gradient_cfg) {
        const cfg = el.gradient_cfg;
        const isVertical = cfg.orientation === 'vertical';
        const mid = (cfg.midpoint || 50) / 100;
        
        const normalizeColor = (c) => {
            if (!c) return 'rgba(255,255,255,1)';
            if (c.startsWith('rgb')) return c;
            try {
                return new fabric.Color(c).toRgba();
            } catch (e) {
                return c;
            }
        };

        const c1 = normalizeColor(cfg.color1);
        const c2 = normalizeColor(cfg.color2);

        // Midpoint color mix
        const getMidColor = (color1, color2) => {
            const col1 = new fabric.Color(color1);
            const col2 = new fabric.Color(color2);
            const r = Math.round((col1._source[0] + col2._source[0]) / 2);
            const g = Math.round((col1._source[1] + col2._source[1]) / 2);
            const b = Math.round((col1._source[2] + col2._source[2]) / 2);
            const a = (col1.getAlpha() + col2.getAlpha()) / 2;
            return `rgba(${r},${g},${b},${a})`;
        };
        const cMid = getMidColor(c1, c2);
        const w = obj.width;
        const h = obj.height;

        // ORIGIN-AWARE PIXEL COORDINATES
        const x1 = obj.originX === 'center' ? -w/2 : 0;
        const x2 = obj.originX === 'center' ? w/2 : w;
        const y1 = obj.originY === 'center' ? -h/2 : 0;
        const y2 = obj.originY === 'center' ? h/2 : h;

        const coords = isVertical 
            ? { x1: 0, y1: y1, x2: 0, y2: y2 }
            : { x1: x1, y1: 0, x2: x2, y2: 0 };

        obj.set('fill', new fabric.Gradient({
            type: 'linear',
            gradientUnits: 'pixels',
            coords: coords,
            colorStops: [
                { offset: 0, color: c1 },
                { offset: mid, color: cMid },
                { offset: 1, color: c2 }
            ]
        }));
    }

    // Soporte para Sombra (Uniforme si offset es 0,0)
    if (el.sombra) {
        const s = String(el.sombra).split(',').map(p => p.trim());
        if (s.length >= 4) {
            obj.set('shadow', new fabric.Shadow({
                blur: parseInt(s[0]) || 0,
                offsetX: parseInt(s[1]) || 0,
                offsetY: parseInt(s[2]) || 0,
                color: s[3] || 'rgba(0,0,0,0.5)'
            }));
        }
    }

    // Apply Relative Alignment Logic
    if (!isFirst && refObj) {
        const valXRaw = posParts[0] ? posParts[0].trim() : '0';
        const valYRaw = posParts[1] ? posParts[1].trim() : '0';
        const valX = valXRaw.toLowerCase();
        const valY = valYRaw.toLowerCase();

        // X Alignment
        if (valX === 'center') {
            obj.set('left', refObj.left + (refObj.getScaledWidth() / 2) - (obj.getScaledWidth() / 2));
            obj.customProps.alignX = 'center';
        } else if (valX === 'right') {
            obj.set('left', refObj.left + refObj.getScaledWidth() - obj.getScaledWidth());
            obj.customProps.alignX = 'right';
        } else if (valX === 'left') {
            obj.set('left', refObj.left);
            obj.customProps.alignX = 'left';
        }

        // Y Alignment
        if (valY === 'center') {
            obj.set('top', refObj.top + (refObj.getScaledHeight() / 2) - (obj.getScaledHeight() / 2));
            obj.customProps.alignY = 'center';
        } else if (valY === 'bottom') {
            obj.set('top', refObj.top + refObj.getScaledHeight() - obj.getScaledHeight());
            obj.customProps.alignY = 'bottom';
        } else if (valY === 'top') {
            obj.set('top', refObj.top);
            obj.customProps.alignY = 'top';
        }

        obj.setCoords();
    } else if (isFirst) {
        const valXRaw = posParts[0] ? posParts[0].trim() : '0';
        const valYRaw = posParts[1] ? posParts[1].trim() : '0';
        const valX = valXRaw.toLowerCase();
        const valY = valYRaw.toLowerCase();

        if (valX === 'center') {
            obj.set('left', (window.AppState.canvas.width - obj.getScaledWidth()) / 2);
            obj.customProps.alignX = 'center';
        } else if (valX === 'right') {
            obj.set('left', window.AppState.canvas.width - obj.getScaledWidth());
            obj.customProps.alignX = 'right';
        } else if (valX === 'left') {
            obj.set('left', 0);
            obj.customProps.alignX = 'left';
        } else {
            obj.set('left', window.parseValue(valXRaw, window.AppState.canvas.width));
        }

        if (valY === 'center') {
            obj.set('top', (window.AppState.canvas.height - obj.getScaledHeight()) / 2);
            obj.customProps.alignY = 'center';
        } else if (valY === 'bottom') {
            obj.set('top', window.AppState.canvas.height - obj.getScaledHeight());
            obj.customProps.alignY = 'bottom';
        } else if (valY === 'top') {
            obj.set('top', 0);
            obj.customProps.alignY = 'top';
        } else {
            obj.set('top', window.parseValue(valYRaw, window.AppState.canvas.height));
        }
        obj.setCoords();
    }

    window.AppState.canvas.add(obj);

    // After adding to canvas, trigger overlay rendering if necessary
    if (el.tipo === 'marquesina' && window.updateMarquesinaOverlay) {
        window.updateMarquesinaOverlay(obj);
    }

    // Configuración especial para marquesina (Recorte de animación)
    if (el.tipo === 'marquesina' && refObj) {
        obj.customProps.containerLeft = refObj.left;
        obj.customProps.containerTop = refObj.top;
        obj.customProps.containerWidth = refObj.getScaledWidth();
        obj.customProps.containerHeight = refObj.getScaledHeight();

        obj.clipPath = new fabric.Rect({
            left: refObj.left,
            top: refObj.top,
            width: refObj.getScaledWidth(),
            height: refObj.getScaledHeight(),
            absolutePositioned: true
        });
    }
}

window.updateCanvasSize = function () {
    const w = prompt("Nuevo Ancho:", window.AppState.canvas.width);
    const h = prompt("Nuevo Alto:", window.AppState.canvas.height);
    if (w && h) {
        window.AppState.canvas.setWidth(parseInt(w));
        window.AppState.canvas.setHeight(parseInt(h));
        document.getElementById('canvas-size-display').innerText = `${w} x ${h}`;
    }
}