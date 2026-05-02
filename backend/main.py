# ============================================================
#  FocusMint AI Chatbot Backend
#  Run: uvicorn main:app --reload --port 8000
# ============================================================

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Annotated
from typing_extensions import TypedDict
from dotenv import load_dotenv

# LangChain — using OpenAI package since GitHub Models
# uses the same API format as OpenAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# LangGraph
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

# ── Load .env ──
load_dotenv()

# ── Read GitHub token ──
api_key = os.getenv("GITHUB_TOKEN")
if not api_key:
    raise RuntimeError("GITHUB_TOKEN not found. Check your .env file.")

# ============================================================
#  FastAPI app
# ============================================================
app = FastAPI(title="FocusMint Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
#  LLM — GitHub Models uses OpenAI-compatible API
#  base_url points to GitHub's model inference endpoint
#  model is gpt-4o-mini — free on GitHub Models
# ============================================================
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.7,
    api_key=api_key,
    base_url="https://models.inference.ai.azure.com"
)

# ── Minty's personality ──
SYSTEM_PROMPT = SystemMessage(content="""
You are Minty, the friendly AI assistant built into FocusMint — a productivity hub.
You help users with productivity tips, task planning, habit building,
mindfulness, focus strategies, and general friendly conversation.
Keep replies concise, warm, and encouraging.
Use bullet points when listing things.
""")

# ============================================================
#  LangGraph State
#  add_messages reducer appends instead of replacing
# ============================================================
class ChatState(TypedDict):
    messages: Annotated[list, add_messages]

# ============================================================
#  Chatbot Node — reads full history, calls LLM, returns reply
# ============================================================
def chatbot_node(state: ChatState):
    all_messages = [SYSTEM_PROMPT] + state["messages"]
    response = llm.invoke(all_messages)
    return {"messages": [response]}

# ============================================================
#  Build LangGraph
# ============================================================
builder = StateGraph(ChatState)
builder.add_node("chatbot", chatbot_node)
builder.set_entry_point("chatbot")
builder.add_edge("chatbot", END)
chat_graph = builder.compile()

# ============================================================
#  In-memory session store
#  maps session_id → list of messages
# ============================================================
sessions: dict = {}

# ============================================================
#  Pydantic schemas — data validation for requests/responses
# ============================================================
class ChatRequest(BaseModel):
    session_id: str
    message: str

class MessageOut(BaseModel):
    role: str
    content: str

class ChatResponse(BaseModel):
    reply: str
    history: List[MessageOut]

# ============================================================
#  POST /chat — main endpoint the frontend calls
# ============================================================
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        # Get existing session or start fresh
        history = sessions.get(req.session_id, [])

        # Add user's message to history
        history.append(HumanMessage(content=req.message))

        # Run LangGraph — returns updated state with AI reply appended
        result = chat_graph.invoke({"messages": history})
        updated = result["messages"]

        # Last message in list is the AI reply
        ai_reply = updated[-1].content

        # Save updated history for next message
        sessions[req.session_id] = updated

        # Build clean response for frontend
        history_out = []
        for msg in updated:
            if isinstance(msg, HumanMessage):
                history_out.append(MessageOut(role="user", content=msg.content))
            elif isinstance(msg, AIMessage):
                history_out.append(MessageOut(role="assistant", content=msg.content))

        return ChatResponse(reply=ai_reply, history=history_out)

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
#  DELETE /chat/{session_id} — clear conversation
# ============================================================
@app.delete("/chat/{session_id}")
async def clear_session(session_id: str):
    sessions.pop(session_id, None)
    return {"status": "cleared"}

# ============================================================
#  GET /health — check server is alive
# ============================================================
@app.get("/health")
async def health():
    return {"status": "ok", "model": "gpt-4o-mini (GitHub Models)"}