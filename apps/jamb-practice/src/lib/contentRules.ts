import { createHash } from 'node:crypto';
import { OPTION_KEYS, type Diagnostic, type Lesson, type Question } from './contentSchema';

export const QUESTIONS_PER_LESSON = 10;
export const EXPLANATION_MAX = 300;
export const RULE_MAX = 700;
export const DAYS = Array.from({ length: 14 }, (_, i) => i + 1);

export type ValidationResult = { errors: string[]; warnings: string[] };

/** JSON with sorted keys, so hashes ignore formatting and line endings. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Any edit to a lesson changes this hash and so withdraws its approval. */
export function contentHash(raw: unknown): string {
  return createHash('sha256').update(canonicalJson(raw)).digest('hex');
}

function trackId(id: string, where: string, seen: Map<string, string>, errors: string[]) {
  const prev = seen.get(id);
  if (prev) errors.push(`${where}: question id ${id} is already used in ${prev}`);
  else seen.set(id, where);
}

function checkQuestion(
  q: Question,
  where: string,
  topics: Record<string, string>,
  passageIds: Set<string>,
  idPattern: RegExp,
  requireDifficulty: boolean,
  errors: string[],
) {
  const at = `${where} question ${q.id || '(no id)'}`;
  if (!idPattern.test(q.id)) errors.push(`${at}: id must match ${idPattern.source}`);
  if (!q.stem?.trim()) errors.push(`${at}: stem is missing`);
  const keys = Object.keys(q.options);
  const hasFour = keys.length === 4 && OPTION_KEYS.every((k) => typeof q.options[k] === 'string');
  if (!hasFour) {
    errors.push(
      `${at}: needs exactly four options A, B, C and D (found ${keys.join(', ') || 'none'})`,
    );
  } else {
    const values = OPTION_KEYS.map((k) => q.options[k]!.trim());
    if (values.some((v) => !v)) errors.push(`${at}: every option needs text`);
    if (new Set(values.map((v) => v.toLowerCase())).size !== 4)
      errors.push(`${at}: two options have the same text`);
  }
  if (!(OPTION_KEYS as readonly string[]).includes(q.answer) || !(q.answer in q.options))
    errors.push(`${at}: answer "${q.answer}" is not one of the options`);
  if (!q.explanation?.trim()) errors.push(`${at}: explanation is missing`);
  else if (q.explanation.length > EXPLANATION_MAX)
    errors.push(
      `${at}: explanation is ${q.explanation.length} characters (max ${EXPLANATION_MAX})`,
    );
  if (requireDifficulty && !['easy', 'medium', 'hard'].includes(q.difficulty ?? ''))
    errors.push(`${at}: difficulty must be easy, medium or hard`);
  if (!(q.topicTag in topics)) errors.push(`${at}: unknown topicTag "${q.topicTag}"`);
  if (q.passageId && !passageIds.has(q.passageId))
    errors.push(`${at}: passage "${q.passageId}" does not exist`);
}

export function validateLesson(
  lesson: Lesson,
  topics: Record<string, string>,
  seenIds: Map<string, string>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const where = `Day ${lesson.day}`;
  if (lesson.questions.length !== QUESTIONS_PER_LESSON)
    errors.push(
      `${where}: has ${lesson.questions.length} questions (needs exactly ${QUESTIONS_PER_LESSON})`,
    );
  if (!(lesson.topicTag in topics)) errors.push(`${where}: unknown topicTag "${lesson.topicTag}"`);
  if (!lesson.rule.body?.trim()) errors.push(`${where}: rule body is missing`);
  else if (lesson.rule.body.length > RULE_MAX)
    errors.push(`${where}: rule body is ${lesson.rule.body.length} characters (max ${RULE_MAX})`);
  const passageIds = new Set(lesson.passages.map((p) => p.id));
  const pattern = new RegExp(`^d${String(lesson.day).padStart(2, '0')}-q\\d{2}$`);
  const stems = new Set<string>();
  const mix: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of lesson.questions) {
    checkQuestion(q, where, topics, passageIds, pattern, true, errors);
    trackId(q.id, where, seenIds, errors);
    const stem = q.stem?.trim().toLowerCase();
    if (stem) {
      if (stems.has(stem)) errors.push(`${where} question ${q.id}: same stem as another question`);
      stems.add(stem);
    }
    if (q.difficulty && q.difficulty in mix) mix[q.difficulty] = (mix[q.difficulty] ?? 0) + 1;
  }
  if (mix.easy !== 4 || mix.medium !== 4 || mix.hard !== 2)
    warnings.push(
      `${where}: difficulty mix is ${mix.easy} easy, ${mix.medium} medium, ${mix.hard} hard (target 4, 4, 2)`,
    );
  return { errors, warnings };
}

export function validateDiagnostic(
  diag: Diagnostic,
  topics: Record<string, string>,
  seenIds: Map<string, string>,
): ValidationResult {
  const errors: string[] = [];
  const where = 'Diagnostic';
  if (diag.questions.length !== QUESTIONS_PER_LESSON)
    errors.push(
      `${where}: has ${diag.questions.length} questions (needs exactly ${QUESTIONS_PER_LESSON})`,
    );
  for (const t of diag.topicPriority)
    if (!(t in topics)) errors.push(`${where}: topicPriority has unknown topic "${t}"`);
  for (const q of diag.questions) {
    checkQuestion(q, where, topics, new Set(), /^dg-q\d{2}$/, false, errors);
    trackId(q.id, where, seenIds, errors);
    if (!diag.topicPriority.includes(q.topicTag))
      errors.push(`${where} question ${q.id}: topic "${q.topicTag}" is missing from topicPriority`);
  }
  return { errors, warnings: [] };
}
