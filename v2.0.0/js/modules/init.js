// --- INITIALIZATION ---
window.initEditor = function () {
    function normalizeCssFamily(name) {
        if (!name) return 'Arial';
        const n = String(name).trim().toLowerCase().replace(/[\s-]/g, '');

        if (window.AVAILABLE_FONTS) {
            const baseFamilies = [...new Set(window.AVAILABLE_FONTS.map(f => f.split(' ')[0]))];
            // Ordenamos de mayor a menor longitud por si hay familias compuestas (ej. OpenSansCondensed)
            baseFamilies.sort((a, b) => b.length - a.length);

            for (const family of baseFamilies) {
                const cleanFamily = family.toLowerCase().replace(/[\s-]/g, '');
                if (n.includes(cleanFamily)) {
                    return family;
                }
            }
        }
        return String(name).trim();
    }
    async function ensureFontLoaded(family, weight) {
        const cssFamily = normalizeCssFamily(family);
        const wMap = {
            'thin': 100, 'extralight': 200, 'light': 300,
            'regular': 400, 'normal': 400, 'medium': 500,
            'semibold': 600, 'bold': 700, 'extrabold': 800, 'black': 900
        };
        const w = parseInt(weight) || wMap[String(weight).toLowerCase()] || 400;
        try {
            await document.fonts.load(`normal ${w} 16px "${cssFamily}"`);
            if (window.fabric && fabric.util && fabric.util.clearFabricFontCache) {
                fabric.util.clearFabricFontCache();
            }
        } catch (e) { }
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

    // Render loop for video
    fabric.util.requestAnimFrame(function render() {
        window.AppState.canvas.renderAll();
        fabric.util.requestAnimFrame(render);
    });
};

window.onSelection = function (e) {
    if (e.selected && e.selected.length > 0) {
        window.AppState.activeObject = e.selected[0];
        renderProperties(window.AppState.activeObject);
        highlightLayer(window.AppState.activeObject);
    }
}

