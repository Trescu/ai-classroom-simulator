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

function wordCount(text = "") {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fillerCount(text = "") {
  return (text.match(/\b(um|uh|like|actually|maybe)\b/gi) || []).length;
}

function complexityCount(text = "") {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length >= 8).length;
}

function buildTip(stageIndex) {
  if (stageIndex === 1) return "Add one measurable impact (for example, +20% speed).";
  if (stageIndex === 2) return "Use STAR format: situation, task, action, result.";
  if (stageIndex === 3) return "Name the conflict clearly, then focus on your resolution.";
  if (stageIndex === 4) return "Link your strengths directly to this internship role.";
  if (stageIndex >= 5) return "Close with confidence and one memorable value statement.";
  return "Keep answers concise and specific.";
}

export function createInitialCoach() {
  return { ...BASE_FEEDBACK };
}

export function updateCoachFeedback({ previous, userText, stageIndex }) {
  const current = previous || createInitialCoach();
  const words = wordCount(userText);
  const fillers = fillerCount(userText);
  const complexWords = complexityCount(userText);

  const qualityBoost = words >= 10 ? 2 : 1;
  const fillerPenalty = fillers > 1 ? 1 : 0;

  const confidenceDelta = qualityBoost - fillerPenalty;
  const vocabDelta = (complexWords > 0 ? 2 : 1) - (fillers > 2 ? 1 : 0);
  const clarityDelta = (words >= 8 ? 2 : 1) - fillerPenalty;

  const confidence = clampScore(current.confidence + confidenceDelta);
  const vocabulary = clampScore(current.vocabulary + vocabDelta);
  const clarity = clampScore(current.clarity + clarityDelta);
  const level = vocabulary >= 76 ? "B2" : "B1";

  return {
    confidence,
    vocabulary,
    clarity,
    level,
    tips: [buildTip(stageIndex), "Keep one idea per sentence to sound more natural."],
    grammarIssues: fillers > 0 ? ["Filler words", "Verb tense consistency"] : ["Article usage", "Sentence variety"],
  };
}
