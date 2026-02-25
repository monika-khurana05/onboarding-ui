import type {
  MappingSummaryJson,
  OpenQuestion,
  WorkspaceArtifactsBundle
} from './workspaceArtifactsTypes';

export type ArtifactKind =
  | 'mappingSummary'
  | 'overallSummary'
  | 'gapAnalysis'
  | 'openQuestions'
  | 'unknown';

export function detectArtifactKind(fileName: string, content: string): ArtifactKind {
  const name = fileName.toLowerCase();
  if (name.includes('mapping_summary') || name.includes('mapping-summary')) return 'mappingSummary';
  if (name.includes('gap_analysis') || name.includes('gap-analysis')) return 'gapAnalysis';
  if (name.includes('open_questions') || name.includes('open-questions')) return 'openQuestions';
  if (name.includes('summary') || content.toLowerCase().includes('classification summary')) return 'overallSummary';
  // JSON heuristic
  if (content.trim().startsWith('{') && content.includes('"classification_results"')) return 'mappingSummary';
  return 'unknown';
}

export function parseMappingSummaryJson(raw: string): MappingSummaryJson {
  const json = JSON.parse(raw);
  if (!json || !Array.isArray(json.classification_results)) {
    throw new Error('Invalid mapping_summary.json: missing classification_results[]');
  }
  return json as MappingSummaryJson;
}

export function parseOpenQuestionsMarkdown(md: string): OpenQuestion[] {
  // Your screenshot shows sections like:
  // - "User-ID Change during Session: ... "
  //   - "Point: ..."
  // We'll parse bullets into questions.
  const lines = md.split('\n').map((line) => line.trim());
  const questions: OpenQuestion[] = [];
  let currentTitle = '';
  let currentPoint = '';
  let idx = 1;

  const flush = () => {
    if (!currentTitle) return;
    questions.push({
      id: `Q-${String(idx++).padStart(3, '0')}`,
      question: currentTitle.replace(/^[*-]\s*/, '').trim(),
      context: currentPoint ? currentPoint.replace(/^[*-]\s*Point:\s*/i, '').trim() : undefined
    });
    currentTitle = '';
    currentPoint = '';
  };

  for (const line of lines) {
    if (!line) continue;

    // treat bold headings or bullet headings as question titles
    const isTitle =
      /^[-*\u2022]\s+/.test(line) ||
      /^[A-Z].+:\s/.test(line) ||
      /^\*\*.+\*\*:\s*/.test(line);

    if (isTitle && /Point:/i.test(line)) {
      currentPoint = line;
      continue;
    }

    if (isTitle) {
      flush();
      currentTitle = line;
      continue;
    }

    if (/^point:/i.test(line)) {
      currentPoint = line;
      continue;
    }
  }
  flush();
  return questions;
}

export function createEmptyBundle(args: {
  countryCode: string;
  region: string;
  flow: 'INCOMING' | 'OUTGOING';
  uploadedAtIso: string;
}): WorkspaceArtifactsBundle {
  return {
    meta: args,
    files: {}
  };
}
