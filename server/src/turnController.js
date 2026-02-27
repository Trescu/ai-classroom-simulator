import {
  clampQuestionIndex,
  classmateTemplate,
  pickClassmate,
  stageByIndex,
  teacherIntroQuestion,
  teacherIrrelevantFollowUp,
  teacherRelevantFollowUp,
} from "./mockEngine.js";
import { applyScoreDeltas, createInitialCoach } from "./coachEngine.js";

const IMPACT_KEYWORDS = /\b(improved|reduced|increased|faster|faster than|boosted|grew|raised|cut|saved|impact|result|outcome)\b/i;
const PROJECT_KEYWORDS = /\b(project|app|system|platform|tool|feature|task|assignment|build|built|developed)\b/i;
const ROLE_KEYWORDS = /\b(i|my role|led|owner|responsible|implemented|managed|designed)\b/i;
const RESULT_KEYWORDS = /\b(result|outcome|impact|improved|reduced|increased|delivered|achieved|launched)\b/i;
const CHALLENGE_KEYWORDS = /\b(challenge|conflict|issue|problem|blocker|difficult)\b/i;
const RESOLUTION_KEYWORDS = /\b(resolved|handled|fixed|addressed|solved|improved|communicated)\b/i;
const WHY_KEYWORDS = /\b(fit|skills|experience|value|impact|team|role|internship|contribute)\b/i;
const CLOSING_KEYWORDS = /\b(thank|excited|ready|contribute|value|opportunity|closing|summary)\b/i;
const INTRO_KEYWORDS = /\b(student|internship|major|study|background|experience|developer|engineer|role)\b/i;

function roleToSpeaker(role) {
  if (role === "teacher") return "Teacher";
  if (role === "alex") return "Alex";
  if (role === "sofia") return "Sofia";
  if (role === "jamal") return "Jamal";
  return "You";
}

function toTurn(role, text) {
  return { speaker: roleToSpeaker(role), role, text };
}

function createSessionId() {
  return `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export function normalizeSession(raw = {}) {
  return {
    id: raw.id || createSessionId(),
    stageIndex: Number.isInteger(raw.stageIndex) ? clampQuestionIndex(raw.stageIndex) : 0,
    turnIndex: Number.isInteger(raw.turnIndex) ? raw.turnIndex : 0,
    speakerRotationIndex: Number.isInteger(raw.speakerRotationIndex) ? raw.speakerRotationIndex : 0,
    history: Array.isArray(raw.history) ? raw.history.slice(-60) : [],
    coach: raw.coach || createInitialCoach(),
  };
}

function appendHistory(session, entries) {
  session.history = [...session.history, ...entries.map((e) => ({ role: e.role, text: e.text }))].slice(-60);
}

function hasNumber(text) {
  return /\d/.test(text);
}

function normalizeText(text = "") {
  return text.trim().toLowerCase();
}

function evaluateIntro(text) {
  const issues = [];
  if (text.length < 20) issues.push("Answer is too short for an introduction.");
  if (!INTRO_KEYWORDS.test(text)) issues.push("Mention your background, current role, or internship intent.");
  return issues;
}

function evaluateAchievement(text) {
  const issues = [];
  if (!hasNumber(text)) issues.push("Include at least one number or measurable metric.");
  if (!IMPACT_KEYWORDS.test(text)) issues.push("State the impact or result using outcome words.");
  return issues;
}

function evaluateProject(text) {
  const checks = [
    { ok: PROJECT_KEYWORDS.test(text), issue: "Mention a concrete project or task." },
    { ok: ROLE_KEYWORDS.test(text), issue: "Explain your role or specific action." },
    { ok: RESULT_KEYWORDS.test(text), issue: "Include the result or impact." },
  ];
  const hitCount = checks.filter((c) => c.ok).length;
  if (hitCount >= 2) return [];
  return checks.filter((c) => !c.ok).map((c) => c.issue);
}

function evaluateChallenge(text) {
  const issues = [];
  if (!CHALLENGE_KEYWORDS.test(text)) issues.push("Describe the challenge or conflict clearly.");
  if (!RESOLUTION_KEYWORDS.test(text)) issues.push("Explain how you resolved the challenge.");
  return issues;
}

function evaluateWhy(text) {
  const issues = [];
  if (!WHY_KEYWORDS.test(text)) issues.push("Link your fit and strengths to this internship.");
  if (text.length < 25) issues.push("Add one concrete reason you are a strong fit.");
  return issues;
}

function evaluateClosing(text) {
  const issues = [];
  if (!CLOSING_KEYWORDS.test(text)) issues.push("End with a clear closing value statement.");
  if (text.length < 20) issues.push("Closing pitch is too short.");
  return issues;
}

function stageRequirementHint(stageId) {
  const stage = stageByIndex(
    stageId === "intro" ? 0 :
      stageId === "achievement" ? 1 :
      stageId === "project" ? 2 :
      stageId === "challenge" ? 3 :
      stageId === "why" ? 4 : 5
  );
  return stage.requirementHint;
}

export function evaluateAnswer(stageId, userText) {
  const text = normalizeText(userText);
  let issues = [];

  if (stageId === "intro") issues = evaluateIntro(text);
  if (stageId === "achievement") issues = evaluateAchievement(text);
  if (stageId === "project") issues = evaluateProject(text);
  if (stageId === "challenge") issues = evaluateChallenge(text);
  if (stageId === "why") issues = evaluateWhy(text);
  if (stageId === "closing") issues = evaluateClosing(text);

  const isRelevant = issues.length === 0;

  if (!isRelevant) {
    return {
      stage: stageId,
      isRelevant: false,
      issues,
      scoreDeltas: { confidence: -1, vocabulary: 0, clarity: -2 },
      tip: `Stay on topic. Include ${stageRequirementHint(stageId)}.`,
      nextQuestionAction: "retry",
    };
  }

  const vocabularyBoost = stageId === "achievement" && hasNumber(text) ? 2 : 1;
  return {
    stage: stageId,
    isRelevant: true,
    issues: [],
    scoreDeltas: { confidence: 2, vocabulary: vocabularyBoost, clarity: 2 },
    tip: `Strong direction. Next, keep focus on ${stageRequirementHint(stageId)}.`,
    nextQuestionAction: "advance",
  };
}

function clarificationExamples(stage) {
  if (stage.id === "achievement") {
    return [
      "Example 1: I improved API response time by 32% after introducing caching.",
      "Example 2: I reduced onboarding time from 5 days to 2 days by writing setup scripts.",
    ];
  }
  if (stage.id === "project") {
    return [
      "Example 1: I built a campus app, led backend design, and increased weekly usage by 25%.",
      "Example 2: I created a scheduling tool, owned testing, and cut booking errors by 40%.",
    ];
  }
  return [
    "Example 1: I am a CS student with 2 years of JavaScript projects, and I want this internship to grow in production engineering.",
    "Example 2: I study software engineering, built 3 team projects, and I am applying to contribute to real user-facing products.",
  ];
}

function buildClarifyTeacherReply(stage, hint) {
  const examples = clarificationExamples(stage);
  return [
    "I understand the confusion.",
    `In simple terms, this question asks for ${hint}.`,
    `${examples[0]} ${examples[1]}`,
    "Now please try your own answer.",
  ].join(" ");
}

function buildRefuseTeacherReply(stage) {
  return `No problem. Please give a brief attempt anyway so we can practice. Current question: ${stage.question}`;
}

function peerClarificationReply(peerRole) {
  if (peerRole === "alex") {
    return "I mean: pick one concrete example, add one number, and keep it tight in 2-3 sentences.";
  }
  if (peerRole === "sofia") {
    return "I meant you can answer step by step: one point about your role, then one clear result.";
  }
  return "I mean keep it simple: what you did, why it mattered, and one short result.";
}

function teacherBridgeToQuestion(stage) {
  return `Good clarification. Now let us return to the interview question: ${stage.question}`;
}

function teacherClarifyQuestion(stage) {
  const examples = clarificationExamples(stage);
  return `Sure. In simple words, answer with ${stage.requirementHint}. Example: ${examples[0]} Now give your own short version.`;
}

function teacherOffTopicRedirect(stage) {
  return `You are off-topic. Please answer this question: ${stage.question} Use 2-3 sentences or STAR (situation, task, action, result).`;
}

function teacherMetaReply(stage, userText) {
  const lower = (userText || "").toLowerCase();
  if (/\b1 sentence|one sentence\b/.test(lower)) {
    return `One sentence can work, but 2-3 concise sentences is better. Please answer: ${stage.question}`;
  }
  return `Good question. Keep it simple and focused. Now answer: ${stage.question}`;
}

export function runStartTurn(session) {
  session.stageIndex = 0;
  session.turnIndex = 0;
  session.speakerRotationIndex = 0;
  session.history = [];
  session.coach = createInitialCoach();

  const teacher = toTurn("teacher", teacherIntroQuestion(0));
  appendHistory(session, [teacher]);
  session.turnIndex += 1;

  return {
    session,
    turns: [teacher],
    feedback: session.coach,
    liveTip: "Stay on topic: background, role/study, and internship intent.",
    evaluation: { stage: stageByIndex(0).id, isRelevant: true, issues: [] },
  };
}

export function runUserTurn(session, userText = "", routing = null) {
  const cleanUserText = userText.trim();
  const userEntry = toTurn("user", cleanUserText || "(No answer provided)");
  appendHistory(session, [userEntry]);

  const currentStage = stageByIndex(session.stageIndex);
  const answerEval = evaluateAnswer(currentStage.id, cleanUserText);
  const intent = String(routing?.intent || "ANSWER").toUpperCase();
  const addressedTo = routing?.targetAgent || routing?.addressedTo || "teacher";
  const recommendedAction = routing?.recommendedAction || "continue_interview";
  const shouldAdvanceState = Boolean(routing?.shouldAdvanceState ?? (intent === "ANSWER"));
  const evaluation = {
    stage: currentStage.id,
    addressedTo,
    recommendedAction,
    shouldAdvanceState,
    intent,
    isRelevant: answerEval.isRelevant,
    issues: answerEval.issues,
  };

  const defaultClassmateRole = pickClassmate(session.speakerRotationIndex);
  let classmateRole = defaultClassmateRole;
  let liveTip = answerEval.tip;
  let scoreDeltas = answerEval.scoreDeltas;
  let grammarIssues = evaluation.isRelevant ? [] : answerEval.issues;
  const turns = [];

  if (
    recommendedAction === "peer_reply" &&
    ["alex", "sofia", "jamal"].includes(addressedTo) &&
    (intent === "CLARIFICATION" || intent === "ASK_CLASSMATE")
  ) {
    classmateRole = addressedTo;
    turns.push(toTurn(classmateRole, peerClarificationReply(classmateRole)));
    turns.push(toTurn("teacher", teacherBridgeToQuestion(currentStage)));
    evaluation.isRelevant = false;
    evaluation.issues = ["Peer clarification flow"];
    liveTip = `Clarified. Now answer the teacher with ${currentStage.requirementHint}.`;
    scoreDeltas = { confidence: 0, vocabulary: 0, clarity: 1 };
    grammarIssues = [];
  } else if (
    (recommendedAction === "teacher_clarify_question" || intent === "CLARIFICATION") &&
    (addressedTo === "teacher" || addressedTo === "unknown")
  ) {
    turns.push(toTurn("teacher", teacherClarifyQuestion(currentStage)));
    evaluation.isRelevant = false;
    evaluation.issues = ["User asked teacher clarification."];
    liveTip = `Teacher clarified the prompt. Include ${currentStage.requirementHint}.`;
    scoreDeltas = { confidence: -1, vocabulary: 0, clarity: -1 };
    grammarIssues = evaluation.issues;
  } else if (intent === "OFFTOPIC" || recommendedAction === "teacher_redirect") {
    turns.push(toTurn("teacher", teacherOffTopicRedirect(currentStage)));
    evaluation.isRelevant = false;
    evaluation.issues = ["Off-topic, answer the asked question."];
    liveTip = `Off-topic detected. Answer exactly: ${currentStage.question}`;
    scoreDeltas = { confidence: -1, vocabulary: 0, clarity: -2 };
    grammarIssues = evaluation.issues;
  } else if (intent === "META" || recommendedAction === "handle_meta") {
    turns.push(toTurn("teacher", teacherMetaReply(currentStage, cleanUserText)));
    evaluation.isRelevant = false;
    evaluation.issues = ["Meta question handled without stage advance."];
    liveTip = `Return to the prompt: ${currentStage.question}`;
    scoreDeltas = { confidence: 0, vocabulary: 0, clarity: 0 };
    grammarIssues = evaluation.issues;
  } else if (intent === "ANSWER" && evaluation.isRelevant && shouldAdvanceState) {
    const nextStage = clampQuestionIndex(session.stageIndex + 1);
    turns.push(toTurn("teacher", teacherRelevantFollowUp({
      userText: cleanUserText,
      nextStageIndex: nextStage,
    })));
    turns.push(toTurn(defaultClassmateRole, classmateTemplate(defaultClassmateRole, true)));
    session.stageIndex = nextStage;
    session.speakerRotationIndex = (session.speakerRotationIndex + 1) % 3;
  } else {
    turns.push(toTurn("teacher", teacherIrrelevantFollowUp({ requirementHint: currentStage.requirementHint })));
    turns.push(toTurn(defaultClassmateRole, classmateTemplate(defaultClassmateRole, false)));
    evaluation.isRelevant = false;
    liveTip = `Stay on topic. Include ${currentStage.requirementHint}.`;
    scoreDeltas = { confidence: -1, vocabulary: 0, clarity: -2 };
    grammarIssues = answerEval.issues;
    session.speakerRotationIndex = (session.speakerRotationIndex + 1) % 3;
  }

  appendHistory(session, turns);
  session.turnIndex += 1;
  session.coach = applyScoreDeltas(
    session.coach,
    scoreDeltas,
    liveTip,
    grammarIssues
  );

  return {
    session,
    turns,
    feedback: session.coach,
    liveTip,
    evaluation: { ...evaluation, reason: routing?.reason || "" },
  };
}

export function runNextTurn(session) {
  const stage = stageByIndex(session.stageIndex);
  const teacher = toTurn("teacher", `Please answer the current question first: ${stage.question}`);
  appendHistory(session, [teacher]);
  session.turnIndex += 1;
  return {
    session,
    turns: [teacher],
    feedback: session.coach,
    liveTip: `Stay on topic. Include ${stage.requirementHint}.`,
    evaluation: { stage: stage.id, isRelevant: false, issues: ["Awaiting user answer."] },
  };
}
