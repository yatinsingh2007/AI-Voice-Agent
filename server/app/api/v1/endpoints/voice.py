from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.api import deps

router = APIRouter()

@router.get("/")
def get_voice_status(db: Session = Depends(deps.get_db)):
    return {"status": "ready", "engine": "modular_cascade"}

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    chunk_count = 0
    try:
        while True:
            data = await websocket.receive_bytes()
            chunk_count += 1
            
            # Simulated cascading logic:
            # Every 10 chunks, simulate a partial transcript
            if chunk_count % 10 == 0:
                await websocket.send_json({
                    "type": "transcript",
                    "content": "... processing voice chunk ...",
                    "is_final": False
                })
            
            # Send heartbeat/ack
            await websocket.send_json({
                "type": "status",
                "received": True,
                "byte_len": len(data),
                "metrics": {
                    "vad": 15,
                    "stt": 80
                }
            })
    except WebSocketDisconnect:
        print("Voice client disconnected")
