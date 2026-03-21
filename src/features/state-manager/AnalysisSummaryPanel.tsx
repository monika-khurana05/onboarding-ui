import { Alert, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import type { AnalysisModel, AnalysisConflict, AnalysisEvidence } from './analysis/types';
import type { GraphValidationReport, ScenarioReplayReport } from './validation/types';

type AnalysisSummaryPanelProps = {
  analysis?: AnalysisModel | null;
  graphValidation?: GraphValidationReport | null;
  scenarioReplay?: ScenarioReplayReport | null;
  workflowKey?: string;
  scenarioCount: number;
  rowCount: number;
  newTransitions?: ReadonlySet<string>;
  presetBackedTransitionCount?: number;
  fallbackTransitionCount?: number;
};

const confidenceOrder: Record<AnalysisEvidence['confidence'], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2
};

const issueSeverityOrder = {
  ERROR: 0,
  WARN: 1
} as const;


function sortEvidence(items: readonly AnalysisEvidence[]): AnalysisEvidence[] {
  return [...items].sort((left, right) => {
    const confidenceDelta = confidenceOrder[left.confidence] - confidenceOrder[right.confidence];
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }
    const decisionDelta = left.decision.localeCompare(right.decision);
    if (decisionDelta !== 0) {
      return decisionDelta;
    }
    return left.chosenValue.localeCompare(right.chosenValue);
  });
}

function sortConflicts(items: readonly AnalysisConflict[]): AnalysisConflict[] {
  return [...items].sort((left, right) => {
    const severityDelta = issueSeverityOrder[left.severity] - issueSeverityOrder[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const codeDelta = left.code.localeCompare(right.code);
    if (codeDelta !== 0) {
      return codeDelta;
    }
    return left.message.localeCompare(right.message);
  });
}

export function AnalysisSummaryPanel({
  analysis,
  graphValidation,
  scenarioReplay,
  workflowKey,
  scenarioCount,
  rowCount,
  newTransitions,
  presetBackedTransitionCount = 0,
  fallbackTransitionCount = 0
}: AnalysisSummaryPanelProps) {
  const graphIssues = [...(graphValidation?.issues ?? [])].sort((left, right) => {
    const severityDelta = issueSeverityOrder[left.severity] - issueSeverityOrder[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const codeDelta = left.code.localeCompare(right.code);
    if (codeDelta !== 0) {
      return codeDelta;
    }
    return left.message.localeCompare(right.message);
  });
  const graphErrorCount = graphIssues.filter((issue) => issue.severity === 'ERROR').length;
  const graphWarningCount = graphIssues.length - graphErrorCount;
  const overviewWarningCount = (analysis?.warnings.length ?? 0) + graphWarningCount;
  const overviewConflictCount = analysis?.conflicts.length ?? 0;
  const topArchetype = analysis?.archetypeMatches[0]?.archetype;
  const evidenceItems = sortEvidence(analysis?.evidence ?? []).slice(0, 5);
  const conflictItems = sortConflicts(analysis?.conflicts ?? []);
  const warningItems = sortConflicts(analysis?.warnings ?? []);
  const replayFailures = (scenarioReplay?.results ?? []).filter((result) => !result.matched).slice(0, 3);
  const inferredTargets = [
    ['nextAfterInit', analysis?.inferredTargets.nextAfterInit],
    ['postSanctionsTarget', analysis?.inferredTargets.postSanctionsTarget],
    ['balanceTarget', analysis?.inferredTargets.balanceTarget],
    ['warehousedReleaseTarget', analysis?.inferredTargets.warehousedReleaseTarget]
  ] as const;
  const lifecycleFlags = analysis
    ? [
        ['SPM', analysis.lifecycleFlags.hasSpm],
        ['Sanctions', analysis.lifecycleFlags.hasSanctions],
        ['Balance Check', analysis.lifecycleFlags.hasBalanceCheck],
        ['Clearing', analysis.lifecycleFlags.hasClearing],
        ['Posting', analysis.lifecycleFlags.hasPosting],
        ['Warehousing', analysis.lifecycleFlags.hasWarehousing],
        ['Incoming Flow', analysis.lifecycleFlags.hasIncomingFlow],
        ['Outgoing Flow', analysis.lifecycleFlags.hasOutgoingFlow]
      ]
    : [];

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1">FSM Analysis Summary</Typography>
          <Typography variant="body2" color="text.secondary">
            Smart analysis explains what was inferred before FSM synthesis and how the generated graph validated.
          </Typography>
        </Stack>



        <Stack spacing={1.25}>
          <Typography variant="overline" color="text.secondary">
            Overview
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`Workflow: ${workflowKey?.trim() || 'Pending'}`} variant="outlined" />
            <Chip label={`${analysis?.discoveredStates.size ?? 0} discovered states`} variant="outlined" />
            <Chip label={`${scenarioCount} scenarios`} variant="outlined" />
            <Chip label={`${rowCount} rows`} variant="outlined" />
            <Chip label={`${newTransitions?.size ?? 0} introduced transitions`} variant="outlined" />
            <Chip label={`${presetBackedTransitionCount} KB-backed`} variant="outlined" color="info" />
            <Chip label={`${fallbackTransitionCount} fallback`} variant="outlined" color="primary" />
            <Chip label={`${overviewWarningCount} warnings`} variant="outlined" color={overviewWarningCount > 0 ? 'warning' : 'default'} />
            <Chip label={`${overviewConflictCount} conflicts`} variant="outlined" color={overviewConflictCount > 0 ? 'error' : 'default'} />
          </Stack>
          <Typography variant="body2">
            <strong>Top archetype:</strong> {topArchetype ?? 'Not inferred'}
          </Typography>
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography variant="overline" color="text.secondary">
            Inferred Targets
          </Typography>
          {analysis ? (
            <Stack spacing={0.75}>
              {inferredTargets.map(([label, value]) => (
                <Typography key={label} variant="body2">
                  <strong>{label}:</strong> {value ?? 'Not inferred'}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No inferred targets were captured.
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography variant="overline" color="text.secondary">
            Lifecycle Flags
          </Typography>
          {analysis ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {lifecycleFlags.map(([label, enabled]) => (
                <Chip
                  key={label}
                  label={`${label}: ${enabled ? 'Yes' : 'No'}`}
                  variant="outlined"
                  color={enabled ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Lifecycle flags unavailable.
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography variant="overline" color="text.secondary">
            Evidence
          </Typography>
          {evidenceItems.length > 0 ? (
            <Stack spacing={1}>
              {evidenceItems.map((item) => (
                <Paper key={`${item.decision}-${item.chosenValue}`} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      <strong>{item.decision}:</strong> {item.chosenValue}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Confidence: {item.confidence} | Sources: {item.sources.join(', ') || 'n/a'}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No evidence items available.
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography variant="overline" color="text.secondary">
            Warnings & Conflicts
          </Typography>
          {conflictItems.length === 0 && warningItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No analysis conflicts or warnings were reported.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {conflictItems.map((item) => (
                <Alert key={`${item.code}-${item.message}`} severity={item.severity === 'ERROR' ? 'error' : 'warning'}>
                  <Typography variant="body2">
                    <strong>{item.code}</strong>: {item.message}
                  </Typography>
                  {item.details?.length ? (
                    <Typography variant="caption" display="block">
                      {item.details.join(' | ')}
                    </Typography>
                  ) : null}
                  {item.severity === 'ERROR' ? (
                    <Typography variant="caption" display="block">
                      Generation-blocking issue.
                    </Typography>
                  ) : null}
                </Alert>
              ))}
              {warningItems.map((item) => (
                <Alert key={`${item.code}-${item.message}`} severity="warning">
                  <Typography variant="body2">
                    <strong>{item.code}</strong>: {item.message}
                  </Typography>
                  {item.details?.length ? (
                    <Typography variant="caption" display="block">
                      {item.details.join(' | ')}
                    </Typography>
                  ) : null}
                </Alert>
              ))}
            </Stack>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.25}>
          <Typography variant="overline" color="text.secondary">
            Validation Summary
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${graphIssues.length} graph issues`} variant="outlined" color={graphValidation?.hasErrors ? 'error' : 'default'} />
            <Chip label={`${scenarioReplay?.passedCount ?? 0} replay passed`} variant="outlined" color="success" />
            <Chip label={`${scenarioReplay?.failedCount ?? 0} replay failed`} variant="outlined" color={(scenarioReplay?.failedCount ?? 0) > 0 ? 'error' : 'default'} />
          </Stack>
          {graphIssues.length > 0 ? (
            <Stack spacing={1}>
              {graphIssues.slice(0, 4).map((issue) => (
                <Alert key={`${issue.code}-${issue.message}`} severity={issue.severity === 'ERROR' ? 'error' : 'warning'}>
                  <Typography variant="body2">
                    <strong>{issue.code}</strong>: {issue.message}
                  </Typography>
                  {issue.details?.length ? (
                    <Typography variant="caption" display="block">
                      {issue.details.join(' | ')}
                    </Typography>
                  ) : null}
                </Alert>
              ))}
            </Stack>
          ) : null}
          {replayFailures.length > 0 ? (
            <Stack spacing={1}>
              {replayFailures.map((result) => (
                <Alert key={`${result.scenarioName}-${result.subFlowTitle}`} severity="error">
                  <Typography variant="body2">
                    <strong>{result.scenarioName}</strong> / {result.subFlowTitle}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Missing transitions: {result.missingTransitions.join(', ') || 'none'}
                  </Typography>
                  {result.unexpectedStates.length > 0 ? (
                    <Typography variant="caption" display="block">
                      Unexpected states: {result.unexpectedStates.join(', ')}
                    </Typography>
                  ) : null}
                </Alert>
              ))}
            </Stack>
          ) : scenarioReplay ? (
            <Typography variant="body2" color="text.secondary">
              Scenario replay completed without failed sub-flows.
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}


