// --- UI HELPERS ---

window.addGroupHeader = function(parent, text) {
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

window.addPropInput = function(parent, label, value, onChange, readonly=false, type='text') {
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

window.addPropSelect = function(parent, label, value, options, onChange) {
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

window.addPropRange = function(parent, label, value, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';
    
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '4px';
    
    const lbl = document.createElement('label');
    lbl.innerText = label;
    lbl.style.margin = '0';
    
    const valDisplay = document.createElement('span');
    valDisplay.innerText = value + (label.includes('%') ? '%' : '');
    valDisplay.style.fontSize = '0.7rem';
    valDisplay.style.color = 'var(--accent)';
    
    header.appendChild(lbl);
    header.appendChild(valDisplay);
    row.appendChild(header);
    
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step;
    input.value = value;
    input.style.width = '100%';
    
    input.oninput = (e) => {
        valDisplay.innerText = e.target.value + (label.includes('%') ? '%' : '');
        onChange(e.target.value);
    };
    
    row.appendChild(input);
    parent.appendChild(row);
}
        
window.addPropColor = function (parent, label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('label');
    lbl.innerText = label;
    row.appendChild(lbl);

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';

    const pickrEl = document.createElement('div');
    pickrEl.className = 'color-picker';
    container.appendChild(pickrEl);

    const inputText = document.createElement('input');
    inputText.type = 'text';
    inputText.className = 'prop-input';
    inputText.value = value || '';
    inputText.style.flex = 1;
    container.appendChild(inputText);

    row.appendChild(container);
    parent.appendChild(row);

    // Initialize Pickr
    const pickr = Pickr.create({
        el: pickrEl,
        theme: 'nano',
        default: value || '#FFFFFF',
        comparison: false,
        components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
                hex: true,
                rgba: true,
                input: true,
                save: true
            }
        }
    });

    pickr.on('change', (color) => {
        const rgba = color.toRGBA().toString(0); // 0 decimals
        inputText.value = rgba;
        onChange(rgba);
    }).on('save', (color) => {
        pickr.hide();
    });

    inputText.onchange = (e) => {
        pickr.setColor(e.target.value);
        onChange(e.target.value);
    };
}

window.addPropGradient = function (parent, label, cfg, onChange) {
    const container = document.createElement('div');
    container.className = 'prop-group-sub';
    container.style.borderLeft = '2px solid #333';
    container.style.paddingLeft = '10px';
    container.style.marginBottom = '10px';

    const lbl = document.createElement('div');
    lbl.style.fontSize = '0.75rem';
    lbl.style.color = '#888';
    lbl.style.marginBottom = '8px';
    lbl.innerText = label;
    container.appendChild(lbl);

    const colorsGrid = document.createElement('div');
    colorsGrid.style.display = 'grid';
    colorsGrid.style.gridTemplateColumns = '1fr 1fr';
    colorsGrid.style.gap = '8px';
    container.appendChild(colorsGrid);

    // Color 1
    window.addPropColor(colorsGrid, 'Color 1', cfg.color1 || '#FFFFFF', (v) => {
        cfg.color1 = v;
        onChange(cfg);
    });

    // Color 2
    window.addPropColor(colorsGrid, 'Color 2', cfg.color2 || '#000000', (v) => {
        cfg.color2 = v;
        onChange(cfg);
    });

    // Orientation & Midpoint
    const controlsGrid = document.createElement('div');
    controlsGrid.style.display = 'grid';
    controlsGrid.style.gridTemplateColumns = '1fr 1fr';
    controlsGrid.style.gap = '8px';
    controlsGrid.style.marginTop = '8px';
    container.appendChild(controlsGrid);

    window.addPropSelect(controlsGrid, 'Dirección', cfg.orientation || 'vertical', ['vertical', 'horizontal'], (v) => {
        cfg.orientation = v;
        onChange(cfg);
    });

    window.addPropRange(controlsGrid, 'Punto Medio (%)', cfg.midpoint || 50, 0, 100, 1, (v) => {
        cfg.midpoint = parseInt(v);
        onChange(cfg);
    });

    parent.appendChild(container);
}