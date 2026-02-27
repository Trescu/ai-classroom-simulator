import { normalizeSession, runNextTurn, runStartTurn, runUserTurn } from "./turnController.js";

function normalizeScenario(scenario = "tech_interview") {
  if (scenario === "interview") return "tech_interview";
  if (scenario === "language") return "language_class";
  return scenario;
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
    return runUserTurn(safeSession, userText);
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
  };
}
