import { formatDay, formatLongDay, formatTime, toLagosDate } from './time';
import type { DayState } from './unlock';

/** One state label per day row (spec 9.4), in the copy-deck wording. */
export function dayLabel(s: DayState): string {
  switch (s.state) {
    case 'done':
      return s.score != null ? `Done, ${s.score} of 10` : 'Done';
    case 'open':
      return 'Open now';
    case 'locked':
      return `Opens ${formatDay(s.unlocksAt)}, ${formatTime(s.unlocksAt)}`;
    case 'needs_payment':
      return 'Pay to unlock';
    case 'expired':
      return 'Access ended';
    case 'unavailable':
      return 'Being checked by our teacher';
  }
}

/** What to say about the day after a finished lesson. */
export function nextDayMessage(s: DayState, now: Date, priceLabel: string): string {
  switch (s.state) {
    case 'open':
    case 'done':
      return `Start Day ${s.day}`;
    case 'locked':
      return toLagosDate(s.unlocksAt) === toLagosDate(now)
        ? `Day ${s.day} opens today at ${formatTime(s.unlocksAt)}.`
        : `Day ${s.day} opens on ${formatDay(s.unlocksAt)} at ${formatTime(s.unlocksAt)}.`;
    case 'needs_payment':
      return `Pay ${priceLabel} to unlock Days 4 to 14.`;
    case 'expired':
      return 'Your access to this pack has ended.';
    case 'unavailable':
      return "The next lesson is being checked by our teacher and will appear shortly.";
  }
}

export function lessonsStartMessage(firstPaidUnlock: Date): string {
  return `Your lessons start on ${formatLongDay(firstPaidUnlock)} at ${formatTime(firstPaidUnlock)}.`;
}
