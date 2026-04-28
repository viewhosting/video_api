import re
import os

with open("js/original_script.js", "r") as f:
    text = f.read()

sections = {
    "constants": r"// --- CONSTANTS ---",
    "globals": r"// --- GLOBAL VARIABLES ---",
    "init": r"// --- INITIALIZATION ---",
    "video": r"// --- BACKGROUND VIDEO LOGIC ---",
    "blocks": r"// --- CORE LOGIC: BLOCKS & ELEMENTS ---",
    "render": r"// --- REMOTE RENDER \(GENERAR\) ---",
    "properties": r"// --- PROPERTIES PANEL ---",
    "ui_helpers": r"// --- UI HELPERS ---",
    "layers": r"// --- LAYERS LIST LOGIC ---",
    "json": r"// --- JSON HANDLING ---"
}

indices = {}
for key, pattern in sections.items():
    match = re.search(pattern, text)
    if match:
        indices[key] = match.start()

sorted_keys = sorted(indices.keys(), key=lambda k: indices[k])
blocks = {}
for i, key in enumerate(sorted_keys):
    start = indices[key]
    end = indices[sorted_keys[i+1]] if i + 1 < len(sorted_keys) else len(text)
    blocks[key] = text[start:end]

os.makedirs("js/modules", exist_ok=True)

state_code = """// --- GLOBAL VARIABLES ---
window.AppState = {
    canvas: null,
    activeObject: null,
    videoEl: document.getElementById('bg-video-el'),
    currentVideoUrl: "",
    renderVideoCollapsed: false,
    renderModalHidden: false,
    bgPreviewTimeSec: 0,
    bgVideoLooping: false,
    blockConfigs: {},
    workspaceZoom: 1,
    lastRenderBlobUrl: null
};
"""
with open("js/modules/state.js", "w") as f:
    f.write(state_code)

def process_code(code):
    g_list = ["canvas", "activeObject", "videoEl", "currentVideoUrl", "renderVideoCollapsed", "renderModalHidden", "bgPreviewTimeSec", "bgVideoLooping", "blockConfigs", "workspaceZoom", "lastRenderBlobUrl"]
    for g in g_list:
        code = re.sub(r"(?<![\w\.])" + g + r"(?![\w:])", "window.AppState." + g, code)
    
    code = re.sub(r"^ {8}function ([a-zA-Z0-9_]+)\((.*?)\) \{", r"window.\1 = function(\2) {", code, flags=re.MULTILINE)
    code = re.sub(r"^ {8}async function ([a-zA-Z0-9_]+)\((.*?)\) \{", r"window.\1 = async function(\2) {", code, flags=re.MULTILINE)
    
    return code

for key in sorted_keys:
    if key == "globals": continue
    
    code = blocks[key]
    
    if key == "constants":
        code = code.replace("const AVAILABLE_FONTS", "window.AVAILABLE_FONTS")
        code = code.replace("const WEIGHT_MAP", "window.WEIGHT_MAP")
        with open("js/modules/constants.js", "w") as f:
            f.write(code)
        continue
        
    if key == "init":
        code = process_code(code)
        code = code.replace("window.onload = function() {", "window.initEditor = function() {")
        with open("js/modules/init.js", "w") as f:
            f.write(code)
        continue

    code = process_code(code)
    with open(f"js/modules/{key}.js", "w") as f:
        f.write(code)

main_code = """import './modules/constants.js';
import './modules/state.js';
import './modules/init.js';
import './modules/video.js';
import './modules/blocks.js';
import './modules/render.js';
import './modules/properties.js';
import './modules/ui_helpers.js';
import './modules/layers.js';
import './modules/json.js';

window.addEventListener('DOMContentLoaded', () => {
    if (window.initEditor) {
        window.initEditor();
    }
});
"""

with open("js/main.js", "w") as f:
    f.write(main_code)

print("Modularization complete.")
