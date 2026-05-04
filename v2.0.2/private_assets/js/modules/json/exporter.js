/**
 * json/exporter.js
 * Lógica para convertir el estado actual del editor en un esquema JSON.
 */

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
        creditos: document.getElementById('conf-creditos').value.trim(),
        layout: {}
    };

    // Agrupar objetos por ID de Bloque
    const fabricBlocks = {};
    window.AppState.canvas.getObjects().forEach(obj => {
        if (obj.isMarquesinaOverlay) return;
        const bid = obj.blockId || 'bloque_1';
        if (!fabricBlocks[bid]) fabricBlocks[bid] = [];
        fabricBlocks[bid].push(obj);
    });

    // Procesar cada bloque
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
            const schema = window.mapFabricToSchema(obj, refObj);
            output.layout[bid].push(schema);
        });
    });

    return output;
};

window.mapFabricToSchema = function (obj, refObj) {
    if (Math.abs(obj.scaleX - 1) < 0.01) obj.set('scaleX', 1);
    if (Math.abs(obj.scaleY - 1) < 0.01) obj.set('scaleY', 1);

    const p = obj.getPointByOrigin('left', 'top');
    const absLeft = p.x;
    const absTop = p.y;

    let posX = Math.round(absLeft);
    let posY = Math.round(absTop);

    if (refObj && obj !== refObj) {
        const refP = refObj.getPointByOrigin('left', 'top');
        posX = Math.round(absLeft - refP.x);
        posY = Math.round(absTop - refP.y);
    }

    const type = obj.elementType || (obj.type === 'rect' ? 'rectangulo' : 'texto');
    const el = { tipo: type };

    // 1. Posición
    let posXStr = String(posX);
    let posYStr = String(posY);

    if (obj.customProps && obj.customProps.alignX) posXStr = obj.customProps.alignX;
    if (obj.customProps && obj.customProps.alignY) posYStr = obj.customProps.alignY;

    el.posicion = `${posXStr}, ${posYStr}`;

    // 2. Contenido (Prioridad en el orden del JSON)
    if (type === 'texto' || type === 'marquesina' || type === 'imagen' || type === 'video' || type === 'mapa') {
        if (obj.customProps && obj.customProps.raw_contenido !== undefined) {
            el.contenido = obj.customProps.raw_contenido;
        } else {
            el.contenido = obj.text || (obj.customProps && obj.customProps.contenido) || (typeof obj.getSrc === 'function' ? obj.getSrc() : '');
        }
    }

    // 3. Dimensiones y Texto
    if (type === 'texto' || type === 'marquesina') {
        el.size_texto = obj.fontSize;

        let family = obj.fontFamily || 'Arial';
        let weight = window.WEIGHT_MAP ? (window.WEIGHT_MAP[obj.fontWeight] || 'regular') : 'regular';

        const variants = ['Thin', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black', 'ExtraLight', 'Italic'];
        for (const v of variants) {
            if (family.endsWith(' ' + v)) {
                family = family.replace(' ' + v, '').trim();
                weight = v.toLowerCase();
                break;
            }
        }
        el.tipografia = family;
        el.peso = weight;

        if (obj.type === 'textbox' && type === 'texto') {
            el.width = Math.round(obj.width * obj.scaleX);
        }
        if (obj.textAlign) el.alineacion = obj.textAlign;
    }

    const isShape = (type === 'rectangulo' || type === 'imagen' || type === 'video' || type === 'texto_dos_columnas' || type === 'texto_varias_columnas' || type === 'mapa' || type === 'rect');
    if (isShape) {
        el.size = `${Math.round(obj.getScaledWidth())}, ${Math.round(obj.getScaledHeight())}`;
    }

    // 4. Color y Otros
    const hasGradient = (obj.customProps && obj.customProps.gradient_cfg) || (obj.fill && typeof obj.fill === 'object');
    if (hasGradient) {
        if (obj.fill instanceof fabric.Gradient) {
            const g = obj.fill;
            el.gradient_cfg = {
                type: g.type,
                coords: {
                    x1: g.coords.x1 / obj.width,
                    y1: g.coords.y1 / obj.height,
                    x2: g.coords.x2 / obj.width,
                    y2: g.coords.y2 / obj.height
                },
                colorStops: g.colorStops
            };
        } else if (obj.customProps && obj.customProps.gradient_cfg) {
            el.gradient_cfg = obj.customProps.gradient_cfg;
        }
    } else if (type !== 'texto_varias_columnas' && type !== 'texto_dos_columnas') {
        if (obj.fill && typeof obj.fill === 'string') {
            el.color = obj.fill;
        }
    }
    if (obj.opacity !== 1) el.transparencia = 1 - obj.opacity;

    // 5. Sombra
    if (obj.shadow && obj.shadow instanceof fabric.Shadow) {
        const s = obj.shadow;
        el.sombra = `${s.blur}, ${s.offsetX}, ${s.offsetY}, ${s.color}`;
    } else if (obj.customProps && obj.customProps.sombra) {
        el.sombra = obj.customProps.sombra;
    }

    // 6. Merge custom props con limpieza
    if (obj.customProps) {
        for (let key in obj.customProps) {
            if (['alignX', 'alignY', 'posicion', 'size', 'tipo', 'color', 'contenido', 'tipografia', 'peso', 'size_texto', 'width', 'alineacion', 'sombra'].includes(key)) continue;
            el[key] = obj.customProps[key];
        }
    }

    return el;
};
