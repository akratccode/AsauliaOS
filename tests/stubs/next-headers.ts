type Store = {
  get: (name: string) => { name: string; value: string } | undefined;
  getAll: () => { name: string; value: string }[];
  set: (...args: unknown[]) => void;
  has: (name: string) => boolean;
};

const empty: Store = {
  get: () => undefined,
  getAll: () => [],
  set: () => undefined,
  has: () => false,
};

export async function cookies() {
  return empty;
}

export async function headers() {
  return new Headers();
}
