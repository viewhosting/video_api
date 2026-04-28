# --- 1. CONFIGURACIÓN DE ENTORNO (Debe ir primero) ---
import env_setup

import os
import sys
import time
import json
import shutil
import tempfile
import traceback
import io
from fastapi import FastAPI, HTTPException, Request, Depends, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List

# --- MÓDULOS DEL PROYECTO ---
from security import verify_api_key
from models import VideoRequest, LayoutData
import processor
from config import RENDER_MODE

app = FastAPI()

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(file_paths: List[str]):
    """Función para limpiar archivos temporales después de enviar la respuesta."""
    for path in file_paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
                print(f"🧹 Archivo eliminado: {path}")
            except Exception as e:
                print(f"⚠️ Error eliminando {path}: {e}")

@app.post("/render", dependencies=[Depends(verify_api_key)])
async def render_broadcast(request: Request, background_tasks: BackgroundTasks):
    start_time = time.time()
    log_capture_string = io.StringIO()
    
    # Listas para limpieza
    temp_files_to_clean = []
    output_path = None
    
    # Capturar logs estándar y error (opcional, simplificado aquí)
    # En producción real, usar logging configurado es mejor.
    
    try:
        # --- FASE 1: EXTRACCIÓN DE PARÁMETROS ---
        content_type = request.headers.get("content-type", "")
        
        params = {}
        uploaded_files = {}
        
        if "application/json" in content_type:
            # MODO: JSON PURO
            try:
                params = await request.json()
                print("📡 Recibido request application/json")
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid JSON body")
        
        elif "multipart/form-data" in content_type:
            # MODO: MULTIPART
            print("📦 Recibido request multipart/form-data")
            form = await request.form()
            
            # Extraer archivos
            video = form.get("video")
            logo = form.get("logo")
            audio = form.get("audio")
            
            # Procesar archivos subidos
            if isinstance(video, UploadFile):
                ext = os.path.splitext(video.filename)[1] or ".mp4"
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    shutil.copyfileobj(video.file, tmp)
                    uploaded_files["video"] = tmp.name
                    temp_files_to_clean.append(tmp.name)
            
            if isinstance(logo, UploadFile):
                ext = os.path.splitext(logo.filename)[1] or ".png"
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    shutil.copyfileobj(logo.file, tmp)
                    uploaded_files["logo"] = tmp.name
                    temp_files_to_clean.append(tmp.name)
            
            if isinstance(audio, UploadFile):
                ext = os.path.splitext(audio.filename)[1] or ".mp3"
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    shutil.copyfileobj(audio.file, tmp)
                    uploaded_files["audio"] = tmp.name
                    temp_files_to_clean.append(tmp.name)

            # Fuentes (lista)
            fuentes_raw = form.getlist("fuentes")
            uploaded_fonts = {}
            if fuentes_raw:
                for font_file in fuentes_raw:
                    if isinstance(font_file, UploadFile):
                        ext = os.path.splitext(font_file.filename)[1] or ".ttf"
                        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                            shutil.copyfileobj(font_file.file, tmp)
                            f_name = os.path.splitext(font_file.filename)[0]
                            uploaded_fonts[f_name] = tmp.name
                            temp_files_to_clean.append(tmp.name)
            uploaded_files["fonts"] = uploaded_fonts

            # JSON payload
            json_str = form.get("json")
            if not json_str:
                raise HTTPException(status_code=400, detail="Missing 'json' field in form data")
            try:
                params = json.loads(json_str)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in 'json' form field")
        
        else:
            raise HTTPException(status_code=400, detail=f"Content-Type not supported: {content_type}")

        # --- FASE 2: PREPARACIÓN DE RECURSOS ---
        layout_dict = params.get("layout", params)
        
        # Resolver assets (descargas + uploads)
        # Esto puede generar archivos temporales adicionales (descargas)
        # processor.resolve_assets devuelve paths. Si son descargas, debemos rastrearlas para limpieza?
        # processor.resolve_assets usa download_file de utils.py que crea tempfiles.
        # NO los estamos rastreando aquí explícitamente si processor no nos dice cuáles creó.
        # Pero processor devuelve un dict con los paths finales. Podemos agregar esos paths a la lista de limpieza.
        
        assets = processor.resolve_assets(params, layout_dict, uploaded_files)
        
        # Agregar assets resueltos a la limpieza (si no estaban ya)
        if assets["video"] and assets["video"] not in temp_files_to_clean:
            temp_files_to_clean.append(assets["video"])
        if assets["logo"] and assets["logo"] not in temp_files_to_clean:
            temp_files_to_clean.append(assets["logo"])
        if assets["audio"] and assets["audio"] not in temp_files_to_clean:
            temp_files_to_clean.append(assets["audio"])
        for f_path in assets["fonts"].values():
            if f_path and f_path not in temp_files_to_clean:
                temp_files_to_clean.append(f_path)

        # --- FASE 3: RENDERIZADO ---
        output_name_req = params.get("nombre", "output.mp4")
        output_path = processor.render_video(assets, params, layout_dict, output_name_req)
        
        # Programar limpieza del output también
        # (Ojo: Si el usuario quiere conservarlo, no deberíamos borrarlo. 
        # Pero como es una API que devuelve el archivo, se asume que una vez descargado ya no se necesita en servidor)
        temp_files_to_clean.append(output_path)

        elapsed_time = time.time() - start_time
        
        # Headers de respuesta
        headers = {
            "X-Render-Time": str(round(elapsed_time, 2)),
            "X-Render-Mode": RENDER_MODE,
            "X-Render-Status": "success"
        }
        
        # Programar limpieza en background
        background_tasks.add_task(cleanup_files, temp_files_to_clean)

        return FileResponse(
            path=output_path, 
            filename=os.path.basename(output_name_req), 
            media_type="video/mp4",
            headers=headers
        )

    except Exception as e:
        traceback.print_exc()
        elapsed_time = time.time() - start_time
        # Limpiar en caso de error inmediato
        cleanup_files(temp_files_to_clean)
        
        raise HTTPException(status_code=500, detail={"error": str(e), "time": round(elapsed_time, 2)})


# Servir archivos estáticos (Editor)
# Esto debe ir al final para no bloquear otras rutas
app.mount("/", StaticFiles(directory=".", html=True), name="static")
