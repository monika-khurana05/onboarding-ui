import type { ParamDefDto } from './types';

const numberTypes = new Set(['INT', 'LONG', 'DECIMAL']);

export function buildDefaultParams(paramDefs: ParamDefDto[]): Record<string, unknown> {
  return paramDefs.reduce<Record<string, unknown>>((acc, param) => {
    if (param.default !== undefined) {
      acc[param.name] = param.default;
      return acc;
    }
    if (param.required) {
      switch (param.type) {
        case 'BOOLEAN':
          acc[param.name] = false;
          break;
        case 'INT':
        case 'LONG':
        case 'DECIMAL':
          acc[param.name] = 0;
          break;
        case 'LIST':
          acc[param.name] = [];
          break;
        case 'JSON':
          acc[param.name] = {};
          break;
        default:
          acc[param.name] = '';
          break;
      }
    }
    return acc;
  }, {});
}

export function toDraftParams(paramDefs: ParamDefDto[], params?: Record<string, unknown>): Record<string, unknown> {
  const defaults = buildDefaultParams(paramDefs);
  const merged = { ...defaults, ...(params ?? {}) };
  return paramDefs.reduce<Record<string, unknown>>((acc, param) => {
    const value = merged[param.name];
    if (param.type === 'JSON') {
      if (typeof value === 'string') {
        acc[param.name] = value;
      } else if (value === undefined || value === null) {
        acc[param.name] = '';
      } else {
        acc[param.name] = JSON.stringify(value, null, 2);
      }
      return acc;
    }
    if (param.type === 'LIST') {
      if (Array.isArray(value)) {
        acc[param.name] = value.join(', ');
      } else if (typeof value === 'string') {
        acc[param.name] = value;
      } else {
        acc[param.name] = '';
      }
      return acc;
    }
    if (param.type === 'BOOLEAN') {
      acc[param.name] = Boolean(value);
      return acc;
    }
    acc[param.name] = value ?? '';
    return acc;
  }, {});
}

export function coerceParams(paramDefs: ParamDefDto[], values: Record<string, unknown>): Record<string, unknown> {
  return paramDefs.reduce<Record<string, unknown>>((acc, param) => {
    const raw = values[param.name];

    if (raw === undefined) {
      return acc;
    }

    if (param.type === 'BOOLEAN') {
      acc[param.name] = Boolean(raw);
      return acc;
    }

    if (numberTypes.has(param.type)) {
      if (raw === '' || raw === null) {
        acc[param.name] = raw;
        return acc;
      }
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      acc[param.name] = numeric;
      return acc;
    }

    if (param.type === 'LIST') {
      if (Array.isArray(raw)) {
        acc[param.name] = raw;
      } else if (typeof raw === 'string') {
        acc[param.name] = raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        acc[param.name] = [];
      }
      return acc;
    }

    if (param.type === 'JSON') {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) {
          acc[param.name] = null;
        } else {
          try {
            acc[param.name] = JSON.parse(trimmed);
          } catch {
            acc[param.name] = raw;
          }
        }
      } else {
        acc[param.name] = raw;
      }
      return acc;
    }

    acc[param.name] = raw;
    return acc;
  }, {});
}

export function validateParams(paramDefs: ParamDefDto[], values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};

  paramDefs.forEach((param) => {
    const raw = values[param.name];
    const rawString = typeof raw === 'string' ? raw.trim() : raw;
    const isListValue = Array.isArray(raw);
    const isEmpty =
      raw === undefined ||
      raw === null ||
      rawString === '' ||
      (isListValue && raw.length === 0);

    if (param.required && isEmpty) {
      errors[param.name] = 'This field is required.';
      return;
    }

    if (numberTypes.has(param.type) && !isEmpty) {
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(numeric)) {
        errors[param.name] = 'Enter a valid number.';
        return;
      }
      if (typeof param.constraints?.min === 'number' && numeric < param.constraints.min) {
        errors[param.name] = `Minimum value is ${param.constraints.min}.`;
        return;
      }
      if (typeof param.constraints?.max === 'number' && numeric > param.constraints.max) {
        errors[param.name] = `Maximum value is ${param.constraints.max}.`;
        return;
      }
    }

    if ((param.type === 'STRING' || param.type === 'REGEX') && typeof raw === 'string') {
      if (typeof param.constraints?.minLength === 'number' && raw.length < param.constraints.minLength) {
        errors[param.name] = `Minimum length is ${param.constraints.minLength}.`;
        return;
      }
      if (typeof param.constraints?.maxLength === 'number' && raw.length > param.constraints.maxLength) {
        errors[param.name] = `Maximum length is ${param.constraints.maxLength}.`;
        return;
      }
      if (param.constraints?.pattern) {
        try {
          const regex = new RegExp(param.constraints.pattern);
          if (!regex.test(raw)) {
            errors[param.name] = 'Value does not match expected pattern.';
            return;
          }
        } catch {
          // Ignore invalid pattern from metadata.
        }
      }
    }

    if (param.type === 'ENUM' && !isEmpty && param.constraints?.enumValues?.length) {
      if (!param.constraints.enumValues.includes(String(raw))) {
        errors[param.name] = 'Select a valid option.';
        return;
      }
    }

    if (param.type === 'JSON' && !isEmpty) {
      if (typeof raw === 'string') {
        try {
          JSON.parse(raw);
        } catch {
          errors[param.name] = 'Enter valid JSON.';
        }
      }
    }
  });

  return errors;
}
