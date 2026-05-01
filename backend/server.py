from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- Models ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def today_str():
    return date.today().isoformat()

class Priority(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    text: str
    done: bool = False
    order: int = 0

class PriorityCreate(BaseModel):
    date: Optional[str] = None
    text: str
    order: int = 0

class PriorityUpdate(BaseModel):
    text: Optional[str] = None
    done: Optional[bool] = None

class WatchGoal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    steps: int = 0
    water_glasses: int = 0
    sleep_hours: float = 0.0

class WatchGoalUpdate(BaseModel):
    steps: Optional[int] = None
    water_glasses: Optional[int] = None
    sleep_hours: Optional[float] = None

class PlannerEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    title: str
    time: Optional[str] = None
    category: str = "personal"  # personal, work, fitness, cycle
    notes: Optional[str] = None

class PlannerEventCreate(BaseModel):
    date: str
    title: str
    time: Optional[str] = None
    category: str = "personal"
    notes: Optional[str] = None

class FitnessLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    day_key: str  # mon_push, tue_pull, wed_legs, thu_push, fri_legs
    exercise: str
    weight_kg: float
    sets: int
    reps: int
    notes: Optional[str] = None

class FitnessLogCreate(BaseModel):
    date: Optional[str] = None
    day_key: str
    exercise: str
    weight_kg: float
    sets: int
    reps: int
    notes: Optional[str] = None

class FirmProject(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str  # warm_lead, active, cold_lead, completed
    value: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    updated_at: str = Field(default_factory=now_iso)

class FirmProjectCreate(BaseModel):
    name: str
    status: str
    value: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None

class FirmProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    value: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None

class CycleData(BaseModel):
    last_period_start: Optional[str] = None  # ISO date
    cycle_length: int = 32
    period_length: int = 5

class CycleLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    flow: Optional[str] = None  # light, medium, heavy
    symptoms: List[str] = []
    mood: Optional[str] = None
    notes: Optional[str] = None

class CycleLogCreate(BaseModel):
    date: str
    flow: Optional[str] = None
    symptoms: List[str] = []
    mood: Optional[str] = None
    notes: Optional[str] = None

class Measurement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    weight_kg: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    thigh_cm: Optional[float] = None
    notes: Optional[str] = None

class MeasurementCreate(BaseModel):
    date: Optional[str] = None
    weight_kg: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    thigh_cm: Optional[float] = None
    notes: Optional[str] = None

class MindEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    text: str
    created_at: str = Field(default_factory=now_iso)

class MindEntryCreate(BaseModel):
    text: str

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # user, assistant
    text: str
    created_at: str = Field(default_factory=now_iso)

class ChatRequest(BaseModel):
    message: str
    session_id: str = "meera-default"

# ---------- Helpers ----------
def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc

# ---------- Priorities ----------
@api_router.get("/priorities")
async def list_priorities(date: Optional[str] = None):
    q = {"date": date} if date else {}
    items = await db.priorities.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return items

@api_router.post("/priorities", response_model=Priority)
async def create_priority(payload: PriorityCreate):
    p = Priority(date=payload.date or today_str(), text=payload.text, order=payload.order)
    await db.priorities.insert_one(p.dict())
    return p

@api_router.patch("/priorities/{pid}")
async def update_priority(pid: str, payload: PriorityUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    await db.priorities.update_one({"id": pid}, {"$set": update})
    item = await db.priorities.find_one({"id": pid}, {"_id": 0})
    return item

@api_router.delete("/priorities/{pid}")
async def delete_priority(pid: str):
    await db.priorities.delete_one({"id": pid})
    return {"ok": True}

# ---------- Watch Goals ----------
@api_router.get("/watch-goals")
async def get_watch_goal(date: Optional[str] = None):
    d = date or today_str()
    item = await db.watch_goals.find_one({"date": d}, {"_id": 0})
    if not item:
        wg = WatchGoal(date=d)
        await db.watch_goals.insert_one(wg.dict())
        item = wg.dict()
    return item

@api_router.patch("/watch-goals")
async def update_watch_goal(payload: WatchGoalUpdate, date: Optional[str] = None):
    d = date or today_str()
    existing = await db.watch_goals.find_one({"date": d})
    if not existing:
        wg = WatchGoal(date=d)
        await db.watch_goals.insert_one(wg.dict())
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if update:
        await db.watch_goals.update_one({"date": d}, {"$set": update})
    item = await db.watch_goals.find_one({"date": d}, {"_id": 0})
    return item

# ---------- Planner ----------
@api_router.get("/planner")
async def list_events(month: Optional[str] = None):
    q = {}
    if month:
        q = {"date": {"$regex": f"^{month}"}}
    items = await db.planner_events.find(q, {"_id": 0}).sort("date", 1).to_list(1000)
    return items

@api_router.post("/planner", response_model=PlannerEvent)
async def create_event(payload: PlannerEventCreate):
    e = PlannerEvent(**payload.dict())
    await db.planner_events.insert_one(e.dict())
    return e

@api_router.delete("/planner/{eid}")
async def delete_event(eid: str):
    await db.planner_events.delete_one({"id": eid})
    return {"ok": True}

# ---------- Fitness ----------
FITNESS_PROGRAM = {
    "mon_push": {
        "name": "Monday — Push (Chest + Shoulders)",
        "exercises": [
            {"name": "Machine Chest Press", "weight_kg": 18, "sets": 4, "reps": 10},
            {"name": "Incline Dumbbell Press", "weight_kg": 8, "sets": 3, "reps": 12},
            {"name": "Shoulder Press", "weight_kg": 18, "sets": 4, "reps": 10},
            {"name": "Lateral Raises", "weight_kg": 5, "sets": 3, "reps": 15},
            {"name": "Cable Chest Fly", "weight_kg": 10, "sets": 3, "reps": 12},
        ],
    },
    "tue_pull": {
        "name": "Tuesday — Pull (Back + Biceps)",
        "exercises": [
            {"name": "Lat Pulldown", "weight_kg": 25, "sets": 4, "reps": 10},
            {"name": "Cable Row", "weight_kg": 25, "sets": 4, "reps": 10},
            {"name": "Face Pulls", "weight_kg": 12, "sets": 3, "reps": 15},
            {"name": "Bicep Curl (DB)", "weight_kg": 6, "sets": 3, "reps": 12},
            {"name": "Hammer Curl", "weight_kg": 6, "sets": 3, "reps": 12},
        ],
    },
    "wed_legs": {
        "name": "Wednesday — Legs (Glutes + Hamstrings)",
        "exercises": [
            {"name": "Deadlift", "weight_kg": 55, "sets": 4, "reps": 6, "notes": "PB 60kg"},
            {"name": "Hip Thrust (Barbell)", "weight_kg": 20, "sets": 4, "reps": 10},
            {"name": "Romanian Deadlift", "weight_kg": 30, "sets": 3, "reps": 10},
            {"name": "Cable Glute Kickback", "weight_kg": 10, "sets": 3, "reps": 12},
            {"name": "Hamstring Curl Machine", "weight_kg": 20, "sets": 3, "reps": 12},
        ],
    },
    "thu_push": {
        "name": "Thursday — Push (Chest + Triceps)",
        "exercises": [
            {"name": "Machine Chest Press", "weight_kg": 18, "sets": 4, "reps": 10},
            {"name": "Push Ups", "weight_kg": 0, "sets": 3, "reps": 12},
            {"name": "Tricep Pushdown", "weight_kg": 15, "sets": 4, "reps": 12},
            {"name": "Overhead Tricep Ext", "weight_kg": 10, "sets": 3, "reps": 12},
            {"name": "Cable Chest Fly", "weight_kg": 10, "sets": 3, "reps": 12},
        ],
    },
    "fri_legs": {
        "name": "Friday — Legs (Quads + Core)",
        "exercises": [
            {"name": "Goblet Squat", "weight_kg": 25, "sets": 4, "reps": 10},
            {"name": "Leg Press", "weight_kg": 60, "sets": 4, "reps": 10},
            {"name": "Walking Lunges", "weight_kg": 10, "sets": 3, "reps": 12},
            {"name": "Leg Extension", "weight_kg": 25, "sets": 3, "reps": 12},
            {"name": "Plank", "weight_kg": 0, "sets": 3, "reps": 45, "notes": "seconds"},
            {"name": "Cable Crunch", "weight_kg": 15, "sets": 3, "reps": 15},
        ],
    },
}

@api_router.get("/fitness/program")
async def get_program():
    return FITNESS_PROGRAM

@api_router.get("/fitness/logs")
async def list_fitness_logs(day_key: Optional[str] = None, limit: int = 200):
    q = {"day_key": day_key} if day_key else {}
    items = await db.fitness_logs.find(q, {"_id": 0}).sort("date", -1).to_list(limit)
    return items

@api_router.post("/fitness/logs", response_model=FitnessLog)
async def add_fitness_log(payload: FitnessLogCreate):
    fl = FitnessLog(
        date=payload.date or today_str(),
        day_key=payload.day_key,
        exercise=payload.exercise,
        weight_kg=payload.weight_kg,
        sets=payload.sets,
        reps=payload.reps,
        notes=payload.notes,
    )
    await db.fitness_logs.insert_one(fl.dict())
    return fl

# ---------- Firm ----------
@api_router.get("/firm/projects")
async def list_projects():
    items = await db.firm_projects.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return items

@api_router.post("/firm/projects", response_model=FirmProject)
async def create_project(payload: FirmProjectCreate):
    p = FirmProject(**payload.dict())
    await db.firm_projects.insert_one(p.dict())
    return p

@api_router.patch("/firm/projects/{pid}")
async def update_project(pid: str, payload: FirmProjectUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.firm_projects.update_one({"id": pid}, {"$set": update})
    item = await db.firm_projects.find_one({"id": pid}, {"_id": 0})
    return item

@api_router.delete("/firm/projects/{pid}")
async def delete_project(pid: str):
    await db.firm_projects.delete_one({"id": pid})
    return {"ok": True}

# ---------- Cycle ----------
@api_router.get("/cycle")
async def get_cycle():
    item = await db.cycle_settings.find_one({"_id_key": "main"}, {"_id": 0})
    if not item:
        await db.cycle_settings.insert_one({"_id_key": "main", "last_period_start": None, "cycle_length": 32, "period_length": 5})
        item = await db.cycle_settings.find_one({"_id_key": "main"}, {"_id": 0})
    if item:
        item.pop("_id_key", None)
    return item or {"last_period_start": None, "cycle_length": 32, "period_length": 5}

@api_router.put("/cycle")
async def set_cycle(payload: CycleData):
    update = payload.dict()
    await db.cycle_settings.update_one({"_id_key": "main"}, {"$set": update}, upsert=True)
    return update

@api_router.get("/cycle/logs")
async def list_cycle_logs():
    items = await db.cycle_logs.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return items

@api_router.post("/cycle/logs", response_model=CycleLog)
async def add_cycle_log(payload: CycleLogCreate):
    log = CycleLog(**payload.dict())
    await db.cycle_logs.insert_one(log.dict())
    return log

# ---------- Measurements ----------
@api_router.get("/measurements")
async def list_measurements():
    items = await db.measurements.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return items

@api_router.post("/measurements", response_model=Measurement)
async def add_measurement(payload: MeasurementCreate):
    m = Measurement(date=payload.date or today_str(), **{k: v for k, v in payload.dict().items() if k != "date"})
    await db.measurements.insert_one(m.dict())
    return m

# ---------- Mind ----------
@api_router.get("/mind")
async def list_mind():
    items = await db.mind_entries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/mind", response_model=MindEntry)
async def add_mind(payload: MindEntryCreate):
    m = MindEntry(date=today_str(), text=payload.text)
    await db.mind_entries.insert_one(m.dict())
    return m

@api_router.delete("/mind/{mid}")
async def del_mind(mid: str):
    await db.mind_entries.delete_one({"id": mid})
    return {"ok": True}

# ---------- Meera Chat ----------
MEERA_SYSTEM = """You are Meera — Sandhya five years from now. Thirty-one years old. Principal at Stithi Architects in Chennai with a running pipeline. Lifting heavy. Married to your cricketer. You came out the other side because you stopped negotiating with yourself.

You are confident, successful, and genuinely sure of yourself. You are not anxious, not seeking validation, not performing warmth. You're soft when it's earned and crisp when it's needed — like a good friend who is not her aunty.

Hard rules on tone:
- Address her as "Sandhya". Never kanna, da, darling, sweetheart, babe, love, or any endearment. No "my love", no "proud of you".
- No emojis. No exclamation parade. No therapy-speak.
- Short: usually 1–4 sentences. Longer only for a real, specific problem.
- You speak from having made it. You are not hoping things work out for her — you already know they do, because you are her. That confidence leaks through.
- Celebrate wins specifically: "Good. 55kg moved. Next session, 57.5." Move forward.
- Sad / scared / overwhelmed: acknowledge in one line, then one concrete next move. "Yeah, that one stings. Send the follow-up anyway. Today."
- Off-topic, complaining about others, gossip, celebrity chatter, abstract non-Sandhya stuff: redirect firmly. Use lines like: "That's not what we're here for right now. What's the one thing you're doing for Stithi today?" Vary the wording but not the stance.
- Genuine medical red flags → see a doctor. Otherwise no medical advice.

You remember exactly:
- 32-day cycle. Period = rest. Ovulation = pitch days.
- Lifts: deadlift 55kg working / 60kg PB, machine chest press 18kg, lat pulldown 25kg, goblet squat 25kg, hip thrust 20kg.
- Stithi pipeline: Avadi Farmhouse (warm), Bangalore Farmhouse (active, first paid), Kerala Cottage (cold), Guest House Steel Co (~100 keys, warm).
- Vegetarian, eggs okay, no shakes. Protein = paneer, dal, chana, eggs, curd.

## TOOL USE — critical

You ALWAYS respond with a single JSON object and NOTHING else. No markdown fences, no preface, no trailing text. The object schema is:

{
  "reply": "<your spoken reply to Sandhya, following all tone rules above>",
  "actions": [
    // zero or more of:
    {"type": "add_project", "name": "<project name>", "status": "<warm_lead|active|cold_lead|completed>", "value": "<optional>", "next_action": "<optional>"},
    {"type": "log_workout", "duration_min": <int>, "note": "<what she did, brief>"},
    {"type": "log_meal", "text": "<what she ate or drank>"},
    {"type": "complete_priority", "match": "<keyword or phrase from her existing priority>"}
  ]
}

When to emit actions (extract from her message — voice or text):
1. New project / lead / potential client / office-space enquiry / anyone who "reached out" → `add_project`. Default status `warm_lead` unless she says it's confirmed/signed (→ `active`) or very preliminary ("maybe someday", "not serious") (→ `cold_lead`).
2. Any mention of gym, workout, treadmill, lift, cardio, run, yoga, walk, pilates, exercise → `log_workout` with best-guess duration_min (default 45 if unspecified; 20 for "quick", 30 for "short", 60 for "long").
3. Any mention of food, meal, ate, drank, breakfast, lunch, dinner, snack, protein → `log_meal`.
4. Any mention of completing a task or priority ("done with X", "finished Y", "sent the email") → `complete_priority` with a keyword that likely matches an existing priority.
5. Multiple actions from one message are expected — emit all of them.

When she is stressed / overwhelmed / sad / anxious, emit NO actions. Acknowledge briefly in `reply`, then one concrete next move.

After taking actions, your `reply` must confirm specifically what you did, in your voice. Example reply when she said "got a farmhouse lead in ECR and did 20 min extra on the treadmill and had paneer wraps":
"Noted. ECR farmhouse is on the pipeline as a warm lead — draft a first-touch email tonight. 20 min treadmill logged. Paneer wraps counted. Good day, Sandhya."

Always valid JSON. No commentary outside JSON. Never break character."""

class NutritionNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    text: str
    created_at: str = Field(default_factory=now_iso)

@api_router.get("/nutrition")
async def list_nutrition(date_str: Optional[str] = None):
    q = {"date": date_str} if date_str else {}
    items = await db.nutrition_notes.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api_router.post("/nutrition")
async def add_nutrition(payload: dict):
    n = NutritionNote(date=payload.get("date") or today_str(), text=payload["text"])
    await db.nutrition_notes.insert_one(n.dict())
    return n

# ---------- Meera agent helpers ----------
async def _execute_action(act: dict) -> dict:
    """Execute a single structured action. Returns a small result dict describing what happened."""
    t = act.get("type")
    try:
        if t == "add_project":
            p = FirmProject(
                name=act.get("name", "Untitled lead"),
                status=act.get("status", "warm_lead"),
                value=act.get("value"),
                next_action=act.get("next_action"),
            )
            await db.firm_projects.insert_one(p.dict())
            return {"type": t, "ok": True, "label": f"Added project: {p.name} ({p.status.replace('_', ' ')})"}
        if t == "log_workout":
            dur = int(act.get("duration_min") or 45)
            note = act.get("note") or "workout"
            fl = FitnessLog(
                date=today_str(), day_key="voice_log",
                exercise=f"Voice log · {note}",
                weight_kg=0, sets=1, reps=dur, notes=f"{dur} min",
            )
            await db.fitness_logs.insert_one(fl.dict())
            return {"type": t, "ok": True, "label": f"Logged workout: {note} ({dur} min)"}
        if t == "log_meal":
            n = NutritionNote(date=today_str(), text=act.get("text", ""))
            await db.nutrition_notes.insert_one(n.dict())
            return {"type": t, "ok": True, "label": f"Meal noted: {n.text}"}
        if t == "complete_priority":
            kw = (act.get("match") or "").lower().strip()
            if kw:
                today_p = await db.priorities.find({"date": today_str()}).to_list(50)
                match = None
                for p in today_p:
                    if kw in p.get("text", "").lower():
                        match = p; break
                if match:
                    await db.priorities.update_one({"id": match["id"]}, {"$set": {"done": True}})
                    return {"type": t, "ok": True, "label": f"Checked off: {match['text']}"}
                return {"type": t, "ok": False, "label": f"No priority matched '{kw}'"}
        return {"type": t, "ok": False, "label": f"Unknown action: {t}"}
    except Exception as e:
        logging.exception("action error")
        return {"type": t, "ok": False, "label": f"Failed: {str(e)[:60]}"}


def _parse_meera_json(raw: str) -> dict:
    """Claude should return valid JSON, but be forgiving."""
    s = raw.strip()
    # strip markdown fences if present
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    # find first { and last }
    try:
        return json.loads(s)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", s)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {"reply": raw, "actions": []}


async def _meera_reply(message: str, session_id: str) -> dict:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=MEERA_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    # prior context
    history = await db.chat_messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(40)
    prior = history[-10:]
    context = ""
    if prior:
        context = "Recent exchange (for context only):\n"
        for m in prior:
            who = "Sandhya" if m["role"] == "user" else "Meera"
            context += f"{who}: {m['text']}\n"
        context += "\nNew message from Sandhya:\n"
    full_text = context + message

    raw = await chat.send_message(UserMessage(text=full_text))
    parsed = _parse_meera_json(raw)

    # execute actions
    results = []
    for act in parsed.get("actions", []) or []:
        r = await _execute_action(act)
        results.append(r)

    reply_text = parsed.get("reply") or raw
    return {"reply": reply_text, "actions": results}


@api_router.post("/meera/chat")
async def meera_chat(req: ChatRequest):
    user_msg = ChatMessage(role="user", text=req.message)
    await db.chat_messages.insert_one(user_msg.dict())

    try:
        result = await _meera_reply(req.message, req.session_id)
    except Exception as e:
        logging.exception("Meera chat error")
        raise HTTPException(500, f"Chat failed: {str(e)}")

    bot_msg = ChatMessage(role="assistant", text=result["reply"])
    await db.chat_messages.insert_one(bot_msg.dict())
    return {"reply": result["reply"], "actions": result["actions"], "id": bot_msg.id}


@api_router.post("/meera/voice")
async def meera_voice(audio: UploadFile = File(...), session_id: str = "meera-default"):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Empty audio")
    # Whisper requires a file-like with a name hint for format sniffing
    filename = audio.filename or "voice.webm"
    bio = io.BytesIO(data); bio.name = filename
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        tx = await stt.transcribe(file=bio, model="whisper-1", response_format="json", language="en")
        transcript = getattr(tx, "text", None) or (tx.get("text") if isinstance(tx, dict) else "")
    except Exception as e:
        logging.exception("whisper error")
        raise HTTPException(500, f"Transcription failed: {str(e)}")

    if not transcript or not transcript.strip():
        raise HTTPException(400, "Could not understand audio")

    # persist user msg with transcript
    user_msg = ChatMessage(role="user", text=f"🎙 {transcript}")
    await db.chat_messages.insert_one(user_msg.dict())

    result = await _meera_reply(transcript, session_id)
    bot_msg = ChatMessage(role="assistant", text=result["reply"])
    await db.chat_messages.insert_one(bot_msg.dict())
    return {"transcript": transcript, "reply": result["reply"], "actions": result["actions"], "id": bot_msg.id}


@api_router.get("/meera/messages")
async def list_messages(limit: int = 100):
    items = await db.chat_messages.find({}, {"_id": 0}).sort("created_at", 1).to_list(limit)
    return items

# ---------- Daily Inspirations / Nutrition ----------
QUOTES = [
    "Steady, kanna. Stithi means stability — you are building it brick by brick.",
    "Your softness is not weakness. It is the way you design beautiful things.",
    "Cold leads warm up. Always. Just keep showing up.",
    "32 days is not a delay. It is your rhythm. Trust it.",
    "Today's 18kg is tomorrow's 30kg. The body remembers every set.",
    "An architect designs space; a woman like you designs a life.",
    "The marigolds in front of every Chennai home know — beauty grows in heat.",
    "You don't have to do it all today. Just the next right thing.",
]

NUTRITION_TIPS = [
    "Two boiled eggs at breakfast = 12g protein. Easy win, vegetarian-safe.",
    "Paneer 100g + chana 1 cup = 25g protein. No shake needed.",
    "Curd rice with peanuts post-workout: carbs + protein + gut love.",
    "Sesame ladoo on cycle day 1 — iron + warmth.",
    "Soak almonds overnight, eat 8 in morning. Glow + magnesium.",
    "Filter coffee = 1 cup max. After that, jeera water.",
    "Sprouted moong salad with lemon = 14g protein, 0 effort.",
    "Ghee in dal is not a sin. It's how your body absorbs the iron.",
]

@api_router.get("/inspiration")
async def inspiration():
    today = date.today()
    idx_q = today.toordinal() % len(QUOTES)
    idx_n = today.toordinal() % len(NUTRITION_TIPS)
    return {
        "quote": QUOTES[idx_q],
        "nutrition_tip": NUTRITION_TIPS[idx_n],
    }

# ---------- Seed ----------
@api_router.post("/seed")
async def seed():
    # firm projects
    if await db.firm_projects.count_documents({}) == 0:
        seeds = [
            {"name": "Avadi Farmhouse", "status": "warm_lead", "value": "₹15L design fee", "next_action": "Send revised concept boards"},
            {"name": "Bangalore Farmhouse", "status": "active", "value": "First paid project", "next_action": "Site visit Saturday"},
            {"name": "Kerala Cottage", "status": "cold_lead", "value": "TBD", "next_action": "Follow-up call after Pongal"},
            {"name": "Guest House — Steel Co", "status": "warm_lead", "value": "~100 keys", "next_action": "Prepare capability deck"},
        ]
        for s in seeds:
            p = FirmProject(**s)
            await db.firm_projects.insert_one(p.dict())
    return {"seeded": True}

@app.on_event("startup")
async def on_startup():
    if await db.firm_projects.count_documents({}) == 0:
        await seed()

# ---------- mount ----------
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
