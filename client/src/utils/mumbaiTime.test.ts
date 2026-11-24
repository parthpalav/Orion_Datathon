import { expect, it } from 'vitest';
import { mumbaiDate, mumbaiTime } from './mumbaiTime';

it('uses the Mumbai calendar day at midnight and sends the matching UTC instant', () => {
    const instant = new Date('2026-11-24T18:35:00Z');
    expect(mumbaiTime(instant)).toEqual({ date: '2026-11-25', time: '00:05', hour: 0 });
    expect(mumbaiDate('2026-11-25', '00:05')).toEqual(instant);
});
