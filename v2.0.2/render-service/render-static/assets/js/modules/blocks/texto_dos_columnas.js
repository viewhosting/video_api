/**
 * blocks/texto_dos_columnas.js
 */
window.BlockRegistry.register('texto_dos_columnas', {
    render: (center, blockId) => {
        const bg = new fabric.Rect({ width: 400, height: 60, fill: '#333', opacity: 0.5 });
        const t1 = new fabric.Text('COL 1', { fontSize: 24, fill: '#fff', left: 10, top: 15 });
        const t2 = new fabric.Text('COL 2', { fontSize: 24, fill: '#fff', left: 210, top: 15 });

        const obj = new fabric.Group([bg, t1, t2], {
            left: center.left - 200, top: center.top - 30
        });
        window.finalizeAdd(obj, blockId, 'texto_dos_columnas', {
            col1_contenido: "COL 1", col1_size: 24, col1_color: "#FFFFFF",
            col2_contenido: "COL 2", col2_size: 24, col2_color: "#FFFFFF",
        });
    },

    properties: (obj, propsGroup) => {
        const root = document.getElementById('properties');
        const twoColGroup = window.addGroupHeader(root, 'Texto Dos Columnas');
        if (!obj.customProps) obj.customProps = {};

        window.addPropInput(twoColGroup, 'Split %', obj.customProps.split_pct ?? 50, (v) => {
            obj.customProps.split_pct = parseInt(v) || 50;
        });
        window.addPropInput(twoColGroup, 'Gap', obj.customProps.gap ?? 0, (v) => {
            obj.customProps.gap = parseInt(v) || 0;
        });
        window.addPropSelect(twoColGroup, 'Divisor', (obj.customProps.divisor ? 'true' : 'false'), ['false', 'true'], (v) => {
            obj.customProps.divisor = (v === 'true');
        });
        window.addPropInput(twoColGroup, 'Divisor Width', obj.customProps.divisor_width ?? 2, (v) => {
            obj.customProps.divisor_width = parseInt(v) || 2;
        });

        // Columna 1
        const col1Group = window.addGroupHeader(root, 'Columna 1');
        window.addPropInput(col1Group, 'Contenido', obj.customProps.col1_contenido || '', (v) => {
            obj.customProps.col1_contenido = v;
        }, false, 'textarea');
        window.addPropSelect(col1Group, 'Alineación', obj.customProps.col1_align || 'left', ['left', 'center', 'right'], (v) => {
            obj.customProps.col1_align = v;
        });
        window.addPropInput(col1Group, 'Tamaño Texto', obj.customProps.col1_size_texto ?? 24, (v) => {
            obj.customProps.col1_size_texto = parseInt(v) || 24;
        });
        window.addPropColor(col1Group, 'Color', obj.customProps.col1_color || '#FFFFFF', (v) => {
            obj.customProps.col1_color = v;
        });
        window.addPropSelect(col1Group, 'Tipografía', obj.customProps.col1_tipografia || 'montserrat', window.AVAILABLE_FONTS || [], (v) => {
            obj.customProps.col1_tipografia = v;
        });
        window.addPropSelect(col1Group, 'Peso', obj.customProps.col1_peso || 'bold', ['thin', 'bold', 'extrabold'], (v) => {
            obj.customProps.col1_peso = v;
        });
        window.addPropInput(col1Group, 'Borde Grosor', obj.customProps.col1_borde_grosor ?? 0, (v) => {
            obj.customProps.col1_borde_grosor = parseInt(v) || 0;
        });
        window.addPropColor(col1Group, 'Borde Color', obj.customProps.col1_borde_color || '#000000', (v) => {
            obj.customProps.col1_borde_color = v;
        });

        // Columna 2
        const col2Group = window.addGroupHeader(root, 'Columna 2');
        window.addPropInput(col2Group, 'Contenido', obj.customProps.col2_contenido || '', (v) => {
            obj.customProps.col2_contenido = v;
        }, false, 'textarea');
        window.addPropSelect(col2Group, 'Alineación', obj.customProps.col2_align || 'left', ['left', 'center', 'right'], (v) => {
            obj.customProps.col2_align = v;
        });
        window.addPropInput(col2Group, 'Tamaño Texto', obj.customProps.col2_size_texto ?? 18, (v) => {
            obj.customProps.col2_size_texto = parseInt(v) || 18;
        });
        window.addPropColor(col2Group, 'Color', obj.customProps.col2_color || '#FFFFFF', (v) => {
            obj.customProps.col2_color = v;
        });
        window.addPropSelect(col2Group, 'Tipografía', obj.customProps.col2_tipografia || 'montserrat', window.AVAILABLE_FONTS || [], (v) => {
            obj.customProps.col2_tipografia = v;
        });
        window.addPropSelect(col2Group, 'Peso', obj.customProps.col2_peso || 'bold', ['thin', 'bold', 'extrabold'], (v) => {
            obj.customProps.col2_peso = v;
        });
        window.addPropInput(col2Group, 'Borde Grosor', obj.customProps.col2_borde_grosor ?? 0, (v) => {
            obj.customProps.col2_borde_grosor = parseInt(v) || 0;
        });
        window.addPropColor(col2Group, 'Borde Color', obj.customProps.col2_borde_color || '#000000', (v) => {
            obj.customProps.col2_borde_color = v;
        });
    }
});
