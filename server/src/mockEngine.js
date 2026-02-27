export const STAGES = [
  {
    id: "intro",
    question: "Introduce yourself in 2-3 concise sentences.",
    requirementHint: "your background, current role or study focus, and internship intent",
  },
  {
    id: "achievement",
    question: "Share one measurable achievement and explain the impact.",
    requirementHint: "one concrete metric and the impact/result",
  },
  {
    id: "project",
    question: "Walk through one project: task, your role, and result.",
    requirementHint: "project context, your role, and result (at least two of these)",
  },
  {
    id: "challenge",
    question: "Describe one challenge or conflict and how you solved it.",
    requirementHint: "the challenge and the action you took to resolve it",
  },
  {
    id: "why",
    question: "Why should we hire you for this internship?",
    requirementHint: "your fit for the role with specific strengths",
  },
  {
    id: "closing",
    question: "Give a short closing pitch for your candidacy.",
    requirementHint: "a concise closing summary and value statement",
  },
];

export const CLASSMATE_ROTATION = ["alex", "sofia", "jamal"];

export function clampQuestionIndex(index) {
  return Math.max(0, Math.min(index, STAGES.length - 1));
}

export function stageByIndex(index) {
  return STAGES[clampQuestionIndex(index)];
}

export function summarizeUserText(text = "", maxWords = 10) {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.length ? words.join(" ") : "your answer";
}

export function teacherIntroQuestion(stageIndex) {
  const stage = stageByIndex(stageIndex);
  return `Welcome class. Interview simulation starts now. First question: ${stage.question}`;
}

export function teacherRelevantFollowUp({ userText, nextStageIndex }) {
  const summary = summarizeUserText(userText);
  const nextStage = stageByIndex(nextStageIndex);
  return `Good progress. Quick summary: "${summary}". Next question: ${nextStage.question}`;
}

export function teacherIrrelevantFollowUp({ requirementHint }) {
  return `That doesn't answer the question. Please answer with ${requirementHint}.`;
}

export function classmateTemplate(role, isRelevant) {
  if (role === "alex") {
    return isRelevant
      ? "Nice answer. Add one concrete metric and it becomes strong."
      : "Stay on the exact question and add concrete evidence.";
  }
  if (role === "sofia") {
    return isRelevant
      ? "I'm not fully confident yet, but this sounds clear."
      : "I think we should focus on the question prompt first.";
  }
  return isRelevant ? "Good. Simple and clear." : "Let's keep it simple and answer the prompt directly.";
}

export function pickClassmate(rotationIndex = 0) {
  return CLASSMATE_ROTATION[Math.abs(rotationIndex) % CLASSMATE_ROTATION.length];
}
