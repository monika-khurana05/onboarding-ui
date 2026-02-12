export type ValidationCatalogItem = {
  id: string;
  className: string;
  keyStatus: string;
  description: string;
};

export const validationCatalog: ValidationCatalogItem[] = [
  {
    id: 'validation:AccountCurrencyValidationRule',
    className: 'AccountCurrencyValidationRule',
    keyStatus: 'CURRENCY_INVALID',
    description: 'Creditor account currency invalid or missing'
  },
  {
    id: 'validation:CreditorMembershipValidationRule',
    className: 'CreditorMembershipValidationRule',
    keyStatus: 'CREDITOR_MEMBERSHIP_INVALID',
    description: 'Debtor Membership Invalid'
  },
  {
    id: 'validation:DebtorMembershipValidationRule',
    className: 'DebtorMembershipValidationRule',
    keyStatus: 'DEBTOR_MEMBERSHIP_INVALID',
    description: 'Debtor Membership Invalid'
  },
  {
    id: 'validation:ParticipantIDValidationRule',
    className: 'ParticipantIDValidationRule',
    keyStatus: 'PARTICIPANT_INVALID',
    description: 'Participant Id is invalid'
  },
  {
    id: 'validation:OpenRequestValidationRule',
    className: 'OpenRequestValidationRule',
    keyStatus: 'OPEN_REQUEST_EXISTS',
    description: 'Request for Return of Funds already exists'
  },
  {
    id: 'validation:LocalInstrumentValidationRule',
    className: 'LocalInstrumentValidationRule',
    keyStatus: 'ULT_DR_CR_MISSING',
    description: 'Local instrument is invalid or missing'
  },
  {
    id: 'validation:AccountAddressValidationRule',
    className: 'AccountAddressValidationRule',
    keyStatus: 'INVALID_DEBTOR_ADDRESS',
    description: 'Missing Debtor Address'
  },
  {
    id: 'validation:AssgnmIdValidationRule',
    className: 'AssgnmIdValidationRule',
    keyStatus: 'TRANSACTIONAL_ID_MISMATCH',
    description: 'One or more original IDs does not match original request IDs.'
  },
  {
    id: 'validation:IntrBkSttlmDtValidationRule',
    className: 'IntrBkSttlmDtValidationRule',
    keyStatus: 'DATE_INVALID',
    description: 'InterbankSettlementDate is invalid'
  },
  {
    id: 'validation:EarmarkAmountValidationRule',
    className: 'EarmarkAmountValidationRule',
    keyStatus: 'EARMARK_AMOUNT_BREACH',
    description: 'Earmarking amount breach'
  }
];
