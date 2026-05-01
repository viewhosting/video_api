/**
 * json/importer.js
 * Importador de JSON - Re-implementación 1:1 Paridad v2.0.0 con precarga de fuentes masiva.
 */

const parseValue = window.parseValue || function (valStr, referenceSize) {
    if (valStr === undefined || valStr === null || valStr === '') return 0;
    valStr = String(valStr).trim().toLowerCase();
    if (valStr.endsWith('%')) {
        const percent = parseFloat(valStr.replace('%', '')) / 100.0;
        return referenceSize * percent;
    }
    const num = parseFloat(valStr);
    return isNaN(num) ? 0 : num;
};

const standardKeys = ['tipo', 'posicion', 'size', 'size_texto', 'color', 'transparencia', 'tipografia', 'peso', 'fondo_texto', 'radius', 'sombra', 'gradient_cfg'];

async function createObjectFromSchema(blockId, el) {
    const canvas = window.AppState.canvas;
    const existingInBlock = canvas.getObjects().filter(o => o.blockId === blockId && !o.isMarquesinaOverlay);
    const isFirst = existingInBlock.length === 0;
    const refObj = existingInBlock[0];

    let left = 0, top = 0;
    const posParts = String(el.posicion || '0,0').split(',');
    let alignXIntent = null, alignYIntent = null;

    if (isFirst) {
        const rawX = posParts[0] ? posParts[0].trim().toLowerCase() : '0';
        const rawY = posParts[1] ? posParts[1].trim().toLowerCase() : '0';

        if (rawX === 'center') { left = canvas.width / 2; alignXIntent = 'center'; }
        else if (rawX === 'left') { left = 0; }
        else if (rawX === 'right') { left = canvas.width; }
        else { left = parseValue(rawX, canvas.width); }

        if (rawY === 'center') { top = canvas.height / 2; alignYIntent = 'center'; }
        else if (rawY === 'top') { top = 0; }
        else if (rawY === 'bottom') { top = canvas.height; }
        else { top = parseValue(rawY, canvas.height); }
    } else {
        const valX = posParts[0] ? posParts[0].trim().toLowerCase() : '0';
        if (valX !== 'center' && valX !== 'left' && valX !== 'right') {
            left = refObj.left + parseValue(valX, canvas.width);
        } else {
            left = refObj.left;
        }

        const valY = posParts[1] ? posParts[1].trim().toLowerCase() : '0';
        if (valY !== 'center' && valY !== 'top' && valY !== 'bottom') {
            top = refObj.top + parseValue(valY, canvas.height);
        } else {
            top = refObj.top;
        }
    }

    let obj;
    const opacity = el.transparencia !== undefined ? (1 - el.transparencia) : 1;

    if (el.tipo === 'rectangulo') {
        let w = 100, h = 50;
        if (el.size) {
            const s = String(el.size).split(',');
            w = parseValue(s[0], canvas.width);
            h = parseValue(s[1] || s[0], canvas.height);
        }
        let rx = 0, ry = 0;
        if (el.radius) {
            const rParts = String(el.radius).split(',').map(n => parseInt(n.trim()) || 0);
            rx = ry = rParts.length > 0 ? Math.max(...rParts) : 0;
        }
        obj = new fabric.RoundedRect({
            left, top, width: w, height: h,
            fill: el.color || '#000000',
            opacity, rx, ry,
            originX: 'left', originY: 'top',
            objectCaching: false
        });
        if (el.radius) {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = el.radius;
        }

    } else if (el.tipo === 'texto' || el.tipo === 'marquesina') {
        const textOptions = {
            left, top,
            fontSize: parseValue(el.size_texto || 40, canvas.height),
            fontFamily: el.tipografia || 'Arial',
            fontWeight: el.peso || 'normal',
            fill: el.color || '#FFFFFF',
            backgroundColor: el.fondo_texto || '',
            opacity,
            textAlign: el.alineacion || 'left',
            originX: 'left', originY: 'top',
            objectCaching: false
        };
        if (el.tipo === 'marquesina') {
            obj = new fabric.Text(el.contenido || 'Texto', textOptions);
            if (el.size) {
                if (!obj.customProps) obj.customProps = {};
                obj.customProps.size = el.size;
            }
        } else {
            obj = new fabric.Textbox(el.contenido || 'Texto', textOptions);
            if (el.width) obj.set('width', parseInt(el.width));
        }
        if (el.tipografia) {
            const family = window.normalizeCssFamily ? window.normalizeCssFamily(el.tipografia, el.peso || 'normal') : el.tipografia;
            obj.set('fontFamily', family);
        }

    } else if (el.tipo === 'texto_varias_columnas') {
        let w = 800, h = 50;
        if (el.size) {
            const s = String(el.size).split(',');
            w = parseValue(s[0], canvas.width);
            h = parseValue(s[1] || s[0], canvas.height);
        }
        obj = new fabric.MultiColumnText({
            left, top, width: w, height: h,
            fill: el.bg_color || 'rgba(68, 68, 68, 0.5)',
            fontSize: parseValue(el.size_texto || 18, canvas.height),
            rx: 5, ry: 5,
            originX: 'left', originY: 'top',
            objectCaching: false
        });

    } else if (el.tipo === 'imagen' || el.tipo === 'mapa') {
        obj = await new Promise((resolve) => {
            fabric.Image.fromURL(el.contenido || '', function (img) {
                if (!img) return resolve(null);
                img.set({ left, top, opacity, originX: 'left', originY: 'top', objectCaching: false });
                if (el.size) {
                    const s = String(el.size).split(',');
                    const targetW = parseValue(s[0], canvas.width);
                    const targetH = parseValue(s[1] || s[0], canvas.height);
                    img.scaleToWidth(targetW);
                    img.scaleToHeight(targetH);
                }
                resolve(img);
            }, { crossOrigin: 'anonymous' });
        });
    }

    if (obj) {
        finalizeObjectCreation(obj, blockId, el, isFirst, refObj, posParts, alignXIntent, alignYIntent);
    }
}

function finalizeObjectCreation(obj, blockId, el, isFirst, refObj, posParts, alignXIntent, alignYIntent) {
    const canvas = window.AppState.canvas;
    obj.blockId = blockId;
    obj.elementType = el.tipo;
    if (!obj.customProps) obj.customProps = {};
    if (alignXIntent) obj.customProps.alignX = alignXIntent;
    if (alignYIntent) obj.customProps.alignY = alignYIntent;

    for (let key in el) {
        if (!standardKeys.includes(key)) {
            obj.customProps[key] = el[key];
        }
    }

    if (!isFirst && refObj) {
        const valX = posParts[0] ? posParts[0].trim().toLowerCase() : '0';
        const valY = posParts[1] ? posParts[1].trim().toLowerCase() : '0';

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
    } else if (isFirst) {
        if (alignXIntent === 'center') obj.set('left', (canvas.width - obj.getScaledWidth()) / 2);
        else if (posParts[0] === 'right') obj.set('left', canvas.width - obj.getScaledWidth());

        if (alignYIntent === 'center') obj.set('top', (canvas.height - obj.getScaledHeight()) / 2);
        else if (posParts[1] === 'bottom') obj.set('top', canvas.height - obj.getScaledHeight());
    }

    if (el.radius && (el.tipo === 'imagen' || el.tipo === 'mapa')) {
        const r = parseInt(el.radius) || 0;
        const w = obj.getScaledWidth();
        const h = obj.getScaledHeight();
        obj.clipPath = new fabric.Rect({
            left: obj.left, top: obj.top, width: w, height: h, rx: r, ry: r, absolutePositioned: true
        });
    }

    if (el.gradient_cfg) {
        const cfg = el.gradient_cfg;
        let fabricGradient;

        if (cfg.colorStops && Array.isArray(cfg.colorStops)) {
            // Formato Completo (Paridad v2.0.0)
            const coords = cfg.coords || { x1: 0, y1: 0, x2: obj.width, y2: 0 };
            fabricGradient = new fabric.Gradient({
                type: cfg.type || 'linear',
                gradientUnits: 'pixels',
                coords: {
                    x1: coords.x1 * obj.width,
                    y1: coords.y1 * obj.height,
                    x2: coords.x2 * obj.width,
                    y2: coords.y2 * obj.height
                },
                colorStops: cfg.colorStops
            });
        } else {
            // Formato Simplificado (v2.0.1 previo)
            const c1 = new fabric.Color(cfg.color1 || '#FFFFFF');
            const c2 = new fabric.Color(cfg.color2 || '#000000');
            const cMid = new fabric.Color(`rgba(${Math.round((c1._source[0] + c2._source[0]) / 2)}, ${Math.round((c1._source[1] + c2._source[1]) / 2)}, ${Math.round((c1._source[2] + c2._source[2]) / 2)}, ${(c1.getAlpha() + c2.getAlpha()) / 2})`).toRgba();
            const isVertical = cfg.orientation === 'vertical';
            const mid = (cfg.midpoint || 50) / 100;
            const coords = isVertical ? { x1: 0, y1: 0, x2: 0, y2: obj.height } : { x1: 0, y1: 0, x2: obj.width, y2: 0 };

            fabricGradient = new fabric.Gradient({
                type: 'linear',
                gradientUnits: 'pixels',
                coords,
                colorStops: [
                    { offset: 0, color: c1.toRgba() },
                    { offset: mid, color: cMid },
                    { offset: 1, color: c2.toRgba() }
                ]
            });
        }
        obj.set('fill', fabricGradient);
    }

    if (el.sombra) {
        const s = String(el.sombra).split(',').map(p => p.trim());
        if (s.length >= 4) {
            obj.set('shadow', new fabric.Shadow({
                blur: parseInt(s[0]) || 0, offsetX: parseInt(s[1]) || 0, offsetY: parseInt(s[2]) || 0, color: s[3] || 'rgba(0,0,0,0.5)'
            }));
        }
    }

    canvas.add(obj);
    if (el.tipo === 'marquesina' && window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
    canvas.requestRenderAll();
}

export const loadJson = async (data) => {
    try {
        const canvas = window.AppState.canvas;
        canvas.clear();
        canvas.setWidth(data.ancho || 1024);
        canvas.setHeight(data.alto || 820);

        if (document.getElementById('video-url-input')) {
            document.getElementById('video-url-input').value = data.video || "";
            if (window.updateBackgroundVideo) window.updateBackgroundVideo();
        }

        if (data.nombre) document.getElementById('conf-nombre').value = data.nombre;
        if (data.inicio) document.getElementById('conf-inicio').value = data.inicio;
        if (data.fin) document.getElementById('conf-fin').value = data.fin;
        if (data.zoom) document.getElementById('conf-zoom').value = data.zoom;
        if (data.logo) document.getElementById('conf-logo').value = data.logo;
        if (data.audio) document.getElementById('conf-audio').value = data.audio;
        if (data.creditos) document.getElementById('conf-creditos').value = data.creditos;

        if (data.layout) {
            // PRECARGA MASIVA DE FUENTES (Crucial para cálculos de tamaño)
            if (window.ensureFontLoaded) {
                const fontPromises = [];
                // Siempre cargar Montserrat por seguridad para MultiColumnText
                fontPromises.push(window.ensureFontLoaded('Montserrat', 'bold'));
                fontPromises.push(window.ensureFontLoaded('Montserrat', 'regular'));

                for (const elements of Object.values(data.layout)) {
                    const arr = Array.isArray(elements) ? elements : [];
                    arr.forEach(el => {
                        if (el && el.tipografia) {
                            fontPromises.push(window.ensureFontLoaded(el.tipografia, el.peso || 'normal'));
                        }
                    });
                }
                await Promise.all(fontPromises);
            }

            for (const [blockId, elements] of Object.entries(data.layout)) {
                let meta = null;
                const arr = Array.isArray(elements) ? elements : [];
                const cleaned = [];
                arr.forEach(el => {
                    if (el && el.tipo === 'bloque_meta') meta = el;
                    else cleaned.push(el);
                });

                if (!window.AppState.blockConfigs) window.AppState.blockConfigs = {};
                window.AppState.blockConfigs[blockId] = {
                    inicio: meta?.inicio || '', fin: meta?.fin || '',
                    efecto_inicio: meta?.efecto_inicio || '', efecto_fin: meta?.efecto_fin || '',
                    duracion: meta?.duracion || ''
                };

                for (const el of cleaned) {
                    await createObjectFromSchema(blockId, el);
                }
            }
        }
        canvas.requestRenderAll();
        if (window.updateLayersList) window.updateLayersList();
    } catch (e) { console.error('Import Error:', e); }
};

window.loadJsonFromModal = async () => {
    const area = document.getElementById('json-textarea');
    if (!area) return;
    try {
        const data = JSON.parse(area.value);
        await loadJson(data);
        if (window.closeJsonModal) window.closeJsonModal();
    } catch (e) { alert('JSON Error: ' + e.message); }
};
