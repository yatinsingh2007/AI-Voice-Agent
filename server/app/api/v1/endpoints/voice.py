import struct
import asyncio
import io
import random
import edge_tts
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.services.agent import agent_service

router = APIRouter()

VOICE = "en-US-AndrewNeural"

async def generate_welcome_audio(text: str) -> bytes:
    communicate = edge_tts.Communicate(text, VOICE, rate="-10%")
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
    threshold = 800 # Increased from 300 to better handle background noise
    cleaned = [s if abs(s) > threshold else 0 for s in samples]
    
    # Pack back to bytes
    return struct.pack(fmt, *cleaned)

@router.get("/")
def get_voice_status(db: Session = Depends(deps.get_db)):
    return {"status": "ready", "engine": "edge-tts"}

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Websocket connection accepted")
    
    speaking_task = None
    is_ai_speaking = False

    async def speak_text(text: str):
        nonlocal is_ai_speaking
        is_ai_speaking = True
        print(f"Starting to speak: {text[:50]}...")
        try:
            await websocket.send_json({"type": "status", "status": "speaking"})
            communicate = edge_tts.Communicate(text, VOICE)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    await websocket.send_bytes(chunk["data"])
        except Exception as e:
            print(f"Error in speak_text: {e}")
        finally:
            is_ai_speaking = False
            await websocket.send_json({"type": "status", "status": "listening"})
            print("Finished speaking, set status to listening")

    # 1. Initial Auto-Greeting
    try:
        greeting = "Welcome to Nebula AI. Your agentic assistant is ready. How can I help you today?"
        print("Creating greeting task")
        speaking_task = asyncio.create_task(speak_text(greeting))
    except Exception as e:
        print(f"Error during greeting: {e}")

    chunk_count = 0
    total_amplitude = 0
    silence_counter = 0
    is_actively_speaking = False
    last_trigger_time = 0
    
    try:
        while True:
            raw_data = await websocket.receive_bytes()
            
            # 2. Audio Cleaning (Noise Gate)
            data = clean_audio(raw_data)
            
            # Simple VAD / Interruption
            if len(data) >= 2:
                fmt = f"<{len(data)//2}h"
                samples = struct.unpack(fmt, data)
                # Calculate amplitude on cleaned data
                avg_amp = sum(abs(s) for s in samples) / len(samples)
                
                # If AI is speaking and user speaks loudly, interrupt
                if is_ai_speaking and avg_amp > 1000:
                    if speaking_task and not speaking_task.done():
                        speaking_task.cancel()
                        await websocket.send_json({"type": "status", "status": "interrupted"})
                        is_ai_speaking = False
                
                # Signal tracking for end-of-speech detection
                if avg_amp > 600: # Lowered from 1200 to 600 to match normal speech volume
                    is_actively_speaking = True
                    silence_counter = 0
                    chunk_count += 1
                else:
                    if is_actively_speaking:
                        silence_counter += 1
                
                total_amplitude += avg_amp
                
                # Debug log every 50 chunks to verify mic input level
                if chunk_count % 50 == 1:
                    print(f"Mic Level: {avg_amp:.2f}")

            # ~6 chunks is approx 1.5s - balanced response
            # Safety Trigger: Force trigger if user has been speaking for > 15 seconds
            current_time = asyncio.get_event_loop().time()
            cooldown_period = 5.0 # Reduced from 10s to 5s for better UX
            
            if is_actively_speaking and not is_ai_speaking:
                # Only trigger if we are past the cooldown
                if current_time - last_trigger_time > cooldown_period:
                    should_trigger = (silence_counter >= 6) or (chunk_count >= 60)
                    
                    if should_trigger:
                        # Ensure we actually have meaningful audio data (not just a short pop)
                        avg_signal = total_amplitude / (max(1, chunk_count))
                        if avg_signal > 1500 or chunk_count > 10:
                            print(f"Triggering Agent. Signal={avg_signal:.2f}, Duration={chunk_count}")
                            last_trigger_time = current_time
                            
                            if speaking_task and not speaking_task.done():
                                speaking_task.cancel()

                            await websocket.send_json({"type": "status", "status": "thinking"})
                            
                            # More natural mock queries (AgentService will now decide if search is needed)
                            if avg_signal > 2000:
                                options = [
                                    "What is the capital of France and what is the weather there right now?",
                                    "Search for the latest technology news headlines.",
                                    "Who acts as Iron Man in the Marvel movies?",
                                    "What is the current stock price of Google?"
                                ]
                                mock_query = random.choice(options)
                            else:
                                options = [
                                    "Hello Nebula! Tell me a fun fact about space.",
                                    "Tell me a short joke.",
                                    "How are you doing today?",
                                    "What is the meaning of life?"
                                ]
                                mock_query = random.choice(options)
                            
                            try:
                                async for event in agent_service.process_query(mock_query):
                                    if event["type"] == "status":
                                        await websocket.send_json({"type": "status", "status": "searching", "detail": event["content"]})
                                    elif event["type"] == "search_results":
                                        await websocket.send_json({"type": "search", "results": event["content"]})
                                    elif event["type"] == "answer":
                                        speaking_task = asyncio.create_task(speak_text(event["content"]))
                                    elif event["type"] == "error":
                                        await websocket.send_json({"type": "error", "message": event["content"]})
                            except Exception as e:
                                print(f"Process query failed: {e}")
                                await websocket.send_json({"type": "error", "message": str(e)})
                        
                        # Reset counters (Always reset on trigger attempt)
                        is_actively_speaking = False
                        silence_counter = 0
                        chunk_count = 0 
                        total_amplitude = 0
                else:
                    # In cooldown, just reset counters if silence is detected to prevent immediate trigger after cooldown
                    if silence_counter >= 6:
                        is_actively_speaking = False
                        silence_counter = 0
                        chunk_count = 0
                        total_amplitude = 0
                
    except WebSocketDisconnect:
        if speaking_task: speaking_task.cancel()
        print("Nebula disconnected")
    except Exception as e:
        print(f"WS Error: {e}")
