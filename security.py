import os
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

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
