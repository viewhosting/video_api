from pydantic import BaseModel
from typing import Dict

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
