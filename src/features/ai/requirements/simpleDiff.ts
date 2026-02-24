export type TextDiff = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

export function diffLines(oldText: string, newText: string): TextDiff {
  const toLines = (text: string) =>
    text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const oldLines = toLines(oldText);
  const newLines = toLines(newText);

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const added = newLines.filter((line) => !oldSet.has(line));
  const removed = oldLines.filter((line) => !newSet.has(line));
  const unchanged = newLines.filter((line) => oldSet.has(line));

  return { added, removed, unchanged };
}
