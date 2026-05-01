// --- RENDER TOOLS ---

window.getBlocks = function () {
    const blocks = new Set();
    window.AppState.canvas.getObjects().forEach(obj => {
        if (obj.blockId) blocks.add(obj.blockId);
    });
    return Array.from(blocks).sort((a, b) => {
        const numA = parseInt(a.replace('bloque_', '')) || 999;
        const numB = parseInt(b.replace('bloque_', '')) || 999;
        return numA - numB;
    });
}

window.addBlock = function () {
    const currentCount = getBlocks().length;
    const blockId = 'bloque_' + (currentCount + 1);
    // Just creating the ID concept for now
    // Maybe add a dummy hidden object to persist the block if empty?
    // For now, we rely on adding elements to it.
    alert(`Bloque creado: ${blockId}. Ahora agrega elementos a él.`);
    return blockId;
}

window.getActiveBlockId = function () {
    const blocks = getBlocks();
    if (blocks.length === 0) return 'bloque_1';
    // Default to last
    return blocks[blocks.length - 1];
}

window.addElement = function (type) {
    // Selección inteligente de bloque
    let defaultBlock = getActiveBlockId();
    if (window.AppState.activeObject && window.AppState.activeObject.blockId) {
        defaultBlock = window.AppState.activeObject.blockId;
    }

    const blockId = prompt("ID del Bloque:", defaultBlock);
    if (!blockId) return;

    const center = window.AppState.canvas.getCenter();
    const config = window.BlockRegistry.get(type);

    if (config && config.render) {
        config.render(center, blockId);
    } else {
        console.warn(`[Render] El tipo de bloque "${type}" no está registrado o no tiene función de renderizado.`);
    }
}