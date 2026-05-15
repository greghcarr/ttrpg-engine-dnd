// Client-side text moderation.
//
// Uses the `obscenity` package's English preset (MIT-licensed, runs
// fully in-browser — no API call) with leet-speak resolution, confusable
// character normalization, and duplicate collapsing. The matcher
// returns specific match payloads so we can give the user a hint
// about why their input was flagged rather than a flat "no".
//
// The server (Supabase Postgres trigger) holds an independent, simpler
// blocklist as the final gate; this client check is for live UX, and
// must agree on the obvious-cases overlap so users aren't surprised
// by a server rejection.

import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
} from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export interface ModerationResult {
  readonly clean: boolean;
  readonly matchedTerms: ReadonlyArray<string>;
}

export const checkText = (text: string): ModerationResult => {
  if (!text) return { clean: true, matchedTerms: [] };
  const matches = matcher.getAllMatches(text, true);
  const uniqueTerms = new Set<string>();
  for (const m of matches) {
    const phrase = englishDataset.getPayloadWithPhraseMetadata(m).phraseMetadata?.originalWord;
    if (phrase) uniqueTerms.add(phrase);
  }
  return {
    clean: matches.length === 0,
    matchedTerms: [...uniqueTerms],
  };
};

export const containsProfanity = (text: string): boolean => !checkText(text).clean;
