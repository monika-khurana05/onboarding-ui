import type { TestScenario } from '../../types';
import type { PerScenarioResult, TopicConfig, ValidationCheck, ValidationRun } from './types';

export type ValidationRunnerEvent =
  | { type: 'status'; status: ValidationRun['status'] }
  | { type: 'publish'; scenarioId: string; publish: PerScenarioResult['publish'] }
  | { type: 'validation'; scenarioId: string; validation: PerScenarioResult['validation'] };

export type ValidationRunner = {
  cancel: () => void;
};

type StartRunParams = {
  run: ValidationRun;
  scenarios: TestScenario[];
  topics: TopicConfig[];
  onEvent: (event: ValidationRunnerEvent) => void;
};

function randomDelay() {
  return 200 + Math.floor(Math.random() * 600);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function hasMutation(scenario: TestScenario, keyword: string) {
  const needle = normalize(keyword);
  return scenario.mutations.some((mutation) => normalize(mutation).includes(needle));
}

function hasKeyword(value: string, keyword: string) {
  return normalize(value).includes(normalize(keyword));
}

function resolveFailure(scenario: TestScenario) {
  const missingDebtor = hasMutation(scenario, 'remove dbtracct');
  if (missingDebtor) {
    return { errorCode: 'MISSING_DEBTOR_ACCOUNT', failureCheck: 'RequiredFields' };
  }
  const missingCreditor = hasMutation(scenario, 'remove cdtracct');
  if (missingCreditor) {
    return { errorCode: 'MISSING_CREDITOR_ACCOUNT', failureCheck: 'RequiredFields' };
  }
  const duplicateHint =
    hasMutation(scenario, 'duplicate') ||
    hasKeyword(scenario.title, 'duplicate') ||
    hasKeyword(scenario.scenarioId, 'dup');
  if (duplicateHint) {
    return { errorCode: 'DUPLICATE_PAYMENT', failureCheck: 'DupCheck' };
  }
  return null;
}

function buildChecks(failureCheck?: string): ValidationCheck[] {
  const checks: ValidationCheck[] = [
    { name: 'SchemaValidation', status: 'PASS' },
    { name: 'RequiredFields', status: 'PASS' },
    { name: 'DupCheck', status: 'PASS' },
    { name: 'CutoffRules', status: 'PASS' }
  ];
  if (!failureCheck) {
    return checks;
  }
  return checks.map((check) =>
    check.name === failureCheck ? { ...check, status: 'FAIL' } : check
  );
}

function topicForScenario(topics: TopicConfig[], index: number) {
  if (!topics.length) {
    return 'cpx.validation.in';
  }
  const topic = topics[index % topics.length];
  return topic?.topicName ?? 'cpx.validation.in';
}

export function startValidationRun({ run, scenarios, topics, onEvent }: StartRunParams): ValidationRunner {
  let cancelled = false;
  const timers: Array<number> = [];
  let completed = 0;

  const schedule = (fn: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        fn();
      }
    }, delay);
    timers.push(timer);
  };

  const now = () => new Date().toISOString();

  onEvent({ type: 'status', status: 'RUNNING' });

  scenarios.forEach((scenario, index) => {
    const topicName = topicForScenario(topics, index);
    schedule(() => {
      onEvent({
        type: 'publish',
        scenarioId: scenario.scenarioId,
        publish: {
          status: 'SENT',
          topic: topicName,
          key: scenario.scenarioId,
          timestamp: now()
        }
      });

      schedule(() => {
        onEvent({
          type: 'publish',
          scenarioId: scenario.scenarioId,
          publish: {
            status: 'ACKED',
            topic: topicName,
            partition: index % 4,
            offset: 1000 + index,
            key: scenario.scenarioId,
            timestamp: now()
          }
        });

        schedule(() => {
          const failure = resolveFailure(scenario);
          const checks = buildChecks(failure?.failureCheck);
          onEvent({
            type: 'validation',
            scenarioId: scenario.scenarioId,
            validation: {
              status: failure ? 'FAIL' : 'PASS',
              checks,
              errorCode: failure?.errorCode,
              message: failure ? `Failed: ${failure.errorCode}` : 'All checks passed.'
            }
          });
          completed += 1;
          if (completed === scenarios.length) {
            onEvent({ type: 'status', status: 'COMPLETED' });
          }
        }, randomDelay());
      }, randomDelay());
    }, randomDelay());
  });

  return {
    cancel: () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      onEvent({ type: 'status', status: 'CANCELLED' });
    }
  };
}
