import type { Activity, Locale } from './entries';

// Words about an activity shared by the activities list and an activity's own
// page, so the two describe it the same way.

const LABELS = {
  sv: {
    membersOnly: 'Endast medlemmar',
    cost: (kr: number) => `${kr} kr`,
    hours: 'tim',
    registration: { required: 'Anmälan krävs', optional: 'Anmälan möjlig' },
    seats: (n: number) => (n === 1 ? '1 plats' : `${n} platser`),
  },
  en: {
    membersOnly: 'Members only',
    cost: (kr: number) => `SEK ${kr}`,
    hours: 'h',
    registration: { required: 'Registration required', optional: 'Registration optional' },
    seats: (n: number) => (n === 1 ? '1 seat' : `${n} seats`),
  },
};

/** Where an activity's page is. */
export const activityHref = (id: string, lang: Locale) =>
  lang === 'sv' ? `/aktiviteter/${id}/` : `/en/activities/${id}/`;

/** 180 → "3 tim", 90 → "1 tim 30 min". */
export function duration(minutes: number, lang: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} ${LABELS[lang].hours}` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** Category · place · duration · members only · cost, whichever it has. */
export function activityMeta(activity: Activity, lang: Locale): string[] {
  const t = LABELS[lang];
  return [
    activity.category?.[lang],
    activity.place?.[lang] ?? activity.workshop?.name[lang],
    activity.durationMinutes ? duration(activity.durationMinutes, lang) : undefined,
    activity.membersOnly ? t.membersOnly : undefined,
    activity.cost !== undefined ? t.cost(activity.cost) : undefined,
  ].filter((part): part is string => Boolean(part));
}

/** "Anmälan krävs · 8 platser", or nothing when one doesn't sign up. */
export function activitySignUp(activity: Activity, lang: Locale): string[] {
  const t = LABELS[lang];
  if (activity.registration === 'none') return [];
  return [
    t.registration[activity.registration],
    activity.seats !== undefined ? t.seats(activity.seats) : undefined,
  ].filter((part): part is string => Boolean(part));
}

/** The description as one line of plain text, for a listing that clamps it. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
