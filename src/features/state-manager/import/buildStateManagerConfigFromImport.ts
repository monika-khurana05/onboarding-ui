import type { FlowDirection, ScenarioCategory, StatusRow, SubFlow } from '../types';
import type {
  NormalizedImportRow,
  ScenarioImportBuildResult,
  ScenarioImportIssue
} from './types';

type SubFlowAccumulator = {
  title: string;
  firstSeen: number;
  subFlowOrder?: number;
  rows: NormalizedImportRow[];
};

type ScenarioAccumulator = {
  name: string;
  firstSeen: number;
  scenarioOrder?: number;
  rows: NormalizedImportRow[];
  subFlows: Map<string, SubFlowAccumulator>;
};

type TextStats = {
  count: number;
  firstSeen: number;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function compareWithOptionalOrder(
  leftOrder: number | undefined,
  rightOrder: number | undefined,
  leftFirstSeen: number,
  rightFirstSeen: number,
  leftLabel: string,
  rightLabel: string
): number {
  const leftHasOrder = leftOrder !== undefined;
  const rightHasOrder = rightOrder !== undefined;

  if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1;
  }
  if (leftFirstSeen !== rightFirstSeen) {
    return leftFirstSeen - rightFirstSeen;
  }
  return leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' });
}

function buildLogicalRowKey(row: NormalizedImportRow): string {
  return [
    normalizeKey(row.scenarioName),
    normalizeKey(row.subFlowTitle),
    row.msgStatus,
    row.msgSubStatus,
    row.channelPushNotification ? '1' : '0',
    row.cdmNotification ? '1' : '0',
    row.transactionStatus,
    normalizeKey(row.transactionStatusReason),
    normalizeKey(row.reasonDescription),
    normalizeKey(row.scenario ?? ''),
    normalizeKey(row.responsibleComponent ?? ''),
    row.triggerReversal === undefined ? '' : row.triggerReversal ? '1' : '0'
  ].join('|');
}

function pickMostCommonDescription(rows: NormalizedImportRow[]): { description: string; hasConflict: boolean } {
  const counts = new Map<string, TextStats>();

  rows.forEach((row, index) => {
    const description = row.scenarioDescription.trim();
    if (!description) {
      return;
    }

    const existing = counts.get(description);
    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(description, {
      count: 1,
      firstSeen: index
    });
  });

  if (counts.size === 0) {
    return {
      description: '',
      hasConflict: false
    };
  }

  const [selectedDescription] = [...counts.entries()].sort((left, right) => {
    if (left[1].count !== right[1].count) {
      return right[1].count - left[1].count;
    }
    if (left[1].firstSeen !== right[1].firstSeen) {
      return left[1].firstSeen - right[1].firstSeen;
    }
    return left[0].localeCompare(right[0], undefined, { sensitivity: 'base' });
  })[0];

  return {
    description: selectedDescription,
    hasConflict: counts.size > 1
  };
}

function collectExplicitFlagValues(
  rows: NormalizedImportRow[],
  selector: (row: NormalizedImportRow) => boolean | undefined
): Set<boolean> {
  const values = new Set<boolean>();
  rows.forEach((row) => {
    const value = selector(row);
    if (value !== undefined) {
      values.add(value);
    }
  });
  return values;
}

function collectDistinctOrderValues(
  rows: NormalizedImportRow[],
  selector: (row: NormalizedImportRow) => number | undefined
): number[] {
  return [...new Set(rows.map(selector).filter((value): value is number => value !== undefined))].sort((a, b) => a - b);
}

function getPreferredOrderValue(
  rows: NormalizedImportRow[],
  selector: (row: NormalizedImportRow) => number | undefined
): number | undefined {
  const values = collectDistinctOrderValues(rows, selector);
  return values[0];
}

function sortRows(rows: NormalizedImportRow[]): NormalizedImportRow[] {
  return [...rows].sort((left, right) => {
    if (left.rowOrder !== undefined && right.rowOrder !== undefined && left.rowOrder !== right.rowOrder) {
      return left.rowOrder - right.rowOrder;
    }
    if ((left.rowOrder !== undefined) !== (right.rowOrder !== undefined)) {
      return left.rowOrder !== undefined ? -1 : 1;
    }
    return left.rowNumber - right.rowNumber;
  });
}

function summarizeIssues(issues: ScenarioImportIssue[]) {
  return {
    warningCount: issues.filter((issue) => issue.severity === 'WARN').length,
    errorCount: issues.filter((issue) => issue.severity === 'ERROR').length
  };
}

export function buildStateManagerConfigFromImportRows(
  rows: NormalizedImportRow[],
  countryCode: string,
  flowDirection: FlowDirection
): ScenarioImportBuildResult {
  void countryCode;
  void flowDirection;

  const issues: ScenarioImportIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      severity: 'ERROR',
      code: 'NO_VALID_ROWS',
      message: 'No valid scenario rows remain after validation.'
    });

    return {
      scenarios: [],
      issues,
      summary: {
        scenarioCount: 0,
        subFlowCount: 0,
        rowCount: 0,
        ...summarizeIssues(issues)
      }
    };
  }

  const duplicateRowMap = new Map<string, number>();
  const scenarioMap = new Map<string, ScenarioAccumulator>();

  rows.forEach((row, index) => {
    const logicalKey = buildLogicalRowKey(row);
    const firstDuplicateRow = duplicateRowMap.get(logicalKey);
    if (firstDuplicateRow !== undefined) {
      issues.push({
        rowNumber: row.rowNumber,
        severity: 'WARN',
        code: 'DUPLICATE_LOGICAL_ROW',
        message: `Row ${row.rowNumber}: duplicates logical row ${firstDuplicateRow} for scenario "${row.scenarioName}" / sub-flow "${row.subFlowTitle}".`
      });
    } else {
      duplicateRowMap.set(logicalKey, row.rowNumber);
    }

    const scenarioKey = normalizeKey(row.scenarioName);
    let scenarioAccumulator = scenarioMap.get(scenarioKey);
    if (!scenarioAccumulator) {
      scenarioAccumulator = {
        name: row.scenarioName,
        firstSeen: index,
        scenarioOrder: row.scenarioOrder,
        rows: [],
        subFlows: new Map<string, SubFlowAccumulator>()
      };
      scenarioMap.set(scenarioKey, scenarioAccumulator);
    }

    scenarioAccumulator.rows.push(row);
    if (row.scenarioOrder !== undefined) {
      scenarioAccumulator.scenarioOrder = Math.min(scenarioAccumulator.scenarioOrder ?? row.scenarioOrder, row.scenarioOrder);
    }

    const subFlowKey = normalizeKey(row.subFlowTitle);
    let subFlowAccumulator = scenarioAccumulator.subFlows.get(subFlowKey);
    if (!subFlowAccumulator) {
      subFlowAccumulator = {
        title: row.subFlowTitle,
        firstSeen: index,
        subFlowOrder: row.subFlowOrder,
        rows: []
      };
      scenarioAccumulator.subFlows.set(subFlowKey, subFlowAccumulator);
    }

    subFlowAccumulator.rows.push(row);
    if (row.subFlowOrder !== undefined) {
      subFlowAccumulator.subFlowOrder = Math.min(subFlowAccumulator.subFlowOrder ?? row.subFlowOrder, row.subFlowOrder);
    }
  });

  const sortedScenarioAccumulators = [...scenarioMap.values()].sort((left, right) =>
    compareWithOptionalOrder(
      left.scenarioOrder,
      right.scenarioOrder,
      left.firstSeen,
      right.firstSeen,
      left.name,
      right.name
    )
  );

  const scenarios: ScenarioCategory[] = sortedScenarioAccumulators.map((scenarioAccumulator, scenarioIndex) => {
    const { description, hasConflict } = pickMostCommonDescription(scenarioAccumulator.rows);
    if (hasConflict) {
      issues.push({
        severity: 'WARN',
        code: 'CONFLICTING_SCENARIO_DESCRIPTIONS',
        message: `Scenario "${scenarioAccumulator.name}" has conflicting descriptions. Using the most common non-empty description.`
      });
    }

    const scenarioOrderValues = collectDistinctOrderValues(scenarioAccumulator.rows, (row) => row.scenarioOrder);
    if (scenarioOrderValues.length > 1) {
      issues.push({
        severity: 'WARN',
        code: 'CONFLICTING_SCENARIO_ORDER',
        message: `Scenario "${scenarioAccumulator.name}" has conflicting scenarioOrder values (${scenarioOrderValues.join(', ')}). Using the lowest value.`
      });
      scenarioAccumulator.scenarioOrder = getPreferredOrderValue(scenarioAccumulator.rows, (row) => row.scenarioOrder);
    }

    const explicitScenarioValues = collectExplicitFlagValues(scenarioAccumulator.rows, (row) => row.hasScenarioColumn);
    if (explicitScenarioValues.size > 1) {
      issues.push({
        severity: 'WARN',
        code: 'CONFLICTING_HAS_SCENARIO_COLUMN',
        message: `Scenario "${scenarioAccumulator.name}" has conflicting hasScenarioColumn values.`
      });
    }

    const explicitResponsibleValues = collectExplicitFlagValues(
      scenarioAccumulator.rows,
      (row) => row.hasResponsibleColumn
    );
    if (explicitResponsibleValues.size > 1) {
      issues.push({
        severity: 'WARN',
        code: 'CONFLICTING_HAS_RESPONSIBLE_COLUMN',
        message: `Scenario "${scenarioAccumulator.name}" has conflicting hasResponsibleColumn values.`
      });
    }

    const explicitTriggerValues = collectExplicitFlagValues(
      scenarioAccumulator.rows,
      (row) => row.hasTriggerReversalColumn
    );
    if (explicitTriggerValues.size > 1) {
      issues.push({
        severity: 'WARN',
        code: 'CONFLICTING_HAS_TRIGGER_REVERSAL_COLUMN',
        message: `Scenario "${scenarioAccumulator.name}" has conflicting hasTriggerReversalColumn values.`
      });
    }

    const hasScenarioColumn =
      explicitScenarioValues.has(true) || scenarioAccumulator.rows.some((row) => Boolean(row.scenario));
    const hasResponsibleColumn =
      explicitResponsibleValues.has(true) || scenarioAccumulator.rows.some((row) => Boolean(row.responsibleComponent));
    const hasTriggerReversalColumn =
      explicitTriggerValues.has(true) || scenarioAccumulator.rows.some((row) => row.triggerReversal === true);

    const sortedSubFlowAccumulators = [...scenarioAccumulator.subFlows.values()].sort((left, right) =>
      compareWithOptionalOrder(
        left.subFlowOrder,
        right.subFlowOrder,
        left.firstSeen,
        right.firstSeen,
        left.title,
        right.title
      )
    );

    const subFlows: SubFlow[] = sortedSubFlowAccumulators.map((subFlowAccumulator, subFlowIndex) => {
      const subFlowOrderValues = collectDistinctOrderValues(subFlowAccumulator.rows, (row) => row.subFlowOrder);
      if (subFlowOrderValues.length > 1) {
        issues.push({
          severity: 'WARN',
          code: 'CONFLICTING_SUBFLOW_ORDER',
          message: `Scenario "${scenarioAccumulator.name}" / sub-flow "${subFlowAccumulator.title}" has conflicting subFlowOrder values (${subFlowOrderValues.join(', ')}). Using the lowest value.`
        });
        subFlowAccumulator.subFlowOrder = getPreferredOrderValue(subFlowAccumulator.rows, (row) => row.subFlowOrder);
      }

      const rowsForSubFlow = sortRows(subFlowAccumulator.rows);
      const statusRows: StatusRow[] = rowsForSubFlow.map((row, rowIndex) => ({
        id: `import-scenario-${scenarioIndex + 1}-subflow-${subFlowIndex + 1}-row-${rowIndex + 1}`,
        msgStatus: row.msgStatus,
        msgSubStatus: row.msgSubStatus,
        channelPushNotification: row.channelPushNotification,
        cdmNotification: row.cdmNotification,
        transactionStatus: row.transactionStatus,
        transactionStatusReason: row.transactionStatusReason,
        reasonDescription: row.reasonDescription,
        scenario: row.scenario,
        responsibleComponent: row.responsibleComponent,
        triggerReversal: hasTriggerReversalColumn ? Boolean(row.triggerReversal) : undefined
      }));

      return {
        id: `import-scenario-${scenarioIndex + 1}-subflow-${subFlowIndex + 1}`,
        title: subFlowAccumulator.title,
        rows: statusRows
      };
    });

    return {
      id: `import-scenario-${scenarioIndex + 1}`,
      name: scenarioAccumulator.name,
      description,
      subFlows,
      hasScenarioColumn,
      hasResponsibleColumn,
      hasTriggerReversalColumn
    };
  });

  const summary = {
    scenarioCount: scenarios.length,
    subFlowCount: scenarios.reduce((count, scenario) => count + scenario.subFlows.length, 0),
    rowCount: scenarios.reduce(
      (count, scenario) => count + scenario.subFlows.reduce((rowCount, subFlow) => rowCount + subFlow.rows.length, 0),
      0
    ),
    ...summarizeIssues(issues)
  };

  if (summary.rowCount === 0) {
    issues.push({
      severity: 'ERROR',
      code: 'NO_VALID_ROWS',
      message: 'No valid scenario rows remain after validation.'
    });
    summary.errorCount += 1;
  }

  return {
    scenarios,
    issues,
    summary
  };
}
