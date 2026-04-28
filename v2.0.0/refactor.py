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
    "layers": r"// --- LAYERS PANEL ---",
    "timeline": r"// --- TIMELINE ---",
    "json": r"// --- JSON IMPORT / EXPORT ---"
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

globals_code = """export const AppState = {
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
    f.write(globals_code)

def replace_globals(code):
    g_list = ["canvas", "activeObject", "videoEl", "currentVideoUrl", "renderVideoCollapsed", "renderModalHidden", "bgPreviewTimeSec", "bgVideoLooping", "blockConfigs", "workspaceZoom", "lastRenderBlobUrl"]
    for g in g_list:
        code = re.sub(r"(?<![\w\.])" + g + r"(?![\w:])", "AppState." + g, code)
    return code

def extract_funcs_and_export(code):
    # Find all function declarations to export them
    funcs = re.findall(r"^ *(async function|function) ([a-zA-Z0-9_]+)\(", code, flags=re.MULTILINE)
    func_names = [f[1] for f in funcs]
    
    # Replace "function foo" with "export function foo"
    code = re.sub(r"^ *(async function|function) ([a-zA-Z0-9_]+)\(", r"export \1 \2(", code, flags=re.MULTILINE)
    return code, func_names

all_exports = {}

for key in sorted_keys:
    if key == "globals": continue
    
    code = blocks[key]
    code = replace_globals(code)
    
    # constants handles differently
    if key == "constants":
        code = code.replace("const AVAILABLE_FONTS", "export const AVAILABLE_FONTS")
        code = code.replace("const WEIGHT_MAP", "export const WEIGHT_MAP")
        with open("js/modules/constants.js", "w") as f:
            f.write(code)
        continue

    # Other files need AppState imported
    code, funcs = extract_funcs_and_export(code)
    all_exports[key] = funcs
    
    # In 'init', window.onload should be an exported function initApp()
    if key == "init":
        code = code.replace("window.onload = function() {", "export function initApp() {")
        all_exports["init"].append("initApp")
        
    final_code = "import { AppState } from './state.js';\n"
    
    # To fix internal calls between modules, we would need to import all other functions...
    # This is getting too complex. The easiest way is to use a single App object.
    pass

# ALTERNATIVE REFACTOR STRATEGY:
# Just wrap everything in js/app.js, attach to window, but split into logical files that add to window.App
