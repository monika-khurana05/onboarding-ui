const STORAGE_KEY_PREFIX = 'state-manager-draft';
function buildStorageKey(countryCode, flowDirection) {
    return `${STORAGE_KEY_PREFIX}:${countryCode.trim().toUpperCase()}:${flowDirection}`;
}
function getStorage() {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage;
    }
    catch {
        return null;
    }
}
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function isOptionalString(value) {
    return value === undefined || typeof value === 'string';
}
function isOptionalBoolean(value) {
    return value === undefined || typeof value === 'boolean';
}
function isStatusRow(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.id === 'string' &&
        typeof value.msgStatus === 'string' &&
        typeof value.msgSubStatus === 'string' &&
        typeof value.channelPushNotification === 'boolean' &&
        typeof value.cdmNotification === 'boolean' &&
        typeof value.transactionStatus === 'string' &&
        typeof value.transactionStatusReason === 'string' &&
        typeof value.reasonDescription === 'string' &&
        isOptionalString(value.scenario) &&
        isOptionalString(value.responsibleComponent) &&
        isOptionalBoolean(value.triggerReversal));
}
function isSubFlow(value) {
    return (isRecord(value) &&
        typeof value.id === 'string' &&
        typeof value.title === 'string' &&
        Array.isArray(value.rows) &&
        value.rows.every(isStatusRow));
}
function isScenarioCategory(value) {
    return (isRecord(value) &&
        typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        typeof value.description === 'string' &&
        Array.isArray(value.subFlows) &&
        value.subFlows.every(isSubFlow) &&
        typeof value.hasScenarioColumn === 'boolean' &&
        typeof value.hasResponsibleColumn === 'boolean' &&
        typeof value.hasTriggerReversalColumn === 'boolean');
}
function isFlowDirection(value) {
    return value === 'INCOMING' || value === 'OUTGOING';
}
function isStateManagerConfig(value) {
    return (isRecord(value) &&
        typeof value.countryCode === 'string' &&
        isFlowDirection(value.flowDirection) &&
        Array.isArray(value.scenarios) &&
        value.scenarios.every(isScenarioCategory) &&
        typeof value.lastUpdated === 'string');
}
export function saveStateManagerDraft(config) {
    const storage = getStorage();
    if (!storage) {
        return;
    }
    storage.setItem(buildStorageKey(config.countryCode, config.flowDirection), JSON.stringify(config));
}
export function loadStateManagerDraft(countryCode, flowDirection) {
    const storage = getStorage();
    if (!storage) {
        return null;
    }
    const raw = storage.getItem(buildStorageKey(countryCode, flowDirection));
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!isStateManagerConfig(parsed)) {
            return null;
        }
        const normalizedCountryCode = countryCode.trim().toUpperCase();
        if (parsed.countryCode.trim().toUpperCase() !== normalizedCountryCode || parsed.flowDirection !== flowDirection) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
export function clearStateManagerDraft(countryCode, flowDirection) {
    const storage = getStorage();
    if (!storage) {
        return;
    }
    storage.removeItem(buildStorageKey(countryCode, flowDirection));
}
