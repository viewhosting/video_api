/**
 * BlockRegistry.js
 * Orquestador central para tipos de elementos en el editor.
 */
window.BlockRegistry = {
    blocks: {},

    /**
     * Registra un nuevo tipo de bloque en el sistema.
     * @param {string} type - ID del tipo (ej: 'mapa', 'video')
     * @param {object} config - Configuración (render, properties, fromSchema)
     */
    register(type, config) {
        this.blocks[type] = config;
        console.log(`[Registry] Bloque registrado: ${type}`);
    },

    /**
     * Obtiene la configuración de un bloque.
     */
    get(type) {
        return this.blocks[type];
    }
};

window.finalizeAdd = function (obj, blockId, type, extraProps = {}) {
    if (!obj) return;
    obj.blockId = blockId;
    obj.elementType = type;
    if (extraProps) obj.customProps = { ...obj.customProps, ...extraProps };
    if (window.AppState && window.AppState.canvas) {
        window.AppState.canvas.add(obj);
        window.AppState.canvas.setActiveObject(obj);
    }
    if (window.updateLayersList) window.updateLayersList();
};
