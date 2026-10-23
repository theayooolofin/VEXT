import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Every table carries created_at and updated_at (spec section 6).
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const stamps = {
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const id = () => uuid('id').primaryKey().defaultRandom();

export const classLevel = pgEnum('class_level', ['ss3', 'ss2_or_below', 'graduate', 'other']);
export const productKind = pgEnum('product_kind', ['core', 'addon', 'mock']);
export const orderStatus = pgEnum('order_status', [
  'pending',
  'paid',
  'failed',
  'abandoned',
  'refunded',
  'needs_review',
  'duplicate',
]);
export const entitlementSource = pgEnum('entitlement_source', [
  'purchase',
  'referral_reward',
  'admin_comp',
]);
export const reportReason = pgEnum('report_reason', [
  'answer_seems_wrong',
  'question_unclear',
  'typo',
  'other',
]);
export const reportStatus = pgEnum('report_status', ['open', 'fixed', 'dismissed']);
export const referralStatus = pgEnum('referral_status', ['pending', 'rewarded', 'void']);
export const reminderKind = pgEnum('reminder_kind', ['unlock', 'missed']);
export const reminderChannel = pgEnum('reminder_channel', ['push', 'whatsapp_manual']);
export const supportType = pgEnum('support_type', ['refund', 'question', 'delete', 'recovery']);
export const supportStatus = pgEnum('support_status', ['open', 'done']);

export const students = pgTable(
  'students',
  {
    id: id(),
    firstName: text('first_name'),
    phoneE164: text('phone_e164').unique(),
    email: text('email'),
    classLevel: classLevel('class_level'),
    guardianConsent: boolean('guardian_consent').notNull().default(false),
    consentVersion: text('consent_version'),
    consentAt: ts('consent_at'),
    referralCode: text('referral_code').notNull().unique(),
    referredByStudentId: uuid('referred_by_student_id'),
    firstTouch: jsonb('first_touch').$type<FirstTouch>().notNull().default({}),
    anonId: text('anon_id'),
    lastSeenAt: ts('last_seen_at'),
    deletedAt: ts('deleted_at'),
    ...stamps,
  },
  (t) => [index('students_anon_idx').on(t.anonId), index('students_created_idx').on(t.createdAt)],
);

export type FirstTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ref?: string;
};

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: ts('expires_at').notNull(),
    userAgentClass: text('user_agent_class'),
    ipHash: text('ip_hash'),
    revokedAt: ts('revoked_at'),
    ...stamps,
  },
  (t) => [index('sessions_student_idx').on(t.studentId)],
);

export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    codeHash: text('code_hash').notNull(),
    usedAt: ts('used_at'),
    replacedAt: ts('replaced_at'),
    ...stamps,
  },
  (t) => [
    // Only one active code per student.
    uniqueIndex('recovery_codes_active_uq')
      .on(t.studentId)
      .where(sql`${t.usedAt} is null and ${t.replacedAt} is null`),
  ],
);

export const diagnosticAttempts = pgTable(
  'diagnostic_attempts',
  {
    id: id(),
    anonId: text('anon_id').notNull(),
    studentId: uuid('student_id').references(() => students.id),
    startedAt: ts('started_at'),
    completedAt: ts('completed_at'),
    score: integer('score').notNull(),
    answers: jsonb('answers').$type<Record<string, string>>().notNull(),
    topicScores: jsonb('topic_scores')
      .$type<Record<string, { correct: number; asked: number }>>()
      .notNull(),
    weakestTopic: text('weakest_topic'),
    contentVersion: integer('content_version').notNull(),
    firstTouch: jsonb('first_touch').$type<FirstTouch>().notNull().default({}),
    ...stamps,
  },
  (t) => [index('diag_anon_idx').on(t.anonId), index('diag_student_idx').on(t.studentId)],
);

export const products = pgTable('products', {
  sku: text('sku').primaryKey(),
  name: text('name').notNull(),
  priceKobo: integer('price_kobo').notNull(),
  active: boolean('active').notNull().default(true),
  kind: productKind('kind').notNull(),
  seats: integer('seats').notNull().default(1),
  accessDays: integer('access_days').notNull().default(90),
  ...stamps,
});

export const cohorts = pgTable('cohorts', {
  id: id(),
  name: text('name').notNull(),
  // Calendar date in Lagos. Paid Day 4 unlocks on this date.
  startDate: date('start_date', { mode: 'string' }).notNull(),
  enrollmentOpensAt: ts('enrollment_opens_at').notNull(),
  enrollmentClosesAt: ts('enrollment_closes_at').notNull(),
  active: boolean('active').notNull().default(true),
  ...stamps,
});

export const orders = pgTable(
  'orders',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    sku: text('sku')
      .notNull()
      .references(() => products.sku),
    amountKobo: integer('amount_kobo').notNull(),
    currency: text('currency').notNull().default('NGN'),
    status: orderStatus('status').notNull().default('pending'),
    provider: text('provider').notNull(),
    reference: text('reference').notNull().unique(),
    providerReference: text('provider_reference'),
    cohortId: uuid('cohort_id').references(() => cohorts.id),
    channel: text('channel').notNull().default('direct'),
    paidAt: ts('paid_at'),
    refundedAt: ts('refunded_at'),
    verifyPayload: jsonb('verify_payload'),
    isTest: boolean('is_test').notNull().default(false),
    ...stamps,
  },
  (t) => [
    index('orders_student_idx').on(t.studentId),
    index('orders_status_idx').on(t.status),
    index('orders_paid_at_idx').on(t.paidAt),
  ],
);

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    eventKey: text('event_key').notNull(),
    type: text('type').notNull(),
    reference: text('reference'),
    signatureValid: boolean('signature_valid').notNull(),
    payload: jsonb('payload'),
    receivedAt: ts('received_at').notNull().defaultNow(),
    processedAt: ts('processed_at'),
    result: text('result'),
    ...stamps,
  },
  (t) => [uniqueIndex('payment_events_key_uq').on(t.provider, t.eventKey)],
);

export const entitlements = pgTable(
  'entitlements',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    sku: text('sku')
      .notNull()
      .references(() => products.sku),
    orderId: uuid('order_id').references(() => orders.id),
    source: entitlementSource('source').notNull(),
    cohortId: uuid('cohort_id').references(() => cohorts.id),
    grantedAt: ts('granted_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    note: text('note'),
    ...stamps,
  },
  (t) => [
    index('entitlements_student_idx').on(t.studentId),
    // A payment can create at most one entitlement per order.
    uniqueIndex('entitlements_order_uq').on(t.orderId),
    // At most one live entitlement per student and product, whatever its source.
    uniqueIndex('entitlements_active_uq')
      .on(t.studentId, t.sku)
      .where(sql`${t.revokedAt} is null`),
  ],
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    day: integer('day').notNull(),
    lessonVersion: integer('lesson_version').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    completedAt: ts('completed_at'),
    score: integer('score'),
    attemptCount: integer('attempt_count').notNull().default(1),
    ...stamps,
  },
  (t) => [uniqueIndex('lesson_progress_uq').on(t.studentId, t.day)],
);

export const questionAttempts = pgTable(
  'question_attempts',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    day: integer('day').notNull(),
    questionId: text('question_id').notNull(),
    lessonVersion: integer('lesson_version').notNull(),
    attemptNo: integer('attempt_no').notNull(),
    selectedOption: text('selected_option').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    timeMs: integer('time_ms'),
    clientId: text('client_id').notNull().unique(),
    ...stamps,
  },
  (t) => [
    uniqueIndex('question_attempts_uq').on(t.studentId, t.questionId, t.attemptNo),
    index('question_attempts_day_idx').on(t.day),
  ],
);

export const questionReports = pgTable(
  'question_reports',
  {
    id: id(),
    studentId: uuid('student_id').references(() => students.id),
    day: integer('day').notNull(),
    questionId: text('question_id').notNull(),
    lessonVersion: integer('lesson_version').notNull(),
    reason: reportReason('reason').notNull(),
    message: text('message'),
    status: reportStatus('status').notNull().default('open'),
    resolvedAt: ts('resolved_at'),
    resolutionNote: text('resolution_note'),
    ...stamps,
  },
  (t) => [index('question_reports_status_idx').on(t.status)],
);

export const referrals = pgTable('referrals', {
  id: id(),
  referrerStudentId: uuid('referrer_student_id')
    .notNull()
    .references(() => students.id),
  referredStudentId: uuid('referred_student_id')
    .notNull()
    .references(() => students.id),
  orderId: uuid('order_id').references(() => orders.id),
  status: referralStatus('status').notNull().default('pending'),
  rewardedAt: ts('rewarded_at'),
  voidReason: text('void_reason'),
  ...stamps,
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: id(),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgentClass: text('user_agent_class'),
  lastSuccessAt: ts('last_success_at'),
  failedCount: integer('failed_count').notNull().default(0),
  revokedAt: ts('revoked_at'),
  ...stamps,
});

export const reminderLog = pgTable(
  'reminder_log',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    day: integer('day').notNull(),
    kind: reminderKind('kind').notNull(),
    channel: reminderChannel('channel').notNull(),
    sentAt: ts('sent_at').notNull().defaultNow(),
    result: text('result'),
    ...stamps,
  },
  (t) => [uniqueIndex('reminder_log_uq').on(t.studentId, t.day, t.kind, t.channel)],
);

export const events = pgTable(
  'events',
  {
    id: id(),
    occurredAt: ts('occurred_at').notNull().defaultNow(),
    anonId: text('anon_id'),
    studentId: uuid('student_id'),
    name: text('name').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
    path: text('path'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    userAgentClass: text('user_agent_class'),
    ...stamps,
  },
  (t) => [
    index('events_name_time_idx').on(t.name, t.occurredAt),
    index('events_anon_idx').on(t.anonId),
  ],
);

export const adSpend = pgTable('ad_spend', {
  id: id(),
  date: date('date', { mode: 'string' }).notNull(),
  channel: text('channel').notNull(),
  amountKobo: integer('amount_kobo').notNull(),
  note: text('note'),
  ...stamps,
});

export const supportRequests = pgTable('support_requests', {
  id: id(),
  studentId: uuid('student_id').references(() => students.id),
  phoneHint: text('phone_hint'),
  type: supportType('type').notNull(),
  message: text('message'),
  status: supportStatus('status').notNull().default('open'),
  handledAt: ts('handled_at'),
  ...stamps,
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  ...stamps,
});

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: ts('window_start').notNull(),
    count: integer('count').notNull().default(0),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const adminAuditLog = pgTable('admin_audit_log', {
  id: id(),
  at: ts('at').notNull().defaultNow(),
  action: text('action').notNull(),
  target: text('target'),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  ipHash: text('ip_hash'),
  ...stamps,
});

export type Student = typeof students.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type Cohort = typeof cohorts.$inferSelect;
export type Product = typeof products.$inferSelect;
