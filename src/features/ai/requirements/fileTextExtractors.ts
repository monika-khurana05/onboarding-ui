import * as mammoth from 'mammoth';

export async function extractTextFromFile(file: File): Promise<{ text: string; warnings: string[] }> {
  const name = file.name.toLowerCase();
  const warnings: string[] = [];

  if (name.endsWith('.docx')) {
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    const text = (res.value || '').trim();
    if (!text) warnings.push('DOCX extracted empty text.');
    return { text, warnings };
  }

  if (name.endsWith('.json') || name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
    const text = (await file.text()).trim();
    if (!text) warnings.push('File is empty.');
    return { text, warnings };
  }

  if (name.endsWith('.pdf')) {
    warnings.push('PDF parsing not supported in UI demo. Export Workspaces output as .json or .md or .docx.');
    return { text: '', warnings };
  }

  warnings.push('Unknown file type. Treated as text.');
  return { text: (await file.text()).trim(), warnings };
}
