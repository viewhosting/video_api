import os
import time
import shutil
import tempfile
import uuid
import platform
from typing import Dict, Any, Optional
from moviepy.editor import VideoFileClip, ColorClip, AudioFileClip, CompositeAudioClip, CompositeVideoClip
import moviepy.video.fx.all as vfx

from utils import download_file
from config import CANVAS_W, CANVAS_H, RENDER_MODE, SKIP_BG_VIDEO
from layers.fondo import create_background
from layers.engine import process_dynamic_layers

def resolve_assets(params: Dict[str, Any], layout_dict: Dict[str, Any], uploaded_files: Dict[str, str]) -> Dict[str, Any]:
    """
    Resuelve los paths de los activos (video, logo, audio, fuentes).
    Prioriza archivos subidos, luego descargas desde URL.
    Devuelve un diccionario con los paths locales a los recursos.
    """
    assets = {
        "video": None,
        "logo": None,
        "audio": None,
        "fonts": {}
    }

    # 1. VIDEO
    if uploaded_files.get("video"):
        assets["video"] = uploaded_files["video"]
    elif params.get("video") or layout_dict.get("video"):
        url = params.get("video") or layout_dict.get("video")
        ext = ".mp4"
        if "." in url.split("/")[-1]:
            ext = os.path.splitext(url.split("/")[-1])[1]
        assets["video"] = download_file(url, suffix=ext)
    
    # 2. LOGO
    if uploaded_files.get("logo"):
        assets["logo"] = uploaded_files["logo"]
    elif params.get("logo") or layout_dict.get("logo"):
        url = params.get("logo") or layout_dict.get("logo")
        ext = ".png"
        if "." in url.split("/")[-1]:
            ext = os.path.splitext(url.split("/")[-1])[1]
        assets["logo"] = download_file(url, suffix=ext)
    
    if assets["logo"]:
        layout_dict["logo"] = assets["logo"]

    # 3. AUDIO
    if uploaded_files.get("audio"):
        assets["audio"] = uploaded_files["audio"]
    elif params.get("audio") or layout_dict.get("audio"):
        url = params.get("audio") or layout_dict.get("audio")
        try:
            ext = ".mp3"
            if "." in url.split("/")[-1]:
                ext = os.path.splitext(url.split("/")[-1])[1]
            assets["audio"] = download_file(url, suffix=ext)
        except Exception as e:
            print(f"⚠️ Error no bloqueante descargando audio: {e}")

    # 4. FUENTES
    assets["fonts"].update(uploaded_files.get("fonts", {}))
    
    fonts_source = params.get("tipografia") or params.get("fuentes") or layout_dict.get("tipografia") or layout_dict.get("fuentes")
    if fonts_source:
        urls_to_download = []
        if isinstance(fonts_source, str):
            urls_to_download.append(fonts_source)
        elif isinstance(fonts_source, list):
            urls_to_download.extend(fonts_source)
            
        for f_url in urls_to_download:
            try:
                ext = ".ttf"
                if "." in f_url.split("/")[-1]:
                    ext = os.path.splitext(f_url.split("/")[-1])[1]
                
                f_path = download_file(f_url, suffix=ext)
                f_name = os.path.splitext(os.path.basename(f_url))[0]
                if "?" in f_name: f_name = f_name.split("?")[0]
                
                assets["fonts"][f_name] = f_path
                print(f"✅ Fuente descargada: {f_name} -> {f_path}")
            except Exception as e:
                print(f"⚠️ Error descargando fuente {f_url}: {e}")

    return assets

def render_video(assets: Dict[str, Any], params: Dict[str, Any], layout_dict: Dict[str, Any], output_name_req: str = "output.mp4") -> str:
    """
    Ejecuta el pipeline de renderizado de video.
    Devuelve la ruta absoluta del archivo de video generado.
    """
    temp_video_path = assets["video"]
    temp_audio_path = assets["audio"]
    temp_fonts_map = assets["fonts"]
    
    # Dimensiones
    canvas_w = int(layout_dict.get("ancho", params.get("ancho", CANVAS_W)))
    canvas_h = int(layout_dict.get("alto", params.get("alto", CANVAS_H)))
    
    print(f"🎨 Renderizando a: {canvas_w}x{canvas_h}")

    if not temp_video_path and not (RENDER_MODE == "FAST" and SKIP_BG_VIDEO):
         raise ValueError("No se proporcionó video de entrada.")

    source_clip_ref = None

    # A. Crear Fondo
    video_bg = None
    if RENDER_MODE == "FAST" and SKIP_BG_VIDEO:
        print("⚡ MODO ULTRA-FAST: Usando fondo negro")
        duration = 10
        audio_ref = None
        if temp_video_path:
            try:
                source_clip_ref = VideoFileClip(temp_video_path)
                duration = source_clip_ref.duration
                audio_ref = source_clip_ref.audio
            except:
                pass
        
        video_bg = ColorClip(size=(canvas_w, canvas_h), color=(245, 73, 39)).set_duration(duration)
        if audio_ref:
            video_bg = video_bg.set_audio(audio_ref)
    else:
        video_bg = create_background(temp_video_path, canvas_w=canvas_w, canvas_h=canvas_h)

    # B. Recorte (Trimming)
    t_start_val = params.get("inicio")
    t_end_val = params.get("fin")
    
    t_start = 0
    t_end = None
    
    if t_start_val:
        try: t_start = float(t_start_val)
        except: pass
    
    if t_end_val:
        try: t_end = float(t_end_val)
        except: pass
    
    if t_start > 0 or t_end is not None:
        print(f"✂️ Recortando video: Inicio={t_start}, Fin={t_end}")
        if t_end is not None:
            if t_end > video_bg.duration: t_end = video_bg.duration
            if t_end <= t_start: t_end = None
        
        video_bg = video_bg.subclip(t_start, t_end)

    # C. Audio
    audio_type = params.get("audio_tipo", layout_dict.get("audio_tipo", "mudo")).lower().strip()
    print(f"🔊 Configuración de Audio: Tipo='{audio_type}'")

    if temp_audio_path:
        try:
            new_audio = AudioFileClip(temp_audio_path)
            if new_audio.duration > video_bg.duration:
                new_audio = new_audio.subclip(0, video_bg.duration)
            
            if audio_type == "mezcla":
                original_audio = video_bg.audio
                if original_audio:
                    video_bg = video_bg.set_audio(CompositeAudioClip([original_audio, new_audio]))
                else:
                    video_bg = video_bg.set_audio(new_audio)
            elif audio_type == "remplazo":
                video_bg = video_bg.set_audio(new_audio)
            elif audio_type == "mudo":
                video_bg = video_bg.without_audio()
            # Si es original, ignoramos el externo
            
        except Exception as e:
            print(f"⚠️ Error procesando audio externo: {e}")
            if audio_type == "mudo": video_bg = video_bg.without_audio()
    else:
        # Si no hay audio externo:
        if audio_type == "original":
            pass # Mantiene el audio original del video
        else:
            # "mudo", o "remplazo"/"mezcla" sin archivo -> Silencio
            video_bg = video_bg.without_audio()

    # Actualizar duración tras recortes
    duration = video_bg.duration
    
    layers_stack = [video_bg]

    # D. Capas (Overlays)
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
        print("⚠️ No se detectaron bloques dinámicos.")

    # E. Composición Final
    final = CompositeVideoClip(layers_stack, size=(canvas_w, canvas_h))
    
    # F. Zoom / Post-procesamiento
    zoom_factor = float(layout_dict.get("zoom", params.get("zoom", 1.0)))
    if zoom_factor > 1.0:
        final_w = int(canvas_w * zoom_factor)
        final_h = int(canvas_h * zoom_factor)
        
        if final_w % 2 != 0: final_w += 1
        if final_h % 2 != 0: final_h += 1
        
        print(f"🔭 APLICANDO ZOOM FINAL: {canvas_w}x{canvas_h} -> {final_w}x{final_h}")
        final = final.resize(newsize=(final_w, final_h))

    # G. Configuración de Codecs y Optimización
    output_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}_{output_name_req}")
    
    system_os = platform.system()
    my_codec = "libx264"
    preset_val = "medium"
    crf_val = "23" # Default reasonable
    
    if RENDER_MODE == "FAST":
        preset_val = "ultrafast"
        crf_val = "28"
    else:
        preset_val = "veryfast"
        crf_val = "18"

    if system_os == "Darwin": 
        my_codec = "h264_videotoolbox"
    elif system_os == "Windows": 
        my_codec = "libx264"

    ff_params = []
    if my_codec == "libx264":
        ff_params = ["-crf", crf_val, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-tune", "film"]
    elif my_codec == "h264_videotoolbox":
        ff_params = ["-b:v", "6000k", "-pix_fmt", "yuv420p", "-allow_sw", "1"] 

    print(f"🚀 INICIANDO RENDER con {my_codec} (Preset: {preset_val})...")
    
    moviepy_preset = preset_val if my_codec == "libx264" else "medium"

    try:
        final.write_videofile(
            output_path, 
            codec=my_codec, 
            audio_codec="aac", 
            preset=moviepy_preset, 
            threads=0, 
            ffmpeg_params=ff_params,
            fps=24,
            logger=None
        )
    finally:
        # Limpieza de objetos MoviePy
        try:
            final.close()
            if video_bg: video_bg.close()
            if source_clip_ref: source_clip_ref.close()
        except:
            pass
    
    return output_path
