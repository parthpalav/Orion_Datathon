import { NextFunction, Request, Response, Router } from 'express';
import { fetchHeadlines, type Headline } from '../services/news';

const router = Router();

export type Category = 'Traffic' | 'Accident' | 'Construction' | 'Transit' | 'Weather' | 'Other';

export interface NewsArticle {
  headline: string;
  summary: string; // empty until Gemini summaries land (P5.2)
  source: string;
  category: Category;
  timestamp: string; // ISO publish time
  url: string;
}

// First match wins, so the most specific categories come first.
const RULES: [Category, RegExp][] = [
  ['Accident', /accident|crash|collision|killed|dies|died|injured|hit by|overturn/i],
  ['Weather', /rain|waterlog|flood|monsoon|fog|storm|\bimd\b/i],
  ['Transit', /metro|local train|railway|suburban|\bbest\b|\bbus\b|monorail|station/i],
  ['Construction', /construction|bridge|flyover|repair|closure|closed|tender|lanes|widening|tunnel|project|pothole/i],
  ['Traffic', /traffic|jam|congestion|diversion|signal|toll|road/i],
];

export const categorise = (headline: string): Category => RULES.find(([, rx]) => rx.test(headline))?.[0] ?? 'Other';

const toArticle = (h: Headline): NewsArticle => ({
  headline: h.headline,
  summary: '',
  source: h.source,
  category: categorise(h.headline),
  timestamp: h.publishedAt,
  url: h.url,
});

const CACHE_MS = 30 * 60 * 1000;
// shortcut: in-memory cache, fine for one Render instance; move to Mongo if the API ever runs on several.
let cache: { articles: NewsArticle[]; fetchedAt: number } | null = null;

// GET /api/news: latest Mumbai traffic headlines from Google News, cached for 30 minutes.
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) {
    return res.json({ success: true, articles: cache.articles, lastUpdated: new Date(cache.fetchedAt).toISOString() });
  }
  try {
    cache = { articles: (await fetchHeadlines()).map(toArticle), fetchedAt: Date.now() };
    res.json({ success: true, articles: cache.articles, lastUpdated: new Date(cache.fetchedAt).toISOString() });
  } catch (error) {
    if (cache) {
      // Serve the last good copy rather than nothing; lastUpdated tells the client how old it is.
      console.error('News refresh failed, serving cached copy:', (error as Error).message);
      return res.json({ success: true, articles: cache.articles, lastUpdated: new Date(cache.fetchedAt).toISOString() });
    }
    next(Object.assign(new Error('News is unavailable right now'), { status: 502 }));
  }
});

export default router;
