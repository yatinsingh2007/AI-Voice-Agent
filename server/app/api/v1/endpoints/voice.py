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
            # Receive audio chunk from client
            data = await websocket.receive_bytes()
            chunk_count += 1
            
            # Send status/metrics back
            await websocket.send_json({
                "type": "status",
                "metrics": {"vad": 10, "stt": 50}
            })

            # Simulate "turn-based" voice response
            # In a real app, STT would trigger LLM which would trigger TTS.
            # Here we simulate: after 20 chunks (~5 seconds of audio at 250ms chunks),
            # the AI starts "speaking".
            if chunk_count == 20:
                await websocket.send_json({"type": "status", "status": "thinking"})
                import asyncio
                await asyncio.sleep(0.5) # Simulate LLM latency
                
                await websocket.send_json({"type": "status", "status": "speaking"})
                
                # Stream mock audio data (sin wave or dummy chunks)
                # In production, this would be real TTS binary data (e.g., PCM or MP3)
                for _ in range(10):
                    # Sending 10 small dummy audio chunks
                    await websocket.send_bytes(b'\x00' * 1024) 
                    await asyncio.sleep(0.1)
                
                await websocket.send_json({"type": "status", "status": "listening"})
                chunk_count = 0 # Reset turn
                
    except WebSocketDisconnect:
        print("Voice client disconnected")
