const ReactNativeEnvironment = require('jest-expo/src/preset/nativeEnvironment');

/**
 * jest-expo's environment, plus a way for tests to change the time zone.
 *
 * Each test file gets a copy of `process.env`, so setting `TZ` in a test never reaches Node and
 * dates stay in the machine's time zone. This environment runs outside that sandbox, so it hands
 * tests a function that sets the real `TZ`, which Node applies to dates straight away. See
 * `src/test/timeZone.ts`.
 */
class UpshotEnvironment extends ReactNativeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.originalTimeZone = process.env.TZ;
    this.global.__setTimeZone = (tz) => {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    };
    this.global.__getTimeZone = () => process.env.TZ;
  }

  async teardown() {
    // Put the time zone back even if a test file failed before restoring it.
    this.global.__setTimeZone(this.originalTimeZone);
    await super.teardown();
  }
}

module.exports = UpshotEnvironment;
module.exports.TestEnvironment = UpshotEnvironment;
