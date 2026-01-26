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
        
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        self.tavily = TavilyClient(api_key=self.tavily_key) if self.tavily_key else None

    def search_web(self, query: str) -> str:
        """Perform a web search using Tavily."""
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
        """Process user query with tool-use reasoning."""
        if not self.gemini_key:
            yield {"type": "error", "content": "Gemini API key not configured."}
            return

        # System prompt for the agent
        system_instructions = (
            "You are Nebula, an advanced Agentic AI voice assistant. "
            "You have access to a web search tool. If a question requires up-to-date information, "
            "use the tool. Be concise in your voice responses. If you use search, "
            "explain what you are looking for briefly. "
            "IMPORTANT: If you decide to search, start your response with 'SEARCH: [query]'."
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
