export function redirect(url: string): never {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
  throw err;
}

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND');
}

export const permanentRedirect = redirect;
