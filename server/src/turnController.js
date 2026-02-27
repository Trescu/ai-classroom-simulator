import {
  clampQuestionIndex,
  classmateTemplate,
  pickClassmate,
  teacherFollowUpTemplate,
  teacherIntroQuestion,
} from "./mockEngine.js";
import { createInitialCoach, updateCoachFeedback } from "./coachEngine.js";

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
    liveTip: "Answer in 2-3 sentences, then add one concrete detail.",
  };
}

export function runUserTurn(session, userText = "") {
  const cleanUserText = userText.trim();
  const userEntry = toTurn("user", cleanUserText || "(No answer provided)");
  appendHistory(session, [userEntry]);

  const currentStage = clampQuestionIndex(session.stageIndex);
  const nextStage = clampQuestionIndex(currentStage + 1);
  const teacher = toTurn(
    "teacher",
    teacherFollowUpTemplate({
      userText: cleanUserText,
      nextStageIndex: nextStage,
    })
  );

  const classmateRole = pickClassmate(session.speakerRotationIndex);
  const classmate = toTurn(classmateRole, classmateTemplate(classmateRole));

  appendHistory(session, [teacher, classmate]);

  session.stageIndex = nextStage;
  session.speakerRotationIndex = (session.speakerRotationIndex + 1) % 3;
  session.turnIndex += 1;
  session.coach = updateCoachFeedback({
    previous: session.coach,
    userText: cleanUserText,
    stageIndex: session.stageIndex,
  });

  return {
    session,
    turns: [teacher, classmate],
    feedback: session.coach,
    liveTip: session.coach.tips[0],
  };
}

export function runNextTurn(session) {
  const teacher = toTurn(
    "teacher",
    "Take a moment and answer the current question. Keep it concise and specific."
  );
  appendHistory(session, [teacher]);
  session.turnIndex += 1;
  return {
    session,
    turns: [teacher],
    feedback: session.coach,
    liveTip: "Use one concrete example and one measurable outcome.",
  };
}
