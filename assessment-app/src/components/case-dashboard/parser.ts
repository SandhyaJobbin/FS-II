import { Tab } from '../../types';

/** Fixed set of evidence sections rendered for every case, in this order, regardless of what the source data contains. */
export const SECTION_KEYS = ['identity', 'review', 'booking', 'property', 'connected', 'reports'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface Entity {
  /** e.g. "User A" / "Account B" when a tab compares multiple people; null for a single unnamed entity */
  label: string | null;
  fields: Record<string, string>;
  lists: Record<string, string[]>;
  /** Free-text lines that don't match a known field — preserved so no evidence is ever silently dropped */
  notes: string[];
}

export interface SectionData {
  tabNames: string[];
  entities: Entity[];
}

const LIST_KEYS = new Set(['availableFacilities', 'notListed']);

const KEY_MAP: Record<string, string> = {
  'reviewer name': 'name',
  'name': 'name',
  'rating': 'rating',
  'review date': 'reviewDate',
  'review posted': 'reviewPosted',
  'review comment': 'comment',
  'review': 'comment',
  'photos attached': 'photosAttached',
  'account created': 'accountCreated',
  'account created date': 'accountCreated',
  'account age': 'accountAge',
  'previous reviews': 'previousReviews',
  'previous reports': 'previousReports',
  'device used': 'deviceUsed',
  'device information': 'deviceInfo',
  'booking status': 'bookingStatus',
  'check-in date': 'checkIn',
  'check-out date': 'checkOut',
  'stay dates': 'stayDates',
  'stay duration': 'stayDuration',
  'total stay duration': 'stayDuration',
  'stay completed': 'stayCompleted',
  'room booked': 'roomBooked',
  'room category': 'roomCategory',
  'room categories': 'roomCategory',
  'property name': 'propertyName',
  'property type': 'propertyType',
  'report reason': 'reportReason',
  'customer feedback': 'customerFeedback',
  'reservation': 'reservation',
  'available facilities': 'availableFacilities',
  'not listed': 'notListed',
};

const ENTITY_HEADER_RE = /^(User|Account|Guest|Reviewer|Property)\s+\S+$/i;

function hasContent(e: Entity): boolean {
  return Object.keys(e.fields).length > 0 || Object.keys(e.lists).length > 0 || e.notes.length > 0;
}

/** Parses one tab's raw text into one or more entities (usually one; multiple when the case compares accounts side by side). */
export function parseTabEntities(content: string): Entity[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const entities: Entity[] = [];
  let current: Entity = { label: null, fields: {}, lists: {}, notes: [] };

  let activeListKey: string | null = null;
  let activeFieldKey: string | null = null; // known field awaiting value-on-next-line
  let activeNoteContinuation = false; // unknown key awaiting value-on-next-line

  for (const line of lines) {
    const colonIdx = line.indexOf(':');

    if (colonIdx === -1) {
      if (activeListKey) {
        current.lists[activeListKey].push(line.replace(/^[-•]\s*/, ''));
        continue;
      }
      if (activeFieldKey) {
        current.fields[activeFieldKey] = current.fields[activeFieldKey]
          ? current.fields[activeFieldKey] + ' ' + line
          : line;
        continue;
      }
      if (activeNoteContinuation && current.notes.length) {
        current.notes[current.notes.length - 1] += ' ' + line;
        continue;
      }
      if (ENTITY_HEADER_RE.test(line) && hasContent(current)) {
        entities.push(current);
        current = { label: line, fields: {}, lists: {}, notes: [] };
        continue;
      }
      if (!hasContent(current) && !current.label) {
        current.label = line;
        continue;
      }
      current.notes.push(line);
      continue;
    }

    activeListKey = null;
    activeFieldKey = null;
    activeNoteContinuation = false;

    const rawKey = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim().replace(/^"|"$/g, '');
    const normKey = KEY_MAP[rawKey.toLowerCase()];

    if (normKey && LIST_KEYS.has(normKey)) {
      current.lists[normKey] = current.lists[normKey] || [];
      activeListKey = normKey;
      continue;
    }

    if (normKey) {
      current.fields[normKey] = rawVal;
      if (!rawVal) activeFieldKey = normKey;
      continue;
    }

    current.notes.push(rawVal ? `${rawKey}: ${rawVal}` : `${rawKey}:`);
    if (!rawVal) activeNoteContinuation = true;
  }

  if (hasContent(current) || current.label) entities.push(current);
  return entities;
}

const SECTION_RULES: [RegExp, SectionKey][] = [
  [/report|complaint|flag/i, 'reports'],
  [/propert(y|ies)|listing/i, 'property'],
  [/book(ing)?|reservation/i, 'booking'],
  [/review/i, 'review'],
  [/connect|device|network/i, 'connected'],
  [/account|profile|reviewer|activity/i, 'identity'],
];

export function classifyTab(tabName: string): SectionKey {
  for (const [re, key] of SECTION_RULES) {
    if (re.test(tabName)) return key;
  }
  return 'identity';
}

/** Buckets every tab into the fixed six sections. Sections with no matching tab still get an entry (empty entities). */
export function mergeSections(tabs: Tab[]): Record<SectionKey, SectionData> {
  const result = Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { tabNames: [], entities: [] } as SectionData])
  ) as Record<SectionKey, SectionData>;

  const sorted = [...tabs].sort((a, b) => a.position - b.position);
  for (const tab of sorted) {
    const key = classifyTab(tab.name);
    const entities = parseTabEntities(tab.content);
    result[key].tabNames.push(tab.name);
    result[key].entities.push(...entities);
  }
  return result;
}
