import { XMLParser } from 'fast-xml-parser';

// Google News RSS: no key. Its terms allow personal, non-commercial feed-reader use (see PLAN.md Decisions).
const QUERIES = ['Mumbai traffic', 'Mumbai road closure', 'Mumbai accident road', 'Mumbai metro', 'Mumbai rain waterlogging'];
const MAX_ITEMS = 30;

export interface Headline {
  headline: string;
  source: string;
  url: string;
  publishedAt: string; // ISO
}

const parser = new XMLParser({ ignoreAttributes: false });

const feedUrl = (query: string) =>
  `https://news.google.com/rss/search?${new URLSearchParams({ q: `${query} when:2d`, hl: 'en-IN', gl: 'IN', ceid: 'IN:en' })}`;

/** Parses one Google News RSS document. Titles end in " - Source", which is stripped. */
export function parseFeed(xml: string): Headline[] {
  const items = parser.parse(xml)?.rss?.channel?.item ?? [];
  return (Array.isArray(items) ? items : [items]).flatMap((item) => {
    const source = typeof item.source === 'object' ? item.source['#text'] : item.source;
    const title = String(item.title ?? '');
    const headline = source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)) : title;
    const published = new Date(item.pubDate);
    if (!headline || !item.link || Number.isNaN(published.getTime())) return [];
    return [{ headline, source: source ?? 'Unknown', url: String(item.link), publishedAt: published.toISOString() }];
  });
}

// Keep only Mumbai-region mobility stories; the search queries also return celebrity and other-city items.
const PLACE = /mumbai|thane|navi mumbai|bmc|mmrda|bandra|andheri|worli|dadar|kurla|ghatkopar|borivali|powai|chembur|sion|vashi|panvel|colaba|goregaon|malad|juhu|mulund|bhiwandi|kalyan|dombivli/i;
const MOBILITY = /traffic|road|metro|bridge|flyover|highway|expressway|accident|crash|collision|closure|closed|diversion|jam|congestion|signal|local train|railway|suburban|bus|\bbest\b|waterlog|flood|rain|toll|coastal|sea link|lane|pothole|commut|parking|auto|taxi|cab/i;

export const isRelevant = (h: Headline) => PLACE.test(h.headline) && MOBILITY.test(h.headline);

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Newest first, with repeated headlines (same story from several queries) removed. */
export function dedupe(headlines: Headline[]): Headline[] {
  const seen = new Set<string>();
  return [...headlines]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((h) => {
      const key = normalise(h.headline);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);
}

export async function fetchHeadlines(): Promise<Headline[]> {
  const feeds = await Promise.allSettled(
    QUERIES.map(async (q) => {
      const res = await fetch(feedUrl(q), { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Google News ${res.status}`);
      return parseFeed(await res.text());
    }),
  );
  const ok = feeds.flatMap((f) => (f.status === 'fulfilled' ? f.value : []));
  if (ok.length === 0 && feeds.every((f) => f.status === 'rejected')) throw new Error('All news feeds failed');
  return dedupe(ok.filter(isRelevant));
}
