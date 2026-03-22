import { REQUIRED_SCENARIO_IMPORT_COLUMNS, resolveCanonicalHeader } from './headerAliases';
import type {
  NormalizedImportRow,
  RawImportRow,
  ScenarioImportColumnKey,
  ScenarioImportIssue
} from './types';

type NormalizeImportRowsResult = {
  normalizedRows: NormalizedImportRow[];
  issues: ScenarioImportIssue[];
};

type BooleanImportField =
  | 'channelPushNotification'
  | 'cdmNotification'
  | 'triggerReversal'
  | 'hasScenarioColumn'
  | 'hasResponsibleColumn'
  | 'hasTriggerReversalColumn';

type NumberImportField = 'scenarioOrder' | 'subFlowOrder' | 'rowOrder';

const TRUE_VALUES = new Set(['true', 'yes', 'y', '1', 'checked', 'x']);
const FALSE_VALUES = new Set(['false', 'no', 'n', '0', 'unchecked']);

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function asOptionalString(value: unknown): string | undefined {
  const text = asTrimmedString(value);
  return text ? text : undefined;
}

function toUppercaseText(value: unknown): string {
  return asTrimmedString(value).toUpperCase();
}

function buildCanonicalRow(rawRow: RawImportRow): Partial<Record<ScenarioImportColumnKey, unknown>> {
  const canonicalRow: Partial<Record<ScenarioImportColumnKey, unknown>> = {};

  Object.entries(rawRow).forEach(([header, value]) => {
    const canonicalHeader = resolveCanonicalHeader(header.replace(/__duplicate_\d+$/, ''));
    if (!canonicalHeader) {
      return;
    }

    const existingValue = canonicalRow[canonicalHeader];
    if (existingValue === undefined || asTrimmedString(existingValue) === '') {
      canonicalRow[canonicalHeader] = value;
    }
  });

  return canonicalRow;
}

function coerceBoolean(
  value: unknown,
  rowNumber: number,
  field: BooleanImportField,
  issues: ScenarioImportIssue[]
): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  const text = asTrimmedString(value);
  if (!text) {
    return undefined;
  }

  const normalized = text.toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  issues.push({
    rowNumber,
    severity: 'WARN',
    code: 'INVALID_BOOLEAN',
    message: `Row ${rowNumber}: ${field} uses "${text}". Expected true/false, yes/no, y/n, 1/0, checked/unchecked, or x; defaulted to false.`
  });
  return false;
}

function coerceNumber(
  value: unknown,
  rowNumber: number,
  field: NumberImportField,
  issues: ScenarioImportIssue[]
): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = asTrimmedString(value);
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  issues.push({
    rowNumber,
    severity: 'WARN',
    code: 'INVALID_NUMBER',
    message: `Row ${rowNumber}: ${field} uses "${text}" and was ignored.`
  });
  return undefined;
}

export function normalizeImportRows(rawRows: RawImportRow[]): NormalizeImportRowsResult {
  const normalizedRows: NormalizedImportRow[] = [];
  const issues: ScenarioImportIssue[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const canonicalRow = buildCanonicalRow(rawRow);
    const hasAnyRawContent = Object.values(rawRow).some((value) => asTrimmedString(value) !== '');

    if (!hasAnyRawContent) {
      return;
    }

    const missingRequired = REQUIRED_SCENARIO_IMPORT_COLUMNS.filter((field) => asTrimmedString(canonicalRow[field]) === '');

    if (missingRequired.length === REQUIRED_SCENARIO_IMPORT_COLUMNS.length) {
      const hasAnyRecognizedOptionalContent = Object.entries(canonicalRow).some(
        ([field, value]) =>
          !REQUIRED_SCENARIO_IMPORT_COLUMNS.includes(field as ScenarioImportColumnKey) && asTrimmedString(value) !== ''
      );

      if (hasAnyRecognizedOptionalContent) {
        issues.push({
          rowNumber,
          severity: 'WARN',
          code: 'SKIPPED_BLANK_REQUIRED_FIELDS',
          message: `Row ${rowNumber}: ignored because all required fields are blank.`
        });
      }
      return;
    }

    if (missingRequired.length > 0) {
      issues.push({
        rowNumber,
        severity: 'ERROR',
        code: 'MISSING_REQUIRED_FIELDS',
        message: `Row ${rowNumber}: missing required field(s): ${missingRequired.join(', ')}.`
      });
      return;
    }

    normalizedRows.push({
      rowNumber,
      scenarioName: asTrimmedString(canonicalRow.scenarioName),
      scenarioDescription: asTrimmedString(canonicalRow.scenarioDescription),
      subFlowTitle: asTrimmedString(canonicalRow.subFlowTitle),
      msgStatus: toUppercaseText(canonicalRow.msgStatus),
      msgSubStatus: toUppercaseText(canonicalRow.msgSubStatus),
      channelPushNotification:
        coerceBoolean(canonicalRow.channelPushNotification, rowNumber, 'channelPushNotification', issues) ?? false,
      cdmNotification: coerceBoolean(canonicalRow.cdmNotification, rowNumber, 'cdmNotification', issues) ?? false,
      transactionStatus: toUppercaseText(canonicalRow.transactionStatus),
      transactionStatusReason: asTrimmedString(canonicalRow.transactionStatusReason),
      reasonDescription: asTrimmedString(canonicalRow.reasonDescription),
      scenario: asOptionalString(canonicalRow.scenario),
      responsibleComponent: asOptionalString(canonicalRow.responsibleComponent),
      triggerReversal: coerceBoolean(canonicalRow.triggerReversal, rowNumber, 'triggerReversal', issues),
      scenarioOrder: coerceNumber(canonicalRow.scenarioOrder, rowNumber, 'scenarioOrder', issues),
      subFlowOrder: coerceNumber(canonicalRow.subFlowOrder, rowNumber, 'subFlowOrder', issues),
      rowOrder: coerceNumber(canonicalRow.rowOrder, rowNumber, 'rowOrder', issues),
      hasScenarioColumn: coerceBoolean(canonicalRow.hasScenarioColumn, rowNumber, 'hasScenarioColumn', issues),
      hasResponsibleColumn: coerceBoolean(
        canonicalRow.hasResponsibleColumn,
        rowNumber,
        'hasResponsibleColumn',
        issues
      ),
      hasTriggerReversalColumn: coerceBoolean(
        canonicalRow.hasTriggerReversalColumn,
        rowNumber,
        'hasTriggerReversalColumn',
        issues
      )
    });
  });

  return {
    normalizedRows,
    issues
  };
}


