# Sthira — Personal Wellness App for Sandhya

## Overview
Single-user wellness + ops app for Sandhya (26, architect, Chennai). Warm fuchsia/marigold/terracotta palette, Fraunces serif headings, marigold celebration animations.

## Architecture
- **Backend**: FastAPI + MongoDB at `/app/backend/server.py`
- **Frontend**: Expo Router (React Native) at `/app/frontend/app/`
- **AI**: Claude Sonnet 4.5 + OpenAI whisper-1 via Emergent Universal LLM key (`emergentintegrations`)

## Navigation
Bottom tabs: Today · Planner · Fitness · Cycle · More.
"More" tab opens Firm, Progress, Reels, Mind as modal screens.

## Features
- **Today**: Daily quote, cycle phase, 3 priorities, nutrition tip, watch goals (steps/water/sleep).
- **Planner**: Monthly calendar with multi-coloured category dots (fuchsia=Gym auto Mon–Fri, orange=Firm, purple=Content, green=AECOM, gold=Personal). Tap date for agenda + auto-gym card on weekdays.
- **Fitness**: 5-day PPL split with exact weights; tap exercise to log a set + marigold burst.
- **Firm**: Stithi Architects pipeline with status cycling. Seeded with 4 projects.
- **Cycle**: 32-day rhythm tracker, 4 phases, daily flow/symptoms/mood log.
- **Progress (redesigned overall-life dashboard)**:
  - **Meera verdict** at top (1-sentence honest take) + **Weekly Effort Score N/10**.
  - Breakdown tiles (Gym /5, Stithi moves, Reels posted, Mood avg, Water days ≥6 glasses, Nutrition days).
  - 7-day mood bar graph from cycle mood logs.
  - Priorities completed this week.
  - Measurements grid with sparklines.
- **Reels (Marketing tracker)**:
  - Log per reel: date, topic, views, saves, shares, new_followers.
  - 7-day views bar chart.
  - **Content streak** — days since last post; calls out silence 3+ days.
  - **Meera suggestion** — LLM picks top performer and proposes a single shoot idea for the week.
  - Every reel auto-mirrors into Planner as a `content` event → shows up as purple dots.
- **Mind**: Distraction-free timestamped journal.
- **Meera (agentic chat + voice)**: Floating lily-glyph FAB. Persona = confident 31-yo future-Sandhya, principal of Stithi, married to her cricketer. Tone: direct, "Sandhya" only, zero endearments.
  - Text or voice input (whisper-1).
  - Auto-actions per message: add_project, log_workout, log_meal, complete_priority (multi-action supported).
  - Stressed/overwhelmed/sad → acknowledges then redirects, no actions. Off-topic → redirects firmly.
  - Per-session chat history isolation.

## Backend Endpoints
- `/api/inspiration`, `/api/priorities`, `/api/watch-goals`, `/api/planner`
- `/api/fitness/program`, `/api/fitness/logs`
- `/api/firm/projects`
- `/api/cycle`, `/api/cycle/logs`
- `/api/measurements`, `/api/mind`, `/api/nutrition`
- `/api/reels`, `/api/reels/analytics`, `/api/reels/meera_suggestion`
- `/api/progress/weekly`, `/api/progress/meera_verdict`
- `/api/meera/chat`, `/api/meera/voice`, `/api/meera/messages`

## Data
- MongoDB collections: priorities, watch_goals, planner_events, fitness_logs, firm_projects, cycle_settings, cycle_logs, measurements, mind_entries, nutrition_notes, reels, chat_messages.
- Firm auto-seeds 4 Stithi projects on startup.

## Design
- Colors: bg #FDFBF7, fuchsia #D81159, kumkum #B9123D, marigold #FF9F1C, saffron #FFB703, terracotta #E2725B, content-purple #8E44AD, aecom-green #2E8B57.
- Fonts: Fraunces (headings + italic), Manrope (body).
