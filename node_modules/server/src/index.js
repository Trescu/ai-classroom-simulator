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
  const { mode = 'learner', scenario = 'interview', turn = 0, transcript = [], userInput = '' } = req.body || {};
  const result = await runTurn({ mode, scenario, turn, transcript, userInput });
  res.json(result);
});

app.listen(port, () => {
  console.log(`AI Classroom API running on http://localhost:${port}`);
});
