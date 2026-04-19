import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [k: string]: JsonValue };

function flatten(obj: JsonValue, prefix = '', out = new Set<string>(), file = ''): Set<string> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (typeof obj !== 'string') {
      throw new Error(`${file}: key '${prefix}' must be a string, got ${typeof obj}`);
    }
    out.add(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    flatten(v as JsonValue, prefix ? `${prefix}.${k}` : k, out, file);
  }
  return out;
}

function load(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

const en = load(resolve(process.cwd(), 'messages/en.json'));
const es = load(resolve(process.cwd(), 'messages/es.json'));
const enKeys = flatten(en, '', new Set(), 'messages/en.json');
const esKeys = flatten(es, '', new Set(), 'messages/es.json');

const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();
const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();

if (missingInEs.length || missingInEn.length) {
  if (missingInEs.length) {
    console.error(`\nMissing in messages/es.json (${missingInEs.length}):`);
    for (const k of missingInEs) console.error(`  - ${k}`);
  }
  if (missingInEn.length) {
    console.error(`\nMissing in messages/en.json (${missingInEn.length}):`);
    for (const k of missingInEn) console.error(`  - ${k}`);
  }
  process.exit(1);
}

console.log(`\u2713 i18n parity OK \u2014 ${enKeys.size} keys in en and es`);
