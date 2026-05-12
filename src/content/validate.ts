import type { ResolvedContent } from './pack.js';

export interface ContentValidationIssue {
  readonly path: string;
  readonly message: string;
}

export const validateCrossReferences = (
  content: ResolvedContent,
): ReadonlyArray<ContentValidationIssue> => {
  const issues: ContentValidationIssue[] = [];

  for (const [id, background] of content.backgrounds) {
    if (!content.feats.has(background.originFeatId)) {
      issues.push({
        path: `backgrounds/${id}/originFeatId`,
        message: `Origin feat "${background.originFeatId}" not found`,
      });
    }
  }

  for (const [id, subclass] of content.subclasses) {
    if (!content.classes.has(subclass.parentClassId)) {
      issues.push({
        path: `subclasses/${id}/parentClassId`,
        message: `Parent class "${subclass.parentClassId}" not found`,
      });
    }
  }

  return issues;
};
