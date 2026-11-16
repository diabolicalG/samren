import { safeFetch } from "../core/safe-fetch.js";
import { canExtractByse, extractByse } from "./byse.js";
import { canExtractDataSv, extractDataSv } from "./datasv.js";
import { canExtractNova, extractNova } from "./nova.js";
import { canExtractVidplay, extractVidplay } from "./vidplay.js";
import { canExtractVidmoly, extractVidmoly } from "./vidmoly.js";

export { canExtractByse, extractByse } from "./byse.js";
export { canExtractDataSv, extractDataSv } from "./datasv.js";
export { canExtractNova, extractNova } from "./nova.js";
export { canExtractVidplay, extractVidplay } from "./vidplay.js";
export { canExtractVidmoly, extractVidmoly } from "./vidmoly.js";
export { extractFlixcloud } from "./flixcloud.js";

// The upstream MegaPlay extractor executes provider JavaScript in a VM to
// derive a runtime HMAC key. It is deliberately not registered here. The
// static MegaPlay route parser remains available in anikoto-embed.ts.

const videoExtractors = [
  { name: "byse", matches: canExtractByse, extract: extractByse },
  { name: "datasv", matches: canExtractDataSv, extract: extractDataSv },
  { name: "vidplay", matches: canExtractVidplay, extract: extractVidplay },
  { name: "vidmoly", matches: canExtractVidmoly, extract: extractVidmoly },
  { name: "nova", matches: canExtractNova, extract: extractNova },
];

const extractorHosts = {
  byse: ["bysesayeveum.com", "gn1r5n.org"],
  datasv: ["play.echovideo.ru"],
  vidplay: ["play.echovideo.ru"],
  vidmoly: ["vidmoly.net", "vidmoly.biz", "vidmoly.to"],
  nova: ["nova.upn.one"],
};

export function findVideoExtractor(url) {
  const extractor = videoExtractors.find((item) => item.matches(url));
  if (!extractor) return null;
  const allowedHosts = extractorHosts[extractor.name];
  if (!allowedHosts) return null;
  return {
    ...extractor,
    extract: (embedUrl, options = {}) => extractor.extract(embedUrl, {
      ...options,
      fetchImpl: (input, init = {}) => safeFetch(input, init, allowedHosts),
    }),
  };
}
