// Demo-only XML mutations. In production, use a proper XML builder/parser.
export function setTagText(xml: string, tagName: string, newValue: string, occurrenceIndex = 0): string {
  const regex = new RegExp(`<${tagName}(\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'g');
  let matchIndex = 0;
  return xml.replace(regex, (match, attrs = '') => {
    if (matchIndex === occurrenceIndex) {
      matchIndex += 1;
      return `<${tagName}${attrs}>${newValue}</${tagName}>`;
    }
    matchIndex += 1;
    return match;
  });
}

export function removeTag(xml: string, tagName: string, occurrenceIndex = 0): string {
  const regex = new RegExp(`<${tagName}(\\s[^>]*)?>[\\s\\S]*?</${tagName}>`, 'g');
  let matchIndex = 0;
  return xml.replace(regex, (match) => {
    if (matchIndex === occurrenceIndex) {
      matchIndex += 1;
      return '';
    }
    matchIndex += 1;
    return match;
  });
}

export function replaceFirst(xml: string, searchText: string, replaceText: string): string {
  const index = xml.indexOf(searchText);
  if (index === -1) {
    return xml;
  }
  return `${xml.slice(0, index)}${replaceText}${xml.slice(index + searchText.length)}`;
}
