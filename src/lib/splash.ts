// Launch screens for the home-screen app, one per device size (portrait pixels). iOS shows these while the app opens, so the
// reader sees the same night-to-dawn sky as the icon instead of a blank white screen.
export const SPLASH_SIZES: { w: number; h: number; dw: number; dh: number; r: number }[] = [
  { w: 1320, h: 2868, dw: 440, dh: 956, r: 3 }, // iPhone 16 Pro Max
  { w: 1206, h: 2622, dw: 402, dh: 874, r: 3 }, // iPhone 16 Pro
  { w: 1290, h: 2796, dw: 430, dh: 932, r: 3 }, // 14/15 Pro Max, 15/16 Plus
  { w: 1179, h: 2556, dw: 393, dh: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 1284, h: 2778, dw: 428, dh: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 1170, h: 2532, dw: 390, dh: 844, r: 3 }, // 12, 13, 14
  { w: 1125, h: 2436, dw: 375, dh: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 1242, h: 2688, dw: 414, dh: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 828, h: 1792, dw: 414, dh: 896, r: 2 }, // XR, 11
  { w: 1242, h: 2208, dw: 414, dh: 736, r: 3 }, // 6/7/8 Plus
  { w: 750, h: 1334, dw: 375, dh: 667, r: 2 }, // 6/7/8, SE 2/3
  { w: 640, h: 1136, dw: 320, dh: 568, r: 2 }, // SE 1
  { w: 2048, h: 2732, dw: 1024, dh: 1366, r: 2 }, // iPad Pro 12.9
  { w: 1668, h: 2388, dw: 834, dh: 1194, r: 2 }, // iPad Pro 11
  { w: 1640, h: 2360, dw: 820, dh: 1180, r: 2 }, // iPad Air, iPad 10
  { w: 1668, h: 2224, dw: 834, dh: 1112, r: 2 }, // iPad Pro 10.5, Air 3
  { w: 1620, h: 2160, dw: 810, dh: 1080, r: 2 }, // iPad 7-9
  { w: 1488, h: 2266, dw: 744, dh: 1133, r: 2 }, // iPad mini 6
];
