import re
import os

with open("js/original_script.js", "r") as f:
    text = f.read()

# Define the sections
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

# Find indices
indices = {}
for key, pattern in sections.items():
    match = re.search(pattern, text)
    if match:
        indices[key] = match.start()

# Sort keys by index
sorted_keys = sorted(indices.keys(), key=lambda k: indices[k])

blocks = {}
for i, key in enumerate(sorted_keys):
    start = indices[key]
    end = indices[sorted_keys[i+1]] if i + 1 < len(sorted_keys) else len(text)
    blocks[key] = text[start:end]

# Now let's create the modules
os.makedirs("js/modules", exist_ok=True)

# globals.js
with open("js/modules/state.js", "w") as f:
    f.write("export const AppState = {\n")
    f.write("    canvas: null,\n")
    f.write("    activeObject: null,\n")
    f.write("    videoEl: document.getElementById('bg-video-el'),\n")
    f.write("    currentVideoUrl: '',\n")
    f.write("    renderVideoCollapsed: false,\n")
    f.write("    renderModalHidden: false,\n")
    f.write("    bgPreviewTimeSec: 0,\n")
    f.write("    bgVideoLooping: false,\n")
    f.write("    blockConfigs: {},\n")
    f.write("    workspaceZoom: 1,\n")
    f.write("    lastRenderBlobUrl: null\n")
    f.write("};\n")

# Replace globals in all blocks
def replace_globals(code):
    globals_list = ["canvas", "activeObject", "videoEl", "currentVideoUrl", "renderVideoCollapsed", "renderModalHidden", "bgPreviewTimeSec", "bgVideoLooping", "blockConfigs", "workspaceZoom", "lastRenderBlobUrl"]
    for g in globals_list:
        # Match g not preceded by . or variable declaration
        # Need to handle let canvas; which was already in globals section (we skip the globals section)
        code = re.sub(r"(?<![\w\.])" + g + r"(?![\w:])", "AppState." + g, code)
    return code

for k, v in blocks.items():
    if k == "globals": continue # We handle this with state.js manually
    blocks[k] = replace_globals(v)

# Write other modules and export functions
# This script is getting complicated to ensure imports/exports work perfectly in one shot.
# An easier approach to keep the UI working and modularize is to use a single object `window.App` that modules attach to.
