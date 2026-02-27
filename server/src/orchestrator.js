import OpenAI from "openai";
import { stageByIndex } from "./mockEngine.js";
import { normalizeSession, runNextTurn, runStartTurn, runUserTurn } from "./turnController.js";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const CLARIFY_REGEX = /\b(i do not understand|i don't understand|what do you mean|can you explain|nem értem|nem értem a kérdést|magyarázd el|hogy érted)\b/i;
const REFUSE_REGEX = /\b(won't answer|prefer not|skip|nem akarok)\b/i;
const OFFTOPIC_HINT_REGEX = /\b(color|pizza|movie|music|cat|dog)\b/i;
const IMPACT_REGEX = /\b(improved|reduced|increased|faster|impact|result|outcome|saved|boosted)\b/i;

function normalizeScenario(scenario = "tech_interview") {
  if (scenario === "interview") return "tech_interview";
  if (scenario === "language") return "language_class";
  return scenario;
}

function clampDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-5, Math.min(5, Math.round(n)));
}

function heuristicAnalyze({ stage, userText }) {
  const clean = (userText || "").trim();
  const lower = clean.toLowerCase();
  const hasMetric = /\d/.test(lower);
  const hasImpact = IMPACT_REGEX.test(lower);

  if (!clean || clean.length < 6) {
    return {
      intent: "OFFTOPIC",
      isRelevant: false,
      issues: ["Answer is too short."],
      tip: `Stay on topic. Include ${stage.requirementHint}.`,
      teacherResponseStyle: "strict_retry",
      scoreDeltas: { confidence: -1, clarity: -2, vocabulary: 0 },
    };
  }

  if (CLARIFY_REGEX.test(lower)) {
    return {
      intent: "CLARIFY",
      isRelevant: false,
      issues: ["User asked for clarification."],
      tip: `Ask for clarity, then answer with ${stage.requirementHint}.`,
      teacherResponseStyle: "clarify_with_examples",
      scoreDeltas: { confidence: -1, clarity: -1, vocabulary: 0 },
    };
  }

  if (REFUSE_REGEX.test(lower)) {
    return {
      intent: "REFUSE",
      isRelevant: false,
      issues: ["User refused to answer."],
      tip: `Give a short attempt using ${stage.requirementHint}.`,
      teacherResponseStyle: "encourage_retry",
      scoreDeltas: { confidence: -1, clarity: -1, vocabulary: 0 },
    };
  }

  if (stage.id === "achievement" && OFFTOPIC_HINT_REGEX.test(lower) && !hasMetric && !hasImpact) {
    return {
      intent: "OFFTOPIC",
      isRelevant: false,
      issues: ["Off-topic content for achievement question."],
      tip: "Stay on topic. Include a measurable achievement and clear impact.",
      teacherResponseStyle: "strict_retry",
      scoreDeltas: { confidence: -1, clarity: -2, vocabulary: 0 },
    };
  }

  return {
    intent: "ANSWER",
    isRelevant: true,
    issues: [],
    tip: `Focus on ${stage.requirementHint}.`,
    teacherResponseStyle: "answer",
    scoreDeltas: { confidence: 1, clarity: 1, vocabulary: 1 },
  };
}

async function aiAnalyze({ stage, question, userText, history }) {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Classify user intent and grading for interview coaching.",
          "Return strict JSON only with keys:",
          "intent, relevance, hasMetric, hasImpact, issues, suggestedTeacherReply, coachTip, scoreDeltas.",
          "intent must be one of ANSWER|CLARIFY|OFFTOPIC|REFUSE.",
          "scoreDeltas each must be integer in range -5..5.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          stage: stage.id,
          requirementHint: stage.requirementHint,
          question,
          userText,
          history: history.slice(-6),
        }),
      },
    ],
  });

  const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  const intent = ["ANSWER", "CLARIFY", "OFFTOPIC", "REFUSE"].includes(parsed.intent)
    ? parsed.intent
    : "ANSWER";
  return {
    intent,
    isRelevant: Number(parsed.relevance) >= 0.5,
    issues: Array.isArray(parsed.issues) ? parsed.issues.map((x) => String(x)).slice(0, 4) : [],
    tip: parsed.coachTip ? String(parsed.coachTip) : `Focus on ${stage.requirementHint}.`,
    teacherResponseStyle: intent === "CLARIFY" ? "clarify_with_examples" : "answer",
    suggestedTeacherReply: parsed.suggestedTeacherReply ? String(parsed.suggestedTeacherReply) : undefined,
    scoreDeltas: {
      confidence: clampDelta(parsed?.scoreDeltas?.confidence),
      clarity: clampDelta(parsed?.scoreDeltas?.clarity),
      vocabulary: clampDelta(parsed?.scoreDeltas?.vocabulary),
    },
  };
}

export async function analyzeUserMessage({ stage, question, userText, history }) {
  if (!client) {
    return heuristicAnalyze({ stage, userText });
  }

  try {
    return await aiAnalyze({ stage, question, userText, history });
  } catch {
    return heuristicAnalyze({ stage, userText });
  }
}

export async function runTurn({
  mode = "learner",
  scenario = "tech_interview",
  action = "start",
  session = {},
  userText = "",
}) {
  const safeSession = normalizeSession(session);
  normalizeScenario(scenario);

  if (action === "start") {
    return runStartTurn(safeSession);
  }

  if (action === "user_turn") {
    const stage = stageByIndex(safeSession.stageIndex);
    const analysis = await analyzeUserMessage({
      stage,
      question: stage.question,
      userText,
      history: safeSession.history,
    });
    return runUserTurn(safeSession, userText, analysis);
  }

  if (action === "next_turn") {
    return runNextTurn(safeSession);
  }

  return {
    session: safeSession,
    turns: [
      {
        speaker: "Teacher",
        role: "teacher",
        text: mode === "teacher"
          ? "Teacher mode is ready. Ask one clear prompt to continue."
          : "Please respond to the active interview question to continue the class.",
      },
    ],
    feedback: safeSession.coach,
    liveTip: "Keep one clear idea per answer.",
    evaluation: { stage: "unknown", intent: "OFFTOPIC", isRelevant: false, issues: ["Unknown action"] },
  };
}
