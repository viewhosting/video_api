// --- CONSTANTS ---
        const AVAILABLE_FONTS = [
            "Arial", "Arial Narrow", "Impact",
            "Montserrat", "Montserrat Thin", "Montserrat ExtraLight", "Montserrat Light", 
            "Montserrat Regular", "Montserrat Medium", "Montserrat SemiBold", "Montserrat Bold", 
            "Montserrat ExtraBold", "Montserrat Black",
            "OpenSans", "OpenSans Light", "OpenSans Regular", "OpenSans Medium", 
            "OpenSans SemiBold", "OpenSans Bold", "OpenSans ExtraBold",
            "Roboto", "Roboto Thin", "Roboto Light", "Roboto Regular", 
            "Roboto Medium", "Roboto Bold", "Roboto Black"
        ];

        const WEIGHT_MAP = {
            '100': 'thin',
            '200': 'extralight',
            '300': 'light',
            '400': 'regular',
            'normal': 'regular',
            '500': 'medium',
            '600': 'semiBold',
            '700': 'bold',
            'bold': 'bold',
            '800': 'extrabold',
            '900': 'black'
        };

        // --- GLOBAL VARIABLES ---
        let canvas;
        let activeObject = null;
        let videoEl = document.getElementById('bg-video-el');
        let currentVideoUrl = "";
        let renderVideoCollapsed = false;
        let renderModalHidden = false;
        let bgPreviewTimeSec = 0;
        let bgVideoLooping = false;
        let blockConfigs = {};
        let workspaceZoom = 1;

        // --- INITIALIZATION ---
        window.onload = function() {
            function normalizeCssFamily(name) {
                if (!name) return 'Arial';
                const n = String(name).trim();
                if (n.toLowerCase().startsWith('montserrat')) return 'Montserrat';
                if (n.toLowerCase().startsWith('roboto')) return 'Roboto';
                if (n.toLowerCase().startsWith('opensans') || n.toLowerCase().includes('open sans')) return 'Open Sans';
                return n;
            }
            async function ensureFontLoaded(family, weight) {
                const cssFamily = normalizeCssFamily(family);
                const w = parseInt(weight) || (String(weight).toLowerCase() === 'bold' ? 700 : 400);
                try {
                    await document.fonts.load(`normal ${w} 16px "${cssFamily}"`);
                    if (window.fabric && fabric.util && fabric.util.clearFabricFontCache) {
                        fabric.util.clearFabricFontCache();
                    }
                } catch(e) {}
            }
            window.normalizeCssFamily = normalizeCssFamily;
            window.ensureFontLoaded = ensureFontLoaded;

            canvas = new fabric.Canvas('c', {
                width: 1020,
                height: 816,
                backgroundColor: 'transparent', // Transparent to see CSS bg or video
                preserveObjectStacking: true,
                selectionColor: 'rgba(0, 122, 204, 0.1)',
                selectionBorderColor: '#007acc'
            });

            // Set a default background color logic if no video
            canvas.setBackgroundColor('#000000', canvas.renderAll.bind(canvas));
            
            canvas.on('selection:created', onSelection);
            canvas.on('selection:updated', onSelection);
            canvas.on('selection:cleared', () => {
                activeObject = null;
                renderProperties(null);
                highlightLayer(null);
            });
            
            canvas.on('object:modified', (e) => {
                if(activeObject) {
                    // Check if we need to clear alignment locks
                    // This is a simple approach: any manual move clears the specific axis alignment
                    // Ideally we would compare new position vs aligned position, but that's complex
                    
                    if (e.target && e.target.customProps) {
                        // We can't easily know which axis changed without storing prev state, 
                        // but usually 'modified' implies user interaction.
                        // Let's just be safe: if user moves it, they likely want manual control.
                        // But we don't want to annoy them if they just resized.
                        
                        if (e.transform && e.transform.action === 'drag') {
                             delete e.target.customProps.alignX;
                             delete e.target.customProps.alignY;
                        }
                    }
                    
                    if (e.target && e.target.elementType === 'marquesina') {
                        updateMarquesinaOverlay(e.target);
                    }
                    
                    renderProperties(activeObject);
                }
            });

            const accordionHeaders = document.querySelectorAll('.accordion-header');
            accordionHeaders.forEach(h => {
                h.addEventListener('click', () => {
                    const targetId = h.getAttribute('data-accordion-target');
                    const body = document.getElementById(targetId);
                    if (!body) return;
                    const isOpen = body.classList.contains('open');
                    document.querySelectorAll('.accordion-body').forEach(b => b.classList.remove('open'));
                    if (!isOpen) {
                        body.classList.add('open');
                    }
                });
            });

            const zoomSelect = document.getElementById('workspace-zoom-select');
            if (zoomSelect) {
                zoomSelect.addEventListener('change', (e) => {
                    const val = parseFloat(e.target.value) || 1;
                    setWorkspaceZoom(val);
                });
                const initial = parseFloat(zoomSelect.value) || 1;
                setWorkspaceZoom(initial);
            }

            renderBottomActions(null);
            
            // Render loop for video
            fabric.util.requestAnimFrame(function render() {
                canvas.renderAll();
                fabric.util.requestAnimFrame(render);
            });
        };

        function onSelection(e) {
            if (e.selected && e.selected.length > 0) {
                activeObject = e.selected[0];
                renderProperties(activeObject);
                highlightLayer(activeObject);
            }
        }

        // --- BACKGROUND VIDEO LOGIC ---
        function updateBackgroundVideo(overrideUrl = null) {
            const inputVal = document.getElementById('video-url-input').value.trim();
            const url = overrideUrl || inputVal;
            
            const retryBtn = document.getElementById('retry-video-btn');
            
            retryBtn.style.display = 'none';
            document.getElementById('video-url-input').style.borderColor = 'var(--border)';

            if (url === currentVideoUrl && url !== "") {
                 videoEl.src = "";
                 videoEl.src = url;
            } else {
                 currentVideoUrl = url;
                 bgPreviewTimeSec = 0;
            }

            if (!url) {
                canvas.setBackgroundColor('#000000', canvas.renderAll.bind(canvas));
                if (videoEl) {
                    videoEl.pause();
                    videoEl.removeAttribute('src');
                    videoEl.load();
                }
                const label = document.getElementById('top-header-video-label');
                if (label) {
                    label.innerText = 'Sin video de fondo';
                }
                return;
            }

            if (!videoEl) {
                console.warn("No bg-video-el element found");
                return;
            }

            canvas.setBackgroundColor('rgba(0,0,0,0)', canvas.renderAll.bind(canvas));

            videoEl.onloadedmetadata = function() {
                retryBtn.style.display = 'none';

                let targetTime = 0;
                if (bgPreviewTimeSec > 0 && videoEl.duration && bgPreviewTimeSec < videoEl.duration) {
                    targetTime = bgPreviewTimeSec;
                }
                try {
                    videoEl.currentTime = targetTime;
                } catch (e) {
                    console.error("Error setting preview time:", e);
                }

                if (bgVideoLooping) {
                    videoEl.loop = true;
                    videoEl.play().catch(() => {});
                } else {
                    videoEl.loop = false;
                    // Reproducir un instante para asegurar un frame y luego pausar
                    videoEl.play().then(() => {
                        setTimeout(() => {
                            videoEl.pause();
                        }, 50);
                    }).catch(() => {});
                }
            };

            videoEl.onerror = function(e) {
                handleVideoError(e);
            };

            videoEl.crossOrigin = "anonymous";
            videoEl.src = url;
            videoEl.load();

            const label = document.getElementById('top-header-video-label');
            if (label) {
                label.innerText = 'Video fondo: ' + url;
            }
        }

        function retryVideo() {
             // Force update
             updateBackgroundVideo();
        }

        function handleVideoError(e) {
             const retryBtn = document.getElementById('retry-video-btn');
             const input = document.getElementById('video-url-input');
             
             retryBtn.style.display = 'block';
             input.style.borderColor = '#d9534f';
             
             // Optional: Show a toast or alert, but the button is the requested UI
             console.warn("Video load failed. User can retry.");
        }

        function toggleBackgroundLoop() {
            const url = document.getElementById('video-url-input').value.trim();
            if (!url) return;
            const btn = document.getElementById('bg-loop-btn');
            bgVideoLooping = !bgVideoLooping;
            if (bgVideoLooping) {
                if (!currentVideoUrl) {
                    updateBackgroundVideo(url);
                } else if (videoEl.src !== currentVideoUrl) {
                    updateBackgroundVideo(currentVideoUrl);
                } else {
                    videoEl.loop = true;
                    if (videoEl.readyState >= 2) {
                        if (bgPreviewTimeSec > 0 && bgPreviewTimeSec < videoEl.duration) {
                            try { videoEl.currentTime = bgPreviewTimeSec; } catch (e) {}
                        }
                        videoEl.play().catch(() => {});
                    } else {
                        updateBackgroundVideo(currentVideoUrl || url);
                    }
                }
                if (btn) btn.innerHTML = '<i class="fas fa-stop-circle"></i>';
            } else {
                videoEl.loop = false;
                videoEl.pause();
                if (bgPreviewTimeSec > 0) {
                    try { videoEl.currentTime = bgPreviewTimeSec; } catch (e) {}
                }
                if (btn) btn.innerHTML = '<i class="fas fa-redo-alt"></i>';
            }
        }

        function openVideoPreviewModal() {
            const input = document.getElementById('video-url-input');
            const url = input.value.trim();
            if (!url) return;
            const modal = document.getElementById('video-preview-modal');
            const player = document.getElementById('video-preview-player');
            modal.style.display = 'flex';
            if (player.src !== url) {
                player.src = url;
                player.load();
            }
            try {
                if (bgPreviewTimeSec > 0) {
                    player.currentTime = bgPreviewTimeSec;
                } else {
                    player.currentTime = 0;
                }
            } catch (e) {}
            player.play().catch(() => {});
        }

        function closeVideoPreviewModal() {
            const modal = document.getElementById('video-preview-modal');
            const player = document.getElementById('video-preview-player');
            player.pause();
            modal.style.display = 'none';
        }

        function applyVideoPreviewTime() {
            const player = document.getElementById('video-preview-player');
            bgPreviewTimeSec = player.currentTime || 0;
            closeVideoPreviewModal();
            if (currentVideoUrl) {
                updateBackgroundVideo(currentVideoUrl);
            } else {
                const url = document.getElementById('video-url-input').value.trim();
                if (url) updateBackgroundVideo(url);
            }
        }

        function resetVideoPreviewTime() {
            bgPreviewTimeSec = 0;
            const player = document.getElementById('video-preview-player');
            try {
                player.currentTime = 0;
            } catch (e) {}
            if (currentVideoUrl) {
                updateBackgroundVideo(currentVideoUrl);
            }
        }

        // --- CORE LOGIC: BLOCKS & ELEMENTS ---

        function generateId() {
            return 'id_' + Math.random().toString(36).substr(2, 9);
        }

        // --- REMOTE RENDER (GENERAR) ---
        let lastRenderBlobUrl = null;
        function openRenderModalLoading() {
            const modal = document.getElementById('render-modal');
            const fab = document.getElementById('render-modal-toggle-fab');
            document.getElementById('render-status').style.display = 'block';
            document.getElementById('render-status').innerText = 'Generando…';
            document.getElementById('render-video-wrap').style.display = 'none';
            document.getElementById('render-error').style.display = 'none';
            renderVideoCollapsed = false;
            renderModalHidden = false;
            const btn = document.getElementById('render-toggle-btn');
            if (btn) btn.innerHTML = '<i class="fas fa-compress"></i>';
            modal.style.display = 'flex';
            if (fab) fab.style.display = 'none';
        }
        function showRenderModalVideo(url) {
            const modal = document.getElementById('render-modal');
            const videoElOut = document.getElementById('render-video');
            const linkEl = document.getElementById('render-video-link');
            document.getElementById('render-status').style.display = 'none';
            document.getElementById('render-error').style.display = 'none';
            document.getElementById('render-video-wrap').style.display = 'block';
            videoElOut.src = url;
            linkEl.href = url;
            if (!renderModalHidden) {
                modal.style.display = 'flex';
            }
        }
        function showRenderModalError(errObj) {
            const modal = document.getElementById('render-modal');
            const pre = document.getElementById('render-error');
            document.getElementById('render-status').style.display = 'none';
            document.getElementById('render-video-wrap').style.display = 'none';
            pre.style.display = 'block';
            try {
                pre.textContent = typeof errObj === 'string' ? errObj : JSON.stringify(errObj, null, 2);
            } catch {
                pre.textContent = String(errObj);
            }
            if (!renderModalHidden) {
                modal.style.display = 'flex';
            }
        }
        function closeRenderModal() {
            const modal = document.getElementById('render-modal');
            const fab = document.getElementById('render-modal-toggle-fab');
            const videoOut = document.getElementById('render-video');
            videoOut.pause();
            videoOut.src = '';
            if (lastRenderBlobUrl) {
                URL.revokeObjectURL(lastRenderBlobUrl);
                lastRenderBlobUrl = null;
            }
            modal.style.display = 'none';
            renderModalHidden = false;
            if (fab) fab.style.display = 'none';
        }
        function minimizeRenderModal() {
            const modal = document.getElementById('render-modal');
            const fab = document.getElementById('render-modal-toggle-fab');
            renderModalHidden = true;
            modal.style.display = 'none';
            if (fab) fab.style.display = 'block';
        }
        function restoreRenderModal() {
            const modal = document.getElementById('render-modal');
            const fab = document.getElementById('render-modal-toggle-fab');
            renderModalHidden = false;
            modal.style.display = 'flex';
            if (fab) fab.style.display = 'none';
        }
        function toggleRenderVideo() {
            const wrap = document.getElementById('render-video-wrap');
            const btn = document.getElementById('render-toggle-btn');
            if (!wrap || !btn) return;
            renderVideoCollapsed = !renderVideoCollapsed;
            if (renderVideoCollapsed) {
                wrap.style.display = 'none';
                btn.innerHTML = '<i class="fas fa-expand"></i>';
            } else {
                wrap.style.display = 'block';
                btn.innerHTML = '<i class="fas fa-compress"></i>';
            }
        }
        async function generateRemote() {
            try {
                const payload = generateJson();
                openRenderModalLoading();
                const resp = await fetch('https://apis.clientesunikms.com/video_api/render', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'SantanderZXJjaW483847FsMUBzcG9ydHNzdW1taXQuY2FkYXNkOW0uYnI6U3FzZGYzNDU1RE5XQVhZRVhXUllNVW1wdUNlMmVsbGRxQ0pWTHpWQ21aQ2RrQ3c9PQ==-',
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, video/mp4, */*'
                    },
                    body: JSON.stringify(payload)
                });
                const ctype = (resp.headers.get('content-type') || '').toLowerCase();
                if (!resp.ok) {
                    if (ctype.includes('application/json')) {
                        const errJson = await resp.json();
                        showRenderModalError(errJson);
                    } else {
                        const errText = await resp.text();
                        showRenderModalError(errText || ('HTTP ' + resp.status));
                    }
                    return;
                }
                if (ctype.includes('application/json')) {
                    const data = await resp.json();
                    const videoUrl =
                        data.video_url || data.url || data.video ||
                        (data.output && (data.output.url || data.output.video_url)) ||
                        (Array.isArray(data.results) && data.results.length && (data.results[0].url || data.results[0].video_url)) ||
                        null;
                    if (videoUrl && typeof videoUrl === 'string') {
                        showRenderModalVideo(videoUrl);
                    } else {
                        showRenderModalError(data);
                    }
                } else {
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    lastRenderBlobUrl = url;
                    showRenderModalVideo(url);
                }
            } catch (e) {
                showRenderModalError({ error: e?.message || String(e) });
            }
        }

        function getBlocks() {
            const blocks = new Set();
            canvas.getObjects().forEach(obj => {
                if (obj.blockId) blocks.add(obj.blockId);
            });
            return Array.from(blocks).sort((a,b) => {
                 const numA = parseInt(a.replace('bloque_', '')) || 999;
                 const numB = parseInt(b.replace('bloque_', '')) || 999;
                 return numA - numB;
            });
        }

        function addBlock() {
            const currentCount = getBlocks().length;
            const blockId = 'bloque_' + (currentCount + 1);
            // Just creating the ID concept for now
            // Maybe add a dummy hidden object to persist the block if empty?
            // For now, we rely on adding elements to it.
            alert(`Bloque creado: ${blockId}. Ahora agrega elementos a él.`);
            return blockId;
        }

        function getActiveBlockId() {
            const blocks = getBlocks();
            if (blocks.length === 0) return 'bloque_1';
            // Default to last
            return blocks[blocks.length - 1];
        }

        function addElement(type) {
            // Smart block selection: if an object is selected, use its block.
            let defaultBlock = getActiveBlockId();
            if (activeObject && activeObject.blockId) {
                defaultBlock = activeObject.blockId;
            }

            const blockId = prompt("ID del Bloque:", defaultBlock);
            if (!blockId) return;

            const center = canvas.getCenter();
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
                if(!url) return;
                
                fabric.Image.fromURL(url, function(img) {
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
                    left: 0, top: canvas.height - 60,
                    fontSize: 30, fontFamily: 'Arial',
                    fill: '#fff', backgroundColor: '#cc0000',
                    width: canvas.width
                });
            }

            if (obj) finalizeAdd(obj, blockId, type);
        }

        function getMarquesinaOverlayTarget(base) {
            return canvas.getObjects().find(o => o.isMarquesinaOverlay && o.marquesinaId === base.__uid);
        }

        function updateMarquesinaOverlay(base) {
            if (!base) return;
            if (!base.__uid) {
                base.__uid = generateId();
            }
            let overlay = getMarquesinaOverlayTarget(base);
            let sizeStr = base.customProps && base.customProps.size
                ? String(base.customProps.size)
                : `${Math.round(base.width)}, ${Math.round(base.height)}`;
            const parts = sizeStr.split(',');
            const w = parseInt(parts[0]);
            const h = parseInt(parts[1] || parts[0] || 0);
            if (!overlay) {
                overlay = new fabric.Rect({
                    left: base.left,
                    top: base.top,
                    width: isNaN(w) ? base.width : w,
                    height: isNaN(h) ? base.height : h,
                    fill: 'rgba(0,0,0,0)',
                    stroke: '#00ffff',
                    strokeWidth: 1,
                    strokeDashArray: [6, 4],
                    selectable: false,
                    evented: false
                });
                overlay.isMarquesinaOverlay = true;
                overlay.marquesinaId = base.__uid;
                canvas.add(overlay);
                overlay.moveTo(base.layerIndex ? base.layerIndex : canvas.getObjects().indexOf(base));
            } else {
                overlay.set({
                    left: base.left,
                    top: base.top,
                    width: isNaN(w) ? base.width : w,
                    height: isNaN(h) ? base.height : h
                });
            }
            overlay.blockId = base.blockId;
            overlay.setCoords();
            canvas.requestRenderAll();
        }

        function finalizeAdd(obj, blockId, type, extraProps = {}) {
            obj.blockId = blockId;
            obj.elementType = type;
            if(extraProps) obj.customProps = { ...obj.customProps, ...extraProps };
            canvas.add(obj);
            if (type === 'marquesina') {
                updateMarquesinaOverlay(obj);
            }
            canvas.setActiveObject(obj);
            updateLayersList();
        }

        // --- PROPERTIES PANEL ---

        function renderProperties(obj) {
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
            if (!blockConfigs[blockId]) {
                blockConfigs[blockId] = {
                    inicio: '',
                    fin: '',
                    efecto_inicio: '',
                    efecto_fin: '',
                    duracion: ''
                };
            }
            const cfg = blockConfigs[blockId];

            const timeGroup = addGroupHeader(root, 'Tiempo / Efectos');
            addPropInput(timeGroup, 'Inicio (seg)', cfg.inicio, (v) => {
                blockConfigs[blockId].inicio = v;
            }, false, 'number');
            addPropInput(timeGroup, 'Fin (seg)', cfg.fin, (v) => {
                blockConfigs[blockId].fin = v;
            }, false, 'number');
            addPropInput(timeGroup, 'Duración (seg)', cfg.duracion, (v) => {
                blockConfigs[blockId].duracion = v;
            }, false, 'number');

            addPropSelect(timeGroup, 'Efecto Inicio', cfg.efecto_inicio || '', ['', 'fade'], (v) => {
                blockConfigs[blockId].efecto_inicio = v;
            });
            addPropSelect(timeGroup, 'Efecto Fin', cfg.efecto_fin || '', ['', 'fade'], (v) => {
                blockConfigs[blockId].efecto_fin = v;
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

            addPropInput(geomGrid, 'X', Math.round(obj.left), (v) => { obj.set('left', parseInt(v)); canvas.requestRenderAll(); });
            addPropInput(geomGrid, 'Y', Math.round(obj.top), (v) => { obj.set('top', parseInt(v)); canvas.requestRenderAll(); });
            addPropInput(geomGrid, 'W', (obj.width * obj.scaleX).toFixed(0), (v) => { obj.scaleToWidth(parseInt(v)); canvas.requestRenderAll(); });
            addPropInput(geomGrid, 'H', (obj.height * obj.scaleY).toFixed(0), (v) => { obj.scaleToHeight(parseInt(v)); canvas.requestRenderAll(); });

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
            const objsInBlock = canvas.getObjects().filter(o => (o.blockId || 'bloque_1') === blockId && !o.isMarquesinaOverlay);
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
                    const newLeft = canvas.width - obj.getScaledWidth();
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
                    const newTop = canvas.height - obj.getScaledHeight();
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
                canvas.requestRenderAll();
                renderProperties(obj);
            }

            // 3. Appearance
            const appearanceGroup = addGroupHeader(root, 'Apariencia');
            addPropRange(appearanceGroup, 'Opacidad', obj.opacity, 0, 1, 0.1, (v) => { obj.set('opacity', parseFloat(v)); canvas.requestRenderAll(); });

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
                     canvas.requestRenderAll();
                });
                
                addPropColor(marqGroup, 'Color Fondo', (obj.customProps && obj.customProps.bg_color) || '', (v) => {
                     if (!obj.customProps) obj.customProps = {};
                     obj.customProps.bg_color = v;
                     canvas.requestRenderAll();
                });
                
                addPropRange(marqGroup, 'Transparencia Fondo', (obj.customProps && obj.customProps.transparencia) || 0, 0, 1, 0.1, (v) => {
                     if (!obj.customProps) obj.customProps = {};
                     obj.customProps.transparencia = parseFloat(v);
                     canvas.requestRenderAll();
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
                     canvas.requestRenderAll();
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
                         canvas.requestRenderAll();
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
                addPropSelect(twoColGroup, 'Divisor', (obj.customProps.divisor ? 'true' : 'false'), ['false','true'], (v) => {
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
                addPropSelect(col1Group, 'Alineación', obj.customProps.col1_align || 'left', ['left','center','right'], (v) => {
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
                addPropSelect(col1Group, 'Peso', obj.customProps.col1_peso || 'bold', ['thin','bold','extrabold'], (v) => {
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
                addPropSelect(col2Group, 'Alineación', obj.customProps.col2_align || 'left', ['left','center','right'], (v) => {
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
                addPropSelect(col2Group, 'Peso', obj.customProps.col2_peso || 'bold', ['thin','bold','extrabold'], (v) => {
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
                    canvas.requestRenderAll();
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
                 addPropColor(appearanceGroup, 'Color Relleno', obj.fill, (v) => { obj.set('fill', v); canvas.requestRenderAll(); });
            }
            
            if ((obj.type === 'textbox' || obj.type === 'text') && obj.elementType !== 'marquesina' && obj.elementType !== 'texto_varias_columnas') {
                 addPropColor(appearanceGroup, 'Fondo Texto', obj.backgroundColor || '', (v) => { obj.set('backgroundColor', v); canvas.requestRenderAll(); });
                 
                 // Text Box Radius (Custom Prop for Backend)
                 addPropInput(appearanceGroup, 'Redondeo Fondo', (obj.customProps && obj.customProps.radius) || 0, (v) => {
                     if (!obj.customProps) obj.customProps = {};
                     obj.customProps.radius = parseInt(v);
                 });
            }

            // 4. Text Specific
            if (obj.type === 'textbox' || obj.type === 'text') {
                // Caso especial: N Cols
                if (obj.elementType === 'texto_varias_columnas') {
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
                        canvas.requestRenderAll();
                    });

                    const gapVal = (obj.customProps && obj.customProps.gap) || 0;
                    addPropInput(ncolTextGroup, 'Gap Columnas', gapVal, (v) => {
                        if (!obj.customProps) obj.customProps = {};
                        obj.customProps.gap = parseInt(v) || 0;
                    });

                    const padVal = (obj.customProps && obj.customProps.padding) || '0';
                    addPropInput(ncolTextGroup, 'Padding (T,R,B,L)', padVal, (v) => {
                        if (!obj.customProps) obj.customProps = {};
                        obj.customProps.padding = v;
                    });

                    const defaultSize = `${Math.round(obj.width)}, ${Math.round(obj.height)}`;
                    addPropInput(ncolTextGroup, 'Tamaño (W, H)', (obj.customProps && obj.customProps.size) || defaultSize, (v) => {
                        if (!obj.customProps) obj.customProps = {};
                        obj.customProps.size = v;
                        const parts = String(v).split(',');
                        const w = parseInt(parts[0]);
                        if (!isNaN(w) && w > 0) {
                            obj.set('width', w);
                            canvas.requestRenderAll();
                        }
                    });

                    const bordeVal = (obj.customProps && obj.customProps.borde_grosor) || 0;
                    addPropInput(ncolTextGroup, 'Borde Grosor', bordeVal, (v) => {
                        if (!obj.customProps) obj.customProps = {};
                        obj.customProps.borde_grosor = parseInt(v) || 0;
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
                        });

                        addPropSelect(grid, 'Alineación', col.alineacion || 'center', ['left', 'center', 'right'], (v) => {
                            col.alineacion = v;
                        });

                        addPropColor(grid, 'Color', col.color || '#FFFFFF', (v) => {
                            col.color = v;
                        });

                        addPropSelect(grid, 'Tipografía', col.tipografia || 'montserrat', AVAILABLE_FONTS, (v) => {
                            col.tipografia = v;
                        });

                        addPropInput(grid, 'Tamaño Fuente', col.size_texto || 18, (v) => {
                            col.size_texto = parseInt(v) || 0;
                        });

                        addPropSelect(grid, 'Peso', col.peso || 'bold', ['thin','light','regular','medium','bold','extrabold','black'], (v) => {
                            col.peso = v;
                        });

                        addPropColor(card, 'Color Fondo', col.bg_color || '', (v) => {
                            col.bg_color = v;
                        });

                        addPropRange(card, 'Transparencia Fondo', col.bg_transparencia != null ? col.bg_transparencia : 0, 0, 1, 0.05, (v) => {
                            col.bg_transparencia = parseFloat(v) || 0;
                        });

                        addPropInput(card, 'Texto', col.contenido || '', (v) => {
                            col.contenido = v;
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
                        renderProperties(obj);
                    };
                    propsGroup.appendChild(addBtn);
                } else {
                    // Texto normal / marquesina
                    addPropInput(propsGroup, 'Contenido', obj.text, (v) => { obj.set('text', v); canvas.requestRenderAll(); }, false, 'textarea');
                    
                    if (obj.type === 'textbox') {
                        let widthVal = obj.width;
                        let readOnlyWidth = false;

                        if (refObj && obj !== refObj && refObj.type === 'rect') {
                            widthVal = Math.round(refObj.getScaledWidth());
                            obj.set('width', widthVal);
                            obj.setCoords();
                            canvas.requestRenderAll();
                            readOnlyWidth = true;
                        }

                        addPropInput(propsGroup, 'Ancho Caja', widthVal, (v) => { 
                            if (readOnlyWidth) return;
                            obj.set('width', parseInt(v)); 
                            canvas.requestRenderAll(); 
                        }, readOnlyWidth);
                    }
                    
                    const tipGrid = document.createElement('div');
                    tipGrid.style.display = 'grid';
                    tipGrid.style.gridTemplateColumns = '1fr 1fr';
                    tipGrid.style.gap = '10px';
                    propsGroup.appendChild(tipGrid);

                    addPropSelect(tipGrid, 'Tipografía', obj.fontFamily, AVAILABLE_FONTS, (v) => { 
                        // Asegurar carga de fuente y luego aplicar
                        if (window.ensureFontLoaded) {
                            window.ensureFontLoaded(v, obj.fontWeight).then(() => {
                                obj.set('fontFamily', v); 
                                canvas.requestRenderAll();
                            });
                        } else {
                            obj.set('fontFamily', v); 
                            canvas.requestRenderAll();
                        }
                    });
                    
                    addPropSelect(tipGrid, 'Peso', obj.fontWeight, ['normal', 'bold', '100', '300', '600', '800', '900'], (v) => {
                        obj.set('fontWeight', v); 
                        if (window.ensureFontLoaded) {
                            window.ensureFontLoaded(obj.fontFamily, v).then(() => canvas.requestRenderAll());
                        } else {
                            canvas.requestRenderAll();
                        }
                    });

                    const alignVal = (obj.customProps && obj.customProps.alineacion) || obj.textAlign || 'left';
                    addPropSelect(propsGroup, 'Alineación texto', alignVal, ['left','center','right'], (v) => {
                        if (!obj.customProps) obj.customProps = {};
                        obj.customProps.alineacion = v;
                        obj.set('textAlign', v);
                        canvas.requestRenderAll();
                    });

                    const typoGrid2 = document.createElement('div');
                    typoGrid2.style.display = 'grid';
                    typoGrid2.style.gridTemplateColumns = '1fr 1fr';
                    typoGrid2.style.gap = '10px';
                    propsGroup.appendChild(typoGrid2);

                    addPropInput(typoGrid2, 'Tamaño Fuente', obj.fontSize, (v) => { obj.set('fontSize', parseInt(v)); canvas.requestRenderAll(); });
                    addPropInput(typoGrid2, 'Espaciado Letras', obj.charSpacing || 0, (v) => { obj.set('charSpacing', parseInt(v)); canvas.requestRenderAll(); });

                    addPropInput(propsGroup, 'Interlineado', obj.lineHeight || 1, (v) => { obj.set('lineHeight', parseFloat(v)); canvas.requestRenderAll(); });

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
                obj.set('shadow', {
                    color: sColor,
                    blur: sBlur,
                    offsetX: sX,
                    offsetY: sY
                });
            }
            function updateShadowProp() {
                if (!obj.customProps) obj.customProps = {};
                obj.customProps.sombra = sBlur + ', ' + sX + ', ' + sY + ', ' + sColor;
                applyFabricShadow();
                canvas.requestRenderAll();
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

        function setWorkspaceZoom(scale) {
            workspaceZoom = scale;
            const wrap = document.getElementById('canvas-wrapper');
            if (!wrap) return;
            wrap.style.transformOrigin = 'center center';
            wrap.style.transform = 'scale(' + scale + ')';
        }

        function renderBottomActions(obj) {
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
                generateRemote();
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
                canvas.remove(obj);
                updateLayersList();
                renderProperties(null);
            };
            holder.appendChild(btnDel);
        }

        // --- UI HELPERS ---

        function addGroupHeader(parent, text) {
            const section = document.createElement('div');
            section.className = 'accordion-section';
            section.setAttribute('data-prop-group', 'true');

            const id = `props-acc-${Math.random().toString(36).substr(2, 9)}`;

            const header = document.createElement('button');
            header.className = 'accordion-header';
            header.setAttribute('data-accordion-target', id);
            header.innerHTML = `<span>${text}</span><i class="fas fa-chevron-down" style="font-size: 0.7rem;"></i>`;

            const body = document.createElement('div');
            body.className = 'accordion-body';
            body.id = id;

            section.appendChild(header);
            section.appendChild(body);

            const sentinel = document.getElementById('props-container');
            if (sentinel && parent === document.getElementById('properties')) {
                parent.insertBefore(section, sentinel);
            } else {
                parent.appendChild(section);
            }

            header.addEventListener('click', () => {
                const isOpen = body.classList.contains('open');
                document.querySelectorAll('.accordion-body').forEach(b => b.classList.remove('open'));
                if (!isOpen) {
                    body.classList.add('open');
                }
            });

            if (!document.querySelector('.accordion-body.open')) {
                body.classList.add('open');
            }

            return body;
        }

        function addPropInput(parent, label, value, onChange, readonly=false, type='text') {
            const row = document.createElement('div');
            row.className = 'prop-row';
            
            const lbl = document.createElement('label');
            lbl.innerText = label;
            row.appendChild(lbl);

            let input;
            if (type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = 3;
            } else {
                input = document.createElement('input');
                input.type = type;
                input.className = 'prop-input';
            }
            
            input.value = (value === null || value === undefined) ? '' : value;
            if (readonly) input.disabled = true;
            
            input.onchange = (e) => onChange(e.target.value);
            // Also oninput for realtime feel? maybe too heavy
            
            row.appendChild(input);
            parent.appendChild(row);
        }

        function addPropSelect(parent, label, value, options, onChange) {
            const row = document.createElement('div');
            row.className = 'prop-row';
            
            const lbl = document.createElement('label');
            lbl.innerText = label;
            row.appendChild(lbl);

            const select = document.createElement('select');
            options.forEach(opt => {
                const op = document.createElement('option');
                op.value = opt;
                op.text = opt;
                if (opt == value) op.selected = true; // loose equality for string/int
                select.appendChild(op);
            });
            
            select.onchange = (e) => onChange(e.target.value);
            row.appendChild(select);
            parent.appendChild(row);
        }

        function addPropRange(parent, label, value, min, max, step, onChange) {
            const row = document.createElement('div');
            row.className = 'prop-row';
            row.innerHTML = `<label>${label}</label>`;
            
            const input = document.createElement('input');
            input.type = 'range';
            input.min = min; input.max = max; input.step = step;
            input.value = value;
            input.style.width = '100%';
            
            input.oninput = (e) => onChange(e.target.value);
            
            row.appendChild(input);
            parent.appendChild(row);
        }
        
        function addPropColor(parent, label, value, onChange) {
             const row = document.createElement('div');
            row.className = 'prop-row';
            
            const lbl = document.createElement('label');
            lbl.innerText = label;
            row.appendChild(lbl);
            
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.gap = '5px';

            const inputColor = document.createElement('input');
            inputColor.type = 'color';
            // Handle hex vs rgba issues simply
            const hex = (value && value.startsWith('#')) ? value.substring(0,7) : '#000000';
            inputColor.value = hex;
            
            const inputText = document.createElement('input');
            inputText.type = 'text';
            inputText.className = 'prop-input';
            inputText.value = value;
            inputText.style.flex = 1;

            inputColor.oninput = (e) => {
                inputText.value = e.target.value;
                onChange(e.target.value);
            };
            
            inputText.onchange = (e) => {
                inputColor.value = e.target.value;
                onChange(e.target.value);
            };

            container.appendChild(inputColor);
            container.appendChild(inputText);
            row.appendChild(container);
            parent.appendChild(row);
        }

        // --- LAYERS LIST LOGIC ---
        function updateLayersList() {
            const list = document.getElementById('layers-list');
            list.innerHTML = '';
            
            // Group objects by Block ID
            const blocks = {};
            canvas.getObjects().forEach(obj => {
                if (obj.isMarquesinaOverlay) return;
                const bid = obj.blockId || 'bloque_1';
                if (!blocks[bid]) blocks[bid] = [];
                blocks[bid].push(obj);
            });

            const sortedKeys = Object.keys(blocks).sort((a,b) => {
                const numA = parseInt(a.replace('bloque_', '')) || 999;
                const numB = parseInt(b.replace('bloque_', '')) || 999;
                return numA - numB;
            });

            if (sortedKeys.length === 0) {
                 list.innerHTML = '<div style="padding:20px; text-align:center; color:#555; font-size:0.8rem;">No hay elementos</div>';
                 return;
            }

            sortedKeys.forEach(bid => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'layer-group';
                
                const header = document.createElement('div');
                header.className = 'layer-group-header';
                header.innerHTML = `<span><i class="fas fa-cube"></i> ${bid}</span>`;
                header.onclick = () => selectBlock(bid);
                
                groupDiv.appendChild(header);

                // Render in reverse order (Top to Bottom) for better UI intuition
                const objs = blocks[bid].slice().reverse();

                objs.forEach(obj => {
                    const item = document.createElement('div');
                    item.className = 'layer-item';
                    if (obj === activeObject) item.classList.add('active');
                    
                    let icon = 'fa-square';
                    if (obj.type === 'textbox' || obj.type === 'text') icon = 'fa-font';
                    if (obj.elementType === 'imagen') icon = 'fa-image';
                    
                    let label = obj.elementType || obj.type;
                    if (obj.text) label = obj.text.substring(0, 15) + (obj.text.length > 15 ? '...' : '');
                    
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';
                    item.style.alignItems = 'center';
                    
                    const labelSpan = document.createElement('span');
                    labelSpan.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
                    item.appendChild(labelSpan);

                    // Controls
                    const ctrls = document.createElement('div');
                    
                    const btnUp = document.createElement('button');
                    btnUp.innerText = '↑';
                    btnUp.title = 'Subir Capa';
                    btnUp.style = 'margin-left: 5px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem; background: #555; border: 1px solid #666; color: #fff; border-radius: 3px;';
                    btnUp.onclick = (e) => { e.stopPropagation(); moveLayerUp(obj); };
                    
                    const btnDown = document.createElement('button');
                    btnDown.innerText = '↓';
                    btnDown.title = 'Bajar Capa';
                    btnDown.style = 'margin-left: 2px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem; background: #555; border: 1px solid #666; color: #fff; border-radius: 3px;';
                    btnDown.onclick = (e) => { e.stopPropagation(); moveLayerDown(obj); };

                    ctrls.appendChild(btnUp);
                    ctrls.appendChild(btnDown);
                    item.appendChild(ctrls);

                    item.onclick = (e) => {
                        e.stopPropagation();
                        canvas.setActiveObject(obj);
                        canvas.requestRenderAll();
                    };
                    
                    groupDiv.appendChild(item);
                });
                
                list.appendChild(groupDiv);
            });

            if (typeof updateTimelineFromBlocks === 'function') {
                updateTimelineFromBlocks();
            }
        }
        
        function moveLayerUp(obj) {
            canvas.bringForward(obj);
            updateLayersList();
        }

        function moveLayerDown(obj) {
            canvas.sendBackwards(obj);
            updateLayersList();
        }
        
        function selectBlock(blockId) {
            const objs = canvas.getObjects().filter(o => o.blockId === blockId && !o.isMarquesinaOverlay);
            if (objs.length) {
                const sel = new fabric.ActiveSelection(objs, { canvas: canvas });
                canvas.setActiveObject(sel);
                canvas.requestRenderAll();
            }
            const label = document.getElementById('top-header-block-label');
            if (label) {
                label.innerText = 'Bloque activo: ' + blockId;
            }
        }

        function highlightLayer(obj) {
            updateLayersList(); 
        }

        // --- JSON HANDLING ---

        function showSettingsModal() {
            document.getElementById('settings-modal').style.display = 'flex';
        }

        function closeSettingsModal() {
            document.getElementById('settings-modal').style.display = 'none';
        }

        function showJsonModal() {
            const json = generateJson();
            document.getElementById('json-textarea').value = JSON.stringify(json, null, 4);
            document.getElementById('json-modal').style.display = 'flex';
        }

        function closeJsonModal() {
            document.getElementById('json-modal').style.display = 'none';
        }

        function generateJson() {
            const output = {
                json: true,
                nombre: document.getElementById('conf-nombre').value || "render_remoto.mp4",
                inicio: document.getElementById('conf-inicio').value || "0",
                fin: document.getElementById('conf-fin').value || "5",
                ancho: canvas.width,
                alto: canvas.height,
                zoom: parseFloat(document.getElementById('conf-zoom').value) || 2,
                video: document.getElementById('video-url-input').value.trim(),
                logo: document.getElementById('conf-logo').value.trim(),
                audio: document.getElementById('conf-audio').value.trim(),
                layout: {}
            };

            // Group objects by Block ID
            const fabricBlocks = {};
            canvas.getObjects().forEach(obj => {
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

                const cfg = blockConfigs[bid] || {};
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

        function getGlobalDurationForTimeline() {
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

        function getBlockWindowForTimeline(bid) {
            const cfg = blockConfigs[bid] || {};
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

        function updateTimelineFromBlocks() {
            const durationLabel = document.getElementById('timeline-duration-label');
            const blocks = getBlocks();
            const global = getGlobalDurationForTimeline();

            if (durationLabel) {
                durationLabel.innerText = 'Duración estimada: ' + global.total.toFixed(1) + 's';
            }
        }

        function mapFabricToSchema(obj, refObj) {
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
                    const yPct = Math.round((absTop / canvas.height) * 100);
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
                let baseSize = null;
                if (refObj) {
                    if (refObj.customProps && refObj.customProps.size) {
                        baseSize = refObj.customProps.size;
                    } else {
                        baseSize = `${Math.round(refObj.getScaledWidth())}, ${Math.round(refObj.getScaledHeight())}`;
                    }
                }
                if (obj.customProps && obj.customProps.size) {
                    el.size = baseSize || obj.customProps.size;
                } else if (baseSize) {
                    el.size = baseSize;
                } else {
                    el.size = `${Math.round(obj.getScaledWidth())}, ${Math.round(obj.getScaledHeight())}`;
                }
                
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
                // Exclude internal props like alignX/alignY from final JSON if we want clean JSON
                // But merging everything is fine, backend ignores unknowns.
                Object.assign(el, obj.customProps);
                
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
                
                // Remove alignment props from root if they conflict (though backend doesn't use alignX/Y directly usually)
                delete el.alignX;
                delete el.alignY;
            }
            
            return el;
        }

        function loadJsonFromModal() {
            try {
                const raw = document.getElementById('json-textarea').value;
                const data = JSON.parse(raw);
                
                // Clear and Setup
                canvas.clear();
                canvas.setWidth(data.ancho || 1024);
                canvas.setHeight(data.alto || 820);
                document.getElementById('canvas-size-display').innerText = `${canvas.width} x ${canvas.height}`;

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

                blockConfigs = {};

                if (data.layout) {
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

                        blockConfigs[blockId] = {
                            inicio: meta && meta.inicio !== undefined ? meta.inicio : '',
                            fin: meta && meta.fin !== undefined ? meta.fin : '',
                            efecto_inicio: meta && meta.efecto_inicio !== undefined ? meta.efecto_inicio : '',
                            efecto_fin: meta && meta.efecto_fin !== undefined ? meta.efecto_fin : '',
                            duracion: meta && meta.duracion !== undefined ? meta.duracion : ''
                        };

                        cleaned.forEach(el => createObjectFromSchema(blockId, el));
                    }
                }
                
                updateLayersList();
                closeJsonModal();
                
            } catch (e) {
                alert('JSON Inválido: ' + e.message);
            }
        }

        function createObjectFromSchema(blockId, el) {
            // Find existing objects in this block to determine if this is the first one or subsequent
            const existingInBlock = canvas.getObjects().filter(o => o.blockId === blockId && !o.isMarquesinaOverlay);
            const isFirst = existingInBlock.length === 0;
            
            let left = 0, top = 0;
            const posParts = String(el.posicion || '0,0').split(',');
            
            if (isFirst) {
                const rawX = posParts[0] ? posParts[0].trim().toLowerCase() : '0';
                const rawY = posParts[1] ? posParts[1].trim().toLowerCase() : '0';
                
                if (rawX === 'center') left = canvas.width / 2;
                else if (rawX === 'left') left = 0;
                else if (rawX === 'right') left = canvas.width;
                else {
                    const nX = parseInt(rawX);
                    left = isNaN(nX) ? 0 : nX;
                }
                
                if (rawY === 'center') top = canvas.height / 2;
                else if (rawY === 'top') top = 0;
                else if (rawY === 'bottom') top = canvas.height;
                else {
                    const nY = parseInt(rawY);
                    top = isNaN(nY) ? 0 : nY;
                }
            } else {
                // Relative to first
                const refObj = existingInBlock[0];
                const refLeft = refObj.left;
                const refTop = refObj.top;
                
                // X
                const valX = posParts[0].trim();
                if (valX !== 'center' && valX !== 'left' && valX !== 'right') {
                     left = refLeft + parseInt(valX);
                } else {
                     left = refLeft; // Placeholder
                }
                
                // Y
                const valY = posParts[1] ? posParts[1].trim() : '0';
                if (valY !== 'center' && valY !== 'top' && valY !== 'bottom') {
                     top = refTop + parseInt(valY);
                } else {
                     top = refTop; // Placeholder
                }
            }

            let obj;

            if (el.tipo === 'rectangulo') {
                let w = 100, h = 50;
                if (el.size) {
                    const sParts = String(el.size).split(',');
                    w = parseInt(sParts[0]);
                    h = parseInt(sParts[1]);
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
                obj = new fabric.Textbox(el.contenido || 'Texto', {
                    left, top,
                    fontSize: el.size_texto || 40,
                    fontFamily: el.tipografia || 'Arial',
                    fontWeight: el.peso || 'normal',
                    fill: el.color || '#FFFFFF',
                    backgroundColor: el.fondo_texto || '',
                    opacity: el.transparencia ? (1 - el.transparencia) : 1,
                    textAlign: txtAlign
                });
                
                const refInBlock = existingInBlock[0];
                const shouldLockToRect = !isFirst && refInBlock && refInBlock.type === 'rect';

                if (shouldLockToRect) {
                    obj.set('width', refInBlock.getScaledWidth());
                } else if (el.width) {
                    obj.set('width', parseInt(el.width));
                }
                // Handle size for marquesina container (use width for preview and store in customProps)
                if (el.tipo === 'marquesina' && el.size) {
                    const sParts = String(el.size).split(',');
                    const w = parseInt(sParts[0]);
                    if (!isNaN(w) && w > 0) {
                        obj.set('width', w);
                    }
                    if (!obj.customProps) obj.customProps = {};
                    obj.customProps.size = el.size;
                }
                
                // Handle radius for text/marquesina background
                if (el.radius) {
                    if (!obj.customProps) obj.customProps = {};
                    obj.customProps.radius = el.radius;
                }

                if (isFirst && String(el.posicion).includes('center')) obj.originX = 'center';

            } else if (el.tipo === 'imagen') {
                fabric.Image.fromURL(el.contenido || 'https://via.placeholder.com/100', function(img) {
                    img.set({left, top});
                    if (el.size) {
                        const sParts = String(el.size).split(',');
                        img.scaleToWidth(parseInt(sParts[0]));
                        img.scaleToHeight(parseInt(sParts[1]));
                    }
                    finalizeObjectCreation(img, blockId, el, isFirst, existingInBlock[0], posParts);
                });
                return; 
            } else if (el.tipo === 'video') {
                let w = 200, h = 112;
                if (el.size) {
                    const sParts = String(el.size).split(',');
                    const pw = parseInt(sParts[0]);
                    const ph = parseInt(sParts[1]);
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

        function finalizeObjectCreation(obj, blockId, el, isFirst, refObj, posParts) {
            obj.blockId = blockId;
            obj.elementType = el.tipo;
            
            // Restore Custom Props
            const standardKeys = ['tipo', 'posicion', 'size', 'size_texto', 'color', 'transparencia', 'tipografia', 'peso', 'fondo_texto', 'radius'];
            if (!obj.customProps) obj.customProps = {};
            for(let key in el) {
                if(!standardKeys.includes(key)) {
                    obj.customProps[key] = el[key];
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
                     obj.set('left', refObj.left + (refObj.getScaledWidth()/2) - (obj.getScaledWidth()/2));
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
                     obj.set('top', refObj.top + (refObj.getScaledHeight()/2) - (obj.getScaledHeight()/2));
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
                     obj.set('left', (canvas.width - obj.getScaledWidth())/2);
                     obj.customProps.alignX = 'center';
                 } else if (valX === 'right') {
                     obj.set('left', canvas.width - obj.getScaledWidth());
                     obj.customProps.alignX = 'right';
                 } else if (valX === 'left') {
                     obj.set('left', 0);
                     obj.customProps.alignX = 'left';
                 } else {
                     obj.set('left', parseInt(valX) || 0);
                 }
                 
                 if (valY === 'center') {
                     obj.set('top', (canvas.height - obj.getScaledHeight())/2);
                     obj.customProps.alignY = 'center';
                 } else if (valY === 'bottom') {
                     obj.set('top', canvas.height - obj.getScaledHeight());
                     obj.customProps.alignY = 'bottom';
                 } else if (valY === 'top') {
                     obj.set('top', 0);
                     obj.customProps.alignY = 'top';
                 } else {
                     obj.set('top', parseInt(valY) || 0);
                 }
                 obj.setCoords();
            }

            canvas.add(obj);
        }

        function updateCanvasSize() {
             const w = prompt("Nuevo Ancho:", canvas.width);
             const h = prompt("Nuevo Alto:", canvas.height);
             if (w && h) {
                 canvas.setWidth(parseInt(w));
                 canvas.setHeight(parseInt(h));
                 document.getElementById('canvas-size-display').innerText = `${w} x ${h}`;
             }
        }