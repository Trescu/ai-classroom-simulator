# AI Classroom Simulator

Hackathon-ready multi-agent classroom simulation for language learning and interview practice.

## Step 1 — Architecture (fastest demo architecture)

### Frontend (React + Vite + Tailwind)
- Single-page app with glassmorphism classroom layout.
- Chat timeline for turn-by-turn conversation.
- Voice-first UX:
  - Speech-to-text via browser `SpeechRecognition` API.
  - Text-to-speech via browser `speechSynthesis` API.
- Right-side performance coach panel with live metrics and tips.
- Mode toggle: **Learner** and **Teacher**.

### Backend (Node + Express)
- Lightweight API with one core endpoint:
  - `POST /api/classroom/turn` returns multi-agent turns + live feedback.
- Orchestrator service:
  - Maintains role prompts (Teacher, Alex, Sofia, Jamal).
  - Produces turn responses from OpenAI when API key exists.
  - Falls back to deterministic mock generation when no key (demo-safe).
- Heuristic live scoring for confidence, clarity, vocabulary, and grammar hints.

### Agent orchestration
- Turn engine decides who speaks based on mode:
  - **Learner mode**: Teacher speaks first, then one classmate reaction.
  - **Teacher mode**: Alex → Sofia → Jamal respond to user-teacher prompt.
- Every turn returns:
  - `turns[]` (speaker, role, text)
  - `feedback` object
  - `liveTip`

### API usage
- OpenAI Chat Completions with JSON output for structured turns.
- Environment-driven model selection (`OPENAI_MODEL`, default `gpt-4o-mini`).

## Step 2 — MVP feature list (judge-impact minimum)
1. Multi-agent classroom with visible personas.
2. Start class + Next turn controls.
3. Learner mode + Teacher mode switching.
4. Voice input + AI voice playback.
5. Real-time feedback panel (confidence/clarity/vocabulary/grammar).
6. Visual wow: modern immersive UI inspired by provided mock.
7. Works even without API key (mock fallback).

## Step 3 — Build plan (implementation order)
1. UI shell and chat/coach layout.
2. Backend endpoint and orchestrator contract.
3. Multi-agent response logic for both modes.
4. Speech input/output integration.
5. Feedback heuristics + polish (animations, speaking indicators, microcopy).

## Step 4 — Code layout

```text
.
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── styles.css
│   │   └── components/
│   │       ├── ChatMessage.jsx
│   │       └── FeedbackPanel.jsx
│   └── ...vite/tailwind config
├── server/
│   └── src/
│       ├── index.js
│       ├── agents.js
│       └── orchestrator.js
└── package.json (workspace + dev scripts)
```

## Step 5 — Multi-agent turn logic

### Learner mode
1. `Start Class` -> Teacher opens scenario.
2. User responds (voice/text).
3. Backend returns:
   - Teacher follow-up question.
   - One classmate reaction.
4. Feedback panel updates with new coaching tip.

### Teacher mode
1. User acts as teacher and sends prompt.
2. Backend generates ordered class responses:
   - Alex (confident)
   - Sofia (hesitant)
   - Jamal (energetic with minor grammar issues)
3. Live feedback guides how user-teacher can improve elicitation and instruction.

## Step 6 — 2-minute judge demo flow
1. **0:00–0:20**: “This is an AI classroom where you practice real speaking with multiple AI personas.” Press **Start Class**.
2. **0:20–0:50**: Teacher asks opening interview question; AI voice reads it aloud.
3. **0:50–1:15**: Answer with microphone, show speech-to-text working live.
4. **1:15–1:35**: AI returns teacher follow-up + peer reaction; panel updates confidence/clarity + grammar tips in real time.
5. **1:35–1:55**: Switch to **Teacher Mode** and prompt the class. Alex/Sofia/Jamal respond with distinct styles.
6. **1:55–2:00**: Close with “Multi-agent + real-time coaching + voice-first = scalable future classroom.”

---

## Quick Start

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

Optional `.env` in `server/`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
PORT=8787
```

Without an API key, the app uses a deterministic mock fallback so the hackathon demo still works.
