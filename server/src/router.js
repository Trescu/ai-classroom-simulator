import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const CLARIFY_REGEX = /\b(i do not understand|i don't understand|what do you mean|can you explain|could you explain|nem ertem|nem ertem a kerdest|magyarazd el|hogy erted)\b/i;
const QUESTION_START_REGEX = /^(what|why|how|when|where|can|could|would|is|are|do|does)\b/i;
const META_REGEX = /\b(how does this work|what is this app|what should i do|is 1 sentence ok|one sentence ok|can i do one sentence|help me)\b/i;
const OFFTOPIC_HINT_REGEX = /\b(color|pizza|movie|music|cat|dog)\b/i;
const IMPACT_REGEX = /\b(improved|reduced|increased|faster|impact|result|outcome|saved|boosted)\b/i;

const TARGETS = ["teacher", "alex", "sofia", "jamal", "class", "unknown"];
const INTENTS = ["ANSWER", "CLARIFICATION", "ASK_CLASSMATE", "META", "OFFTOPIC"];
const ACTIONS = [
  "continue_interview",
  "teacher_clarify_question",
  "peer_reply",
  "teacher_redirect",
  "ask_user_to_answer",
  "handle_meta",
];

function normalizeMessage(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function clampConfidence(value, fallback = 0.65) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function safeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function explicitTarget(lowerText) {
  if (/\balex\b/i.test(lowerText)) return "alex";
  if (/\bsofia\b/i.test(lowerText)) return "sofia";
  if (/\bjamal\b/i.test(lowerText)) return "jamal";
  if (/\bteacher\b/i.test(lowerText)) return "teacher";
  if (/\bclass\b/i.test(lowerText)) return "class";
  return "unknown";
}

function getLastNonUserSpeaker(recentTurns = []) {
  for (let i = recentTurns.length - 1; i >= 0; i -= 1) {
    const role = recentTurns[i]?.role;
    if (role && role !== "user") return role;
  }
  return "unknown";
}

function detectLastTeacherQuestion(recentTurns = [], fallbackQuestion = "") {
  for (let i = recentTurns.length - 1; i >= 0; i -= 1) {
    if (recentTurns[i]?.role === "teacher") return recentTurns[i]?.text || fallbackQuestion;
  }
  return fallbackQuestion;
}

function questionKeywords(currentQuestion = "") {
  const stop = new Set([
    "what", "why", "how", "the", "and", "for", "your", "this", "that", "with", "from", "about", "into", "give",
    "short", "through", "walk", "share", "describe", "should", "hire", "internship", "question",
  ]);
  return currentQuestion
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !stop.has(w));
}

function hasTopicalOverlap(text, currentQuestion) {
  const lower = text.toLowerCase();
  const keys = questionKeywords(currentQuestion);
  if (!keys.length) return true;
  return keys.some((k) => lower.includes(k));
}

function deriveAction(intent, targetAgent) {
  if (intent === "ASK_CLASSMATE") return "peer_reply";
  if (intent === "CLARIFICATION" && ["alex", "sofia", "jamal"].includes(targetAgent)) return "peer_reply";
  if (intent === "CLARIFICATION") return "teacher_clarify_question";
  if (intent === "META") return "handle_meta";
  if (intent === "OFFTOPIC") return "teacher_redirect";
  if (intent === "ANSWER") return "continue_interview";
  return "ask_user_to_answer";
}

function buildRoutingResult({
  intent,
  targetAgent,
  confidence,
  normalizedUserMessage,
  reason,
  currentQuestion,
  recentTurns,
}) {
  const recommendedAction = deriveAction(intent, targetAgent);
  const shouldAdvanceState = intent === "ANSWER";
  return {
    intent,
    targetAgent,
    confidence,
    normalizedUserMessage,
    reason,
    shouldAdvanceState,
    recommendedAction,
    lastSpeaker: getLastNonUserSpeaker(recentTurns),
    lastTeacherQuestion: detectLastTeacherQuestion(recentTurns, currentQuestion),
    // Backward compatibility fields
    addressedTo: targetAgent,
  };
}

function fallbackRoute({ userText, recentTurns = [], currentQuestion = "", stageId = "intro" }) {
  const normalizedUserMessage = normalizeMessage(userText);
  const lower = normalizedUserMessage.toLowerCase();
  const explicit = explicitTarget(lower);
  const lastSpeaker = getLastNonUserSpeaker(recentTurns);
  const clarificationPattern = CLARIFY_REGEX.test(lower);
  const questionLike = lower.includes("?") || QUESTION_START_REGEX.test(lower);
  const metaLike = META_REGEX.test(lower);
  const hasMetric = /\d/.test(lower);
  const hasImpact = IMPACT_REGEX.test(lower);

  let targetAgent = explicit;
  let intent = "ANSWER";
  let reason = "Defaulted to answer intent.";

  if (metaLike) {
    intent = "META";
    reason = "Detected process/meta style question.";
    targetAgent = targetAgent === "unknown" ? "teacher" : targetAgent;
  } else if (clarificationPattern || questionLike) {
    intent = "CLARIFICATION";
    reason = "Detected clarification/question form.";
    if (targetAgent === "unknown" && ["alex", "sofia", "jamal"].includes(lastSpeaker)) {
      targetAgent = lastSpeaker;
      intent = "ASK_CLASSMATE";
      reason = "Clarification routed to last peer speaker.";
    } else if (["alex", "sofia", "jamal"].includes(targetAgent)) {
      intent = "ASK_CLASSMATE";
      reason = "Explicit peer target with question intent.";
    } else if (targetAgent === "unknown") {
      targetAgent = "teacher";
      reason = "Clarification without peer context routed to teacher.";
    }
  } else if (normalizedUserMessage.length < 6) {
    intent = "OFFTOPIC";
    targetAgent = "teacher";
    reason = "Message too short for a meaningful answer.";
  } else if (stageId === "achievement" && OFFTOPIC_HINT_REGEX.test(lower) && !hasMetric && !hasImpact) {
    intent = "OFFTOPIC";
    targetAgent = "teacher";
    reason = "Achievement stage mismatch (no metric/impact and off-topic keyword).";
  } else {
    if (targetAgent === "unknown") targetAgent = "teacher";
    reason = hasTopicalOverlap(normalizedUserMessage, currentQuestion)
      ? "Topical statement treated as answer."
      : "Defaulted to answer; detailed grading will handle relevance.";
  }

  return buildRoutingResult({
    intent,
    targetAgent,
    confidence: 0.74,
    normalizedUserMessage,
    reason,
    currentQuestion,
    recentTurns,
  });
}

async function aiRoute({ userText, recentTurns, mode, scenario, currentQuestion, stageId }) {
  const normalizedUserMessage = normalizeMessage(userText);
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Classify user turn for classroom routing. Return JSON only.",
          "Schema:",
          "{ intent, targetAgent, reason, shouldAdvanceState, confidence, normalizedUserMessage }",
          "intent: ANSWER|CLARIFICATION|ASK_CLASSMATE|META|OFFTOPIC",
          "targetAgent: teacher|alex|sofia|jamal",
          "shouldAdvanceState true only when intent=ANSWER.",
          "Do not require explicit names; use recent speaker context.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          mode,
          scenario,
          stageId,
          currentQuestion,
          userText: normalizedUserMessage,
          recentTurns: (recentTurns || []).slice(-6),
        }),
      },
    ],
  });

  const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  const intent = safeEnum(parsed.intent, INTENTS, "ANSWER");
  const targetAgent = safeEnum(parsed.targetAgent, TARGETS, "teacher");
  const reason = parsed.reason ? String(parsed.reason) : "AI routing classification.";
  const confidence = clampConfidence(parsed.confidence, 0.75);

  return buildRoutingResult({
    intent,
    targetAgent,
    confidence,
    normalizedUserMessage: normalizeMessage(parsed.normalizedUserMessage || normalizedUserMessage),
    reason,
    currentQuestion,
    recentTurns,
  });
}

export async function routeUserMessage({
  text,
  lastSpeaker,
  currentQuestion = "",
  history = [],
  mode = "learner",
  scenario = "tech_interview",
  stageId = "intro",
}) {
  const recentTurns = Array.isArray(history) ? history.slice(-6) : [];
  if (lastSpeaker && lastSpeaker !== "unknown" && recentTurns.length === 0) {
    recentTurns.push({ role: lastSpeaker, text: "" });
  }

  if (!client) {
    return fallbackRoute({ userText: text, recentTurns, currentQuestion, stageId });
  }

  try {
    return await Promise.race([
      aiRoute({ userText: text, recentTurns, mode, scenario, currentQuestion, stageId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("router_timeout")), 3500)),
    ]);
  } catch {
    return fallbackRoute({ userText: text, recentTurns, currentQuestion, stageId });
  }
}

export async function classifyUserTurn(args) {
  return routeUserMessage({
    text: args.userText,
    history: args.recentTurns,
    mode: args.mode,
    scenario: args.scenario,
    stageId: args.stageId,
    currentQuestion: args.currentQuestion || "",
  });
}
