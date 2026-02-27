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

export function runUserTurn(session, userText = "", analysis = null) {
  const cleanUserText = userText.trim();
  const userEntry = toTurn("user", cleanUserText || "(No answer provided)");
  appendHistory(session, [userEntry]);

  const currentStage = stageByIndex(session.stageIndex);
  const answerEval = evaluateAnswer(currentStage.id, cleanUserText);
  const intent = analysis?.intent || "ANSWER";
  const evaluation = {
    stage: currentStage.id,
    intent,
    isRelevant: answerEval.isRelevant,
    issues: answerEval.issues,
  };

  const classmateRole = pickClassmate(session.speakerRotationIndex);
  const classmate = toTurn(
    classmateRole,
    classmateTemplate(classmateRole, evaluation.isRelevant && intent === "ANSWER")
  );
  let teacherText;
  let liveTip = answerEval.tip;
  let scoreDeltas = answerEval.scoreDeltas;
  let grammarIssues = evaluation.isRelevant ? [] : answerEval.issues;

  if (analysis?.tip) {
    liveTip = analysis.tip;
  }
  if (analysis?.scoreDeltas) {
    scoreDeltas = analysis.scoreDeltas;
  }

  if (intent === "CLARIFY") {
    teacherText = analysis?.suggestedTeacherReply || buildClarifyTeacherReply(currentStage, currentStage.requirementHint);
    evaluation.isRelevant = false;
    evaluation.issues = analysis?.issues?.length ? analysis.issues : ["User asked for clarification."];
    liveTip = analysis?.tip || `Clarify first, then answer with ${currentStage.requirementHint}.`;
    scoreDeltas = analysis?.scoreDeltas || { confidence: -1, vocabulary: 0, clarity: -1 };
    grammarIssues = evaluation.issues;
  } else if (intent === "REFUSE") {
    teacherText = analysis?.suggestedTeacherReply || buildRefuseTeacherReply(currentStage);
    evaluation.isRelevant = false;
    evaluation.issues = analysis?.issues?.length ? analysis.issues : ["User refused to answer."];
    liveTip = analysis?.tip || `Give at least one short attempt with ${currentStage.requirementHint}.`;
    scoreDeltas = analysis?.scoreDeltas || { confidence: -1, vocabulary: 0, clarity: -1 };
    grammarIssues = evaluation.issues;
  } else if (intent === "OFFTOPIC") {
    teacherText = analysis?.suggestedTeacherReply || teacherIrrelevantFollowUp({ requirementHint: currentStage.requirementHint });
    evaluation.isRelevant = false;
    evaluation.issues = analysis?.issues?.length ? analysis.issues : answerEval.issues;
    liveTip = analysis?.tip || `Stay on topic. Include ${currentStage.requirementHint}.`;
    scoreDeltas = analysis?.scoreDeltas || { confidence: -1, vocabulary: 0, clarity: -2 };
    grammarIssues = evaluation.issues;
  }

  if (intent === "ANSWER" && evaluation.isRelevant) {
    const nextStage = clampQuestionIndex(session.stageIndex + 1);
    teacherText = teacherRelevantFollowUp({
      userText: cleanUserText,
      nextStageIndex: nextStage,
    });
    session.stageIndex = nextStage;
  } else {
    if (!teacherText) {
      teacherText = teacherIrrelevantFollowUp({ requirementHint: currentStage.requirementHint });
    }
  }

  const teacher = toTurn("teacher", teacherText);
  appendHistory(session, [teacher, classmate]);

  session.speakerRotationIndex = (session.speakerRotationIndex + 1) % 3;
  session.turnIndex += 1;
  session.coach = applyScoreDeltas(
    session.coach,
    scoreDeltas,
    liveTip,
    grammarIssues
  );

  return {
    session,
    turns: [teacher, classmate],
    feedback: session.coach,
    liveTip,
    evaluation,
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
