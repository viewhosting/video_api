import os
import requests
import tempfile
import subprocess
import shutil
from fastapi import HTTPException

def download_file(url: str, suffix: str = "") -> str:
    """Descarga un archivo desde una URL y devuelve la ruta temporal."""
    print(f"⬇️ Descargando archivo desde: {url}")
    
    # 1. Verificar URL
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="URL inválida")

    # Crear archivo temporal vacío para reservar el path
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name

    try:
        # 2. Intentar con requests (Python nativo)
        response = requests.get(url, allow_redirects=True, stream=True, timeout=30)
        response.raise_for_status()
        
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return temp_path

    except Exception as e:
        print(f"⚠️ Requests falló: {e}. Intentando fallback con curl...")
        
        # 3. Fallback con CURL (Sistema)
        # Esto soluciona problemas de SSL/Socket en entornos restrictivos o con versiones nuevas de Python
        curl_path = shutil.which("curl")
        
        if curl_path:
            try:
                # -L: Seguir redirecciones
                # -s: Silent (menos ruido)
                # -S: Show error (si falla)
                # -o: Output file
                # --fail: Fallar si HTTP code >= 400
                cmd = [curl_path, "-L", "-s", "-S", "--fail", "-o", temp_path, url]
                
                result = subprocess.run(cmd, check=True, capture_output=True)
                
                # Verificar que se descargó algo
                if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                    print(f"✅ Descarga exitosa con CURL: {temp_path}")
                    return temp_path
                else:
                    raise Exception("El archivo descargado está vacío")
                    
            except subprocess.CalledProcessError as cpe:
                err_msg = cpe.stderr.decode().strip() if cpe.stderr else f"Exit code {cpe.returncode}"
                print(f"❌ Curl falló: {err_msg}")
                # Eliminamos el archivo vacio/corrupto si falló
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise HTTPException(status_code=400, detail=f"Error descargando archivo (curl): {err_msg}")
            except Exception as ex:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise HTTPException(status_code=400, detail=f"Error descargando archivo (fallback): {str(ex)}")
        else:
            # Si no hay curl, fallamos con el error original de requests
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"Error descargando archivo remoto: {str(e)}")
