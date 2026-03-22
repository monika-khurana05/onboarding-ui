import type { CountryActionPolicy } from './types';

export const brPolicy: CountryActionPolicy = {
  countryCode: 'BR',
  semanticActionBuilders: {
    CLEARING_RESPONSE_RECEIVED: (ctx) => (ctx.direction === 'outgoing' ? ['process-clearing-response-br'] : []),
    POSTING_FAILURE: (ctx) => (ctx.direction === 'outgoing' ? ['process-posting-error-br'] : [])
  }
};
