const loresHex: string[] = [
  "#000000", //black
  "#DD0033", //red
  "#000099", //dk blue
  "#DD22DD", //purple
  "#007722", //dk green
  "#555555", //gray
  "#2222FF", //med blue
  "#66AAFF", //lt blue
  "#885500", //brown
  "#FF6600", //orange
  "#AAAAAA", //grey
  "#FF9988", //pink
  "#11DD00", //lt green
  "#FFFF00", //yellow
  "#4AFDC5", //aqua
  "#FFFFFF"] //white

export const loresColors: number[][] = loresHex.map(hex => {
  const red = parseInt(hex.substring(1, 3), 16);
  const green = parseInt(hex.substring(3, 5), 16);
  const blue = parseInt(hex.substring(5, 7), 16);
  return [red, green, blue];
});

export const translateDHGR = [0, 1, 8, 9, 4, 5, 12, 13, 2, 3, 10, 11, 6, 7, 14, 15]

export const loresGreen: number[][] = loresColors.map(c => {
  return [0, (c[0] + c[1] + c[2]) / 3, 0]
})

export const loresAmber: number[][] = loresColors.map(c => {
  const c1 = (c[0] + c[1] + c[2]) / 3
  return [c1, c1 * (0xA5 / 255), 0]
})

export const loresWhite: number[][] = loresColors.map(c => {
  const c1 = (c[0] + c[1] + c[2]) / 3
  return [c1, c1 * (0xF0 / 255), 0]
})

export const TEXT_GREEN = '#39FF14'
export const TEXT_AMBER = '#FFA500'
export const TEXT_WHITE = '#F0F0F0'
const green = [0x39, 0xFF, 0x14]
const amber = [0xFF, 0xA5, 0x0]
const white = [0xF0, 0xF0, 0xF0]

export const hgrGreenScreen = [
  [0, 0, 0], green, green, green, [0, 0, 0], green, green, green
]

export const hgrAmberScreen = [
  [0, 0, 0], amber, amber, amber, [0, 0, 0], amber, amber, amber
]

export const hgrWhiteScreen = [
  [0, 0, 0], white, white, white, [0, 0, 0], white, white, white
]

export const hgrRGBcolors = [
  [0, 0, 0],       // black1
  [1, 255, 1],     // green
  [255, 1, 255],   // violet
  [255, 255, 255], // white1
  [0, 0, 0],       // black2
  [255, 150, 1],   // orange
  [1, 150, 255],   // blue
  [255, 255, 255], // white2
  [254, 251, 82],  // yellow (extended green)
  [183, 184, 249], // light blue (extended violet)
  [255, 255, 255],
  [0, 0, 0],
  [148, 106, 33],  // brown (extended orange)
  [9, 29, 162],    // dark blue (extended blue)
]
