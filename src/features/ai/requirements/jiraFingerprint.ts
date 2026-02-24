function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function fingerprintEpic(args: {
  countryCode?: string;
  capabilityId: string;
  epicTitle: string;
}): string {
  const country = (args.countryCode || 'xx').toLowerCase();
  const normalizedTitle = normalizeTitle(args.epicTitle);
  return `${country}|${args.capabilityId}|${normalizedTitle}`;
}
