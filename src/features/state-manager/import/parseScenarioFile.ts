import { read, utils } from 'xlsx';
import {
  REQUIRED_SCENARIO_IMPORT_COLUMNS,
  resolveCanonicalHeader
} from './headerAliases';
import { normalizeImportRows } from './normalizeImportRows';
import type {
  RawImportRow,
  ScenarioImportColumnKey,
  ScenarioImportIssue,
  ScenarioImportParseResult,
  SupportedScenarioImportFileType
} from './types';

type RawRowMatrix = unknown[][];

type HeaderAnalysis = {
  issues: ScenarioImportIssue[];
};

type ExcelReadResult = {
  headers: string[];
  rawRows: RawImportRow[];
  issues: ScenarioImportIssue[];
};

function detectFileType(fileName: string): SupportedScenarioImportFileType {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith('.csv')) {
    return 'csv';
  }
  if (normalized.endsWith('.xlsx')) {
    return 'xlsx';
  }
  if (normalized.endsWith('.xls')) {
    return 'xls';
  }
  throw new Error('Only .csv, .xlsx, and .xls files are supported.');
}

function normalizeCellValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function readWithFileReader<T>(file: File, mode: 'text' | 'arrayBuffer'): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('The current environment cannot read uploaded files.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the uploaded file.'));
    reader.onload = () => resolve(reader.result as T);

    if (mode === 'arrayBuffer') {
      reader.readAsArrayBuffer(file);
      return;
    }

    reader.readAsText(file);
  });
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer);
  }

  return readWithFileReader<string>(file, 'text');
}

async function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  if (typeof FileReader !== 'undefined') {
    return readWithFileReader<ArrayBuffer>(file, 'arrayBuffer');
  }

  if (typeof file.text === 'function') {
    const text = await file.text();
    return new TextEncoder().encode(text).buffer;
  }

  throw new Error('The current environment cannot read uploaded files.');
}

function parseCsvMatrix(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      rows.push(currentRow);
      currentRow = [];
      if (character === '\r' && input[index + 1] === '\n') {
        index += 1;
      }
      continue;
    }

    currentCell += character;
  }

  if (inQuotes) {
    throw new Error('The CSV file contains an unmatched quote.');
  }

  currentRow.push(currentCell);
  if (rows.length === 0 || currentRow.some((value) => value !== '') || currentRow.length > 1) {
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => normalizeCellValue(value) !== ''));
}

function createUniqueHeaderKeys(headers: string[]): string[] {
  const headerCounts = new Map<string, number>();

  return headers.map((header) => {
    if (!header) {
      return '';
    }

    const nextCount = (headerCounts.get(header) ?? 0) + 1;
    headerCounts.set(header, nextCount);
    return nextCount === 1 ? header : `${header}__duplicate_${nextCount}`;
  });
}

function mapMatrixToRawRows(matrix: RawRowMatrix): { headers: string[]; rawRows: RawImportRow[] } {
  const [headerRow = [], ...dataRows] = matrix;
  const headers = headerRow.map((header) => normalizeCellValue(header));
  const uniqueHeaders = createUniqueHeaderKeys(headers);

  const rawRows = dataRows.map((row) => {
    const record: RawImportRow = {};
    uniqueHeaders.forEach((header, columnIndex) => {
      if (!header) {
        return;
      }
      record[header] = normalizeCellValue(Array.isArray(row) ? row[columnIndex] : undefined);
    });
    return record;
  });

  return {
    headers,
    rawRows
  };
}

function analyzeHeaders(headers: string[]): HeaderAnalysis {
  const issues: ScenarioImportIssue[] = [];

  if (headers.length === 0 || !headers.some(Boolean)) {
    return {
      issues: [
        {
          severity: 'ERROR',
          code: 'MISSING_HEADER_ROW',
          message: 'The uploaded file must include a header row.'
        }
      ]
    };
  }

  const canonicalHeaders = new Set<ScenarioImportColumnKey>();
  const duplicateMappings = new Map<ScenarioImportColumnKey, string[]>();
  const unknownHeaders: string[] = [];

  headers.forEach((header) => {
    const trimmedHeader = normalizeCellValue(header);
    if (!trimmedHeader) {
      return;
    }

    const canonicalHeader = resolveCanonicalHeader(trimmedHeader);
    if (!canonicalHeader) {
      unknownHeaders.push(trimmedHeader);
      return;
    }

    canonicalHeaders.add(canonicalHeader);
    const mappedHeaders = duplicateMappings.get(canonicalHeader) ?? [];
    mappedHeaders.push(trimmedHeader);
    duplicateMappings.set(canonicalHeader, mappedHeaders);
  });

  const missingColumns = REQUIRED_SCENARIO_IMPORT_COLUMNS.filter((column) => !canonicalHeaders.has(column));
  if (missingColumns.length > 0) {
    issues.push({
      severity: 'ERROR',
      code: 'MISSING_REQUIRED_COLUMNS',
      message: `Missing required columns: ${missingColumns.join(', ')}.`
    });
  }

  duplicateMappings.forEach((mappedHeaders, canonicalHeader) => {
    if (mappedHeaders.length < 2) {
      return;
    }

    issues.push({
      severity: 'WARN',
      code: 'DUPLICATE_MAPPED_COLUMNS',
      message: `Multiple columns map to ${canonicalHeader}: ${mappedHeaders.join(', ')}. The first non-empty value per row will be used.`
    });
  });

  if (unknownHeaders.length > 0) {
    issues.push({
      severity: 'WARN',
      code: 'IGNORED_COLUMNS',
      message: `Ignored unsupported columns: ${unknownHeaders.join(', ')}.`
    });
  }

  return { issues };
}

function selectWorksheetName(sheetNames: string[]): string | undefined {
  if (sheetNames.length === 0) {
    return undefined;
  }

  return sheetNames.find((sheetName) => sheetName.trim().toLowerCase() === 'scenarios') ?? sheetNames[0];
}

function readExcelRows(buffer: ArrayBuffer): ExcelReadResult {
  const workbook = read(buffer, {
    type: 'array',
    raw: false,
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    sheetStubs: false,
    WTF: false
  });
  const sheetName = selectWorksheetName(workbook.SheetNames);
  const issues: ScenarioImportIssue[] = [];

  if (!sheetName) {
    return { headers: [], rawRows: [], issues };
  }

  if (workbook.SheetNames.length > 1 && sheetName.trim().toLowerCase() !== 'scenarios') {
    issues.push({
      severity: 'WARN',
      code: 'MULTIPLE_WORKSHEETS',
      message: `Workbook contains multiple worksheets. Imported the first worksheet: ${sheetName}.`
    });
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { headers: [], rawRows: [], issues };
  }

  const matrix = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });

  const parsed = mapMatrixToRawRows(matrix);
  return {
    headers: parsed.headers,
    rawRows: parsed.rawRows,
    issues
  };
}

export async function parseScenarioFile(file: File): Promise<ScenarioImportParseResult> {
  const fileType = detectFileType(file.name);

  let headers: string[] = [];
  let rawRows: RawImportRow[] = [];
  let fileIssues: ScenarioImportIssue[] = [];

  if (fileType === 'csv') {
    const text = await readFileText(file);
    const matrix = parseCsvMatrix(text);
    const parsed = mapMatrixToRawRows(matrix);
    headers = parsed.headers;
    rawRows = parsed.rawRows;
  } else {
    const buffer = await readFileArrayBuffer(file);
    const parsed = readExcelRows(buffer);
    headers = parsed.headers;
    rawRows = parsed.rawRows;
    fileIssues = parsed.issues;
  }

  const headerAnalysis = analyzeHeaders(headers);
  const normalized = normalizeImportRows(rawRows);

  return {
    fileType,
    rawRows,
    normalizedRows: normalized.normalizedRows,
    issues: [...fileIssues, ...headerAnalysis.issues, ...normalized.issues]
  };
}






