from moviepy.editor import VideoFileClip
from config import CANVAS_W, CANVAS_H

def create_background(video_path, canvas_w=None, canvas_h=None):
    # Usar dimensiones pasadas o defaults de config
    target_w = canvas_w if canvas_w else CANVAS_W
    target_h = canvas_h if canvas_h else CANVAS_H

    # 1. Cargar metadatos primero para calcular escala
    # Usamos VideoFileClip temporalmente para obtener dimensiones y rotación
    temp_clip = VideoFileClip(video_path)
    # size devuelve el tamaño VISUAL (ya rotado si hay metadatos)
    vis_w, vis_h = temp_clip.size 
    rotation = temp_clip.rotation
    temp_clip.close()

    # Determinamos las dimensiones RAW (en disco) para aplicar el resize a nivel ffmpeg
    if rotation in [90, 270]:
        # Si está rotado 90/270, las dimensiones visuales están invertidas respecto a las raw
        raw_w, raw_h = vis_h, vis_w
    else:
        raw_w, raw_h = vis_w, vis_h

    # 3. Calcular MODO COVER (Basado en dimensiones VISUALES)
    # Queremos que la imagen visual cubra el canvas target
    ratio_w = target_w / vis_w
    ratio_h = target_h / vis_h
    scale_factor = max(ratio_w, ratio_h)
    
    # Calcular nueva resolución RAW objetivo
    # Aplicamos el factor de escala a las dimensiones RAW
    new_raw_w = int(raw_w * scale_factor)
    new_raw_h = int(raw_h * scale_factor)
    
    # Asegurar dimensiones pares (mejor compatibilidad)
    if new_raw_w % 2 != 0: new_raw_w += 1
    if new_raw_h % 2 != 0: new_raw_h += 1
    
    # 4. Cargar clip con redimensionamiento nativo en FFmpeg
    # target_resolution recibe (height, width) según convención interna de moviepy/ffmpeg_reader
    # Esto redimensiona el stream RAW antes de rotar
    clip = VideoFileClip(video_path, target_resolution=(new_raw_h, new_raw_w))
    
    # Verificación de seguridad: si por alguna razón las dimensiones no coinciden (ej. rotación fallida),
    # hacemos un resize forzoso.
    if clip.w < target_w or clip.h < target_h:
        print(f"⚠️ Advertencia: Redimensionamiento nativo insuficiente ({clip.w}x{clip.h}). Aplicando resize extra.")
        # Calcular nuevo scale basado en lo que obtuvimos
        ratio_fix = max(target_w / clip.w, target_h / clip.h)
        clip = clip.resize(ratio_fix)
    
    # Retornar clip centrado
    return clip.set_position("center")
