import { memSetC000 } from "../memory"

// Passive NES/SNES game-port wiring used by a2nespad:
//   AN0 ($C058/$C059) = LATCH
//   AN1 ($C05A/$C05B) = CLOCK
//   PB2 ($C063 bit 7) = controller 1 DATA
//   PB3 ($C060 bit 7) = controller 2 DATA
//
// DATA is active low. SNES controllers shift B, Y, Select, Start, Up, Down,
// Left, Right, A, X, L, R, followed by four high signature bits.

let enabled = false
let livePad1 = 0xffff
let livePad2 = 0xffff
let livePad1Connected = false
let livePad2Connected = false
let latchedPad1 = 0xffff
let latchedPad2 = 0xffff
let latchedPad1Connected = false
let latchedPad2Connected = false
let bitIndex = 0
let previousLatch = false
let previousClock = true

const SNES_TO_GAMEPAD_BUTTON = [
  0,  // B
  2,  // Y
  8,  // Select
  9,  // Start
  12, // Up
  13, // Down
  14, // Left
  15, // Right
  1,  // A
  3,  // X
  4,  // L
  5,  // R
] as const

const gamepadToSnesBits = (gamepad?: EmuGamepad): number => {
  let bits = 0xffff
  if (!gamepad) return bits
  SNES_TO_GAMEPAD_BUTTON.forEach((button, snesBit) => {
    if (gamepad.buttons[button]) bits &= ~(1 << snesBit)
  })
  return bits
}

export const getSnesJoyport = () => enabled

export const setSnesJoyport = (mode: boolean) => {
  enabled = mode
  if (!mode) resetSnesJoyport()
}

export const setSnesJoyportGamepads = (gamepads: EmuGamepad[] | null) => {
  livePad1 = gamepadToSnesBits(gamepads?.[0])
  livePad2 = gamepadToSnesBits(gamepads?.[1])
  livePad1Connected = Boolean(gamepads?.[0])
  livePad2Connected = Boolean(gamepads?.[1])
}

export const resetSnesJoyport = () => {
  latchedPad1 = 0xffff
  latchedPad2 = 0xffff
  latchedPad1Connected = false
  latchedPad2Connected = false
  bitIndex = 0
  previousLatch = false
  previousClock = true
}

export const handleSnesJoyportAnnunciators = (latch: boolean, clock: boolean) => {
  if (!enabled) return

  // The 4021 parallel-load input follows LATCH. Snapshot on its rising edge.
  if (!previousLatch && latch) {
    latchedPad1 = livePad1
    latchedPad2 = livePad2
    latchedPad1Connected = livePad1Connected
    latchedPad2Connected = livePad2Connected
    bitIndex = 0
  }

  // Software samples while CLOCK is low. The controller shifts on rising edges.
  if (!previousClock && clock && !latch) {
    bitIndex++
  }

  previousLatch = latch
  previousClock = clock
}

const currentDataHigh = (bits: number, connected: boolean) => {
  // An empty port floats high. A connected official SNES controller shifts
  // its grounded serial input after the 16 parallel bits, producing a low tail.
  if (!connected) return true
  if (bitIndex >= 16) return false
  return (bits & (1 << bitIndex)) !== 0
}

export const checkSnesJoyportValue = (addr: number) => {
  const pad1 = addr === 0xc063
  const bits = pad1 ? latchedPad1 : latchedPad2
  const connected = pad1 ? latchedPad1Connected : latchedPad2Connected
  memSetC000(addr, currentDataHigh(bits, connected) ? 0x80 : 0)
}
