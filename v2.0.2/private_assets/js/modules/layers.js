// --- LAYERS LIST LOGIC ---
window.updateLayersList = function() {
            const list = document.getElementById('layers-list');
            list.innerHTML = '';
            
            // Group objects by Block ID
            const blocks = {};
            window.AppState.canvas.getObjects().forEach(obj => {
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
                    if (obj === window.AppState.activeObject) item.classList.add('active');
                    
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
                        window.AppState.canvas.setActiveObject(obj);
                        window.AppState.canvas.requestRenderAll();
                    };
                    
                    groupDiv.appendChild(item);
                });
                
                list.appendChild(groupDiv);
            });

            if (typeof updateTimelineFromBlocks === 'function') {
                updateTimelineFromBlocks();
            }
        }
        
window.moveLayerUp = function(obj) {
            window.AppState.canvas.bringForward(obj);
            updateLayersList();
        }

window.moveLayerDown = function(obj) {
            window.AppState.canvas.sendBackwards(obj);
            updateLayersList();
        }
        
window.selectBlock = function(blockId) {
            const objs = window.AppState.canvas.getObjects().filter(o => o.blockId === blockId && !o.isMarquesinaOverlay);
            if (objs.length) {
                const sel = new fabric.ActiveSelection(objs, { canvas: window.AppState.canvas });
                window.AppState.canvas.setActiveObject(sel);
                window.AppState.canvas.requestRenderAll();
            }
            const label = document.getElementById('top-header-block-label');
            if (label) {
                label.innerText = 'Bloque activo: ' + blockId;
            }
        }

window.highlightLayer = function(obj) {
            updateLayersList(); 
        }

        