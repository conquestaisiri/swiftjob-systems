// Answer key for candidate skills checks.
// Source of truth for question text/options lives in the SPA
// (artifacts/swiftjob-systems/src/lib/assessmentTracks.ts); only the
// grading data is mirrored here so the SERVER computes the score from the
// submitted responses instead of trusting a client-supplied number.
// If questions change in the frontend, update this map to match.

export const ASSESSMENT_ANSWER_KEY: Record<string, Record<string, number>> = {
  office: {
    "office-1": 0,
    "office-2": 2,
    "office-3": 2,
    "office-4": 1,
  },
  technical: {
    "tech-1": 1,
    "tech-2": 2,
    "tech-3": 3,
    "tech-4": 2,
  },
  analytical: {
    "ana-1": 1,
    "ana-2": 1,
    "ana-3": 1,
    "ana-4": 1,
  },
  creative: {
    "cre-1": 2,
    "cre-2": 0,
    "cre-3": 3,
    "cre-4": 1,
  },
};

// Grades MCQ answers against the track key. Unknown tracks/answers score 0.
export function gradeAssessment(
  track: string,
  responses: unknown,
): { score: number; maxScore: number } {
  const key = ASSESSMENT_ANSWER_KEY[track];
  if (!key) return { score: 0, maxScore: 0 };

  let mcq: Record<string, unknown> = {};
  try {
    if (
      responses &&
      typeof responses === "object" &&
      !Array.isArray(responses)
    ) {
      const obj = responses as Record<string, unknown>;
      if (obj.mcq && typeof obj.mcq === "object" && !Array.isArray(obj.mcq)) {
        mcq = obj.mcq as Record<string, unknown>;
      }
    }
  } catch {
    mcq = {};
  }

  const ids = Object.keys(key);
  const maxScore = ids.length;
  let score = 0;
  for (const id of ids) {
    // Strict equality on number — string/undefined answers never match.
    if (mcq[id] === key[id]) score += 1;
  }
  return { score, maxScore };
}
