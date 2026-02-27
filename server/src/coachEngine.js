const BASE_FEEDBACK = {
  confidence: 62,
  vocabulary: 58,
  clarity: 60,
  level: "B1",
  tips: ["Use one concrete example to support your claim."],
  grammarIssues: ["Article usage", "Sentence variety"],
};

function clampScore(value) {
  return Math.max(35, Math.min(98, value));
}

export function createInitialCoach() {
  return { ...BASE_FEEDBACK };
}

export function applyScoreDeltas(previous, deltas, tip, issues = []) {
  const current = previous || createInitialCoach();
  const confidence = clampScore(current.confidence + (deltas.confidence || 0));
  const vocabulary = clampScore(current.vocabulary + (deltas.vocabulary || 0));
  const clarity = clampScore(current.clarity + (deltas.clarity || 0));
  const level = vocabulary >= 76 ? "B2" : "B1";

  return {
    confidence,
    vocabulary,
    clarity,
    level,
    tips: [tip, "Keep one idea per sentence to sound natural and precise."],
    grammarIssues: issues.length ? issues : current.grammarIssues,
  };
}
