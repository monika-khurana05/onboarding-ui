import type { ParsedPain001 } from '../types';

export type ParsedPain001Result =
  | { ok: true; data: ParsedPain001 }
  | { ok: false; errors: string[] };

function normalizeTagName(tagName: string) {
  const normalized = tagName.includes(':') ? tagName.split(':').pop() : tagName;
  return normalized ?? tagName;
}

function matchesTag(element: Element, tagName: string) {
  const target = normalizeTagName(tagName);
  const localName = element.localName ?? normalizeTagName(element.tagName);
  return localName === target || normalizeTagName(element.tagName) === target;
}

function findByPath(root: Document | Element, selectorPath: string): Element | null {
  const segments = selectorPath.split('.').filter(Boolean);
  let current: Document | Element = root;
  for (const segment of segments) {
    const children = Array.from(current.childNodes).filter((node) => node.nodeType === 1) as Element[];
    const next = children.find((child) => matchesTag(child, segment));
    if (!next) {
      return null;
    }
    current = next;
  }
  return current as Element;
}

export function safeGetText(root: Document | Element, selectorPath: string): string | null {
  const node = findByPath(root, selectorPath);
  if (!node) {
    return null;
  }
  const text = node.textContent?.trim();
  return text ? text : null;
}

function safeGetAttr(root: Document | Element, selectorPath: string, attrName: string): string | null {
  const node = findByPath(root, selectorPath);
  if (!node) {
    return null;
  }
  const value = node.getAttribute(attrName);
  return value ? value.trim() : null;
}

export function parsePain001(xml: string): ParsedPain001Result {
  const trimmed = xml.trim();
  if (!trimmed) {
    return { ok: false, errors: ['XML payload is empty.'] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, 'application/xml');
  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    return {
      ok: false,
      errors: ['XML parsing failed. Check the payload syntax.']
    };
  }

  const messageType = findByPath(doc, 'Document.CstmrCdtTrfInitn') ? 'pain.001.001.03' : 'unknown';
  const currency = safeGetAttr(
    doc,
    'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Amt.InstdAmt',
    'Ccy'
  );

  const data: ParsedPain001 = {
    messageType,
    groupHeader: {
      msgId: safeGetText(doc, 'Document.CstmrCdtTrfInitn.GrpHdr.MsgId'),
      creDtTm: safeGetText(doc, 'Document.CstmrCdtTrfInitn.GrpHdr.CreDtTm'),
      nbOfTxs: safeGetText(doc, 'Document.CstmrCdtTrfInitn.GrpHdr.NbOfTxs'),
      ctrlSum: safeGetText(doc, 'Document.CstmrCdtTrfInitn.GrpHdr.CtrlSum'),
      initgPtyNm: safeGetText(doc, 'Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Nm')
    },
    paymentInfo: {
      pmtInfId: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.PmtInfId'),
      pmtMtd: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.PmtMtd'),
      svcLvlCd: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.PmtTpInf.SvcLvl.Cd'),
      lclInstrmPrtry: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.PmtTpInf.LclInstrm.Prtry'),
      reqdExctnDt: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.ReqdExctnDt')
    },
    debtor: {
      name: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.Dbtr.Nm'),
      accountId: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.DbtrAcct.Id.Othr.Id'),
      accountTypeCd: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.DbtrAcct.Tp.Cd')
    },
    creditor: {
      name: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Cdtr.Nm'),
      postalAdrLine: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.Cdtr.PstlAdr.AdrLine'),
      accountId: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAcct.Id.Othr.Id'),
      accountTypeCd: safeGetText(doc, 'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAcct.Tp.Cd')
    },
    creditorAgent: {
      clrSysMmbId: safeGetText(
        doc,
        'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAgt.FinInstnId.ClrSysMmbId.MmbId'
      ),
      othrId: safeGetText(
        doc,
        'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAgt.FinInstnId.Othr.Id'
      ),
      brcId: safeGetText(
        doc,
        'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAgt.FinInstnId.BrcId.Id'
      ),
      othrSchemeCd: safeGetText(
        doc,
        'Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.CdtrAgt.FinInstnId.Othr.SchmeNm.Cd'
      )
    },
    currency
  };

  return { ok: true, data };
}
