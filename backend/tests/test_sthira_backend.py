"""Sthira backend API tests"""
import os
import requests
import pytest
from datetime import date

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://sandhya-daily.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TODAY = date.today().isoformat()


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Inspiration ----------
def test_inspiration(s):
    r = s.get(f"{API}/inspiration", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "quote" in d and "nutrition_tip" in d
    assert isinstance(d["quote"], str) and len(d["quote"]) > 0


# ---------- Priorities CRUD ----------
def test_priorities_crud(s):
    r = s.post(f"{API}/priorities", json={"text": "TEST_priority", "date": TODAY}, timeout=15)
    assert r.status_code == 200
    pid = r.json()["id"]
    r = s.get(f"{API}/priorities", params={"date": TODAY}, timeout=15)
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())
    r = s.patch(f"{API}/priorities/{pid}", json={"done": True}, timeout=15)
    assert r.status_code == 200
    assert r.json()["done"] is True
    r = s.delete(f"{API}/priorities/{pid}", timeout=15)
    assert r.status_code == 200


# ---------- Watch Goals ----------
def test_watch_goals(s):
    r = s.get(f"{API}/watch-goals", params={"date": TODAY}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["date"] == TODAY
    r = s.patch(f"{API}/watch-goals", params={"date": TODAY}, json={"steps": 5000, "water_glasses": 4, "sleep_hours": 7.5}, timeout=15)
    assert r.status_code == 200
    assert r.json()["steps"] == 5000
    assert r.json()["water_glasses"] == 4


# ---------- Planner ----------
def test_planner(s):
    r = s.post(f"{API}/planner", json={"date": TODAY, "title": "TEST_event", "category": "personal"}, timeout=15)
    assert r.status_code == 200
    eid = r.json()["id"]
    month = TODAY[:7]
    r = s.get(f"{API}/planner", params={"month": month}, timeout=15)
    assert r.status_code == 200
    assert any(e["id"] == eid for e in r.json())
    r = s.delete(f"{API}/planner/{eid}", timeout=15)
    assert r.status_code == 200


# ---------- Fitness ----------
def test_fitness_program(s):
    r = s.get(f"{API}/fitness/program", timeout=15)
    assert r.status_code == 200
    prog = r.json()
    for k in ["mon_push", "tue_pull", "wed_legs", "thu_push", "fri_legs"]:
        assert k in prog
    # specific weights
    wed = {e["name"]: e for e in prog["wed_legs"]["exercises"]}
    assert wed["Deadlift"]["weight_kg"] == 55
    assert wed["Hip Thrust (Barbell)"]["weight_kg"] == 20
    mon = {e["name"]: e for e in prog["mon_push"]["exercises"]}
    assert mon["Machine Chest Press"]["weight_kg"] == 18
    tue = {e["name"]: e for e in prog["tue_pull"]["exercises"]}
    assert tue["Lat Pulldown"]["weight_kg"] == 25
    fri = {e["name"]: e for e in prog["fri_legs"]["exercises"]}
    assert fri["Goblet Squat"]["weight_kg"] == 25


def test_fitness_logs(s):
    r = s.post(f"{API}/fitness/logs", json={"day_key": "mon_push", "exercise": "Machine Chest Press", "weight_kg": 18, "sets": 4, "reps": 10}, timeout=15)
    assert r.status_code == 200
    r = s.get(f"{API}/fitness/logs", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Firm ----------
def test_firm_seeded(s):
    r = s.get(f"{API}/firm/projects", timeout=15)
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    for expected in ["Avadi Farmhouse", "Bangalore Farmhouse", "Kerala Cottage", "Guest House — Steel Co"]:
        assert expected in names, f"Missing seed: {expected}"


def test_firm_crud(s):
    r = s.post(f"{API}/firm/projects", json={"name": "TEST_Project", "status": "warm_lead"}, timeout=15)
    assert r.status_code == 200
    pid = r.json()["id"]
    r = s.patch(f"{API}/firm/projects/{pid}", json={"status": "active"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "active"
    r = s.delete(f"{API}/firm/projects/{pid}", timeout=15)
    assert r.status_code == 200


# ---------- Cycle ----------
def test_cycle_get_put(s):
    r = s.get(f"{API}/cycle", timeout=15)
    assert r.status_code == 200, f"GET /cycle failed: {r.text}"
    d = r.json()
    assert "cycle_length" in d
    r = s.put(f"{API}/cycle", json={"last_period_start": TODAY, "cycle_length": 32, "period_length": 5}, timeout=15)
    assert r.status_code == 200
    r = s.get(f"{API}/cycle", timeout=15)
    assert r.json()["last_period_start"] == TODAY


def test_cycle_logs(s):
    r = s.post(f"{API}/cycle/logs", json={"date": TODAY, "flow": "light", "symptoms": ["cramps"], "mood": "ok"}, timeout=15)
    assert r.status_code == 200
    r = s.get(f"{API}/cycle/logs", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- Measurements ----------
def test_measurements(s):
    r = s.post(f"{API}/measurements", json={"weight_kg": 60.5, "waist_cm": 72.0}, timeout=15)
    assert r.status_code == 200
    r = s.get(f"{API}/measurements", timeout=15)
    assert r.status_code == 200


# ---------- Mind ----------
def test_mind_crud(s):
    r = s.post(f"{API}/mind", json={"text": "TEST_mind"}, timeout=15)
    assert r.status_code == 200
    mid = r.json()["id"]
    r = s.get(f"{API}/mind", timeout=15)
    assert any(m["id"] == mid for m in r.json())
    r = s.delete(f"{API}/mind/{mid}", timeout=15)
    assert r.status_code == 200


# ---------- Meera ----------
def test_meera_chat(s):
    r = s.post(f"{API}/meera/chat", json={"message": "Hi Meera, quick check.", "session_id": "TEST_session"}, timeout=90)
    assert r.status_code == 200, f"Meera chat failed: {r.text}"
    d = r.json()
    assert "reply" in d and isinstance(d["reply"], str) and len(d["reply"]) > 0
    r = s.get(f"{API}/meera/messages", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) >= 2
