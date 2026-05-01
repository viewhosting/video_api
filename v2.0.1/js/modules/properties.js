// --- PROPERTIES PANEL ---


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

    // 4. Propiedades específicas por tipo (Delegado al Registro de Bloques)
    const propsGroup = addGroupHeader(root, 'Propiedades');
    const blockConfig = window.BlockRegistry.get(obj.elementType);

    if (blockConfig && blockConfig.properties) {
        blockConfig.properties(obj, propsGroup);
    } else {
        // Fallback para tipos básicos o no registrados
        if (obj.type === 'textbox' || obj.type === 'text') {
            addPropInput(propsGroup, 'Contenido', obj.text, (v) => {
                obj.set('text', v);
                window.AppState.canvas.requestRenderAll();
            }, false, 'textarea');
        }
    }

    // 5. Propiedades de Texto (Solo si es un objeto de texto)
    if (obj.type === 'textbox' || obj.type === 'text') {
        let widthVal = Math.round(obj.width * obj.scaleX);
        let readOnlyWidth = false;

        // Si es el segundo elemento y el primero es un rectángulo, el ancho se bloquea
        if (refObj && obj !== refObj && refObj.type === 'rect') {
            widthVal = Math.round(refObj.getScaledWidth());
            obj.set('width', widthVal);
            obj.set('scaleX', 1);
            obj.setCoords();
            window.AppState.canvas.requestRenderAll();
            readOnlyWidth = true;
        }

        if (obj.type === 'textbox') {
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

        addPropSelect(tipGrid, 'Tipografía', obj.fontFamily, window.AVAILABLE_FONTS || [], (v) => {
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

