import { SYDNEY, useTimeZone } from '@/test/timeZone';

import { addDays, dayKey, inRange, monthRange, monthToDate, startOfDay, timeOfDay } from '../dates';

const HOUR = 60 * 60 * 1000;

describe('date ranges', () => {
  it('includes the start of a range and leaves out its end', () => {
    const range = { start: new Date(2026, 10, 1), end: new Date(2026, 10, 2) };
    expect(inRange(new Date(2026, 10, 1), range)).toBe(true);
    expect(inRange(new Date(2026, 10, 1, 23, 59, 59, 999), range)).toBe(true);
    expect(inRange(new Date(2026, 10, 2), range)).toBe(false);
    expect(inRange(new Date(2026, 9, 31, 23, 59, 59, 999), range)).toBe(false);
  });

  it('covers the month so far, up to and including now', () => {
    const now = new Date(2027, 0, 1, 9, 30);
    const range = monthToDate(now);
    expect(range.start).toEqual(new Date(2027, 0, 1));
    expect(inRange(now, range)).toBe(true);
    expect(inRange(new Date(now.getTime() + 1), range)).toBe(false);
    expect(inRange(new Date(2026, 11, 31, 23, 59, 59, 999), range)).toBe(false);
  });

  it('covers whole months, including February in a leap year and December into January', () => {
    expect(monthRange(new Date(2028, 1, 29, 15))).toEqual({
      start: new Date(2028, 1, 1),
      end: new Date(2028, 2, 1),
    });
    expect(monthRange(new Date(2026, 11, 31, 23, 59))).toEqual({
      start: new Date(2026, 11, 1),
      end: new Date(2027, 0, 1),
    });
  });

  it('steps across month and year ends by calendar day', () => {
    expect(dayKey(addDays(new Date(2028, 1, 28, 22), 1))).toBe('2028-02-29');
    expect(dayKey(addDays(new Date(2028, 1, 29, 1), 1))).toBe('2028-03-01');
    expect(dayKey(addDays(new Date(2027, 0, 1, 0, 0), -1))).toBe('2026-12-31');
    expect(startOfDay(new Date(2026, 10, 20, 18, 30))).toEqual(new Date(2026, 10, 20));
  });

  it('reads the time of day from the clock', () => {
    expect(timeOfDay(new Date(2026, 10, 20))).toBe(0);
    expect(timeOfDay(new Date(2026, 10, 20, 15, 30, 10, 5))).toBe(
      15 * HOUR + 30 * 60_000 + 10_000 + 5,
    );
  });
});

describe('date ranges across Australian daylight saving changes', () => {
  useTimeZone(SYDNEY);

  it('has a 25-hour day when clocks go back and a 23-hour day when they go forward', () => {
    const back = new Date(2026, 3, 5);
    expect(addDays(back, 1).getTime() - back.getTime()).toBe(25 * HOUR);
    const forward = new Date(2026, 9, 4);
    expect(addDays(forward, 1).getTime() - forward.getTime()).toBe(23 * HOUR);
  });

  it('lands on local midnight either side of a change', () => {
    const afterForward = addDays(new Date(2026, 9, 4, 12), 1);
    expect(afterForward.getHours()).toBe(0);
    expect(dayKey(afterForward)).toBe('2026-10-05');
    const afterBack = addDays(new Date(2026, 3, 5, 23, 30), 1);
    expect(afterBack.getHours()).toBe(0);
    expect(dayKey(afterBack)).toBe('2026-04-06');
  });

  it('gives the clock time, not the time since midnight, on a changeover day', () => {
    // 3:30 am on 4 October is only 2.5 hours after midnight, because 2 am became 3 am.
    const at = new Date(2026, 9, 4, 3, 30);
    expect(at.getTime() - startOfDay(at).getTime()).toBe(2.5 * HOUR);
    expect(timeOfDay(at)).toBe(3.5 * HOUR);
  });
});
