// --- INITIALIZATION ---
window.initEditor = function () {
    function normalizeCssFamily(family, weight) {
        if (!family) return 'Arial';
        let f = String(family).trim();
        const w = String(weight || 'regular').toLowerCase();

        // Si ya es un nombre completo (ej. "Montserrat Bold"), lo dejamos
        if (f.toLowerCase().includes('bold') || f.toLowerCase().includes('light') || f.toLowerCase().includes('black')) {
            return f;
        }

        // Mapeo inteligente de variantes a nombres únicos de fonts.css
        if (f === 'Montserrat' || f === 'OpenSans' || f === 'Roboto') {
            if (w === 'bold' || w === '700') return f + ' Bold';
            if (w === 'thin' || w === '100') return f + ' Thin';
            if (w === 'black' || w === '900') return f + ' Black';
            if (w === 'light' || w === '300') return f + ' Light';
            if (w === 'medium' || w === '500') return f + ' Medium';
            if (w === 'semibold' || w === '600') return f + ' SemiBold';
            return f + ' Regular';
        }
        return f;
    }
    async function ensureFontLoaded(family, weight) {
        const cssFamily = normalizeCssFamily(family, weight);
        try {
            // Intentamos cargar con el nombre exacto (peso 400 ya que el nombre define el estilo)
            await document.fonts.load(`normal 400 16px "${cssFamily}"`);
            if (window.fabric && fabric.util && fabric.util.clearFabricFontCache) {
                fabric.util.clearFabricFontCache();
            }
        } catch (e) { console.warn('Font load error:', cssFamily, e); }
    }
    window.normalizeCssFamily = normalizeCssFamily;
    window.ensureFontLoaded = ensureFontLoaded;

    window.AppState.canvas = new fabric.Canvas('c', {
        width: 1020,
        height: 816,
        backgroundColor: 'transparent', // Transparent to see CSS bg or video
        preserveObjectStacking: true,
        selectionColor: 'rgba(0, 122, 204, 0.1)',
        selectionBorderColor: '#007acc'
    });

    // Set a default background color logic if no video
    window.AppState.canvas.setBackgroundColor('#000000', window.AppState.canvas.renderAll.bind(window.AppState.canvas));

    window.AppState.canvas.on('selection:created', onSelection);
    window.AppState.canvas.on('selection:updated', onSelection);
    window.AppState.canvas.on('selection:cleared', () => {
        window.AppState.activeObject = null;
        renderProperties(null);
        highlightLayer(null);
    });

    window.AppState.canvas.on('object:modified', (e) => {
        if (window.AppState.activeObject) {
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

            renderProperties(window.AppState.activeObject);
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

    fabric.util.requestAnimFrame(function render() {
        window.AppState.canvas.renderAll();
        fabric.util.requestAnimFrame(render);
    });

    // --- PRE-CARGA DE FFMPEG (DESPUÉS DE TODO) ---
    // Esperamos a que todas las tipografías estén listas antes de cargar el motor pesado
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            setTimeout(() => {
                if (window.initFFmpeg) {
                    console.log('[System] Todo listo (Fonts OK). Iniciando pre-carga de FFmpeg...');
                    window.initFFmpeg(true).catch(err => console.warn('Pre-carga diferida fallida:', err));
                }
            }, 5000); // 5 segundos extra de cortesía
        });
    }
};

window.onSelection = function (e) {
    if (e.selected && e.selected.length > 0) {
        window.AppState.activeObject = e.selected[0];
        renderProperties(window.AppState.activeObject);
        highlightLayer(window.AppState.activeObject);
    }
}

