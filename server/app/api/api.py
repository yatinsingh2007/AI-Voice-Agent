from fastapi import APIRouter
from app.api.endpoints import voice

api_router = APIRouter()
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
