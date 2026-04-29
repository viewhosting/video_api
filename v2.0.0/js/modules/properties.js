// --- PROPERTIES PANEL ---

window.updateMapImage = function (obj) {
    if (!obj || obj.elementType !== 'mapa') return;
    const cp = obj.customProps || {};
    const lat = cp.lat || 0;
    const lng = cp.lng || 0;
    const zoom = cp.zoom || 15;
    const type = cp.map_type || 'roadmap';
    const provider = cp.provider || 'google'; // google, yandex
    const apiKey = 'AIzaSyDD0onsVecR7aXcELdaTPrPzSvOgm6Ei9I';

    const w = Math.min(Math.round(obj.getScaledWidth()), 640);
    const h = Math.min(Math.round(obj.getScaledHeight()), 640);
    let url = '';

    if (provider === 'yandex') {
        const yType = (type === 'sat' || type === 'satellite') ? 'sat,skl' : 'map';
        url = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=${zoom}&size=${w},${h}&l=${yType}&pt=${lng},${lat},pm2rdm`;
    } else {
        const gType = (type === 'sat' || type === 'satellite') ? 'satellite' : 'roadmap';
        url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&maptype=${gType}&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
    }

    obj.setSrc(url, function () {
        if (!obj.customProps) obj.customProps = {};
        obj.customProps.contenido = url; // Sincronizar para el JSON
        window.AppState.canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
}

window.renderProperties = function (obj) {
    const root = document.getElementById('properties');
    const placeholder = document.getElementById('props-container');

    if (root) {
        root.querySelectorAll('.accordion-section[data-prop-group="true"]').forEach(sec => sec.remove());
    }

    renderBottomActions(obj);

    if (!obj) {
        return;
    }

    // 1. General Info (Info)
    const infoGroup = addGroupHeader(root, 'Info');
    addPropInput(infoGroup, 'Tipo', obj.elementType || obj.type, null, true);
    addPropInput(infoGroup, 'Block ID', obj.blockId, (v) => { obj.blockId = v; updateLayersList(); });

    // 1.1 Configuración de Bloque (Tiempo / Efectos)
    const blockId = obj.blockId || 'bloque_1';
    if (!window.AppState.blockConfigs[blockId]) {
        window.AppState.blockConfigs[blockId] = {
            inicio: '',
            fin: '',
            efecto_inicio: '',
            efecto_fin: '',
            duracion: ''
        };
    }
    const cfg = window.AppState.blockConfigs[blockId];

    const timeGroup = addGroupHeader(root, 'Tiempo / Efectos');
    addPropInput(timeGroup, 'Inicio (seg)', cfg.inicio, (v) => {
        window.AppState.blockConfigs[blockId].inicio = v;
    }, false, 'number');
    addPropInput(timeGroup, 'Fin (seg)', cfg.fin, (v) => {
        window.AppState.blockConfigs[blockId].fin = v;
    }, false, 'number');
    addPropInput(timeGroup, 'Duración (seg)', cfg.duracion, (v) => {
        window.AppState.blockConfigs[blockId].duracion = v;
    }, false, 'number');

    addPropSelect(timeGroup, 'Efecto Inicio', cfg.efecto_inicio || '', ['', 'fade'], (v) => {
        window.AppState.blockConfigs[blockId].efecto_inicio = v;
    });
    addPropSelect(timeGroup, 'Efecto Fin', cfg.efecto_fin || '', ['', 'fade'], (v) => {
        window.AppState.blockConfigs[blockId].efecto_fin = v;
    });

    if (obj.elementType === 'marquesina') {
        updateMarquesinaOverlay(obj);
    }

    // 2. Geometry
    const geomGroup = addGroupHeader(root, 'Geometría');
    const geomGrid = document.createElement('div');
    geomGrid.style.display = 'grid';
    geomGrid.style.gridTemplateColumns = '1fr 1fr';
    geomGrid.style.gap = '10px';
    geomGroup.appendChild(geomGrid);

    addPropInput(geomGrid, 'X', Math.round(obj.left), (v) => { obj.set('left', parseInt(v)); window.AppState.canvas.requestRenderAll(); });
    addPropInput(geomGrid, 'Y', Math.round(obj.top), (v) => { obj.set('top', parseInt(v)); window.AppState.canvas.requestRenderAll(); });
    addPropInput(geomGrid, 'W', (obj.width * obj.scaleX).toFixed(0), (v) => { 
        const val = parseInt(v);
        if (!isNaN(val) && val > 0) {
            obj.set('scaleX', val / obj.width);
            window.AppState.canvas.requestRenderAll();
        }
    });
    addPropInput(geomGrid, 'H', (obj.height * obj.scaleY).toFixed(0), (v) => { 
        const val = parseInt(v);
        if (!isNaN(val) && val > 0) {
            obj.set('scaleY', val / obj.height);
            window.AppState.canvas.requestRenderAll();
        }
    });

    // 2.1 Margin (X, Y) - disponible para todos los elementos
    const marginRow = document.createElement('div');
    marginRow.className = 'prop-row';
    const marginLbl = document.createElement('label');
    marginLbl.innerText = 'Margin (X, Y)';
    const marginInput = document.createElement('input');
    marginInput.type = 'text';
    marginInput.className = 'prop-input';
    marginInput.value = (obj.customProps && obj.customProps.margin) || '0,0';
    marginInput.onchange = (e) => {
        if (!obj.customProps) obj.customProps = {};
        obj.customProps.margin = e.target.value;
    };
    marginRow.appendChild(marginLbl);
    marginRow.appendChild(marginInput);
    geomGroup.appendChild(marginRow);



    // 2.5 Relative Alignment
    const objsInBlock = window.AppState.canvas.getObjects().filter(o => (o.blockId || 'bloque_1') === blockId && !o.isMarquesinaOverlay);
    const index = objsInBlock.indexOf(obj);

    // 2.5 Alignment Controls
    // Determine if this object is the First Element (Reference) or a Subsequent Element
    const refObj = objsInBlock[0]; // Always relative to the first element
    const isFirstElement = (index === 0);

    const alignGroup = addGroupHeader(root, 'Alineación');

    const rowX = document.createElement('div');
    rowX.style.display = 'flex';
    rowX.style.gap = '5px';
    rowX.style.marginBottom = '5px';

    const btnStyle = "padding: 5px; background: #15171c; color: #e2e8f0; border: 1px solid #262a33; cursor: pointer; border-radius: 4px; flex: 1; font-size: 0.75rem;";
    const activeStyle = "padding: 5px; background: #4f46e5; color: #ffffff; border: 1px solid #6366f1; cursor: pointer; border-radius: 4px; flex: 1; font-size: 0.75rem;";

    if (isFirstElement) {
        // --- FIRST ELEMENT ALIGNMENT (TO CANVAS) ---
        // Eje X: Izquierda, Centro, Derecha
        const btnLeftCanvas = document.createElement('button');
        btnLeftCanvas.innerText = "Izquierda";
        btnLeftCanvas.style = (obj.customProps && obj.customProps.alignX === 'left') ? activeStyle : btnStyle;
        btnLeftCanvas.onclick = () => {
            obj.set('left', 0);
            obj.setCoords();
            setAlign(obj, 'alignX', 'left');
        };

        const btnCenterX = document.createElement('button');
        btnCenterX.innerText = "Centro X";
        btnCenterX.style = (obj.customProps && obj.customProps.alignX === 'center') ? activeStyle : btnStyle;
        btnCenterX.onclick = () => {
            obj.centerH();
            obj.setCoords();
            setAlign(obj, 'alignX', 'center');
        };

        const btnRightCanvas = document.createElement('button');
        btnRightCanvas.innerText = "Derecha";
        btnRightCanvas.style = (obj.customProps && obj.customProps.alignX === 'right') ? activeStyle : btnStyle;
        btnRightCanvas.onclick = () => {
            const newLeft = window.AppState.canvas.width - obj.getScaledWidth();
            obj.set('left', newLeft);
            obj.setCoords();
            setAlign(obj, 'alignX', 'right');
        };

        rowX.appendChild(btnLeftCanvas);
        rowX.appendChild(btnCenterX);
        rowX.appendChild(btnRightCanvas);
        alignGroup.appendChild(rowX);

        // Eje Y: Arriba, Centro, Abajo
        const rowYCanvas = document.createElement('div');
        rowYCanvas.style.display = 'flex';
        rowYCanvas.style.gap = '5px';
        rowYCanvas.style.marginBottom = '10px';

        const btnTopCanvas = document.createElement('button');
        btnTopCanvas.innerText = "Arriba";
        btnTopCanvas.style = (obj.customProps && obj.customProps.alignY === 'top') ? activeStyle : btnStyle;
        btnTopCanvas.onclick = () => {
            obj.set('top', 0);
            obj.setCoords();
            setAlign(obj, 'alignY', 'top');
        };

        const btnCenterY = document.createElement('button');
        btnCenterY.innerText = "Centro Y";
        btnCenterY.style = (obj.customProps && obj.customProps.alignY === 'center') ? activeStyle : btnStyle;
        btnCenterY.onclick = () => {
            obj.centerV();
            obj.setCoords();
            setAlign(obj, 'alignY', 'center');
        };

        const btnBottomCanvas = document.createElement('button');
        btnBottomCanvas.innerText = "Abajo";
        btnBottomCanvas.style = (obj.customProps && obj.customProps.alignY === 'bottom') ? activeStyle : btnStyle;
        btnBottomCanvas.onclick = () => {
            const newTop = window.AppState.canvas.height - obj.getScaledHeight();
            obj.set('top', newTop);
            obj.setCoords();
            setAlign(obj, 'alignY', 'bottom');
        };

        rowYCanvas.appendChild(btnTopCanvas);
        rowYCanvas.appendChild(btnCenterY);
        rowYCanvas.appendChild(btnBottomCanvas);
        alignGroup.appendChild(rowYCanvas);

        const btnMan = document.createElement('button');
        btnMan.innerText = "Desvincular Alineación";
        btnMan.style = "width: 100%; padding: 6px 8px; background: #020617; color: #94a3b8; border: 1px dashed #262a33; cursor: pointer; border-radius: 8px; font-size: 0.7rem;";
        btnMan.onclick = () => {
            if (obj.customProps) {
                delete obj.customProps.alignX;
                delete obj.customProps.alignY;
            }
            renderProperties(obj);
        };
        alignGroup.appendChild(btnMan);

    } else {
        // --- SUBSEQUENT ELEMENT ALIGNMENT (RELATIVE TO 1ST) ---

        // Left
        const btnLeft = document.createElement('button');
        btnLeft.innerText = "Izquierda";
        btnLeft.style = (obj.customProps && obj.customProps.alignX === 'left') ? activeStyle : btnStyle;
        btnLeft.onclick = () => {
            obj.set('left', refObj.left);
            obj.setCoords();
            setAlign(obj, 'alignX', 'left');
        };

        // Center X
        const btnCenterX = document.createElement('button');
        btnCenterX.innerText = "Centro X";
        btnCenterX.style = (obj.customProps && obj.customProps.alignX === 'center') ? activeStyle : btnStyle;
        btnCenterX.onclick = () => {
            const refCenter = refObj.left + (refObj.getScaledWidth() / 2);
            const newLeft = refCenter - (obj.getScaledWidth() / 2);
            obj.set('left', newLeft);
            obj.setCoords();
            setAlign(obj, 'alignX', 'center');
        };

        // Right
        const btnRight = document.createElement('button');
        btnRight.innerText = "Derecha";
        btnRight.style = (obj.customProps && obj.customProps.alignX === 'right') ? activeStyle : btnStyle;
        btnRight.onclick = () => {
            const refRight = refObj.left + refObj.getScaledWidth();
            const newLeft = refRight - obj.getScaledWidth();
            obj.set('left', newLeft);
            obj.setCoords();
            setAlign(obj, 'alignX', 'right');
        };

        rowX.appendChild(btnLeft);
        rowX.appendChild(btnCenterX);
        rowX.appendChild(btnRight);
        alignGroup.appendChild(rowX);

        // --- Y Axis ---
        const rowY = document.createElement('div');
        rowY.style.display = 'flex';
        rowY.style.gap = '5px';
        rowY.style.marginBottom = '10px';

        // Top
        const btnTop = document.createElement('button');
        btnTop.innerText = "Arriba";
        btnTop.style = (obj.customProps && obj.customProps.alignY === 'top') ? activeStyle : btnStyle;
        btnTop.onclick = () => {
            obj.set('top', refObj.top);
            obj.setCoords();
            setAlign(obj, 'alignY', 'top');
        };

        // Center Y
        const btnCenterY = document.createElement('button');
        btnCenterY.innerText = "Centro Y";
        btnCenterY.style = (obj.customProps && obj.customProps.alignY === 'center') ? activeStyle : btnStyle;
        btnCenterY.onclick = () => {
            const refCenter = refObj.top + (refObj.getScaledHeight() / 2);
            const newTop = refCenter - (obj.getScaledHeight() / 2);
            obj.set('top', newTop);
            obj.setCoords();
            setAlign(obj, 'alignY', 'center');
        };

        // Bottom
        const btnBottom = document.createElement('button');
        btnBottom.innerText = "Abajo";
        btnBottom.style = (obj.customProps && obj.customProps.alignY === 'bottom') ? activeStyle : btnStyle;
        btnBottom.onclick = () => {
            const refBottom = refObj.top + refObj.getScaledHeight();
            const newTop = refBottom - obj.getScaledHeight();
            obj.set('top', newTop);
            obj.setCoords();
            setAlign(obj, 'alignY', 'bottom');
        };

        rowY.appendChild(btnTop);
        rowY.appendChild(btnCenterY);
        rowY.appendChild(btnBottom);
        alignGroup.appendChild(rowY);

        // Manual Reset
        const btnMan = document.createElement('button');
        btnMan.innerText = "Desvincular Alineación";
        btnMan.style = "width: 100%; padding: 5px; background: #444; color: #aaa; border: 1px dashed #666; cursor: pointer; border-radius: 4px; font-size: 0.75rem;";
        btnMan.onclick = () => {
            if (obj.customProps) {
                delete obj.customProps.alignX;
                delete obj.customProps.alignY;
            }
            renderProperties(obj);
        };
        alignGroup.appendChild(btnMan);
    }

    function setAlign(obj, prop, val) {
        if (!obj.customProps) obj.customProps = {};
        obj.customProps[prop] = val;
        window.AppState.canvas.requestRenderAll();
        renderProperties(obj);
    }

    // 3. Appearance
    const appearanceGroup = addGroupHeader(root, 'Apariencia');
    addPropRange(appearanceGroup, 'Opacidad', obj.opacity, 0, 1, 0.1, (v) => { obj.set('opacity', parseFloat(v)); window.AppState.canvas.requestRenderAll(); });

    // 4. Propiedades específicas por tipo
    const propsGroup = addGroupHeader(root, 'Propiedades');

    // Marquesina Specific
    if (obj.elementType === 'marquesina') {
        const marqGroup = document.createElement('div');
        marqGroup.className = 'prop-card-body';
        propsGroup.appendChild(marqGroup);

        addPropInput(marqGroup, 'Velocidad (px/s)', (obj.customProps && obj.customProps.velocidad) || 100, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.velocidad = parseInt(v);
            window.AppState.canvas.requestRenderAll();
        });

        addPropColor(marqGroup, 'Color del Texto (Letra)', obj.fill || '#FFFFFF', (v) => {
            obj.set('fill', v);
            window.AppState.canvas.requestRenderAll();
        });

        addPropColor(marqGroup, 'Fondo Texto (Letras)', obj.backgroundColor || '', (v) => {
            obj.set('backgroundColor', v);
            window.AppState.canvas.requestRenderAll();
        });

        addPropColor(marqGroup, 'Color Fondo (Contenedor)', (obj.customProps && obj.customProps.bg_color) || '', (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.bg_color = v;
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
            window.AppState.canvas.requestRenderAll();
        });

        addPropRange(marqGroup, 'Transparencia Total', (obj.customProps && obj.customProps.transparencia) || 0, 0, 1, 0.1, (v) => {
            if (!obj.customProps) obj.customProps = {};
            const val = parseFloat(v);
            obj.customProps.transparencia = val;
            obj.set('opacity', 1 - val);
            if (window.updateMarquesinaOverlay) window.updateMarquesinaOverlay(obj);
            window.AppState.canvas.requestRenderAll();
        });

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
            actualizarPreviewPM();
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
            actualizarPreviewPM();
        };
        colMargin.appendChild(lblMargin);
        colMargin.appendChild(inputMargin);

        gridPM.appendChild(colPadding);
        gridPM.appendChild(colMargin);

        const previewPM = document.createElement('div');
        previewPM.style.marginTop = '6px';
        previewPM.style.fontSize = '0.7rem';
        previewPM.style.color = '#aaa';

        function normalizarTRBL(str) {
            const partes = String(str || '').split(',').map(p => parseInt(p.trim()));
            const t = !isNaN(partes[0]) ? partes[0] : 0;
            const r = !isNaN(partes[1]) ? partes[1] : t;
            const b = !isNaN(partes[2]) ? partes[2] : t;
            const l = !isNaN(partes[3]) ? partes[3] : r;
            return { t, r, b, l };
        }

        function actualizarPreviewPM() {
            const p = normalizarTRBL(inputPadding.value);
            const m = normalizarTRBL(inputMargin.value);
            previewPM.innerText = `Padding: T=${p.t}, R=${p.r}, B=${p.b}, L=${p.l}   |   Margin: T=${m.t}, R=${m.r}, B=${m.b}, L=${m.l}`;
        }

        actualizarPreviewPM();

        filaPM.appendChild(gridPM);
        filaPM.appendChild(previewPM);
        marqGroup.appendChild(filaPM);

        // Tamaño del contenedor (marquesina es un rectángulo)
        const defaultSize = `${Math.round(obj.width)}, ${Math.round(obj.height)}`;
        addPropInput(marqGroup, 'Tamaño (W, H)', (obj.customProps && obj.customProps.size) || defaultSize, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.size = v;
            // Vista previa: ajustar ancho del textbox
            const parts = String(v).split(',');
            const w = parseInt(parts[0]);
            if (!isNaN(w) && w > 0) {
                obj.set('width', w);
                window.AppState.canvas.requestRenderAll();
            }
        });

        // Margen del contenedor
        // Radio por esquina del contenedor
        addPropInput(marqGroup, 'Radio (TL, TR, BR, BL)', (obj.customProps && obj.customProps.radius) || '0, 0, 0, 0', (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
        });
    } else if (obj.elementType === 'video') {
        const videoGroup = document.createElement('div');
        videoGroup.className = 'prop-card-body';
        propsGroup.appendChild(videoGroup);

        addPropInput(videoGroup, 'URL Video', (obj.customProps && obj.customProps.contenido) || '', (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.contenido = v;
        });

        const vidRadius = (obj.customProps && obj.customProps.radius) ? obj.customProps.radius : 0;
        addPropInput(videoGroup, 'Redondeo Video', vidRadius, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
        });

        const padVal = (obj.customProps && obj.customProps.padding) || '10,10';
        addPropInput(videoGroup, 'Padding (X,Y)', padVal, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.padding = v;
        });

        const marginValVideo = (obj.customProps && obj.customProps.margin) || '10,10';
        addPropInput(videoGroup, 'Margin (X,Y)', marginValVideo, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.margin = v;
        });
    } else if (obj.elementType === 'mapa') {
        const mapGroup = document.createElement('div');
        mapGroup.className = 'prop-card-body';
        propsGroup.appendChild(mapGroup);

        addPropInput(mapGroup, 'Latitud (GPS)', obj.customProps.lat || 0, (v) => {
            obj.customProps.lat = parseFloat(v);
            window.updateMapImage(obj);
        }, false, 'number');

        addPropInput(mapGroup, 'Longitud (GPS)', obj.customProps.lng || 0, (v) => {
            obj.customProps.lng = parseFloat(v);
            window.updateMapImage(obj);
        }, false, 'number');

        addPropRange(mapGroup, 'Zoom', obj.customProps.zoom || 15, 1, 21, 1, (v) => {
            obj.customProps.zoom = parseInt(v);
            window.updateMapImage(obj);
        });

        addPropSelect(mapGroup, 'Tipo Mapa', obj.customProps.map_type || 'map', ['map', 'sat'], (v) => {
            obj.customProps.map_type = v;
            window.updateMapImage(obj);
        });

        addPropSelect(mapGroup, 'Proveedor', obj.customProps.provider || 'google', ['google', 'yandex'], (v) => {
            obj.customProps.provider = v;
            window.updateMapImage(obj);
        });

        addPropInput(mapGroup, 'Redondeo', obj.customProps.radius || 0, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
            const r = parseInt(v) || 0;
            
            if (r > 0) {
                obj.clipPath = new fabric.Rect({
                    left: -obj.width / 2,
                    top: -obj.height / 2,
                    width: obj.width,
                    height: obj.height,
                    rx: r, ry: r,
                    absolutePositioned: false
                });
            } else {
                obj.clipPath = null;
            }
            obj.dirty = true;
            window.AppState.canvas.requestRenderAll();
        });
    }

    // Texto Dos Columnas
    if (obj.elementType === 'texto_dos_columnas') {
        const twoColGroup = addGroupHeader(root, 'Texto Dos Columnas');
        if (!obj.customProps) obj.customProps = {};

        addPropInput(twoColGroup, 'Split %', obj.customProps.split_pct ?? 50, (v) => {
            obj.customProps.split_pct = parseInt(v) || 50;
        });
        addPropInput(twoColGroup, 'Gap', obj.customProps.gap ?? 0, (v) => {
            obj.customProps.gap = parseInt(v) || 0;
        });
        addPropSelect(twoColGroup, 'Divisor', (obj.customProps.divisor ? 'true' : 'false'), ['false', 'true'], (v) => {
            obj.customProps.divisor = (v === 'true');
        });
        addPropInput(twoColGroup, 'Divisor Width', obj.customProps.divisor_width ?? 2, (v) => {
            obj.customProps.divisor_width = parseInt(v) || 2;
        });

        // Columna 1
        const col1Group = addGroupHeader(root, 'Columna 1');
        addPropInput(col1Group, 'Contenido', obj.customProps.col1_contenido || '', (v) => {
            obj.customProps.col1_contenido = v;
        }, false, 'textarea');
        addPropSelect(col1Group, 'Alineación', obj.customProps.col1_align || 'left', ['left', 'center', 'right'], (v) => {
            obj.customProps.col1_align = v;
        });
        addPropInput(col1Group, 'Tamaño Texto', obj.customProps.col1_size_texto ?? 24, (v) => {
            obj.customProps.col1_size_texto = parseInt(v) || 24;
        });
        addPropColor(col1Group, 'Color', obj.customProps.col1_color || '#FFFFFF', (v) => {
            obj.customProps.col1_color = v;
        });
        addPropSelect(col1Group, 'Tipografía', obj.customProps.col1_tipografia || 'montserrat', AVAILABLE_FONTS, (v) => {
            obj.customProps.col1_tipografia = v;
        });
        addPropSelect(col1Group, 'Peso', obj.customProps.col1_peso || 'bold', ['thin', 'bold', 'extrabold'], (v) => {
            obj.customProps.col1_peso = v;
        });
        addPropInput(col1Group, 'Borde Grosor', obj.customProps.col1_borde_grosor ?? 0, (v) => {
            obj.customProps.col1_borde_grosor = parseInt(v) || 0;
        });
        addPropColor(col1Group, 'Borde Color', obj.customProps.col1_borde_color || '#000000', (v) => {
            obj.customProps.col1_borde_color = v;
        });

        // Columna 2
        const col2Group = addGroupHeader(root, 'Columna 2');
        addPropInput(col2Group, 'Contenido', obj.customProps.col2_contenido || '', (v) => {
            obj.customProps.col2_contenido = v;
        }, false, 'textarea');
        addPropSelect(col2Group, 'Alineación', obj.customProps.col2_align || 'left', ['left', 'center', 'right'], (v) => {
            obj.customProps.col2_align = v;
        });
        addPropInput(col2Group, 'Tamaño Texto', obj.customProps.col2_size_texto ?? 18, (v) => {
            obj.customProps.col2_size_texto = parseInt(v) || 18;
        });
        addPropColor(col2Group, 'Color', obj.customProps.col2_color || '#FFFFFF', (v) => {
            obj.customProps.col2_color = v;
        });
        addPropSelect(col2Group, 'Tipografía', obj.customProps.col2_tipografia || 'montserrat', AVAILABLE_FONTS, (v) => {
            obj.customProps.col2_tipografia = v;
        });
        addPropSelect(col2Group, 'Peso', obj.customProps.col2_peso || 'bold', ['thin', 'bold', 'extrabold'], (v) => {
            obj.customProps.col2_peso = v;
        });
        addPropInput(col2Group, 'Borde Grosor', obj.customProps.col2_borde_grosor ?? 0, (v) => {
            obj.customProps.col2_borde_grosor = parseInt(v) || 0;
        });
        addPropColor(col2Group, 'Borde Color', obj.customProps.col2_borde_color || '#000000', (v) => {
            obj.customProps.col2_borde_color = v;
        });
    }

    // Rect Radius
    if (obj.type === 'rect') {
        const currentRadius = (obj.customProps && obj.customProps.radius) ? obj.customProps.radius : (obj.rx || 0);

        addPropInput(appearanceGroup, 'Redondeo (TL, TR, BR, BL)', currentRadius, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;

            // Simple visual approximation for editor (max radius)
            const parts = String(v).split(',').map(p => parseInt(p.trim()));
            const maxR = parts.length > 0 ? Math.max(...parts.filter(n => !isNaN(n))) : 0;

            obj.set({ rx: maxR, ry: maxR });
            window.AppState.canvas.requestRenderAll();
        });
    } else if (obj.type === 'image') {
        // Redondeo para Imagen (solo se guarda en customProps.radius)
        const imgRadius = (obj.customProps && obj.customProps.radius) ? obj.customProps.radius : 0;
        addPropInput(appearanceGroup, 'Redondeo Imagen', imgRadius, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
        });
    }

    if (obj.type === 'rect' || obj.type === 'textbox' || obj.type === 'text') {
        const fillRow = document.createElement('div');
        fillRow.className = 'prop-row';
        appearanceGroup.appendChild(fillRow);

        addPropColor(fillRow, 'Color Relleno', typeof obj.fill === 'string' ? obj.fill : '#FFFFFF', (v) => {
            obj.set('fill', v);
            if (obj.customProps) delete obj.customProps.gradient_cfg;
            window.AppState.canvas.requestRenderAll();
        });

        // Gradient Option for Rectangles
        if (obj.type === 'rect') {
            const gradToggleRow = document.createElement('div');
            gradToggleRow.className = 'prop-row';
            gradToggleRow.style.marginTop = '-5px';
            gradToggleRow.style.marginBottom = '10px';

            const gradLbl = document.createElement('label');
            gradLbl.innerText = 'Usar Degradado';
            gradLbl.style.fontSize = '0.7rem';

            const gradCheck = document.createElement('input');
            gradCheck.type = 'checkbox';
            gradCheck.checked = !!(obj.customProps && obj.customProps.gradient_cfg);

            gradToggleRow.appendChild(gradCheck);
            gradToggleRow.appendChild(gradLbl);
            appearanceGroup.appendChild(gradToggleRow);

            const gradContainer = document.createElement('div');
            appearanceGroup.appendChild(gradContainer);

            function applyFabricGradient(cfg) {
                const isVertical = cfg.orientation === 'vertical';
                const mid = (cfg.midpoint || 50) / 100;

                const normalizeColor = (c) => {
                    if (!c) return 'rgba(255,255,255,1)';
                    if (c.startsWith('rgb')) return c;
                    try { return new fabric.Color(c).toRgba(); } catch (e) { return c; }
                };

                const c1 = normalizeColor(cfg.color1);
                const c2 = normalizeColor(cfg.color2);

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
                const x1 = obj.originX === 'center' ? -w / 2 : 0;
                const x2 = obj.originX === 'center' ? w / 2 : w;
                const y1 = obj.originY === 'center' ? -h / 2 : 0;
                const y2 = obj.originY === 'center' ? h / 2 : h;

                const coords = isVertical
                    ? { x1: 0, y1: y1, x2: 0, y2: y2 }
                    : { x1: x1, y1: 0, x2: x2, y2: 0 };

                const grad = new fabric.Gradient({
                    type: 'linear',
                    gradientUnits: 'pixels',
                    coords: coords,
                    colorStops: [
                        { offset: 0, color: c1 },
                        { offset: mid, color: cMid },
                        { offset: 1, color: c2 }
                    ]
                });

                obj.set('fill', grad);
                if (!obj.customProps) obj.customProps = {};
                obj.customProps.gradient_cfg = cfg;
                window.AppState.canvas.requestRenderAll();
            }

            const renderGradUI = () => {
                gradContainer.innerHTML = '';
                if (gradCheck.checked) {
                    const cfg = (obj.customProps && obj.customProps.gradient_cfg) || {
                        color1: '#FFFFFF',
                        color2: '#000000',
                        orientation: 'vertical',
                        midpoint: 50
                    };
                    addPropGradient(gradContainer, 'Ajustes de Degradado', cfg, (newCfg) => {
                        applyFabricGradient(newCfg);
                    });
                    // Initial apply if just checked
                    if (!obj.customProps || !obj.customProps.gradient_cfg) {
                        applyFabricGradient(cfg);
                    }
                } else {
                    // Revert to solid if was gradient
                    if (obj.customProps && obj.customProps.gradient_cfg) {
                        delete obj.customProps.gradient_cfg;
                        obj.set('fill', '#FFFFFF');
                        window.AppState.canvas.requestRenderAll();
                    }
                }
            };

            gradCheck.onchange = renderGradUI;
            if (gradCheck.checked) renderGradUI();
        }
    }

    if ((obj.type === 'textbox' || obj.type === 'text') && obj.elementType !== 'texto_varias_columnas') {
        addPropColor(appearanceGroup, 'Fondo Texto', obj.backgroundColor || '', (v) => { obj.set('backgroundColor', v); window.AppState.canvas.requestRenderAll(); });

        // Text Box Radius (Custom Prop for Backend)
        addPropInput(appearanceGroup, 'Redondeo Fondo', (obj.customProps && obj.customProps.radius) || 0, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = parseInt(v);
        });
    }

    // 4. Text Specific
    const isNCols = obj.elementType === 'texto_varias_columnas' || (obj.customProps && obj.customProps.tipo === 'texto_varias_columnas');

    if (isNCols) {
        const ncolTextGroup = document.createElement('div');
        ncolTextGroup.className = 'prop-card-body';
        propsGroup.appendChild(ncolTextGroup);

        if (!obj.customProps) obj.customProps = {};

        const interVal = (obj.customProps && obj.customProps.interlineado) || 5;
        addPropInput(ncolTextGroup, 'Interlineado', interVal, (v) => {
            if (!obj.customProps) obj.customProps = {};
            const num = parseFloat(v) || 0;
            obj.customProps.interlineado = num;
            obj.set('lineHeight', num);
            window.AppState.canvas.requestRenderAll();
        });

        const gapVal = (obj.customProps && obj.customProps.gap) || 0;
        addPropInput(ncolTextGroup, 'Gap Columnas', gapVal, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.gap = parseInt(v) || 0;
            window.AppState.canvas.requestRenderAll();
        });

        const padVal = (obj.customProps && obj.customProps.padding) || '0';
        addPropInput(ncolTextGroup, 'Padding (T,R,B,L)', padVal, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.padding = v;
            window.AppState.canvas.requestRenderAll();
        });

        const defaultSize = `${Math.round(obj.width)}, ${Math.round(obj.height)}`;
        addPropInput(ncolTextGroup, 'Tamaño (W, H)', (obj.customProps && obj.customProps.size) || defaultSize, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.size = v;
            const parts = String(v).split(',');
            const w = parseInt(parts[0]);
            if (!isNaN(w) && w > 0) {
                obj.set('width', w);
                window.AppState.canvas.requestRenderAll();
            }
        });

        const bordeVal = (obj.customProps && obj.customProps.borde_grosor) || 0;
        addPropInput(ncolTextGroup, 'Borde Grosor', bordeVal, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.borde_grosor = parseInt(v) || 0;
            window.AppState.canvas.requestRenderAll();
        });

        const ncolColsGroup = document.createElement('div');
        ncolColsGroup.className = 'prop-card-body';
        propsGroup.appendChild(ncolColsGroup);

        if (!Array.isArray(obj.customProps.columnas)) {
            obj.customProps.columnas = [];
        }
        const cols = obj.customProps.columnas;

        const colsContainer = document.createElement('div');
        colsContainer.style.display = 'flex';
        colsContainer.style.flexDirection = 'column';
        colsContainer.style.gap = '8px';
        ncolColsGroup.appendChild(colsContainer);

        cols.forEach((col, idx) => {
            if (!col) col = {};
            const card = document.createElement('div');
            card.style.border = '1px solid #262a33';
            card.style.borderRadius = '10px';
            card.style.padding = '8px 10px 10px';
            card.style.background = '#020617';
            card.style.boxShadow = '0 14px 30px rgba(0,0,0,0.7)';

            const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.marginBottom = '6px';

            const title = document.createElement('div');
            title.style.fontSize = '0.7rem';
            title.style.color = '#94a3b8';
            title.style.textTransform = 'uppercase';
            title.style.letterSpacing = '0.12em';
            title.innerText = `Columna ${idx + 1}`;

            const delBtn = document.createElement('button');
            delBtn.innerText = 'Eliminar';
            delBtn.style = 'padding: 3px 8px; font-size: 0.65rem; background:#111827; color:#fca5a5; border:1px solid #ef4444; border-radius:999px; cursor:pointer;';
            delBtn.onclick = () => {
                cols.splice(idx, 1);
                window.AppState.canvas.requestRenderAll();
                renderProperties(obj);
            };

            headerRow.appendChild(title);
            headerRow.appendChild(delBtn);
            card.appendChild(headerRow);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gap = '8px';
            card.appendChild(grid);

            addPropInput(grid, 'Ancho (% o px)', col.width || '', (v) => {
                col.width = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropSelect(grid, 'Alineación', col.alineacion || 'center', ['left', 'center', 'right'], (v) => {
                col.alineacion = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropColor(grid, 'Color', col.color || '#FFFFFF', (v) => {
                col.color = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropSelect(grid, 'Tipografía', col.tipografia || 'montserrat', AVAILABLE_FONTS, (v) => {
                col.tipografia = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropInput(grid, 'Tamaño Fuente', col.size_texto || 18, (v) => {
                col.size_texto = parseInt(v) || 0;
                window.AppState.canvas.requestRenderAll();
            });

            addPropSelect(grid, 'Peso', col.peso || 'bold', ['thin', 'light', 'regular', 'medium', 'bold', 'extrabold', 'black'], (v) => {
                col.peso = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropColor(card, 'Color Fondo', col.bg_color || '', (v) => {
                col.bg_color = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropRange(card, 'Transparencia Fondo', col.bg_transparencia != null ? col.bg_transparencia : 0, 0, 1, 0.05, (v) => {
                col.bg_transparencia = parseFloat(v) || 0;
                window.AppState.canvas.requestRenderAll();
            });

            // --- BORDES POR COLUMNA ---
            const borderSection = document.createElement('div');
            borderSection.style.marginTop = '8px';
            borderSection.style.paddingTop = '8px';
            borderSection.style.borderTop = '1px dashed #262a33';
            card.appendChild(borderSection);

            const borderGrid = document.createElement('div');
            borderGrid.style.display = 'grid';
            borderGrid.style.gridTemplateColumns = '1fr 1fr';
            borderGrid.style.gap = '8px';
            borderSection.appendChild(borderGrid);

            addPropInput(borderGrid, 'Grosor Borde', col.borde_grosor || 0, (v) => {
                col.borde_grosor = parseInt(v) || 0;
                window.AppState.canvas.requestRenderAll();
            });

            addPropColor(borderGrid, 'Color Borde', col.borde_color || '#FFFFFF', (v) => {
                col.borde_color = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropRange(borderSection, 'Transparencia Borde', col.borde_transparencia != null ? col.borde_transparencia : 1, 0, 1, 0.05, (v) => {
                col.borde_transparencia = parseFloat(v) || 0;
                window.AppState.canvas.requestRenderAll();
            });

            addPropInput(borderSection, 'Lados (T,R,B,L)', col.borde_lados || 'all', (v) => {
                col.borde_lados = v;
                window.AppState.canvas.requestRenderAll();
            });

            addPropInput(card, 'Texto', col.contenido || '', (v) => {
                col.contenido = v;
                window.AppState.canvas.requestRenderAll();
            }, false, 'textarea');

            colsContainer.appendChild(card);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.style.marginTop = '8px';
        addBtn.style.width = '100%';
        addBtn.innerText = 'Agregar Columna';
        addBtn.onclick = () => {
            obj.customProps.columnas.push({
                contenido: '',
                width: '20%',
                alineacion: 'center',
                color: '#FFFFFF',
                tipografia: 'montserrat',
                size_texto: 18,
                peso: 'extrabold'
            });
            window.AppState.canvas.requestRenderAll();
            renderProperties(obj);
        };
        propsGroup.appendChild(addBtn);
    } else if (obj.type === 'textbox' || obj.type === 'text') {
        // Texto normal / marquesina
        addPropInput(propsGroup, 'Contenido', obj.text, (v) => { obj.set('text', v); window.AppState.canvas.requestRenderAll(); }, false, 'textarea');

        if (obj.type === 'textbox') {
            let widthVal = obj.width;
            let readOnlyWidth = false;

            if (refObj && obj !== refObj && refObj.type === 'rect') {
                widthVal = Math.round(refObj.getScaledWidth());
                obj.set('width', widthVal);
                obj.setCoords();
                window.AppState.canvas.requestRenderAll();
                readOnlyWidth = true;
            }

            addPropInput(propsGroup, 'Ancho Caja', widthVal, (v) => {
                if (readOnlyWidth) return;
                obj.set('width', parseInt(v));
                window.AppState.canvas.requestRenderAll();
            }, readOnlyWidth);
        }

        const tipGrid = document.createElement('div');
        tipGrid.style.display = 'grid';
        tipGrid.style.gridTemplateColumns = '1fr 1fr';
        tipGrid.style.gap = '10px';
        propsGroup.appendChild(tipGrid);

        addPropSelect(tipGrid, 'Tipografía', obj.fontFamily, AVAILABLE_FONTS, (v) => {
            const normFamily = window.normalizeCssFamily ? window.normalizeCssFamily(v) : v;
            if (window.ensureFontLoaded) {
                window.ensureFontLoaded(normFamily, obj.fontWeight).then(() => {
                    obj.set('fontFamily', normFamily);
                    obj.initDimensions();
                    obj.setCoords();
                    window.AppState.canvas.requestRenderAll();
                });
            } else {
                obj.set('fontFamily', normFamily);
                obj.initDimensions();
                window.AppState.canvas.requestRenderAll();
            }
        });

        addPropSelect(tipGrid, 'Peso', obj.fontWeight, ['thin', 'light', 'regular', 'medium', 'bold', 'extrabold', 'black'], (v) => {
            const map = { 'thin': 100, 'light': 300, 'regular': 400, 'medium': 500, 'bold': 700, 'extrabold': 800, 'black': 900 };
            const wNum = map[String(v).toLowerCase()] || 400;
            obj.set('fontWeight', wNum);
            if (window.ensureFontLoaded) {
                window.ensureFontLoaded(obj.fontFamily, wNum).then(() => {
                    obj.initDimensions();
                    obj.setCoords();
                    window.AppState.canvas.requestRenderAll();
                });
            } else {
                obj.initDimensions();
                window.AppState.canvas.requestRenderAll();
            }
        });

        const alignVal = (obj.customProps && obj.customProps.alineacion) || obj.textAlign || 'left';
        addPropSelect(propsGroup, 'Alineación texto', alignVal, ['left', 'center', 'right'], (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.alineacion = v;
            obj.set('textAlign', v);
            window.AppState.canvas.requestRenderAll();
        });

        const typoGrid2 = document.createElement('div');
        typoGrid2.style.display = 'grid';
        typoGrid2.style.gridTemplateColumns = '1fr 1fr';
        typoGrid2.style.gap = '10px';
        propsGroup.appendChild(typoGrid2);

        addPropInput(typoGrid2, 'Tamaño Fuente', obj.fontSize, (v) => { obj.set('fontSize', parseInt(v)); window.AppState.canvas.requestRenderAll(); });
        addPropInput(typoGrid2, 'Espaciado Letras', obj.charSpacing || 0, (v) => { obj.set('charSpacing', parseInt(v)); window.AppState.canvas.requestRenderAll(); });

        addPropInput(propsGroup, 'Interlineado', obj.lineHeight || 1, (v) => { obj.set('lineHeight', parseFloat(v)); window.AppState.canvas.requestRenderAll(); });

        // Borde de Texto (stroke)
        const borderGrid = document.createElement('div');
        borderGrid.style.display = 'grid';
        borderGrid.style.gridTemplateColumns = '1fr 1fr';
        borderGrid.style.gap = '10px';
        propsGroup.appendChild(borderGrid);

        const bordeG = (obj.customProps && obj.customProps.borde_grosor) || 0;
        addPropInput(borderGrid, 'Borde Grosor', bordeG, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.borde_grosor = parseInt(v) || 0;
        });
        const bordeC = (obj.customProps && obj.customProps.borde_color) || '#000000';
        addPropColor(borderGrid, 'Borde Color', bordeC, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.borde_color = v;
        });
    }

    const shadowGroup = addGroupHeader(root, 'Sombras');
    let sBlur = 0;
    let sX = 0;
    let sY = 0;
    let sColor = '#000000';
    if (obj.customProps && obj.customProps.sombra) {
        const raw = String(obj.customProps.sombra || '');
        const parts = raw.split(',').map(p => p.trim());
        if (parts[0]) {
            const n = parseInt(parts[0]);
            if (!isNaN(n)) sBlur = n;
        }
        if (parts[1]) {
            const n = parseInt(parts[1]);
            if (!isNaN(n)) sX = n;
        }
        if (parts[2]) {
            const n = parseInt(parts[2]);
            if (!isNaN(n)) sY = n;
        }
        if (parts[3]) {
            sColor = parts[3];
        }
    }
    function applyFabricShadow() {
        if (sBlur === 0 && sX === 0 && sY === 0) {
            obj.set('shadow', null);
            return;
        }

        // Ensure object caching is off for better shadow refresh on texts
        if (obj.type === 'textbox' || obj.type === 'text') {
            obj.set('objectCaching', false);
        }

        obj.set('shadow', new fabric.Shadow({
            color: sColor,
            blur: sBlur,
            offsetX: sX,
            offsetY: sY
        }));

        obj.set('dirty', true);
    }
    function updateShadowProp() {
        if (!obj.customProps) obj.customProps = {};
        obj.customProps.sombra = sBlur + ', ' + sX + ', ' + sY + ', ' + sColor;
        applyFabricShadow();
        window.AppState.canvas.requestRenderAll();
    }
    applyFabricShadow();
    addPropInput(shadowGroup, 'Blur', sBlur, (v) => {
        const n = parseInt(v);
        sBlur = isNaN(n) ? 0 : n;
        updateShadowProp();
    }, false, 'number');
    addPropInput(shadowGroup, 'Offset X', sX, (v) => {
        const n = parseInt(v);
        sX = isNaN(n) ? 0 : n;
        updateShadowProp();
    }, false, 'number');
    addPropInput(shadowGroup, 'Offset Y', sY, (v) => {
        const n = parseInt(v);
        sY = isNaN(n) ? 0 : n;
        updateShadowProp();
    }, false, 'number');
    addPropColor(shadowGroup, 'Color Sombra', sColor, (v) => {
        sColor = v;
        updateShadowProp();
    });

}

window.setWorkspaceZoom = function (scale) {
    window.AppState.workspaceZoom = scale;
    const wrap = document.getElementById('canvas-wrapper');
    if (!wrap) return;
    wrap.style.transformOrigin = 'center center';
    wrap.style.transform = 'scale(' + scale + ')';
}

window.renderBottomActions = function (obj) {
    const holder = document.getElementById('props-container');
    if (!holder) return;
    holder.innerHTML = '';

    const btnJson = document.createElement('button');
    btnJson.className = 'btn btn-secondary';
    btnJson.style.width = '100%';
    btnJson.innerHTML = '<i class="fas fa-code"></i> Cargar JSON';
    btnJson.onclick = () => {
        showJsonModal();
    };
    holder.appendChild(btnJson);

    const btnGen = document.createElement('button');
    btnGen.className = 'btn';
    btnGen.style.marginTop = '8px';
    btnGen.style.width = '100%';
    btnGen.innerHTML = '<i class="fas fa-broadcast-tower"></i> Generar / Exportar';
    btnGen.onclick = () => {
        if (window.generateVideoRouter) {
            window.generateVideoRouter();
        } else if (window.generateRemote) {
            window.generateRemote();
        }
    };
    holder.appendChild(btnGen);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.style.marginTop = '8px';
    btnDel.style.width = '100%';
    btnDel.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
    if (!obj) {
        btnDel.disabled = true;
        btnDel.style.opacity = '0.4';
        btnDel.style.cursor = 'default';
    }
    btnDel.onclick = () => {
        if (!obj) return;
        window.AppState.canvas.remove(obj);
        updateLayersList();
        renderProperties(null);
    };
    holder.appendChild(btnDel);
}

