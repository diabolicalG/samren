import type { IncomingMessage, IncomingHttpHeaders } from "node:http";
import type { LookupFunction } from "node:net";

export function createPinnedLookup(addresses: Array<{ address: string; family: number }>): LookupFunction;
export function isPublicAddress(address: string): boolean;
export function validatePublicAddresses(addresses: Array<{ address: string; family: number }>): Array<{ address: string; family: number }>;
export function safeFetch(input: string | URL | Request, init?: RequestInit, allowed?: string[], maxBytes?: number): Promise<Response>;
export function safeFetchStream(
  input: string | URL | Request,
  init?: RequestInit,
  allowed?: string[],
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<{ status: number; headers: IncomingHttpHeaders; body: IncomingMessage; maxBytes: number }>;
