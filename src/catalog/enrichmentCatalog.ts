export type EnrichmentCatalogItem = {
  id: string;
  className: string;
  key: string;
  description: string;
};

export const enrichmentCatalog: EnrichmentCatalogItem[] = [
  {
    id: 'enrichment:CreditorAccountEnricher',
    className: 'CreditorAccountEnricher',
    key: 'Creditor AccountNo',
    description: 'Enrich Account BranchCode, category from account collection'
  },
  {
    id: 'enrichment:BookingEntityEnricher',
    className: 'BookingEntityEnricher',
    key: 'Creditor/Debtor Account Type',
    description: 'Enrich Debit and CreditBookingEntity'
  },
  {
    id: 'enrichment:CreditorMembershipEnricher',
    className: 'CreditorMembershipEnricher',
    key: 'creditor NccCode',
    description: 'Enrich CdtAgtNm and OrigCdtAgtNm from Membership collection'
  },
  {
    id: 'enrichment:DebtorMembershipEnricher',
    className: 'DebtorMembershipEnricher',
    key: 'Debtor NccCode',
    description: 'Enrich CdtAgtNm and OrigCdtAgtNm from Membership collection'
  },
  {
    id: 'enrichment:TransactionLevelEarmarkingEnricher',
    className: 'TransactionLevelEarmarkingEnricher',
    key: 'DebtorAccountNo',
    description: 'Enrich the transaction type like isAdvanced or TransactionalEarmarking'
  },
  {
    id: 'enrichment:NotificationRoutingIndicatorEnricher',
    className: 'NotificationRoutingIndicatorEnricher',
    key: 'kafkaProvider',
    description: 'Enrich the kafkaProvider based on Routing amount and account for Migration'
  },
  {
    id: 'enrichment:MopEnricher',
    className: 'MopEnricher',
    key: 'drMop/DrMop',
    description: 'Enrich the Method of Payment based on payment SchemeName'
  },
  {
    id: 'enrichment:VirtualAccountInfoEnricher',
    className: 'VirtualAccountInfoEnricher',
    key: 'Creditor/Debtor AccountNo',
    description: 'Enrich Account BranchCode, category from VirtualAccount collection'
  },
  {
    id: 'enrichment:ItemizedAccountEnricher',
    className: 'ItemizedAccountEnricher',
    key: 'isitemized Falg',
    description: 'Enrich the isItemized flag based on postingAccount'
  },
  {
    id: 'enrichment:GlobalMessageEnricher',
    className: 'GlobalMessageEnricher',
    key: 'transType,MsgDirection, msgType and Country',
    description: 'Enrich the information like transType, MsgDirection, msgType and Country'
  },
  {
    id: 'enrichment:SettlementCurrencyEnricher',
    className: 'SettlementCurrencyEnricher',
    key: 'IntrBkSttlmAmtCcy',
    description: 'Enrich the IntrBkSttlmAmtCcy and currency'
  }
];
