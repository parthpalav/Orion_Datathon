import { describe, expect, it } from 'vitest';
import { dedupe, isRelevant, parseFeed } from './news';
import { categorise } from '../routes/news';

const feed = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${items}</channel></rss>`;
const item = (title: string, source: string, date: string) =>
  `<item><title>${title} - ${source}</title><link>https://news.google.com/rss/articles/${encodeURIComponent(title)}</link><pubDate>${date}</pubDate><source url="https://example.com">${source}</source></item>`;

describe('news', () => {
  it('parses items and strips the source suffix from titles', () => {
    const out = parseFeed(feed(item('WEH jammed after crash near Goregaon', 'Mid-Day', 'Tue, 24 Nov 2026 08:00:00 GMT')));
    expect(out).toEqual([{
      headline: 'WEH jammed after crash near Goregaon',
      source: 'Mid-Day',
      url: 'https://news.google.com/rss/articles/WEH%20jammed%20after%20crash%20near%20Goregaon',
      publishedAt: '2026-11-24T08:00:00.000Z',
    }]);
  });

  it('handles a feed with a single item and one with none', () => {
    expect(parseFeed(feed(item('One story', 'HT', 'Tue, 24 Nov 2026 08:00:00 GMT')))).toHaveLength(1);
    expect(parseFeed(feed(''))).toEqual([]);
  });

  it('dedupes the same story across queries and sorts newest first', () => {
    const a = { headline: 'Metro line 3 opens', source: 'HT', url: 'a', publishedAt: '2026-11-24T08:00:00.000Z' };
    const b = { headline: 'Metro Line 3 opens!', source: 'TOI', url: 'b', publishedAt: '2026-11-24T07:00:00.000Z' };
    const c = { headline: 'Sea Link closed tonight', source: 'TOI', url: 'c', publishedAt: '2026-11-24T09:00:00.000Z' };
    expect(dedupe([b, a, c]).map((h) => h.url)).toEqual(['c', 'a']);
  });

  it('keeps Mumbai mobility stories and drops the rest', () => {
    const h = (headline: string) => ({ headline, source: 's', url: 'u', publishedAt: '2026-11-24T08:00:00.000Z' });
    expect(isRelevant(h('Bandra-Dharavi bridge to become 10 lanes'))).toBe(true);
    expect(isRelevant(h('Anupam Kher questions Mumbai airport after flight diverted'))).toBe(false);
    expect(isRelevant(h('Ahmedabad civic body to upgrade 800 bus stops'))).toBe(false);
  });

  it('categorises headlines by keyword, most specific first', () => {
    expect(categorise('Scooter rider dies after falling under BEST bus on SCLR')).toBe('Accident');
    expect(categorise('Waterlogging slows traffic at Andheri subway')).toBe('Weather');
    expect(categorise('Mumbai Metro Line 2B block cleared')).toBe('Transit');
    expect(categorise('Bandra-Dharavi bridge to become 10 lanes')).toBe('Construction');
    expect(categorise('Traffic diversion at Dadar for rally')).toBe('Traffic');
  });
});
