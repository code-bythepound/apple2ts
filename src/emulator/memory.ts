import { SWITCHES, checkSoftSwitches } from "./softswitches";
import { s6502 } from "./instructions"
import { romBase64 } from "./roms/rom_2e"
// import { edmBase64 } from "./roms/edm_2e"
import { Buffer } from "buffer";
import { handleGameSetup } from "./games/game_mappings";
import { isDebugging, inVBL } from "./motherboard";
import { RamWorksMemoryStart, RamWorksPage, ROMpage, ROMmemoryStart, hiresLineToAddress, toHex } from "./utility/utility";
import { isWatchpoint, setWatchpointBreak } from "./cpu6502";
import { noSlotClock } from "./nsc"

// 0x00000: main memory
// 0x10000...13FFF: ROM (including page $C0 soft switches)
// 0x14000...146FF: Peripheral card ROM $C100-$C7FF
// 0x14700...17EFF: Slots 1-7 (8*256 byte $C800-$CFFF range for each card)
// 0x17F00...: AUX/RamWorks memory (AUX is RamWorks bank 0)
// Bank1 of $D000-$DFFF is stored at 0x*D000-0x*DFFF (* 0 for main, 1 for aux)
// Bank2 of $D000-$DFFF is stored at 0x*C000-0x*CFFF (* 0 for main, 1 for aux)

const SLOTindex = 0x140
const SLOTC8index = 0x147
const SLOTstart = 256 * SLOTindex
const SLOTC8start = 256 * SLOTC8index

// Start out with only 64K of AUX memory.
// This is the maximum bank number. Each index represents 64K.
export let RamWorksMaxBank = 0
const BaseMachineMemory = RamWorksMemoryStart
export let memory = (new Uint8Array(BaseMachineMemory + (RamWorksMaxBank + 1) * 0x10000)).fill(0)

export const C800SlotGet = () => {
  return memGetC000(0xC02A)
}

const C800SlotSet = (slot: number) => {
  memSetC000(0xC02A, slot)
}

export const RamWorksBankGet = () => {
  return memGetC000(0xC073)
}

const RamWorksBankSet = (bank: number) => {
  memSetC000(0xC073, bank)
}

// Mappings from real Apple II address to memory array above.
// 256 pages of memory, from $00xx to $FFxx.
// Include one extra slot, to avoid needing memory checks for > 65535.
export const addressGetTable = (new Array<number>(257)).fill(0)
const addressSetTable = (new Array<number>(257)).fill(0)

export const doSetRamWorks = (size: number) => {
  // Clamp to 64K...16M and make sure it is a multiple of 64K
  size = Math.max(64, Math.min(8192, size))
  const oldMaxBank = RamWorksMaxBank
  // For 64K this will be zero
  RamWorksMaxBank = Math.floor(size / 64) - 1

  // Nothing to do?
  if (RamWorksMaxBank === oldMaxBank) return

  // If our current bank index is out of range, just reset it
  if (RamWorksBankGet() > RamWorksMaxBank) {
    RamWorksBankSet(0)
    updateAddressTables()
  }

  // Reallocate memory and copy the old memory
  const newMemSize = BaseMachineMemory + (RamWorksMaxBank + 1) * 0x10000
  if (RamWorksMaxBank < oldMaxBank) {
    // We are shrinking memory, just keep the first part
    memory = memory.slice(0, newMemSize)
  } else {
    // We are expanding memory, copy the old memory
    const memtemp = memory
    memory = (new Uint8Array(newMemSize)).fill(0xFF)
    memory.set(memtemp)
  }
}

const updateMainAuxMemoryTable = () => {
  const offsetAuxRead = SWITCHES.RAMRD.isSet ? (RamWorksPage + RamWorksBankGet() * 256) : 0
  const offsetAuxWrite = SWITCHES.RAMWRT.isSet ? (RamWorksPage + RamWorksBankGet() * 256) : 0
  const offsetPage2 = SWITCHES.PAGE2.isSet ? (RamWorksPage + RamWorksBankGet() * 256) : 0
  const offsetTextPageRead = SWITCHES.STORE80.isSet ? offsetPage2 : offsetAuxRead
  const offsetTextPageWrite = SWITCHES.STORE80.isSet ? offsetPage2 : offsetAuxWrite
  const offsetHgrPageRead = (SWITCHES.STORE80.isSet && SWITCHES.HIRES.isSet) ? offsetPage2 : offsetAuxRead
  const offsetHgrPageWrite = (SWITCHES.STORE80.isSet && SWITCHES.HIRES.isSet) ? offsetPage2 : offsetAuxWrite
  for (let i = 2; i < 256; i++) {
    addressGetTable[i] = i + offsetAuxRead;
    addressSetTable[i] = i + offsetAuxWrite;
  }
  for (let i = 4; i <= 7; i++) {
    addressGetTable[i] = i + offsetTextPageRead;
    addressSetTable[i] = i + offsetTextPageWrite;
  }
  for (let i = 0x20; i <= 0x3F; i++) {
    addressGetTable[i] = i + offsetHgrPageRead;
    addressSetTable[i] = i + offsetHgrPageWrite;
  }
}

const updateReadBankSwitchedRamTable = () => {
  // if (SWITCHES.ALTZP.isSet) {  // DEBUG
  //   console.log(`RamWorksPage: ${toHex(RamWorksPage)}, RamWorksBankGet(): ${RamWorksBankGet()}`)
  // }
  const offsetZP = SWITCHES.ALTZP.isSet ? (RamWorksPage + RamWorksBankGet() * 256) : 0
  addressGetTable[0] = offsetZP;
  addressGetTable[1] = 1 + offsetZP;
  addressSetTable[0] = offsetZP;
  addressSetTable[1] = 1 + offsetZP;
  if (SWITCHES.BSRREADRAM.isSet) {
    for (let i = 0xD0; i <= 0xFF; i++) {
      addressGetTable[i] = i + offsetZP;
    }
    if (!SWITCHES.BSRBANK2.isSet) {
      // Bank1 of $D000-$DFFF is actually in 0xC0...0xCF
      for (let i = 0xD0; i <= 0xDF; i++) {
        addressGetTable[i] = i - 0x10 + offsetZP;
      }
    }
  } else {
    // ROM ($D000...$FFFF)
    for (let i = 0xD0; i <= 0xFF; i++) {
      addressGetTable[i] = ROMpage + i - 0xC0;
    }
  }
}

const updateWriteBankSwitchedRamTable = () => {
  const offsetZP = SWITCHES.ALTZP.isSet ? (RamWorksPage + RamWorksBankGet() * 256) : 0
  const writeRAM = SWITCHES.WRITEBSR1.isSet || SWITCHES.WRITEBSR2.isSet ||
    SWITCHES.RDWRBSR1.isSet || SWITCHES.RDWRBSR2.isSet
  // Start out with Slot ROM and regular ROM as not writeable
  for (let i = 0xC0; i <= 0xFF; i++) {
    addressSetTable[i] = -1;
  }
  if (writeRAM) {
    for (let i = 0xD0; i <= 0xFF; i++) {
      addressSetTable[i] = i + offsetZP;
    }
    if (!SWITCHES.BSRBANK2.isSet) {
      // Bank1 of $D000-$DFFF is actually in 0xC0...0xCF
      for (let i = 0xD0; i <= 0xDF; i++) {
        addressSetTable[i] = i - 0x10 + offsetZP;
      }
    }
  }
}

const slotIsActive = (slot: number) => {
  if (SWITCHES.INTCXROM.isSet) return false
  // SLOTC3ROM switch only has an effect if INTCXROM is off
  return (slot !== 3) ? true : SWITCHES.SLOTC3ROM.isSet
}

// Below description modified from AppleWin source
//
// INTC8ROM: Unreadable soft switch (Sather, UTAIIe:5-28)
// . Set:   On access to $C3XX with SLOTC3ROM reset
//			- "From this point, $C800-$CFFF will stay assigned to motherboard ROM until
//			   an access is made to $CFFF or until the MMU detects a system reset."
// . Reset: On access to $CFFF or an MMU reset
//
// - Acts like a card in slot 3, except it doesn't require CFFF to activate like
//   a slot.
//
// INTCXROM   INTC8ROM   $C800-CFFF
//    0           0         slot   
//    0           1       internal 
//    1           0       internal 
//    1           1       internal 

const slotC8IsActive = () => {
  if (SWITCHES.INTCXROM.isSet || SWITCHES.INTC8ROM.isSet) return false
  // Will happen for one cycle after $CFFF in slot ROM,
  // or if $CFFF was accessed outside of slot ROM space.
  if (C800SlotGet() === 0 || C800SlotGet() === 255) return false
  return true
}

const manageC800 = (slot: number) => {

  if (slot < 8) {
    if (SWITCHES.INTCXROM.isSet)
      return

    // This combination forces INTC8ROM on
    if (slot === 3 && !SWITCHES.SLOTC3ROM.isSet) {
      if (!SWITCHES.INTC8ROM.isSet) {
        SWITCHES.INTC8ROM.isSet = true
        C800SlotSet(255)
        updateAddressTables()
      }
    }
    if (C800SlotGet() === 0) {
      // If C800Slot is zero, then set it to first card accessed
      C800SlotSet(slot)
      updateAddressTables();
    }
  } else {
    // if slot > 7 then it was an access to $CFFF
    // accessing $CFFF resets everything WRT C8
    SWITCHES.INTC8ROM.isSet = false
    C800SlotSet(0)
    updateAddressTables()
  }
}

const updateSlotRomTable = () => {
  // ROM ($C000...$CFFF) is in 0x200...0x20F
  addressGetTable[0xC0] = ROMpage - 0xC0
  for (let slot = 1; slot <= 7; slot++) {
    const page = 0xC0 + slot
    addressGetTable[page] = slot +
      (slotIsActive(slot) ? (SLOTindex - 1) : ROMpage)
  }

  // Fill in $C800-CFFF for cards
  if (slotC8IsActive()) {
    const slotC8 = SLOTC8index + 8 * (C800SlotGet() - 1)
    for (let i = 0; i <= 7; i++) {
      const page = 0xC8 + i
      addressGetTable[page] = slotC8 + i;
    }
  }
  else {
    for (let i = 0xC8; i <= 0xCF; i++) {
      addressGetTable[i] = ROMpage + i - 0xC0;
    }
  }
}

export const updateAddressTables = () => {
  updateMainAuxMemoryTable()
  updateReadBankSwitchedRamTable()
  updateWriteBankSwitchedRamTable()
  updateSlotRomTable()
  // Scale all of our mappings up by 256 to get to offsets in memory array.
  for (let i = 0; i < 256; i++) {
    addressGetTable[i] = 256 * addressGetTable[i];
    addressSetTable[i] = 256 * addressSetTable[i];
  }
}

// Used for jumping to custom TS functions when program counter hits an address.
export const specialJumpTable = new Map<number, () => void>();

// Custom callbacks for mem get/set to $C090-$C0FF slot I/O and $C100-$C7FF.
const slotIOCallbackTable = new Array<AddressCallback>(8)

// Value = -1 indicates that this was a read/get operation
const checkSlotIO = (addr: number, value = -1) => {
  const slot = ((addr >> 8) === 0xC0) ? ((addr - 0xC080) >> 4) : ((addr >> 8) - 0xC0)
  if (addr >= 0xC100) {
    manageC800(slot)
    if (!slotIsActive(slot))
      return
  }
  const fn = slotIOCallbackTable[slot]
  if (fn !== undefined) {
    const result = fn(addr, value)
    if (result >= 0) {
      // Set value in either slot memory or $C000 softswitch memory
      const offset = (addr >= 0xC100) ? (SLOTstart - 0x100) : ROMmemoryStart
      memory[addr - 0xC000 + offset] = result
    }
  }
}

/**
 * Add peripheral card IO callback.
 *
 * @param slot - The slot number 1-7.
 * @param fn - A function to jump to when IO of this slot is accessed
 */
export const setSlotIOCallback = (slot: number, fn: AddressCallback) => {
  slotIOCallbackTable[slot] = fn;
}

/**
 * Add peripheral card ROM.
 *
 * @param slot - The slot number 1-7.
 * @param driver - The ROM code for the driver.
 *                 Range 0x00-0xff is the slot Cx00 space driver
 *                 Anything above is considered C800 space to be activated for this card.
 * @param jump - (optional) If the program counter equals this address, then `fn` will be called.
 * @param fn - (optional) The function to jump to.
 */
export const setSlotDriver = (slot: number, driver: Uint8Array, jump = 0, fn = () => {null}) => {
  memory.set(driver.slice(0, 0x100), SLOTstart + (slot - 1) * 0x100)
  if (driver.length > 0x100) {
    // only allow up to 2k for C8 range
    const end = (driver.length > 0x900) ? 0x900 : driver.length;
    const addr = SLOTC8start + (slot - 1) * 0x800
    memory.set(driver.slice(0x100,end), addr)
  }
  if (jump) {
    specialJumpTable.set(jump, fn)
  }
}

export const memoryReset = () => {
  // Reset memory but skip over the ROM and peripheral card areas
  memory.fill(0xFF, 0, 0x10000)
  // Everything past here is RamWorks memory
  memory.fill(0xFF, BaseMachineMemory)
  // For now, comment out the use of the Extended Debugging Monitor
  // It's unclear what the benefit is, especially since we have a separate
  // TypeScript debugger. And there is a risk that some programs might
  // behave differently with the EDM.
  const whichROM = isDebugging ? romBase64 : romBase64 // isDebugging ? edmBase64 : romBase64
  const rom64 = whichROM.replace(/\n/g, "")
  const rom = new Uint8Array(
    Buffer.from(rom64, "base64")
  )
  memory.set(rom, ROMmemoryStart)
  C800SlotSet(0)
  RamWorksBankSet(0)
  updateAddressTables()
  noSlotClock.reset()
}

// Fill all pages of either main or aux memory with 0, 1, 2,...
export const memorySetForTests = (aux = false) => {
  memoryReset()
  const offset = aux ? RamWorksMemoryStart : 0
  for (let i=0; i <= 0xFF; i++) {
    memory.fill(i, i * 256 + offset, (i + 1) * 256 + offset)
  }
}

// Set $C007: FF to see this code
// Hack to change the cursor
// rom[0xC26F - 0xC000] = 161
// rom[0xC273 - 0xC000] = 161
// Hack to speed up the cursor
// rom[0xC288 - 0xC000] = 0x20

export const readWriteAuxMem = (addr: number, write = false) => {
  let useAux = write ? SWITCHES.RAMWRT.isSet : SWITCHES.RAMRD.isSet
  if (addr <= 0x1FF || addr >= 0xC000) {
    useAux = SWITCHES.ALTZP.isSet
  } else if (addr >= 0x400 && addr <= 0x7FF) {
    if (SWITCHES.STORE80.isSet) {
      useAux = SWITCHES.PAGE2.isSet
    }
  } else if (addr >= 0x2000 && addr <= 0x3FFF) {
    if (SWITCHES.STORE80.isSet) {
      if (SWITCHES.HIRES.isSet) {
        useAux = SWITCHES.PAGE2.isSet
      }
    }
  }
  return useAux
}

export const memGetSoftSwitch = (addr: number): number => {
  // $C019 Vertical blanking status (0 = vertical blanking, 1 = beam on)
  if (addr === 0xC019) {
    // Return "low" for 70 scan lines out of 262 (70 * 65 cycles = 4550)
    return inVBL ? 0x0D : 0x8D
  }
  if (addr >= 0xC090) {
    checkSlotIO(addr)
  } else {
    checkSoftSwitches(addr, false, s6502.cycleCount)
  }
  if (addr >= 0xC050) {
    updateAddressTables()
  }
  return memory[ROMmemoryStart + addr - 0xC000]
}

export const memGetSlotROM = (slot: number, addr: number) => {
  const offset = SLOTstart + (slot - 1) * 0x100 + (addr & 0xFF)
  return memory[offset]
}

export const memSetSlotROM = (slot: number, addr: number, value: number) => {
  if (value >= 0) {
    const offset = SLOTstart + (slot - 1) * 0x100 + (addr & 0xFF)
    memory[offset] = value & 0xFF
  }
}

export const debugSlot = (slot: number, addr: number, oldvalue: number, value = -1) => {
  if (!slotIsActive(slot)) return
  if (((addr - 0xC080) >> 4) === slot || ((addr >> 8) - 0xC0) === slot) {
    let s = `$${s6502.PC.toString(16)}: $${addr.toString(16)} (${oldvalue})`
    if (value >= 0) s += ` = $${value.toString(16)}`
    console.log(s)
  }
}

export const memGet = (addr: number, checkWatchpoints = true): number => {
  let value = 0
  const page = addr >>> 8
  // debugSlot(4, addr)
  if (page === 0xC0) {
    value = memGetSoftSwitch(addr)
  } else {
    value = -1
    if (page >= 0xC1 && page <= 0xC7) {
      if (page == 0xC3 && !SWITCHES.SLOTC3ROM.isSet) {
        // NSC answers in slot C3 memory to be compatible with standard prodos driver and A2osX
        value = noSlotClock.read(addr)
      }
      checkSlotIO(addr)
    } else if (addr === 0xCFFF) {
      manageC800(0xFF);
    }
    if (value < 0) {
      const shifted = addressGetTable[page]
      value = memory[shifted + (addr & 255)]
    }
  }
  if (checkWatchpoints && isWatchpoint(addr, value, false)) {
    setWatchpointBreak()
  }
  return value
}

export const memGetRaw = (addr: number): number => {
  const page = addr >>> 8
  const shifted = addressGetTable[page]
  return memory[shifted + (addr & 255)]
}

export const memSetSoftSwitch = (addr: number, value: number) => {
  // these are write-only soft switches that don't work like the others, since
  // we need the full byte of data being written
  if (addr === 0xC071 || addr === 0xC073) {
    // Out of range bank index?
    if (value > RamWorksMaxBank) return
    // The 0th bank is also AUX memory
    RamWorksBankSet(value)
  } else if (addr >= 0xC090) {
    checkSlotIO(addr, value)
  } else {
    checkSoftSwitches(addr, true, s6502.cycleCount)
  }
  if (addr <= 0xC00F || addr >= 0xC050) {
    updateAddressTables()
  }
}

export const memSet = (addr: number, value: number) => {
  const page = addr >>> 8
  // debugSlot(4, addr, value)
  if (page === 0xC0) {
    memSetSoftSwitch(addr, value)
  } else {
    if (page >= 0xC1 && page <= 0xC7) {
      if (page == 0xC3 && !SWITCHES.SLOTC3ROM.isSet) {
        // NSC answers in slot C3 memory to be compatible with standard prodos driver and A2osX
        noSlotClock.access(addr)
      }
      checkSlotIO(addr, value)
    } else if (addr === 0xCFFF) {
      manageC800(0xFF);
    }
    const shifted = addressSetTable[page]
    // This will prevent us from setting slot ROM or motherboard ROM
    if (shifted < 0) return
    memory[shifted + (addr & 255)] = value
  }
  if (isWatchpoint(addr, value, true)) {
    setWatchpointBreak()
  }
}

export const memGetC000 = (addr: number) => {
  return memory[ROMmemoryStart + addr - 0xC000]
}

export const memSetC000 = (addr: number, value: number, repeat = 1) => {
  const start = ROMmemoryStart + addr - 0xC000
  memory.fill(value, start, start + repeat)
}

const TEXT_PAGE1 = 0x400
const TEXT_PAGE2 = 0x800
const offset = [
  0, 0x80, 0x100, 0x180, 0x200, 0x280, 0x300, 0x380, 0x28, 0xA8, 0x128, 0x1A8,
  0x228, 0x2A8, 0x328, 0x3A8, 0x50, 0xD0, 0x150, 0x1D0, 0x250, 0x2D0, 0x350,
  0x3D0,
]

export const getTextPage = (getLores = false) => {
  let jstart = 0
  let jend = 24
  let is80column = false
  if (getLores) {
    if (SWITCHES.TEXT.isSet || SWITCHES.HIRES.isSet) {
      return new Uint8Array()
    }
    jend = SWITCHES.MIXED.isSet ? 20 : 24
    is80column = SWITCHES.COLUMN80.isSet && !SWITCHES.AN3.isSet
  } else {
    if (!SWITCHES.TEXT.isSet && !SWITCHES.MIXED.isSet) {
      return new Uint8Array()
    }
    if (!SWITCHES.TEXT.isSet && SWITCHES.MIXED.isSet) jstart = 20
    is80column = SWITCHES.COLUMN80.isSet
  }
  if (is80column) {
    // Only select second 80-column text page if STORE80 is also OFF
    const pageOffset = (SWITCHES.PAGE2.isSet && !SWITCHES.STORE80.isSet) ? TEXT_PAGE2 : TEXT_PAGE1
    const textPage = new Uint8Array(80 * (jend - jstart)).fill(0xA0)
    for (let j = jstart; j < jend; j++) {
      const joffset = 80 * (j - jstart)
      for (let i = 0; i < 40; i++) {
        textPage[joffset + 2 * i + 1] = memory[pageOffset + offset[j] + i]
        textPage[joffset + 2 * i] = memory[RamWorksMemoryStart + pageOffset + offset[j] + i]
      }
    }
    return textPage
  } else {
    const pageOffset = SWITCHES.PAGE2.isSet ? TEXT_PAGE2 : TEXT_PAGE1
    const textPage = new Uint8Array(40 * (jend - jstart))
    for (let j = jstart; j < jend; j++) {
      const joffset = 40 * (j - jstart)
      const start = pageOffset + offset[j]
      textPage.set(memory.slice(start, start + 40), joffset)
    }
    return textPage
  }
}

export const getTextPageAsString = () => {
  return Buffer.from(getTextPage().map((n) => (n &= 127))).toString()
}

export const getHires = () => {
  if (SWITCHES.TEXT.isSet || !SWITCHES.HIRES.isSet) {
    return new Uint8Array()
  }
  const doubleRes = SWITCHES.COLUMN80.isSet && !SWITCHES.AN3.isSet
  const nlines = SWITCHES.MIXED.isSet ? 160 : 192
  if (doubleRes) {
    // Only select second 80-column text page if STORE80 is also OFF
    const pageOffset = (SWITCHES.PAGE2.isSet && !SWITCHES.STORE80.isSet) ? 0x4000 : 0x2000
    const hgrPage = new Uint8Array(80 * nlines)
    for (let j = 0; j < nlines; j++) {
      const addr = hiresLineToAddress(pageOffset, j)
      for (let i = 0; i < 40; i++) {
        hgrPage[j * 80 + 2 * i + 1] = memory[addr + i]
        hgrPage[j * 80 + 2 * i] = memory[RamWorksMemoryStart + addr + i]
      }
    }
    return hgrPage
  } else {
    const pageOffset = SWITCHES.PAGE2.isSet ? 0x4000 : 0x2000
    const hgrPage = new Uint8Array(40 * nlines)
    for (let j = 0; j < nlines; j++) {
      const addr = pageOffset + 40 * Math.trunc(j / 64) +
        1024 * (j % 8) + 128 * (Math.trunc(j / 8) & 7)
      hgrPage.set(memory.slice(addr, addr + 40), j * 40)
    }
    return hgrPage
  }
}

export const getDataBlock = (addr: number) => {
  const offset = addressGetTable[addr >>> 8]
  return memory.slice(offset, offset + 512)
}

export const getMemoryBlock = (addr: number, length: number) => {
  const offset = addressGetTable[addr >>> 8] + (addr & 255)
  return memory.slice(offset, offset + length)
}

export const setMemoryBlock = (addr: number, data: Uint8Array) => {
  const offset = addressSetTable[addr >>> 8] + (addr & 255)
  memory.set(data, offset)
  handleGameSetup()
}

export const matchMemory = (addr: number, data: number[]) => {
  for (let i = 0; i < data.length; i++) {
   if (memGet(addr + i, false) !== data[i]) return false
  }
  return true
}

export const getZeroPage = () => {
  const status = ['']
  const offset = addressGetTable[0]
  const mem = memory.slice(offset, offset + 256)
  status[0] = '     0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F'
  for (let j = 0; j < 16; j++) {
    let s = toHex(16 * j) + ":"
    for (let i = 0; i < 16; i++) {
      s += " " + toHex(mem[j * 16 + i])
    }
    status[j + 1] = s
  }
  return status.join('\n')
}

export const getBasePlusAuxMemory = () => {
  return memory.slice(0, RamWorksMemoryStart + 0x10000)
}

// Each memory bank object has a human-readable name, a min/max address range
// where the bank is valid, and a function to determine if the bank is enabled.
export const MEMORY_BANKS: MemoryBanks = {}

// Should never be invoked but we need it for the droplist in the Edit Breakpoint dialog.
MEMORY_BANKS[""] = {name: "Any", min: 0, max: 0xFFFF, enabled: () => {return true}}

MEMORY_BANKS["MAIN"] = {name: "Main RAM ($0 - $FFFF)", min: 0, max: 0xFFFF,
  enabled: (addr = 0) => {
    if (addr >= 0xD000) {
      // We are not using our AUX card and we are using bank-switched RAM
      return !SWITCHES.ALTZP.isSet && SWITCHES.BSRREADRAM.isSet
    } else if (addr >= 0x200) {
      // Just look at our regular Main/Aux switch
      return !SWITCHES.RAMRD.isSet
    }
    // For $0-$1FF, look at the AUX ALTZP switch
    return !SWITCHES.ALTZP.isSet}
}

MEMORY_BANKS["AUX"] = {name: "Auxiliary RAM ($0 - $FFFF)", min: 0x0000, max: 0xFFFF,
  enabled: (addr = 0) => {
    if (addr >= 0xD000) {
      // We are using our AUX card and we are also using bank-switched RAM
      return SWITCHES.ALTZP.isSet && SWITCHES.BSRREADRAM.isSet
    } else if (addr >= 0x200) {
      // Just look at our regular Main/Aux switch
      return SWITCHES.RAMRD.isSet
    }
    // For $0-$1FF, look at the AUX ALTZP switch
    return SWITCHES.ALTZP.isSet}
}

MEMORY_BANKS["ROM"] = {name: "ROM ($D000 - $FFFF)", min: 0xD000, max: 0xFFFF,
  enabled: () => {return !SWITCHES.BSRREADRAM.isSet}}

MEMORY_BANKS["MAIN-DXXX-1"] = {name: "Main D000 Bank 1 ($D000 - $DFFF)", min: 0xD000, max: 0xDFFF,
  enabled: () => { return !SWITCHES.ALTZP.isSet && SWITCHES.BSRREADRAM.isSet && !SWITCHES.BSRBANK2.isSet }}

MEMORY_BANKS["MAIN-DXXX-2"] = {name: "Main D000 Bank 2 ($D000 - $DFFF)", min: 0xD000, max: 0xDFFF,
  enabled: () => {return !SWITCHES.ALTZP.isSet && SWITCHES.BSRREADRAM.isSet && SWITCHES.BSRBANK2.isSet}}

MEMORY_BANKS["AUX-DXXX-1"] = {name: "Aux D000 Bank 1 ($D000 - $DFFF)", min: 0xD000, max: 0xDFFF,
  enabled: () => { return SWITCHES.ALTZP.isSet && SWITCHES.BSRREADRAM.isSet && !SWITCHES.BSRBANK2.isSet }}

MEMORY_BANKS["AUX-DXXX-2"] = {name: "Aux D000 Bank 2 ($D000 - $DFFF)", min: 0xD000, max: 0xDFFF,
  enabled: () => {return SWITCHES.ALTZP.isSet && SWITCHES.BSRREADRAM.isSet && SWITCHES.BSRBANK2.isSet}}

MEMORY_BANKS["CXXX-ROM"] = {name: "Internal ROM ($C100 - $CFFF)", min: 0xC100, max: 0xCFFF,
  enabled: (addr = 0) => {
    if (addr >= 0xC300 && addr <= 0xC3FF) {
      return SWITCHES.INTCXROM.isSet || !SWITCHES.SLOTC3ROM.isSet
    } else if (addr >= 0xC800) {
      return SWITCHES.INTCXROM.isSet || SWITCHES.INTC8ROM.isSet
    }
    return SWITCHES.INTCXROM.isSet}
}

MEMORY_BANKS["CXXX-CARD"] = {name: "Peripheral Card ROM ($C100 - $CFFF)", min: 0xC100, max: 0xCFFF,
  enabled: (addr = 0) => {
    if (addr >= 0xC300 && addr <= 0xC3FF) {
      return SWITCHES.INTCXROM.isSet ? false : SWITCHES.SLOTC3ROM.isSet
    } else if (addr >= 0xC800) {
      // Both switches need to be off for addresses $C800-$CFFF to come from cards
      return !SWITCHES.INTCXROM.isSet && !SWITCHES.INTC8ROM.isSet
    }
    return !SWITCHES.INTCXROM.isSet}
}

export const MemoryBankKeys = Object.keys(MEMORY_BANKS);
export const MemoryBankNames: string[] = Object.values(MEMORY_BANKS).map(bank => bank.name);
