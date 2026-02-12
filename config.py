import os
import glob
import numpy as np
import PIL.Image
import PIL.ImageDraw
from moviepy.editor import ImageClip
from PIL import ImageFont

# Monkey patch for Pillow 10+ where ANTIALIAS was removed
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS

# --- 1. DIMENSIONES MAESTRAS ---
# Leemos escala global (default 1.0)
_render_scale = float(os.environ.get("RENDER_SCALE", "1.0"))

CANVAS_W = int(2550 * _render_scale)
CANVAS_H = int(2040 * _render_scale)

# Asegurar dimensiones pares
if CANVAS_W % 2 != 0: CANVAS_W += 1
if CANVAS_H % 2 != 0: CANVAS_H += 1

FONT_SCALE = 2.5 * _render_scale

# --- 2. COLORES ---
C_BLACK = (20, 20, 20)
C_YELLOW = (230, 200, 30)
C_WHITE = (255, 255, 255)

# --- 3. HELPER DE ESCALA ---
def s(val):
    return int(val * FONT_SCALE)

# --- 4. GESTOR DE TIPOGRAFÍAS (TU NUEVA LÓGICA) ---
# IMPORTANTE: Estas fuentes deben estar instaladas en tu Mac.
# Si no tienes "Montserrat", cambiará a Arial automáticamente.
FONTS = {
    "arial": {
        "thin": "Arial",
        "regular": "Arial",
        "bold": "Arial-Bold",
        "extrabold": "Arial-Black"
    },
    "roboto": {
        "thin": "Roboto-Thin",
        "regular": "Roboto-Regular",
        "bold": "Roboto-Bold",
        "extrabold": "Roboto-Black"
    },
    "montserrat": {
        "thin": "Montserrat-Thin",
        "regular": "Montserrat-Regular",
        "bold": "Montserrat-Bold",
        "extrabold": "Montserrat-ExtraBold"
    },
    "impact": {
        "regular": "Impact",
        "bold": "Impact"
    },
    "awasome": {
        "regular": "FontAwesome"
    }
}

def get_font(family="arial", weight="bold"):
    """Devuelve el nombre exacto de la fuente para ImageMagick"""
    family = family.lower().strip()
    weight = weight.lower().strip()
    
    # Busca la familia, si no existe usa Arial
    font_map = FONTS.get(family, FONTS["arial"])
    
    # Busca el peso, si no existe usa regular o el primero disponible
    return font_map.get(weight, font_map.get("regular", "Arial"))

def get_pil_font_path(font_family, font_weight):
    """
    Intenta resolver la ruta del archivo de fuente para PIL de forma dinámica.
    Escanea la carpeta fonts/ y busca la mejor coincidencia.
    """
    family = font_family.lower().strip().replace(" ", "")
    weight = font_weight.lower().strip().replace(" ", "")
    
    project_fonts = os.path.join(os.getcwd(), "fonts")
    
    # 1. Listar candidatos
    candidates = []
    if os.path.exists(project_fonts):
        for f in os.listdir(project_fonts):
            if f.lower().endswith((".ttf", ".otf")):
                candidates.append(f)
    
    # 2. Filtrar por Familia
    # Normalizamos el nombre del archivo para buscar la familia
    # Ej: "OpenSans-Bold.ttf" -> "opensansboldttf"
    family_matches = []
    for f in candidates:
        f_norm = f.lower().replace("-", "").replace("_", "").replace(" ", "")
        if family in f_norm:
            family_matches.append(f)
            
    if not family_matches:
        # Fallback seguro
        return os.path.join(project_fonts, "Arial.ttf")
        
    # 3. Filtrar por Peso/Estilo (Sistema de Puntuación)
    best_match = None
    best_score = -999
    
    # Mapa de términos de búsqueda
    search_terms = [weight]
    
    # Desglose de pesos compuestos
    if "extra" in weight and "bold" in weight: search_terms = ["extrabold", "extra", "bold"]
    elif "semi" in weight and "bold" in weight: search_terms = ["semibold", "semi", "bold"]
    elif "bold" in weight: search_terms = ["bold"]
    elif "light" in weight: search_terms = ["light"]
    elif "thin" in weight: search_terms = ["thin"]
    elif "medium" in weight: search_terms = ["medium"]
    elif "black" in weight: search_terms = ["black"]
    elif "italic" in weight: search_terms = ["italic"]
    elif "regular" in weight or weight == "": search_terms = ["regular"]
    
    # Atributos conocidos para penalizar si aparecen y no los pedimos
    known_attrs = ["bold", "italic", "light", "thin", "medium", "black", "condensed", "narrow", "regular", "semibold", "extrabold"]
    
    for f in family_matches:
        f_lower = f.lower()
        score = 0
        
        # Puntos por coincidencia positiva
        for term in search_terms:
            if term in f_lower:
                score += 10
        
        # Penalización por atributos no solicitados
        for attr in known_attrs:
            # Si el archivo tiene un atributo (ej: "condensed")
            if attr in f_lower:
                # Y nosotros NO lo pedimos en search_terms ni en family
                # (family check es por si pedimos "roboto condensed")
                if attr not in search_terms and attr not in family:
                    score -= 5
                    
        # Preferencia por longitud más corta (evita "BoldItalic" cuando buscamos "Bold")
        score -= len(f) * 0.1
        
        if score > best_score:
            best_score = score
            best_match = f
            
    return os.path.join(project_fonts, best_match)

def create_text_clip_pil(text, fontsize, color, font_family="arial", font_weight="bold", stroke_width=0, stroke_fill=None):
    """
    Genera un ImageClip de texto usando PIL para evitar problemas de codificación de ImageMagick.
    Soporta borde/stroke si se especifica stroke_width > 0.
    """
    font_path = get_pil_font_path(font_family, font_weight)
    
    try:
        font = ImageFont.truetype(font_path, int(fontsize))
    except Exception as e:
        print(f"Error cargando fuente {font_path}: {e}. Usando default.")
        font = ImageFont.load_default()
    
    # Calcular tamaño del texto
    # Usamos getbbox para mayor precisión en versiones nuevas de Pillow
    try:
        if hasattr(font, 'getbbox'):
             # stroke_width afecta el bbox en versiones nuevas de Pillow
             # pero no siempre getbbox lo considera perfectamente si no se pasa.
             # Sin embargo, getbbox(text) no acepta stroke_width en todas las versiones.
             # Asumiremos bbox base + stroke_width padding
            left, top, right, bottom = font.getbbox(text)
            text_w = right - left
            text_h = bottom - top
            offset_x = -left
            offset_y = -top
        else:
             # Fallback
             text_w, text_h = font.getsize(text)
             offset_x = 0
             offset_y = 0
    except AttributeError:
        # Fallback para Pillow antiguo
        text_w, text_h = font.getsize(text)
        offset_x = 0
        offset_y = 0
        
    # Añadimos un pequeño margen de seguridad para acentos altos o descendentes y stroke
    margin = int(fontsize * 0.2) + int(stroke_width)
    img_w = text_w + (margin * 2) + (stroke_width * 2)
    img_h = text_h + (margin * 2) + (stroke_width * 2)
    
    img = PIL.Image.new('RGBA', (img_w, img_h), (0,0,0,0))
    draw = PIL.ImageDraw.Draw(img)
    
    # Dibujar texto
    # Si stroke_width > 0, Pillow lo soporta en draw.text desde v6.2.0
    # Asumimos que el entorno tiene una versión reciente.
    if stroke_width > 0:
        draw.text((margin + offset_x + stroke_width, margin + offset_y + stroke_width), text, font=font, fill=color, stroke_width=int(stroke_width), stroke_fill=stroke_fill)
    else:
        draw.text((margin + offset_x, margin + offset_y), text, font=font, fill=color)
    
    # Recortar al contenido exacto (opcional, pero útil para alineación)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    return ImageClip(np.array(img))

# --- 5. UTILIDADES GRÁFICAS ---
def create_rounded_bar(w, h, color, radios=40, opacidad=0.6):
    """
    Crea una barra con esquinas redondeadas personalizables.
    radios: puede ser un int (todas iguales) o tupla (tl, tr, br, bl)
    """
    # Crear imagen vacía
    img = PIL.Image.new('RGBA', (int(w), int(h)), (0, 0, 0, 0))
    draw = PIL.ImageDraw.Draw(img)
    
    # Calcular color con alpha
    alpha = int(255 * opacidad)
    r, g, b = color
    fill_color = (r, g, b, alpha)
    
    # Normalizar radios a una tupla de 4 (TL, TR, BR, BL)
    if isinstance(radios, (int, float)):
        tl = tr = br = bl = radios
    else:
        # Asumimos que es una tupla/lista de 4 elementos
        tl, tr, br, bl = radios

    # Dibujar manualmente usando polígonos y sectores circulares
    
    # 1. Dibujar las esquinas redondeadas (si el radio > 0)
    if tl > 0:
        draw.pieslice((0, 0, tl*2, tl*2), 180, 270, fill=fill_color)
    if tr > 0:
        draw.pieslice((w - tr*2, 0, w, tr*2), 270, 360, fill=fill_color)
    if br > 0:
        draw.pieslice((w - br*2, h - br*2, w, h), 0, 90, fill=fill_color)
    if bl > 0:
        draw.pieslice((0, h - bl*2, bl*2, h), 90, 180, fill=fill_color)
        
    # 2. Rellenar el cuerpo central con un polígono que conecta los puntos internos
    points = [
        (tl, 0), (w - tr, 0),      # Borde Superior
        (w, tr), (w, h - br),      # Borde Derecho
        (w - br, h), (bl, h),      # Borde Inferior
        (0, h - bl), (0, tl)       # Borde Izquierdo
    ]
    draw.polygon(points, fill=fill_color)
    
    return ImageClip(np.array(img))
