# server/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os, time, uuid, jwt

# ========= CONFIG (edit these strings) =========
OPENAI_API_KEY = "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"  # <- put your real key here
LIVEKIT_URL    = "https://your-livekit-host"    # e.g. "wss://joud-xyz.livekit.cloud"
LIVEKIT_API_KEY    = "LKxxxxxxxxxxxxxxxx"
LIVEKIT_API_SECRET = "LKSEC_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# ===============================================

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

client = OpenAI(api_key=OPENAI_API_KEY)

class ChatIn(BaseModel):
    message: str
    persona: str = "ameera-calm"

@app.post("/chat")
def chat_route(body: ChatIn):
    try:
        system = (
            "You are Joud, an elegant, confident Saudi female assistant. "
            "Speak concisely, warm but professional. When the user asks for planning, "
            "append a section at the end:\n"
            "PLAN:\n- <type: task|event> | <title> | <YYYY-MM-DD hh:mm or date-only> | <optional reminder minutes>\n"
        )
        if body.persona == "ameera-dark":
            system = system.replace("confident", "poised")

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.6,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": body.message},
            ],
        )
        return {"reply": resp.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TokenIn(BaseModel):
    identity: str | None = None
    room: str = "joud-voice"

@app.post("/token")
def token_route(inp: TokenIn):
    if (not LIVEKIT_URL) or "your-livekit-host" in LIVEKIT_URL:
        raise HTTPException(400, "LiveKit not configured: set LIVEKIT_URL/API KEY/SECRET in server/app.py")

    now = int(time.time())
    identity = inp.identity or f"user-{uuid.uuid4()}"
    payload = {
        "iss": LIVEKIT_API_KEY,
        "sub": identity,
        "nbf": now,
        "iat": now,
        "exp": now + 60 * 5,  # 5 minutes
        "video": {
            "room": inp.room,
            "roomJoin": True,
            "roomCreate": True,
            "canPublish": True,
            "canSubscribe": True,
        },
    }
    token = jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")
    return {"url": LIVEKIT_URL, "token": token, "identity": identity}