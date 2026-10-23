// Pure scoring, shared by the browser (to show the result) and the server
// (which re-scores from its own copy before storing).

export type ScoreInput = {
  questions: { id: string; answer: string; topicTag: string }[];
  topicPriority: string[];
};

export type DiagnosticScore = {
  score: number;
  topicScores: Record<string, { correct: number; asked: number }>;
  weakestTopic: string | null;
};

export function scoreDiagnostic(input: ScoreInput, answers: Record<string, string>): DiagnosticScore {
  const topicScores: DiagnosticScore['topicScores'] = {};
  let score = 0;
  for (const q of input.questions) {
    const t = (topicScores[q.topicTag] ??= { correct: 0, asked: 0 });
    t.asked++;
    if (answers[q.id] === q.answer) {
      t.correct++;
      score++;
    }
  }
  // Lowest correct/asked ratio wins; ties go to the earliest topic in topicPriority.
  const rank = (t: string) => {
    const i = input.topicPriority.indexOf(t);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  let weakestTopic: string | null = null;
  let worst = Infinity;
  for (const topic of Object.keys(topicScores).sort((a, b) => rank(a) - rank(b))) {
    const { correct, asked } = topicScores[topic]!;
    const ratio = correct / asked;
    if (ratio < worst) {
      worst = ratio;
      weakestTopic = topic;
    }
  }
  return { score, topicScores, weakestTopic };
}
