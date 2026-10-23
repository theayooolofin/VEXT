import { z } from 'zod';

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

// Shapes are loose on purpose: the checks in contentRules.ts report every
// problem with a clear message instead of stopping at the first one.
export const questionSchema = z.object({
  id: z.string(),
  stem: z.string().optional(),
  options: z.record(z.string(), z.string()),
  answer: z.string(),
  explanation: z.string().optional(),
  difficulty: z.string().optional(),
  topicTag: z.string(),
  passageId: z.string().nullable().optional(),
  heroEligible: z.boolean().optional(),
  fixture: z.boolean().optional(),
});

export const lessonSchema = z.object({
  day: z.number().int(),
  slug: z.string(),
  title: z.string(),
  topicTag: z.string(),
  version: z.number().int().min(1),
  rule: z.object({ body: z.string().optional(), example: z.string().optional() }),
  passages: z
    .array(z.object({ id: z.string(), title: z.string().optional(), body: z.string() }))
    .default([]),
  questions: z.array(questionSchema),
  fixture: z.boolean().optional(),
});

export const diagnosticSchema = z.object({
  version: z.number().int().min(1),
  topicPriority: z.array(z.string()),
  questions: z.array(questionSchema),
  fixture: z.boolean().optional(),
});

export const topicsSchema = z.record(z.string(), z.string());

export const reviewEntrySchema = z.object({
  day: z.union([z.number().int().min(1).max(14), z.literal('diagnostic')]),
  status: z.literal('teacher_approved'),
  reviewer: z.string().min(1),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const reviewSchema = z.array(reviewEntrySchema);

export type Question = z.infer<typeof questionSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type ReviewEntry = z.infer<typeof reviewEntrySchema>;

/** The shape the browser receives for a lesson or diagnostic question. */
export type PublicQuestion = {
  id: string;
  stem: string;
  options: Record<OptionKey, string>;
  answer: OptionKey;
  explanation: string;
  topicTag: string;
  passageId: string | null;
};

export type PublicLesson = {
  day: number;
  title: string;
  topicTag: string;
  topicName: string;
  version: number;
  rule: { body: string; example: string };
  passages: { id: string; title?: string; body: string }[];
  questions: PublicQuestion[];
};
