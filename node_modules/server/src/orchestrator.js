import OpenAI from "openai";
import { AGENTS, SCENARIOS, pickPrompt } from "./agents.js";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function heuristicFeedback(text = "") {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const fillerCount = (text.match(/\b(um|uh|like|actually|maybe)\b/gi) || []).length;
  const longWords = words.filter((w) => w.length > 7).length;
  const confidence = Math.max(40, Math.min(98, 68 + words.length - fillerCount * 4));
  const clarity = Math.max(30, Math.min(95, 72 - fillerCount * 8 + Math.floor(words.length / 4)));
  const vocabulary = Math.max(35, Math.min(96, 55 + longWords * 4));

  return {
    confidence,
    clarity,
    vocabulary,
    level: vocabulary > 75 ? "B2" : "B1",
    tips: [
      fillerCount > 1 ? "Reduce filler words and use shorter pauses." : "Good pacing. Add one stronger closing sentence.",
      "Include one concrete impact metric (e.g., improved speed by 20%).",
      "Use STAR structure: Situation, Task, Action, Result.",
    ],
    grammarIssues: fillerCount > 0 ? ["Filler words", "Verb tense consistency"] : ["Article usage", "Sentence variety"],
  };
}

function mockTurns(mode, scenario, userInput, turn) {
  if (turn === 0) {
    return [
      {
        speaker: AGENTS.teacher.name,
        role: "teacher",
        text: (SCENARIOS[scenario] || SCENARIOS.interview).opener,
      },
    ];
  }

  if (mode === "teacher") {
    return [
      { speaker: "Alex", role: "classmate", text: "I built a campus event app and improved retention by 18% after weekly user interviews." },
      { speaker: "Sofia", role: "classmate", text: "I... used to be shy in presentations, but now I practice daily and speak more clearly." },
      { speaker: "Jamal", role: "classmate", text: "I made chatbot for students. It help answer FAQ fast and save teacher time." },
    ];
  }

  return [
    {
      speaker: "Teacher",
      role: "teacher",
      text: `Strong start. Follow-up: ${userInput ? "can you give one measurable achievement" : "tell us about your biggest challenge"}?`,
    },
    {
      speaker: "Alex",
      role: "classmate",
      text: "Nice answer — adding numbers will make it even more convincing.",
    },
  ];
}

async function llmTurns({ mode, scenario, transcript, userInput }) {
  const prompt = pickPrompt(mode, scenario, transcript, userInput);
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You orchestrate a classroom simulation. Output JSON: { turns: [{speaker, role, text}], liveTip }. Keep lines concise and natural.",
      },
      { role: "user", content: prompt },
    ],
  });

  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  return {
    turns: parsed.turns || [],
    liveTip: parsed.liveTip || "Add one concrete example to support your point.",
  };
}

export async function runTurn({ mode, scenario, turn, transcript, userInput }) {
  const flatTranscript = transcript.map((m) => `${m.speaker}: ${m.text}`).slice(-10).join("\n");
  const feedback = heuristicFeedback(userInput);

  if (!client) {
    return {
      turns: mockTurns(mode, scenario, userInput, turn),
      feedback,
      liveTip: feedback.tips[0],
    };
  }

  try {
    const ai = await llmTurns({ mode, scenario, transcript: flatTranscript, userInput });
    return {
      turns: ai.turns.length ? ai.turns : mockTurns(mode, scenario, userInput, turn),
      feedback,
      liveTip: ai.liveTip,
    };
  } catch {
    return {
      turns: mockTurns(mode, scenario, userInput, turn),
      feedback,
      liveTip: feedback.tips[0],
    };
  }
}
