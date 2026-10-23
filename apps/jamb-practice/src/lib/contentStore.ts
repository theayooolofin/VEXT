import fs from 'node:fs';
import path from 'node:path';
import {
  diagnosticSchema,
  lessonSchema,
  reviewSchema,
  topicsSchema,
  type Diagnostic,
  type Lesson,
  type OptionKey,
  type PublicLesson,
  type PublicQuestion,
  type Question,
  type ReviewEntry,
} from './contentSchema';
import { DAYS, contentHash, validateDiagnostic, validateLesson } from './contentRules';

export type ContentStatus = 'missing' | 'invalid' | 'draft' | 'approved' | 'edited_after_approval';

export type LoadedItem<T> = {
  status: ContentStatus;
  data?: T;
  hash?: string;
  errors: string[];
  warnings: string[];
  review?: ReviewEntry;
  isFixture: boolean;
};

export type ContentSet = {
  dir: string;
  topics: Record<string, string>;
  diagnostic: LoadedItem<Diagnostic>;
  lessons: Map<number, LoadedItem<Lesson>>;
  review: ReviewEntry[];
  errors: string[];
};

export const lessonFileName = (day: number) => `day-${String(day).padStart(2, '0')}.json`;

function readJson(file: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    return { ok: false, error: `${path.basename(file)}: ${(e as Error).message}` };
  }
}

function statusFor(hash: string, entry: ReviewEntry | undefined): ContentStatus {
  if (!entry) return 'draft';
  return entry.contentHash === hash ? 'approved' : 'edited_after_approval';
}

/** Reads and validates a whole content directory. Pure file I/O, no env. */
export function loadContentSet(dir: string): ContentSet {
  const errors: string[] = [];
  const topicsRaw = readJson(path.join(dir, 'topics.json'));
  let topics: Record<string, string> = {};
  if (!topicsRaw.ok) errors.push(topicsRaw.error);
  else {
    const p = topicsSchema.safeParse(topicsRaw.value);
    if (p.success) topics = p.data;
    else errors.push('topics.json: must map topic tags to display names');
  }

  let review: ReviewEntry[] = [];
  const reviewFile = path.join(dir, 'review.json');
  if (fs.existsSync(reviewFile)) {
    const r = readJson(reviewFile);
    const p = r.ok ? reviewSchema.safeParse(r.value) : null;
    if (p?.success) review = p.data;
    else errors.push('review.json: could not be read; every item is treated as unapproved');
  }

  const seenIds = new Map<string, string>();

  const diagnostic = loadItem(
    path.join(dir, 'diagnostic.json'),
    diagnosticSchema,
    review.find((r) => r.day === 'diagnostic'),
    (d) => validateDiagnostic(d, topics, seenIds),
  );

  const lessons = new Map<number, LoadedItem<Lesson>>();
  for (const day of DAYS) {
    const item = loadItem(
      path.join(dir, 'lessons', lessonFileName(day)),
      lessonSchema,
      review.find((r) => r.day === day),
      (l) => validateLesson(l, topics, seenIds),
    );
    if (item.data && item.data.day !== day) {
      item.errors.push(`${lessonFileName(day)}: "day" is ${item.data.day}, expected ${day}`);
      item.status = 'invalid';
    }
    lessons.set(day, item);
  }

  return { dir, topics, diagnostic, lessons, review, errors };
}

function loadItem<T extends { fixture?: boolean; questions: Question[] }>(
  file: string,
  schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  review: ReviewEntry | undefined,
  validate: (data: T) => { errors: string[]; warnings: string[] },
): LoadedItem<T> {
  if (!fs.existsSync(file)) return { status: 'missing', errors: [], warnings: [], review, isFixture: false };
  const raw = readJson(file);
  if (!raw.ok) return { status: 'invalid', errors: [raw.error], warnings: [], review, isFixture: false };
  const parsed = schema.safeParse(raw.value);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (i) => `${path.basename(file)}: ${i.path.map(String).join('.')}: ${i.message}`,
    );
    return { status: 'invalid', errors, warnings: [], review, isFixture: false };
  }
  const data = parsed.data;
  const hash = contentHash(raw.value);
  const { errors, warnings } = validate(data);
  const isFixture = Boolean(data.fixture || data.questions.some((q) => q.fixture));
  return {
    status: errors.length ? 'invalid' : statusFor(hash, review),
    data,
    hash,
    errors,
    warnings,
    review,
    isFixture,
  };
}

/**
 * Whether an item may be shown to students. Production requires a matching
 * teacher approval; fixtures are never served when unreviewed content is off.
 */
export function isServable(item: LoadedItem<unknown>, allowUnreviewed: boolean): boolean {
  if (!item.data || item.status === 'invalid' || item.status === 'missing') return false;
  if (allowUnreviewed) return true;
  return item.status === 'approved' && !item.isFixture;
}

export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    stem: q.stem ?? '',
    options: { A: q.options.A ?? '', B: q.options.B ?? '', C: q.options.C ?? '', D: q.options.D ?? '' },
    answer: q.answer as OptionKey,
    explanation: q.explanation ?? '',
    topicTag: q.topicTag,
    passageId: q.passageId ?? null,
  };
}

export function toPublicLesson(lesson: Lesson, topics: Record<string, string>): PublicLesson {
  return {
    day: lesson.day,
    title: lesson.title,
    topicTag: lesson.topicTag,
    topicName: topics[lesson.topicTag] ?? lesson.topicTag,
    version: lesson.version,
    rule: { body: lesson.rule.body ?? '', example: lesson.rule.example ?? '' },
    passages: lesson.passages,
    questions: lesson.questions.map(toPublicQuestion),
  };
}
