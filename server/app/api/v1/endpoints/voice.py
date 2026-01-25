import struct
import asyncio
import io
import edge_tts
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.api import deps

router = APIRouter()

VOICE = "en-US-AndrewNeural"

async def generate_welcome_audio(text: str) -> bytes:
    communicate = edge_tts.Communicate(text, VOICE)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data

def clean_audio(data: bytes) -> bytes:
    """
    Perform basic audio cleaning on raw PCM data.
    - Implementing a simple noise gate.
    """
    if not data:
        return data
        
    # Unpack Int16 PCM (little endian)
    # len(data)//2 because each sample is 2 bytes
    fmt = f"<{len(data)//2}h"
    try:
        samples = list(struct.unpack(fmt, data))
    except struct.error:
        return data # Fallback if data is malformed

    # Noise gate: zero out samples below a threshold
    threshold = 300 
    cleaned = [s if abs(s) > threshold else 0 for s in samples]
    
    # Pack back to bytes
    return struct.pack(fmt, *cleaned)

@router.get("/")
def get_voice_status(db: Session = Depends(deps.get_db)):
    return {"status": "ready", "engine": "edge-tts"}

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # 1. Initial Auto-Greeting
    try:
        await websocket.send_json({"type": "status", "status": "speaking"})
        
        # Generate actual greeting audio
        welcome_text = "Welcome to Nebula AI. Your voice-powered assistant is now ready."
        audio_bytes = await generate_welcome_audio(welcome_text)
        
        # Send audio in chunks to simulate streaming if needed, 
        # or just send the whole thing. Most clients expect chunks.
        chunk_size = 4096
        for i in range(0, len(audio_bytes), chunk_size):
            await websocket.send_bytes(audio_bytes[i:i + chunk_size])
            await asyncio.sleep(0.01) # Small delay to prevent overwhelming
        
        await websocket.send_json({"type": "status", "status": "listening"})
    except Exception as e:
        print(f"Error during greeting: {e}")
        return

    chunk_count = 0
    try:
        while True:
            # Receive raw PCM chunk from client
            data = await websocket.receive_bytes()
            
            # Clean the audio chunk
            cleaned_data = clean_audio(data)
            
            chunk_count += 1
            
            # Send status/metrics back
            await websocket.send_json({
                "type": "status",
                "metrics": {"vad": 5, "stt": 80}
            })

            # Simulate "turn-based" response logic (Simple Echo or Mock)
            if chunk_count == 12:
                await websocket.send_json({"type": "status", "status": "thinking"})
                await asyncio.sleep(0.8)
                
                await websocket.send_json({"type": "status", "status": "speaking"})
                
                # Mock response audio
                resp_text = "I heard you. How can I assist you further?"
                resp_audio = await generate_welcome_audio(resp_text)
                for i in range(0, len(resp_audio), chunk_size):
                    await websocket.send_bytes(resp_audio[i:i + chunk_size])
                    await asyncio.sleep(0.01)
                
                await websocket.send_json({"type": "status", "status": "listening"})
                chunk_count = 0 
                
    except WebSocketDisconnect:
        print("Nebula disconnected")
    except Exception as e:
        print(f"WS Error: {e}")
