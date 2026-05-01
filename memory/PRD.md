# Sthira - Personal Wellness App for Sandhya

## Overview
Sthira is a personal wellness app for Sandhya, a 26-year-old architect from Chennai. Single-user app (no auth). Warm fuchsia/marigold/terracotta palette, Fraunces serif headings, marigold celebration animations.

## Architecture
- **Backend**: FastAPI + MongoDB at `/app/backend/server.py`
- **Frontend**: Expo Router (React Native) at `/app/frontend/app/`
- **AI**: Claude Sonnet 4.5 via Emergent Universal LLM key (`emergentintegrations`)

## Navigation (7 tabs delivered via 5+3 hybrid)
Bottom tabs: Today · Planner · Fitness · Cycle · More
"More" tab opens Firm, Progress, Mind as modal screens.

## Features
- **Today**: Daily quote (rotates), cycle phase indicator, 3 priorities checklist, nutrition tip, watch goals (steps/water/sleep with +/-)
- **Planner**: Monthly calendar grid, day-events with categories (personal/work/fitness/cycle)
- **Fitness**: 5-day PPL split with exact weights (Mon Push, Tue Pull, Wed Legs G+H, Thu Push, Fri Legs Q+C). Tap to log a set, marigold burst on completion.
- **Firm**: Stithi Architects pipeline (Active / Warm Lead / Cold Lead / Completed). Tap card to cycle status. Pre-seeded with Avadi Farmhouse, Bangalore Farmhouse, Kerala Cottage, Steel Co Guest House.
- **Cycle**: 32-day rhythm tracker with 4 phases (menstrual/follicular/ovulation/luteal). User sets last period start. Daily flow/symptoms/mood log.
- **Progress**: Hero week-stat, 6 measurement fields with sparklines, recent entries.
- **Mind**: Distraction-free brain dump with timestamped entries.
- **Meera**: Floating chat bubble (always visible). Claude Sonnet 4.5 powered, persona = Sandhya's future successful self, warm Indian sister tone.
- **Marigold celebration**: Custom Reanimated burst on priority + workout completion.

## Backend Endpoints
- `/api/inspiration` — daily quote + nutrition tip
- `/api/priorities` (GET, POST, PATCH, DELETE)
- `/api/watch-goals` (GET, PATCH)
- `/api/planner` (GET, POST, DELETE)
- `/api/fitness/program` (GET program), `/api/fitness/logs` (GET, POST)
- `/api/firm/projects` (GET, POST, PATCH, DELETE)
- `/api/cycle` (GET, PUT), `/api/cycle/logs` (GET, POST)
- `/api/measurements` (GET, POST)
- `/api/mind` (GET, POST, DELETE)
- `/api/meera/chat` (POST), `/api/meera/messages` (GET)

## Data
- MongoDB collections: priorities, watch_goals, planner_events, fitness_logs, firm_projects, cycle_settings, cycle_logs, measurements, mind_entries, chat_messages
- Auto-seeds 4 Stithi projects on first startup.

## Design
- Colors: bg #FDFBF7, fuchsia #D81159, kumkum #B9123D, marigold #FF9F1C, saffron #FFB703, terracotta #E2725B
- Fonts: Fraunces (headings, italics), Manrope (body)
