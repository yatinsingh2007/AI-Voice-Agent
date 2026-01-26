import os
import json
import asyncio
import google.generativeai as genai
from tavily import TavilyClient
from typing import List, Dict, Any, Generator

class AgentService:
    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.tavily_key = os.getenv("TAVILY_API_KEY")
        self.mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
        
        if self.gemini_key and not self.mock_mode:
            genai.configure(api_key=self.gemini_key)
            self.model = genai.GenerativeModel('gemini-flash-latest')
        
        self.tavily = TavilyClient(api_key=self.tavily_key) if (self.tavily_key and not self.mock_mode) else None

    def search_web(self, query: str) -> str:
        """Perform a web search."""
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

    async def process_query(self, query: str, history: List[Dict] = []) -> Generator[Dict[str, Any], None, None]:
        """Process user query."""
        if self.mock_mode:
            # Simulate a search-capable agent
            if "weather" in query.lower() or "news" in query.lower() or "capital" in query.lower():
                yield {"type": "status", "content": f"Searching the web for: {query}"}
                await asyncio.sleep(1.5)
                results = self.search_web(query)
                yield {"type": "search_results", "content": results}
                await asyncio.sleep(1.0)
                yield {"type": "answer", "content": f"In MOCK_MODE, I found that: {query}. The CAPITAL is Paris and it's sunny!"}
            else:
                await asyncio.sleep(0.8)
                yield {"type": "answer", "content": "I am currently running in MOCK_MODE because you've hit your Gemini API limit. I can still show you how I work!"}
            return

        if not self.gemini_key:
            yield {"type": "error", "content": "Gemini API key not configured."}
            return

        # System prompt for the agent
        system_instructions = (
            "You are Nebula, an advanced Agentic AI voice assistant. "
            "You have a web search tool. USE IT SELECTIVELY. "
            "- If a user asks for 'current weather', 'latest news', or 'live data', use it. "
            "- For greetings, common knowledge (e.g., 'What is the capital of France?'), or general facts, DO NOT use search. Respond from memory. "
            "IF you decide to search, start your response with 'SEARCH: [query]'. Otherwise, just speak the answer. "
            "Be very concise in your voice responses."
        )

        chat = self.model.start_chat(history=history)
        
        # Use async version of send_message
        response = await chat.send_message_async(f"{system_instructions}\n\nUser: {query}")
        
        if "SEARCH:" in response.text:
            search_query = response.text.split("SEARCH:")[1].strip().split("\n")[0]
            yield {"type": "status", "content": f"Searching for: {search_query}"}
            
            # Run search in thread to avoid blocking if it's slow
            loop = asyncio.get_event_loop()
            search_results = await loop.run_in_executor(None, self.search_web, search_query)
            yield {"type": "search_results", "content": search_results}
            
            final_response = await chat.send_message_async(f"Search Results:\n{search_results}\n\nProvide the final answer.")
            yield {"type": "answer", "content": final_response.text}
        else:
            yield {"type": "answer", "content": response.text}

agent_service = AgentService()
