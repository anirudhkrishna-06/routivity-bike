import { getOrSetCache } from "@/lib/cache";

/** Kept for compatibility with existing imports. */
export const DISCOVER_CATEGORIES = ["tourism.sights", "tourism.attraction"] as const;

export type DiscoverPlace = {
  id: string;
  name: string;
  category: string;
  description?: string;
  address?: string;
  locality?: string;
  distanceMeters?: number;
  rating?: number;
  lat?: number;
  lon?: number;
  /** Optional additions. Existing callers can ignore them. */
  reason?: string;
  website?: string;
  score?: number;
};

type Point = { lat: number; lon: number };
type Raw = Record<string, unknown>;
export type GeoFeature = { properties?: Raw };

type Signals = {
  cats: string[];
  wikidata: boolean;
  wikipedia: boolean;
  unesco: boolean;
  heritage: boolean;
  image: boolean;
  hours: boolean;
  englishName: boolean;
};
type Candidate = { place: DiscoverPlace; signals: Signals; group: Group };
type Group = "worship" | "history" | "museum" | "nature" | "other";

const PAGE_SIZE = 5;
const MAX_RANKED = 30;
const MAX_RADIUS = 25000;
/** Core "must-see" categories, and the noisier attraction category fetched separately so it cannot crowd out sights. */
const CORE_CATEGORIES = ["tourism.sights", "heritage", "entertainment.museum", "national_park"];
const EXTRA_CATEGORIES = ["tourism.attraction"];
const CORE_LIMIT = 50;
const EXTRA_LIMIT = 20;

const inFlight = new Map<string, Promise<DiscoverPlace[]>>();
const stale = new Map<string, { at: number; value: DiscoverPlace[] }>();

class CategoryError extends Error {}

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function keyFor(location: string, point: Point, radius: number, language: string) {
  return `discover:v2:${normalise(location)}:${point.lat.toFixed(3)}:${point.lon.toFixed(3)}:${radius}:${language}`;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function haversineMeters(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function nameKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function geocode(location: string, apiKey: string): Promise<Point> {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", location);
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error("Unable to locate this destination");
  const body = (await response.json()) as { features?: { properties?: Point }[] };
  const point = body.features?.[0]?.properties;
  if (!point || typeof point.lat !== "number" || typeof point.lon !== "number") throw new Error("Unable to locate this destination");
  return point;
}

async function requestFeatures(point: Point, radius: number, language: string, apiKey: string, categories: string[], limit: number): Promise<GeoFeature[]> {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", categories.join(","));
  url.searchParams.set("filter", `circle:${point.lon},${point.lat},${radius}`);
  url.searchParams.set("bias", `proximity:${point.lon},${point.lat}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", language);
  url.searchParams.set("apiKey", apiKey);
  const response = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(7000) });
  if (response.status === 400) throw new CategoryError("Unsupported category");
  if (!response.ok) throw new Error("Discover is temporarily unavailable");
  const body = (await response.json()) as { features?: GeoFeature[] };
  return body.features || [];
}

/** Falls back to the original two categories if Geoapify rejects any newer category name. */
async function requestCoreFeatures(point: Point, radius: number, language: string, apiKey: string) {
  try {
    return await requestFeatures(point, radius, language, apiKey, CORE_CATEGORIES, CORE_LIMIT);
  } catch (error) {
    if (!(error instanceof CategoryError)) throw error;
    return requestFeatures(point, radius, language, apiKey, ["tourism.sights"], CORE_LIMIT);
  }
}

function groupOf(cats: string[]): Group {
  const has = (s: string) => cats.some((c) => c.includes(s));
  if (has("place_of_worship") || has("religion") || has("temple")) return "worship";
  if (has("museum")) return "museum";
  if (has("heritage") || has("castle") || has("fort") || has("palace") || has("archaeological") || has("ruins") || has("ruines") || has("monument") || has("historic")) return "history";
  if (has("national_park") || has("natural") || has("beach") || has("viewpoint") || has("peak")) return "nature";
  return "other";
}

function categoryLabel(cats: string[]) {
  const wanted = cats.filter((c) => /^(tourism|heritage|entertainment\.museum|national_park)/.test(c));
  const best = [...(wanted.length ? wanted : cats)].sort((a, b) => b.split(".").length - a.split(".").length)[0];
  if (!best) return "Sight";
  const label = best.replace(/^tourism\./, "").replace(/^entertainment\./, "").replaceAll("_", " ").replaceAll(".", " · ");
  return label || "Sight";
}

function toCandidate(feature: GeoFeature): Candidate | null {
  const p = feature.properties || {};
  const name = str(p.name);
  if (!name || !/\p{L}/u.test(name)) return null;
  const raw = ((p.datasource as { raw?: Raw } | undefined)?.raw || {}) as Raw;
  const media = (p.wiki_and_media || {}) as Raw;
  const cats = (Array.isArray(p.categories) ? p.categories : []).filter((c): c is string => typeof c === "string");
  const id = str(p.place_id) || `${p.lat}:${p.lon}:${name}`;
  const website = str(p.website) || str(raw.website) || str(raw["contact:website"]);
  const signals: Signals = {
    cats,
    wikidata: Boolean(str(media.wikidata) || str(raw.wikidata)),
    wikipedia: Boolean(str(media.wikipedia) || str(raw.wikipedia)),
    unesco: cats.includes("heritage.unesco") || str(raw.heritage) === "1" || str(raw["heritage:operator"]) === "whc",
    heritage: cats.some((c) => c.startsWith("heritage")) || Boolean(str(raw.heritage)),
    image: Boolean(str(media.image) || str(media.wikimedia_commons) || str(raw.image) || str(raw.wikimedia_commons)),
    hours: Boolean(str(p.opening_hours) || str(raw.opening_hours)),
    englishName: Boolean(str(raw["name:en"]) || str(p.name_international && (p.name_international as Raw).en)),
  };
  const place: DiscoverPlace = {
    id,
    name,
    category: categoryLabel(cats),
    description: str(p.description) || str(raw.description),
    address: str(p.formatted) || str(p.address_line1),
    locality: str(p.city) || str(p.state),
    distanceMeters: num(p.distance),
    rating: num(p.rating),
    lat: num(p.lat),
    lon: num(p.lon),
    website: website && /^https?:\/\//i.test(website) ? website : undefined,
  };
  return { place, signals, group: groupOf(cats) };
}

function categoryWeight(cats: string[]) {
  const has = (s: string) => cats.some((c) => c.includes(s));
  let w = 0;
  if (has("tourism.attraction")) w = Math.max(w, 4);
  if (has("viewpoint")) w = Math.max(w, 6);
  if (has("tourism.sights")) w = Math.max(w, 9);
  if (has("museum")) w = Math.max(w, 9);
  if (has("national_park")) w = Math.max(w, 10);
  if (has("monument")) w = Math.max(w, 11);
  if (has("heritage") || has("castle") || has("fort") || has("palace") || has("archaeological") || has("ruins") || has("ruines")) w = Math.max(w, 14);
  if (has("artwork") || has("fountain")) w -= 6;
  if (has("playground") || has("clock") || has("memorial") || has("statue")) w -= 4;
  return w;
}

const GENERIC_WORDS = /\b(memorial|statue|bust|plaque|signboard|board|stone|cross|grave|cemetery|toilet|parking)\b/i;
const BARE_NAMES = /^(temple|church|mosque|masjid|shrine|park|garden|monument|fort|museum|viewpoint|view point)$/i;

/** Tourist-appeal score. Geoapify has few ratings, so notability and completeness signals stand in for popularity. */
export function scorePlace(place: DiscoverPlace, signals: Signals, radius: number) {
  const reasons: string[] = [];
  let s = categoryWeight(signals.cats);
  if (signals.unesco) { s += 30; reasons.push("UNESCO World Heritage Site"); }
  else if (signals.heritage) { s += 10; reasons.push("Heritage site"); }
  if (signals.wikidata) s += 22;
  if (signals.wikipedia) s += 12;
  if (signals.wikidata || signals.wikipedia) reasons.push("Well-known landmark");
  if (signals.image) s += 3;
  if (signals.hours) s += 2;
  if (place.website) s += 3;
  if (place.description) s += 3;
  if (signals.englishName) s += 2;
  if (place.rating) { s += place.rating * 3; reasons.push(`Rated ${place.rating.toFixed(1)}`); }
  if (place.distanceMeters !== undefined) s += 12 * (1 - clamp01(place.distanceMeters / radius)) ** 1.5;
  if (GENERIC_WORDS.test(place.name)) s -= 10;
  if (BARE_NAMES.test(place.name.trim())) s -= 14;
  if (groupOf(signals.cats) === "worship" && !signals.wikidata && !signals.wikipedia && !signals.heritage) s -= 3;
  if (!reasons.length && signals.cats.some((c) => c.includes("museum"))) reasons.push("Museum");
  return { score: Math.round(s * 10) / 10, reason: reasons.slice(0, 2).join(" · ") || undefined };
}

function isDuplicate(a: Candidate, b: Candidate) {
  const ka = nameKey(a.place.name);
  const kb = nameKey(b.place.name);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const near = a.place.lat !== undefined && a.place.lon !== undefined && b.place.lat !== undefined && b.place.lon !== undefined
    ? haversineMeters({ lat: a.place.lat, lon: a.place.lon }, { lat: b.place.lat, lon: b.place.lon }) < 300
    : false;
  return near && ka.length >= 5 && kb.length >= 5 && (ka.includes(kb) || kb.includes(ka));
}

/** Pure ranking pipeline: parse, score, de-duplicate, then diversify so the top results are not all one type. */
export function rankFeatures(features: GeoFeature[], radius: number): DiscoverPlace[] {
  const scored = features
    .map(toCandidate)
    .filter((c): c is Candidate => c !== null)
    .map((c) => {
      const { score, reason } = scorePlace(c.place, c.signals, radius);
      return { ...c, place: { ...c.place, score, reason } };
    })
    .sort((a, b) => (b.place.score ?? 0) - (a.place.score ?? 0));

  const unique: Candidate[] = [];
  for (const c of scored) if (!unique.some((u) => isDuplicate(u, c))) unique.push(c);

  const picked: Candidate[] = [];
  const counts: Record<Group, number> = { worship: 0, history: 0, museum: 0, nature: 0, other: 0 };
  const remaining = [...unique];
  while (remaining.length && picked.length < MAX_RANKED) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    remaining.forEach((c, i) => {
      const value = (c.place.score ?? 0) - 8 * counts[c.group];
      if (value > bestValue) { bestValue = value; bestIndex = i; }
    });
    const [chosen] = remaining.splice(bestIndex, 1);
    counts[chosen.group] += 1;
    picked.push(chosen);
  }
  return picked.map((c) => c.place);
}

async function fetchAndRank(point: Point, radius: number, language: string, apiKey: string) {
  const [core, extra] = await Promise.allSettled([
    requestCoreFeatures(point, radius, language, apiKey),
    requestFeatures(point, radius, language, apiKey, EXTRA_CATEGORIES, EXTRA_LIMIT),
  ]);
  if (core.status === "rejected" && extra.status === "rejected") throw core.reason;
  const features = [...(core.status === "fulfilled" ? core.value : []), ...(extra.status === "fulfilled" ? extra.value : [])];
  return rankFeatures(features, radius);
}

async function buildRanked(point: Point, radius: number, language: string, apiKey: string) {
  let ranked = await fetchAndRank(point, radius, language, apiKey);
  if (ranked.length < PAGE_SIZE && radius < MAX_RADIUS) {
    ranked = await fetchAndRank(point, Math.min(radius * 2, MAX_RADIUS), language, apiKey);
  }
  return ranked;
}

export async function findDiscoverPlaces(input: { location: string; radius?: number; language?: string; offset?: number }) {
  const apiKey = process.env.GEOAPIFY;
  if (!apiKey) throw new Error("Discover is not configured");
  const radius = Math.min(Math.max(input.radius || 12000, 1000), MAX_RADIUS);
  const language = input.language || "en";
  const offset = Math.max(0, Math.floor(input.offset || 0));
  const point = await geocode(input.location, apiKey);
  const key = keyFor(input.location, point, radius, language);
  const request = inFlight.get(key) || getOrSetCache(key, 1800, () => buildRanked(point, radius, language, apiKey));
  inFlight.set(key, request);
  try {
    const ranked = await request;
    stale.set(key, { at: Date.now(), value: ranked });
    const places = ranked.slice(offset, offset + PAGE_SIZE);
    return { location: input.location, point, places, offset, hasMore: offset + PAGE_SIZE < ranked.length, cached: false };
  } catch (error) {
    const cached = stale.get(key);
    if (cached) {
      const places = cached.value.slice(offset, offset + PAGE_SIZE);
      return { location: input.location, point, places, offset, hasMore: offset + PAGE_SIZE < cached.value.length, cached: true, stale: true };
    }
    throw error;
  } finally {
    inFlight.delete(key);
  }
}