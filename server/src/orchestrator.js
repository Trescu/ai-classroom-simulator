import { stageByIndex } from "./mockEngine.js";
import { routeUserMessage } from "./router.js";
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
  recentTurns = [],
}) {
  const safeSession = normalizeSession(session);
  normalizeScenario(scenario);

  if (action === "start") {
    return runStartTurn(safeSession);
  }

  if (action === "user_turn") {
    const stage = stageByIndex(safeSession.stageIndex);
    const historyForRouter = Array.isArray(recentTurns) && recentTurns.length
      ? recentTurns
      : safeSession.history.slice(-6);

    const routing = await routeUserMessage({
      text: userText,
      history: historyForRouter,
      mode,
      scenario,
      stageId: stage.id,
      currentQuestion: stage.question,
    });

    console.log("router", {
      targetAgent: routing.targetAgent,
      intent: routing.intent,
      shouldAdvanceState: routing.shouldAdvanceState,
      recommendedAction: routing.recommendedAction,
      confidence: routing.confidence,
      reason: routing.reason,
    });

    return runUserTurn(safeSession, routing.normalizedUserMessage || userText, routing);
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
    evaluation: { stage: "unknown", intent: "off_topic", isRelevant: false, issues: ["Unknown action"] },
  };
}
