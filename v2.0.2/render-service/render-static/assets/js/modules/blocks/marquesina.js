/**
 * blocks/marquesina.js
 * Lógica independiente para el bloque de Marquesina (Scroll de texto)
 */
window.BlockRegistry.register('marquesina', {
    /**
     * Creación inicial
     */
    render: (center, blockId) => {
        const obj = new fabric.Textbox('MARQUESINA SCROLLING...', {
            left: 0, 
            top: window.AppState.canvas.height - 60,
            fontSize: 30, 
            fontFamily: 'Arial',
            fill: '#fff', 
            backgroundColor: '#cc0000',
            width: window.AppState.canvas.width
        });
        window.finalizeAdd(obj, blockId, 'marquesina');
        if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
    },

    /**
     * Panel de Propiedades
     */
    properties: (obj, propsGroup) => {
        const marqGroup = document.createElement('div');
        marqGroup.className = 'prop-card-body';
        propsGroup.appendChild(marqGroup);

        window.addPropInput(marqGroup, 'Velocidad (px/s)', (obj.customProps && obj.customProps.velocidad) || 100, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.velocidad = parseInt(v);
            window.AppState.canvas.requestRenderAll();
        });

        window.addPropColor(marqGroup, 'Color del Texto (Letra)', obj.fill || '#FFFFFF', (v) => {
            obj.set('fill', v);
            window.AppState.canvas.requestRenderAll();
        });

        window.addPropColor(marqGroup, 'Fondo Texto (Letras)', obj.backgroundColor || '', (v) => {
            obj.set('backgroundColor', v);
            window.AppState.canvas.requestRenderAll();
        });

        window.addPropColor(marqGroup, 'Color Fondo (Contenedor)', (obj.customProps && obj.customProps.bg_color) || '', (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.bg_color = v;
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
            window.AppState.canvas.requestRenderAll();
        });

        window.addPropRange(marqGroup, 'Transparencia Total', (obj.customProps && obj.customProps.transparencia) || 0, 0, 1, 0.1, (v) => {
            if (!obj.customProps) obj.customProps = {};
            const val = parseFloat(v);
            obj.customProps.transparencia = val;
            obj.set('opacity', 1 - val);
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
            window.AppState.canvas.requestRenderAll();
        });

        // Lógica de Padding y Margin (TRBL)
        const paddingValor = (obj.customProps && obj.customProps.padding) || '0, 0, 0, 0';
        const marginValor = (obj.customProps && obj.customProps.margin) || '0, 0, 0, 0';

        const filaPM = document.createElement('div');
        filaPM.className = 'prop-row';

        const gridPM = document.createElement('div');
        gridPM.style.display = 'grid';
        gridPM.style.gridTemplateColumns = '1fr 1fr';
        gridPM.style.gap = '10px';

        let inputPadding, inputMargin;

        const colPadding = document.createElement('div');
        const lblPadding = document.createElement('label');
        lblPadding.innerText = 'Padding (T,R,B,L)';
        inputPadding = document.createElement('input');
        inputPadding.type = 'text';
        inputPadding.className = 'prop-input';
        inputPadding.value = paddingValor;
        inputPadding.onchange = (e) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.padding = e.target.value;
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
            window.AppState.canvas.requestRenderAll();
        };
        colPadding.appendChild(lblPadding);
        colPadding.appendChild(inputPadding);

        const colMargin = document.createElement('div');
        const lblMargin = document.createElement('label');
        lblMargin.innerText = 'Margin (T,R,B,L)';
        inputMargin = document.createElement('input');
        inputMargin.type = 'text';
        inputMargin.className = 'prop-input';
        inputMargin.value = marginValor;
        inputMargin.onchange = (e) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.margin = e.target.value;
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
        };
        colMargin.appendChild(lblMargin);
        colMargin.appendChild(inputMargin);

        gridPM.appendChild(colPadding);
        gridPM.appendChild(colMargin);
        filaPM.appendChild(gridPM);
        marqGroup.appendChild(filaPM);

        const defaultSize = `${Math.round(obj.width)}, ${Math.round(obj.height)}`;
        window.addPropInput(marqGroup, 'Tamaño (W, H)', (obj.customProps && obj.customProps.size) || defaultSize, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.size = v;
            const parts = String(v).split(',');
            const w = parseInt(parts[0]);
            if (!isNaN(w) && w > 0) {
                obj.set('width', w);
                if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
                window.AppState.canvas.requestRenderAll();
            }
        });

        window.addPropInput(marqGroup, 'Radio (TL, TR, BR, BL)', (obj.customProps && obj.customProps.radius) || '0, 0, 0, 0', (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
            window.AppState.canvas.requestRenderAll();
        });
    }
});

/**
 * Lógica de superposición (overlay) para Marquesinas
 */
window.updateMarquesinaOverlay = function (base) {
    if (!base || base.elementType !== 'marquesina') return;
    if (!base.__uid) {
        base.__uid = 'mq_' + Math.random().toString(36).substr(2, 9);
    }
    
    let overlay = window.AppState.canvas.getObjects().find(o => o.isMarquesinaOverlay && o.marquesinaId === base.__uid);
    
    let sizeStr = base.customProps && base.customProps.size
        ? String(base.customProps.size)
        : `${Math.round(base.width)}, ${Math.round(base.height)}`;
    
    const parts = sizeStr.split(',');
    const w = parseInt(parts[0]) || base.width;
    const h = parseInt(parts[1] || parts[0]) || base.height;

    const bgColor = base.customProps && base.customProps.bg_color ? base.customProps.bg_color : 'transparent';
    const opacity = base.customProps && base.customProps.transparencia !== undefined ? (1 - base.customProps.transparencia) : 1;
    let radiusStr = base.customProps && base.customProps.radius ? String(base.customProps.radius) : "0";
    let rx = parseInt(radiusStr.split(',')[0]) || 0;

    if (!overlay) {
        overlay = new fabric.Rect({
            left: base.left,
            top: base.top,
            width: w,
            height: h,
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
        overlay.moveTo(window.AppState.canvas.getObjects().indexOf(base));
    } else {
        overlay.set({
            left: base.left,
            top: base.top,
            width: w,
            height: h,
            fill: bgColor,
            opacity: opacity,
            rx: rx,
            ry: rx
        });
    }
    overlay.blockId = base.blockId;
    overlay.setCoords();

    // Máscara de recorte (clipPath)
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
