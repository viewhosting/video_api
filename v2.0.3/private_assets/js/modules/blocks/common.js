/**
 * blocks/texto.js
 */
window.BlockRegistry.register('texto', {
    render: (center, blockId) => {
        const obj = new fabric.Textbox('Texto Nuevo', {
            left: center.left - 150, top: center.top - 20,
            fontSize: 40, fontFamily: 'arial',
            fill: '#FFFFFF', width: 300,
            textAlign: 'center'
        });
        window.finalizeAdd(obj, blockId, 'texto');
    },
    properties: (obj, propsGroup) => {
        // Propiedades específicas de texto se manejan en el bloque común de texto de properties.js
        // Pero podríamos moverlo aquí en el futuro.
    }
});

/**
 * blocks/imagen.js
 */
window.BlockRegistry.register('imagen', {
    render: (center, blockId) => {
        const url = prompt("URL de la imagen:", "https://via.placeholder.com/150");
        if (!url) return;
        fabric.Image.fromURL(url, function (img) {
            img.set({ left: center.left - 75, top: center.top - 75 });
            window.finalizeAdd(img, blockId, 'imagen', { contenido: url });
        });
    },
    properties: (obj, propsGroup) => {
        const imgRadius = (obj.customProps && obj.customProps.radius) ? obj.customProps.radius : 0;
        window.addPropInput(propsGroup, 'Redondeo Imagen', imgRadius, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
        });
    }
});
