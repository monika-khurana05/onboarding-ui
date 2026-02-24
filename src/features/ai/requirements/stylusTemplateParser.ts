export type StylusTemplateSections = {
  epicTitle: string;
  descriptionText: string; // section 1
  inScopeText: string; // section 2
  acceptanceCriteriaText: string; // section 4
  rawText: string;
  warnings: string[];
};

const DESCRIPTION_HEADING = /^\s*1\s*\.\s*Description\b/i;
const IN_SCOPE_HEADING = /^\s*2\s*\.\s*In\s+Scope\b/i;
const ACCEPTANCE_CRITERIA_HEADING = /^\s*4\s*\.\s*Acceptance\s+Criteria\b/i;

const EPIC_TITLE_REGEX = /EPIC:\s*(.+)/i;

function normalizeLine(line: string): string {
  const leadingMatch = line.match(/^\s*/);
  const leading = (leadingMatch ? leadingMatch[0] : '').replace(/\t/g, ' ').replace(/[ \f\v]+/g, ' ');
  const rest = line.slice(leading.length);
  const normalizedRest = rest.replace(/\s+/g, ' ').trimEnd();
  return `${leading}${normalizedRest}`.trimEnd();
}

function normalizeText(rawText: string): string {
  return rawText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .join('\n');
}

function findHeadingIndex(lines: string[], pattern: RegExp): number {
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function findEpicTitle(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(EPIC_TITLE_REGEX);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  const fallback = lines.find((line) => line.trim().length > 0);
  return fallback ? fallback.trim() : '';
}

function sliceSection(lines: string[], startIndex: number, endIndex: number): string {
  if (startIndex < 0) {
    return '';
  }
  const start = startIndex + 1;
  const end = endIndex >= 0 ? endIndex : lines.length;
  return lines.slice(start, end).join('\n').trim();
}

function nextHeadingIndex(currentIndex: number, candidates: number[]): number {
  const next = candidates.filter((index) => index > currentIndex).sort((a, b) => a - b)[0];
  return next ?? -1;
}

export function parseStylusTemplateText(rawText: string): StylusTemplateSections {
  const normalizedText = normalizeText(rawText);
  const lines = normalizedText.split('\n');

  const descriptionIndex = findHeadingIndex(lines, DESCRIPTION_HEADING);
  const inScopeIndex = findHeadingIndex(lines, IN_SCOPE_HEADING);
  const acceptanceIndex = findHeadingIndex(lines, ACCEPTANCE_CRITERIA_HEADING);

  const descriptionText = sliceSection(
    lines,
    descriptionIndex,
    nextHeadingIndex(descriptionIndex, [inScopeIndex, acceptanceIndex])
  );
  const inScopeText = sliceSection(lines, inScopeIndex, nextHeadingIndex(inScopeIndex, [acceptanceIndex]));
  const acceptanceCriteriaText = sliceSection(lines, acceptanceIndex, -1);

  const warnings: string[] = [];
  if (descriptionIndex < 0 || !descriptionText) {
    warnings.push('Missing section: Description');
  }
  if (inScopeIndex < 0 || !inScopeText) {
    warnings.push('Missing section: In Scope');
  }
  if (acceptanceIndex < 0 || !acceptanceCriteriaText) {
    warnings.push('Missing section: Acceptance Criteria');
  }

  return {
    epicTitle: findEpicTitle(lines),
    descriptionText,
    inScopeText,
    acceptanceCriteriaText,
    rawText: normalizedText,
    warnings
  };
}
