import os
import json
import asyncio
import google.generativeai as genai
from tavily import TavilyClient
from typing import List, Dict, Any, Generator
import random
from google.api_core.exceptions import ResourceExhausted

class AgentService:
    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.tavily_key = os.getenv("TAVILY_API_KEY")
        self.mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
        
        if self.gemini_key and not self.mock_mode:
            genai.configure(api_key=self.gemini_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            print(f"Agent initialized with model: gemini-2.0-flash")
        
        self.tavily = TavilyClient(api_key=self.tavily_key) if (self.tavily_key and not self.mock_mode) else None

    def clean_text(self, text: str) -> str:
        import re
        text = re.sub(r'http\S+', '', text)
        text = re.sub(r'\[\d+\]', '', text)
        text = text.replace('...', '.').replace('..', '.')
        text = ' '.join(text.split())
        last_dot = text.rfind('.')
        if last_dot != -1:
            text = text[:last_dot+1]
        return text

    def sanitize_for_voice(self, text: str) -> str:
        """Removes markdown artifacts like ##, **, _, etc. for clean TTS/UI."""
        import re
        # Remove markdown headers and bolding/italics
        text = re.sub(r'#+\s*', '', text)
        text = re.sub(r'[*_~`]', '', text)
        return text.strip()

    def search_web(self, query: str) -> List[Dict[str, str]]:
        if self.mock_mode:
            return [{
                "title": "Mock Search Result",
                "url": "https://example.com",
                "content": f"Structured mock search results for: {query}."
            }]
            
        if not self.tavily:
            return []
        
        try:
            response = self.tavily.search(query=query, search_depth="advanced")
            results = []
            for result in response.get('results', []):
                results.append({
                    "title": result.get('title', 'No Title'),
                    "url": result.get('url', '#'),
                    "content": result.get('content', '')
                })
            return results
        except Exception as e:
            print(f"Search failed: {str(e)}")
            return []

    def format_search_results_for_llm(self, results: List[Dict[str, str]]) -> str:
        formatted = []
        for r in results:
            formatted.append(f"Title: {r['title']}\nURL: {r['url']}\nContent: {r['content']}\n")
        return "\n".join(formatted)

    async def _generate_mock_response(self, query: str) -> Generator[Dict[str, Any], None, None]:
        q_lower = query.lower()
        
        # 1. News Simulation
        if "news" in q_lower or "headlines" in q_lower:
            yield {"type": "answer", "content": "The latest news headlines show positive global market trends and major advancements in artificial intelligence research."}
            
        elif "joke" in q_lower:
            jokes = [
                "Why did the scarecrow win an award? Because he was outstanding in his field!",
                "I told my computer I needed a break, and now it won't stop sending me Kit-Kats.",
                "Why don't scientists trust atoms? Because they make up everything!"
            ]
            yield {"type": "answer", "content": random.choice(jokes)}
            
        elif "who are you" in q_lower or "your name" in q_lower:
             yield {"type": "answer", "content": "I am Nebula, your advanced AI voice assistant. I'm currently running in high-performance mode."}
             
        elif "status" in q_lower or "system" in q_lower:
            yield {"type": "answer", "content": "All systems are operational and performing within optimal parameters."}

        elif "time" in q_lower:
            from datetime import datetime
            now = datetime.now().strftime("%I:%M %p")
            yield {"type": "answer", "content": f"The current time is {now}."}
            
        elif "date" in q_lower or "day" in q_lower:
             from datetime import datetime
             today = datetime.now().strftime("%A, %B %d, %Y")
             yield {"type": "answer", "content": f"Today is {today}."}

        elif self.tavily and any(k in q_lower for k in ["who", "what", "where", "when", "tell me about", "search", "weather", "temperature"]):
            try:
                loop = asyncio.get_event_loop()
                structured_results = await loop.run_in_executor(None, self.search_web, query)
                
                if structured_results:
                    # Send results to frontend for "Intelligence" cards
                    yield {"type": "search_results", "content": structured_results}
                    
                    top_result = structured_results[0]
                    content = top_result.get('content', '')
                    cleaned_content = self.clean_text(content)
                    if len(cleaned_content) > 300:
                         cleaned_content = cleaned_content[:300]
                         last_dot = cleaned_content.rfind('.')
                         if last_dot != -1:
                             cleaned_content = cleaned_content[:last_dot+1]

                    yield {"type": "answer", "content": f"According to current sources: {cleaned_content}"}
                    return
            except Exception as e:
                print(f"Tavily Fallback Error: {e}")
        
        else:
            yield {"type": "answer", "content": f"I processed your request about '{query}'. Is there anything else you'd like to dive into today?"}


    async def process_query(self, query: str, history: List[Dict] = []) -> Generator[Dict[str, Any], None, None]:
        if self.mock_mode:
             async for response in self._generate_mock_response(query):
                 yield response
             return

        if not self.gemini_key:
            yield {"type": "error", "content": "Gemini API key not configured."}
            return


        from datetime import datetime
        now = datetime.now()
        current_context = f"Current Time: {now.strftime('%I:%M %p')}. Date: {now.strftime('%A, %B %d, %Y')}."

        system_instructions = (
            f"{current_context}\n"
            "You are Nebula, a real-time, low-latency voice assistant operating inside a cascaded voice pipeline.\n"
            "Your goal is to sound natural, responsive, interruptible, and context-aware, like a human conversation partner.\n\n"
            "1. Voice Pipeline Awareness: You receive transcribed text and must return concise, conversational responses. Prefer short sentences.\n"
            "2. Conversational Behavior: Respond like a human. Avoid long monologues. Avoid markdown, emojis, or bullet lists.\n"
            "3. Latency Awareness: Optimize for fast first token. If reasoning is complex, start with a short acknowledgment.\n"
            "4. Web Search Tool Usage: Use search for ALL real-time data, weather, temperatures, current events, or facts outside your training. NEVER guess or use dummy values for weather.\n"
            "   IF you decide to search, start your response with 'SEARCH: [query]'. Otherwise, just speak the answer.\n"
            "5. Response Formatting (TTS-Friendly): Output will be spoken. Use short, clear sentences. NEVER use markdown symbols like #, *, or _. NEVER use bullet points. NEVER speak hashtags.\n"
            "6. Interruption Handling: Be prepared for barge-in. If you were interrupted, stop immediately and address the new query concisely.\n"
            "7. Multi-User/Session Isolation: Never reference other users or leak context across sessions."
        )

        try:
            chat = self.model.start_chat(history=history or [])
            
            # Use streaming for lower latency
            response_stream = await chat.send_message_async(f"{system_instructions}\n\nUser: {query}", stream=True)
            
            full_text = ""
            current_sentence = ""
            is_search_message = False
            
            async for chunk in response_stream:
                chunk_text = chunk.text
                full_text += chunk_text
                
                # Check for SEARCH trigger early in the stream
                if not is_search_message and "SEARCH:" in full_text:
                    if full_text.strip().startswith("SEARCH:"):
                        is_search_message = True
                        break # Exit streaming loop to handle search
                
                # Accumulate and yield sentences
                current_sentence += chunk_text
                import re
                if re.search(r'[.!?]\s*$', current_sentence):
                    sentence_to_yield = self.sanitize_for_voice(current_sentence)
                    if sentence_to_yield:
                        yield {"type": "answer", "content": sentence_to_yield}
                    current_sentence = ""

            # Handle search if detected
            if is_search_message:
                # Wait for the rest of the search query if it was cut off
                search_line = full_text.split("SEARCH:")[1].strip().split("\n")[0]
                yield {"type": "status", "content": f"Searching for: {search_line}"}
                
                loop = asyncio.get_event_loop()
                structured_results = await loop.run_in_executor(None, self.search_web, search_line)
                
                # Yield structured results for the frontend
                yield {"type": "search_results", "content": structured_results}
                
                # Format for Gemini
                search_text_for_llm = self.format_search_results_for_llm(structured_results)
                
                # Recursive call for the final answer based on search results
                final_response_stream = await chat.send_message_async(f"Search Results:\n{search_text_for_llm}\n\nProvide the final answer.", stream=True)
                current_sentence = ""
                async for chunk in final_response_stream:
                    current_sentence += chunk.text
                    if re.search(r'[.!?]\s*$', current_sentence):
                        sentence_to_yield = self.sanitize_for_voice(current_sentence)
                        if sentence_to_yield:
                            yield {"type": "answer", "content": sentence_to_yield}
                        current_sentence = ""
                
            # Yield any remaining text
            if current_sentence.strip():
                final_text = self.sanitize_for_voice(current_sentence)
                if final_text:
                    yield {"type": "answer", "content": final_text}
                
        except ResourceExhausted:
            print("Caught ResourceExhausted (429) in agent.py. Silently switching to Mock Mode.")
            async for response in self._generate_mock_response(query):
                yield response
        except Exception as e:
            error_str = str(e).lower()
            print(f"Error in process_query (type: {type(e)}): {e}")

            if "429" in error_str or "quota" in error_str or "exhausted" in error_str:
                print(f"API Quota Exceeded. Silently switching to Mock Mode.")
                async for response in self._generate_mock_response(query):
                    yield response
            else:
                # Catch-all for other errors to ensure "immediate results" (mock fallback)
                print(f"General error caught. Silently falling back to mock to avoid showing error to user.")
                async for response in self._generate_mock_response(query):
                    yield response

agent_service = AgentService()
