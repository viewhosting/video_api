import os

# --- CONFIGURACIÓN GLOBAL DE RENDER ---
# Puedes cambiar esto a "PRODUCTION" para calidad completa
RENDER_MODE = os.environ.get("RENDER_MODE", "FAST") 
SKIP_BG_VIDEO = os.environ.get("SKIP_BG_VIDEO", "False").lower() == "true"

# Lógica de escala automática basada en modo
if RENDER_MODE == "FAST":
    os.environ["RENDER_SCALE"] = "0.5" # 50% de resolución (1275x1020)
else:
    os.environ["RENDER_SCALE"] = "1.0"

# --- DIMENSIONES MAESTRAS ---
_render_scale = float(os.environ.get("RENDER_SCALE", "1.0"))

CANVAS_W = int(2550 * _render_scale)
CANVAS_H = int(2040 * _render_scale)

# Asegurar dimensiones pares
if CANVAS_W % 2 != 0: CANVAS_W += 1
if CANVAS_H % 2 != 0: CANVAS_H += 1

FONT_SCALE = 2.5 * _render_scale

# --- COLORES ---
C_BLACK = (20, 20, 20)
C_YELLOW = (230, 200, 30)
C_WHITE = (255, 255, 255)

# --- HELPER DE ESCALA ---
def s(val):
    return int(val * FONT_SCALE)
