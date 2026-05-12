import type { ResolvedContent } from './pack.js';

export interface ContentValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly suggestion?: string;
}

const SUGGESTION_DISTANCE_THRESHOLD = 3;

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = i - 1;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, last + cost);
      last = temp;
    }
  }
  return prev[b.length]!;
};

const suggestSimilar = (target: string, candidates: Iterable<string>): string | undefined => {
  let best: { id: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = levenshtein(target, candidate);
    if (distance <= SUGGESTION_DISTANCE_THRESHOLD && (best === undefined || distance < best.distance)) {
      best = { id: candidate, distance };
    }
  }
  return best?.id;
};

const buildIssue = (
  path: string,
  message: string,
  missingId: string,
  candidates: Iterable<string>,
): ContentValidationIssue => {
  const suggestion = suggestSimilar(missingId, candidates);
  return suggestion !== undefined
    ? { path, message, suggestion: `Did you mean "${suggestion}"?` }
    : { path, message };
};

export const validateCrossReferences = (
  content: ResolvedContent,
): ReadonlyArray<ContentValidationIssue> => {
  const issues: ContentValidationIssue[] = [];

  for (const [id, background] of content.backgrounds) {
    if (!content.feats.has(background.originFeatId)) {
      issues.push(
        buildIssue(
          `backgrounds.${id}.originFeatId`,
          `Origin feat "${background.originFeatId}" not found`,
          background.originFeatId,
          content.feats.keys(),
        ),
      );
    }
  }

  for (const [id, subclass] of content.subclasses) {
    if (!content.classes.has(subclass.parentClassId)) {
      issues.push(
        buildIssue(
          `subclasses.${id}.parentClassId`,
          `Parent class "${subclass.parentClassId}" not found`,
          subclass.parentClassId,
          content.classes.keys(),
        ),
      );
    }
  }

  return issues;
};
