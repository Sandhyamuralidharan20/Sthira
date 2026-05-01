"""Iteration 2 tests: Meera agentic behavior, tone, voice endpoint, nutrition."""
import os
import re
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://sandhya-daily.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ENDEARMENTS = ["kanna", "darling", "sweetheart", "babe", " love ", "honey", "dear ", " dear,"]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _no_endearments(reply: str):
    low = " " + reply.lower() + " "
    found = [w for w in ENDEARMENTS if w in low]
    return found


# ---------- Meera agentic: 3 actions in one message ----------
def test_meera_agentic_three_actions(s):
    # Use a unique location each run to avoid Meera's "already logged" dedup
    import uuid as _uuid
    loc = f"TEST{_uuid.uuid4().hex[:6].upper()}"
    msg = (f"Got a brand new enquiry today from a client about an office space in {loc}, "
           f"did 20 min treadmill, and ate paneer wrap for lunch")
    r = s.post(f"{API}/meera/chat", json={"message": msg, "session_id": f"TEST_iter2_{loc}"}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    reply = d.get("reply", "")
    actions = d.get("actions", [])

    # reply should be plain text, NOT JSON
    assert reply and not reply.strip().startswith("{"), f"Reply looks like JSON: {reply[:100]}"

    # Must have 3 actions, all ok
    assert len(actions) >= 3, f"Expected >=3 actions, got {len(actions)}: {actions}"
    types = [a.get("type") for a in actions]
    assert "add_project" in types
    assert "log_workout" in types
    assert "log_meal" in types
    for a in actions:
        assert a.get("ok") is True, f"Action failed: {a}"

    # Brand new location persisted as warm_lead
    r2 = s.get(f"{API}/firm/projects", timeout=15)
    assert r2.status_code == 200
    projects = r2.json()
    matched = [p for p in projects if loc.lower() in p["name"].lower()]
    assert matched, f"{loc} project not found in firm/projects"
    assert any(p["status"] == "warm_lead" for p in matched), f"{loc} not warm_lead: {matched}"

    # paneer wrap in nutrition
    r3 = s.get(f"{API}/nutrition", timeout=15)
    assert r3.status_code == 200
    notes = r3.json()
    assert any("paneer" in (n.get("text") or "").lower() for n in notes), f"paneer wrap not in nutrition: {notes[:5]}"

    # voice/workout log
    r4 = s.get(f"{API}/fitness/logs", timeout=15)
    assert r4.status_code == 200
    logs = r4.json()
    assert any(l.get("day_key") == "voice_log" or "treadmill" in (l.get("exercise","").lower()) for l in logs), \
        "Workout log from agentic action not found"


# ---------- Meera tone: emotional message, no endearments, no actions ----------
def test_meera_emotional_no_actions(s):
    msg = "I feel overwhelmed and don't know where to start"
    r = s.post(f"{API}/meera/chat", json={"message": msg, "session_id": "TEST_iter2_emotion"}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    reply = d.get("reply", "")
    actions = d.get("actions", [])
    assert reply
    assert len(actions) == 0, f"Expected zero actions for emotional msg, got: {actions}"
    found = _no_endearments(reply)
    assert not found, f"Reply contains endearments {found}: {reply}"


# ---------- Meera off-topic: redirect, no actions ----------
def test_meera_offtopic_redirect(s):
    msg = "what do you think about Virat Kohli"
    r = s.post(f"{API}/meera/chat", json={"message": msg, "session_id": "TEST_iter2_offtopic"}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    reply = d.get("reply", "")
    actions = d.get("actions", [])
    assert reply
    assert len(actions) == 0, f"Expected zero actions for off-topic, got: {actions}"
    found = _no_endearments(reply)
    assert not found, f"Reply contains endearments {found}: {reply}"


# ---------- Meera completion: complete_priority emitted ----------
def test_meera_complete_priority(s):
    msg = "I finished drafting the Avadi boards"
    r = s.post(f"{API}/meera/chat", json={"message": msg, "session_id": "TEST_iter2_complete"}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    actions = d.get("actions", [])
    types = [a.get("type") for a in actions]
    assert "complete_priority" in types, f"complete_priority not attempted: {actions}"


# ---------- Meera voice endpoint exists ----------
def test_meera_voice_empty(s):
    # Empty bytes payload via multipart
    files = {"audio": ("voice.webm", b"", "audio/webm")}
    headers = {}  # don't use json headers
    r = requests.post(f"{API}/meera/voice", files=files, headers=headers, timeout=30)
    assert r.status_code == 400, f"Expected 400 on empty audio, got {r.status_code}: {r.text}"
    assert "Empty audio" in r.text or "empty" in r.text.lower()


# ---------- Nutrition GET/POST ----------
def test_nutrition_post_get(s):
    r = s.post(f"{API}/nutrition", json={"text": "TEST_iter2_meal_curd_rice"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["text"] == "TEST_iter2_meal_curd_rice"
    nid = d["id"]
    r = s.get(f"{API}/nutrition", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert any(n["id"] == nid for n in items), "Nutrition note not persisted"
