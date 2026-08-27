import { DANGER_OBSERVATION_KEYS, type DangerObservationKey } from "./danger-observations.js";

export type NarrativePolarity = "PRESENT" | "ABSENT" | "NOT_ASSESSED" | "CONFLICT";
type Evidence = { present: boolean; absent: boolean };
type Spec = readonly [RegExp, RegExp, boolean];

const SPECS: Record<DangerObservationKey, Spec> = {
  cannotDrinkOrBreastfeed: [/\b(?:can|able to|still)\s+(?:drink|breastfeed)|\b(?:alert and drinking|drinking well)\b/i, /\b(?:cannot|can't|unable to)\s+(?:drink(?:\s+or\s+breastfeed)?|breastfeed)\b/i, true],
  vomitsEverything: [/\b(?:does not|doesn't|not) vomit everything\b|\bno vomiting\b/i, /\bvomits? everything\b/i, true],
  convulsions: [/\bno convulsions?\b/i, /\bconvulsions?\b/i, false],
  lethargicOrUnconscious: [/\b(?:not lethargic|conscious and alert|alert and responsive)\b/i, /\b(?:letharg(?:ic|y)(?:\s+or\s+unconscious(?:ness)?)?|unconscious(?:ness)?)\b/i, false],
  chestIndrawing: [/\b(?:no|without)\s+chest indrawing\b/i, /\bchest indrawing\b/i, false],
  stridorWhenCalm: [/\bno stridor\s+(?:when|while)\s+calm\b/i, /\bstridor\s+(?:when|while)\s+calm\b/i, false],
  lowOxygenOrCentralCyanosis: [/\b(?:no low oxygen|no central cyanosis|oxygen (?:is )?normal)\b/i, /\b(?:low oxygen(?:\s+or\s+central cyanosis)?|central cyanosis)\b/i, false],
};

const RESPIRATORY: Spec = [
  /\b(?:no|without)\s+(?:cough\s+or\s+difficult breathing|difficult breathing|cough)\b/i,
  /\b(?:cough\s+or\s+difficult breathing|difficult breathing|cough)\b/i,
  false,
];

function matches(text: string, pattern: RegExp) {
  const matcher = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
  const ranges: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) ranges.push({ start: match.index, end: match.index + match[0].length });
  return ranges;
}

function overlaps(left: { start: number; end: number }, right: { start: number; end: number }) {
  return left.start < right.end && right.start < left.end;
}

function quoteEnd(text: string, start: number, close: string) {
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] !== close) continue;
    if ((close === "'" || close === "’") && /[A-Za-z]/.test(text[index - 1] ?? "") && /[A-Za-z]/.test(text[index + 1] ?? "")) continue;
    return index;
  }
  return -1;
}

function maskQuotedSpans(text: string) {
  const closes: Record<string, string> = { "'": "'", "\"": "\"", "‘": "’", "“": "”" };
  let output = "";
  for (let index = 0; index < text.length;) {
    const close = closes[text[index] ?? ""];
    const boundary = index === 0 || !/[A-Za-z0-9]/.test(text[index - 1] ?? "");
    const end = close && boundary ? quoteEnd(text, index, close) : -1;
    if (end < 0) { output += text[index]; index += 1; continue; }
    output += " ".repeat(end - index + 1); index = end + 1;
  }
  return output;
}

function assertedText(text: string) {
  return maskQuotedSpans(text)
    .replace(/(?:^|[.!;])[^.!;?]*\?/g, " ")
    .replace(/\b(?:asked|asks?|wondered|wonders?)\s+whether\b[^.!?;]*/gi, " ")
    .replace(/\b(?:if|whether|assuming|suppose(?:\s+that)?)\b[^.!?;]*/gi, " ");
}

function nonAuthority(clause: string) {
  return /\b(?:training\s+example|for\s+example|this\s+example|(?:an\s+)?example\s+shows?|example\s+patient|hypothetical|the\s+(?:word|phrase)|says)\b|\bexample\s*:/i.test(clause)
    || /^\s*(?:check|screen)\b/i.test(clause)
    || /\b(?:may|might|possible|possibly|suspected|uncertain|cannot\s+rule\s+out)\b/i.test(clause);
}

function localPolarity(clause: string, occurrence: { start: number; end: number }, negatives: Array<{ start: number; end: number }>, inherent: boolean) {
  const suffix = clause.slice(occurrence.end);
  const prefix = clause.slice(0, occurrence.start);
  if (/^\s+(?:(?:is|was|were|are)\s+)?(?:documented|recorded)\s+(?:as\s+)?present\b/i.test(suffix)) return "PRESENT";
  if (/^\s+(?:(?:is|was|were|are)\s+)?(?:documented|recorded)\s+(?:as\s+)?absent\b/i.test(suffix)) return "ABSENT";
  if (/^\s+(?:(?:is|was|were|are)\s+)?(?:not\s+(?:assessed|recorded|provided|established)|unknown|documented|possible|suspected|uncertain|absent-minded)(?![-\w])/i.test(suffix)) return "NONE";
  if (negatives.some((range) => overlaps(range, occurrence))) return "ABSENT";
  if (/^\s+(?:(?:is|was|were|are)\s+)?not\s+(?:present|observed|documented)\b|^\s+denied\b/i.test(suffix)) return "ABSENT";
  if (/^\s+(?:(?:is|was|were|are)\s+)?(?:absent(?![-\w])|ruled\s+out\b)/i.test(suffix)) return "ABSENT";
  if (/^\s+(?:(?:is|was|were|are)\s+)?(?:present|observed|noted|reported)\b/i.test(suffix)) return "PRESENT";
  if (/\b(?:denied|no\s+history\s+of|no\s+evidence\s+of|no\s+clear(?:\s+evidence\s+of)?)\s+$/i.test(prefix)) return "ABSENT";
  if (/\b(?:has\s+(?:never|not)\s+(?:had|been)|never\s+had|(?:has|had)\s+not\s+shown|no\s+(?:reported|observed|noted|documented|recorded)|(?:does|did)\s+not\s+(?:have|show))\s+(?:a\s+)?$/i.test(prefix)) return "ABSENT";
  if (/\b(?:(?:does|did)\s+not\s+have|(?:is|was|are)\s+without|ruled\s+out)\s+(?:a\s+)?$/i.test(prefix)) return "ABSENT";
  if (/\b(?:has|had|with|shows?|is|was|are|observed|noted|reports?|reported)\s+(?:a\s+)?$/i.test(prefix)) return "PRESENT";
  if (/\b(?:documented|recorded)\s+$/i.test(prefix) && /^\s+(?:as\s+)?present\b/i.test(suffix)) return "PRESENT";
  if (/\b(?:documented|recorded)\s+$/i.test(prefix) && /^\s+(?:as\s+)?absent\b/i.test(suffix)) return "ABSENT";
  if (/\b(?:documented|recorded)\s+$/i.test(prefix)) return "NONE";
  return inherent ? "INHERENT" : null;
}

function splitPatternClause(clause: string, pattern: RegExp) {
  const parts = clause.split(/(\s*,\s*|\s+\b(?:and|or)\b\s+)/i);
  const segments: string[] = [];
  let current = parts[0] ?? "";
  for (let index = 1; index < parts.length; index += 2) {
    const next = parts[index + 1] ?? "";
    const delimiter = parts[index] ?? "";
    const crossesBoundary = matches(current + delimiter + next, pattern)
      .some((range) => range.start < current.length + delimiter.length && range.end > current.length);
    if (!crossesBoundary && matches(current, pattern).length && matches(next, pattern).length) { segments.push(current); current = next; }
    else current += (parts[index] ?? "") + next;
  }
  segments.push(current);
  return segments;
}

function observationKeys(text: string) {
  return DANGER_OBSERVATION_KEYS.filter((key) => matches(text, SPECS[key][1]).length);
}

function splitObservationClause(clause: string) {
  const parts = clause.split(/(\s*,\s*|\s+\b(?:and|or)\b\s+)/i);
  const segments: string[] = [];
  let current = parts[0] ?? "";
  for (let index = 1; index < parts.length; index += 2) {
    const next = parts[index + 1] ?? "";
    const left = observationKeys(current); const right = observationKeys(next);
    if (left.some((key) => right.some((other) => other !== key))) { segments.push(current); current = next; }
    else current += (parts[index] ?? "") + next;
  }
  segments.push(current);
  return segments;
}

function collect(text: string, spec: Spec, observationMode: boolean): Evidence {
  const evidence = { present: false, absent: false };
  text.split(/[.!?;]+|\bbut\b|\bhowever\b/gi).forEach((fullClause) => {
    const count = observationMode ? observationKeys(fullClause).length : matches(fullClause, spec[1]).length;
    const shared = count > 1 && /\b(?:(?:is|was|were|are)\s+)?absent(?![-\w])\s*$/i.test(fullClause);
    const segments = observationMode ? splitObservationClause(fullClause) : splitPatternClause(fullClause, spec[1]);
    segments.forEach((clause) => {
      if (nonAuthority(clause)) return;
      const negatives = matches(clause, spec[0]); const occurrences = matches(clause, spec[1]);
      if (negatives.some((range) => !occurrences.some((occurrence) => overlaps(range, occurrence)))) evidence.absent = true;
      occurrences.forEach((occurrence) => {
        const polarity = localPolarity(clause, occurrence, negatives, spec[2]);
        if (polarity === "NONE") return;
        if (polarity === "PRESENT") evidence.present = true;
        else if (polarity === "ABSENT" || shared) evidence.absent = true;
        else if (polarity === "INHERENT") evidence.present = true;
      });
    });
  });
  return evidence;
}

function resolve(evidence: Evidence): NarrativePolarity {
  if (evidence.present && evidence.absent) return "CONFLICT";
  return evidence.present ? "PRESENT" : evidence.absent ? "ABSENT" : "NOT_ASSESSED";
}

function allAbsent(text: string) {
  return text.split(/[.!;]+/).some((clause) => /^\s*all\s+(?:seven|7)\s+(?:structured\s+)?(?:danger and breathing\s+)?observations?\s+(?:were\s+|are\s+)?(?:recorded\s+)?absent\s*$/i.test(clause));
}

export function extractNarrativeAuthority(raw: string) {
  const text = assertedText(raw);
  const aggregateAbsent = allAbsent(text);
  const dangerObservations = Object.fromEntries(DANGER_OBSERVATION_KEYS.map((key) => {
    const value = resolve(collect(text, SPECS[key], true));
    if (!aggregateAbsent) return [key, value];
    return [key, value === "PRESENT" || value === "CONFLICT" ? "CONFLICT" : "ABSENT"];
  })) as Record<DangerObservationKey, NarrativePolarity>;
  return { dangerObservations, respiratoryConcern: resolve(collect(text, RESPIRATORY, false)) };
}
