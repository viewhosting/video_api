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
            row.innerHTML = `<label>${label}</label>`;
            
            const input = document.createElement('input');
            input.type = 'range';
            input.min = min; input.max = max; input.step = step;
            input.value = value;
            input.style.width = '100%';
            
            input.oninput = (e) => onChange(e.target.value);
            
            row.appendChild(input);
            parent.appendChild(row);
        }
        
window.addPropColor = function(parent, label, value, onChange) {
             const row = document.createElement('div');
            row.className = 'prop-row';
            
            const lbl = document.createElement('label');
            lbl.innerText = label;
            row.appendChild(lbl);
            
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.gap = '5px';

            const inputColor = document.createElement('input');
            inputColor.type = 'color';
            // Handle hex vs rgba issues simply
            const hex = (value && value.startsWith('#')) ? value.substring(0,7) : '#000000';
            inputColor.value = hex;
            
            const inputText = document.createElement('input');
            inputText.type = 'text';
            inputText.className = 'prop-input';
            inputText.value = value;
            inputText.style.flex = 1;

            inputColor.oninput = (e) => {
                inputText.value = e.target.value;
                onChange(e.target.value);
            };
            
            inputText.onchange = (e) => {
                inputColor.value = e.target.value;
                onChange(e.target.value);
            };

            container.appendChild(inputColor);
            container.appendChild(inputText);
            row.appendChild(container);
            parent.appendChild(row);
        }

        