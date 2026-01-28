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
from app.models.voice import Conversation, Message as MessageModel
from app.db.session import SessionLocal
from jose import jwt
from app.schemas.token import TokenPayload
from app.core.config import settings
from app.models.user import User

router = APIRouter()

VOICE = "en-US-AndrewNeural"


groq_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_key) if groq_key else None

async def transcribe_audio(audio_bytes: bytes, sample_rate: int) -> str:
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
    if not data:
        return data
    samples = np.frombuffer(data, dtype=np.int16).astype(np.float32)
    
    # Simple noise gate without boosting
    threshold = 500
    mask = np.abs(samples) < threshold
    samples[mask] *= 0.1
    
    samples = np.clip(samples, -32768, 32767).astype(np.int16)
    return samples.tobytes()

@router.get("/")
def get_voice_status(db: Session = Depends(deps.get_db)):
    return {"status": "ready", "engine": "edge-tts"}

@router.get("/history")
def get_history(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    history = db.query(Conversation).filter(Conversation.user_id == current_user.id).order_by(Conversation.created_at.desc()).all()
    return history

@router.get("/history/{conversation_id}")
def get_conversation_detail(
    conversation_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id).first()
    if not conversation:
        return {"error": "Conversation not found"}
    
    messages = db.query(MessageModel).filter(MessageModel.conversation_id == conversation_id).order_by(MessageModel.created_at.asc()).all()
    return {
        "id": conversation.id,
        "title": conversation.title,
        "messages": messages
    }

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Websocket connection accepted")
    
    speaking_task = None
    is_ai_speaking = False
    current_user = None
    current_conversation_id = None
    db_session = SessionLocal()

    async def speak_text(text: str):
        nonlocal is_ai_speaking, current_conversation_id
        print(f"Starting to speak: {text[:50]}...")
        try:
            is_ai_speaking = True
            
            communicate = edge_tts.Communicate(text, VOICE)
            first_chunk = True
            
            audio_acc = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    if first_chunk:
                        if websocket.client_state == WebSocketState.CONNECTED:
                            await websocket.send_json({"type": "status", "status": "speaking"})
                        first_chunk = False
                    
                    audio_acc.extend(chunk["data"])
                    
                    # Accumulate at least 16KB before sending to reduce choppiness
                    if len(audio_acc) >= 16384:
                        if websocket.client_state == WebSocketState.CONNECTED:
                            await websocket.send_bytes(bytes(audio_acc))
                        audio_acc.clear()
            
            # Send remaining audio
            if audio_acc and websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_bytes(bytes(audio_acc))
            
            # Save AI message to DB
            if current_conversation_id:
                msg = MessageModel(
                    conversation_id=current_conversation_id,
                    role="ai",
                    content=text
                )
                db_session.add(msg)
                db_session.commit()
                
            print(f"Finished speaking: {text[:30]}...")
        except Exception as e:
            print(f"Error in speak_text: {e}")
        finally:
            # Short delay to allow client buffer to play
            await asyncio.sleep(0.4)
            is_ai_speaking = False
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": "status", "status": "listening"})
            except Exception as e:
                print(f"Failed to update status: {e}")

    history = []
    
    try:
        greeting = "Welcome to Nebula AI. Your agentic assistant is ready. How can I help you today?"
        history.append({"role": "model", "parts": [greeting]})
        print("Creating greeting task")
        speaking_task = asyncio.create_task(speak_text(greeting))
    except Exception as e:
        print(f"Error during greeting: {e}")

    chunk_count = 0
    total_amplitude = 0
    silence_counter = 0
    is_actively_speaking = False
    
    # Point 1: VAD Hysteresis Constants
    TRIGGER_THRESHOLD = 1500
    HOLD_THRESHOLD = 800
    SILENCE_TIMEOUT = 160 # ~1.6s of silence allowed
    
    sample_rate = 48000
    audio_buffer = bytearray()
    
    try:
        while True:
            message = await websocket.receive()
            
            if "text" in message:
                try:
                    msg_data = json.loads(message["text"])
                    if msg_data.get("type") == "auth":
                        token = msg_data.get("token")
                        try:
                            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                            token_data = TokenPayload(**payload)
                            current_user = db_session.query(User).filter(User.id == token_data.sub).first()
                            if current_user:
                                print(f"User authenticated: {current_user.name}")
                                # Create a new conversation
                                conv = Conversation(
                                    user_id=current_user.id,
                                    title=f"Chat on {np.datetime64('now').astype(str)[:16]}"
                                )
                                db_session.add(conv)
                                db_session.commit()
                                db_session.refresh(conv)
                                current_conversation_id = conv.id
                                
                                # Save greeting
                                msg = MessageModel(
                                    conversation_id=current_conversation_id,
                                    role="ai",
                                    content=greeting
                                )
                                db_session.add(msg)
                                db_session.commit()
                        except Exception as e:
                            print(f"Auth failed: {e}")
                        continue

                    if msg_data.get("type") == "config":
                        sample_rate = msg_data.get("sampleRate", 48000)
                        print(f"Client sample rate set to: {sample_rate}")
                        continue
                    elif msg_data.get("type") == "context":
                        # Point 5: Dynamic Context Updates (CRITICAL)
                        # Inject as a system-like context message
                        history.append({"role": "user", "parts": [f"[SYSTEM CONTEXT UPDATE]: {msg_data['content']}"]})
                        print(f"Applied authoritative context update: {msg_data['content']}")
                        continue
                except Exception as e:
                    print(f"JSON error: {e}")
            
            if "bytes" in message:
                raw_data = message["bytes"]
            else:
                continue
            
            data = clean_audio(raw_data)
            
            if len(data) >= 2:
                fmt = f"<{len(data)//2}h"
                samples = struct.unpack(fmt, data)
                avg_amp = sum(abs(s) for s in samples) / len(samples)
                
                # Point 2: Ignore self-listening but allow barge-in
                if is_ai_speaking:
                    if avg_amp < 1800: # Higher bar to interrupt
                        continue 
                    else:
                        if speaking_task and not speaking_task.done():
                            speaking_task.cancel()
                            print("AI Interrupted by user speech")
                            await websocket.send_json({"type": "status", "status": "interrupted"})
                            is_ai_speaking = False
                            audio_buffer.clear()
                            is_actively_speaking = True
                
                # Point 1: Hysteresis-based VAD
                if not is_actively_speaking:
                    if avg_amp > TRIGGER_THRESHOLD:
                        print(f"User started speaking... (amp: {avg_amp:.2f})")
                        is_actively_speaking = True
                        silence_counter = 0
                        chunk_count = 1
                        audio_buffer.extend(data)
                else:
                    if avg_amp > HOLD_THRESHOLD:
                        silence_counter = 0
                        chunk_count += 1
                        audio_buffer.extend(data)
                    else:
                        silence_counter += 1
                        audio_buffer.extend(data)
                        if silence_counter % 20 == 0:
                            print(f"Silence wait ({silence_counter}/{SILENCE_TIMEOUT})")
                
                        if chunk_count > 4000: 
                             silence_counter = SILENCE_TIMEOUT + 1
                
                total_amplitude += avg_amp

            if is_actively_speaking and silence_counter >= SILENCE_TIMEOUT:
                is_actively_speaking = False
                silence_counter = 0
                
                avg_signal = total_amplitude / (max(1, chunk_count))
                current_buffer = bytes(audio_buffer)
                audio_buffer.clear()
                
                if chunk_count > 10:
                    print(f"Captured speech. Signal={avg_signal:.2f}, Chunks={chunk_count}")
                    
                    if speaking_task and not speaking_task.done():
                        speaking_task.cancel()

                    await websocket.send_json({"type": "status", "status": "thinking"})
                    
                    transcribed_text = await transcribe_audio(current_buffer, sample_rate)
                    print(f"Transcribed: '{transcribed_text}'")
                    
                    if transcribed_text and len(transcribed_text.strip()) > 1:
                        await websocket.send_json({"type": "user_text", "text": transcribed_text})
                        history.append({"role": "user", "parts": [transcribed_text]})
                        
                        # Clear frontend buffer for new turn
                        await websocket.send_json({"type": "clear_audio"})
                        
                        # Save user message to DB
                        if current_conversation_id:
                            msg = MessageModel(
                                conversation_id=current_conversation_id,
                                role="user",
                                content=transcribed_text
                            )
                            db_session.add(msg)
                            db_session.commit()

                        full_ai_response = []
                        try:
                            async for event in agent_service.process_query(transcribed_text, history=history):
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
                                    full_ai_response.append(event["content"])
                                    await websocket.send_json({"type": "ai_text", "text": event["content"]})
                                    speaking_task = asyncio.create_task(speak_text(event["content"]))
                                elif event["type"] == "error":
                                    print(f"Agent Error: {event['content']}")
                                    async for mock_event in agent_service._generate_mock_response(transcribed_text):
                                        if mock_event["type"] == "answer":
                                            full_ai_response.append(mock_event["content"])
                                            await websocket.send_json({"type": "ai_text", "text": mock_event["content"]})
                                            speaking_task = asyncio.create_task(speak_text(mock_event["content"]))
                            
                            if full_ai_response:
                                history.append({"role": "model", "parts": [" ".join(full_ai_response)]})
                                
                        except Exception as e:
                            print(f"Process Query error: {e}")
                    
                    await websocket.send_json({"type": "status", "status": "listening"})
                else:
                    print("Speech too short, ignoring.")
                
                # Reset counters for next capture
                chunk_count = 0
                total_amplitude = 0
                
    except WebSocketDisconnect:
        if speaking_task: speaking_task.cancel()
        print("Nebula disconnected")
    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        db_session.close()
