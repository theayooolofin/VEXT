/**
 * True when the question at `index` is the first in the lesson to use its passage.
 * The passage starts open there and collapsed on later questions, so on a phone
 * a long passage does not push every question below the screen.
 */
export function isFirstPassageQuestion(
  questions: { passageId?: string | null }[],
  index: number,
): boolean {
  const id = questions[index]?.passageId;
  if (!id) return false;
  return questions.findIndex((q) => q.passageId === id) === index;
}
