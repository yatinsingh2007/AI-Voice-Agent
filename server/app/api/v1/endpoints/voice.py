import struct
import asyncio
import io
import json
import os
import random
import wave
import edge_tts
import numpy as np
from groq import Groq
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from starlette.websockets import WebSocketState
from sqlalchemy.orm import Session
from app.api import deps
from app.services.agent import agent_service

router = APIRouter()

VOICE = "en-US-AndrewNeural"


groq_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_key) if groq_key else None

async def transcribe_audio(audio_bytes: bytes, sample_rate: int) -> str:
    """Transcribe PCM bytes using Groq Whisper API (Scalable & Fast)."""
    if not os.getenv("GROQ_API_KEY"):
        print("GROQ_API_KEY not found. Falling back to empty transcription.")
        return ""
    try:
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_bytes)
            
            wav_io.seek(0)
            
            loop = asyncio.get_event_loop()
            transcription = await loop.run_in_executor(
                None, 
                lambda: groq_client.audio.transcriptions.create(
                    file=("audio.wav", wav_io.read()),
                    model="whisper-large-v3-turbo",
                    response_format="text"
                )
            )
            return transcription.strip()
    except Exception as e:
        print(f"Groq Transcription Error: {e}")
        return ""

async def generate_welcome_audio(text: str) -> bytes:
    communicate = edge_tts.Communicate(text, VOICE, rate="-10%")
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data

def clean_audio(data: bytes) -> bytes:
    """
    Perform robust audio cleaning:
    - Normalization: Scale audio to consistent peaks.
    - Noise Gate: Use a soft threshold to remove floor noise.
    """
    if not data:
        return data
    samples = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    max_val = np.abs(samples).max()
    if max_val > 0:
        target_peak = 23168.0
        samples = samples * (target_peak / max_val)
    
    threshold = 1500
    mask = np.abs(samples) < threshold
    samples[mask] *= 0.1
    
    samples = np.clip(samples, -32768, 32767).astype(np.int16)
    
    return samples.tobytes()

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
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json({"type": "status", "status": "speaking"})
            
            communicate = edge_tts.Communicate(text, VOICE)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_bytes(chunk["data"])
                    else:
                        print("WebSocket disconnected during audio stream")
                        break
        except Exception as e:
            print(f"Error in speak_text: {e}")
        finally:
            is_ai_speaking = False
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": "status", "status": "listening"})
                    print("Finished speaking, set status to listening")
            except Exception as e:
                print(f"Failed to update status: {e}")

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
    
    sample_rate = 48000
    audio_buffer = bytearray()
    
    try:
        while True:
            message = await websocket.receive()
            
            if "text" in message:
                try:
                    config = json.loads(message["text"])
                    if config.get("type") == "config":
                        sample_rate = config.get("sampleRate", 48000)
                        print(f"Client sample rate set to: {sample_rate}")
                        continue
                except:
                    pass
            
            if "bytes" in message:
                raw_data = message["bytes"]
            else:
                continue
            
            data = clean_audio(raw_data)
            
            if len(data) >= 2:
                fmt = f"<{len(data)//2}h"
                samples = struct.unpack(fmt, data)
                avg_amp = sum(abs(s) for s in samples) / len(samples)
                
                if is_ai_speaking and avg_amp > 1000:
                    if speaking_task and not speaking_task.done():
                        speaking_task.cancel()
                        print("AI Interrupted by user speech")
                        await websocket.send_json({"type": "status", "status": "interrupted"})
                        is_ai_speaking = False
                        audio_buffer.clear()
                        is_actively_speaking = True
                
                if avg_amp > 1500:
                    if not is_actively_speaking:
                        print("User started speaking...")
                    is_actively_speaking = True
                    silence_counter = 0
                    chunk_count += 1
                    audio_buffer.extend(data)
                else:
                    if is_actively_speaking:
                        silence_counter += 1
                        audio_buffer.extend(data)
                        
                        if chunk_count > 6000: 
                             silence_counter = 41 
                
                total_amplitude += avg_amp

            current_time = asyncio.get_event_loop().time()
            if is_actively_speaking and silence_counter >= 35:
                avg_signal = total_amplitude / (max(1, chunk_count))
                
                if chunk_count > 10:
                    print(f"Captured speech. Signal={avg_signal:.2f}, Chunks={chunk_count}")
                    
                    if speaking_task and not speaking_task.done():
                        speaking_task.cancel()

                    await websocket.send_json({"type": "status", "status": "thinking"})
                    
                    transcribed_text = await transcribe_audio(bytes(audio_buffer), sample_rate)
                    print(f"User: '{transcribed_text}'")
                    
                    if transcribed_text and len(transcribed_text.strip()) > 1:
                        try:
                            async for event in agent_service.process_query(transcribed_text):
                                if event["type"] == "status":
                                    await websocket.send_json({
                                        "type": "status", 
                                        "status": "searching", 
                                        "detail": event["content"]
                                    })
                                elif event["type"] == "search_results":
                                    await websocket.send_json({
                                        "type": "search", 
                                        "results": event["content"]
                                    })
                                elif event["type"] == "answer":
                                    speaking_task = asyncio.create_task(speak_text(event["content"]))
                                elif event["type"] == "error":
                                    print(f"Agent Error: {event['content']}")
                                    async for mock_event in agent_service._generate_mock_response(transcribed_text):
                                        if mock_event["type"] == "answer":
                                            speaking_task = asyncio.create_task(speak_text(mock_event["content"]))
                        except Exception as e:
                            print(f"Process Query error: {e}")
                    else:
                        await websocket.send_json({"type": "status", "status": "listening"})
                
                is_actively_speaking = False
                silence_counter = 0
                chunk_count = 0 
                total_amplitude = 0
                audio_buffer.clear()
                
    except WebSocketDisconnect:
        if speaking_task: speaking_task.cancel()
        print("Nebula disconnected")
    except Exception as e:
        print(f"WS Error: {e}")
