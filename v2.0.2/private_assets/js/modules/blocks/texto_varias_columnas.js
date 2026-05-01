/**
 * blocks/texto_varias_columnas.js
 */

if (typeof fabric !== 'undefined') {
    fabric.MultiColumnText = fabric.util.createClass(fabric.Rect, {
        type: 'texto_varias_columnas',
        _render: function (ctx) {
            // 1. Dibuja el fondo del contenedor principal (Rect estándar)
            this.callSuper('_render', ctx);

            if (!this.customProps || !this.customProps.columnas) return;

            const cols = this.customProps.columnas;
            const totalW = this.width;
            const totalH = this.height;
            let currentX = -totalW / 2;

            cols.forEach(col => {
                let colW = 100;
                if (String(col.width).includes('%')) {
                    colW = (parseFloat(col.width) / 100) * totalW;
                } else {
                    colW = parseFloat(col.width) || 100;
                }

                ctx.save();

                // 2. Dibujar fondo de columna
                if (col.bg_color) {
                    ctx.save();
                    const opacity = col.bg_transparencia != null ? col.bg_transparencia : 1;
                    ctx.globalAlpha = opacity;
                    ctx.fillStyle = col.bg_color;
                    ctx.fillRect(currentX, -totalH / 2, colW, totalH);
                    ctx.restore();
                }

                // 3. Dibujar bordes de columna
                if (col.borde_grosor > 0) {
                    ctx.save();
                    const bOpacity = col.borde_transparencia != null ? col.borde_transparencia : 1;
                    ctx.globalAlpha = bOpacity;
                    ctx.strokeStyle = col.borde_color || '#FFFFFF';
                    ctx.lineWidth = col.borde_grosor;

                    const sides = String(col.borde_lados || 'all').toLowerCase();
                    const x1 = currentX;
                    const x2 = currentX + colW;
                    const y1 = -totalH / 2;
                    const y2 = totalH / 2;

                    ctx.beginPath();
                    if (sides.includes('all')) {
                        ctx.strokeRect(x1, y1, colW, totalH);
                    } else {
                        if (sides.includes('top')) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); }
                        if (sides.includes('bottom')) { ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); }
                        if (sides.includes('left')) { ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); }
                        if (sides.includes('right')) { ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); }
                    }
                    ctx.stroke();
                    ctx.restore();
                }

                // 4. Renderizar texto de columna
                const fontSize = col.size_texto || this.fontSize || 18;
                const fontWeight = col.peso || 'bold';
                const fontFamily = col.tipografia || 'Montserrat';
                const color = col.color || '#FFFFFF';
                const align = col.alineacion || 'center';

                const weightMap = { 'thin': 100, 'light': 300, 'regular': 400, 'medium': 500, 'bold': 700, 'extrabold': 800, 'black': 900 };
                const finalWeight = weightMap[fontWeight.toLowerCase()] || fontWeight;

                const normalizedFamily = window.normalizeCssFamily ? window.normalizeCssFamily(fontFamily, fontWeight) : fontFamily;
                ctx.font = `${finalWeight} ${fontSize}px "${normalizedFamily}"`;
                ctx.fillStyle = color;
                ctx.textBaseline = 'middle';
                ctx.textAlign = align;

                let textX = currentX;
                if (align === 'center') textX += colW / 2;
                else if (align === 'right') textX += colW;

                // Padding fijo de 5px como en v2.0.0
                if (align === 'left') textX += 5;
                if (align === 'right') textX -= 5;

                ctx.fillText(col.contenido || '', textX, 0);

                ctx.restore();
                currentX += colW + (this.customProps.gap || 0);
            });
        }
    });
}

window.BlockRegistry.register('texto_varias_columnas', {
    render: (center, blockId) => {
        const obj = new fabric.MultiColumnText({
            left: center.left - 400, top: center.top - 25,
            width: 800, height: 50,
            fill: 'rgba(68, 68, 68, 0.5)'
        });
        obj.set({ rx: 5, ry: 5 });
        window.finalizeAdd(obj, blockId, 'texto_varias_columnas', { columnas: [] });
    },
    properties: (obj, propsGroup) => {
        if (!obj.customProps) obj.customProps = {};

        window.addPropInput(propsGroup, 'Interlineado', obj.customProps.interlineado || 5, (v) => {
            obj.customProps.interlineado = parseInt(v) || 5;
            obj.set('dirty', true);
            window.AppState.canvas.requestRenderAll();
        }, false, 'number');

        window.addPropInput(propsGroup, 'Gap Columnas', obj.customProps.gap || 0, (v) => {
            obj.customProps.gap = parseInt(v) || 0;
            obj.set('dirty', true);
            window.AppState.canvas.requestRenderAll();
        }, false, 'number');

        window.addPropInput(propsGroup, 'Padding (T,R,B,L)', obj.customProps.padding || '0', (v) => {
            obj.customProps.padding = v;
            obj.set('dirty', true);
            window.AppState.canvas.requestRenderAll();
        });

        window.addPropInput(propsGroup, 'Tamaño (W, H)', obj.customProps.size || `${obj.width}, ${obj.height}`, (v) => {
            const s = String(v).split(',');
            obj.set({ width: parseInt(s[0]) || obj.width, height: parseInt(s[1]) || obj.height });
            obj.customProps.size = v;
            obj.set('dirty', true);
            window.AppState.canvas.requestRenderAll();
        });

        const bordeG = obj.customProps.borde_grosor || 0;
        window.addPropInput(propsGroup, 'Borde Grosor', bordeG, (v) => {
            obj.customProps.borde_grosor = parseInt(v) || 0;
            obj.set('dirty', true);
            window.AppState.canvas.requestRenderAll();
        }, false, 'number');

        if (!Array.isArray(obj.customProps.columnas)) obj.customProps.columnas = [];
        const cols = obj.customProps.columnas;

        const colsContainer = document.createElement('div');
        colsContainer.style = 'display:flex; flex-direction:column; gap:15px; margin-top:15px; border-top:1px solid #333; padding-top:15px;';
        propsGroup.appendChild(colsContainer);

        cols.forEach((col, idx) => {
            const card = document.createElement('div');
            card.style = 'border-bottom:1px solid #222; padding-bottom:15px; margin-bottom:15px;';
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:0.75rem; font-weight:bold; color:#aaa;">COLUMNA ${idx + 1}</span>
                <button class="btn-del-col" style="background:#f44336; color:white; border:none; padding:2px 8px; border-radius:3px; cursor:pointer; font-size:0.65rem;">Eliminar</button>
            </div>`;

            const delBtn = card.querySelector('.btn-del-col');
            delBtn.onclick = () => {
                cols.splice(idx, 1);
                obj.set('dirty', true);
                window.renderProperties(obj);
            };

            const grid = document.createElement('div');
            grid.style = 'display:grid; grid-template-columns: 1fr 1fr; gap:10px;';
            card.appendChild(grid);

            window.addPropInput(grid, 'Ancho (% o px)', col.width || '20%', (v) => { col.width = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });
            window.addPropSelect(grid, 'Alineación', col.alineacion || 'center', ['left', 'center', 'right'], (v) => { col.alineacion = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });
            window.addPropColor(grid, 'Color', col.color || '#FFFFFF', (v) => { col.color = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });

            const fonts = window.AVAILABLE_FONTS || ['Arial', 'Montserrat Bold', 'Montserrat Regular'];
            window.addPropSelect(grid, 'Tipografía', col.tipografia || 'Montserrat', fonts, (v) => {
                col.tipografia = v;
                obj.set('dirty', true);
                window.AppState.canvas.requestRenderAll();
            });

            window.addPropInput(grid, 'Tamaño Fuente', col.size_texto || 20, (v) => { col.size_texto = parseInt(v); obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); }, false, 'number');
            window.addPropSelect(grid, 'Peso', col.peso || 'bold', ['thin', 'light', 'regular', 'medium', 'bold', 'extrabold', 'black'], (v) => { col.peso = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });

            window.addPropColor(card, 'Color Fondo', col.bg_color || '', (v) => { col.bg_color = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });
            window.addPropRange(card, 'Transparencia Fondo', col.bg_transparencia || 0, 0, 1, 0.1, (v) => { col.bg_transparencia = parseFloat(v); obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });

            const borderGrid = document.createElement('div');
            borderGrid.style = 'display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:5px;';
            card.appendChild(borderGrid);

            window.addPropInput(borderGrid, 'Grosor Borde', col.borde_grosor || 0, (v) => { col.borde_grosor = parseInt(v); obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); }, false, 'number');
            window.addPropColor(borderGrid, 'Color Borde', col.borde_color || '#FFFFFF', (v) => { col.borde_color = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });

            window.addPropRange(card, 'Transparencia Borde', col.borde_transparencia || 0, 0, 1, 0.1, (v) => { col.borde_transparencia = parseFloat(v); obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });
            window.addPropInput(card, 'Lados (T,R,B,L)', col.borde_lados || 'all', (v) => { col.borde_lados = v; obj.set('dirty', true); window.AppState.canvas.requestRenderAll(); });

            colsContainer.appendChild(card);
        });

        const addBtn = document.createElement('button');
        addBtn.innerText = '+ Agregar Columna';
        addBtn.style = 'margin-top:10px; width:100%; cursor:pointer; padding:8px; background:#4f46e5; border:none; border-radius:5px; color:white;';
        addBtn.onclick = () => {
            cols.push({ contenido: 'Nueva', width: '20%', alineacion: 'center', color: '#FFFFFF', tipografia: 'Montserrat', peso: 'bold' });
            obj.set('dirty', true);
            window.renderProperties(obj);
        };
        propsGroup.appendChild(addBtn);
    }
});
