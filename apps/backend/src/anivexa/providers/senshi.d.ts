declare const provider: { fetch(request: Request): Promise<Response> };
export function getEpisodes(anilistId: number, context?: Record<string, unknown>): Promise<Record<string, unknown>>;
export default provider;
