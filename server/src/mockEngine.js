export const INTERVIEW_QUESTIONS = [
  "Introduce yourself in 2-3 concise sentences.",
  "Share one measurable achievement and explain the impact.",
  "Walk through one project: your role, key decision, and result.",
  "What are your top strengths for this internship?",
  "Why should we hire you for this role?",
  "Give a short closing pitch for your candidacy.",
];

export const CLASSMATE_ROTATION = ["alex", "sofia", "jamal"];

export function clampQuestionIndex(index) {
  return Math.max(0, Math.min(index, INTERVIEW_QUESTIONS.length - 1));
}

export function summarizeUserText(text = "", maxWords = 10) {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.length ? words.join(" ") : "your answer";
}

export function teacherIntroQuestion(stageIndex) {
  const question = INTERVIEW_QUESTIONS[clampQuestionIndex(stageIndex)];
  return `Welcome class. Interview simulation starts now. First question: ${question}`;
}

export function teacherFollowUpTemplate({ userText, nextStageIndex }) {
  const summary = summarizeUserText(userText);
  const nextQuestion = INTERVIEW_QUESTIONS[clampQuestionIndex(nextStageIndex)];
  return `Good. Quick summary: "${summary}". Next question: ${nextQuestion}`;
}

export function classmateTemplate(role) {
  if (role === "alex") {
    return "Nice answer. Add one concrete metric and it becomes strong.";
  }
  if (role === "sofia") {
    return "I'm not fully confident yet, but this sounds clear.";
  }
  return "Good. Simple and clear.";
}

export function pickClassmate(rotationIndex = 0) {
  return CLASSMATE_ROTATION[Math.abs(rotationIndex) % CLASSMATE_ROTATION.length];
}
