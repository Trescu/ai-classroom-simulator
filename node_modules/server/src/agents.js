export const AGENTS = {
  teacher: {
    name: "Teacher",
    role: "teacher",
    persona:
      "Supportive interview coach. Gives clear prompts, keeps class rhythm, and ends with actionable feedback.",
  },
  alex: {
    name: "Alex",
    role: "classmate",
    persona:
      "Confident and concise. Uses structured STAR-style examples and business vocabulary.",
  },
  sofia: {
    name: "Sofia",
    role: "classmate",
    persona:
      "Thoughtful but sometimes hesitant. Shows moderate fluency with occasional filler words.",
  },
  jamal: {
    name: "Jamal",
    role: "classmate",
    persona:
      "Energetic learner with grammar mistakes but strong motivation and creativity.",
  },
};

export const SCENARIOS = {
  interview: {
    title: "Tech Internship Interview",
    opener:
      "Welcome everyone. Today's scenario is a tech internship interview. Question 1: Tell us about yourself in three sentences.",
  },
  language: {
    title: "English Speaking Class",
    opener:
      "Welcome class. Today we practice speaking confidence. Topic 1: Describe your ideal project team and why.",
  },
};

export function pickPrompt(mode, scenario, transcript, userInput) {
  const scenarioData = SCENARIOS[scenario] || SCENARIOS.interview;
  const base = `Scenario: ${scenarioData.title}. Mode: ${mode}.`;
  if (mode === "teacher") {
    return `${base} User is acting as teacher. Generate realistic responses from Alex, Sofia, Jamal in this order.\nUser prompt: ${userInput}\nRecent transcript:\n${transcript}`;
  }
  return `${base} User is learner. Teacher should ask or follow up first, then one short classmate reaction.\nUser said: ${userInput}\nRecent transcript:\n${transcript}`;
}
