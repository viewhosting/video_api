import os
import sys
import platform
import shutil
import time
import io
import contextlib

# --- CONFIGURACIÓN GLOBAL DE RENDER ---
RENDER_MODE = "FAST" 
SKIP_BG_VIDEO = False # Opcion para reemplazar video por fondo negro en modo FAST 

# Inyectar escala antes de importar config
if RENDER_MODE == "FAST":
    os.environ["RENDER_SCALE"] = "0.5" # 50% de resolución (1275x1020)
else:
    os.environ["RENDER_SCALE"] = "1.0"

# --- 1. CONFIGURACIÓN "FUERZA BRUTA" (ANTES DE IMPORTAR NADA MÁS) ---
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

# --- 2. AHORA SÍ IMPORTAMOS LIBRERÍAS ---
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Security, Depends, status, Request
from fastapi.security import APIKeyHeader
from fastapi.responses import FileResponse
from pydantic import BaseModel, ValidationError
from typing import Dict, Optional, List, Any
import traceback
import tempfile
import json
import uuid
import requests

# Importamos config de moviepy para hackearla manualmente
import moviepy.config

# HACKEO DIRECTO: Sobrescribimos las variables internas del módulo
# Esto arregla el problema de "NoneType" incluso si la autodetección falló
if ffmpeg_path:
    moviepy.config.FFMPEG_BINARY = ffmpeg_path
if magick_path:
    moviepy.config.IMAGEMAGICK_BINARY = magick_path

# Parche adicional de seguridad (El que usamos antes)
def _forced_get_setting(varname):
    if varname == "FFMPEG_BINARY" and ffmpeg_path:
        return ffmpeg_path
    if varname == "IMAGEMAGICK_BINARY" and magick_path:
        return magick_path
    return moviepy.config.__dict__.get(varname, None)

moviepy.config.get_setting = _forced_get_setting

# --- 3. RESTO DEL PROGRAMA ---
import PIL.Image
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS

from moviepy.editor import CompositeVideoClip, ColorClip, VideoFileClip, AudioFileClip, CompositeAudioClip
from config import CANVAS_W, CANVAS_H
from layers.fondo import create_background
# from layers.arriba import create_top_bar_layer  <-- Deprecated with new engine
# from layers.abajo import create_bottom_layer    <-- Deprecated with new engine
from layers.engine import process_dynamic_layers # Nuevo motor

app = FastAPI()

# --- SEGURIDAD ---
# Definimos la llave (Idealmente vendría de una variable de entorno)
API_KEY = os.environ.get("Authorization", "SantanderZXJjaW483847FsMUBzcG9ydHNzdW1taXQuY2FkYXNkOW0uYnI6U3FzZGYzNDU1RE5XQVhZRVhXUllNVW1wdUNlMmVsbGRxQ0pWTHpWQ21aQ2RrQ3c9PQ==-")
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key == API_KEY:
        return api_key
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Credenciales inválidas o faltantes"
    )

# Modelos
class LayoutData(BaseModel):
    texto_superior: str
    logo: str
    bloque_1: Dict[str, str]       
    bloque_2: Dict[str, str] 
    bloque_3: Dict[str, str]   
    texto_inferior: str
    font_family: str = "arial"
    font_weight: str = "bold"

class VideoRequest(BaseModel):
    video: str
    nombre: str
    layout: LayoutData

def download_file(url: str, suffix: str = "") -> str:
    """Descarga un archivo desde una URL y devuelve la ruta temporal."""
    try:
        print(f"⬇️ Descargando archivo desde: {url}")
        # Verificar si la URL es válida
        if not url.startswith("http"):
            raise ValueError("URL inválida")
            
        response = requests.get(url, allow_redirects=True, stream=True, timeout=30)
        response.raise_for_status()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
            return tmp.name
    except Exception as e:
        print(f"⚠️ Error descargando {url}: {e}")
        raise HTTPException(status_code=400, detail=f"Error descargando archivo remoto: {str(e)}")

@app.post("/render", dependencies=[Depends(verify_api_key)])
async def render_broadcast(request: Request):
    start_time = time.time()
    log_capture_string = io.StringIO()
    
    # Variables de estado
    video = None
    logo = None
    audio = None
    fuentes = []
    json_data = None
    
    # Archivos temporales
    temp_video_path = None
    temp_logo_path = None
    temp_audio_path = None
    temp_fonts_map = {} # {nombre_fuente: path}
    
    # 1. Detectar Tipo de Contenido (Multipart vs JSON)
    content_type = request.headers.get("content-type", "")
    
    # Redirigir stdout y stderr para capturar logs
    #with contextlib.redirect_stdout(log_capture_string), contextlib.redirect_stderr(log_capture_string):
    if True:
        try:
            # --- FASE 1: EXTRACCIÓN DE PARÁMETROS ---
            if "application/json" in content_type:
                # MODO: JSON PURO (--data)
                try:
                    params = await request.json()
                    # En modo JSON puro, 'params' es directamente el objeto.
                    # No hay campo 'json' stringificado, el body YA es el json.
                    json_data_obj = params
                    print("📡 Recibido request application/json")
                except Exception as e:
                    raise HTTPException(status_code=400, detail="Invalid JSON body")
            
            elif "multipart/form-data" in content_type:
                # MODO: MULTIPART (--form)
                print("📦 Recibido request multipart/form-data")
                form = await request.form()
                
                # Extraer archivos
                video = form.get("video")
                logo = form.get("logo")
                audio = form.get("audio")
                
                # Extraer lista de fuentes
                # .getlist() devuelve lista de UploadFile si existen
                fuentes_raw = form.getlist("fuentes")
                if fuentes_raw:
                    fuentes = fuentes_raw
                    
                # Extraer JSON string
                json_str = form.get("json")
                if not json_str:
                    raise HTTPException(status_code=400, detail="Missing 'json' field in form data")
                
                try:
                    json_data_obj = json.loads(json_str)
                except json.JSONDecodeError:
                    raise HTTPException(status_code=400, detail="Invalid JSON in 'json' form field")
            
            else:
                raise HTTPException(status_code=400, detail=f"Content-Type not supported: {content_type}")

            # --- FASE 2: PROCESAMIENTO UNIFICADO ---
            
            # Determinamos el diccionario de layout (contenido gráfico)
            layout_dict = json_data_obj.get("layout", json_data_obj)
            
            # Usamos json_data_obj como 'params' base
            params = json_data_obj

            # --- PARÁMETROS DE RENDERIZADO ---
            
            # Nombre del archivo de salida
            output_name = params.get("nombre", "output.mp4")
            
            # Inicio / Fin
            t_start_val = params.get("inicio")
            t_end_val = params.get("fin")
            
            # Dimensiones Canvas
            canvas_w = int(layout_dict.get("ancho", params.get("ancho", CANVAS_W)))
            canvas_h = int(layout_dict.get("alto", params.get("alto", CANVAS_H)))
            
            # Zoom / Escalado
            zoom_factor = float(layout_dict.get("zoom", params.get("zoom", 1.0)))
            if zoom_factor > 1.0:
                print(f"🔍 ZOOM DETECTADO (x{zoom_factor}): Se aplicará al final del renderizado.")
            
            print(f"🎨 Dimensiones del Canvas de Trabajo: {canvas_w}x{canvas_h}")

            # --- MODO JSON (Descarga Remota) vs MODO FILE (Upload) ---
            is_json_mode = params.get("json") is True
            
            if is_json_mode:
                print("🌐 MODO JSON DETECTADO: Descargando recursos remotos...")
                
                # A. VIDEO (Requerido)
                video_url = params.get("video") or layout_dict.get("video")
                if not video_url:
                    raise HTTPException(status_code=400, detail="En modo 'json: true', el campo 'video' (URL) es obligatorio.")
                
                # Intentar adivinar extensión o usar .mp4 por defecto
                ext_vid = ".mp4"
                if "." in video_url.split("/")[-1]:
                    ext_vid = os.path.splitext(video_url.split("/")[-1])[1]
                
                temp_video_path = download_file(video_url, suffix=ext_vid)
                print(f"✅ Video descargado: {temp_video_path}")
                
                # B. LOGO (Opcional)
                logo_url = params.get("logo") or layout_dict.get("logo")
                if logo_url:
                    ext_logo = ".png"
                    if "." in logo_url.split("/")[-1]:
                        ext_logo = os.path.splitext(logo_url.split("/")[-1])[1]
                    
                    temp_logo_path = download_file(logo_url, suffix=ext_logo)
                    layout_dict["logo"] = temp_logo_path # Actualizar ruta local para el engine
                    print(f"✅ Logo descargado: {temp_logo_path}")
                
                # C. AUDIO (Opcional)
                audio_url = params.get("audio") or layout_dict.get("audio")
                if audio_url:
                    try:
                        ext_audio = ".mp3"
                        if "." in audio_url.split("/")[-1]:
                            ext_audio = os.path.splitext(audio_url.split("/")[-1])[1]
                            
                        temp_audio_path = download_file(audio_url, suffix=ext_audio)
                        print(f"✅ Audio descargado: {temp_audio_path}")
                    except Exception as e:
                        print(f"⚠️ Error no bloqueante descargando audio: {e}")
                        # No fallamos el request completo, solo ignoramos el audio externo
                        temp_audio_path = None
                    
                # D. FUENTES / TIPOGRAFÍA (Opcional)
                # Puede venir como "tipografia": "url" o ["url", "url"] o "fuentes": ...
                fonts_source = params.get("tipografia") or params.get("fuentes") or layout_dict.get("tipografia") or layout_dict.get("fuentes")
                
                if fonts_source:
                    urls_to_download = []
                    if isinstance(fonts_source, str):
                        urls_to_download.append(fonts_source)
                    elif isinstance(fonts_source, list):
                        urls_to_download.extend(fonts_source)
                        
                    for f_url in urls_to_download:
                        try:
                            ext_font = ".ttf"
                            if "." in f_url.split("/")[-1]:
                                ext_font = os.path.splitext(f_url.split("/")[-1])[1]
                            
                            f_path = download_file(f_url, suffix=ext_font)
                            
                            # Usar nombre del archivo (sin ext) como clave
                            # O si la URL tiene nombre...
                            f_name = os.path.splitext(os.path.basename(f_url))[0]
                            # Limpieza de nombre si viene con query params ?v=...
                            if "?" in f_name: f_name = f_name.split("?")[0]
                            
                            temp_fonts_map[f_name] = f_path
                            print(f"✅ Fuente descargada: {f_name} -> {f_path}")
                        except Exception as e:
                            print(f"⚠️ Error descargando fuente {f_url}: {e}")

            else:
                # --- MODO FILE (Legacy / Upload) ---
                print("📂 MODO ARCHIVO: Usando archivos subidos...")
                
                # Validación Video
                if not video or (isinstance(video, UploadFile) and not video.filename):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST, 
                        detail="Error: Debe adjuntar un archivo de video válido en el campo 'video' (o usar modo json: true)."
                    )
                
                # 2. Guardar Video Uploaded
                ext = ".mp4"
                if isinstance(video, UploadFile):
                    ext = os.path.splitext(video.filename)[1] or ".mp4"
                    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_vid:
                        shutil.copyfileobj(video.file, tmp_vid)
                        temp_video_path = tmp_vid.name
                else:
                    # Caso improbable si FastAPI/Starlette maneja UploadFile
                    # pero si viene como string (ej. curl mal formado), fallamos
                    raise HTTPException(status_code=400, detail="El campo 'video' debe ser un archivo.")

                print(f"📁 Video guardado temporalmente en: {temp_video_path}")
                
                # 3. Guardar Logo Uploaded (si existe)
                if logo:
                    ext_logo = ".png"
                    if isinstance(logo, UploadFile):
                        ext_logo = os.path.splitext(logo.filename)[1] or ".png"
                        with tempfile.NamedTemporaryFile(delete=False, suffix=ext_logo) as tmp_logo:
                            shutil.copyfileobj(logo.file, tmp_logo)
                            temp_logo_path = tmp_logo.name
                        
                        layout_dict["logo"] = temp_logo_path
                        print(f"📁 Logo guardado temporalmente en: {temp_logo_path}")
                
                # 4. Guardar Audio Uploaded (si existe)
                if audio:
                    ext_audio = ".mp3"
                    if isinstance(audio, UploadFile):
                        ext_audio = os.path.splitext(audio.filename)[1] or ".mp3"
                        with tempfile.NamedTemporaryFile(delete=False, suffix=ext_audio) as tmp_audio:
                            shutil.copyfileobj(audio.file, tmp_audio)
                            temp_audio_path = tmp_audio.name
                        print(f"📁 Audio guardado temporalmente en: {temp_audio_path}")

                # 5. Guardar Fuentes Uploaded (si existen)
                if fuentes:
                    for font_file in fuentes:
                        try:
                            if isinstance(font_file, UploadFile):
                                ext_font = os.path.splitext(font_file.filename)[1] or ".ttf"
                                with tempfile.NamedTemporaryFile(delete=False, suffix=ext_font) as tmp_font:
                                    shutil.copyfileobj(font_file.file, tmp_font)
                                    font_name_key = os.path.splitext(font_file.filename)[0]
                                    temp_fonts_map[font_name_key] = tmp_font.name
                                    print(f"🔤 Fuente guardada: {font_name_key} -> {tmp_font.name}")
                        except Exception as e:
                            print(f"⚠️ Error guardando fuente: {e}")

            # Debug de seguridad: Verificar qué "ve" MoviePy justo antes de renderizar
            try:
                current_ffmpeg = moviepy.config.get_setting("FFMPEG_BINARY")
                print(f"🔍 DEBUG PRE-RENDER: MoviePy usará FFmpeg en -> {current_ffmpeg}")
                if not current_ffmpeg:
                    raise Exception("CRÍTICO: MoviePy sigue viendo FFmpeg como None.")
            except Exception as e:
                print(f"⚠️ Error verificando configuración: {e}")

            # A. Crear Fondo (Usando temp_video_path)
            source_clip_ref = None # Referencia para cerrar archivo si es necesario
            
            if RENDER_MODE == "FAST" and SKIP_BG_VIDEO:
                print("⚡ MODO ULTRA-FAST: Usando fondo negro en lugar de video")
                # Leemos solo metadatos del video original para audio y duración
                source_clip_ref = VideoFileClip(temp_video_path)
                duration = source_clip_ref.duration
                
                # Fondo negro
                video_bg = ColorClip(size=(canvas_w, canvas_h), color=(245, 73, 39)).set_duration(duration)
                if source_clip_ref.audio:
                    video_bg = video_bg.set_audio(source_clip_ref.audio)
            else:
                video_bg = create_background(temp_video_path, canvas_w=canvas_w, canvas_h=canvas_h)
                
                # --- LOGIC FOR CUTTING / AUDIO ---
                # 1. Recorte (Trimming)
                t_start = 0
                t_end = None
                
                if t_start_val:
                    try:
                        t_start = float(t_start_val)
                    except:
                        pass
                
                if t_end_val:
                    try:
                        t_end = float(t_end_val)
                    except:
                        pass
                
                # Aplicar recorte si es necesario
                if t_start > 0 or t_end is not None:
                    print(f"✂️ Recortando video: Inicio={t_start}, Fin={t_end}")
                    
                    # Validar y corregir tiempos
                    if t_end is not None:
                        # Si fin es mayor que duración real, acortar
                        if t_end > video_bg.duration:
                            print(f"⚠️ Ajustando fin al límite del video: {video_bg.duration}")
                            t_end = video_bg.duration
                        
                        # Si fin es menor o igual a inicio, es inválido
                        if t_end <= t_start:
                            print(f"⚠️ Error en tiempos: Fin ({t_end}) <= Inicio ({t_start}). Ignorando parámetro 'fin'.")
                            t_end = None

                    video_bg = video_bg.subclip(t_start, t_end)
                
                # 2. Gestión de Audio (Nueva Lógica)
                # Tipos: mudo (default), original, remplazo, mezcla
                audio_type = params.get("audio_tipo", layout_dict.get("audio_tipo", "mudo")).lower().strip()
                print(f"🔊 Configuración de Audio: Tipo='{audio_type}', Archivo Externo={'Sí' if temp_audio_path else 'No'}")

                if temp_audio_path:
                    try:
                        new_audio = AudioFileClip(temp_audio_path)
                        
                        # Ajustar duración del audio externo
                        if new_audio.duration > video_bg.duration:
                            print(f"✂️ Audio externo ({new_audio.duration:.2f}s) recortado a ({video_bg.duration:.2f}s)")
                            new_audio = new_audio.subclip(0, video_bg.duration)
                        
                        if audio_type == "mezcla":
                            print("🎛️ Mezclando audio original + externo")
                            original_audio = video_bg.audio
                            if original_audio:
                                video_bg = video_bg.set_audio(CompositeAudioClip([original_audio, new_audio]))
                            else:
                                video_bg = video_bg.set_audio(new_audio)
                                
                        elif audio_type == "remplazo":
                            print("🎵 Reemplazando audio original")
                            video_bg = video_bg.set_audio(new_audio)
                            
                        elif audio_type == "original":
                            print("📼 Manteniendo audio original (Ignorando archivo externo)")
                            # No hacemos nada
                            pass
                            
                        else: # mudo y otros
                            print("🔇 Audio silenciado (Configuración explícita o default)")
                            video_bg = video_bg.without_audio()
                            
                    except Exception as e:
                        print(f"⚠️ Error procesando audio externo: {e}")
                        video_bg = video_bg.without_audio()
                else:
                    # Sin audio externo
                    if audio_type == "original":
                        print("📼 Manteniendo audio original")
                        # No hacemos nada
                        pass
                    elif audio_type == "mezcla":
                        print("⚠️ Mezcla solicitada sin audio externo: Manteniendo audio original (Fallback)")
                        pass
                    else:
                        print("🔇 Audio silenciado (Sin archivo externo y no es 'original')")
                        video_bg = video_bg.without_audio()

                duration = video_bg.duration
            
            layers_stack = [video_bg]

            # B. Generar Capas
            # --- MOTOR DINÁMICO ---
            dynamic_clips = process_dynamic_layers(
                layout_dict, 
                duration, 
                uploaded_fonts=temp_fonts_map,
                canvas_w=canvas_w,
                canvas_h=canvas_h
            )
            
            if dynamic_clips:
                print(f"✨ Se generaron {len(dynamic_clips)} capas dinámicas.")
                layers_stack.extend(dynamic_clips)
            else:
                print("⚠️ No se detectaron bloques dinámicos (bloque_X) o estaban vacíos.")
                
            # C. Composición
            final = CompositeVideoClip(layers_stack, size=(canvas_w, canvas_h))
            
            # --- ZOOM POST-PROCESSING ---
            if zoom_factor > 1.0:
                final_w = int(canvas_w * zoom_factor)
                final_h = int(canvas_h * zoom_factor)
                
                # Asegurar paridad para FFmpeg
                if final_w % 2 != 0: final_w += 1
                if final_h % 2 != 0: final_h += 1
                
                print(f"🔭 APLICANDO ZOOM FINAL: {canvas_w}x{canvas_h} -> {final_w}x{final_h}")
                # Usamos resize de MoviePy (Lanczos por defecto en versiones nuevas)
                final = final.resize(newsize=(final_w, final_h))
            
            # D. Lógica de Optimización
            system_os = platform.system()
            my_codec = "libx264"
            
            # Configuración base según modo
            if RENDER_MODE == "FAST":
                preset_val = "ultrafast"
                crf_val = "28"
            else:
                # OPTIMIZACIÓN CPU WINDOWS: 'medium' es muy lento en 2K. 
                # Usamos 'veryfast' que mantiene buena calidad con bitrate alto pero rinde mucho mejor.
                preset_val = "veryfast" 
                crf_val = "18"

            # Selección de códec por plataforma
            if system_os == "Darwin": 
                my_codec = "h264_videotoolbox"
            elif system_os == "Windows": 
                my_codec = "libx264" # CPU Fallback optimizado

            # E. Renderizar
            ff_params = []
            if my_codec == "libx264":
                # Threads 0 = Auto (usa todos los núcleos disponibles)
                # tune film ayuda a mantener detalle en video real
                ff_params = ["-crf", crf_val, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-tune", "film"]
            elif my_codec == "h264_videotoolbox":
                ff_params = ["-b:v", "6000k", "-pix_fmt", "yuv420p", "-allow_sw", "1"] 

            # Optimization: Use FFmpeg scaling instead of MoviePy resizing for FAST mode
            if RENDER_MODE == "FAST":
                pass

            print(f"🚀 INICIANDO RENDER con {my_codec} (Preset: {preset_val})...")
            
            # Determinamos el preset para MoviePy
            moviepy_preset = preset_val if my_codec == "libx264" else "medium"

            final.write_videofile(
                output_name, 
                codec=my_codec, 
                audio_codec="aac", 
                preset=moviepy_preset, 
                threads=0, # 0 = Auto detect max threads
                ffmpeg_params=ff_params,
                fps=24
            )
            
            # Limpieza de recursos
            video_bg.close()
            if source_clip_ref:
                source_clip_ref.close()
            
            elapsed_time = time.time() - start_time
            logs = log_capture_string.getvalue()
            
            # Restaurar stdout/stderr para imprimir logs capturados en consola
            sys.stdout.write(logs)
            
            # Devolver el archivo generado
            headers = {
                "X-Render-Time": str(round(elapsed_time, 2)),
                "X-Render-Mode": RENDER_MODE,
                "X-Render-Status": "success"
            }
            return FileResponse(
                path=output_name, 
                filename=os.path.basename(output_name), 
                media_type="video/mp4",
                headers=headers
            )

        except Exception as e:
            traceback.print_exc()
            elapsed_time = time.time() - start_time
            logs = log_capture_string.getvalue()
            sys.stdout.write(logs) # Imprimir lo que se capturó hasta el error
            raise HTTPException(status_code=500, detail={"error": str(e), "logs": logs, "time": round(elapsed_time, 2)})
        
        finally:
            # Eliminar archivos temporales
            if temp_video_path and os.path.exists(temp_video_path):
                try:
                    os.remove(temp_video_path)
                    print(f"🗑️ Video temporal eliminado: {temp_video_path}")
                except Exception as e:
                    print(f"⚠️ No se pudo eliminar video temporal: {e}")
            
            if temp_logo_path and os.path.exists(temp_logo_path):
                try:
                    os.remove(temp_logo_path)
                    print(f"🗑️ Logo temporal eliminado: {temp_logo_path}")
                except Exception as e:
                    print(f"⚠️ No se pudo eliminar logo temporal: {e}")
            
            if temp_audio_path and os.path.exists(temp_audio_path):
                try:
                    os.remove(temp_audio_path)
                    print(f"🗑️ Audio temporal eliminado: {temp_audio_path}")
                except Exception as e:
                    print(f"⚠️ No se pudo eliminar audio temporal: {e}")

            # Limpiar fuentes temporales
            for name, path in temp_fonts_map.items():
                if path and os.path.exists(path):
                    try:
                        os.remove(path)
                        print(f"🗑️ Fuente temporal eliminada: {path}")
                    except Exception as e:
                        print(f"⚠️ Error eliminando fuente {path}: {e}")