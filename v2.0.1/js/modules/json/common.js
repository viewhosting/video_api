/**
 * json/ui.js
 * Gestión de modales y diálogos relacionados con JSON y Configuración.
 */

window.showSettingsModal = function () {
    const el = document.getElementById('settings-modal');
    if (el) el.style.display = 'flex';
}

window.closeSettingsModal = function () {
    const el = document.getElementById('settings-modal');
    if (el) el.style.display = 'none';
}

window.showJsonModal = function () {
    if (window.generateJson) {
        const json = window.generateJson();
        const area = document.getElementById('json-textarea');
        if (area) area.value = JSON.stringify(json, null, 4);
    }
    const el = document.getElementById('json-modal');
    if (el) el.style.display = 'flex';
}

window.closeJsonModal = function () {
    const el = document.getElementById('json-modal');
    if (el) el.style.display = 'none';
}

/**
 * json/utils.js
 * Utilidades matemáticas y de parsing para el manejo de JSON.
 */

window.parseValue = function (valStr, referenceSize) {
    if (valStr === undefined || valStr === null || valStr === '') return 0;
    valStr = String(valStr).trim().toLowerCase();
    if (valStr.endsWith('%')) {
        const percent = parseFloat(valStr.replace('%', '')) / 100.0;
        return referenceSize * percent;
    }
    const num = parseFloat(valStr);
    return isNaN(num) ? 0 : num;
};

window.getGlobalDurationForTimeline = function () {
    const inicioEl = document.getElementById('conf-inicio');
    const finEl = document.getElementById('conf-fin');
    let start = 0, end = 0;
    if (inicioEl?.value) {
        const v = parseFloat(inicioEl.value);
        if (!isNaN(v) && v >= 0) start = v;
    }
    if (finEl?.value) {
        const v = parseFloat(finEl.value);
        if (!isNaN(v) && v > start) end = v;
    }
    if (end <= start) end = start + 10;
    return { start, end, total: end - start };
}
