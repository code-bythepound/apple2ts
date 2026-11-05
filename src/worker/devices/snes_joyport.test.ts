import { memGet, memoryReset } from "../memory"
import { resetSoftSwitches } from "../softswitches"
import {
  resetSnesJoyport,
  setSnesJoyport,
  setSnesJoyportGamepads,
} from "./snes_joyport"

const gamepad = (...pressedButtons: number[]): EmuGamepad => {
  const buttons = Array<boolean>(16).fill(false)
  pressedButtons.forEach(button => { buttons[button] = true })
  return { axes: [0, 0, 0, 0], buttons }
}

const highBit = (address: number) => (memGet(address) & 0x80) !== 0

const latchControllers = () => {
  memGet(0xc05b) // CLOCK high
  memGet(0xc059) // LATCH high: capture buttons
  memGet(0xc058) // LATCH low
}

const readBitAndClock = (address: number) => {
  memGet(0xc05a) // CLOCK low
  const value = highBit(address)
  memGet(0xc05b) // CLOCK high: shift
  return value
}

describe("SNES game-port adapter", () => {
  beforeEach(() => {
    memoryReset()
    resetSoftSwitches()
    resetSnesJoyport()
    setSnesJoyport(true)
  })

  afterEach(() => setSnesJoyport(false))

  test("reads two controllers in SNES order over PB2 and PB3", () => {
    // Browser mappings: B=0, A=1, Y=2, X=3, L=4, R=5,
    // Select=8, Start=9, and D-pad=12..15.
    setSnesJoyportGamepads([
      gamepad(0, 8, 12, 15, 3),
      gamepad(1, 2, 9, 13, 14, 4, 5),
    ])
    latchControllers()

    const pad1: boolean[] = []
    const pad2: boolean[] = []
    for (let bit = 0; bit < 16; bit++) {
      memGet(0xc05a)
      pad1.push(highBit(0xc063))
      pad2.push(highBit(0xc060))
      memGet(0xc05b)
    }

    expect(pad1).toEqual([
      false, true, false, true, false, true, true, false,
      true, false, true, true, true, true, true, true,
    ])
    expect(pad2).toEqual([
      true, false, true, false, true, false, false, true,
      false, true, false, false, true, true, true, true,
    ])
  })

  test("reads do not shift and input changes wait for the next latch", () => {
    setSnesJoyportGamepads([gamepad(0)])
    latchControllers()
    memGet(0xc05a)

    expect(highBit(0xc063)).toBe(false)
    expect(highBit(0xc063)).toBe(false)
    setSnesJoyportGamepads([gamepad()])
    expect(highBit(0xc063)).toBe(false)

    latchControllers()
    memGet(0xc05a)
    expect(highBit(0xc063)).toBe(true)
  })

  test("returns the grounded serial tail after sixteen clocks", () => {
    setSnesJoyportGamepads([gamepad()])
    latchControllers()
    for (let bit = 0; bit < 16; bit++) {
      expect(readBitAndClock(0xc063)).toBe(true)
    }
    expect(readBitAndClock(0xc063)).toBe(false)
  })

  test("leaves an unconnected second-controller input floating high", () => {
    setSnesJoyportGamepads([gamepad()])
    latchControllers()
    for (let bit = 0; bit < 17; bit++) {
      memGet(0xc05a)
      expect(highBit(0xc060)).toBe(true)
      memGet(0xc05b)
    }
  })

})
