/**
 * blocks/rectangulo.js
 */

window.BlockRegistry.register('rectangulo', {
    render: (center, blockId) => {
        const obj = new fabric.RoundedRect({
            left: center.left - 100, top: center.top - 50,
            fill: '#FFFB00', width: 200, height: 100
        });
        window.finalizeAdd(obj, blockId, 'rectangulo');
    },
    properties: (obj, propsGroup) => {
        const currentRadius = (obj.customProps && obj.customProps.radius) || "0,0,0,0";
        window.addPropInput(propsGroup, 'Redondeo (TL, TR, BR, BL)', currentRadius, (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.radius = v;
            obj.set('dirty', true);
            window.AppState.canvas.requestRenderAll();
        });
        
        // Color / Degradado
        const colorVal = (obj.customProps && obj.customProps.color) || obj.fill;
        window.addPropColor(propsGroup, 'Color', (typeof colorVal === 'string' ? colorVal : '#FFFFFF'), (v) => {
            if (!obj.customProps) obj.customProps = {};
            obj.customProps.color = v;
            obj.set('fill', v);
            window.AppState.canvas.requestRenderAll();
        });
    }
});
