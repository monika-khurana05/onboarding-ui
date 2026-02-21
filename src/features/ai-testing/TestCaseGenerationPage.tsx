import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { ExpandMore, Replay } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getKafkaValidationResults, publishKafkaTestCases } from '../../api/client';
import { getErrorMessage } from '../../api/http';
import type { KafkaPublishResponseDto, KafkaValidationResponseDto, KafkaValidationResultDto } from '../../api/types';
import { CountryCodeField } from '../../components/CountryCodeField';
import { SectionCard } from '../../components/SectionCard';
import { mockAiService } from '../../ai/services/mockAiService';
import {
  loadKafkaPublishConfig,
  loadLastPrimarySampleId,
  loadRequirementsAnalysis as loadRequirementsAnalysisFromStorage,
  loadScenarioPack,
  loadTestSampleXmls,
  saveKafkaPublishConfig,
  saveLastPrimarySampleId,
  saveRequirementsAnalysis,
  saveScenarioPack,
  saveTestSampleXmls,
  type TestSampleXml
} from '../../ai/storage/aiSessionStorage';
import type { ParsedPain001, RequirementsAnalysis, SampleMessage, TestScenario, TestScenarioPack } from '../../ai/types';
import { parsePain001 } from '../../ai/testing/xmlPain001Parser';
import { generateScenarioPack, type ScenarioOptions } from '../../ai/testing/testScenarioGenerator';
import { setStage } from '../../status/onboardingStatusStorage';
import type { Flow } from '../../status/types';
import { ValidationRunPanel } from '../../ai/testing/components/ValidationRunPanel';

type ParseState = 'IDLE' | 'PARSING' | 'PARSED' | 'ERROR';

const scenarioToggleLabels: Array<{ key: keyof ScenarioOptions; label: string }> = [
  { key: 'happyPath', label: 'Happy path' },
  { key: 'missingMandatory', label: 'Missing mandatory fields' },
  { key: 'invalidFormats', label: 'Invalid formats' },
  { key: 'duplicate', label: 'Duplicate submission' },
  { key: 'cutoff', label: 'Cutoff/Date edge cases' },
  { key: 'creditorAgentVariations', label: 'Creditor agent/account variations' }
];

type SampleEntry = {
  id: string;
  xml: string;
  parsed: ParsedPain001 | null;
  parseState: ParseState;
  parseError?: string;
  messageType?: string;
  msgId?: string;
  xmlHash: string;
};

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

function createSampleEntry(xml = '', id?: string): SampleEntry {
  const entryId = id ?? `sample-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: entryId,
    xml,
    parsed: null,
    parseState: 'IDLE',
    parseError: undefined,
    messageType: undefined,
    msgId: undefined,
    xmlHash: ''
  };
}

function computeXmlHash(xml: string): string {
  const trimmed = xml.trim();
  if (!trimmed) {
    return '';
  }
  const head = trimmed.slice(0, 60);
  const tail = trimmed.slice(-60);
  return `${trimmed.length}:${head}:${tail}`;
}

function splitBulkXml(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/(?=<\?xml|<Document)/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
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

function resolveStatusTone(value?: string) {
  const normalized = value?.toLowerCase() ?? '';
  if (!normalized) {
    return 'default' as const;
  }
  if (normalized.includes('pass') || normalized.includes('success') || normalized.includes('accepted') || normalized.includes('ok')) {
    return 'success' as const;
  }
  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('reject')) {
    return 'error' as const;
  }
  if (normalized.includes('pending') || normalized.includes('running') || normalized.includes('processing')) {
    return 'warning' as const;
  }
  return 'default' as const;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function TestCaseGenerationPage() {
  const [searchParams] = useSearchParams();
  const queryFlow = searchParams.get('flow');
  const flowFromQuery = queryFlow === 'OUTGOING' ? 'OUTGOING' : 'INCOMING';
  const queryCountry = searchParams.get('country');
  const [countryCode, setCountryCode] = useState('AR');
  const [flow, setFlow] = useState<Flow>(flowFromQuery);
  const [sampleEntries, setSampleEntries] = useState<SampleEntry[]>(() => [createSampleEntry()]);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [primarySampleId, setPrimarySampleId] = useState<string | null>(null);
  const [autoSelectPrimary, setAutoSelectPrimary] = useState(true);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [bulkPasteValue, setBulkPasteValue] = useState('');
  const [parseNonce, setParseNonce] = useState(0);
  const parseTimerRef = useRef<number | null>(null);
  const sampleSaveTimerRef = useRef<number | null>(null);
  const lastSavedSampleDigestRef = useRef('');
  const lastParseNonceRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<RequirementsAnalysis | null>(null);
  const [requirementsSource, setRequirementsSource] = useState<'storage' | 'mock' | null>(null);
  const [requirementsStatus, setRequirementsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOptions>({
    happyPath: true,
    missingMandatory: true,
    invalidFormats: true,
    duplicate: true,
    cutoff: true,
    creditorAgentVariations: true
  });
  const [scenarioPack, setScenarioPack] = useState<TestScenarioPack | null>(null);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());
  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cucumberFeature, setCucumberFeature] = useState<string | null>(null);
  const [cucumberSteps, setCucumberSteps] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'sample' | 'generated' | 'restored'>('idle');
  const [kafkaClusterAlias, setKafkaClusterAlias] = useState('');
  const [kafkaTopicName, setKafkaTopicName] = useState('');
  const [kafkaMessageKey, setKafkaMessageKey] = useState('');
  const [executionId, setExecutionId] = useState('');
  const [publishResponse, setPublishResponse] = useState<KafkaPublishResponseDto | null>(null);
  const [validationResponse, setValidationResponse] = useState<KafkaValidationResponseDto | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const normalizedCountry = normalizeCountryCode(countryCode);
  const activeSample = useMemo(() => {
    if (sampleEntries.length === 0) {
      return null;
    }
    const matched = activeSampleId ? sampleEntries.find((entry) => entry.id === activeSampleId) : undefined;
    return matched ?? sampleEntries[0];
  }, [activeSampleId, sampleEntries]);
  const activeSampleIndex = useMemo(
    () => (activeSample ? sampleEntries.findIndex((entry) => entry.id === activeSample.id) : -1),
    [activeSample, sampleEntries]
  );
  const activeXml = activeSample?.xml ?? '';

  const filledSamples = useMemo(() => sampleEntries.filter((entry) => entry.xml.trim()), [sampleEntries]);
  const parsedSamples = useMemo(
    () =>
      sampleEntries.filter(
        (entry) => entry.parseState === 'PARSED' && entry.parsed
      ) as SampleEntry[],
    [sampleEntries]
  );
  const sampleIndexById = useMemo(() => {
    const map = new Map<string, number>();
    sampleEntries.forEach((entry, index) => {
      map.set(entry.id, index);
    });
    return map;
  }, [sampleEntries]);
  const parsedSampleMessages = useMemo<SampleMessage[]>(
    () =>
      parsedSamples.map((entry) => ({
        sampleId: entry.id,
        xml: entry.xml,
        parsed: entry.parsed as ParsedPain001
      })),
    [parsedSamples]
  );
  const parsedMsgIds = useMemo(() => parsedSamples.map((entry) => entry.msgId ?? '—'), [parsedSamples]);
  const parsedMsgIdSummary = useMemo(() => {
    if (parsedMsgIds.length === 0) {
      return '—';
    }
    const preview = parsedMsgIds.slice(0, 3).join(', ');
    const remaining = parsedMsgIds.length - 3;
    return remaining > 0 ? `${preview} +${remaining} more` : preview;
  }, [parsedMsgIds]);

  const parseSummary = useMemo(() => {
    const total = filledSamples.length;
    const parsedCount = parsedSamples.length;
    const errorCount = filledSamples.filter((entry) => entry.parseState === 'ERROR').length;
    const parsingCount = filledSamples.filter((entry) => entry.parseState === 'PARSING').length;
    return { total, parsedCount, errorCount, parsingCount };
  }, [filledSamples, parsedSamples]);
  const parseSummaryLabel =
    parseSummary.total === 0
      ? 'No samples'
      : `${parseSummary.parsedCount} parsed / ${parseSummary.errorCount} error${
          parseSummary.errorCount === 1 ? '' : 's'
        }`;
  const parseSummaryTone =
    parseSummary.errorCount > 0 ? 'error' : parseSummary.parsedCount > 0 ? 'success' : 'default';

  const parseErrorSummaries = useMemo(
    () =>
      sampleEntries
        .map((entry, index) => ({
          id: entry.id,
          label: `Sample ${index + 1}`,
          hasContent: Boolean(entry.xml.trim()),
          error: entry.parseError
        }))
        .filter((entry) => entry.hasContent && entry.error),
    [sampleEntries]
  );

  useEffect(() => {
    if (parsedSamples.length === 0) {
      setPrimarySampleId(null);
      return;
    }

    const selectedValid = primarySampleId ? parsedSamples.some((entry) => entry.id === primarySampleId) : false;
    if (autoSelectPrimary) {
      setPrimarySampleId(parsedSamples[0].id);
      return;
    }

    if (!selectedValid) {
      setPrimarySampleId(parsedSamples[0].id);
      setAutoSelectPrimary(true);
    }
  }, [parsedSamples, primarySampleId, autoSelectPrimary]);

  const primarySample = useMemo(
    () => parsedSamples.find((entry) => entry.id === primarySampleId) ?? parsedSamples[0] ?? null,
    [parsedSamples, primarySampleId]
  );
  const primaryParsed = primarySample?.parsed ?? null;
  const primarySampleIndex = useMemo(
    () => (primarySample ? sampleIndexById.get(primarySample.id) ?? -1 : -1),
    [primarySample, sampleIndexById]
  );

  const xmlDigest = useMemo(
    () => sampleEntries.map((entry) => `${entry.id}:${computeXmlHash(entry.xml)}`).join('|'),
    [sampleEntries]
  );

  useEffect(() => {
    const forceParse = parseNonce !== lastParseNonceRef.current;
    lastParseNonceRef.current = parseNonce;

    setSampleEntries((prev) => {
      let markedChange = false;
      const markedEntries = prev.map((entry) => {
        const trimmed = entry.xml.trim();
        if (!trimmed) {
          const shouldReset =
            entry.parseState !== 'IDLE' ||
            entry.parsed ||
            entry.parseError ||
            entry.messageType ||
            entry.msgId ||
            entry.xmlHash;
          if (!shouldReset) {
            return entry;
          }
          markedChange = true;
          return {
            ...entry,
            parsed: null,
            parseState: 'IDLE',
            parseError: undefined,
            messageType: undefined,
            msgId: undefined,
            xmlHash: ''
          };
        }
        const hash = computeXmlHash(entry.xml);
        const needsParse = forceParse || hash !== entry.xmlHash;
        if (!needsParse) {
          return entry;
        }
        if (entry.parseState === 'PARSING' && !entry.parseError && !entry.parsed) {
          return entry;
        }
        markedChange = true;
        return {
          ...entry,
          parsed: null,
          parseState: 'PARSING',
          parseError: undefined,
          messageType: undefined,
          msgId: undefined
        };
      });
      return markedChange ? markedEntries : prev;
    });

    if (parseTimerRef.current !== null) {
      window.clearTimeout(parseTimerRef.current);
    }

    parseTimerRef.current = window.setTimeout(() => {
      setSampleEntries((prev) => {
        let didChange = false;
        const next = prev.map((entry) => {
          const trimmed = entry.xml.trim();
          if (!trimmed) {
            const shouldReset =
              entry.parseState !== 'IDLE' ||
              entry.parsed ||
              entry.parseError ||
              entry.messageType ||
              entry.msgId ||
              entry.xmlHash;
            if (!shouldReset) {
              return entry;
            }
            didChange = true;
            return {
              ...entry,
              parsed: null,
              parseState: 'IDLE',
              parseError: undefined,
              messageType: undefined,
              msgId: undefined,
              xmlHash: ''
            };
          }
          const hash = computeXmlHash(entry.xml);
          const needsParse = forceParse || hash !== entry.xmlHash || entry.parseState === 'PARSING';
          if (!needsParse) {
            return entry;
          }
          const result = parsePain001(entry.xml);
          didChange = true;
          if (result.ok) {
            return {
              ...entry,
              parsed: result.data,
              parseState: 'PARSED',
              parseError: undefined,
              messageType: result.data.messageType,
              msgId: result.data.groupHeader.msgId ?? undefined,
              xmlHash: hash
            };
          }
          return {
            ...entry,
            parsed: null,
            parseState: 'ERROR',
            parseError: result.errors.join(' '),
            messageType: undefined,
            msgId: undefined,
            xmlHash: hash
          };
        });
        return didChange ? next : prev;
      });
    }, 400);

    return () => {
      if (parseTimerRef.current !== null) {
        window.clearTimeout(parseTimerRef.current);
      }
    };
  }, [xmlDigest, parseNonce]);

  const publishMutation = useMutation({
    mutationFn: publishKafkaTestCases,
    meta: { suppressGlobalError: true }
  });

  const validationMutation = useMutation({
    mutationFn: getKafkaValidationResults,
    meta: { suppressGlobalError: true }
  });

  useEffect(() => {
    if (queryCountry) {
      setCountryCode(queryCountry.toUpperCase());
    }
  }, [queryCountry]);

  useEffect(() => {
    if (queryFlow) {
      setFlow(queryFlow === 'OUTGOING' ? 'OUTGOING' : 'INCOMING');
    }
  }, [queryFlow]);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    const savedPack = loadScenarioPack(normalizedCountry, flow);
    const savedSamples = loadTestSampleXmls(normalizedCountry, flow);
    const savedPrimarySampleId = loadLastPrimarySampleId(normalizedCountry, flow);

    let nextEntries: SampleEntry[] = [];
    if (savedSamples?.length) {
      nextEntries = savedSamples.map((sample) => createSampleEntry(sample.xml, sample.id));
    } else if (savedPack?.samples?.length) {
      nextEntries = savedPack.samples.map((sample) => createSampleEntry(sample.xml, sample.sampleId));
    } else if (savedPack?.baseXml) {
      nextEntries = [createSampleEntry(savedPack.baseXml)];
    } else {
      nextEntries = [createSampleEntry()];
    }

    setSampleEntries(nextEntries);
    setActiveSampleId(nextEntries[0]?.id ?? null);
    setGenerationErrors([]);

    if (savedPrimarySampleId) {
      setPrimarySampleId(savedPrimarySampleId);
      setAutoSelectPrimary(false);
    } else {
      setPrimarySampleId(null);
      setAutoSelectPrimary(true);
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
    const savedKafkaConfig = loadKafkaPublishConfig(normalizedCountry, flow);
    if (savedKafkaConfig) {
      setKafkaClusterAlias(savedKafkaConfig.clusterAlias ?? '');
      setKafkaTopicName(savedKafkaConfig.topicName ?? '');
      setKafkaMessageKey(savedKafkaConfig.messageKey ?? '');
      setExecutionId(savedKafkaConfig.executionId ?? '');
    } else {
      setKafkaClusterAlias('');
      setKafkaTopicName('');
      setKafkaMessageKey('');
      setExecutionId('');
    }
    setPublishResponse(null);
    setValidationResponse(null);
    setPublishError(null);
    setValidationError(null);
  }, [normalizedCountry, flow]);

  useEffect(() => {
    if (!normalizedCountry) {
      setRequirements(null);
      setRequirementsSource(null);
      setRequirementsStatus('idle');
      setRequirementsError(null);
      return;
    }
    const cached = loadRequirementsAnalysisFromStorage(normalizedCountry);
    if (cached) {
      setRequirements(cached);
      setRequirementsSource('storage');
    } else {
      setRequirements(null);
      setRequirementsSource(null);
    }
    setRequirementsStatus('idle');
    setRequirementsError(null);
  }, [normalizedCountry]);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    const digest = xmlDigest;
    if (digest === lastSavedSampleDigestRef.current) {
      return;
    }
    if (sampleSaveTimerRef.current !== null) {
      window.clearTimeout(sampleSaveTimerRef.current);
    }
    sampleSaveTimerRef.current = window.setTimeout(() => {
      const samplesToSave: TestSampleXml[] = sampleEntries.map((entry) => ({ id: entry.id, xml: entry.xml }));
      saveTestSampleXmls(normalizedCountry, samplesToSave, flow);
      lastSavedSampleDigestRef.current = digest;
    }, 400);
    return () => {
      if (sampleSaveTimerRef.current !== null) {
        window.clearTimeout(sampleSaveTimerRef.current);
      }
    };
  }, [normalizedCountry, flow, sampleEntries, xmlDigest]);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    saveLastPrimarySampleId(normalizedCountry, flow, primarySampleId);
  }, [normalizedCountry, flow, primarySampleId]);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    saveKafkaPublishConfig(normalizedCountry, {
      clusterAlias: kafkaClusterAlias.trim(),
      topicName: kafkaTopicName.trim(),
      messageKey: kafkaMessageKey.trim() || undefined,
      executionId: executionId.trim() || undefined,
      lastPublishedAt: publishResponse?.submittedAt
    }, flow);
  }, [
    executionId,
    kafkaClusterAlias,
    kafkaMessageKey,
    kafkaTopicName,
    normalizedCountry,
    publishResponse?.submittedAt,
    flow
  ]);

  const handleLoadSample = useCallback(async () => {
    const sample = await mockAiService.getKafkaPain001Sample();
    let nextActiveId: string | null = null;
    setSampleEntries((prev) => {
      const next = [...prev];
      const activeIndex = activeSampleId ? next.findIndex((entry) => entry.id === activeSampleId) : -1;
      const emptyIndex = next.findIndex((entry) => !entry.xml.trim());
      const targetIndex = activeIndex >= 0 ? activeIndex : emptyIndex >= 0 ? emptyIndex : next.length;
      const baseEntry = targetIndex < next.length ? next[targetIndex] : createSampleEntry();
      const updated: SampleEntry = {
        ...baseEntry,
        xml: sample,
        parsed: null,
        parseState: 'IDLE',
        parseError: undefined,
        messageType: undefined,
        msgId: undefined,
        xmlHash: ''
      };
      if (targetIndex < next.length) {
        next[targetIndex] = updated;
      } else {
        next.push(updated);
      }
      nextActiveId = updated.id;
      return next;
    });
    if (nextActiveId) {
      setActiveSampleId(nextActiveId);
    }
    setScenarioPack(null);
    setSelectedScenarioIds(new Set());
    setGenerationErrors([]);
    setLoadStatus('sample');
  }, [activeSampleId]);

  const handleReparseNow = useCallback(() => {
    setParseNonce((prev) => prev + 1);
    setGenerationErrors([]);
  }, []);

  const handleClear = useCallback(() => {
    const resetEntry = createSampleEntry();
    setSampleEntries([resetEntry]);
    setActiveSampleId(resetEntry.id);
    setScenarioPack(null);
    setSelectedScenarioIds(new Set());
    setCucumberFeature(null);
    setCucumberSteps(null);
    setGenerationErrors([]);
    setLoadStatus('idle');
  }, []);

  const handleAddSample = useCallback(() => {
    const entry = createSampleEntry();
    setSampleEntries((prev) => [...prev, entry]);
    setActiveSampleId(entry.id);
    setGenerationErrors([]);
  }, []);

  const handleAppendSamples = useCallback((xmlSamples: string[]) => {
    const payloads = xmlSamples.map((sample) => sample.trim()).filter(Boolean);
    if (payloads.length === 0) {
      return;
    }
    let nextActiveId: string | null = null;
    setSampleEntries((prev) => {
      const next = [...prev];
      let insertIndex = next.findIndex((entry) => !entry.xml.trim());
      payloads.forEach((xml) => {
        if (insertIndex >= 0) {
          const baseEntry = next[insertIndex];
          const updated: SampleEntry = {
            ...baseEntry,
            xml,
            parsed: null,
            parseState: 'IDLE',
            parseError: undefined,
            messageType: undefined,
            msgId: undefined,
            xmlHash: ''
          };
          next[insertIndex] = updated;
          if (!nextActiveId) {
            nextActiveId = updated.id;
          }
          insertIndex = next.findIndex((entry, index) => index > insertIndex && !entry.xml.trim());
        } else {
          const entry = createSampleEntry(xml);
          next.push(entry);
          if (!nextActiveId) {
            nextActiveId = entry.id;
          }
        }
      });
      return next;
    });
    if (nextActiveId) {
      setActiveSampleId(nextActiveId);
    }
    setGenerationErrors([]);
  }, []);

  const handleUploadXmlFiles = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) {
        return;
      }
      try {
        const contents = await Promise.all(files.map((file) => file.text()));
        handleAppendSamples(contents);
      } finally {
        event.target.value = '';
      }
    },
    [handleAppendSamples]
  );

  const handleConfirmBulkPaste = useCallback(() => {
    const chunks = splitBulkXml(bulkPasteValue);
    handleAppendSamples(chunks);
    setBulkPasteOpen(false);
    setBulkPasteValue('');
  }, [bulkPasteValue, handleAppendSamples]);

  const handleRemoveSample = useCallback(
    (entryId: string) => {
      let nextActiveId: string | null = null;
      setSampleEntries((prev) => {
        const next = prev.filter((entry) => entry.id !== entryId);
        if (next.length === 0) {
          const fresh = createSampleEntry();
          nextActiveId = fresh.id;
          return [fresh];
        }
        if (activeSampleId === entryId) {
          nextActiveId = next[0].id;
        }
        return next;
      });
      if (nextActiveId) {
        setActiveSampleId(nextActiveId);
      }
      setGenerationErrors([]);
    },
    [activeSampleId]
  );

  const handleUpdateSample = useCallback((entryId: string, nextXml: string) => {
    setSampleEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              xml: nextXml,
              parsed: null,
              parseState: 'IDLE',
              parseError: undefined,
              messageType: undefined,
              msgId: undefined,
              xmlHash: ''
            }
          : entry
      )
    );
    setGenerationErrors([]);
  }, []);

  const handleToggleScenarioOption = useCallback((key: keyof ScenarioOptions) => {
    setScenarioOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleLoadRequirements = useCallback(async () => {
    if (!normalizedCountry) {
      setRequirementsError('Country code is required to load requirements.');
      setRequirementsStatus('error');
      return;
    }
    setRequirementsStatus('loading');
    setRequirementsError(null);
    try {
      const cached = loadRequirementsAnalysisFromStorage(normalizedCountry);
      if (cached) {
        setRequirements(cached);
        setRequirementsSource('storage');
        setRequirementsStatus('idle');
        return;
      }
      const data = await mockAiService.getRequirementsAnalysis(normalizedCountry);
      setRequirements(data);
      saveRequirementsAnalysis(normalizedCountry, data);
      setRequirementsSource('mock');
      setRequirementsStatus('idle');
    } catch (error) {
      console.warn('Failed to load requirements analysis.', error);
      setRequirementsError('Failed to load requirements analysis.');
      setRequirementsStatus('error');
    }
  }, [normalizedCountry]);
  const handleGenerateScenarios = useCallback(async () => {
    if (!normalizedCountry) {
      setGenerationErrors(['Country code is required to generate scenarios.']);
      return;
    }
    if (filledSamples.length === 0) {
      setGenerationErrors(['Add at least one XML sample before generating scenarios.']);
      return;
    }
    if (parsedSampleMessages.length === 0) {
      setGenerationErrors(['Parse at least one XML sample before generating scenarios.']);
      return;
    }

    let requirementContext: RequirementsAnalysis | null = requirements;
    if (!requirementContext) {
      try {
        const cached = loadRequirementsAnalysisFromStorage(normalizedCountry);
        if (cached) {
          requirementContext = cached;
          setRequirements(cached);
          setRequirementsSource('storage');
          setRequirementsError(null);
          setRequirementsStatus('idle');
        } else {
          const data = await mockAiService.getRequirementsAnalysis(normalizedCountry);
          requirementContext = data;
          setRequirements(data);
          setRequirementsSource('mock');
          saveRequirementsAnalysis(normalizedCountry, data);
          setRequirementsError(null);
          setRequirementsStatus('idle');
        }
      } catch (error) {
        console.warn('Requirements analysis unavailable for test generation.', error);
        setRequirementsError('Requirements analysis unavailable. Generated tests will use samples only.');
        setRequirementsStatus('error');
      }
    }

    const pack = generateScenarioPack({
      countryCode: normalizedCountry,
      flow,
      parsedSamples: parsedSampleMessages,
      requirementsContext: requirementContext,
      toggles: scenarioOptions
    });
    setScenarioPack(pack);
    saveScenarioPack(normalizedCountry, pack, flow);
    setSelectedScenarioIds(new Set(pack.scenarios.map((scenario) => scenario.scenarioId)));
    setLoadStatus('generated');
    setGenerationErrors([]);
    setStage(normalizedCountry, flow, 'TESTING', 'IN_PROGRESS', undefined, {
      testPackKey: `ai.tests.${normalizedCountry}`
    });
  }, [
    filledSamples,
    flow,
    normalizedCountry,
    parsedSampleMessages,
    requirements,
    scenarioOptions
  ]);

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
    const headers = ['Scenario ID', 'Sample', 'Title', 'Type', 'Expected State', 'Expected Error Code'];
    const sampleLabelLookup = new Map(
      (scenarioPack.samples ?? []).map((sample, index) => [sample.sampleId, `Sample ${index + 1}`])
    );
    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const rows = scenarioPack.scenarios.map((scenario) => [
      scenario.scenarioId,
      scenario.sourceSampleId
        ? sampleLabelLookup.get(scenario.sourceSampleId) ?? scenario.sourceSampleId
        : '',
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
      sourceSampleId: scenario.sourceSampleId,
      expectedOutcome: scenario.expectedOutcome,
      xmlVariant: scenario.xmlVariant
    }));
    downloadText(
      JSON.stringify(exportPayload, null, 2),
      `${normalizedCountry || 'pack'}-selected-payloads.json`,
      'application/json;charset=utf-8'
    );
  }, [normalizedCountry, scenarioPack, selectedScenarioIds]);

  const scenarioSelection = useMemo(() => {
    if (!scenarioPack) {
      return { publishList: [] as TestScenario[], selectedCount: 0, total: 0, usingAll: false };
    }
    const selected = scenarioPack.scenarios.filter((scenario) => selectedScenarioIds.has(scenario.scenarioId));
    const usingAll = selected.length === 0;
    return {
      publishList: usingAll ? scenarioPack.scenarios : selected,
      selectedCount: selected.length,
      total: scenarioPack.scenarios.length,
      usingAll
    };
  }, [scenarioPack, selectedScenarioIds]);

  const expectedOutcomeById = useMemo(() => {
    const map = new Map<string, TestScenario['expectedOutcome']>();
    scenarioPack?.scenarios.forEach((scenario) => {
      map.set(scenario.scenarioId, scenario.expectedOutcome);
    });
    return map;
  }, [scenarioPack]);

  const sampleLabelById = useMemo(() => {
    const map = new Map<string, { label: string; msgId?: string | null }>();
    const samples = scenarioPack?.samples ?? [];
    samples.forEach((sample, index) => {
      map.set(sample.sampleId, {
        label: `Sample ${index + 1}`,
        msgId: sample.parsed?.groupHeader.msgId
      });
    });
    return map;
  }, [scenarioPack]);

  const validationResults = useMemo<KafkaValidationResultDto[]>(() => {
    const results = validationResponse?.results;
    return Array.isArray(results) ? results : [];
  }, [validationResponse]);

  const handlePublishScenarios = useCallback(async () => {
    if (!scenarioPack) {
      setPublishError('Generate scenarios before publishing to Kafka.');
      return;
    }
    const clusterAlias = kafkaClusterAlias.trim();
    const topicName = kafkaTopicName.trim();
    if (!clusterAlias || !topicName) {
      setPublishError('Kafka cluster alias and topic name are required.');
      return;
    }
    if (scenarioSelection.publishList.length === 0) {
      setPublishError('No scenarios available to publish.');
      return;
    }
    setPublishError(null);
    setValidationError(null);
    try {
      const response = await publishMutation.mutateAsync({
        clusterAlias,
        topicName,
        messageKey: kafkaMessageKey.trim() || undefined,
        countryCode: normalizedCountry || undefined,
        scenarios: scenarioSelection.publishList.map((scenario) => ({
          scenarioId: scenario.scenarioId,
          payload: scenario.xmlVariant,
          expectedOutcome: {
            state: scenario.expectedOutcome.state,
            errorCode: scenario.expectedOutcome.errorCode,
            notes: scenario.expectedOutcome.notes
          }
        }))
      });
      const enriched: KafkaPublishResponseDto = {
        ...response,
        publishedCount: response.publishedCount ?? scenarioSelection.publishList.length,
        failedCount: response.failedCount ?? response.errors?.length ?? 0
      };
      setPublishResponse(enriched);
      if (enriched.executionId) {
        setExecutionId(enriched.executionId);
      }
      setValidationResponse(null);
    } catch (error) {
      setPublishError(getErrorMessage(error));
    }
  }, [
    kafkaClusterAlias,
    kafkaMessageKey,
    kafkaTopicName,
    normalizedCountry,
    publishMutation,
    scenarioPack,
    scenarioSelection.publishList
  ]);

  const handleValidateExecution = useCallback(async () => {
    const trimmedExecutionId = executionId.trim();
    if (!trimmedExecutionId) {
      setValidationError('Execution ID is required to validate results.');
      return;
    }
    setValidationError(null);
    try {
      const response = await validationMutation.mutateAsync(trimmedExecutionId);
      setValidationResponse(response);
    } catch (error) {
      setValidationError(getErrorMessage(error));
    }
  }, [executionId, validationMutation]);

  const handleMarkTestsPassed = useCallback(() => {
    if (!normalizedCountry) {
      return;
    }
    setStage(normalizedCountry, flow, 'TESTING', 'DONE');
  }, [flow, normalizedCountry]);

  const publishCount = scenarioSelection.publishList.length;
  const publishSelectionNote =
    scenarioSelection.total === 0
      ? 'No scenarios ready to publish.'
      : scenarioSelection.usingAll
      ? `No scenarios selected. Publishing all ${scenarioSelection.total}.`
      : `${scenarioSelection.selectedCount} selected of ${scenarioSelection.total}.`;
  const publishFailureCount = publishResponse
    ? Math.max(publishResponse.failedCount ?? 0, publishResponse.errors?.length ?? 0)
    : 0;
  const publishSuccessCount = publishResponse?.publishedCount ?? publishCount;
  const publishedAtLabel = formatTimestamp(publishResponse?.submittedAt);
  const validationCompletedAt = formatTimestamp(validationResponse?.completedAt);

  const summaryItems = useMemo(
    () =>
      primaryParsed
        ? [
            ['Message Type', primaryParsed.messageType],
            ['MsgId', primaryParsed.groupHeader.msgId],
            ['CreDtTm', primaryParsed.groupHeader.creDtTm],
            ['NbOfTxs', primaryParsed.groupHeader.nbOfTxs],
            ['CtrlSum', primaryParsed.groupHeader.ctrlSum],
            ['Currency', primaryParsed.currency],
            ['Requested Execution Date', primaryParsed.paymentInfo.reqdExctnDt]
          ]
        : [],
    [primaryParsed]
  );

  const extractedGroups = useMemo(() => buildFieldRows(primaryParsed), [primaryParsed]);

  return (
    <Stack spacing={3}>
      <Chip label="Preview / Demo Mode (R2D2 Pending)" color="warning" variant="outlined" />

      <Typography variant="h4">Test Case Generation</Typography>

      <SectionCard
        title="Kafka Input"
        subtitle="Paste one or more Kafka PAIN.001 XML samples, parse, and review extracted fields."
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={handleAddSample}>
              Add Sample
            </Button>
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
              Upload XML Files
            </Button>
            <Button variant="outlined" onClick={() => setBulkPasteOpen(true)}>
              Paste Bulk XML
            </Button>
            <Button variant="outlined" onClick={handleLoadSample}>
              Load Sample PAIN.001
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xml,text/xml"
            hidden
            onChange={handleUploadXmlFiles}
          />
          {sampleEntries.map((entry, index) => {
            const hasContent = Boolean(entry.xml.trim());
            const statusLabel = !hasContent
              ? 'Empty'
              : entry.parseState === 'PARSED'
              ? 'PARSED'
              : entry.parseState === 'ERROR'
              ? 'ERROR'
              : entry.parseState === 'PARSING'
              ? 'PARSING'
              : 'IDLE';
            const statusTone =
              entry.parseState === 'PARSED'
                ? 'success'
                : entry.parseState === 'ERROR'
                ? 'error'
                : 'default';
            const statusChip = (
              <Chip
                label={statusLabel}
                size="small"
                color={statusTone}
                variant="outlined"
                icon={entry.parseState === 'PARSING' ? <CircularProgress size={12} /> : undefined}
              />
            );
            const statusNode =
              entry.parseState === 'ERROR' && entry.parseError ? (
                <Tooltip title={entry.parseError}>{statusChip}</Tooltip>
              ) : (
                statusChip
              );
            return (
              <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="subtitle2">Sample {index + 1}</Typography>
                    {statusNode}
                    {activeSample?.id === entry.id ? (
                      <Chip label="Preview" size="small" color="info" variant="outlined" />
                    ) : null}
                    {sampleEntries.length > 1 ? (
                      <Button size="small" color="error" onClick={() => handleRemoveSample(entry.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </Stack>
                  <TextField
                    label={`Sample ${index + 1} XML`}
                    value={entry.xml}
                    onChange={(event) => handleUpdateSample(entry.id, event.target.value)}
                    onFocus={() => setActiveSampleId(entry.id)}
                    placeholder="Paste pain.001 XML payload..."
                    fullWidth
                    multiline
                    minRows={6}
                    InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
                  />
                </Stack>
              </Paper>
            );
          })}

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="subtitle1">Parse Status</Typography>
              <Chip label={parseSummaryLabel} color={parseSummaryTone} size="small" variant="outlined" />
              {parseSummary.parsingCount > 0 ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CircularProgress size={12} />
                  <Typography variant="caption" color="text.secondary">
                    Parsing...
                  </Typography>
                </Stack>
              ) : null}
              <Tooltip title="Re-parse now">
                <span>
                  <IconButton size="small" onClick={handleReparseNow} disabled={filledSamples.length === 0}>
                    <Replay fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
              <TextField
                select
                label="Primary Sample"
                value={primarySampleId ?? ''}
                onChange={(event) => {
                  setPrimarySampleId(event.target.value);
                  setAutoSelectPrimary(false);
                }}
                disabled={parsedSamples.length === 0}
                helperText={parsedSamples.length === 0 ? 'Parse a sample to select primary.' : undefined}
                sx={{ minWidth: 240 }}
              >
                {parsedSamples.map((entry) => {
                  const index = sampleIndexById.get(entry.id) ?? 0;
                  return (
                    <MenuItem key={entry.id} value={entry.id}>
                      Sample {index + 1} — MsgId: {entry.msgId ?? '—'}
                    </MenuItem>
                  );
                })}
              </TextField>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoSelectPrimary}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setAutoSelectPrimary(checked);
                      if (checked && parsedSamples.length > 0) {
                        setPrimarySampleId(parsedSamples[0].id);
                      }
                      if (!checked && !primarySampleId && parsedSamples.length > 0) {
                        setPrimarySampleId(parsedSamples[0].id);
                      }
                    }}
                  />
                }
                label="Auto-select Primary Sample"
              />
            </Stack>
            {parseErrorSummaries.length ? (
              <Accordion variant="outlined">
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">Errors ({parseErrorSummaries.length})</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    {parseErrorSummaries.map((entry) => (
                      <Stack
                        key={entry.id}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ sm: 'center' }}
                        justifyContent="space-between"
                      >
                        <Stack spacing={0.25}>
                          <Typography variant="body2">{entry.label}</Typography>
                          <Typography variant="caption" color="error">
                            {entry.error}
                          </Typography>
                        </Stack>
                        <Button size="small" color="error" onClick={() => handleRemoveSample(entry.id)}>
                          Remove sample
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ) : null}
          </Stack>

          {primaryParsed ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1">Parsed Summary</Typography>
                {primarySampleIndex >= 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    Using Primary Sample {primarySampleIndex + 1} of {sampleEntries.length}.
                  </Typography>
                ) : null}
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
              {primarySampleIndex >= 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Using Primary Sample {primarySampleIndex + 1} for field extraction.
                </Typography>
              ) : null}
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
              {activeSampleIndex >= 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Showing Sample {activeSampleIndex + 1} of {sampleEntries.length}.
                </Typography>
              ) : null}
              <Typography
                variant="body2"
                component="pre"
                sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 240, overflow: 'auto' }}
              >
                {activeXml || 'No XML loaded.'}
              </Typography>
            </Stack>
          </Paper>

          <Dialog open={bulkPasteOpen} onClose={() => setBulkPasteOpen(false)} fullWidth maxWidth="md">
            <DialogTitle>Paste Bulk XML Samples</DialogTitle>
            <DialogContent>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <TextField
                  label="XML documents"
                  value={bulkPasteValue}
                  onChange={(event) => setBulkPasteValue(event.target.value)}
                  placeholder="Paste multiple XML documents here. Each document should begin with <?xml or <Document."
                  fullWidth
                  multiline
                  minRows={10}
                  InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
                />
                <Typography variant="caption" color="text.secondary">
                  We will split on &quot;&lt;?xml&quot; or &quot;&lt;Document&quot; to create separate samples.
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setBulkPasteOpen(false);
                  setBulkPasteValue('');
                }}
              >
                Cancel
              </Button>
              <Button variant="contained" onClick={handleConfirmBulkPaste} disabled={!bulkPasteValue.trim()}>
                Add Samples
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </SectionCard>

      <SectionCard title="Scenario Generator" subtitle="Generate deterministic variants from the sample messages.">
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <CountryCodeField
              value={countryCode}
              onChange={setCountryCode}
              required
              helperText="Country context for generated test scenarios."
            />
            <TextField
              select
              label="Flow"
              value={flow}
              onChange={(event) => setFlow(event.target.value as Flow)}
              helperText="Flow context for requirements and scenario expectations."
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="INCOMING">INCOMING</MenuItem>
              <MenuItem value="OUTGOING">OUTGOING</MenuItem>
            </TextField>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography variant="subtitle1">Requirements Context</Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={requirements ? 'success' : 'default'}
                  label={requirements ? `${requirements.requirements.length} requirements` : 'Not loaded'}
                />
                {requirementsSource ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={requirementsSource === 'storage' ? 'from storage' : 'from mock'}
                  />
                ) : null}
              </Stack>
              {requirements ? (
                <Typography variant="body2" color="text.secondary">
                  {requirements.summary.headline}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Load requirements to align scenario expectations with country-specific rules.
                </Typography>
              )}
              {requirements?.meta.generatedAt ? (
                <Typography variant="caption" color="text.secondary">
                  Generated: {formatTimestamp(requirements.meta.generatedAt)}
                </Typography>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
                <Button
                  variant="outlined"
                  onClick={handleLoadRequirements}
                  disabled={requirementsStatus === 'loading'}
                >
                  {requirementsStatus === 'loading' ? 'Loading...' : 'Load Requirements'}
                </Button>
                {requirementsError ? (
                  <Typography variant="caption" color="error">
                    {requirementsError}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              Parsed Samples: {parsedSamples.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              MsgIds: {parsedMsgIdSummary}
            </Typography>
          </Stack>
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
          <Button variant="contained" onClick={handleGenerateScenarios} disabled={parsedSamples.length === 0}>
            Generate Test Scenarios
          </Button>
          {parsedSamples.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Upload at least one valid PAIN.001 XML message.
            </Typography>
          ) : null}
          {generationErrors.length ? (
            <Alert severity="error">
              {generationErrors.map((message) => (
                <Typography key={message} variant="body2">
                  {message}
                </Typography>
              ))}
            </Alert>
          ) : null}

          {scenarioPack ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Scenario Pack</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Scenario ID</TableCell>
                        <TableCell>Base Sample</TableCell>
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
                          <TableCell>
                            {scenario.sourceSampleId
                              ? (() => {
                                  const details = sampleLabelById.get(scenario.sourceSampleId);
                                  if (!details) {
                                    return scenario.sourceSampleId;
                                  }
                                  return `${details.label}${details.msgId ? ` / ${details.msgId}` : ''}`;
                                })()
                              : '—'}
                          </TableCell>
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
                          <TableCell colSpan={8}>
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

      <SectionCard title="Validation Run (Preview)" subtitle="Simulate publishing to Kafka and validating results.">
        <ValidationRunPanel
          countryCode={normalizedCountry}
          flow={flow}
          scenarioPack={scenarioPack}
          selectedScenarioIds={selectedScenarioIds}
        />
      </SectionCard>

      <SectionCard
        title="Kafka Execution"
        subtitle="Publish selected scenarios to Kafka and validate downstream outcomes."
      >
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Publish Settings</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <TextField
                  label="Cluster Alias"
                  value={kafkaClusterAlias}
                  onChange={(event) => setKafkaClusterAlias(event.target.value)}
                  placeholder="payments-ingress"
                  required
                  sx={{ flex: 1, minWidth: 220 }}
                />
                <TextField
                  label="Topic Name"
                  value={kafkaTopicName}
                  onChange={(event) => setKafkaTopicName(event.target.value)}
                  placeholder="pain001.incoming"
                  required
                  sx={{ flex: 1, minWidth: 220 }}
                />
                <TextField
                  label="Message Key (optional)"
                  value={kafkaMessageKey}
                  onChange={(event) => setKafkaMessageKey(event.target.value)}
                  placeholder="msgId-123"
                  sx={{ flex: 1, minWidth: 220 }}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
                <Button
                  variant="contained"
                  onClick={handlePublishScenarios}
                  disabled={
                    publishMutation.isPending ||
                    !scenarioPack ||
                    !kafkaClusterAlias.trim() ||
                    !kafkaTopicName.trim() ||
                    publishCount === 0
                  }
                >
                  {publishMutation.isPending ? 'Publishing...' : 'Publish Selected to Kafka'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {publishSelectionNote}
                </Typography>
              </Stack>
              {publishError ? <Alert severity="error">{publishError}</Alert> : null}
              {publishResponse ? (
                <Alert severity={publishFailureCount > 0 ? 'warning' : 'success'}>
                  <Stack spacing={0.25}>
                    <Typography variant="body2">
                      Execution ID: {publishResponse.executionId ?? '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Published {publishSuccessCount} scenario{publishSuccessCount === 1 ? '' : 's'}
                      {publishFailureCount > 0 ? ` · ${publishFailureCount} failed` : ''}
                      {publishedAtLabel ? ` · Submitted ${publishedAtLabel}` : ''}
                    </Typography>
                  </Stack>
                </Alert>
              ) : null}
              {publishResponse?.errors?.length ? (
                <Alert severity="warning">
                  <Stack spacing={0.5}>
                    <Typography variant="body2">Failed publishes</Typography>
                    {publishResponse.errors.map((error, index) => (
                      <Typography key={`${error.scenarioId ?? 'publish'}-${index}`} variant="caption">
                        {error.scenarioId ?? 'Unknown'}: {error.message ?? 'Publish failed.'}
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Validation</Typography>
              <TextField
                label="Execution ID"
                value={executionId}
                onChange={(event) => setExecutionId(event.target.value)}
                placeholder="exec-2026-02-21-001"
                helperText="Paste an execution ID to validate later."
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
                <Button
                  variant="outlined"
                  onClick={handleValidateExecution}
                  disabled={validationMutation.isPending || !executionId.trim()}
                >
                  {validationMutation.isPending ? 'Validating...' : 'Fetch Validation Results'}
                </Button>
                {validationResponse?.status ? (
                  <Chip
                    label={`Status: ${validationResponse.status}`}
                    color={resolveStatusTone(validationResponse.status)}
                    size="small"
                    variant={resolveStatusTone(validationResponse.status) === 'default' ? 'outlined' : 'filled'}
                  />
                ) : null}
                {validationCompletedAt ? (
                  <Typography variant="caption" color="text.secondary">
                    Completed: {validationCompletedAt}
                  </Typography>
                ) : null}
              </Stack>
              {validationError ? <Alert severity="error">{validationError}</Alert> : null}
              {validationResults.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Scenario ID</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Expected Outcome</TableCell>
                        <TableCell>Actual Outcome</TableCell>
                        <TableCell>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {validationResults.map((result, index) => {
                        const expected = result.scenarioId ? expectedOutcomeById.get(result.scenarioId) : undefined;
                        const expectedState = expected?.state ?? result.expectedState;
                        const expectedErrorCode = expected?.errorCode ?? result.expectedErrorCode;
                        const actualState = result.actualState;
                        const actualErrorCode = result.actualErrorCode;
                        const expectedLabel = expectedState
                          ? `${expectedState}${expectedErrorCode ? ` (${expectedErrorCode})` : ''}`
                          : '—';
                        const actualLabel = actualState
                          ? `${actualState}${actualErrorCode ? ` (${actualErrorCode})` : ''}`
                          : '—';
                        const statusLabel = result.status ?? 'Unknown';
                        const tone = resolveStatusTone(statusLabel);
                        return (
                          <TableRow key={`${result.scenarioId ?? 'result'}-${index}`} hover>
                            <TableCell>{result.scenarioId ?? '—'}</TableCell>
                            <TableCell>
                              <Chip
                                label={statusLabel}
                                color={tone}
                                size="small"
                                variant={tone === 'default' ? 'outlined' : 'filled'}
                              />
                            </TableCell>
                            <TableCell>{expectedLabel}</TableCell>
                            <TableCell>{actualLabel}</TableCell>
                            <TableCell>{result.message ?? result.details ?? '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No validation results yet.</Alert>
              )}
            </Stack>
          </Paper>
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
            <Button variant="outlined" onClick={handleMarkTestsPassed} disabled={!scenarioPack}>
              Mark Tests Passed
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
                  {activeScenario.scenarioId}
                  {activeScenario.sourceSampleId
                    ? (() => {
                        const details = sampleLabelById.get(activeScenario.sourceSampleId);
                        if (!details) {
                          return ` · ${activeScenario.sourceSampleId}`;
                        }
                        return ` · ${details.label}${details.msgId ? ` / ${details.msgId}` : ''}`;
                      })()
                    : ''}
                  {` · ${activeScenario.expectedOutcome.state}`}
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
