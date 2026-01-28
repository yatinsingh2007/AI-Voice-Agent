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

    def search_web(self, query: str) -> str:
        if self.mock_mode:
            return f"Mock search results for: {query}. (Tavily bypassed in MOCK_MODE)"
            
        if not self.tavily:
            return "Search tool not configured. Please add TAVILY_API_KEY."
        
        try:
            response = self.tavily.search(query=query, search_depth="advanced")
            results = []
            for result in response.get('results', []):
                results.append(f"Title: {result['title']}\nURL: {result['url']}\nContent: {result['content']}\n")
            return "\n".join(results)
        except Exception as e:
            return f"Search failed: {str(e)}"

    async def _generate_mock_response(self, query: str) -> Generator[Dict[str, Any], None, None]:
        q_lower = query.lower()
        
        
        # 1. Weather Simulation
        if "weather" in q_lower or "temperature" in q_lower:
            city = "your location"
            words = query.split()
            if "in" in words:
                try:
                    city_idx = words.index("in") + 1
                    if city_idx < len(words):
                        city = words[city_idx].strip("?")
                except:
                    pass
            
            yield {"type": "status", "content": f"Simulating weather data for: {city}..."}
            await asyncio.sleep(1.0)
            yield {"type": "answer", "content": f"Simulated Report: In {city}, it is currently 72°F (22°C) and sunny. Expect clear skies all day."}
        
        # 2. News Simulation
        elif "news" in q_lower or "headlines" in q_lower:
            yield {"type": "status", "content": "Scanning latest simulated headlines..."}
            await asyncio.sleep(1.0)
            yield {"type": "answer", "content": "Top stories: AI adoption reaches all-time high, space agency announces new mission to Mars, and global markets show positive trends."}
            

        elif "joke" in q_lower:
            jokes = [
                "Why did the scarecrow win an award? Because he was outstanding in his field!",
                "I told my computer I needed a break, and now it won't stop sending me Kit-Kats.",
                "Why don't scientists trust atoms? Because they make up everything!"
            ]
            yield {"type": "answer", "content": random.choice(jokes)}
            

        elif "who are you" in q_lower or "your name" in q_lower:
             yield {"type": "answer", "content": "I am Nebula, your advanced AI voice assistant. Currently operating in Simulation Mode due to API limits."}
             
        elif "status" in q_lower or "system" in q_lower:
            yield {"type": "answer", "content": "System Status: Online. Operating Mode: Simulation (API Quota Exhausted)."}

        elif "time" in q_lower:
            from datetime import datetime
            now = datetime.now().strftime("%I:%M %p")
            yield {"type": "answer", "content": f"It is currently {now}."}
            
        elif "date" in q_lower or "day" in q_lower:
             from datetime import datetime
             today = datetime.now().strftime("%A, %B %d, %Y")
             yield {"type": "answer", "content": f"Today is {today}."}

        elif self.tavily and any(k in q_lower for k in ["who", "what", "where", "when", "tell me about", "search"]):
            try:
                yield {"type": "status", "content": f"Searching web for: {query}..."}
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, lambda: self.tavily.search(query=query, search_depth="basic"))
                
                results = response.get('results', [])
                if results:
                    top_result = results[0]
                    content = top_result.get('content', '')
                    cleaned_content = self.clean_text(content)
                    if len(cleaned_content) > 300:
                         cleaned_content = cleaned_content[:300]
                         last_dot = cleaned_content.rfind('.')
                         if last_dot != -1:
                             cleaned_content = cleaned_content[:last_dot+1]

                    yield {"type": "answer", "content": f"Here is what I found: {cleaned_content}"}
                    return
            except Exception as e:
                print(f"Tavily Fallback Error: {e}")
        
        else:
            yield {"type": "status", "content": "Processing (Simulation Mode)..."}
            await asyncio.sleep(0.5)
            yield {"type": "answer", "content": f"I heard: '{query}'. I am currently in Simulation Mode (API quota exceeded), so I cannot generate a real AI response, but I am listening!"}


    async def process_query(self, query: str, history: List[Dict] = []) -> Generator[Dict[str, Any], None, None]:
        if self.mock_mode:
             async for response in self._generate_mock_response(query):
                 yield response
             return

        if not self.gemini_key:
            yield {"type": "error", "content": "Gemini API key not configured."}
            return


        system_instructions = (
            "You are Nebula, an advanced Agentic AI voice assistant. "
            "You have a web search tool. USE IT SELECTIVELY. "
            "- If a user asks for 'current weather', 'latest news', or 'live data', use it. "
            "- For greetings, common knowledge (e.g., 'What is the capital of France?'), or general facts, DO NOT use search. Respond from memory. "
            "IF you decide to search, start your response with 'SEARCH: [query]'. Otherwise, just speak the answer. "
            "Be very concise in your voice responses."
        )

        try:
            chat = self.model.start_chat(history=history)
            
            response = await chat.send_message_async(f"{system_instructions}\n\nUser: {query}")
            
            if "SEARCH:" in response.text:
                search_query = response.text.split("SEARCH:")[1].strip().split("\n")[0]
                yield {"type": "status", "content": f"Searching for: {search_query}"}
                
                loop = asyncio.get_event_loop()
                search_results = await loop.run_in_executor(None, self.search_web, search_query)
                yield {"type": "search_results", "content": search_results}
                
                final_response = await chat.send_message_async(f"Search Results:\n{search_results}\n\nProvide the final answer.")
                answer_text = final_response.text
            else:
                answer_text = response.text

            import re
            sentences = re.split(r'(?<=[.!?]) +', answer_text)
            for sentence in sentences:
                if sentence.strip():
                    yield {"type": "answer", "content": sentence.strip()}
                
        except ResourceExhausted:
            print("Caught ResourceExhausted (429) in agent.py. Switching to Enhanced Simulation Mode.")
            yield {"type": "status", "content": "Usage Limit Reached - Switching to Simulation Mode"}
            async for response in self._generate_mock_response(query):
                yield response
        except Exception as e:
            error_str = str(e).lower()
            print(f"Error in process_query: {e}")

            if "429" in error_str or "quota" in error_str:
                print(f"API Quota Exceeded. Switching to Enhanced Simulation Mode.")
                yield {"type": "status", "content": "Usage Limit Reached - Switching to Simulation Mode"}
                async for response in self._generate_mock_response(query):
                    yield response
            else:
                yield {"type": "error", "content": f"Gemini Error: {str(e)}"}

agent_service = AgentService()
