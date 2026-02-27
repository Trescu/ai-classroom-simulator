import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const CLARIFY_REGEX = /\b(i do not understand|i don't understand|what do you mean|can you explain|nem ertem|nem ertem a kerdest|magyarazd el|hogy erted)\b/i;
const REFUSE_REGEX = /\b(won't answer|prefer not|skip|nem akarok)\b/i;
const META_REGEX = /\b(how does this work|what is this app|what should i do|help me use)\b/i;
const REPEAT_REGEX = /\b(repeat|say again|again please|could you repeat)\b/i;
const END_REGEX = /\b(end|finish|stop|bye|thats all|that's all)\b/i;
const OFFTOPIC_HINT_REGEX = /\b(color|pizza|movie|music|cat|dog)\b/i;
const IMPACT_REGEX = /\b(improved|reduced|increased|faster|impact|result|outcome|saved|boosted)\b/i;

const ADDRESSED_TO = ["teacher", "alex", "sofia", "jamal", "class", "unknown"];
const INTENTS = ["answer", "clarification", "ask_peer", "ask_teacher", "meta", "off_topic", "repeat", "end"];
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

function clampConfidence(value, fallback = 0.6) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function safeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function lastMessageRole(recentTurns = []) {
  if (!Array.isArray(recentTurns) || recentTurns.length === 0) return "unknown";
  return recentTurns[recentTurns.length - 1]?.role || "unknown";
}

function detectExplicitAddress(lower) {
  if (/\balex\b/i.test(lower)) return "alex";
  if (/\bsofia\b/i.test(lower)) return "sofia";
  if (/\bjamal\b/i.test(lower)) return "jamal";
  if (/\bteacher\b/i.test(lower)) return "teacher";
  if (/\bclass\b/i.test(lower)) return "class";
  return "unknown";
}

function detectLastTeacherQuestion(recentTurns = []) {
  const teacherTurns = recentTurns.filter((t) => t?.role === "teacher");
  if (!teacherTurns.length) return "";
  return teacherTurns[teacherTurns.length - 1]?.text || "";
}

function fallbackClassify({ userText, recentTurns, stageId }) {
  const normalizedUserMessage = normalizeMessage(userText);
  const lower = normalizedUserMessage.toLowerCase();
  const explicit = detectExplicitAddress(lower);
  const lastRole = lastMessageRole(recentTurns);
  const likelyPeerContext = ["alex", "sofia", "jamal"].includes(lastRole);
  const hasMetric = /\d/.test(lower);
  const hasImpact = IMPACT_REGEX.test(lower);
  const hasQuestion = lower.includes("?");

  let addressedTo = explicit;
  if (addressedTo === "unknown" && likelyPeerContext && hasQuestion) {
    addressedTo = lastRole;
  }

  let intent = "answer";
  if (END_REGEX.test(lower)) {
    intent = "end";
  } else if (META_REGEX.test(lower)) {
    intent = "meta";
  } else if (REPEAT_REGEX.test(lower)) {
    intent = "repeat";
  } else if (CLARIFY_REGEX.test(lower)) {
    intent = "clarification";
  } else if (REFUSE_REGEX.test(lower)) {
    intent = "off_topic";
  } else if (addressedTo !== "unknown" && addressedTo !== "teacher" && hasQuestion) {
    intent = "ask_peer";
  } else if (addressedTo === "teacher" && hasQuestion) {
    intent = "ask_teacher";
  } else if (normalizedUserMessage.length < 6) {
    intent = "off_topic";
  }

  if (intent === "answer" && stageId === "achievement" && OFFTOPIC_HINT_REGEX.test(lower) && !hasMetric && !hasImpact) {
    intent = "off_topic";
  }

  let recommendedAction = "continue_interview";
  if ((intent === "clarification" || intent === "ask_peer") && ["alex", "sofia", "jamal"].includes(addressedTo)) {
    recommendedAction = "peer_reply";
  } else if (intent === "clarification" || intent === "ask_teacher" || intent === "repeat") {
    recommendedAction = "teacher_clarify_question";
  } else if (intent === "off_topic") {
    recommendedAction = "teacher_redirect";
  } else if (intent === "meta" || intent === "end") {
    recommendedAction = "handle_meta";
  } else if (intent === "answer") {
    recommendedAction = "continue_interview";
  } else {
    recommendedAction = "ask_user_to_answer";
  }

  if (addressedTo === "unknown" && intent === "ask_teacher") {
    addressedTo = "teacher";
  }

  return {
    addressedTo,
    intent,
    confidence: 0.72,
    normalizedUserMessage,
    recommendedAction,
    lastSpeaker: lastRole,
    lastTeacherQuestion: detectLastTeacherQuestion(recentTurns),
  };
}

async function aiClassify({ userText, recentTurns, mode, scenario, stageId }) {
  const normalizedUserMessage = normalizeMessage(userText);
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Classify user classroom routing.",
          "Return strict JSON only with keys:",
          "addressedTo, intent, confidence, normalizedUserMessage, recommendedAction.",
          "addressedTo in teacher|alex|sofia|jamal|class|unknown.",
          "intent in answer|clarification|ask_peer|ask_teacher|meta|off_topic|repeat|end.",
          "recommendedAction in continue_interview|teacher_clarify_question|peer_reply|teacher_redirect|ask_user_to_answer|handle_meta.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          mode,
          scenario,
          stageId,
          userText: normalizedUserMessage,
          recentTurns: (recentTurns || []).slice(-6),
        }),
      },
    ],
  });

  const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  return {
    addressedTo: safeEnum(parsed.addressedTo, ADDRESSED_TO, "unknown"),
    intent: safeEnum(parsed.intent, INTENTS, "answer"),
    confidence: clampConfidence(parsed.confidence, 0.7),
    normalizedUserMessage: normalizeMessage(parsed.normalizedUserMessage || normalizedUserMessage),
    recommendedAction: safeEnum(parsed.recommendedAction, ACTIONS, "continue_interview"),
    lastSpeaker: lastMessageRole(recentTurns),
    lastTeacherQuestion: detectLastTeacherQuestion(recentTurns),
  };
}

export async function classifyUserTurn({ userText, recentTurns = [], mode = "learner", scenario = "tech_interview", stageId = "intro" }) {
  if (!client) {
    return fallbackClassify({ userText, recentTurns, stageId });
  }

  try {
    const ai = await Promise.race([
      aiClassify({ userText, recentTurns, mode, scenario, stageId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("router_timeout")), 3500)),
    ]);
    return ai;
  } catch {
    return fallbackClassify({ userText, recentTurns, stageId });
  }
}

/*
Local sanity cases:
1) "I don't understand" => clarification -> teacher_clarify_question
2) after Alex speaks, "What do you mean, Alex?" => ask_peer + addressedTo alex -> peer_reply
3) stage achievement, "My favorite color is pink" => off_topic -> teacher_redirect
*/
