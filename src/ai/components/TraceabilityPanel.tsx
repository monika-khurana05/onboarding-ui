import { Alert, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import type { CapabilityKey } from '../../models/snapshot';
import type { PojoMappingSheet, RequirementsAnalysis, SyntheticDataPlan } from '../types';

export type TraceabilityPanelProps = {
  analysis: RequirementsAnalysis | null;
  mappingSheet: PojoMappingSheet | null;
  mappingAppliedRows: number;
  syntheticPlan: SyntheticDataPlan | null;
  suggestedCapabilities: CapabilityKey[];
  suggestedValidations: string[];
  suggestedEnrichments: string[];
  appliedCapabilities: Set<CapabilityKey>;
  appliedValidations: Set<string>;
  appliedEnrichments: Set<string>;
  capabilityLabels: Map<CapabilityKey, string>;
  validationLabels: Map<string, string>;
  enrichmentLabels: Map<string, string>;
};

function renderSuggestionChips<T extends string>(
  suggestions: T[],
  applied: Set<T>,
  labelLookup: Map<T, string>
) {
  if (suggestions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No AI suggestions loaded yet.
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {suggestions.map((key) => {
        const label = labelLookup.get(key) ?? key;
        const isApplied = applied.has(key);
        return (
          <Chip
            key={key}
            label={label}
            size="small"
            color={isApplied ? 'success' : 'default'}
            variant={isApplied ? 'filled' : 'outlined'}
          />
        );
      })}
    </Stack>
  );
}

export function TraceabilityPanel({
  analysis,
  mappingSheet,
  mappingAppliedRows,
  syntheticPlan,
  suggestedCapabilities,
  suggestedValidations,
  suggestedEnrichments,
  appliedCapabilities,
  appliedValidations,
  appliedEnrichments,
  capabilityLabels,
  validationLabels,
  enrichmentLabels
}: TraceabilityPanelProps) {
  const requirementsCount = analysis?.requirements.length ?? 0;
  const repoImpactCount = analysis?.traceability?.repoImpact?.length ?? 0;
  const testCaseCount = analysis?.traceability?.testCases?.length ?? 0;
  const appliedCapabilityCount = suggestedCapabilities.filter((key) => appliedCapabilities.has(key)).length;
  const appliedValidationCount = suggestedValidations.filter((id) => appliedValidations.has(id)).length;
  const appliedEnrichmentCount = suggestedEnrichments.filter((id) => appliedEnrichments.has(id)).length;
  const mappingRows = mappingSheet?.rows.length ?? 0;
  const syntheticCount = syntheticPlan?.scenarios.length ?? 0;

  const hasAnyData =
    requirementsCount > 0 ||
    suggestedCapabilities.length > 0 ||
    suggestedValidations.length > 0 ||
    suggestedEnrichments.length > 0 ||
    mappingRows > 0 ||
    syntheticCount > 0 ||
    repoImpactCount > 0 ||
    testCaseCount > 0;

  if (!hasAnyData) {
    return <Alert severity="info">No AI traceability data loaded yet.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            Requirements
          </Typography>
          <Typography variant="h6">{requirementsCount}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            Repo Impact
          </Typography>
          <Typography variant="h6">{repoImpactCount}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            Test Cases
          </Typography>
          <Typography variant="h6">{testCaseCount}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            Mapping Sheet
          </Typography>
          <Typography variant="h6">{mappingRows} rows</Typography>
          <Typography variant="body2" color="text.secondary">
            Applied: {Math.min(mappingAppliedRows, mappingRows)}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            Smoke Pack
          </Typography>
          <Typography variant="h6">{syntheticCount} scenarios</Typography>
        </Paper>
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="subtitle2">Suggested Domain Capabilities</Typography>
          <Typography variant="caption" color="text.secondary">
            Applied {appliedCapabilityCount}/{suggestedCapabilities.length}
          </Typography>
        </Stack>
        {renderSuggestionChips(suggestedCapabilities, appliedCapabilities, capabilityLabels)}
      </Stack>

      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="subtitle2">Suggested Validations</Typography>
          <Typography variant="caption" color="text.secondary">
            Applied {appliedValidationCount}/{suggestedValidations.length}
          </Typography>
        </Stack>
        {renderSuggestionChips(suggestedValidations, appliedValidations, validationLabels)}
      </Stack>

      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="subtitle2">Suggested Enrichments</Typography>
          <Typography variant="caption" color="text.secondary">
            Applied {appliedEnrichmentCount}/{suggestedEnrichments.length}
          </Typography>
        </Stack>
        {renderSuggestionChips(suggestedEnrichments, appliedEnrichments, enrichmentLabels)}
      </Stack>

      {repoImpactCount > 0 ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Traceability Impact</Typography>
          <Stack spacing={0.5}>
            {analysis?.traceability?.repoImpact?.map((impact) => (
              <Typography key={`${impact.repo}-${impact.type}`} variant="body2" color="text.secondary">
                {impact.repo} ({impact.type}): {impact.reason}
              </Typography>
            ))}
          </Stack>
        </Stack>
      ) : null}

      {testCaseCount > 0 ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Suggested Tests</Typography>
          <Stack spacing={0.5}>
            {analysis?.traceability?.testCases?.map((testCase) => (
              <Typography key={testCase.id} variant="body2" color="text.secondary">
                {testCase.id} ({testCase.type}): {testCase.title}
              </Typography>
            ))}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
