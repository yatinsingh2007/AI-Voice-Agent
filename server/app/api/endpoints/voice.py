from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

router = APIRouter()

@router.get("/")
def get_voice_status():
    return {"status": "ready", "engine": "modular_cascade"}

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            # In the future, this is where audio processing starts:
            # [Noise Suppression] -> [VAD] -> [STT]
            await websocket.send_json({"status": "received", "byte_len": len(data)})
    except WebSocketDisconnect:
        print("Client disconnected")
