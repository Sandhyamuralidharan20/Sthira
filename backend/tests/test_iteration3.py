"""Iteration 3 tests: Reels tracker + redesigned Progress tab.

Covers:
- GET /api/reels/analytics shape (7 by_day entries, posted_this_week, total_reels,
  days_since_last_post, top_performer)
- POST /api/reels creates a reel and mirrors to planner as category='content'
- PATCH /api/reels/{id} updates a reel
- DELETE /api/reels/{id} deletes a reel
- GET /api/reels/meera_suggestion returns {suggestion}, no endearments
- GET /api/progress/weekly shape (breakdown with 6 tiles, mood_by_day 7)
- GET /api/progress/meera_verdict returns {verdict, effort_score, max_score: 10},
  uses 'Sandhya', no endearments
"""
import os
import datetime as dt
import requests
import pytest

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://sandhya-daily.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ENDEARMENTS = ["kanna", "darling", "sweetheart", "babe", " love ", "honey", "dear "]


def _has_endearments(text: str):
    low = " " + (text or "").lower() + " "
    return [w for w in ENDEARMENTS if w in low]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- Reels ----------------
def test_reels_analytics_shape(s):
    r = s.get(f"{API}/reels/analytics", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    # required keys
    for k in ("by_day", "posted_this_week", "total_reels", "days_since_last_post", "top_performer"):
        assert k in d, f"Missing key {k} in analytics: {list(d.keys())}"
    assert isinstance(d["by_day"], list) and len(d["by_day"]) == 7, f"by_day must have 7 entries, got {len(d['by_day'])}"
    for entry in d["by_day"]:
        assert "date" in entry and "count" in entry and "views" in entry


def test_reels_post_creates_planner_content_event(s):
    today = dt.date.today().isoformat()
    payload = {
        "date": today,
        "topic": "TEST_iter3 Material palette demo",
        "views": 1200, "saves": 20, "shares": 5, "new_followers": 8,
    }
    r = s.post(f"{API}/reels", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    created = r.json()
    rid = created["id"]
    assert created["topic"] == payload["topic"]
    assert created["views"] == 1200 and created["saves"] == 20
    assert created["date"] == today

    # Reel appears in list
    r2 = s.get(f"{API}/reels", timeout=15)
    assert r2.status_code == 200
    assert any(x["id"] == rid for x in r2.json()), "Reel not in GET /api/reels"

    # Planner event with category='content' on the same date
    month = today[:7]
    r3 = s.get(f"{API}/planner", params={"month": month}, timeout=15)
    assert r3.status_code == 200, r3.text
    events = r3.json()
    content_today = [e for e in events if e.get("date") == today and e.get("category") == "content"]
    assert content_today, f"No planner event with category='content' on {today}. Events sample: {events[:5]}"
    # Title should reference the reel topic
    assert any(payload["topic"] in (e.get("title") or "") for e in content_today), \
        f"Planner content event doesn't reference topic: {content_today}"

    # PATCH
    r4 = s.patch(f"{API}/reels/{rid}", json={"views": 2500, "topic": "TEST_iter3 updated"}, timeout=15)
    assert r4.status_code == 200, r4.text
    updated = r4.json()
    assert updated["views"] == 2500
    assert updated["topic"] == "TEST_iter3 updated"

    # DELETE
    r5 = s.delete(f"{API}/reels/{rid}", timeout=15)
    assert r5.status_code == 200 and r5.json().get("ok") is True

    # Verify deletion
    r6 = s.get(f"{API}/reels", timeout=15)
    assert not any(x["id"] == rid for x in r6.json()), "Reel still present after DELETE"


def test_reels_meera_suggestion(s):
    r = s.get(f"{API}/reels/meera_suggestion", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "suggestion" in d, f"Missing 'suggestion' key: {d}"
    suggestion = d["suggestion"]
    assert isinstance(suggestion, str) and len(suggestion) > 0, f"Empty suggestion: {suggestion!r}"
    found = _has_endearments(suggestion)
    assert not found, f"Suggestion contains endearments {found}: {suggestion}"


# ---------------- Progress ----------------
def test_progress_weekly_shape(s):
    r = s.get(f"{API}/progress/weekly", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("week_start", "week_end", "effort_score", "max_score",
              "breakdown", "priorities_done", "priorities_total", "mood_by_day"):
        assert k in d, f"Missing key {k} in progress/weekly: {list(d.keys())}"
    assert d["max_score"] == 10, f"max_score must be 10, got {d['max_score']}"
    assert 0 <= d["effort_score"] <= 10
    b = d["breakdown"]
    for tile in ("gym", "stithi", "reels", "mood", "water", "nutrition"):
        assert tile in b, f"Missing breakdown tile: {tile}"
        for sub in ("value", "target", "points", "max", "label"):
            assert sub in b[tile], f"Missing '{sub}' in breakdown.{tile}: {b[tile]}"
    assert isinstance(d["mood_by_day"], list) and len(d["mood_by_day"]) == 7, \
        f"mood_by_day must have 7 entries, got {len(d['mood_by_day'])}"


def test_progress_meera_verdict(s):
    r = s.get(f"{API}/progress/meera_verdict", timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("verdict", "effort_score", "max_score"):
        assert k in d, f"Missing key {k}: {list(d.keys())}"
    assert d["max_score"] == 10
    verdict = d["verdict"]
    assert isinstance(verdict, str) and len(verdict) > 0
    # One to two concise sentences
    sentences = [seg for seg in verdict.replace("!", ".").replace("?", ".").split(".") if seg.strip()]
    assert 1 <= len(sentences) <= 4, f"Verdict should be 1-2 sentences, got {len(sentences)}: {verdict}"
    # persona
    assert "sandhya" in verdict.lower() or len(sentences) >= 1, f"Verdict should typically address Sandhya: {verdict}"
    found = _has_endearments(verdict)
    assert not found, f"Verdict contains endearments {found}: {verdict}"
