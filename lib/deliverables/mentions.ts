// Extract @username mentions from a markdown comment body.
// Usernames are lowercase, digits, underscore, dot, dash; 2-32 chars.
// Mentions inside code fences or inline code are ignored.
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_.\-]{2,32})/g;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]*`/g;

export function extractMentions(markdown: string): string[] {
  const stripped = markdown.replace(CODE_FENCE_RE, '').replace(INLINE_CODE_RE, '');
  const seen = new Set<string>();
  for (const match of stripped.matchAll(MENTION_RE)) {
    const name = match[2];
    if (name) seen.add(name.toLowerCase());
  }
  return Array.from(seen);
}
