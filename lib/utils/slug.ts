export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function appendSlugSuffix(slug: string, suffix: number): string {
  const suffixStr = `-${suffix}`;
  const maxBase = 48 - suffixStr.length;
  return `${slug.slice(0, maxBase)}${suffixStr}`;
}
