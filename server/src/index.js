import "dotenv/config";
import express from "express";
import cors from "cors";
import { runTurn } from "./orchestrator.js";

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api/classroom/turn', async (req, res) => {
  const body = req.body || {};
  const {
    mode = 'learner',
    scenario = 'tech_interview',
    action,
    session = {},
    userText,
    userInput,
  } = body;

  const fallbackAction = action || (session?.turnIndex ? 'user_turn' : 'start');
  const fallbackUserText = typeof userText === 'string' ? userText : (typeof userInput === 'string' ? userInput : '');

  try {
    const result = await runTurn({
      mode,
      scenario,
      action: fallbackAction,
      session,
      userText: fallbackUserText,
    });
    res.json(result);
  } catch {
    res.json({
      session,
      turns: [{ speaker: 'Teacher', role: 'teacher', text: 'Something went wrong on this turn. Please try again.' }],
      feedback: {
        confidence: 60,
        clarity: 60,
        vocabulary: 60,
        level: 'B1',
        tips: ['Retry your response in 2-3 concise sentences.'],
        grammarIssues: ['Could not evaluate this turn'],
      },
      liveTip: 'Service recovered with fallback response.',
      evaluation: { stage: 'unknown', isRelevant: false, issues: ['Could not evaluate this turn'] },
    });
  }
});

app.listen(port, () => {
  console.log(`AI Classroom API running on http://localhost:${port}`);
});
