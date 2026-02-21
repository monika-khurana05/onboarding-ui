import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CountryCodeField } from '../../components/CountryCodeField';
import { SectionCard } from '../../components/SectionCard';
import { mockAiService } from '../../ai/services/mockAiService';
import {
  loadParsedPain001,
  loadScenarioPack,
  loadTestBaseXml,
  saveParsedPain001,
  saveScenarioPack,
  saveTestBaseXml
} from '../../ai/storage/aiSessionStorage';
import type { ParsedPain001, TestScenario, TestScenarioPack } from '../../ai/types';
import { parsePain001 } from '../../ai/testing/xmlPain001Parser';
import { generateTestScenarioPack, type ScenarioOptions } from '../../ai/testing/testScenarioGenerator';

type ParseStatus = 'idle' | 'success' | 'error';

const scenarioToggleLabels: Array<{ key: keyof ScenarioOptions; label: string }> = [
  { key: 'happyPath', label: 'Happy path' },
  { key: 'missingMandatory', label: 'Missing mandatory fields' },
  { key: 'invalidFormats', label: 'Invalid formats' },
  { key: 'duplicateSubmission', label: 'Duplicate submission' },
  { key: 'cutoffEdge', label: 'Cutoff/Date edge cases' },
  { key: 'creditorAgentVariations', label: 'Creditor agent/account variations' }
];

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

function downloadText(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildFieldRows(parsed: ParsedPain001 | null) {
  return [
    {
      title: 'Group Header',
      fields: [
        ['MsgId', parsed?.groupHeader.msgId],
        ['CreDtTm', parsed?.groupHeader.creDtTm],
        ['NbOfTxs', parsed?.groupHeader.nbOfTxs],
        ['CtrlSum', parsed?.groupHeader.ctrlSum],
        ['InitgPty.Nm', parsed?.groupHeader.initgPtyNm]
      ]
    },
    {
      title: 'Payment Info',
      fields: [
        ['PmtInfId', parsed?.paymentInfo.pmtInfId],
        ['PmtMtd', parsed?.paymentInfo.pmtMtd],
        ['SvcLvl.Cd', parsed?.paymentInfo.svcLvlCd],
        ['LclInstrm.Prtry', parsed?.paymentInfo.lclInstrmPrtry],
        ['ReqdExctnDt', parsed?.paymentInfo.reqdExctnDt]
      ]
    },
    {
      title: 'Debtor',
      fields: [
        ['Dbtr.Nm', parsed?.debtor.name],
        ['DbtrAcct.Id.Othr.Id', parsed?.debtor.accountId],
        ['DbtrAcct.Tp.Cd', parsed?.debtor.accountTypeCd]
      ]
    },
    {
      title: 'Creditor',
      fields: [
        ['Cdtr.Nm', parsed?.creditor.name],
        ['Cdtr.PstlAdr.AdrLine', parsed?.creditor.postalAdrLine],
        ['CdtrAcct.Id.Othr.Id', parsed?.creditor.accountId],
        ['CdtrAcct.Tp.Cd', parsed?.creditor.accountTypeCd]
      ]
    },
    {
      title: 'Creditor Agent',
      fields: [
        ['CdtrAgt.FinInstnId.ClrSysMmbId.MmbId', parsed?.creditorAgent.clrSysMmbId],
        ['CdtrAgt.FinInstnId.Othr.Id', parsed?.creditorAgent.othrId],
        ['CdtrAgt.FinInstnId.BrcId.Id', parsed?.creditorAgent.brcId],
        ['CdtrAgt.FinInstnId.Othr.SchmeNm.Cd', parsed?.creditorAgent.othrSchemeCd]
      ]
    }
  ];
}

export function TestCaseGenerationPage() {
  const [countryCode, setCountryCode] = useState('AR');
  const [baseXml, setBaseXml] = useState('');
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsed, setParsed] = useState<ParsedPain001 | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOptions>({
    happyPath: true,
    missingMandatory: true,
    invalidFormats: true,
    duplicateSubmission: true,
    cutoffEdge: true,
    creditorAgentVariations: true
  });
  const [scenarioPack, setScenarioPack] = useState<TestScenarioPack | null>(null);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cucumberFeature, setCucumberFeature] = useState<string | null>(null);
  const [cucumberSteps, setCucumberSteps] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'sample' | 'generated' | 'restored'>('idle');

  const normalizedCountry = normalizeCountryCode(countryCode);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    const savedXml = loadTestBaseXml(normalizedCountry);
    setBaseXml(savedXml ?? '');
    const savedParsed = loadParsedPain001(normalizedCountry);
    const savedPack = loadScenarioPack(normalizedCountry);
    if (savedParsed) {
      setParsed(savedParsed);
      setParseStatus('success');
      setParseErrors([]);
    } else if (savedPack?.parsed) {
      setParsed(savedPack.parsed);
      setParseStatus('success');
      setParseErrors([]);
    } else {
      setParsed(null);
      setParseStatus('idle');
      setParseErrors([]);
    }
    if (savedPack) {
      setScenarioPack(savedPack);
      setSelectedScenarioIds(new Set(savedPack.scenarios.map((scenario) => scenario.scenarioId)));
      setLoadStatus('restored');
    } else {
      setScenarioPack(null);
      setSelectedScenarioIds(new Set());
      setLoadStatus('idle');
    }
  }, [normalizedCountry]);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    saveTestBaseXml(normalizedCountry, baseXml);
  }, [baseXml, normalizedCountry]);

  const handleLoadSample = useCallback(async () => {
    const sample = await mockAiService.getKafkaPain001Sample();
    setBaseXml(sample);
    setParseStatus('idle');
    setParseErrors([]);
    setParsed(null);
    setScenarioPack(null);
    setSelectedScenarioIds(new Set());
    setLoadStatus('sample');
  }, []);

  const handleParseXml = useCallback(() => {
    const result = parsePain001(baseXml);
    if (result.ok) {
      setParsed(result.data);
      setParseStatus('success');
      setParseErrors([]);
      if (normalizedCountry) {
        saveParsedPain001(normalizedCountry, result.data);
      }
    } else {
      setParsed(null);
      setParseStatus('error');
      setParseErrors(result.errors);
    }
  }, [baseXml, normalizedCountry]);

  const handleClear = useCallback(() => {
    setBaseXml('');
    setParsed(null);
    setParseStatus('idle');
    setParseErrors([]);
    setScenarioPack(null);
    setSelectedScenarioIds(new Set());
    setCucumberFeature(null);
    setCucumberSteps(null);
    setLoadStatus('idle');
  }, []);

  const handleToggleScenarioOption = useCallback((key: keyof ScenarioOptions) => {
    setScenarioOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleGenerateScenarios = useCallback(() => {
    if (!normalizedCountry) {
      setParseStatus('error');
      setParseErrors(['Country code is required to generate scenarios.']);
      return;
    }
    if (!parsed) {
      setParseStatus('error');
      setParseErrors(['Parse the XML before generating scenarios.']);
      return;
    }
    if (!baseXml.trim()) {
      setParseStatus('error');
      setParseErrors(['Kafka payload is empty.']);
      return;
    }
    const pack = generateTestScenarioPack(baseXml, parsed, scenarioOptions, normalizedCountry);
    setScenarioPack(pack);
    saveScenarioPack(normalizedCountry, pack);
    setSelectedScenarioIds(new Set(pack.scenarios.map((scenario) => scenario.scenarioId)));
    setLoadStatus('generated');
  }, [baseXml, normalizedCountry, parsed, scenarioOptions]);

  const handleViewScenario = useCallback((scenario: TestScenario) => {
    setActiveScenario(scenario);
    setDrawerOpen(true);
  }, []);

  const handleExportScenarioXml = useCallback((scenario: TestScenario) => {
    downloadText(scenario.xmlVariant, `${scenario.scenarioId}.xml`, 'application/xml;charset=utf-8');
  }, []);

  const handleToggleSelected = useCallback((scenarioId: string) => {
    setSelectedScenarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) {
        next.delete(scenarioId);
      } else {
        next.add(scenarioId);
      }
      return next;
    });
  }, []);

  const handleExportScenarioPack = useCallback(() => {
    if (!scenarioPack) {
      return;
    }
    downloadText(
      JSON.stringify(scenarioPack, null, 2),
      `${normalizedCountry || 'pack'}-scenario-pack.json`,
      'application/json;charset=utf-8'
    );
  }, [normalizedCountry, scenarioPack]);

  const handleExportScenarioCsv = useCallback(() => {
    if (!scenarioPack) {
      return;
    }
    const headers = ['Scenario ID', 'Title', 'Type', 'Expected State', 'Expected Error Code'];
    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const rows = scenarioPack.scenarios.map((scenario) => [
      scenario.scenarioId,
      scenario.title,
      scenario.type,
      scenario.expectedOutcome.state,
      scenario.expectedOutcome.errorCode ?? ''
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\n');
    downloadText(csv, `${normalizedCountry || 'pack'}-scenario-list.csv`, 'text/csv;charset=utf-8');
  }, [normalizedCountry, scenarioPack]);

  const handleGenerateCucumber = useCallback(() => {
    if (!scenarioPack) {
      return;
    }
    const featureLines = [
      `Feature: Payment smoke pack for ${normalizedCountry || 'country'}`,
      '',
      '  # Generated preview skeleton',
      ...scenarioPack.scenarios.map(
        (scenario) => [
          '',
          `  Scenario: ${scenario.title}`,
          `    Given a payment scenario "${scenario.scenarioId}"`,
          '    When the payment is processed',
          `    Then the outcome should be "${scenario.expectedOutcome.state}"`
        ].join('\n')
      )
    ];
    const stepLines = [
      'package stepdefs;',
      '',
      'import io.cucumber.java.en.Given;',
      'import io.cucumber.java.en.Then;',
      'import io.cucumber.java.en.When;',
      '',
      'public class PaymentSmokeSteps {',
      '  @Given("a payment scenario {string}")',
      '  public void aPaymentScenario(String scenarioId) {',
      '    // TODO: load fixture payload by scenarioId',
      '  }',
      '',
      '  @When("the payment is processed")',
      '  public void thePaymentIsProcessed() {',
      '    // TODO: call processing API',
      '  }',
      '',
      '  @Then("the outcome should be {string}")',
      '  public void theOutcomeShouldBe(String expected) {',
      '    // TODO: assert on response or state',
      '  }',
      '}'
    ];
    setCucumberFeature(featureLines.join('\n'));
    setCucumberSteps(stepLines.join('\n'));
  }, [normalizedCountry, scenarioPack]);

  const handleExportCucumber = useCallback(() => {
    if (!cucumberFeature || !cucumberSteps) {
      return;
    }
    downloadText(cucumberFeature, 'features/payment_smoke_pack.feature', 'text/plain;charset=utf-8');
    downloadText(cucumberSteps, 'stepdefs/PaymentSmokeSteps.java', 'text/plain;charset=utf-8');
  }, [cucumberFeature, cucumberSteps]);

  const handleExportSelectedPayloads = useCallback(() => {
    if (!scenarioPack) {
      return;
    }
    const selected = scenarioPack.scenarios.filter((scenario) => selectedScenarioIds.has(scenario.scenarioId));
    const payloads = selected.length ? selected : scenarioPack.scenarios;
    const exportPayload = payloads.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      expectedOutcome: scenario.expectedOutcome,
      xmlVariant: scenario.xmlVariant
    }));
    downloadText(
      JSON.stringify(exportPayload, null, 2),
      `${normalizedCountry || 'pack'}-selected-payloads.json`,
      'application/json;charset=utf-8'
    );
  }, [normalizedCountry, scenarioPack, selectedScenarioIds]);

  const summaryItems = useMemo(
    () =>
      parsed
        ? [
            ['Message Type', parsed.messageType],
            ['MsgId', parsed.groupHeader.msgId],
            ['CreDtTm', parsed.groupHeader.creDtTm],
            ['NbOfTxs', parsed.groupHeader.nbOfTxs],
            ['CtrlSum', parsed.groupHeader.ctrlSum],
            ['Currency', parsed.currency],
            ['Requested Execution Date', parsed.paymentInfo.reqdExctnDt]
          ]
        : [],
    [parsed]
  );

  const extractedGroups = useMemo(() => buildFieldRows(parsed), [parsed]);

  return (
    <Stack spacing={3}>
      <Chip label="Preview / Demo Mode (R2D2 Pending)" color="warning" variant="outlined" />

      <Typography variant="h4">Test Case Generation</Typography>

      <SectionCard title="Kafka Input" subtitle="Paste Kafka PAIN.001 XML, parse, and review extracted fields.">
        <Stack spacing={2}>
          <TextField
            label="Kafka Message Payload (XML)"
            value={baseXml}
            onChange={(event) => setBaseXml(event.target.value)}
            placeholder="Paste pain.001 XML payload..."
            fullWidth
            multiline
            minRows={8}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={handleLoadSample}>
              Load Sample PAIN.001
            </Button>
            <Button variant="contained" onClick={handleParseXml}>
              Parse XML
            </Button>
            <Button variant="text" onClick={handleClear}>
              Clear
            </Button>
            {loadStatus !== 'idle' ? (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                Last action: {loadStatus}
              </Typography>
            ) : null}
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1">Parse Status</Typography>
              <Chip
                label={parseStatus === 'success' ? 'Parsed' : parseStatus === 'error' ? 'Error' : 'Idle'}
                color={parseStatus === 'success' ? 'success' : parseStatus === 'error' ? 'error' : 'default'}
                size="small"
                variant="outlined"
              />
            </Stack>
            {parseStatus === 'error' && parseErrors.length ? (
              <Alert severity="error">
                {parseErrors.map((message) => (
                  <Typography key={message} variant="body2">
                    {message}
                  </Typography>
                ))}
              </Alert>
            ) : null}
          </Stack>

          {parsed ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1">Parsed Summary</Typography>
                <Stack spacing={0.5}>
                  {summaryItems.map(([label, value]) => (
                    <Typography key={label} variant="caption" color="text.secondary">
                      {label}: {value || '—'}
                    </Typography>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ) : null}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">Extracted Canonical Fields</Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {extractedGroups.map((group) => (
                      <TableRow key={group.title}>
                        <TableCell colSpan={2} sx={{ px: 0 }}>
                          <Typography variant="subtitle2" sx={{ mt: 1 }}>
                            {group.title}
                          </Typography>
                          <Table size="small">
                            <TableBody>
                              {group.fields.map(([field, value]) => (
                                <TableRow key={field}>
                                  <TableCell sx={{ width: 220 }}>{field}</TableCell>
                                  <TableCell>{value || '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">XML Viewer</Typography>
              <Typography
                variant="body2"
                component="pre"
                sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 240, overflow: 'auto' }}
              >
                {baseXml || 'No XML loaded.'}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </SectionCard>

      <SectionCard title="Scenario Generator" subtitle="Generate deterministic variants from the base message.">
        <Stack spacing={2}>
          <CountryCodeField
            value={countryCode}
            onChange={setCountryCode}
            helperText="Country context for generated test scenarios."
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            {scenarioToggleLabels.map((toggle) => (
              <FormControlLabel
                key={toggle.key}
                control={
                  <Checkbox
                    checked={scenarioOptions[toggle.key]}
                    onChange={() => handleToggleScenarioOption(toggle.key)}
                  />
                }
                label={toggle.label}
              />
            ))}
          </Stack>
          <Button variant="contained" onClick={handleGenerateScenarios}>
            Generate Test Scenarios
          </Button>

          {scenarioPack ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Scenario Pack</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Scenario ID</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Title</TableCell>
                        <TableCell>Mutations</TableCell>
                        <TableCell>Expected Result</TableCell>
                        <TableCell>Expected Error Code</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scenarioPack.scenarios.map((scenario) => (
                        <TableRow key={scenario.scenarioId} hover>
                          <TableCell>{scenario.scenarioId}</TableCell>
                          <TableCell>{scenario.type}</TableCell>
                          <TableCell>{scenario.title}</TableCell>
                          <TableCell>{scenario.mutations.join('; ')}</TableCell>
                          <TableCell>{scenario.expectedOutcome.state}</TableCell>
                          <TableCell>{scenario.expectedOutcome.errorCode ?? '—'}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Button size="small" variant="outlined" onClick={() => handleViewScenario(scenario)}>
                                View payload
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleExportScenarioXml(scenario)}
                              >
                                Export payload
                              </Button>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={selectedScenarioIds.has(scenario.scenarioId)}
                                    onChange={() => handleToggleSelected(scenario.scenarioId)}
                                  />
                                }
                                label="Selected"
                              />
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                      {scenarioPack.scenarios.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography variant="body2" color="text.secondary">
                              No scenarios generated yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </Paper>
          ) : (
            <Alert severity="info">Generate scenarios to review variants and expected outcomes.</Alert>
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="Outputs" subtitle="Export scenario packs, cucumber skeletons, or payload variants.">
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={handleExportScenarioPack} disabled={!scenarioPack}>
              Export JSON
            </Button>
            <Button variant="outlined" onClick={handleExportScenarioCsv} disabled={!scenarioPack}>
              Export CSV
            </Button>
            <Button variant="outlined" onClick={handleGenerateCucumber} disabled={!scenarioPack}>
              Generate Cucumber Skeleton
            </Button>
            <Button variant="contained" onClick={handleExportSelectedPayloads} disabled={!scenarioPack}>
              Export Selected Payloads
            </Button>
          </Stack>

          {(cucumberFeature || cucumberSteps) ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                {cucumberFeature ? (
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">features/payment_smoke_pack.feature</Typography>
                    <Divider />
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
                    >
                      {cucumberFeature}
                    </Typography>
                  </Stack>
                ) : null}
                {cucumberSteps ? (
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">stepdefs/PaymentSmokeSteps.java</Typography>
                    <Divider />
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
                    >
                      {cucumberSteps}
                    </Typography>
                  </Stack>
                ) : null}
                <Button variant="outlined" onClick={handleExportCucumber}>
                  Download Cucumber Files
                </Button>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </SectionCard>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Typography variant="subtitle1">Scenario Detail</Typography>
          {activeScenario ? (
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{activeScenario.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {activeScenario.scenarioId} · {activeScenario.expectedOutcome.state}
                </Typography>
              </Stack>
              <Divider />
              <Typography variant="subtitle2">XML Payload Variant</Typography>
              <Typography
                variant="body2"
                component="pre"
                sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}
              >
                {activeScenario.xmlVariant}
              </Typography>
              <Divider />
              <Typography variant="subtitle2">Expected Outcome</Typography>
              <Typography variant="body2">
                State: {activeScenario.expectedOutcome.state}
              </Typography>
              {activeScenario.expectedOutcome.errorCode ? (
                <Typography variant="body2">Error: {activeScenario.expectedOutcome.errorCode}</Typography>
              ) : null}
              {activeScenario.expectedOutcome.notes ? (
                <Typography variant="body2" color="text.secondary">
                  {activeScenario.expectedOutcome.notes}
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a scenario to view details.
            </Typography>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}
