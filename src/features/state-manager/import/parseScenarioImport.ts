import type { ScenarioCategory, StatusRow, SubFlow } from '../types';

type ImportFieldKey =
  | 'scenarioName'
  | 'scenarioDescription'
  | 'subFlowTitle'
  | 'msgStatus'
  | 'msgSubStatus'
  | 'channelPushNotification'
  | 'cdmNotification'
  | 'transactionStatus'
  | 'transactionStatusReason'
  | 'reasonDescription'
  | 'scenario'
  | 'responsibleComponent'
  | 'triggerReversal'
  | 'hasScenarioColumn'
  | 'hasResponsibleColumn'
  | 'hasTriggerReversalColumn';

type ScenarioAccumulator = ScenarioCategory & {
  subFlowMap: Map<string, SubFlow>;
};

export type SupportedImportColumn = {
  key: ImportFieldKey;
  required: boolean;
  description: string;
};

export type ScenarioImportSummary = {
  fileName: string;
  sheetName: string;
  scenarioCount: number;
  subFlowCount: number;
  rowCount: number;
  warningCount: number;
};

export type ScenarioImportParseResult = {
  scenarios: ScenarioCategory[];
  summary: ScenarioImportSummary;
  warnings: string[];
  errors: string[];
};

export const SUPPORTED_IMPORT_COLUMNS: SupportedImportColumn[] = [
  { key: 'scenarioName', required: true, description: 'Scenario tab name.' },
  { key: 'scenarioDescription', required: false, description: 'Scenario description shown above the sub-flows.' },
  { key: 'subFlowTitle', required: true, description: 'Sub-flow title rendered inside the scenario.' },
  { key: 'msgStatus', required: true, description: 'State Manager message status value.' },
  { key: 'msgSubStatus', required: true, description: 'State Manager message sub-status value.' },
  { key: 'channelPushNotification', required: false, description: 'Boolean flag for channel push notifications.' },
  { key: 'cdmNotification', required: false, description: 'Boolean flag for CDM notifications.' },
  { key: 'transactionStatus', required: true, description: 'Transaction status code.' },
  { key: 'transactionStatusReason', required: false, description: 'Transaction reason code or label.' },
  { key: 'reasonDescription', required: false, description: 'User-facing reason description.' },
  { key: 'scenario', required: false, description: 'Optional row-level scenario value when the Scenario column is shown.' },
  { key: 'responsibleComponent', required: false, description: 'Optional responsible component value.' },
  { key: 'triggerReversal', required: false, description: 'Optional boolean flag for reversal triggers.' },
  { key: 'hasScenarioColumn', required: false, description: 'Optional boolean flag to force the Scenario column on.' },
  { key: 'hasResponsibleColumn', required: false, description: 'Optional boolean flag to force the Responsible column on.' },
  { key: 'hasTriggerReversalColumn', required: false, description: 'Optional boolean flag to force the Trigger Reversal column on.' }
];

const REQUIRED_IMPORT_COLUMNS = SUPPORTED_IMPORT_COLUMNS.filter((column) => column.required).map((column) => column.key);

const COLUMN_ALIASES: Record<ImportFieldKey, readonly string[]> = {
  scenarioName: ['scenarioname'],
  scenarioDescription: ['scenariodescription'],
  subFlowTitle: ['subflowtitle', 'subflow'],
  msgStatus: ['msgstatus', 'messagestatus'],
  msgSubStatus: ['msgsubstatus', 'messagesubstatus'],
  channelPushNotification: ['channelpushnotification', 'channelpush'],
  cdmNotification: ['cdmnotification'],
  transactionStatus: ['transactionstatus', 'txnstatus'],
  transactionStatusReason: ['transactionstatusreason', 'txnstatusreason', 'txnreason'],
  reasonDescription: ['reasondescription'],
  scenario: ['scenario'],
  responsibleComponent: ['responsiblecomponent', 'responsible'],
  triggerReversal: ['triggerreversal'],
  hasScenarioColumn: ['hasscenariocolumn'],
  hasResponsibleColumn: ['hasresponsiblecolumn'],
  hasTriggerReversalColumn: ['hastriggerreversalcolumn']
};

const COLUMN_LABELS = new Map(SUPPORTED_IMPORT_COLUMNS.map((column) => [column.key, column.key]));

let localIdCounter = 0;

function createLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

function normalizeHeader(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function sanitizeText(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function sanitizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeGroupingKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildEmptySummary(fileName: string): ScenarioImportSummary {
  return {
    fileName,
    sheetName: '',
    scenarioCount: 0,
    subFlowCount: 0,
    rowCount: 0,
    warningCount: 0
  };
}

function isSupportedFile(fileName: string): boolean {
  return /\.(csv|xlsx|xls)$/i.test(fileName);
}

function indexHeaders(headers: string[]) {
  const headerIndexByKey = new Map<ImportFieldKey, number>();

  SUPPORTED_IMPORT_COLUMNS.forEach((column) => {
    const index = headers.findIndex((header) => COLUMN_ALIASES[column.key].includes(normalizeHeader(header)));
    if (index >= 0) {
      headerIndexByKey.set(column.key, index);
    }
  });

  return headerIndexByKey;
}

function getCellValue(row: unknown[], index?: number): string {
  if (index === undefined) {
    return '';
  }
  return sanitizeText(row[index]);
}

function parseBooleanCell(rawValue: string, label: string, warnings: string[]): boolean {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (['true', 'yes', 'y', '1', 'x'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'n', '0'].includes(normalized)) {
    return false;
  }
  warnings.push(`${label} uses "${rawValue}" and was treated as false.`);
  return false;
}

function collectIgnoredColumns(headers: string[]): string[] {
  const supportedAliases = new Set(Object.values(COLUMN_ALIASES).flat());
  return headers.filter((header) => {
    const normalized = normalizeHeader(header);
    return normalized && !supportedAliases.has(normalized);
  });
}

function toScenarioArray(accumulators: Map<string, ScenarioAccumulator>): ScenarioCategory[] {
  return Array.from(accumulators.values()).map(({ subFlowMap, ...scenario }) => ({
    ...scenario,
    subFlows: Array.from(subFlowMap.values())
  }));
}

export async function parseScenarioImportFile(file: File): Promise<ScenarioImportParseResult> {
  const summary = buildEmptySummary(file.name);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isSupportedFile(file.name)) {
    return {
      scenarios: [],
      summary,
      warnings,
      errors: ['Only .csv, .xlsx, and .xls files are supported.']
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const { read, utils } = await import('xlsx');
    const workbook = read(buffer, { type: 'array', raw: false });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return {
        scenarios: [],
        summary,
        warnings,
        errors: ['The uploaded file does not contain any sheets.']
      };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false
    });

    summary.sheetName = firstSheetName;

    if (workbook.SheetNames.length > 1) {
      warnings.push(`Imported the first sheet only: ${firstSheetName}.`);
    }

    if (matrix.length === 0) {
      return {
        scenarios: [],
        summary,
        warnings,
        errors: ['The uploaded file is empty.']
      };
    }

    const rawHeaders = (matrix[0] ?? []).map((value) => sanitizeText(value));
    if (!rawHeaders.some(Boolean)) {
      return {
        scenarios: [],
        summary,
        warnings,
        errors: ['The first row must contain column headers.']
      };
    }

    const headerIndexByKey = indexHeaders(rawHeaders);
    const missingHeaders = REQUIRED_IMPORT_COLUMNS.filter((key) => !headerIndexByKey.has(key));
    if (missingHeaders.length > 0) {
      return {
        scenarios: [],
        summary,
        warnings,
        errors: [`Missing required columns: ${missingHeaders.map((key) => COLUMN_LABELS.get(key) ?? key).join(', ')}.`]
      };
    }

    const ignoredColumns = collectIgnoredColumns(rawHeaders);
    if (ignoredColumns.length > 0) {
      warnings.push(`Ignored columns: ${ignoredColumns.join(', ')}.`);
    }

    const scenarioMap = new Map<string, ScenarioAccumulator>();
    const dataRows = matrix.slice(1);

    dataRows.forEach((rawRow, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const row = Array.isArray(rawRow) ? rawRow : [];
      const populatedValues = row.map((cell) => sanitizeText(cell)).filter(Boolean);
      if (populatedValues.length === 0) {
        return;
      }

      const scenarioName = getCellValue(row, headerIndexByKey.get('scenarioName'));
      const scenarioDescription = getCellValue(row, headerIndexByKey.get('scenarioDescription'));
      const subFlowTitle = getCellValue(row, headerIndexByKey.get('subFlowTitle'));
      const msgStatus = getCellValue(row, headerIndexByKey.get('msgStatus'));
      const msgSubStatus = getCellValue(row, headerIndexByKey.get('msgSubStatus'));
      const transactionStatus = getCellValue(row, headerIndexByKey.get('transactionStatus'));
      const transactionStatusReason = getCellValue(row, headerIndexByKey.get('transactionStatusReason'));
      const reasonDescription = getCellValue(row, headerIndexByKey.get('reasonDescription'));
      const scenarioValue = getCellValue(row, headerIndexByKey.get('scenario'));
      const responsibleComponent = getCellValue(row, headerIndexByKey.get('responsibleComponent'));
      const channelPushNotification = parseBooleanCell(
        getCellValue(row, headerIndexByKey.get('channelPushNotification')),
        `Row ${rowNumber}: channelPushNotification`,
        warnings
      );
      const cdmNotification = parseBooleanCell(
        getCellValue(row, headerIndexByKey.get('cdmNotification')),
        `Row ${rowNumber}: cdmNotification`,
        warnings
      );
      const triggerReversal = parseBooleanCell(
        getCellValue(row, headerIndexByKey.get('triggerReversal')),
        `Row ${rowNumber}: triggerReversal`,
        warnings
      );
      const hasScenarioColumn = parseBooleanCell(
        getCellValue(row, headerIndexByKey.get('hasScenarioColumn')),
        `Row ${rowNumber}: hasScenarioColumn`,
        warnings
      );
      const hasResponsibleColumn = parseBooleanCell(
        getCellValue(row, headerIndexByKey.get('hasResponsibleColumn')),
        `Row ${rowNumber}: hasResponsibleColumn`,
        warnings
      );
      const hasTriggerReversalColumn = parseBooleanCell(
        getCellValue(row, headerIndexByKey.get('hasTriggerReversalColumn')),
        `Row ${rowNumber}: hasTriggerReversalColumn`,
        warnings
      );

      if (!scenarioName) {
        errors.push(`Row ${rowNumber}: scenarioName is required.`);
        return;
      }

      if (!subFlowTitle) {
        errors.push(`Row ${rowNumber}: subFlowTitle is required.`);
        return;
      }

      if (!msgStatus) {
        warnings.push(`Row ${rowNumber}: msgStatus is blank and should be reviewed after import.`);
      }
      if (!msgSubStatus) {
        warnings.push(`Row ${rowNumber}: msgSubStatus is blank and should be reviewed after import.`);
      }
      if (!transactionStatus) {
        warnings.push(`Row ${rowNumber}: transactionStatus is blank and should be reviewed after import.`);
      }

      const scenarioKey = normalizeGroupingKey(scenarioName);
      let scenario = scenarioMap.get(scenarioKey);
      if (!scenario) {
        scenario = {
          id: createLocalId('scenario'),
          name: scenarioName,
          description: scenarioDescription,
          subFlows: [],
          subFlowMap: new Map<string, SubFlow>(),
          hasScenarioColumn: false,
          hasResponsibleColumn: false,
          hasTriggerReversalColumn: false
        };
        scenarioMap.set(scenarioKey, scenario);
      }

      if (!scenario.description && scenarioDescription) {
        scenario.description = scenarioDescription;
      }
      scenario.hasScenarioColumn = scenario.hasScenarioColumn || hasScenarioColumn || Boolean(scenarioValue.trim());
      scenario.hasResponsibleColumn =
        scenario.hasResponsibleColumn || hasResponsibleColumn || Boolean(responsibleComponent.trim());
      scenario.hasTriggerReversalColumn =
        scenario.hasTriggerReversalColumn || hasTriggerReversalColumn || triggerReversal;

      const subFlowKey = normalizeGroupingKey(subFlowTitle);
      let subFlow = scenario.subFlowMap.get(subFlowKey);
      if (!subFlow) {
        subFlow = {
          id: createLocalId('subflow'),
          title: subFlowTitle,
          rows: []
        };
        scenario.subFlowMap.set(subFlowKey, subFlow);
      }

      const nextRow: StatusRow = {
        id: createLocalId('row'),
        msgStatus,
        msgSubStatus,
        channelPushNotification,
        cdmNotification,
        transactionStatus,
        transactionStatusReason,
        reasonDescription,
        scenario: sanitizeOptionalText(scenarioValue),
        responsibleComponent: sanitizeOptionalText(responsibleComponent),
        triggerReversal: scenario.hasTriggerReversalColumn || triggerReversal ? triggerReversal : undefined
      };

      subFlow.rows.push(nextRow);
    });

    const scenarios = toScenarioArray(scenarioMap);
    if (scenarios.length === 0) {
      errors.push('No scenario rows were found in the uploaded file.');
    }

    summary.scenarioCount = scenarios.length;
    summary.subFlowCount = scenarios.reduce((count, scenario) => count + scenario.subFlows.length, 0);
    summary.rowCount = scenarios.reduce(
      (count, scenario) => count + scenario.subFlows.reduce((rowCount, subFlow) => rowCount + subFlow.rows.length, 0),
      0
    );
    summary.warningCount = warnings.length;

    return {
      scenarios,
      summary,
      warnings,
      errors
    };
  } catch (error) {
    return {
      scenarios: [],
      summary,
      warnings,
      errors: [error instanceof Error ? error.message : 'Unable to parse the uploaded scenario file.']
    };
  }
}

