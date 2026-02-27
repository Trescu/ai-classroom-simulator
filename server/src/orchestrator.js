import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const STAGE_PROMPTS = [
  "Tell me about yourself in 2-3 concise sentences.",
  "Share one measurable achievement and the exact impact.",
  "Walk me through a project you built: your role, biggest decision, and result.",
  "Describe a challenge or conflict and how you resolved it.",
  "Why do you want this internship specifically at our company?",
  "Closing round: what questions do you have for us?",
];

const CLASSMATE_ORDER = ["alex", "sofia", "jamal"];

function normalizeScenario(scenario = "tech_interview") {
  if (scenario === "interview") return "tech_interview";
  if (scenario === "language") return "language_class";
  return scenario;
}

function createSessionId() {
  return `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function createSession(seed = {}) {
  return {
    id: seed.id || createSessionId(),
    stageIndex: Number.isInteger(seed.stageIndex) ? seed.stageIndex : 0,
    turnIndex: Number.isInteger(seed.turnIndex) ? seed.turnIndex : 0,
    speakerRotationIndex: Number.isInteger(seed.speakerRotationIndex) ? seed.speakerRotationIndex : 0,
    awaitingUserReply: Boolean(seed.awaitingUserReply),
    history: Array.isArray(seed.history) ? seed.history.slice(-50) : [],
  };
}

function clampStage(stageIndex) {
  return Math.max(0, Math.min(stageIndex, STAGE_PROMPTS.length - 1));
}

function roleToSpeaker(role) {
  if (role === "teacher") return "Teacher";
  if (role === "alex") return "Alex";
  if (role === "sofia") return "Sofia";
  if (role === "jamal") return "Jamal";
  return "You";
}

function toMessage(role, text) {
  return { role, speaker: roleToSpeaker(role), text };
}

function appendHistory(session, items) {
  session.history = [...session.history, ...items.map((item) => ({ role: item.role, text: item.text }))].slice(-60);
}

function heuristicFeedback(text = "") {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const fillerCount = (text.match(/\b(um|uh|like|actually|maybe)\b/gi) || []).length;
  const longWords = words.filter((w) => w.length > 7).length;
  const confidence = Math.max(40, Math.min(98, 62 + words.length - fillerCount * 4));
  const clarity = Math.max(30, Math.min(95, 68 - fillerCount * 8 + Math.floor(words.length / 4)));
  const vocabulary = Math.max(35, Math.min(96, 55 + longWords * 4));
  const qualityScore = Math.max(1, Math.min(10, Math.round((confidence + clarity + vocabulary) / 30)));

  return {
    confidence,
    clarity,
    vocabulary,
    level: vocabulary > 75 ? "B2" : "B1",
    qualityScore,
    tips: [
      fillerCount > 1 ? "Reduce filler words and pause briefly between key points." : "Good pacing. Add a sharper closing sentence.",
      "Use one concrete metric to prove impact (for example, +18% retention).",
      "Keep STAR structure: situation, task, action, result.",
    ],
    grammarIssues: fillerCount > 0 ? ["Filler words", "Verb tense consistency"] : ["Article usage", "Sentence variety"],
  };
}

function pickClassmate(session, feedback, stageIndex) {
  const rotationRole = CLASSMATE_ORDER[session.speakerRotationIndex % CLASSMATE_ORDER.length];
  const occasionalOverride = session.turnIndex % 3 === 2;

  if (!occasionalOverride) return rotationRole;

  if (feedback.qualityScore <= 4) return "sofia";
  if (stageIndex <= 1) return "alex";
  if (stageIndex >= 3) return "jamal";
  return rotationRole;
}

function classmateReaction(role, feedback, stageIndex) {
  const lowQuality = feedback.qualityScore <= 4;
  const highQuality = feedback.qualityScore >= 7;
  const stageName = STAGE_PROMPTS[clampStage(stageIndex)];

  if (role === "alex") {
    if (highQuality) {
      return "Nice and sharp. Add one hard number and it lands like a finalist answer.";
    }
    return "Keep it concise and quantify one result. Even one number makes this answer stronger.";
  }

  if (role === "sofia") {
    if (lowQuality) {
      return "That is okay, you are close. Maybe clarify the action step before the result?";
    }
    return "I liked that. Could you clarify one detail so it is easier to visualize?";
  }

  if (stageName.includes("challenge")) {
    return "Good energy. Maybe tighten the grammar a bit, but your conflict story sounds real.";
  }
  return "I like it, that sounds practical. Maybe keep sentences short so it sounds cleaner.";
}

function teacherOpening(stageIndex) {
  const prompt = STAGE_PROMPTS[clampStage(stageIndex)];
  return `Welcome class. Tech interview simulation starts now. ${prompt}`;
}

function teacherFollowUp(userText, stageIndex, feedback) {
  const current = clampStage(stageIndex);
  const next = clampStage(current + 1);
  const userSummary = userText.trim().split(/\s+/).slice(0, 8).join(" ");

  if (feedback.qualityScore <= 4) {
    return `Thanks for sharing. I heard "${userSummary || "your idea"}". Please tighten it with one clear action and one measurable outcome.`;
  }

  if (current >= STAGE_PROMPTS.length - 1) {
    return "Solid close. Before we finish, ask one thoughtful question about the team or role.";
  }

  return `Good. Quick summary: "${userSummary || "you framed your answer"}". Next question: ${STAGE_PROMPTS[next]}`;
}

function teacherNudge() {
  return "Take a moment and answer the current question when you are ready. Focus on one specific example.";
}

function teacherAdvance(stageIndex) {
  return `Let us move ahead. ${STAGE_PROMPTS[clampStage(stageIndex)]}`;
}

async function llmTeacherVariant({ session, userText, baseTeacherText, classmateRole }) {
  if (!client) return null;

  const prompt = [
    "You are a classroom interview teacher.",
    "Return JSON only: { teacherText: string, classmateText: string }.",
    "Teacher must be 1-3 sentences. Classmate must be 1-2 sentences.",
    "Keep pacing realistic, one clear question at a time.",
    `Current stage prompt: ${STAGE_PROMPTS[clampStage(session.stageIndex)]}`,
    `Baseline teacher text: ${baseTeacherText}`,
    `User text: ${userText || "(none)"}`,
    `Classmate persona target: ${classmateRole}`,
    `Recent history:\n${session.history.slice(-8).map((h) => `${h.role}: ${h.text}`).join("\n")}`,
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Output strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  if (!parsed.teacherText || !parsed.classmateText) return null;
  return {
    teacherText: String(parsed.teacherText).trim(),
    classmateText: String(parsed.classmateText).trim(),
  };
}

function nextLiveTip(feedback, stageIndex) {
  if (stageIndex === 1) return "Name one metric and explain why it mattered.";
  if (stageIndex === 2) return "Use STAR and keep your action section crisp.";
  return feedback.tips[0];
}

export async function runTurn({ mode = "learner", scenario = "tech_interview", action = "start", session = {}, userText = "" }) {
  const normalizedScenario = normalizeScenario(scenario);
  const nextSession = createSession(session);
  const feedback = heuristicFeedback(userText);

  const turns = [];
  const safeAction = action || "start";

  if (safeAction === "start") {
    nextSession.stageIndex = 0;
    nextSession.turnIndex = 0;
    nextSession.speakerRotationIndex = 0;
    nextSession.awaitingUserReply = true;
    nextSession.history = [];

    turns.push(toMessage("teacher", teacherOpening(nextSession.stageIndex)));
    appendHistory(nextSession, turns);
    nextSession.turnIndex += 1;

    return {
      session: nextSession,
      turns,
      feedback,
      liveTip: "Answer in 2-3 sentences, then add one concrete detail.",
    };
  }

  if (safeAction === "user_turn") {
    if (userText.trim()) {
      appendHistory(nextSession, [toMessage("user", userText.trim())]);
    }

    if (mode === "teacher") {
      const alex = toMessage("alex", "I built a campus support app and improved repeat usage by 21% through weekly user interviews.");
      const sofia = toMessage("sofia", "I think your prompt is clear. Maybe can you repeat the success criteria once more?");
      const jamal = toMessage("jamal", "Great pace, teacher. Class is active and we can answer faster now.");
      turns.push(alex, sofia, jamal);
      appendHistory(nextSession, turns);
      nextSession.awaitingUserReply = true;
      nextSession.turnIndex += 1;
      return {
        session: nextSession,
        turns,
        feedback,
        liveTip: "As teacher mode, keep prompts short and ask only one question each turn.",
      };
    }

    const stageIndex = clampStage(nextSession.stageIndex);
    const classmateRole = pickClassmate(nextSession, feedback, stageIndex);
    const baseTeacherText = teacherFollowUp(userText, stageIndex, feedback);
    const baseClassmateText = classmateReaction(classmateRole, feedback, stageIndex);

    let teacherText = baseTeacherText;
    let classmateText = baseClassmateText;
    try {
      const llm = await llmTeacherVariant({ session: nextSession, userText, baseTeacherText, classmateRole });
      if (llm) {
        teacherText = llm.teacherText;
        classmateText = llm.classmateText;
      }
    } catch {
      // Deterministic fallback is intentional for demo stability.
    }

    turns.push(toMessage("teacher", teacherText));
    turns.push(toMessage(classmateRole, classmateText));
    appendHistory(nextSession, turns);

    nextSession.stageIndex = clampStage(nextSession.stageIndex + 1);
    nextSession.speakerRotationIndex = (nextSession.speakerRotationIndex + 1) % CLASSMATE_ORDER.length;
    nextSession.awaitingUserReply = true;
    nextSession.turnIndex += 1;

    return {
      session: nextSession,
      turns,
      feedback,
      liveTip: nextLiveTip(feedback, nextSession.stageIndex),
    };
  }

  if (safeAction === "next_turn") {
    if (mode === "learner") {
      if (nextSession.awaitingUserReply) {
        turns.push(toMessage("teacher", teacherNudge()));
      } else {
        nextSession.stageIndex = clampStage(nextSession.stageIndex + 1);
        turns.push(toMessage("teacher", teacherAdvance(nextSession.stageIndex)));
        nextSession.awaitingUserReply = true;
      }
    } else {
      turns.push(toMessage("teacher", "Please continue moderating and invite one student to respond."));
    }

    appendHistory(nextSession, turns);
    nextSession.turnIndex += 1;
    return {
      session: nextSession,
      turns,
      feedback,
      liveTip: "Keep each response focused: one idea, one example.",
    };
  }

  return {
    session: nextSession,
    turns: [toMessage("teacher", "I did not understand that action. Please try again.")],
    feedback,
    liveTip: "Retry the turn action.",
  };
}
