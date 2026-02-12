export async function loadPresetYaml(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load preset: ${res.status}`);
  }
  return await res.text();
}
