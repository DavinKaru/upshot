/* global jest */
// Mocks for native libraries, so screens can render in Jest without a device.

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

// Just enough of Reanimated for screens to render: values update instantly, no animation.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const transition = { duration: () => transition, delay: () => transition };
  const identity = (x) => x;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: identity },
    // Used by react-native-gesture-handler when it sees Reanimated installed.
    useEvent: () => () => {},
    useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
    useComposedEventHandler: () => () => {},
    isSharedValue: () => false,
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (compute) => compute(),
    useDerivedValue: (compute) => ({ value: compute() }),
    useReducedMotion: () => true,
    withTiming: (value) => value,
    withDelay: (_delay, value) => value,
    Easing: { out: identity, in: identity, inOut: identity, cubic: identity, quad: identity },
    FadeIn: transition,
    FadeOut: transition,
    SlideInLeft: transition,
    SlideInRight: transition,
    SlideOutLeft: transition,
    SlideOutRight: transition,
    LayoutAnimationConfig: ({ children }) => children,
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// No motion sensor in tests, so charts stay level.
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(() => Promise.resolve(false)),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Skia draws natively, so in tests its components render nothing and paths are stand-ins.
jest.mock('@shopify/react-native-skia', () => {
  const Nothing = () => null;
  const path = { toSVGString: () => '' };
  const builder = {
    addArc: () => builder,
    addCircle: () => builder,
    detach: () => path,
    build: () => path,
  };
  return {
    Canvas: Nothing,
    usePathValue: () => ({ value: path }),
    Path: Nothing,
    Group: Nothing,
    Line: Nothing,
    Circle: Nothing,
    DashPathEffect: Nothing,
    LinearGradient: Nothing,
    vec: (x = 0, y = 0) => ({ x, y }),
    rect: (x, y, width, height) => ({ x, y, width, height }),
    Skia: {
      Path: { MakeFromSVGString: () => path, Make: () => path },
      PathBuilder: { Make: () => builder },
      XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
    },
  };
});
