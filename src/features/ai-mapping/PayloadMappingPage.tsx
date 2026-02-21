import {
  Alert,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CountryCodeField } from '../../components/CountryCodeField';
import { SectionCard } from '../../components/SectionCard';
import { PojoMappingGrid } from '../../ai/components/PojoMappingGrid';
import { mockAiService } from '../../ai/services/mockAiService';
import { loadPojoMapping, savePojoMapping } from '../../ai/storage/aiSessionStorage';
import type { PojoMappingSheet } from '../../ai/types';
import { setStage } from '../../status/onboardingStatusStorage';

type RowStatus = 'pending' | 'applied' | 'question' | 'ignored';

const inputFormats = ['PAIN.001 XML', 'Client JSON', 'Proprietary'] as const;

function sanitizeFileToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'mapping';
  }
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function PayloadMappingPage() {
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow') === 'OUTGOING' ? 'OUTGOING' : 'INCOMING';
  const queryCountry = searchParams.get('country');
  const [countryCode, setCountryCode] = useState(() => queryCountry?.toUpperCase() ?? '');
  const [sheetId, setSheetId] = useState('xpay-canonical-v1');
  const [inputFormat, setInputFormat] = useState<(typeof inputFormats)[number]>(inputFormats[0]);
  const [mapping, setMapping] = useState<PojoMappingSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<'storage' | 'mock' | null>(null);
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [icdDraft, setIcdDraft] = useState<string | null>(null);

  useEffect(() => {
    if (queryCountry) {
      setCountryCode(queryCountry.toUpperCase());
    }
  }, [queryCountry]);

  useEffect(() => {
    const normalizedId = sheetId.trim();
    if (!normalizedId) {
      setMapping(null);
      setLoadSource(null);
      return;
    }
    if (mapping?.meta.sheetId === normalizedId) {
      return;
    }
    const cached = loadPojoMapping(normalizedId);
    if (cached) {
      setMapping(cached);
      setLoadSource('storage');
    } else {
      setMapping(null);
      setLoadSource(null);
    }
  }, [mapping?.meta.sheetId, sheetId]);

  useEffect(() => {
    setRowStatuses({});
    setIcdDraft(null);
  }, [mapping?.meta.sheetId]);

  const handleGenerate = useCallback(async () => {
    const normalizedId = sheetId.trim();
    if (!normalizedId) {
      setError('Enter a sheet ID to load the mapping.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await mockAiService.getPojoMappingSheet(normalizedId);
      setMapping(data);
      savePojoMapping(normalizedId, data);
      const normalizedCountry = countryCode.trim().toUpperCase();
      if (normalizedCountry) {
        setStage(normalizedCountry, flow, 'PAYLOAD_MAPPING', 'DONE', undefined, {
          mappingSessionKey: `ai.mapping.${normalizedId}`
        });
      }
      setLoadSource('mock');
    } catch (fetchError) {
      console.warn('Failed to load mapping sheet.', fetchError);
      setError('Failed to load mock POJO mapping sheet.');
    } finally {
      setLoading(false);
    }
  }, [countryCode, flow, sheetId]);

  const getRowKey = useCallback((index: number) => `${mapping?.meta.sheetId ?? 'sheet'}-${index}`, [mapping]);

  const setRowStatus = useCallback((index: number, status: RowStatus) => {
    const key = getRowKey(index);
    setRowStatuses((prev) => ({ ...prev, [key]: status }));
  }, [getRowKey]);

  const getRowStatus = useCallback(
    (index: number) => rowStatuses[getRowKey(index)] ?? 'pending',
    [getRowKey, rowStatuses]
  );

  const appliedCount = useMemo(
    () => Object.values(rowStatuses).filter((status) => status === 'applied').length,
    [rowStatuses]
  );

  const handleExportJson = useCallback(() => {
    if (!mapping) {
      return;
    }
    const token = sanitizeFileToken(mapping.meta.sheetId);
    const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${token}-pojo-mapping.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [mapping]);

  const handleExportCsv = useCallback(() => {
    if (!mapping) {
      return;
    }
    const headers = [
      'Description',
      'Input: PAIN001V6 Field',
      'Output: FNDT Message',
      'CCAPI JSON Tags',
      'XPAY Canonical POJO Mapping',
      'Transformation',
      'Logic',
      'Sample value',
      'Confidence',
      'Open Question'
    ];
    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const rows = mapping.rows.map((row) => [
      row.description ?? '',
      row.inputPain001v6Field ?? '',
      row.outputFndtMessage ?? '',
      row.ccapiJsonTags?.join(', ') ?? '',
      row.xpayCanonicalPojoMapping ?? '',
      row.transformation ?? '',
      row.logic ?? '',
      row.sampleValue ?? '',
      `${Math.round((row.confidence ?? 0) * 100)}%`,
      row.openQuestion ?? ''
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\n');
    const token = sanitizeFileToken(mapping.meta.sheetId);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${token}-pojo-mapping.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [mapping]);

  const handleCreateIcdDraft = useCallback(() => {
    if (!mapping) {
      return;
    }
    const rows = mapping.rows
      .map((row) => [
        row.description ?? '',
        row.inputPain001v6Field ?? '',
        row.outputFndtMessage ?? '',
        row.ccapiJsonTags?.join(', ') ?? '',
        row.xpayCanonicalPojoMapping ?? '',
        row.transformation ?? '',
        row.logic ?? '',
        row.sampleValue ?? '',
        `${Math.round((row.confidence ?? 0) * 100)}%`,
        row.openQuestion ?? ''
      ]);

    const lines = [
      `# ICD Draft (${mapping.meta.sheetId})`,
      '',
      `Input Format: ${inputFormat}`,
      '',
      '## Mapping Table',
      '',
      '| Description | Input: PAIN001V6 Field | Output: FNDT Message | CCAPI JSON Tags | XPAY Canonical POJO Mapping | Transformation | Logic | Sample value | Confidence | Open Question |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...rows.map((row) => `| ${row.map((value) => String(value).replace(/\n/g, ' ')).join(' | ')} |`)
    ];
    setIcdDraft(lines.join('\n'));
  }, [inputFormat, mapping]);

  const summaryStats = mapping?.summary.stats;

  return (
    <Stack spacing={3}>
      <Alert severity="warning">Preview / Demo Mode (R2D2 Pending)</Alert>

      <Typography variant="h4">Payload Mapping</Typography>

      <SectionCard title="Inputs" subtitle="Generate a draft mapping from mock AI output.">
        <Stack spacing={2}>
          <CountryCodeField
            value={countryCode}
            onChange={setCountryCode}
            helperText="Country context for status tracking."
          />
          <TextField
            label="Mapping Sheet ID"
            value={sheetId}
            onChange={(event) => setSheetId(event.target.value)}
            helperText="Defaults to xpay-canonical-v1."
            fullWidth
          />
          <TextField
            select
            label="Input Format"
            value={inputFormat}
            onChange={(event) => setInputFormat(event.target.value as (typeof inputFormats)[number])}
            fullWidth
          >
            {inputFormats.map((format) => (
              <MenuItem key={format} value={format}>
                {format}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Button variant="contained" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generating...' : '✨ Generate Draft Mapping (Preview)'}
            </Button>
            {loadSource ? (
              <Typography variant="caption" color="text.secondary">
                Loaded from {loadSource === 'storage' ? 'session storage' : 'mock JSON'}.
              </Typography>
            ) : null}
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </SectionCard>

      <SectionCard title="Results" subtitle="Review the draft mapping grid and apply rows.">
        {mapping ? (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1">Summary Counters</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={`Direct mappings: ${summaryStats?.directMappings ?? 0}`} variant="outlined" />
                  <Chip label={`Transformations: ${summaryStats?.transformations ?? 0}`} variant="outlined" />
                  <Chip label={`Needs SME review: ${summaryStats?.needsSMEReview ?? 0}`} variant="outlined" />
                  <Chip label={`Applied to draft: ${appliedCount}`} color="primary" variant="outlined" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {mapping.summary.headline}
                </Typography>
              </Stack>
            </Paper>

            <PojoMappingGrid
              rows={mapping.rows}
              renderRowActions={(_row, index) => {
                const status = getRowStatus(index);
                return (
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Button
                      size="small"
                      variant={status === 'applied' ? 'contained' : 'outlined'}
                      onClick={() => setRowStatus(index, 'applied')}
                    >
                      Apply
                    </Button>
                    <Button
                      size="small"
                      variant={status === 'question' ? 'contained' : 'outlined'}
                      onClick={() => setRowStatus(index, 'question')}
                    >
                      Flag Question
                    </Button>
                    <Button
                      size="small"
                      variant={status === 'ignored' ? 'contained' : 'outlined'}
                      onClick={() => setRowStatus(index, 'ignored')}
                    >
                      Ignore
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      Status: {status}
                    </Typography>
                  </Stack>
                );
              }}
            />
          </Stack>
        ) : (
          <Alert severity="info">Generate a draft mapping to view results.</Alert>
        )}
      </SectionCard>

      <SectionCard title="Outputs" subtitle="Export mapping data or generate an ICD draft.">
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={handleExportCsv} disabled={!mapping}>
              Export CSV
            </Button>
            <Button variant="outlined" onClick={handleExportJson} disabled={!mapping}>
              Export JSON
            </Button>
            <Button variant="contained" onClick={handleCreateIcdDraft} disabled={!mapping}>
              Create ICD Draft (Preview)
            </Button>
          </Stack>

          {icdDraft ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1">ICD Draft (Preview)</Typography>
                <Divider />
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
                >
                  {icdDraft}
                </Typography>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
