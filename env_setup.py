import os
import shutil
import moviepy.config

# --- CONFIGURACIÓN "FUERZA BRUTA" (ANTES DE IMPORTAR NADA MÁS) ---
# Detectamos las rutas reales usando shutil (más robusto que os.path.exists manual)
# Esto busca en el PATH del sistema y en rutas conocidas de Mac/Homebrew

# A. Buscar FFmpeg
ffmpeg_path = shutil.which("ffmpeg")
if not ffmpeg_path:
    # Si no está en el PATH, buscamos en lugares comunes de Mac
    if os.path.exists("/opt/homebrew/bin/ffmpeg"):
        ffmpeg_path = "/opt/homebrew/bin/ffmpeg"
    elif os.path.exists("/usr/local/bin/ffmpeg"):
        ffmpeg_path = "/usr/local/bin/ffmpeg"

# B. Buscar ImageMagick
magick_path = shutil.which("magick")
if not magick_path:
    if os.path.exists("/opt/homebrew/bin/magick"):
        magick_path = "/opt/homebrew/bin/magick"
    # En Windows a veces se llama convert
    elif os.name == 'nt' and os.path.exists(r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"):
        magick_path = r"C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"

# C. INYECCIÓN NUCLEAR
# Si encontramos las rutas, las metemos a la fuerza en las variables de entorno
if ffmpeg_path:
    os.environ["IMAGEIO_FFMPEG_EXE"] = ffmpeg_path
    os.environ["FFMPEG_BINARY"] = ffmpeg_path

if magick_path:
    os.environ["IMAGEMAGICK_BINARY"] = magick_path

print(f"🔧 SISTEMA DE VIDEO INICIADO:\n   FFmpeg: {ffmpeg_path}\n   Magick: {magick_path}")

# HACKEO DIRECTO: Sobrescribimos las variables internas del módulo
# Esto arregla el problema de "NoneType" incluso si la autodetección falló
if ffmpeg_path:
    moviepy.config.FFMPEG_BINARY = ffmpeg_path
if magick_path:
    moviepy.config.IMAGEMAGICK_BINARY = magick_path

# Parche adicional de seguridad
def _forced_get_setting(varname):
    if varname == "FFMPEG_BINARY" and ffmpeg_path:
        return ffmpeg_path
    if varname == "IMAGEMAGICK_BINARY" and magick_path:
        return magick_path
    return moviepy.config.__dict__.get(varname, None)

moviepy.config.get_setting = _forced_get_setting

import PIL.Image
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS
