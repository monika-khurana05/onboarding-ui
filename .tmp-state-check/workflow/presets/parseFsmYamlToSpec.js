import { load } from 'js-yaml';
const normalizeActions = (actions) => {
    if (!Array.isArray(actions)) {
        return [];
    }
    const seen = new Set();
    const result = [];
    actions.forEach((action) => {
        const next = String(action).trim();
        if (!next || seen.has(next)) {
            return;
        }
        seen.add(next);
        result.push(next);
    });
    return result;
};
const normalizeTransition = (raw) => {
    const target = typeof raw.target === 'string' ? raw.target : '';
    return {
        target,
        actions: normalizeActions(raw.actions)
    };
};
const normalizeOnEvent = (raw) => {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    return Object.entries(raw).reduce((acc, [eventName, transition]) => {
        if (!transition || typeof transition !== 'object') {
            return acc;
        }
        acc[eventName] = normalizeTransition(transition);
        return acc;
    }, {});
};
export function parseFsmYamlToSpec(yamlText) {
    const rawParsed = load(yamlText);
    const parsed = rawParsed && typeof rawParsed === 'object' ? rawParsed : undefined;
    const statesRaw = parsed?.states;
    const states = [];
    if (statesRaw && typeof statesRaw === 'object') {
        Object.entries(statesRaw).forEach(([stateName, stateValue]) => {
            if (!stateValue || typeof stateValue !== 'object') {
                states.push({ name: stateName, onEvent: {} });
                return;
            }
            const rawState = stateValue;
            states.push({
                name: stateName,
                onEvent: normalizeOnEvent(rawState.on_event)
            });
        });
    }
    const resolvedStatesClass = typeof parsed?.statesClass === 'string' ? parsed.statesClass : undefined;
    const resolvedEventsClass = typeof parsed?.eventsClass === 'string' ? parsed.eventsClass : undefined;
    const resolvedStartState = typeof parsed?.startState === 'string' && parsed.startState.trim() ? parsed.startState : undefined;
    const startState = resolvedStartState ?? states[0]?.name ?? '';
    return {
        workflowKey: '',
        statesClass: resolvedStatesClass,
        eventsClass: resolvedEventsClass,
        startState,
        states
    };
}
