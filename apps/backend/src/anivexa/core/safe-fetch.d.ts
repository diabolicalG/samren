export function createPinnedLookup(addresses: Array<{ address: string; family: number }>): (
  hostname: string,
  options: { all?: boolean } | undefined,
  callback: (...args: any[]) => void
) => void;

export function safeFetch(
  input: string | URL | Request,
  init?: RequestInit,
  allowed?: string[]
): Promise<Response>;
