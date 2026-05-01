/**
 * blocks/video.js
 * Lógica independiente para el bloque de Video
 */
window.BlockRegistry.register('video', {
    /**
     * Creación inicial
     */
    render: (center, blockId) => {
        const url = prompt("URL del video:", "https://www.cdev.mx/comercial.mp4");
        if (!url) return;
        const obj = new fabric.Rect({
            left: center.left - 100,
            top: center.top - 56,
            width: 200,
            height: 112,
            fill: '#000000',
            stroke: '#ffffff',
            strokeDashArray: [6, 4]
        });
        window.finalizeAdd(obj, blockId, 'video', {
            contenido: url,
            radius: 30,
            padding: "10,10",
            margin: "10,10"
        });
    },

    /**
     * Panel de Propiedades
     */
    properties: (obj, propsGroup) => {
        const videoGroup = document.createElement('div');
        videoGroup.className = 'prop-card-body';
        propsGroup.appendChild(videoGroup);

        window.addPropInput(videoGroup, 'URL Video', (obj.customProps && obj.customProps.contenido) || '', (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.contenido = v;
        });

        const vidRadius = (obj.customProps && obj.customProps.radius) ? obj.customProps.radius : 0;
        window.addPropInput(videoGroup, 'Redondeo Video', vidRadius, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
        });

        const padVal = (obj.customProps && obj.customProps.padding) || '10,10';
        window.addPropInput(videoGroup, 'Padding (X,Y)', padVal, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.padding = v;
        });

        const marginValVideo = (obj.customProps && obj.customProps.margin) || '10,10';
        window.addPropInput(videoGroup, 'Margin (X,Y)', marginValVideo, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.margin = v;
        });
    }
});
