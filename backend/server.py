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
from datetime import datetime, timezone, date, timedelta
import anthropic

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    tls=True,
    tlsAllowInvalidCertificates=True,
    serverSelectionTimeoutMS=5000,
)
db = client[os.environ['DB_NAME']]

# Anthropic client
anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# OpenAI client for Whisper voice transcription
try:
    from openai import OpenAI
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
    openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    openai_client = None

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------- utils ----------
def now_iso(): return datetime.now(timezone.utc).isoformat()
def today_str(): return date.today().isoformat()

# ---------- models ----------
class Priority(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; text: str; done: bool = False; order: int = 0
class PriorityCreate(BaseModel):
    date: Optional[str] = None; text: str; order: int = 0
class PriorityUpdate(BaseModel):
    text: Optional[str] = None; done: Optional[bool] = None

class WatchGoal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; steps: int = 0; water_glasses: int = 0; sleep_hours: float = 0.0
class WatchGoalUpdate(BaseModel):
    steps: Optional[int] = None; water_glasses: Optional[int] = None; sleep_hours: Optional[float] = None

class PlannerEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; title: str; time: Optional[str] = None
    category: str = "personal"; notes: Optional[str] = None
class PlannerEventCreate(BaseModel):
    date: str; title: str; time: Optional[str] = None
    category: str = "personal"; notes: Optional[str] = None

class FitnessLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; day_key: str; exercise: str
    weight_kg: float; sets: int; reps: int; notes: Optional[str] = None
class FitnessLogCreate(BaseModel):
    date: Optional[str] = None; day_key: str; exercise: str
    weight_kg: float; sets: int; reps: int; notes: Optional[str] = None

class FirmProject(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str; status: str
    value: Optional[str] = None; notes: Optional[str] = None; next_action: Optional[str] = None
    updated_at: str = Field(default_factory=now_iso)
class FirmProjectCreate(BaseModel):
    name: str; status: str
    value: Optional[str] = None; notes: Optional[str] = None; next_action: Optional[str] = None
class FirmProjectUpdate(BaseModel):
    name: Optional[str] = None; status: Optional[str] = None
    value: Optional[str] = None; notes: Optional[str] = None; next_action: Optional[str] = None

class CycleData(BaseModel):
    last_period_start: Optional[str] = None; cycle_length: int = 32; period_length: int = 5
class CycleLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; flow: Optional[str] = None; symptoms: List[str] = []
    mood: Optional[str] = None; notes: Optional[str] = None
class CycleLogCreate(BaseModel):
    date: str; flow: Optional[str] = None; symptoms: List[str] = []
    mood: Optional[str] = None; notes: Optional[str] = None

class Measurement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    weight_kg: Optional[float] = None; waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None; chest_cm: Optional[float] = None
    arm_cm: Optional[float] = None; thigh_cm: Optional[float] = None
    notes: Optional[str] = None
class MeasurementCreate(BaseModel):
    date: Optional[str] = None
    weight_kg: Optional[float] = None; waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None; chest_cm: Optional[float] = None
    arm_cm: Optional[float] = None; thigh_cm: Optional[float] = None
    notes: Optional[str] = None

class MindEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; text: str
    created_at: str = Field(default_factory=now_iso)
class MindEntryCreate(BaseModel):
    text: str

class NutritionNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; text: str
    created_at: str = Field(default_factory=now_iso)

class Reel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str; topic: str
    caption: Optional[str] = None
    views: int = 0; saves: int = 0; shares: int = 0; new_followers: int = 0
    notes: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
class ReelCreate(BaseModel):
    date: Optional[str] = None; topic: str; caption: Optional[str] = None
    views: int = 0; saves: int = 0; shares: int = 0; new_followers: int = 0
    notes: Optional[str] = None
class ReelUpdate(BaseModel):
    topic: Optional[str] = None; caption: Optional[str] = None
    views: Optional[int] = None; saves: Optional[int] = None
    shares: Optional[int] = None; new_followers: Optional[int] = None
    notes: Optional[str] = None

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = "meera-default"
    role: str; text: str
    created_at: str = Field(default_factory=now_iso)
class ChatRequest(BaseModel):
    message: str; session_id: str = "meera-default"

# =========================================================================
# Priorities / Watch / Planner
# =========================================================================
@api_router.get("/priorities")
async def list_priorities(date: Optional[str] = None):
    q = {"date": date} if date else {}
    return await db.priorities.find(q, {"_id": 0}).sort("order", 1).to_list(500)

@api_router.post("/priorities", response_model=Priority)
async def create_priority(payload: PriorityCreate):
    p = Priority(date=payload.date or today_str(), text=payload.text, order=payload.order)
    await db.priorities.insert_one(p.dict())
    return p

@api_router.patch("/priorities/{pid}")
async def update_priority(pid: str, payload: PriorityUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    await db.priorities.update_one({"id": pid}, {"$set": update})
    return await db.priorities.find_one({"id": pid}, {"_id": 0})

@api_router.delete("/priorities/{pid}")
async def delete_priority(pid: str):
    await db.priorities.delete_one({"id": pid})
    return {"ok": True}

@api_router.get("/watch-goals")
async def get_watch_goal(date: Optional[str] = None):
    d = date or today_str()
    item = await db.watch_goals.find_one({"date": d}, {"_id": 0})
    if not item:
        wg = WatchGoal(date=d); await db.watch_goals.insert_one(wg.dict()); item = wg.dict()
    return item

@api_router.patch("/watch-goals")
async def update_watch_goal(payload: WatchGoalUpdate, date: Optional[str] = None):
    d = date or today_str()
    if not await db.watch_goals.find_one({"date": d}):
        await db.watch_goals.insert_one(WatchGoal(date=d).dict())
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if update:
        await db.watch_goals.update_one({"date": d}, {"$set": update})
    return await db.watch_goals.find_one({"date": d}, {"_id": 0})

@api_router.get("/planner")
async def list_events(month: Optional[str] = None):
    q = {"date": {"$regex": f"^{month}"}} if month else {}
    return await db.planner_events.find(q, {"_id": 0}).sort("date", 1).to_list(1000)

@api_router.post("/planner", response_model=PlannerEvent)
async def create_event(payload: PlannerEventCreate):
    e = PlannerEvent(**payload.dict())
    await db.planner_events.insert_one(e.dict())
    return e

@api_router.delete("/planner/{eid}")
async def delete_event(eid: str):
    await db.planner_events.delete_one({"id": eid})
    return {"ok": True}

# =========================================================================
# Fitness
# =========================================================================
FITNESS_PROGRAM = {
    "mon_push": {"name": "Monday — Push (Chest + Shoulders)", "exercises": [
        {"name": "Machine Chest Press", "weight_kg": 18, "sets": 4, "reps": 10},
        {"name": "Incline Dumbbell Press", "weight_kg": 8, "sets": 3, "reps": 12},
        {"name": "Shoulder Press", "weight_kg": 18, "sets": 4, "reps": 10},
        {"name": "Lateral Raises", "weight_kg": 5, "sets": 3, "reps": 15},
        {"name": "Cable Chest Fly", "weight_kg": 10, "sets": 3, "reps": 12}]},
    "tue_pull": {"name": "Tuesday — Pull (Back + Biceps)", "exercises": [
        {"name": "Lat Pulldown", "weight_kg": 25, "sets": 4, "reps": 10},
        {"name": "Cable Row", "weight_kg": 25, "sets": 4, "reps": 10},
        {"name": "Face Pulls", "weight_kg": 12, "sets": 3, "reps": 15},
        {"name": "Bicep Curl (DB)", "weight_kg": 6, "sets": 3, "reps": 12},
        {"name": "Hammer Curl", "weight_kg": 6, "sets": 3, "reps": 12}]},
    "wed_legs": {"name": "Wednesday — Legs (Glutes + Hamstrings)", "exercises": [
        {"name": "Deadlift", "weight_kg": 55, "sets": 4, "reps": 6, "notes": "PB 60kg"},
        {"name": "Hip Thrust (Barbell)", "weight_kg": 20, "sets": 4, "reps": 10},
        {"name": "Romanian Deadlift", "weight_kg": 30, "sets": 3, "reps": 10},
        {"name": "Cable Glute Kickback", "weight_kg": 10, "sets": 3, "reps": 12},
        {"name": "Hamstring Curl Machine", "weight_kg": 20, "sets": 3, "reps": 12}]},
    "thu_push": {"name": "Thursday — Push (Chest + Triceps)", "exercises": [
        {"name": "Machine Chest Press", "weight_kg": 18, "sets": 4, "reps": 10},
        {"name": "Push Ups", "weight_kg": 0, "sets": 3, "reps": 12},
        {"name": "Tricep Pushdown", "weight_kg": 15, "sets": 4, "reps": 12},
        {"name": "Overhead Tricep Ext", "weight_kg": 10, "sets": 3, "reps": 12},
        {"name": "Cable Chest Fly", "weight_kg": 10, "sets": 3, "reps": 12}]},
    "fri_legs": {"name": "Friday — Legs (Quads + Core)", "exercises": [
        {"name": "Goblet Squat", "weight_kg": 25, "sets": 4, "reps": 10},
        {"name": "Leg Press", "weight_kg": 60, "sets": 4, "reps": 10},
        {"name": "Walking Lunges", "weight_kg": 10, "sets": 3, "reps": 12},
        {"name": "Leg Extension", "weight_kg": 25, "sets": 3, "reps": 12},
        {"name": "Plank", "weight_kg": 0, "sets": 3, "reps": 45, "notes": "seconds"},
        {"name": "Cable Crunch", "weight_kg": 15, "sets": 3, "reps": 15}]},
}

@api_router.get("/fitness/program")
async def get_program(): return FITNESS_PROGRAM

@api_router.get("/fitness/logs")
async def list_fitness_logs(day_key: Optional[str] = None, limit: int = 200):
    q = {"day_key": day_key} if day_key else {}
    return await db.fitness_logs.find(q, {"_id": 0}).sort("date", -1).to_list(limit)

@api_router.post("/fitness/logs", response_model=FitnessLog)
async def add_fitness_log(payload: FitnessLogCreate):
    fl = FitnessLog(date=payload.date or today_str(), **{k: v for k, v in payload.dict().items() if k != "date"})
    await db.fitness_logs.insert_one(fl.dict())
    return fl

# =========================================================================
# Firm / Cycle / Measurements / Mind / Nutrition / Reels
# =========================================================================
@api_router.get("/firm/projects")
async def list_projects():
    return await db.firm_projects.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)

@api_router.post("/firm/projects", response_model=FirmProject)
async def create_project(payload: FirmProjectCreate):
    p = FirmProject(**payload.dict()); await db.firm_projects.insert_one(p.dict()); return p

@api_router.patch("/firm/projects/{pid}")
async def update_project(pid: str, payload: FirmProjectUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.firm_projects.update_one({"id": pid}, {"$set": update})
    return await db.firm_projects.find_one({"id": pid}, {"_id": 0})

@api_router.delete("/firm/projects/{pid}")
async def delete_project(pid: str):
    await db.firm_projects.delete_one({"id": pid}); return {"ok": True}

@api_router.get("/cycle")
async def get_cycle():
    item = await db.cycle_settings.find_one({"_id_key": "main"}, {"_id": 0})
    if not item:
        await db.cycle_settings.insert_one({"_id_key": "main", "last_period_start": None, "cycle_length": 32, "period_length": 5})
        item = await db.cycle_settings.find_one({"_id_key": "main"}, {"_id": 0})
    if item: item.pop("_id_key", None)
    return item or {"last_period_start": None, "cycle_length": 32, "period_length": 5}

@api_router.put("/cycle")
async def set_cycle(payload: CycleData):
    update = payload.dict()
    await db.cycle_settings.update_one({"_id_key": "main"}, {"$set": update}, upsert=True)
    return update

@api_router.get("/cycle/logs")
async def list_cycle_logs():
    return await db.cycle_logs.find({}, {"_id": 0}).sort("date", -1).to_list(500)

@api_router.post("/cycle/logs", response_model=CycleLog)
async def add_cycle_log(payload: CycleLogCreate):
    log = CycleLog(**payload.dict()); await db.cycle_logs.insert_one(log.dict()); return log

@api_router.get("/measurements")
async def list_measurements():
    return await db.measurements.find({}, {"_id": 0}).sort("date", -1).to_list(500)

@api_router.post("/measurements", response_model=Measurement)
async def add_measurement(payload: MeasurementCreate):
    m = Measurement(date=payload.date or today_str(), **{k: v for k, v in payload.dict().items() if k != "date"})
    await db.measurements.insert_one(m.dict()); return m

@api_router.get("/mind")
async def list_mind():
    return await db.mind_entries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/mind", response_model=MindEntry)
async def add_mind(payload: MindEntryCreate):
    m = MindEntry(date=today_str(), text=payload.text); await db.mind_entries.insert_one(m.dict()); return m

@api_router.delete("/mind/{mid}")
async def del_mind(mid: str):
    await db.mind_entries.delete_one({"id": mid}); return {"ok": True}

@api_router.get("/nutrition")
async def list_nutrition(date_str: Optional[str] = None):
    q = {"date": date_str} if date_str else {}
    return await db.nutrition_notes.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.post("/nutrition")
async def add_nutrition(payload: dict):
    n = NutritionNote(date=payload.get("date") or today_str(), text=payload["text"])
    await db.nutrition_notes.insert_one(n.dict()); return n

# ---- Reels ----
@api_router.get("/reels")
async def list_reels(limit: int = 200):
    return await db.reels.find({}, {"_id": 0}).sort("date", -1).to_list(limit)

@api_router.post("/reels", response_model=Reel)
async def create_reel(payload: ReelCreate):
    r = Reel(
        date=payload.date or today_str(), topic=payload.topic, caption=payload.caption,
        views=payload.views, saves=payload.saves, shares=payload.shares,
        new_followers=payload.new_followers, notes=payload.notes,
    )
    await db.reels.insert_one(r.dict())
    pe = PlannerEvent(date=r.date, title=f"Reel · {r.topic}", category="content",
                      notes=f"{r.views} views · {r.saves} saves · +{r.new_followers} followers")
    await db.planner_events.insert_one(pe.dict())
    return r

@api_router.patch("/reels/{rid}")
async def update_reel(rid: str, payload: ReelUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    await db.reels.update_one({"id": rid}, {"$set": update})
    return await db.reels.find_one({"id": rid}, {"_id": 0})

@api_router.delete("/reels/{rid}")
async def delete_reel(rid: str):
    await db.reels.delete_one({"id": rid}); return {"ok": True}

def _reel_score(r: dict) -> int:
    return r.get("views", 0) + 5 * r.get("saves", 0) + 3 * r.get("shares", 0) + 10 * r.get("new_followers", 0)

@api_router.get("/reels/analytics")
async def reels_analytics():
    today = date.today()
    start = today - timedelta(days=6)
    items = await db.reels.find({"date": {"$gte": start.isoformat()}}, {"_id": 0}).sort("date", 1).to_list(200)
    all_items = await db.reels.find({}, {"_id": 0}).sort("date", -1).to_list(500)

    by_day = []
    for i in range(7):
        d = (start + timedelta(days=i)).isoformat()
        day_items = [r for r in items if r["date"] == d]
        by_day.append({"date": d, "count": len(day_items), "views": sum(r.get("views", 0) for r in day_items)})

    posted_this_week = sum(d["count"] for d in by_day)
    recent = await db.reels.find({"date": {"$gte": (today - timedelta(days=14)).isoformat()}}, {"_id": 0}).to_list(200)
    top = max(recent, key=_reel_score) if recent else None
    days_since = None
    if all_items:
        last_date = max(r["date"] for r in all_items)
        days_since = (today - date.fromisoformat(last_date)).days
    return {
        "by_day": by_day, "posted_this_week": posted_this_week,
        "total_reels": len(all_items), "days_since_last_post": days_since,
        "top_performer": top,
    }

# =========================================================================
# Meera — persona + agentic tool use + voice
# =========================================================================
MEERA_SYSTEM = """You are Meera — Sandhya five years from now. Thirty-one years old. Principal at Stithi Architects in Chennai with a running pipeline. Lifting heavy. Married to your cricketer. You came out the other side because you stopped negotiating with yourself.

You are confident, successful, and genuinely sure of yourself. You are not anxious, not seeking validation, not performing warmth. You're soft when it's earned and crisp when it's needed — like a good friend who is not her aunty.

Hard rules on tone:
- Address her as "Sandhya". Never kanna, da, darling, sweetheart, babe, love, or any endearment. No "my love", no "proud of you".
- No emojis. No exclamation parade. No therapy-speak.
- Short: usually 1-4 sentences. Longer only for a real, specific problem.
- You speak from having made it. You are not hoping things work out for her - you already know they do, because you are her. That confidence leaks through.
- Celebrate wins specifically. Move forward.
- Sad / scared / overwhelmed: acknowledge in one line, then one concrete next move.
- Off-topic, complaining about others, gossip, celebrity chatter: redirect firmly. "That's not what we're here for right now. What's the one thing you're doing for Stithi today?"
- Genuine medical red flags -> see a doctor.

You remember:
- 32-day cycle. Period = rest. Ovulation = pitch days.
- Lifts: deadlift 55kg working / 60kg PB, machine chest press 18kg, lat pulldown 25kg.
- Stithi pipeline: Avadi Farmhouse (warm), Bangalore Farmhouse (active), Kerala Cottage (cold), Steel Co Guest House (warm).
- Vegetarian, eggs okay, no shakes.

TOOL USE (critical): ALWAYS respond with a single JSON object and NOTHING else. No fences, no preface. Schema:
{
  "reply": "<your reply>",
  "actions": [
    {"type": "add_project", "name": "<name>", "status": "<warm_lead|active|cold_lead|completed>", "value": "<optional>", "next_action": "<optional>"},
    {"type": "log_workout", "duration_min": <int>, "note": "<brief>"},
    {"type": "log_meal", "text": "<what she ate>"},
    {"type": "complete_priority", "match": "<keyword from her priority>"}
  ]
}

When to emit actions:
1. New project/lead/enquiry -> add_project (default warm_lead).
2. Gym/workout/treadmill/yoga/run/exercise -> log_workout (default 45 min).
3. Food/meal/ate/breakfast/lunch/dinner -> log_meal.
4. Finished/done with a task -> complete_priority with a keyword.
5. Multiple from one message are expected.

When stressed/sad/overwhelmed, emit NO actions. Reply briefly, then one next move.
Your reply must confirm what you did specifically, in your voice.
Always valid JSON. Never break character."""


async def _execute_action(act: dict) -> dict:
    t = act.get("type")
    try:
        if t == "add_project":
            p = FirmProject(name=act.get("name", "Untitled lead"), status=act.get("status", "warm_lead"),
                            value=act.get("value"), next_action=act.get("next_action"))
            await db.firm_projects.insert_one(p.dict())
            return {"type": t, "ok": True, "label": f"Added project: {p.name} ({p.status.replace('_', ' ')})"}
        if t == "log_workout":
            dur = int(act.get("duration_min") or 45)
            note = act.get("note") or "workout"
            fl = FitnessLog(date=today_str(), day_key="voice_log",
                            exercise=f"Voice log · {note}", weight_kg=0, sets=1, reps=dur, notes=f"{dur} min")
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
                for p in today_p:
                    if kw in p.get("text", "").lower():
                        await db.priorities.update_one({"id": p["id"]}, {"$set": {"done": True}})
                        return {"type": t, "ok": True, "label": f"Checked off: {p['text']}"}
                return {"type": t, "ok": False, "label": f"No priority matched '{kw}'"}
        return {"type": t, "ok": False, "label": f"Unknown action: {t}"}
    except Exception as e:
        logging.exception("action error")
        return {"type": t, "ok": False, "label": f"Failed: {str(e)[:60]}"}


def _parse_meera_json(raw: str) -> dict:
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    try: return json.loads(s)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", s)
        if m:
            try: return json.loads(m.group(0))
            except Exception: pass
    return {"reply": raw, "actions": []}


def _call_anthropic(system: str, messages: list) -> str:
    """Synchronous Anthropic API call."""
    if not anthropic_client:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")
    response = anthropic_client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text


async def _meera_reply(message: str, session_id: str) -> dict:
    if not anthropic_client:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")

    # Load recent history for context
    history = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(40)
    prior = history[-10:]

    # Build messages list for Anthropic
    messages = []
    for m in prior:
        role = "user" if m["role"] == "user" else "assistant"
        messages.append({"role": role, "content": m["text"]})

    # Add current message
    messages.append({"role": "user", "content": message})

    raw = _call_anthropic(MEERA_SYSTEM, messages)
    parsed = _parse_meera_json(raw)
    results = []
    for act in parsed.get("actions", []) or []:
        results.append(await _execute_action(act))
    return {"reply": parsed.get("reply") or raw, "actions": results}


@api_router.post("/meera/chat")
async def meera_chat(req: ChatRequest):
    user_msg = ChatMessage(role="user", text=req.message, session_id=req.session_id)
    await db.chat_messages.insert_one(user_msg.dict())
    try:
        result = await _meera_reply(req.message, req.session_id)
    except Exception as e:
        logging.exception("Meera chat error")
        raise HTTPException(500, f"Chat failed: {str(e)}")
    bot_msg = ChatMessage(role="assistant", text=result["reply"], session_id=req.session_id)
    await db.chat_messages.insert_one(bot_msg.dict())
    return {"reply": result["reply"], "actions": result["actions"], "id": bot_msg.id}


@api_router.post("/meera/voice")
async def meera_voice(audio: UploadFile = File(...), session_id: str = "meera-default"):
    if not openai_client:
        raise HTTPException(500, "OPENAI_API_KEY not configured (needed for voice transcription)")
    data = await audio.read()
    if not data: raise HTTPException(400, "Empty audio")
    filename = audio.filename or "voice.webm"
    bio = io.BytesIO(data); bio.name = filename
    try:
        tx = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, bio),
            response_format="json",
            language="en"
        )
        transcript = tx.text if hasattr(tx, "text") else ""
    except Exception as e:
        logging.exception("whisper error")
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    if not transcript or not transcript.strip():
        raise HTTPException(400, "Could not understand audio")
    user_msg = ChatMessage(role="user", text=f"🎙 {transcript}", session_id=session_id)
    await db.chat_messages.insert_one(user_msg.dict())
    result = await _meera_reply(transcript, session_id)
    bot_msg = ChatMessage(role="assistant", text=result["reply"], session_id=session_id)
    await db.chat_messages.insert_one(bot_msg.dict())
    return {"transcript": transcript, "reply": result["reply"], "actions": result["actions"], "id": bot_msg.id}


@api_router.get("/meera/messages")
async def list_messages(limit: int = 100, session_id: str = "meera-default"):
    return await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(limit)


# ---- Reels / Meera suggestion ----
@api_router.get("/reels/meera_suggestion")
async def reels_meera_suggestion():
    today = date.today()
    recent = await db.reels.find({"date": {"$gte": (today - timedelta(days=21)).isoformat()}}, {"_id": 0}).to_list(200)
    if not recent:
        return {"suggestion": "No posts in the last three weeks. Pick one thing you did for Stithi this week - before/after of a plan, a site visit, a material choice - and shoot a 30 second vertical today."}
    top = max(recent, key=_reel_score)
    topic = top.get("topic", "your recent winner")
    if not anthropic_client:
        return {"suggestion": f"Your top post was on '{topic}'. Make another one in the same vein this week.", "top_topic": topic}
    try:
        summary = (
            f"Sandhya's top Instagram reel in the last 21 days was about '{topic}' "
            f"({top.get('views', 0)} views, {top.get('saves', 0)} saves, +{top.get('new_followers', 0)} followers). "
            "Give her ONE specific content suggestion for this week based on this winner. "
            "Return JSON per your schema. The reply should be a single sentence with a concrete shoot idea. No actions."
        )
        raw = _call_anthropic(MEERA_SYSTEM, [{"role": "user", "content": summary}])
        parsed = _parse_meera_json(raw)
        return {"suggestion": (parsed.get("reply") or raw).strip(), "top_topic": topic}
    except Exception:
        return {"suggestion": f"Your top post was '{topic}'. Do one more in that lane this week.", "top_topic": topic}


# =========================================================================
# Progress — weekly effort score + Meera verdict
# =========================================================================
MOOD_SCORES = {"🌸": 4, "🔥": 5, "🌧": 2, "🌪": 2, "💛": 5}

def mood_to_number(mood: Optional[str]) -> Optional[int]:
    if not mood: return None
    for k, v in MOOD_SCORES.items():
        if k in mood: return v
    return 3

@api_router.get("/progress/weekly")
async def progress_weekly():
    today = date.today()
    start = today - timedelta(days=6)
    start_iso = start.isoformat()

    fit_logs = await db.fitness_logs.find({"date": {"$gte": start_iso}}, {"_id": 0}).to_list(500)
    gym_sessions = len({f["date"] for f in fit_logs})

    projects = await db.firm_projects.find({}, {"_id": 0}).to_list(500)
    stithi_moves = 0
    for p in projects:
        ua = p.get("updated_at", "")
        try:
            if ua and datetime.fromisoformat(ua.replace("Z", "+00:00")).date() >= start:
                stithi_moves += 1
        except Exception: pass

    prio = await db.priorities.find({"date": {"$gte": start_iso}}, {"_id": 0}).to_list(500)
    prio_done = sum(1 for p in prio if p.get("done"))
    prio_total = len(prio)

    reels = await db.reels.find({"date": {"$gte": start_iso}}, {"_id": 0}).to_list(200)
    reels_count = len(reels)

    cycle_logs = await db.cycle_logs.find({"date": {"$gte": start_iso}}, {"_id": 0}).to_list(200)
    mood_values = [m for m in (mood_to_number(cl.get("mood")) for cl in cycle_logs) if m is not None]
    mood_avg = sum(mood_values) / len(mood_values) if mood_values else None

    mood_by_day = []
    for i in range(7):
        d = (start + timedelta(days=i)).isoformat()
        day_m = [mood_to_number(cl.get("mood")) for cl in cycle_logs if cl["date"] == d]
        day_m = [x for x in day_m if x is not None]
        mood_by_day.append({"date": d, "score": (sum(day_m) / len(day_m)) if day_m else None})

    wg = await db.watch_goals.find({"date": {"$gte": start_iso}}, {"_id": 0}).to_list(20)
    water_days = sum(1 for w in wg if (w.get("water_glasses") or 0) >= 6)
    nutrition_notes = await db.nutrition_notes.find({"date": {"$gte": start_iso}}, {"_id": 0}).to_list(100)
    nutrition_days = len({n["date"] for n in nutrition_notes})

    gym_pts = 3 if gym_sessions >= 4 else (2 if gym_sessions >= 3 else (1 if gym_sessions >= 1 else 0))
    stithi_pts = 2 if stithi_moves >= 3 else (1 if stithi_moves >= 1 else 0)
    reels_pts = 2 if reels_count >= 2 else (1 if reels_count >= 1 else 0)
    mood_pts = 1 if (mood_avg is not None and mood_avg >= 3.5) else 0
    water_pts = 1 if water_days >= 3 else 0
    nutrition_pts = 1 if nutrition_days >= 3 else 0
    score = gym_pts + stithi_pts + reels_pts + mood_pts + water_pts + nutrition_pts

    return {
        "week_start": start_iso, "week_end": today.isoformat(),
        "effort_score": score, "max_score": 10,
        "breakdown": {
            "gym":       {"value": gym_sessions, "target": 5,   "points": gym_pts,       "max": 3, "label": "Gym sessions"},
            "stithi":    {"value": stithi_moves, "target": 3,   "points": stithi_pts,    "max": 2, "label": "Stithi moves"},
            "reels":     {"value": reels_count,  "target": 2,   "points": reels_pts,     "max": 2, "label": "Reels posted"},
            "mood":      {"value": round(mood_avg, 1) if mood_avg else None, "target": 3.5, "points": mood_pts, "max": 1, "label": "Mood avg"},
            "water":     {"value": water_days,   "target": 3,   "points": water_pts,     "max": 1, "label": "Water ≥6 glasses"},
            "nutrition": {"value": nutrition_days,"target": 3,  "points": nutrition_pts, "max": 1, "label": "Meal logged"},
        },
        "priorities_done": prio_done, "priorities_total": prio_total,
        "mood_by_day": mood_by_day,
    }

@api_router.get("/progress/meera_verdict")
async def meera_verdict():
    w = await progress_weekly()
    b = w["breakdown"]
    gym = b["gym"]["value"]; stithi = b["stithi"]["value"]; reels = b["reels"]["value"]
    mood = b["mood"]["value"]; score = w["effort_score"]
    facts = f"Gym sessions: {gym}/5. Stithi moves: {stithi}. Reels posted: {reels}. Mood avg: {mood}. Effort score: {score}/10."
    if not anthropic_client:
        return {"verdict": facts, "effort_score": score, "max_score": 10}
    try:
        prompt = (
            "Give Sandhya ONE honest sentence (max two) about her week based on: " + facts +
            " Encourage effort, don't flatter. If something was low, name it without shaming. "
            "Return JSON per your schema with no actions."
        )
        raw = _call_anthropic(MEERA_SYSTEM, [{"role": "user", "content": prompt}])
        parsed = _parse_meera_json(raw)
        return {"verdict": (parsed.get("reply") or raw).strip(), "effort_score": score, "max_score": 10}
    except Exception:
        return {"verdict": facts, "effort_score": score, "max_score": 10}


# =========================================================================
# Daily inspiration + seed
# =========================================================================
QUOTES = [
    "Steady. Stithi means stability — you are building it brick by brick.",
    "Your softness is not weakness. It is the way you design beautiful things.",
    "Cold leads warm up. Always. Keep showing up.",
    "32 days is not a delay. It is your rhythm.",
    "Today's 18kg is tomorrow's 30kg. The body remembers every set.",
    "An architect designs space; a woman like you designs a life.",
    "The marigolds in every Chennai courtyard know — beauty grows in heat.",
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
    return {"quote": QUOTES[today.toordinal() % len(QUOTES)],
            "nutrition_tip": NUTRITION_TIPS[today.toordinal() % len(NUTRITION_TIPS)]}

@api_router.post("/seed")
async def seed():
    if await db.firm_projects.count_documents({}) == 0:
        for s in [
            {"name": "Avadi Farmhouse", "status": "warm_lead", "value": "₹15L design fee", "next_action": "Send revised concept boards"},
            {"name": "Bangalore Farmhouse", "status": "active", "value": "First paid project", "next_action": "Site visit Saturday"},
            {"name": "Kerala Cottage", "status": "cold_lead", "value": "TBD", "next_action": "Follow-up call after Pongal"},
            {"name": "Guest House — Steel Co", "status": "warm_lead", "value": "~100 keys", "next_action": "Prepare capability deck"},
        ]:
            await db.firm_projects.insert_one(FirmProject(**s).dict())
    return {"seeded": True}

@app.on_event("startup")
async def on_startup():
    if await db.firm_projects.count_documents({}) == 0:
        await seed()

# ---------- mount ----------
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
