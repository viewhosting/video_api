// --- RENDER TOOLS ---

window.getBlocks = function () {
    const blocks = new Set();
    window.AppState.canvas.getObjects().forEach(obj => {
        if (obj.blockId) blocks.add(obj.blockId);
    });
    return Array.from(blocks).sort((a, b) => {
        const numA = parseInt(a.replace('bloque_', '')) || 999;
        const numB = parseInt(b.replace('bloque_', '')) || 999;
        return numA - numB;
    });
}

window.addBlock = function () {
    const currentCount = getBlocks().length;
    const blockId = 'bloque_' + (currentCount + 1);
    // Just creating the ID concept for now
    // Maybe add a dummy hidden object to persist the block if empty?
    // For now, we rely on adding elements to it.
    alert(`Bloque creado: ${blockId}. Ahora agrega elementos a él.`);
    return blockId;
}

window.getActiveBlockId = function () {
    const blocks = getBlocks();
    if (blocks.length === 0) return 'bloque_1';
    // Default to last
    return blocks[blocks.length - 1];
}

window.addElement = function (type) {
    // Smart block selection: if an object is selected, use its block.
    let defaultBlock = getActiveBlockId();
    if (window.AppState.activeObject && window.AppState.activeObject.blockId) {
        defaultBlock = window.AppState.activeObject.blockId;
    }

    const blockId = prompt("ID del Bloque:", defaultBlock);
    if (!blockId) return;

    const center = window.AppState.canvas.getCenter();
    let obj;

    if (type === 'rectangulo') {
        obj = new fabric.Rect({
            left: center.left - 100, top: center.top - 50,
            fill: '#FFFB00', width: 200, height: 100,
            rx: 0, ry: 0
        });
    } else if (type === 'texto') {
        obj = new fabric.Textbox('Texto Nuevo', {
            left: center.left - 150, top: center.top - 20,
            fontSize: 40, fontFamily: 'arial',
            fill: '#FFFFFF', width: 300,
            textAlign: 'center'
        });
    } else if (type === 'imagen') {
        const url = prompt("URL de la imagen:", "https://via.placeholder.com/150");
        if (!url) return;

        fabric.Image.fromURL(url, function (img) {
            img.set({ left: center.left - 75, top: center.top - 75 });
            finalizeAdd(img, blockId, 'imagen', { contenido: url });
        });
        return;
    } else if (type === 'video') {
        const url = prompt("URL del video:", "https://www.cdev.mx/comercial.mp4");
        if (!url) return;
        obj = new fabric.Rect({
            left: center.left - 100,
            top: center.top - 56,
            width: 200,
            height: 112,
            fill: '#000000',
            stroke: '#ffffff',
            strokeDashArray: [6, 4]
        });
        obj.customProps = {
            contenido: url,
            radius: 30,
            padding: "10,10",
            margin: "10,10"
        };
    } else if (type === 'texto_dos_columnas') {
        // Simulation Group
        const bg = new fabric.Rect({ width: 400, height: 60, fill: '#333', opacity: 0.5 });
        const t1 = new fabric.Text('COL 1', { fontSize: 24, fill: '#fff', left: 10, top: 15 });
        const t2 = new fabric.Text('COL 2', { fontSize: 24, fill: '#fff', left: 210, top: 15 });

        obj = new fabric.Group([bg, t1, t2], {
            left: center.left - 200, top: center.top - 30
        });
        // Initialize custom props
        obj.customProps = {
            col1_contenido: "COL 1", col1_size: 24, col1_color: "#FFFFFF",
            col2_contenido: "COL 2", col2_size: 24, col2_color: "#FFFFFF",
        };
    } else if (type === 'texto_varias_columnas') {
        obj = new fabric.Textbox('[ Tabla Dinámica N-Cols ]', {
            left: center.left - 150, top: center.top - 20,
            fontSize: 20, fontFamily: 'Courier New',
            fill: '#ddd', backgroundColor: '#444',
            width: 300, textAlign: 'center'
        });
        obj.customProps = { columnas: [] };
    } else if (type === 'marquesina') {
        obj = new fabric.Textbox('MARQUESINA SCROLLING...', {
            left: 0, top: window.AppState.canvas.height - 60,
            fontSize: 30, fontFamily: 'Arial',
            fill: '#fff', backgroundColor: '#cc0000',
            width: window.AppState.canvas.width
        });
    } else if (type === 'mapa') {
        const defaultLat = -34.603722;
        const defaultLng = -58.381591;
        const defaultZoom = 15;
        // Placeholder inicial con texto descriptivo
        const placeholderUrl = `https://via.placeholder.com/400x300?text=Cargando+Mapa+GPS...`;

        fabric.Image.fromURL(placeholderUrl, function (img) {
            img.set({
                left: center.left - 150,
                top: center.top - 112,
                width: 300,
                height: 225
            });
            finalizeAdd(img, blockId, 'mapa', {
                lat: defaultLat,
                lng: defaultLng,
                zoom: defaultZoom,
                map_type: 'roadmap',
                con_pin: true
            });
            // Intentar cargar el mapa real de inmediato
            if (window.updateMapImage) window.updateMapImage(img);
        });
        return;
    }

    if (obj) finalizeAdd(obj, blockId, type);
}

window.getMarquesinaOverlayTarget = function (base) {
    return window.AppState.canvas.getObjects().find(o => o.isMarquesinaOverlay && o.marquesinaId === base.__uid);
}

window.updateMarquesinaOverlay = function (base) {
    if (!base) return;
    if (!base.__uid) {
        base.__uid = generateId();
    }
    let overlay = getMarquesinaOverlayTarget(base);
    let sizeStr = base.customProps && base.customProps.size
        ? String(base.customProps.size)
        : `${Math.round(base.width)}, ${Math.round(base.height)}`;
    const parts = sizeStr.split(',');
    const w = window.parseValue ? window.parseValue(parts[0], window.AppState.canvas.width) : parseInt(parts[0]);
    const h = window.parseValue ? window.parseValue(parts[1] !== undefined ? parts[1] : parts[0], window.AppState.canvas.height) : parseInt(parts[1] || parts[0] || 0);

    const bgColor = base.customProps && base.customProps.bg_color ? base.customProps.bg_color : 'transparent';
    const opacity = base.customProps && base.customProps.transparencia !== undefined ? (1 - base.customProps.transparencia) : 1;
    let radiusStr = base.customProps && base.customProps.radius ? String(base.customProps.radius) : "0";
    let rx = parseInt(radiusStr.split(',')[0]) || 0;

    if (!overlay) {
        overlay = new fabric.Rect({
            left: base.left,
            top: base.top,
            width: isNaN(w) ? base.width : w,
            height: isNaN(h) ? base.height : h,
            fill: bgColor,
            opacity: opacity,
            rx: rx,
            ry: rx,
            selectable: false,
            evented: false
        });
        overlay.isMarquesinaOverlay = true;
        overlay.marquesinaId = base.__uid;
        window.AppState.canvas.add(overlay);
        overlay.moveTo(base.layerIndex ? base.layerIndex : window.AppState.canvas.getObjects().indexOf(base));
    } else {
        overlay.set({
            left: base.left,
            top: base.top,
            width: isNaN(w) ? base.width : w,
            height: isNaN(h) ? base.height : h,
            fill: bgColor,
            opacity: opacity,
            rx: rx,
            ry: rx
        });
    }
    overlay.blockId = base.blockId;
    overlay.setCoords();

    // Assign clipping mask to the text so it stays within the background
    base.clipPath = new fabric.Rect({
        left: overlay.left,
        top: overlay.top,
        width: overlay.width,
        height: overlay.height,
        rx: overlay.rx,
        ry: overlay.ry,
        absolutePositioned: true
    });

    window.AppState.canvas.requestRenderAll();
}

window.finalizeAdd = function (obj, blockId, type, extraProps = {}) {
    obj.blockId = blockId;
    obj.elementType = type;
    if (extraProps) obj.customProps = { ...obj.customProps, ...extraProps };
    window.AppState.canvas.add(obj);
    // if (type === 'marquesina') {
    //     updateMarquesinaOverlay(obj);
    // }
    window.AppState.canvas.setActiveObject(obj);
    updateLayersList();
}