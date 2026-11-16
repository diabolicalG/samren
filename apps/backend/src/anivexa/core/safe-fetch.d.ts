import type { LookupFunction } from "node:net";

export function createPinnedLookup(addresses: Array<{ address: string; family: number }>): LookupFunction;
export function isPublicAddress(address: string): boolean;
export function validatePublicAddresses(addresses: Array<{ address: string; family: number }>): Array<{ address: string; family: number }>;
export function safeFetch(input: string | URL | Request, init?: RequestInit, allowed?: string[]): Promise<Response>;
