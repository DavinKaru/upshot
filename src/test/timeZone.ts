declare global {
  /** Sets Node's real time zone. Provided by `jest.environment.js`. */
  var __setTimeZone: ((tz: string | undefined) => void) | undefined;
  /** Reads Node's real time zone. Provided by `jest.environment.js`. */
  var __getTimeZone: (() => string | undefined) | undefined;
}

/**
 * Runs the tests in the surrounding `describe` with the process in time zone `tz`, so cases
 * like Australian daylight saving changes are tested whatever the machine's own time zone is.
 * Build dates inside the tests, not at the top of the `describe`, which runs before the switch.
 * Only `Date` follows the switch: `Intl` formatters made earlier, like those in `dates.ts`, keep
 * the zone they were made in, so don't test formatting inside a switched block.
 *
 * Setting `process.env.TZ` in a test doesn't work, because Jest gives each test file a copy of
 * the environment variables; this goes through `jest.environment.js` instead.
 */
export function useTimeZone(tz: string): void {
  let previous: string | undefined;
  beforeAll(() => {
    if (!globalThis.__setTimeZone || !globalThis.__getTimeZone) {
      throw new Error('useTimeZone needs the test environment in jest.environment.js');
    }
    previous = globalThis.__getTimeZone();
    globalThis.__setTimeZone(tz);
    // Check the switch took, so these tests can never pass in the wrong time zone unnoticed.
    if (Intl.DateTimeFormat().resolvedOptions().timeZone !== tz) {
      throw new Error(`Couldn't switch the time zone to ${tz}`);
    }
  });
  afterAll(() => {
    globalThis.__setTimeZone?.(previous);
  });
}

/** Sydney's 2026 changes: clocks go back an hour on 5 April and forward an hour on 4 October. */
export const SYDNEY = 'Australia/Sydney';
