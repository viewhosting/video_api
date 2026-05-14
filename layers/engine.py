import os
import math
import shutil
import subprocess
import tempfile
from typing import List, Dict, Any, Tuple, Optional, Union
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter
import numpy as np
from moviepy.editor import ImageClip, CompositeVideoClip, VideoFileClip
import moviepy.video.fx.all as vfx
from config import CANVAS_W, CANVAS_H, s
from graphics_utils import get_pil_font_path
from utils import download_file

class RenderEngine:
    def __init__(self, uploaded_fonts: Dict[str, str] = None, canvas_w=None, canvas_h=None):
        """
        Inicializa el motor de renderizado.
        :param uploaded_fonts: Diccionario {nombre_fuente: ruta_archivo_temporal}
        :param canvas_w: Ancho del lienzo (opcional, default config.CANVAS_W)
        :param canvas_h: Alto del lienzo (opcional, default config.CANVAS_H)
        """
        self.uploaded_fonts = uploaded_fonts or {}
        self.canvas_w = canvas_w if canvas_w else CANVAS_W
        self.canvas_h = canvas_h if canvas_h else CANVAS_H

    def _parse_value(self, val: str, reference_size: int) -> int:
        """
        Parsea un valor que puede ser píxeles ("100") o porcentaje ("50%").
        Aplica la función de escalado s() si es pixel absoluto SOLO cuando
        se está trabajando en el lienzo maestro (CANVAS_W x CANVAS_H).
        Para lienzos personalizados (ancho/alto distintos), los valores
        numéricos se interpretan como coordenadas absolutas en ese lienzo.
        """
        val = str(val).strip().lower()
        
        if "%" in val:
            # Es porcentaje: "50%" -> 0.5 * reference
            percentage = float(val.replace("%", "")) / 100.0
            return int(reference_size * percentage)
        else:
            try:
                base_val = float(val)
            except ValueError:
                return 0

            # Si el lienzo actual coincide con el maestro, usamos escala s()
            if self.canvas_w == CANVAS_W and self.canvas_h == CANVAS_H:
                try:
                    return s(base_val)
                except Exception:
                    return int(base_val)
            else:
                # Lienzo personalizado: el valor ya viene en coordenadas reales
                return int(base_val)

    def _rasterize_svg(self, svg_path: str, out_w: Optional[int] = None, out_h: Optional[int] = None) -> Optional[str]:
        """
        Convierte un SVG en PNG temporal con fondo transparente.
        Intenta primero con CairoSVG (si está disponible) y luego con ImageMagick.
        Devuelve la ruta del PNG generado o None si falla.
        """
        try:
            tmp_png = tempfile.NamedTemporaryFile(delete=False, suffix=".png").name
            try:
                import cairosvg  # type: ignore
                kwargs = {}
                if out_w and out_w > 0:
                    kwargs["output_width"] = int(out_w)
                if out_h and out_h > 0:
                    kwargs["output_height"] = int(out_h)
                cairosvg.svg2png(url=svg_path, write_to=tmp_png, background_color=None, **kwargs)
                if os.path.exists(tmp_png) and os.path.getsize(tmp_png) > 0:
                    return tmp_png
            except Exception as e:
                print(f"⚠️ CairoSVG no disponible o falló: {e}")
            
            # Fallback con ImageMagick
            magick = shutil.which("magick") or shutil.which("convert")
            if magick:
                cmd = [magick]
                if os.path.basename(magick).lower() == "magick":
                    cmd += ["convert"]
                cmd += ["-background", "none", svg_path]
                if out_w and out_h and out_w > 0 and out_h > 0:
                    cmd += ["-resize", f"{int(out_w)}x{int(out_h)}"]
                cmd += ["png32:" + tmp_png]
                try:
                    subprocess.run(cmd, check=True, capture_output=True)
                    if os.path.exists(tmp_png) and os.path.getsize(tmp_png) > 0:
                        return tmp_png
                except subprocess.CalledProcessError as cpe:
                    err = cpe.stderr.decode().strip() if cpe.stderr else f"exit {cpe.returncode}"
                    print(f"❌ ImageMagick falló al rasterizar SVG: {err}")
            try:
                if os.path.exists(tmp_png):
                    os.remove(tmp_png)
            except:
                pass
            return None
        except Exception as e:
            print(f"⚠️ Error preparando rasterización de SVG: {e}")
            return None

    def _parse_coords(self, coord_str: str) -> Tuple[int, int]:
        """Convierte "x,y" en tupla (x, y) parseada."""
        if not coord_str or "," not in coord_str:
            return (0, 0)
        
        parts = coord_str.split(",")
        x = self._parse_value(parts[0], self.canvas_w)
        y = self._parse_value(parts[1], self.canvas_h)
        return (x, y)

    def _get_font_path(self, font_name: str, weight: str) -> str:
        """
        Resuelve la ruta de la fuente en orden:
        1. Fuentes subidas (uploaded_fonts)
        2. Fuentes del sistema (config.py get_pil_font_path)
        3. Fallback (Arial)
        """
        # Normalizar nombre (ej: "Gothic" -> "gothic")
        font_key = font_name.lower().split(".")[0] # remover extensión si viene
        
        # 1. Buscar en subidas
        for name, path in self.uploaded_fonts.items():
            if font_key in name.lower():
                return path
        
        # 2. Buscar en sistema usando get_pil_font_path (retorna ruta absoluta)
        try:
            system_font = get_pil_font_path(font_name, weight)
            if os.path.exists(system_font):
                return system_font
        except:
            pass
            
        # 3. Fallback final
        return get_pil_font_path("arial", "bold") 

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int, int]:
        """Convierte #RRGGBB o #RRGGBBAA a tupla RGBA."""
        if not isinstance(hex_color, str):
            # Fallback si no es string (ej. ya es tupla o None)
            return (255, 255, 255, 255)
            
        hex_color = hex_color.strip().lstrip('#')
        
        # Soporte para colores cortos (#RGB -> #RRGGBB)
        if len(hex_color) == 3:
            hex_color = "".join([c*2 for c in hex_color])
            
        try:
            if len(hex_color) == 6:
                r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                return (r, g, b, 255)
            elif len(hex_color) == 8:
                r, g, b, a = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6))
                return (r, g, b, a)
        except ValueError:
            print(f"⚠️ Color inválido detectado: {hex_color}. Usando blanco.")
            pass
            
        return (255, 255, 255, 255)

    def _get_padding(self, el: Dict[str, Any]) -> Tuple[int, int, int, int]:
        """
        Obtiene padding (top, right, bottom, left).
        Soporta formato: "10" (todos), "10,20" (vertical, horizontal), "10,20,10,20" (t,r,b,l)
        """
        p_str = str(el.get("padding", "0"))
        parts = [s(int(x.strip())) for x in p_str.split(",") if x.strip()]
        
        if len(parts) == 1:
            return (parts[0], parts[0], parts[0], parts[0])
        elif len(parts) == 2: # vertical, horizontal
            return (parts[0], parts[1], parts[0], parts[1])
        elif len(parts) == 3: # top, horizontal, bottom
            return (parts[0], parts[1], parts[2], parts[1])
        elif len(parts) == 4: # top, right, bottom, left
            return (parts[0], parts[1], parts[2], parts[3])
        return (0, 0, 0, 0)

    def _apply_margin(self, pos: Tuple[int, int], el: Dict[str, Any]) -> Tuple[int, int]:
        """
        Aplica margen a la posición base.
        Soporta margin="x,y" o margin_x/margin_y individuales.
        """
        x, y = pos
        
        # Margen genérico
        m_str = str(el.get("margin", "0,0"))
        if "," in m_str:
            parts = m_str.split(",")
            mx = s(int(parts[0].strip()))
            my = s(int(parts[1].strip())) if len(parts) > 1 else mx
        else:
            mx = s(int(m_str))
            my = mx
            
        # Overrides específicos
        if "margin_x" in el: mx = s(int(el["margin_x"]))
        if "margin_y" in el: my = s(int(el["margin_y"]))
        if "margin_top" in el: my = s(int(el["margin_top"])) # Simple override for top
        if "margin_left" in el: mx = s(int(el["margin_left"])) # Simple override for left
            
        return (x + mx, y + my)

    def _parse_shadow(self, el: Dict[str, Any]):
        """
        Parsea la sombra si existe.
        Formato esperado: \"sombra\": \"blur, x, y, #000000\"
        Devuelve (blur, dx, dy, (r,g,b,a)) o None si no aplica.
        """
        raw = el.get("sombra")
        if not raw:
            return None
        try:
            s_str = str(raw)
            parts = [p.strip() for p in s_str.split(",")]
            if len(parts) < 4:
                return None
            blur = int(parts[0])
            dx = int(parts[1])
            dy = int(parts[2])
            color_hex = parts[3]
            color_rgba = self._hex_to_rgb(color_hex)
            return blur, dx, dy, color_rgba
        except Exception as e:
            print(f"⚠️ Error parseando sombra '{raw}': {e}")
            return None


    def _create_marquee_clip(self, el: Dict[str, Any], duration: float) -> Optional[CompositeVideoClip]:
        """
        Crea un clip animado tipo marquesina (texto desplazándose).
        """
        try:
            sombra = self._parse_shadow(el)
            raw_content = str(el.get("contenido", el.get("texto", "")))
            if not raw_content or not raw_content.strip():
                # raise ValueError("La marquesina requiere un campo 'contenido' válido (no vacío ni solo espacios).")
                print("⚠️ Marquesina sin contenido válido.")
                return None
            content = raw_content

            # -----------------------------------------------------
            # 1. DIMENSIONES Y POSICIÓN (con soporte 'center')
            # -----------------------------------------------------
            pos_str = str(el.get("posicion", "0,0")).lower()
            size_raw = el.get("size", "100%, 100")
            size_str = str(size_raw).strip()
            
            # Parsear size primero
            if "," in size_str:
                bar_w, bar_h = self._parse_coords(size_str)
            else:
                # Si solo viene un valor, interpretamos como ANCHO
                # y usamos una altura por defecto basada en el tamaño de texto.
                w_val = self._parse_value(size_str, self.canvas_w)
                bar_w = max(1, w_val)
                default_h = s(int(el.get("size_texto", 40))) * 2
                bar_h = max(1, default_h)
            
            # Clamp de seguridad (evitar 0 que rompe MoviePy / numpy)
            bar_w = max(1, int(bar_w))
            bar_h = max(1, int(bar_h))
            
            # Parsear posición con lógica de centrado (relativo al Canvas)
            parts = [p.strip() for p in pos_str.split(",")]
            if len(parts) == 1: parts.append(parts[0]) 
            
            # Eje X
            if "center" in parts[0]:
                bar_x = (self.canvas_w - bar_w) // 2
            else:
                bar_x = self._parse_value(parts[0], self.canvas_w)
                
            # Eje Y
            if "center" in parts[1]:
                bar_y = (self.canvas_h - bar_h) // 2
            else:
                bar_y = self._parse_value(parts[1], self.canvas_h)
            
            # Aplicar Margen
            pos = self._apply_margin((bar_x, bar_y), el)
            bar_x, bar_y = pos
            
            # Padding interno
            pt, pr, pb, pl = self._get_padding(el)
            
            # Ajustar área efectiva para el texto
            effective_h = max(1, bar_h - pt - pb)
            effective_w = max(1, bar_w - pl - pr)
            
            # Lista de clips para el Composite local de la marquesina
            container_clips = []
            
            # -----------------------------------------------------
            # 2. FONDO (con Transparencia, Color, Radius) + Sombra opcional
            # -----------------------------------------------------
            bg_color_hex = el.get("bg_color", None)
            
            # Sombra del contenedor de la marquesina (si se definió)
            if sombra:
                try:
                    blur, dx, dy, color_rgba = sombra
                    radius_raw_shadow = el.get("radius", 0)
                    radius_s, corners_s = self._parse_radius(radius_raw_shadow)
                    mask_shadow = Image.new("L", (bar_w, bar_h), 0)
                    draw_shadow = ImageDraw.Draw(mask_shadow)
                    if radius_s > 0:
                        draw_shadow.rounded_rectangle((0, 0, bar_w, bar_h), radius=radius_s, corners=corners_s, fill=255)
                    else:
                        draw_shadow.rectangle((0, 0, bar_w, bar_h), fill=255)
                    if blur > 0:
                        mask_shadow = mask_shadow.filter(ImageFilter.GaussianBlur(blur))
                    shadow_rgba = Image.new("RGBA", (bar_w, bar_h), color_rgba)
                    shadow_rgba.putalpha(mask_shadow)
                    shadow_clip = ImageClip(np.array(shadow_rgba)).set_pos((dx, dy)).set_duration(duration)
                    container_clips.append(shadow_clip)
                except Exception as e:
                    print(f"⚠️ Sombra marquesina error: {e}")

            if bg_color_hex:
                # Calcular opacidad
                transparencia = float(el.get("transparencia", 0.0))
                if "opacity" in el:
                    transparencia = 1.0 - float(el["opacity"])
                opacity_factor = max(0.0, min(1.0, 1.0 - transparencia))
                
                # Generar imagen de relleno (Sólido o Gradiente)
                img_bg = self._create_fill_image((bar_w, bar_h), bg_color_hex, opacity_factor)
                
                # Aplicar Radius (Máscara)
                radius_raw = el.get("radius", 0)
                radius, corners = self._parse_radius(radius_raw)
                
                if radius > 0:
                    mask = Image.new("L", (bar_w, bar_h), 0)
                    draw_mask = ImageDraw.Draw(mask)
                    draw_mask.rounded_rectangle((0, 0, bar_w, bar_h), radius=radius, corners=corners, fill=255)
                    # Aplicar máscara al alpha
                    img_bg.putalpha(ImageChops.multiply(img_bg.split()[3], mask))
                
                # Convertir a ImageClip
                # Posición (0,0) relativa al contenedor de la marquesina
                bg_clip = ImageClip(np.array(img_bg)).set_pos((0, 0)).set_duration(duration)
                container_clips.append(bg_clip)

            # -----------------------------------------------------
            # 3. TEXTO ANIMADO (Scroll)
            # -----------------------------------------------------
            font_name = el.get("tipografia", "arial")
            weight = el.get("peso", "bold")
            # Default size 40 si no se especifica size_texto
            font_size = s(int(el.get("size_texto", 40)))
            
            font_path = self._get_font_path(font_name, weight)
            
            try:
                font_obj = ImageFont.truetype(font_path, font_size)
            except Exception as e:
                print(f"⚠️ Error cargando fuente para marquesina {font_path}: {e}. Usando default.")
                font_obj = ImageFont.load_default()

            # Calcular dimensiones del texto
            if hasattr(font_obj, 'getbbox'):
                left, top, right, bottom = font_obj.getbbox(content)
                text_w = right - left
                text_h = bottom - top
                offset_x = -left
                offset_y = -top
            else:
                text_w, text_h = font_obj.getsize(content)
                offset_x = 0
                offset_y = 0
            
            # Margen de seguridad para evitar cortes en acentos y espacio para sombra
            safe_margin = int(font_size * 0.2)
            extra_shadow_pad = 0
            if sombra:
                try:
                    blur_s, dx_s, dy_s, _ = sombra
                    extra_shadow_pad = int(max(abs(dx_s), abs(dy_s)) + max(0, blur_s) * 2)
                except Exception:
                    extra_shadow_pad = 0
            pad_total = safe_margin + extra_shadow_pad
            img_w = text_w + (pad_total * 2)
            img_h = text_h + (pad_total * 2)
            
            # Crear imagen base transparente
            txt_img = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))
            draw_txt = ImageDraw.Draw(txt_img)
            
            # Obtener color RGBA
            fill_color = self._hex_to_rgb(el.get("color", "#FFFFFF"))
            
            # Dibujar texto principal
            text_x = pad_total + offset_x
            text_y = pad_total + offset_y
            draw_txt.text((text_x, text_y), content, font=font_obj, fill=fill_color)
            
            # Sombra sobre el texto (basada en alpha de glifos)
            if sombra:
                try:
                    blur_t, dx_t, dy_t, color_rgba_t = sombra
                    alpha_txt = txt_img.split()[3]
                    shadow_mask = alpha_txt.copy()
                    if blur_t > 0:
                        shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur_t))
                    base_alpha = 255
                    if isinstance(color_rgba_t, tuple) and len(color_rgba_t) == 4:
                        base_alpha = color_rgba_t[3]
                    if base_alpha < 255:
                        factor = max(0.0, min(1.0, base_alpha / 255.0))
                        shadow_mask = shadow_mask.point(lambda p: int(p * factor))
                    shadow_rgba = Image.new("RGBA", txt_img.size, color_rgba_t)
                    shadow_rgba.putalpha(shadow_mask)
                    # Componer sombra con desplazamiento
                    base_canvas = Image.new("RGBA", txt_img.size, (0, 0, 0, 0))
                    base_canvas.paste(shadow_rgba, (dx_t, dy_t), shadow_rgba)
                    base_canvas.paste(txt_img, (0, 0), txt_img)
                    txt_img = base_canvas
                except Exception as e:
                    print(f"⚠️ Error aplicando sombra de texto en marquesina: {e}")
            
            # Recortar espacios vacíos (Crop) para que el clip sea del tamaño exacto del texto
            bbox = txt_img.getbbox()
            if bbox:
                txt_img = txt_img.crop(bbox)
            
            # Convertir a ImageClip de MoviePy
            txt = ImageClip(np.array(txt_img)).set_duration(duration)
            
            # Lógica de Scroll Infinito
            scroll_speed = s(int(el.get("velocidad", 200)))
            direction = el.get("direccion", "left").lower() # left (default: texto viaja hacia la izquierda <--) o right (-->)
            
            gap = s(50)
            item_w = txt.w + gap
            
            # Número de copias para llenar el ancho + buffer
            num_copies = math.ceil(bar_w / item_w) + 2
            cycle_len = num_copies * item_w
            
            # Centrar verticalmente en el área efectiva
            # Al usar un contenedor recortado, la Y es relativa a ese contenedor (0 = pt)
            y_pos_txt = (effective_h - txt.h) / 2
            
            threshold = -item_w
            
            text_copies = []
            for k in range(num_copies):
                def make_pos_func(offset_k):
                    def pos_func(t):
                        if direction == "right":
                             # Desplazamiento hacia la derecha (-->)
                             raw_x = threshold + offset_k + (scroll_speed * t)
                             # Wrapping especial para derecha
                             x_final = (raw_x % cycle_len) + threshold
                             return (x_final, y_pos_txt)
                        else:
                            # Desplazamiento hacia la izquierda (<--) [DEFAULT]
                            # Usamos effective_w para que empiece justo después del padding
                            raw_x = effective_w + offset_k - (scroll_speed * t)
                            # Wrapping
                            x_final = ((raw_x - threshold) % cycle_len) + threshold
                            return (x_final, y_pos_txt)
                    return pos_func

                # Crear copia y asignar posición relativa al contenedor
                txt_k = txt.copy().set_pos(make_pos_func(k * item_w))
                text_copies.append(txt_k)
                
            # Componer textos y enmascarar
            # CompositeVideoClip interno para los textos
            # Ojo: size de Composite recorta lo que sobra
            masked_text = (CompositeVideoClip(text_copies, size=(effective_w, effective_h))
                           .set_pos((pl, pt)) # Relativo al contenedor (respetando padding)
                           .set_duration(duration))
            
            container_clips.append(masked_text)
            
            # Retornamos un Composite de fondo + texto enmascarado
            # El composite tiene el tamaño de la barra y se posiciona en el canvas
            return CompositeVideoClip(container_clips, size=(bar_w, bar_h))\
                .set_pos((bar_x, bar_y))\
                .set_duration(duration)

        except Exception as e:
            print(f"⚠️ Error creando marquesina: {e}")
            return None

    def _create_video_overlay_clip(self, el: Dict[str, Any], duration: float):
        """
        Crea un clip de video superpuesto (picture-in-picture) similar a una imagen,
        respetando posicion, size, transparencia, radius y margin.
        """
        try:
            content = str(el.get("contenido", el.get("video", el.get("url", "")))).strip()
            if not content:
                print("⚠️ Elemento 'video' sin campo 'contenido'.")
                return None

            try:
                clip = VideoFileClip(content)
            except Exception as e:
                print(f"⚠️ Error abriendo video overlay {content}: {e}")
                return None

            try:
                max_dur = duration
                try:
                    if clip.duration:
                        max_dur = min(duration, clip.duration)
                except Exception:
                    pass
                clip = clip.subclip(0, max_dur)

                target_size = self._parse_coords(str(el.get("size", "0,0")))
                if target_size[0] > 0 and target_size[1] > 0:
                    clip = clip.resize(newsize=(target_size[0], target_size[1]))

                base_pos = self._parse_coords(str(el.get("posicion", "0,0")))
                pos = self._apply_margin(base_pos, el)
                clip = clip.set_position(pos)

                opacity = 1.0
                if "opacity" in el:
                    try:
                        opacity = float(el.get("opacity", 1.0))
                    except Exception:
                        opacity = 1.0
                elif "transparencia" in el:
                    try:
                        transparencia = float(el.get("transparencia", 0.0))
                        opacity = max(0.0, min(1.0, 1.0 - transparencia))
                    except Exception:
                        opacity = 1.0
                if opacity < 1.0:
                    clip = clip.set_opacity(opacity)

                radius_raw = el.get("radius", 0)
                radius, corners = self._parse_radius(radius_raw)
                w = int(clip.w)
                h = int(clip.h)
                mask_img = None
                if radius > 0:
                    mask_img = Image.new("L", (w, h), 0)
                    draw_mask = ImageDraw.Draw(mask_img)
                    draw_mask.rounded_rectangle((0, 0, w, h), radius=radius, corners=corners, fill=255)
                    mask_clip = ImageClip(np.array(mask_img) / 255.0, ismask=True).set_duration(clip.duration)
                    clip = clip.set_mask(mask_clip)

                # Sombra opcional para video
                sombra = self._parse_shadow(el)
                if sombra:
                    blur, dx, dy, color_rgba = sombra
                    try:
                        if mask_img is None:
                            mask_img = Image.new("L", (w, h), 255)
                        shadow_mask = mask_img.copy()
                        if blur > 0:
                            shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur))
                        shadow_rgba = Image.new("RGBA", (w, h), color_rgba)
                        shadow_rgba.putalpha(shadow_mask)
                        shadow_clip = ImageClip(np.array(shadow_rgba)).set_duration(clip.duration).set_pos((dx, dy))
                        # Componer sombra + video en un contenedor del tamaño del video
                        composed = CompositeVideoClip([shadow_clip, clip.set_pos((0, 0))], size=(w, h)).set_pos(pos)
                        return composed
                    except Exception as e:
                        print(f"⚠️ Sombra video error: {e}")

                return clip

            except Exception as e:
                print(f"⚠️ Error configurando overlay de video: {e}")
                try:
                    clip.close()
                except Exception:
                    pass
                return None

        except Exception as e:
            print(f"⚠️ Error creando overlay de video: {e}")
            return None

    def _render_two_column_text(self, el: Dict[str, Any], draw: ImageDraw.ImageDraw, override_pos: Tuple[int, int] = None) -> None:
        """
        Renderiza texto en dos columnas dentro del área definida.
        """
        try:
            # Validación: Las claves deben existir, aunque el contenido sea vacío.
            if "col1_contenido" not in el or "col2_contenido" not in el:
                raise ValueError("El elemento 'texto_dos_columnas' requiere las claves 'col1_contenido' y 'col2_contenido' (pueden estar vacías).")

            # Procesar <br>, <br/>, </br> como saltos de línea \n
            def process_br(text):
                if not text: return ""
                t = str(text)
                t = t.replace("<br>", "\n").replace("<br/>", "\n").replace("</br>", "\n")
                return t

            col1_txt = process_br(el.get("col1_contenido", ""))
            col2_txt = process_br(el.get("col2_contenido", ""))
            
            if override_pos:
                pos = override_pos
            else:
                pos = self._parse_coords(el.get("posicion", "0,0"))
                pos = self._apply_margin(pos, el)

            size = self._parse_coords(el.get("size", "100%, 100"))
            
            font_name = el.get("tipografia", "arial")
            weight = el.get("peso", "bold")
            # FIX: Usar size_texto para evitar conflicto con size del contenedor
            base_font_size_raw = int(el.get("size_texto", el.get("font_size", 40)))
            base_color = el.get("color", "#FFFFFF")
            
            # Base stroke settings
            base_stroke_width = int(el.get("borde_grosor", 0))
            base_stroke_color = el.get("borde_color", "#000000")
            
            # Helper para obtener estilo por columna
            def get_col_style(prefix):
                f_name = el.get(f"{prefix}_tipografia", font_name)
                f_weight = el.get(f"{prefix}_peso", weight)
                f_size = s(int(el.get(f"{prefix}_size_texto", base_font_size_raw)))
                c_hex = el.get(f"{prefix}_color", base_color)
                
                # Stroke specific
                s_width = s(int(el.get(f"{prefix}_borde_grosor", base_stroke_width)))
                s_fill = None
                if s_width > 0:
                    s_color_hex = el.get(f"{prefix}_borde_color", base_stroke_color)
                    s_fill = self._hex_to_rgb(s_color_hex)
                
                f_path = self._get_font_path(f_name, f_weight)
                try:
                    font_obj = ImageFont.truetype(f_path, f_size)
                except:
                    font_obj = ImageFont.load_default()
                
                return font_obj, self._hex_to_rgb(c_hex), s_width, s_fill

            font1, color1, stroke_width1, stroke_fill1 = get_col_style("col1")
            font2, color2, stroke_width2, stroke_fill2 = get_col_style("col2")
            
            # Configuración de columnas
            # Por defecto 50% - 50%
            split_pct = float(el.get("split_pct", 50)) / 100.0
            gap = s(int(el.get("gap", 20)))
            
            # Aplicar Padding al contenedor principal
            pt, pr, pb, pl = self._get_padding(el)
            
            x_start, y_start = pos
            w_total, h_total = size
            
            # Ajustar área útil por padding
            x_start += pl
            y_start += pt
            w_total -= (pl + pr)
            h_total -= (pt + pb)
            
            # Calcular anchos disponibles dentro del área con padding
            # w_total = w1 + gap + w2
            # w1 = (w_total - gap) * split_pct
            avail_w = w_total - gap
            w1 = int(avail_w * split_pct)
            w2 = avail_w - w1
            
            x1 = x_start
            x2 = x_start + w1 + gap

            # Nuevos parámetros
            line_spacing = s(int(el.get("interlineado", el.get("line_spacing", 4))))
            tracking = s(int(el.get("espacio_letras", el.get("tracking", 0))))

            # Helper para calcular altura total de texto multilínea
            def get_text_height(txt, fnt, l_spacing):
                lines = txt.split('\n')
                try:
                    ascent, descent = fnt.getmetrics()
                    base_h = ascent + descent
                except:
                    bbox = fnt.getbbox("Ay")
                    base_h = bbox[3] - bbox[1] + 5
                
                return (base_h * len(lines)) + (l_spacing * (len(lines) - 1))

            # Renderizar Columna 1
            if col1_txt:
                txt_h1 = get_text_height(col1_txt, font1, line_spacing)
                
                # Ajuste Y para centrar verticalmente en h_total
                y1 = y_start + (h_total - txt_h1) // 2
                
                # Alineación horizontal
                align1 = el.get("col1_align", "center").lower()
                
                if align1 == "center":
                    xx1 = x1 + (w1 // 2)
                elif align1 == "right":
                    xx1 = x1 + w1
                else: # left
                    xx1 = x1
                    
                self._draw_text_advanced(draw, (xx1, y1), col1_txt, font1, color1, 
                                       align=align1, line_spacing=line_spacing, tracking=tracking,
                                       stroke_width=stroke_width1, stroke_fill=stroke_fill1)

            # Renderizar Columna 2
            if col2_txt:
                txt_h2 = get_text_height(col2_txt, font2, line_spacing)
                y2 = y_start + (h_total - txt_h2) // 2
                
                align2 = el.get("col2_align", "center").lower()
                
                if align2 == "center":
                    xx2 = x2 + (w2 // 2)
                elif align2 == "right":
                    xx2 = x2 + w2
                else: # left
                    xx2 = x2
                
                self._draw_text_advanced(draw, (xx2, y2), col2_txt, font2, color2, 
                                       align=align2, line_spacing=line_spacing, tracking=tracking,
                                       stroke_width=stroke_width2, stroke_fill=stroke_fill2)
                
            # Opcional: Línea divisoria
            if el.get("divisor", False):
                div_color = self._hex_to_rgb(el.get("divisor_color", "#FFFFFF"))
                div_w = s(int(el.get("divisor_width", 2)))
                line_x = x1 + w1 + (gap // 2)
                # Margen vertical del divisor
                pad_y = s(int(el.get("divisor_padding", 10)))
                draw.line([(line_x, y_start + pad_y), (line_x, y_start + h_total - pad_y)], fill=div_color, width=div_w)

        except Exception as e:
            print(f"⚠️ Error renderizando texto dos columnas: {e}")

    def _render_multi_column_text(self, el: Dict[str, Any], img: Image.Image, draw: ImageDraw.ImageDraw, override_pos: Tuple[int, int] = None) -> None:
        """
        Renderiza texto en N columnas.
        Espera una clave "columnas": [ { "contenido": "...", "width": "...", ... }, ... ]
        """
        try:
            columns = el.get("columnas", [])
            if not columns: return

            # 1. Resolver posición y tamaño base
            if override_pos:
                pos = override_pos
            else:
                pos = self._parse_coords(el.get("posicion", "0,0"))
                pos = self._apply_margin(pos, el)

            size = self._parse_coords(el.get("size", "100%, 100"))
            w_total, h_total = size
            x_start, y_start = pos

            # Aplicar Padding Global al contenedor
            pt, pr, pb, pl = self._get_padding(el)
            x_start += pl
            y_start += pt
            w_avail = w_total - (pl + pr)
            h_avail = h_total - (pt + pb)

            if w_avail <= 0: return

            # 2. Configuración Global de Estilo (Defaults)
            base_font_name = el.get("tipografia", "arial")
            base_weight = el.get("peso", "bold")
            # FIX: Prioridad a size_texto
            base_font_size = int(el.get("size_texto", el.get("font_size", 40)))
            base_color = el.get("color", "#FFFFFF")
            base_stroke_width = int(el.get("borde_grosor", 0))
            base_stroke_color = el.get("borde_color", "#000000")
            
            line_spacing = s(int(el.get("interlineado", el.get("line_spacing", 4))))
            tracking = s(int(el.get("espacio_letras", el.get("tracking", 0))))

            # 3. Calcular anchos de columnas
            gap = s(int(el.get("gap", 20)))
            num_cols = len(columns)
            total_gap = gap * (num_cols - 1) if num_cols > 1 else 0
            
            # Espacio disponible para contenido de columnas (sin gaps)
            w_for_cols = w_avail - total_gap
            
            final_widths = []
            undefined_indices = []
            used_width = 0
            
            for i, col in enumerate(columns):
                w_raw = col.get("width")
                if w_raw:
                    # Parsear width (puede ser "20%" relativo al ancho disponible total)
                    # Nota: Usamos w_avail como base para porcentajes, o w_for_cols?
                    # CSS Grid suele usar fr, pero aquí simplificamos: % es de w_avail.
                    val = self._parse_value(str(w_raw), w_avail)
                    final_widths.append(val)
                    used_width += val
                else:
                    final_widths.append(None)
                    undefined_indices.append(i)
            
            # Distribuir espacio restante equitativamente
            if undefined_indices:
                remaining = max(0, w_for_cols - used_width)
                per_col = remaining // len(undefined_indices)
                for i in undefined_indices:
                    final_widths[i] = per_col

            # 4. Renderizar Columnas
            current_x = x_start
            
            def process_br(text):
                if not text: return ""
                return str(text).replace("<br>", "\n").replace("<br/>", "\n").replace("</br>", "\n")

            for i, col in enumerate(columns):
                col_w = final_widths[i]
                if col_w <= 0: 
                    current_x += gap
                    continue

                bg_col = col.get("bg_color", col.get("fondo", None))
                if bg_col:
                    bg_trans = float(col.get("bg_transparencia", col.get("bg_opacity", 0.0)))
                    bg_opacity = max(0.0, min(1.0, 1.0 - bg_trans))
                    try:
                        bg_img = self._create_fill_image((col_w, h_avail), bg_col, bg_opacity)
                        radius_raw = col.get("radius", 0)
                        radius, corners = self._parse_radius(radius_raw)
                        if radius > 0:
                            mask = Image.new("L", (col_w, h_avail), 0)
                            draw_mask = ImageDraw.Draw(mask)
                            draw_mask.rounded_rectangle((0, 0, col_w, h_avail), radius=radius, corners=corners, fill=255)
                            bg_img.putalpha(ImageChops.multiply(bg_img.split()[3], mask))
                        img.paste(bg_img, (current_x, y_start), bg_img)
                    except Exception as e:
                        print(f"⚠️ Error renderizando fondo columna {i}: {e}")

                # Estilo específico de la columna (merge con defaults)
                c_font_name = col.get("tipografia", base_font_name)
                c_weight = col.get("peso", base_weight)
                c_size = s(int(col.get("size_texto", base_font_size)))
                c_color = col.get("color", base_color)
                
                c_stroke_w = s(int(col.get("borde_grosor", base_stroke_width)))
                c_stroke_fill = None
                if c_stroke_w > 0:
                    c_stroke_c = col.get("borde_color", base_stroke_color)
                    c_stroke_fill = self._hex_to_rgb(c_stroke_c)

                # Font Loading
                f_path = self._get_font_path(c_font_name, c_weight)
                try:
                    font_obj = ImageFont.truetype(f_path, c_size)
                except:
                    font_obj = ImageFont.load_default()
                
                # Texto
                txt = process_br(col.get("contenido", ""))
                if txt:
                    # Calcular altura para centrado vertical
                    lines = txt.split('\n')
                    try:
                        ascent, descent = font_obj.getmetrics()
                        base_h = ascent + descent
                    except:
                        bbox = font_obj.getbbox("Ay")
                        base_h = bbox[3] - bbox[1] + 5
                    
                    txt_h = (base_h * len(lines)) + (line_spacing * (len(lines) - 1))
                    
                    # Centrado vertical en el espacio disponible
                    col_y = y_start + (h_avail - txt_h) // 2
                    
                    # Alineación horizontal dentro de la columna
                    align = col.get("alineacion", "center").lower()
                    
                    if align == "center":
                        draw_x = current_x + (col_w // 2)
                    elif align == "right":
                        draw_x = current_x + col_w
                    else: # left
                        draw_x = current_x
                        
                    self._draw_text_advanced(draw, (draw_x, col_y), txt, font_obj, self._hex_to_rgb(c_color),
                                           align=align, line_spacing=line_spacing, tracking=tracking,
                                           stroke_width=c_stroke_w, stroke_fill=c_stroke_fill)

                # Dibujar divisor a la derecha si no es la última columna
                if i < num_cols - 1 and el.get("divisor", False):
                    div_color = self._hex_to_rgb(el.get("divisor_color", "#FFFFFF"))
                    div_w = s(int(el.get("divisor_width", 2)))
                    # El divisor va en el centro del gap
                    div_x = current_x + col_w + (gap // 2)
                    
                    pad_y = s(int(el.get("divisor_padding", 10)))
                    draw.line([(div_x, y_start + pad_y), (div_x, y_start + h_avail - pad_y)], fill=div_color, width=div_w)

                # Avanzar X
                current_x += col_w + gap

        except Exception as e:
            print(f"⚠️ Error renderizando texto varias columnas: {e}")

    def _create_fill_image(self, size: Tuple[int, int], color_def: Any, opacity: float = 1.0) -> Image.Image:
        w, h = size
        if w <= 0 or h <= 0:
            return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
        if isinstance(color_def, dict) and str(color_def.get("tipo", "")).lower() in ["linear", "lineal"]:
            colors = color_def.get("colores", ["#FFFFFF", "#000000"])
            if not isinstance(colors, (list, tuple)) or len(colors) < 2:
                colors = ["#FFFFFF", "#000000"]
            c1 = self._hex_to_rgb(colors[0])
            c2 = self._hex_to_rgb(colors[1])
            direction = str(color_def.get("direccion", "")).lower()
            angle_raw = color_def.get("angulo", color_def.get("angle", None))
            angle = None
            if angle_raw is not None:
                try:
                    angle = float(angle_raw) % 360.0
                except:
                    angle = None
            if angle is None:
                if direction in ["vertical", "v"]:
                    angle = 90.0
                elif direction in ["horizontal", "h"]:
                    angle = 0.0
                else:
                    angle = 0.0

            mid_raw = color_def.get("punto_medio", color_def.get("mid", None))
            mid = 1.0
            if mid_raw is not None:
                try:
                    mid = float(mid_raw)
                    if mid > 1.0:
                        mid = mid / 100.0
                except:
                    mid = 1.0
            if mid < 0.0:
                mid = 0.0
            if mid > 1.0:
                mid = 1.0

            def _mix_channel(v1: int, v2: int, t: float) -> int:
                return int(v1 + (v2 - v1) * t)

            def _t_with_mid(t: float) -> float:
                t = max(0.0, min(1.0, t))
                if mid >= 1.0 or mid <= 0.0:
                    return t
                if t <= mid:
                    return 0.0
                return (t - mid) / (1.0 - mid)

            if angle % 180 in [0.0] or abs(angle % 180.0) < 1e-6:
                length = max(w, 2)
                base = Image.new("RGBA", (length, 1))
                for x in range(length):
                    if length > 1:
                        t = x / (length - 1)
                    else:
                        t = 0.0
                    t2 = _t_with_mid(t)
                    r = _mix_channel(c1[0], c2[0], t2)
                    g = _mix_channel(c1[1], c2[1], t2)
                    b = _mix_channel(c1[2], c2[2], t2)
                    a = _mix_channel(c1[3], c2[3], t2)
                    base.putpixel((x, 0), (r, g, b, a))
                img = base.resize((w, h), resample=Image.Resampling.BICUBIC)
            elif angle % 180 in [90.0] or abs((angle % 180.0) - 90.0) < 1e-6:
                length = max(h, 2)
                base = Image.new("RGBA", (1, length))
                for y in range(length):
                    if length > 1:
                        t = y / (length - 1)
                    else:
                        t = 0.0
                    t2 = _t_with_mid(t)
                    r = _mix_channel(c1[0], c2[0], t2)
                    g = _mix_channel(c1[1], c2[1], t2)
                    b = _mix_channel(c1[2], c2[2], t2)
                    a = _mix_channel(c1[3], c2[3], t2)
                    base.putpixel((0, y), (r, g, b, a))
                img = base.resize((w, h), resample=Image.Resampling.BICUBIC)
            else:
                diag = int(math.hypot(w, h))
                if diag < 2:
                    diag = 2
                base = Image.new("RGBA", (diag, 1))
                for x in range(diag):
                    if diag > 1:
                        t = x / (diag - 1)
                    else:
                        t = 0.0
                    t2 = _t_with_mid(t)
                    r = _mix_channel(c1[0], c2[0], t2)
                    g = _mix_channel(c1[1], c2[1], t2)
                    b = _mix_channel(c1[2], c2[2], t2)
                    a = _mix_channel(c1[3], c2[3], t2)
                    base.putpixel((x, 0), (r, g, b, a))
                square = base.resize((diag, diag), resample=Image.Resampling.BILINEAR)
                rot = square.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
                cx = (rot.width - w) // 2
                cy = (rot.height - h) // 2
                img = rot.crop((cx, cy, cx + w, cy + h))
        else:
            color_hex = str(color_def) if color_def else "#FFFFFF"
            color_rgba = self._hex_to_rgb(color_hex)
            img = Image.new("RGBA", size, color_rgba)
        if opacity < 1.0:
            r, g, b, a = img.split()
            a = a.point(lambda p: int(p * opacity))
            img = Image.merge("RGBA", (r, g, b, a))
        return img

    def _draw_text_advanced(self, draw, pos, text, font, fill, align="left", 
                          line_spacing=0, tracking=0, 
                          stroke_width=0, stroke_fill=None):
        """
        Renderiza texto con soporte avanzado para tracking (espaciado entre letras) 
        e interlineado personalizado.
        """
        x_start, y_start = pos
        lines = text.split('\n')
        
        # Calcular altura de línea base
        # Usamos getbbox para 'Ay' para tener una altura representativa o getmetrics
        try:
            ascent, descent = font.getmetrics()
            base_line_height = ascent + descent
        except:
            # Fallback si getmetrics no está disponible
            bbox = font.getbbox("Ay")
            base_line_height = bbox[3] - bbox[1] + 5 # Aproximado
            
        total_line_height = base_line_height + line_spacing
        
        current_y = y_start
        
        for line in lines:
            # Si no hay tracking, usamos el renderizado estándar por línea para aprovechar kerning
            if tracking == 0:
                # Ajuste de alineación manual para cada línea si es necesario
                # draw.text soporta align, pero es relativo al anchor.
                # Aquí calculamos ancho para alinear manualmente.
                line_w = font.getlength(line)
                
                draw_x = x_start
                if align == "center":
                    draw_x -= (line_w / 2)
                elif align == "right":
                    draw_x -= line_w
                    
                draw.text((draw_x, current_y), line, font=font, fill=fill, 
                          stroke_width=stroke_width, stroke_fill=stroke_fill)
                
            else:
                # Renderizado caracter por caracter para tracking
                # 1. Calcular ancho total de la línea
                chars = list(line)
                if not chars:
                    current_y += total_line_height
                    continue
                    
                char_widths = [font.getlength(c) for c in chars]
                total_w = sum(char_widths) + (len(chars) - 1) * tracking
                
                # 2. Determinar X inicial según alineación
                current_x = x_start
                if align == "center":
                    current_x -= (total_w / 2)
                elif align == "right":
                    current_x -= total_w
                
                # 3. Dibujar caracteres
                for i, char in enumerate(chars):
                    draw.text((current_x, current_y), char, font=font, fill=fill,
                              stroke_width=stroke_width, stroke_fill=stroke_fill)
                    current_x += char_widths[i] + tracking
            
            current_y += total_line_height

    def _parse_radius(self, radius_input):
        """
        Parsea el input de radius.
        Soporta:
        - Entero/String numérico: "20" -> (20, (True, True, True, True))
        - CSS string: "40, 40, 40, 0" -> (40, (True, True, True, False))
        
        Nota: Pillow rounded_rectangle usa un único radio para las esquinas activas.
        Si hay múltiples radios diferentes, usamos el máximo y activamos las esquinas > 0.
        """
        try:
            # Si es un solo número (int o float)
            if isinstance(radius_input, (int, float)):
                r = int(radius_input)
                return s(r), (True, True, True, True)
            
            s_val = str(radius_input).strip()
            
            # Caso "40, 40, 40, 0"
            if "," in s_val:
                parts = [int(p.strip()) for p in s_val.split(",")]
                if len(parts) == 4:
                    tl, tr, br, bl = parts
                    # Detectar radio máximo de los valores presentes
                    # (Ignoramos 0 para el cálculo del radio efectivo si hay otros valores)
                    non_zero = [v for v in parts if v > 0]
                    max_r = max(non_zero) if non_zero else 0
                    
                    # Esquinas activas (TopLeft, TopRight, BottomRight, BottomLeft)
                    corners = (tl > 0, tr > 0, br > 0, bl > 0)
                    return s(max_r), corners
            
            # Fallback a un solo número en string "20"
            r = int(s_val)
            return s(r), (True, True, True, True)
            
        except Exception as e:
            # print(f"Error parsing radius: {e}")
            return 0, (True, True, True, True)

    def _wrap_text(self, text: str, font: Any, max_width: int) -> str:
        """
        Envuelve el texto automáticamente si excede max_width.
        """
        if max_width <= 0:
            return text
            
        lines = []
        for paragraph in text.split('\n'):
            words = paragraph.split(' ')
            current_line = []
            current_width = 0
            
            for word in words:
                # getlength retorna float
                word_w = font.getlength(word + " ")
                if current_width + word_w <= max_width:
                    current_line.append(word)
                    current_width += word_w
                else:
                    if current_line:
                        lines.append(" ".join(current_line))
                    current_line = [word]
                    current_width = font.getlength(word + " ")
            
            if current_line:
                lines.append(" ".join(current_line))
                
        return "\n".join(lines)

    def _render_static_pil(self, elements: List[Dict], duration: float) -> Optional[ImageClip]:
        """Renderiza todos los elementos estáticos en una sola imagen PIL."""
        if not elements: return None
        
        img = Image.new('RGBA', (self.canvas_w, self.canvas_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # last_rect: (x, y, w, h)
        last_rect = None
        
        for el in elements:
            try:
                etype = el.get("tipo", "").lower()
                
                # -----------------------------------------------------
                # 1. RESOLVER TAMAÑO DEL OBJETO (obj_w, obj_h)
                #    Necesario ANTES de posicionar si se usa 'center'
                # -----------------------------------------------------
                obj_w, obj_h = 0, 0
                
                # Para guardar referencias temporales y no recargar
                temp_img = None
                temp_font = None
                temp_content = None
                
                if etype in ["rectangulo", "cuadrado", "rect", "square", "circulo", "circle", "texto_dos_columnas", "texto_varias_columnas"]:
                    obj_w, obj_h = self._parse_coords(el.get("size", "100,100"))
                    
                elif etype in ["imagen", "image"]:
                    content = str(el.get("contenido", el.get("imagen", el.get("url", ""))))
                    if not content: continue
                    
                    try:
                        # Preparar tamaño objetivo antes de cargar (para rasterizar SVG a ese tamaño si se puede)
                        target_size = self._parse_coords(el.get("size", "0,0"))
                        target_w = target_size[0]
                        target_h = target_size[1]

                        src_path = None
                        ext_lower = ""
                        if content.startswith("http"):
                            try:
                                ext_lower = ".png"
                                if "." in content.split("/")[-1]:
                                    ext_lower = os.path.splitext(content.split("/")[-1])[1]
                                    if "?" in ext_lower: ext_lower = ext_lower.split("?")[0]
                                ext_lower = (ext_lower or ".png").lower()
                                
                                temp_path = download_file(content, suffix=ext_lower)
                                src_path = temp_path
                            except Exception as e:
                                print(f"⚠️ Error descargando imagen {content}: {e}")
                                continue
                        else:
                            if os.path.exists(content):
                                src_path = content
                                ext_lower = os.path.splitext(content)[1].lower()
                            else:
                                print(f"⚠️ Imagen no encontrada: {content}")
                                continue

                        # Si es SVG, rasterizar primero
                        cleanup_src = False
                        try:
                            if ext_lower in [".svg", ".svgz"]:
                                png_path = self._rasterize_svg(src_path, out_w=target_w if target_w > 0 else None, out_h=target_h if target_h > 0 else None)
                                if png_path:
                                    temp_img = Image.open(png_path).convert("RGBA")
                                    temp_img.load()
                                    try:
                                        os.remove(png_path)
                                    except:
                                        pass
                                else:
                                    print("⚠️ No se pudo rasterizar el SVG, se omitirá el elemento.")
                                    # limpiar temp descargado si aplica
                                    if content.startswith("http") and src_path and os.path.exists(src_path):
                                        os.remove(src_path)
                                    continue
                            else:
                                # Raster (png/jpg/etc)
                                temp_img = Image.open(src_path).convert("RGBA")
                                temp_img.load()
                        finally:
                            # Eliminar archivo descargado temporal si vino por HTTP
                            if content.startswith("http") and src_path and os.path.exists(src_path):
                                try: os.remove(src_path)
                                except: pass
                        
                        # Redimensionar si se pide (si no se hizo al rasterizar)
                        if target_w > 0 and target_h > 0:
                            temp_img = temp_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
                        
                        obj_w, obj_h = temp_img.size
                        
                    except Exception as e:
                        print(f"⚠️ Error cargando imagen {content}: {e}")
                        continue

                elif etype in ["texto", "text"]:
                    raw_content = str(el.get("contenido", el.get("texto", "")))
                    if not raw_content or not raw_content.strip(): continue
                    
                    # Procesar saltos de línea HTML
                    temp_content = raw_content.replace("<br>", "\n").replace("<br/>", "\n").replace("</br>", "\n")
                    
                    font_name = el.get("tipografia", "arial")
                    weight = el.get("peso", "bold")
                    font_size = s(int(el.get("size_texto", el.get("size", 40))))
                    
                    font_path = self._get_font_path(font_name, weight)
                    try:
                        temp_font = ImageFont.truetype(font_path, font_size)
                    except:
                        temp_font = ImageFont.load_default()
                        
                    # Calcular tamaño (bbox) considerando múltiples líneas
                    lines = temp_content.split('\n')
                    
                    # Interlineado para cálculo de altura total
                    line_spacing = s(int(el.get("interlineado", el.get("line_spacing", 4))))
                    
                    try:
                        ascent, descent = temp_font.getmetrics()
                        line_h = ascent + descent
                    except:
                        line_h = temp_font.getbbox("Ay")[3] + 5

                    # Ancho máximo de las líneas
                    max_w = 0
                    tracking = s(int(el.get("espacio_letras", el.get("tracking", 0))))
                    
                    for line in lines:
                        if tracking > 0:
                            # Calcular ancho con tracking
                            chars = list(line)
                            if chars:
                                char_widths = [temp_font.getlength(c) for c in chars]
                                w_line = sum(char_widths) + (len(chars) - 1) * tracking
                            else:
                                w_line = 0
                        else:
                            w_line = temp_font.getlength(line)
                        
                        if w_line > max_w: max_w = w_line
                    
                    obj_w = int(max_w)
                    obj_h = int((line_h * len(lines)) + (line_spacing * (len(lines) - 1)))
                    
                # -----------------------------------------------------
                # 2. CALCULAR POSICIÓN (Soporte 'center' y Relativo)
                # -----------------------------------------------------
                
                # Contexto: (cx, cy, cw, ch)
                if last_rect:
                    cx, cy, cw, ch = last_rect
                else:
                    cx, cy, cw, ch = 0, 0, self.canvas_w, self.canvas_h
                
                pos_str = str(el.get("posicion", "0,0")).lower()
                
                # Lógica de parsing personalizada para soportar "center"
                parts = [p.strip() for p in pos_str.split(",")]
                if len(parts) == 1: parts.append(parts[0]) # si solo es "center", aplica a ambos
                
                # Eje X
                if "center" in parts[0]:
                    x = cx + (cw - obj_w) // 2
                elif "right" in parts[0]:
                    x = cx + cw - obj_w
                elif "left" in parts[0]:
                    x = cx
                else:
                    # Offset numérico
                    off_x = self._parse_value(parts[0], self.canvas_w)
                    # Si hay last_rect, es relativo (suma al origen del contexto)
                    # Si NO hay last_rect (es canvas), el origen es 0,0, así que off_x es absoluto.
                    x = cx + off_x
                    
                # Eje Y
                if "center" in parts[1]:
                    y = cy + (ch - obj_h) // 2
                elif "bottom" in parts[1]:
                    y = cy + ch - obj_h
                elif "top" in parts[1]:
                    y = cy
                else:
                    off_y = self._parse_value(parts[1], self.canvas_h)
                    y = cy + off_y
                
                # Posición base calculada
                pos = (x, y)
                
                # Aplicar Margen
                pos = self._apply_margin(pos, el)
                
                # Debug opcional de alineación
                try:
                    if os.environ.get("DEBUG_ALIGN", "").lower() in ["1", "true", "yes"]:
                        print(f"[ALIGN] tipo={etype} pos_raw='{pos_str}' parts={parts} "
                              f"context=(cx={cx},cy={cy},cw={cw},ch={ch}) "
                              f"size=(w={obj_w},h={obj_h}) -> pos={pos}")
                except:
                    pass
                
                # Actualizar last_rect para el SIGUIENTE elemento
                # MODIFICACIÓN: El usuario requiere que TODOS los elementos subsiguientes
                # sean relativos al PRIMER elemento del bloque.
                # Por lo tanto, solo establecemos last_rect la primera vez.
                if last_rect is None:
                    last_rect = (pos[0], pos[1], obj_w, obj_h)
                
                
                # -----------------------------------------------------
                # 3. RENDERIZADO (DRAW)
                # -----------------------------------------------------
                
                if etype in ["rectangulo", "cuadrado", "rect", "square"]:
                    # 1. Calcular dimensiones efectivas
                    # MOD: Ignoramos padding para la geometría del rectángulo
                    # pt, pr, pb, pl = self._get_padding(el)
                    x1, y1 = pos
                    # x1 += pl
                    # y1 += pt
                    w_eff = obj_w # - (pl + pr)
                    h_eff = obj_h # - (pt + pb)
                    if w_eff > 0 and h_eff > 0:
                        sombra = self._parse_shadow(el)

                        # 2. Calcular opacidad desde 'transparencia' (0.0 visible -> 1.0 invisible)
                        # Fallback a 'opacity' legacy si existe
                        transparencia = float(el.get("transparencia", 0.0))
                        if "opacity" in el: # Legacy support
                            transparencia = 1.0 - float(el["opacity"])
                        
                        opacity_factor = max(0.0, min(1.0, 1.0 - transparencia))

                        # 3. Generar imagen de relleno (color o gradiente)
                        fill_img = self._create_fill_image((w_eff, h_eff), el.get("color", "#FFFFFF"), opacity_factor)
                        
                        # 4. Aplicar máscara de bordes redondeados
                        radius_raw = el.get("radius", 0)
                        radius, corners = self._parse_radius(radius_raw)
                        
                        if radius > 0:
                            mask = Image.new("L", (w_eff, h_eff), 0)
                            draw_mask = ImageDraw.Draw(mask)
                            draw_mask.rounded_rectangle((0, 0, w_eff, h_eff), radius=radius, corners=corners, fill=255)
                            # Aplicar máscara al alpha del fill_img
                            fill_img.putalpha(ImageChops.multiply(fill_img.split()[3], mask))

                        # 4b. Sombra opcional (misma forma, desplazada y difuminada)
                        if sombra:
                            blur, dx, dy, color_rgba = sombra
                            pad = max(int(blur), 0)
                            sw = w_eff + 2 * pad
                            sh = h_eff + 2 * pad
                            shadow_mask = Image.new("L", (sw, sh), 0)
                            shadow_draw = ImageDraw.Draw(shadow_mask)
                            if radius > 0:
                                shadow_draw.rounded_rectangle(
                                    (pad, pad, pad + w_eff, pad + h_eff),
                                    radius=radius,
                                    corners=corners,
                                    fill=255
                                )
                            else:
                                shadow_draw.rectangle(
                                    (pad, pad, pad + w_eff, pad + h_eff),
                                    fill=255
                                )
                            if blur > 0:
                                shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur))
                            shadow_img = Image.new("RGBA", (sw, sh), color_rgba)
                            shadow_img.putalpha(shadow_mask)
                            img.paste(shadow_img, (x1 + dx - pad, y1 + dy - pad), shadow_img)
                        
                        # 5. Pegar en canvas
                        img.paste(fill_img, (x1, y1), fill_img)

                elif etype in ["circulo", "circle"]:
                    # 1. Calcular dimensiones efectivas
                    # MOD: Ignoramos padding para la geometría del círculo
                    # pt, pr, pb, pl = self._get_padding(el)
                    x1, y1 = pos
                    # x1 += pl
                    # y1 += pt
                    w_eff = obj_w
                    h_eff = obj_h
                    
                    if w_eff > 0 and h_eff > 0:
                        sombra = self._parse_shadow(el)

                        # 2. Calcular opacidad
                        transparencia = float(el.get("transparencia", 0.0))
                        if "opacity" in el:
                            transparencia = 1.0 - float(el["opacity"])
                        opacity_factor = max(0.0, min(1.0, 1.0 - transparencia))

                        # 3. Generar imagen de relleno
                        fill_img = self._create_fill_image((w_eff, h_eff), el.get("color", "#FFFFFF"), opacity_factor)
                        
                        # 4. Crear máscara elíptica
                        mask = Image.new("L", (w_eff, h_eff), 0)
                        draw_mask = ImageDraw.Draw(mask)
                        draw_mask.ellipse((0, 0, w_eff, h_eff), fill=255)
                        
                        # Sombra opcional para círculo
                        if sombra:
                            blur, dx, dy, color_rgba = sombra
                            shadow_mask = mask.copy()
                            if blur > 0:
                                shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur))
                            shadow_img = Image.new("RGBA", (w_eff, h_eff), color_rgba)
                            shadow_img.putalpha(shadow_mask)
                            img.paste(shadow_img, (x1 + dx, y1 + dy), shadow_img)

                        # 5. Aplicar máscara y pegar
                        fill_img.putalpha(ImageChops.multiply(fill_img.split()[3], mask))
                        img.paste(fill_img, (x1, y1), fill_img)

                elif etype in ["imagen", "image"]:
                    if temp_img:
                        sombra = self._parse_shadow(el)

                        # Opacidad
                        opacity = float(el.get("opacity", 1.0))
                        if opacity < 1.0:
                            alpha = temp_img.split()[3]
                            alpha = alpha.point(lambda p: int(p * opacity))
                            temp_img.putalpha(alpha)
                        
                        # Radius
                        radius_raw = el.get("radius", 0)
                        radius, corners = self._parse_radius(radius_raw)

                        if radius > 0:
                            mask = Image.new("L", temp_img.size, 0)
                            draw_mask = ImageDraw.Draw(mask)
                            draw_mask.rounded_rectangle([(0,0), temp_img.size], radius=radius, corners=corners, fill=255)
                            existing_alpha = temp_img.split()[3]
                            final_alpha = ImageChops.multiply(existing_alpha, mask)
                            temp_img.putalpha(final_alpha)

                        # Sombra opcional basándose en el alpha de la imagen
                        if sombra:
                            blur, dx, dy, color_rgba = sombra
                            alpha_img = temp_img.split()[3]
                            shadow_mask = alpha_img.copy()
                            if blur > 0:
                                shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur))
                            shadow_img = Image.new("RGBA", temp_img.size, color_rgba)
                            shadow_img.putalpha(shadow_mask)
                            img.paste(shadow_img, (pos[0] + dx, pos[1] + dy), shadow_img)

                        img.paste(temp_img, pos, temp_img)

                elif etype in ["texto", "text"]:
                    color = self._hex_to_rgb(el.get("color", "#FFFFFF"))
                    pt, pr, pb, pl = self._get_padding(el)
                    
                    x, y = pos
                    x += pl
                    y += pt
                    
                    # Nuevos parámetros: Interlineado y Tracking
                    line_spacing = s(int(el.get("interlineado", el.get("line_spacing", 4))))
                    tracking = s(int(el.get("espacio_letras", el.get("tracking", 0))))
                    
                    # 1. Wrapping Automático (si hay width definido)
                    # El editor envía 'width' si es un Textbox
                    box_width = int(el.get("width", 0))
                    if box_width > 0:
                         wrap_width = box_width
                         if self.canvas_w == CANVAS_W and self.canvas_h == CANVAS_H:
                             try:
                                 wrap_width = s(box_width)
                             except Exception:
                                 wrap_width = box_width
                         temp_content = self._wrap_text(temp_content, temp_font, wrap_width)
                    
                    # 2. Calcular Dimensiones del Texto (para fondo)
                    lines = temp_content.split('\n')
                    
                    # Altura
                    try:
                        ascent, descent = temp_font.getmetrics()
                        base_h = ascent + descent
                    except:
                        bbox = temp_font.getbbox("Ay")
                        base_h = bbox[3] - bbox[1] + 5
                    
                    total_text_h = (base_h * len(lines)) + (line_spacing * (len(lines) - 1))
                    
                    # Ancho Máximo (Real del texto, no el de la caja)
                    max_text_w = 0
                    for line in lines:
                        if tracking == 0:
                            w_line = temp_font.getlength(line)
                        else:
                            # Calculo aproximado con tracking
                            w_line = sum([temp_font.getlength(c) for c in line]) + (len(line) - 1) * tracking
                        if w_line > max_text_w:
                            max_text_w = w_line
                            
                    # 3. Renderizar Fondo de Texto (si existe)
                    bg_color = el.get("fondo_texto", el.get("backgroundColor", None))
                    
                    if bg_color:
                        # Padding extra para el fondo (opcional, o usar el padding del elemento)
                        # Usamos el padding del elemento (pt, pr, pb, pl) para "inflar" el fondo respecto al texto?
                        # No, x,y ya tienen pl, pt sumados. 
                        # Si el usuario pone padding, quiere que el texto esté dentro.
                        # Entonces el fondo debe cubrir desde (x-pl, y-pt) hasta (x+w+pr, y+h+pb)
                        
                        bg_w = max_text_w + pl + pr
                        bg_h = total_text_h + pt + pb
                        
                        # Si hay box_width fijo, ¿el fondo debe ocupar todo el ancho o solo el texto?
                        # En editor, Textbox tiene ancho fijo y fondo ocupa todo.
                        if box_width > 0:
                            if self.canvas_w == CANVAS_W and self.canvas_h == CANVAS_H:
                                try:
                                    bg_w = s(box_width)
                                except Exception:
                                    bg_w = box_width
                            else:
                                bg_w = box_width
                        
                        bg_x = x - pl
                        bg_y = y - pt
                        
                        # Crear imagen de fondo
                        bg_opacity = 1.0 # Default sólido
                        if "bg_opacity" in el: bg_opacity = float(el["bg_opacity"])
                        
                        fill_img = self._create_fill_image((int(bg_w), int(bg_h)), bg_color, bg_opacity)
                        
                        # Radius del fondo
                        radius_raw = el.get("radius", 0) # Custom prop 'radius' mapped to root
                        radius, corners = self._parse_radius(radius_raw)
                        
                        sombra = self._parse_shadow(el)
                        mask = None
                        if radius > 0:
                            mask = Image.new("L", (int(bg_w), int(bg_h)), 0)
                            draw_mask = ImageDraw.Draw(mask)
                            draw_mask.rounded_rectangle((0, 0, int(bg_w), int(bg_h)), radius=radius, corners=corners, fill=255)
                            fill_img.putalpha(ImageChops.multiply(fill_img.split()[3], mask))
                        # Sombra de fondo de texto (rectangular redondeado)
                        if sombra:
                            blur, dx, dy, color_rgba = sombra
                            if mask is None:
                                shadow_mask = Image.new("L", (int(bg_w), int(bg_h)), 255)
                            else:
                                shadow_mask = mask.copy()
                            if blur > 0:
                                shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur))
                            base_alpha = 255
                            if isinstance(color_rgba, tuple) and len(color_rgba) == 4:
                                base_alpha = color_rgba[3]
                            if base_alpha < 255:
                                factor = max(0.0, min(1.0, base_alpha / 255.0))
                                shadow_mask = shadow_mask.point(lambda p: int(p * factor))
                            shadow_img = Image.new("RGBA", (int(bg_w), int(bg_h)), color_rgba)
                            shadow_img.putalpha(shadow_mask)
                            img.paste(shadow_img, (int(bg_x) + dx, int(bg_y) + dy), shadow_img)

                        img.paste(fill_img, (int(bg_x), int(bg_y)), fill_img)

                    # 4. Renderizar Texto
                    align = el.get("alineacion", "left").lower()
                    
                    # Definir ancla de dibujo coherente con _draw_text_advanced:
                    # - _draw_text_advanced interpreta pos.x como:
                    #     left-anchor si align=='left'
                    #     center-anchor si align=='center'
                    #     right-anchor si align=='right'
                    # Aquí convertimos la posición base (x,y) en la ancla correcta.
                    if "center" in parts[0]:
                        x = x + (obj_w / 2)
                    elif "right" in parts[0]:
                        x = x + obj_w
                    # Si es 'left' o numérico, x ya es ancla izquierda
                    
                    # Borde (Stroke)
                    stroke_width = s(int(el.get("borde_grosor", 0)))
                    stroke_fill = None
                    if stroke_width > 0:
                        stroke_fill = self._hex_to_rgb(el.get("borde_color", "#000000"))
                    
                    sombra = self._parse_shadow(el)
                    if sombra:
                        # Renderizado sobre imagen temporal para generar sombra de glifos
                        tw = max(1, int(max_text_w))
                        th = max(1, int(total_text_h))
                        txt_img = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
                        draw_txt = ImageDraw.Draw(txt_img)
                        # Nota: usamos align="left" dentro del buffer local; ya ajustamos X por alineación
                        self._draw_text_advanced(
                            draw_txt, (0, 0), temp_content, temp_font, color,
                            align="left",
                            line_spacing=line_spacing,
                            tracking=tracking,
                            stroke_width=stroke_width,
                            stroke_fill=stroke_fill
                        )
                        blur, dx, dy, color_rgba = sombra
                        alpha_txt = txt_img.split()[3]
                        shadow_mask = alpha_txt.copy()
                        if blur > 0:
                            shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur))
                        base_alpha = 255
                        if isinstance(color_rgba, tuple) and len(color_rgba) == 4:
                            base_alpha = color_rgba[3]
                        if base_alpha < 255:
                            factor = max(0.0, min(1.0, base_alpha / 255.0))
                            shadow_mask = shadow_mask.point(lambda p: int(p * factor))
                        shadow_rgba = Image.new("RGBA", (tw, th), color_rgba)
                        shadow_rgba.putalpha(shadow_mask)
                        img.paste(shadow_rgba, (int(x) + dx, int(y) + dy), shadow_rgba)
                        img.paste(txt_img, (int(x), int(y)), txt_img)
                    else:
                        self._draw_text_advanced(
                            draw, (x, y), temp_content, temp_font, color, 
                            align=align, # pasamos align para que _draw_text_advanced lo maneje
                            line_spacing=line_spacing,
                            tracking=tracking,
                            stroke_width=stroke_width,
                            stroke_fill=stroke_fill
                        )

                elif etype == "texto_dos_columnas":
                    self._render_two_column_text(el, draw, override_pos=pos)

                elif etype == "texto_varias_columnas":
                    self._render_multi_column_text(el, img, draw, override_pos=pos)

            except Exception as e:
                print(f"⚠️ Error renderizando elemento estático {el} (Tipo: {el.get('tipo')}): {e}")
                continue

        return ImageClip(np.array(img)).set_duration(duration)

    def process_block(self, elements: List[Dict], duration: float) -> List:
        """Procesa un bloque y devuelve una lista de clips (estáticos y dinámicos)."""
        static_elements = []
        dynamic_clips = []
        
        for el in elements:
            etype = el.get("tipo", "").lower()
            if etype == 'marquesina':
                mc = self._create_marquee_clip(el, duration)
                if mc: dynamic_clips.append(mc)
            elif etype == 'video':
                vc = self._create_video_overlay_clip(el, duration)
                if vc: dynamic_clips.append(vc)
            else:
                static_elements.append(el)
        
        # Renderizar estáticos juntos
        if static_elements:
            bg_clip = self._render_static_pil(static_elements, duration)
            if bg_clip:
                dynamic_clips.insert(0, bg_clip) # Poner estáticos al fondo del bloque
            
        return dynamic_clips

def process_dynamic_layers(layout_data: Dict[str, Any], duration: float, uploaded_fonts: Dict[str, str] = None, canvas_w=None, canvas_h=None) -> List:
    """
    Función principal que iterará sobre bloque_1, bloque_2, etc.
    """
    # Detectar dimensiones del JSON si vienen en el root (opcional)
    # layout_data podría traer "config": {"width": 1920, "height": 1080}
    # Pero aquí asumimos que ya se pasaron o se usan defaults.
    
    engine = RenderEngine(uploaded_fonts, canvas_w, canvas_h)
    all_clips = []
    
    block_keys = sorted([k for k in layout_data.keys() if k.startswith("bloque_")])
    
    for key in block_keys:
        raw_elements = layout_data[key]
        if not isinstance(raw_elements, list):
            continue

        meta = None
        elements = []
        for el in raw_elements:
            if isinstance(el, dict) and el.get("tipo") == "bloque_meta":
                meta = el
            else:
                elements.append(el)

        if not elements:
            continue
            
        print(f"🎨 Renderizando bloque: {key} ({len(elements)} elementos)")
        clips = engine.process_block(elements, duration)
        if not clips:
            continue

        inicio_val = None
        fin_val = None
        dur_val = None
        efecto_inicio = ""
        efecto_fin = ""

        if isinstance(meta, dict):
            inicio_val = meta.get("inicio")
            fin_val = meta.get("fin")
            dur_val = meta.get("duracion")
            efecto_inicio = str(meta.get("efecto_inicio") or "").strip().lower()
            efecto_fin = str(meta.get("efecto_fin") or "").strip().lower()

        has_inicio = inicio_val not in (None, "", "null")
        has_fin = fin_val not in (None, "", "null")
        has_duracion = dur_val not in (None, "", "null")

        block_start = 0.0
        block_end = duration

        if has_inicio or has_fin or has_duracion:
            if has_inicio and has_fin:
                try:
                    block_start = float(inicio_val)
                except:
                    block_start = 0.0
                try:
                    block_end = float(fin_val)
                except:
                    block_end = duration
                if block_end > duration:
                    block_end = duration
                if block_end <= block_start:
                    block_end = block_start
            elif has_duracion:
                block_start = 0.0
                try:
                    d = float(dur_val)
                except:
                    d = duration
                if d < 0:
                    d = 0.0
                if d > duration:
                    d = duration
                block_end = block_start + d
                if block_end > duration:
                    block_end = duration

        block_duration = max(0.0, block_end - block_start)
        if block_duration <= 0:
            continue

        # Sombra a nivel de bloque (alrededor del primer elemento) si meta contiene 'sombra'
        try:
            sombra_def = None
            if isinstance(meta, dict):
                sombra_def = meta.get("sombra")
            if sombra_def and elements:
                first = elements[0]
                # Dimensiones del primer elemento
                size_str = str(first.get("size", "0,0"))
                w, h = engine._parse_coords(size_str)
                if w > 0 and h > 0:
                    # Posición relativa al canvas (primer elemento)
                    pos_str = str(first.get("posicion", "0,0")).lower()
                    parts = [p.strip() for p in pos_str.split(",")]
                    if len(parts) == 1:
                        parts.append(parts[0])
                    # X
                    if "center" in parts[0]:
                        x = (engine.canvas_w - w) // 2
                    elif "right" in parts[0]:
                        x = engine.canvas_w - w
                    elif "left" in parts[0]:
                        x = 0
                    else:
                        x = engine._parse_value(parts[0], engine.canvas_w)
                    # Y
                    if "center" in parts[1]:
                        y = (engine.canvas_h - h) // 2
                    elif "bottom" in parts[1]:
                        y = engine.canvas_h - h
                    elif "top" in parts[1]:
                        y = 0
                    else:
                        y = engine._parse_value(parts[1], engine.canvas_h)
                    # Margen
                    x, y = engine._apply_margin((x, y), first)
                    # Radio
                    radius_raw = first.get("radius", 0)
                    radius, corners = engine._parse_radius(radius_raw)
                    # Parse sombra
                    blur, dx, dy, color_rgba = engine._parse_shadow({"sombra": sombra_def})
                    # Construir sombra
                    mask = Image.new("L", (int(w), int(h)), 0)
                    dmask = ImageDraw.Draw(mask)
                    if radius > 0:
                        dmask.rounded_rectangle((0, 0, int(w), int(h)), radius=radius, corners=corners, fill=255)
                    else:
                        dmask.rectangle((0, 0, int(w), int(h)), fill=255)
                    if blur > 0:
                        mask = mask.filter(ImageFilter.GaussianBlur(blur))
                    shadow_rgba = Image.new("RGBA", (int(w), int(h)), color_rgba)
                    shadow_rgba.putalpha(mask)
                    shadow_clip = ImageClip(np.array(shadow_rgba)).set_duration(block_duration).set_pos((int(x) + dx, int(y) + dy))
                    if clips:
                        clips.insert(0, shadow_clip)
                    else:
                        clips = [shadow_clip]
        except Exception as e:
            print(f"⚠️ Sombra de bloque error: {e}")

        fade_in = efecto_inicio == "fade"
        fade_out = efecto_fin == "fade"
        fx_duration = min(0.5, block_duration / 2.0)

        for clip in clips:
            c = clip
            try:
                if c.duration > block_duration:
                    c = c.subclip(0, block_duration)
                else:
                    c = c.set_duration(block_duration)
            except:
                c = c.set_duration(block_duration)

            if fade_in and fx_duration > 0:
                try:
                    c = vfx.fadein(c, fx_duration)
                except:
                    pass
            if fade_out and fx_duration > 0:
                try:
                    c = vfx.fadeout(c, fx_duration)
                except:
                    pass

            if block_start > 0:
                c = c.set_start(block_start)

            all_clips.extend([c])
            
    return all_clips
