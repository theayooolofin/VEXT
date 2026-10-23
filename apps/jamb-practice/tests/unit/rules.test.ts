import { describe, expect, it } from 'vitest';
import { scoreDiagnostic } from '@/lib/diagnostic';
import { foundingPlacesLeft, isEnrollmentOpen, nairaFromKobo, openCohort, renderTemplate, resolvePriceKobo, whatsappLink } from '@/lib/rules';
import { DEFAULT_SETTINGS, mergeSettings } from '@/lib/settings';
import { lagosDateTime } from '@/lib/time';
import { parseCsv, toCsv } from '@/lib/csv';

const s = { ...DEFAULT_SETTINGS, founding_price_kobo: 30000, standard_price_kobo: 50000, founding_cap: 100 };
const beforeDeadline = lagosDateTime('2026-11-10', '12:00');
const afterDeadline = lagosDateTime('2026-11-16', '00:00');

describe('price resolution', () => {
  it('founding price before the deadline and under the cap', () => {
    expect(resolvePriceKobo(s, 0, beforeDeadline)).toEqual({ priceKobo: 30000, founding: true });
    expect(resolvePriceKobo(s, 99, beforeDeadline)).toEqual({ priceKobo: 30000, founding: true });
  });
  it('standard price at the cap', () => {
    expect(resolvePriceKobo(s, 100, beforeDeadline)).toEqual({ priceKobo: 50000, founding: false });
  });
  it('standard price after the deadline', () => {
    expect(resolvePriceKobo(s, 0, afterDeadline)).toEqual({ priceKobo: 50000, founding: false });
  });
  it('founding places left', () => {
    expect(foundingPlacesLeft(s, 40, beforeDeadline)).toBe(60);
    expect(foundingPlacesLeft(s, 140, beforeDeadline)).toBe(0);
    expect(foundingPlacesLeft(s, 0, afterDeadline)).toBe(0);
  });
});

describe('cohort assignment', () => {
  const c = {
    id: 'c1',
    startDate: '2026-11-16',
    active: true,
    enrollmentOpensAt: lagosDateTime('2026-11-02', '00:00'),
    enrollmentClosesAt: lagosDateTime('2026-11-15', '23:59'),
  };
  it('rejects a purchase before enrolment opens', () => {
    expect(isEnrollmentOpen(c, lagosDateTime('2026-11-01', '23:59'))).toBe(false);
    expect(openCohort([c], lagosDateTime('2026-11-01', '23:59'))).toBeNull();
  });
  it('accepts during enrolment', () => {
    expect(openCohort([c], lagosDateTime('2026-11-05', '10:00'))?.id).toBe('c1');
  });
  it('accepts exactly at close', () => {
    expect(isEnrollmentOpen(c, c.enrollmentClosesAt)).toBe(true);
  });
  it('rejects after close', () => {
    expect(isEnrollmentOpen(c, new Date(c.enrollmentClosesAt.getTime() + 1000))).toBe(false);
  });
  it('ignores inactive cohorts and picks the earliest start', () => {
    const later = { ...c, id: 'c2', startDate: '2026-12-01' };
    const off = { ...c, id: 'c0', startDate: '2026-11-10', active: false };
    expect(openCohort([later, off, c], lagosDateTime('2026-11-05', '10:00'))?.id).toBe('c1');
  });
});

describe('diagnostic scoring', () => {
  const input = {
    topicPriority: ['concord', 'tenses', 'vocabulary'],
    questions: [
      { id: 'q1', answer: 'A', topicTag: 'concord' },
      { id: 'q2', answer: 'B', topicTag: 'concord' },
      { id: 'q3', answer: 'C', topicTag: 'tenses' },
      { id: 'q4', answer: 'D', topicTag: 'tenses' },
      { id: 'q5', answer: 'A', topicTag: 'vocabulary' },
    ],
  };
  it('finds the weakest topic by ratio', () => {
    const r = scoreDiagnostic(input, { q1: 'A', q2: 'B', q3: 'A', q4: 'D', q5: 'B' });
    expect(r.score).toBe(3);
    expect(r.weakestTopic).toBe('vocabulary');
    expect(r.topicScores.tenses).toEqual({ correct: 1, asked: 2 });
  });
  it('breaks ties with topicPriority', () => {
    const r = scoreDiagnostic(input, { q1: 'A', q2: 'X', q3: 'C', q4: 'X', q5: 'A' });
    expect(r.weakestTopic).toBe('concord');
  });
  it('all correct: first priority topic', () => {
    const r = scoreDiagnostic(input, { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A' });
    expect(r.score).toBe(5);
    expect(r.weakestTopic).toBe('concord');
  });
  it('all wrong: first priority topic', () => {
    const r = scoreDiagnostic(input, {});
    expect(r.score).toBe(0);
    expect(r.weakestTopic).toBe('concord');
  });
});

describe('settings, templates and CSV', () => {
  it('ignores invalid stored settings', () => {
    const m = mergeSettings([
      { key: 'unlock_time_local', value: '25:00' },
      { key: 'founding_cap', value: 50 },
      { key: 'not_a_key', value: 1 },
    ]);
    expect(m.unlock_time_local).toBe('18:00');
    expect(m.founding_cap).toBe(50);
  });
  it('renders templates and wa.me links', () => {
    expect(renderTemplate('Hi {firstName}, Day {day}', { firstName: 'Ada', day: 5 })).toBe('Hi Ada, Day 5');
    expect(whatsappLink('+234 800 000 0000', 'Hi there')).toBe('https://wa.me/2348000000000?text=Hi%20there');
  });
  it('formats naira', () => {
    expect(nairaFromKobo(30000)).toBe('₦300');
  });
  it('round-trips CSV with quotes and newlines, and defuses formulas', () => {
    const rows = parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'say "hi"\nthere' }]);
    expect(toCsv(['v'], [['=SUM(A1)']])).toBe("v\r\n'=SUM(A1)\r\n");
  });
});
