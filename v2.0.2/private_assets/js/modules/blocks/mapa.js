/**
 * blocks/mapa.js
 * Lógica independiente para el bloque de Mapa (Google/Yandex)
 */
window.BlockRegistry.register('mapa', {
    /**
     * Creación inicial desde el botón de herramientas
     */
    render: (center, blockId) => {
        const defaultLat = -34.603722;
        const defaultLng = -58.381591;
        const defaultZoom = 15;
        const placeholderUrl = `https://via.placeholder.com/400x300?text=Cargando+Mapa+GPS...`;

        fabric.Image.fromURL(placeholderUrl, function (img) {
            img.set({
                left: center.left - 150,
                top: center.top - 112,
                width: 300,
                height: 225
            });
            window.finalizeAdd(img, blockId, 'mapa', {
                lat: defaultLat,
                lng: defaultLng,
                zoom: defaultZoom,
                map_type: 'roadmap',
                con_pin: true,
                provider: 'google'
            });
            if (window.updateMapImage) window.updateMapImage(img);
        });
    },

    /**
     * Generación del panel de propiedades derecho
     */
    properties: (obj, propsGroup) => {
        const mapGroup = document.createElement('div');
        mapGroup.className = 'prop-card-body';
        propsGroup.appendChild(mapGroup);

        window.addPropInput(mapGroup, 'Latitud (GPS)', obj.customProps.lat || 0, (v) => {
            obj.customProps.lat = parseFloat(v);
            window.updateMapImage(obj);
        }, false, 'number');

        window.addPropInput(mapGroup, 'Longitud (GPS)', obj.customProps.lng || 0, (v) => {
            obj.customProps.lng = parseFloat(v);
            window.updateMapImage(obj);
        }, false, 'number');

        window.addPropRange(mapGroup, 'Zoom', obj.customProps.zoom || 15, 1, 21, 1, (v) => {
            obj.customProps.zoom = parseInt(v);
            window.updateMapImage(obj);
        });

        window.addPropSelect(mapGroup, 'Tipo Mapa', obj.customProps.map_type || 'map', ['map', 'sat'], (v) => {
            obj.customProps.map_type = v;
            window.updateMapImage(obj);
        });

        window.addPropSelect(mapGroup, 'Proveedor', obj.customProps.provider || 'google', ['google', 'yandex'], (v) => {
            obj.customProps.provider = v;
            window.updateMapImage(obj);
        });

        window.addPropInput(mapGroup, 'Redondeo', obj.customProps.radius || 0, (v) => {
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
});

/**
 * Función auxiliar para actualizar la imagen del mapa (específica de este bloque)
 */
window.updateMapImage = function (obj) {
    if (!obj || obj.elementType !== 'mapa') return;
    const cp = obj.customProps || {};
    const lat = cp.lat || 0;
    const lng = cp.lng || 0;
    const zoom = cp.zoom || 15;
    const type = cp.map_type || 'roadmap';
    const provider = cp.provider || 'google';
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
        obj.customProps.contenido = url;
        window.AppState.canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
}
