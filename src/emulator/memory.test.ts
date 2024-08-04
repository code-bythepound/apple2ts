import { doSetRamWorks, memGet, memSet, memory, memoryReset, memorySetForTests, setSlotDriver } from "./memory";
import { getApple2State, setApple2State } from "./motherboard";
import { RamWorksMemoryStart } from "./utility/utility";
import { setIsTesting } from "./worker2main";

type ExpectValue = (i: number) => void

const doWriteIndexToMemory = (offset: number, start: number, end: number) => {
  for (let i = start; i <= end; i++) {
    const addr = (i * 256 + offset)
    memSet(addr, i)
  }
}

const doWriteValueToMemory = (offset: number, start: number, end: number, value: number) => {
  for (let i = start; i <= end; i++) {
    const addr = (i * 256 + offset)
    memSet(addr, value)
  }
}

const doTestMemory = (offset: number, start: number, end: number, expectValue: ExpectValue) => {
  for (let i = start; i <= end; i++) {
    const addr = (i * 256 + offset)
    expect(memGet(addr)).toEqual(expectValue(i));
  }
}

const expectIndex = (i: number = 0) => i

test('readMainMemIndex', () => {
  memorySetForTests()
  doTestMemory(0, 0, 0xBF, expectIndex)
  doTestMemory(1, 0, 0xBF, expectIndex)
  doTestMemory(0xFE, 0, 0xBF, expectIndex)
  doTestMemory(0xFF, 0, 0xBF, expectIndex)
})

test('readAuxMemEmpty', () => {
  memorySetForTests()
  // AUX read enable
  memSet(0xC003, 1)
  expect(memGet(0xC013)).toEqual(0x80);
  doTestMemory(0, 0x02, 0xBF, () => 0xFF)
  // Pages 0 and 1 should still be from MAIN
  doTestMemory(0, 0, 0x01, expectIndex)
  // This should still write to MAIN
  doWriteIndexToMemory(0, 0, 0xBF)
  doTestMemory(0, 0x02, 0xBF, () => 0xFF)
  // MAIN read enable
  memSet(0xC002, 1)
  expect(memGet(0xC013)).toEqual(0);
  // First value in each page of main should have that index
  doTestMemory(0, 0x02, 0xBF, expectIndex)
})

test('readAuxMemIndex', () => {
  // Put index in AUX; main should just be 0xFF's
  memorySetForTests(true)
  // AUX read enable
  memSet(0xC003, 1)
  doTestMemory(0, 0x02, 0xBF, expectIndex)
  doTestMemory(1, 0x02, 0xBF, expectIndex)
  doTestMemory(0xFE, 0x02, 0xBF, expectIndex)
  doTestMemory(0xFF, 0x02, 0xBF, expectIndex)
  memSet(0xC002, 1)
})

test('readMainMemEmpty', () => {
  // Put index in AUX; main should just be 0xFF's
  memorySetForTests(true)
  doTestMemory(0, 0, 0xBF, () => 0xFF)
})

test('readWriteMainMem', () => {
  memoryReset()
  doWriteIndexToMemory(0, 0, 0xBF)
  doTestMemory(0, 0, 0xBF, expectIndex)
  doWriteIndexToMemory(1, 0, 0xBF)
  doTestMemory(1, 0, 0xBF, expectIndex)
  doWriteIndexToMemory(0xFE, 0, 0xBF)
  doTestMemory(0xFE, 0, 0xBF, expectIndex)
  doWriteIndexToMemory(0xFF, 0, 0xBF)
  doTestMemory(0xFF, 0, 0xBF, expectIndex)
})

test('readWriteAuxMem', () => {
  memoryReset()
  // AUX write enable
  memSet(0xC005, 1)
  expect(memGet(0xC014)).toEqual(0x80);
  doWriteIndexToMemory(0, 0, 0xBF)
  // Should still be reading from MAIN
  doTestMemory(0, 0x02, 0xBF, () => 0xFF)
  // AUX read enable
  memSet(0xC003, 1)
  doTestMemory(0, 0x02, 0xBF, expectIndex)
  // MAIN write enable, and write some values
  memSet(0xC004, 1)
  expect(memGet(0xC014)).toEqual(0)
  doWriteValueToMemory(0, 0, 0xBF, 0xA0)
  // Should still be reading from AUX
  doTestMemory(0, 0x02, 0xBF, expectIndex)
  // MAIN read enable
  memSet(0xC002, 1)
  doTestMemory(0, 0x02, 0xBF, () => 0xA0)
})

test('testC800', () => {
  memoryReset()
  const slot1 = new Uint8Array(2*1024).fill(1)
  const slot2 = new Uint8Array(2*1024).fill(2)
  const slot3 = new Uint8Array(2*1024).fill(3)
  setSlotDriver(1, slot1)
  setSlotDriver(2, slot2)
  setSlotDriver(3, slot3)

  // start with INTCXROM and SLOTC3ROM clear
  memSet(0xC006,0)
  memSet(0xC00A,0)
  // clear INTC8ROM
  memGet(0xCFFF)

  // check rom
  const xC800 = memGet(0xC800)
  const xC801 = memGet(0xC801)
  const xC802 = memGet(0xC802)
  const isStillInternalROM = xC800 === 0x4C && xC801 === 0xB0 && xC802 === 0xC9
  expect(isStillInternalROM).toEqual(false)

  // reset, access S2, should switch to S2
  memGet(0xCFFF)
  memGet(0xC200)
  expect(memGet(0xC800)).toEqual(0x02)

  // access S1, should still be S2 without reset
  memGet(0xC100)
  expect(memGet(0xC800)).toEqual(0x02)

  // set INTC8ROM by accessing c3xx with SLOTC3ROM off, should immediately switch
  memGet(0xC300)
  expect(memGet(0xC800)).toEqual(0x4C)

  // reset, access S1, should switch to S1
  memGet(0xCFFF)
  memGet(0xC100)
  expect(memGet(0xC800)).toEqual(0x01)

  // access S2, should still be S1
  memGet(0xC200)
  expect(memGet(0xC800)).toEqual(0x01)

  // Do a "read", should not switch softswitch
  memGet(0xC007)
  expect(memGet(0xC800)).toEqual(0x01)

  // TEST INTCXROM SIDE EFFECTS
  // set INTCXROM
  memSet(0xC007,0)

  // check rom
  expect(memGet(0xC800)).toEqual(0x4C)
 
  // reset, should still be internal because our special INTC8ROM was not set,
  // and therefore INTCXROM is still in control
  memGet(0xCFFF)
  expect(memGet(0xC800)).toEqual(0x4C)

  // reset, access S2, should still be internal
  memGet(0xCFFF)
  memGet(0xC200)
  expect(memGet(0xC800)).toEqual(0x4c)

  // clear INTCXROM
  memSet(0xC006, 0)

  // check rom, should be set to random peripheral ROM because INTC8ROM was not set
  const isRandomPeripheral = xC800 !== 0x4C && xC800 !== 0x02
  expect(isRandomPeripheral).toEqual(true)
 
  // reset, access S2, should be S2
  // now that INTCXROM is off, accessing $CFFF should switch to slot ROM
  memGet(0xCFFF)
  memGet(0xC200)
  expect(memGet(0xC800)).toEqual(0x02)

  // set INTCXROM
  memSet(0xC007,0)

  // should be internal
  expect(memGet(0xC800)).toEqual(0x4C)

  // clear INTCXROM
  memSet(0xC006,0)

  // should still be S2
  expect(memGet(0xC800)).toEqual(0x02)

  // TEST INTC8ROM SIDE EFFECTS
  // set SLOTC3ROM
  memSet(0xC00B,0)
  expect(memGet(0xC300)).toEqual(0x03)
  // clear SLOTC3ROM
  memSet(0xC00A,0)
  expect(memGet(0xC300)).not.toEqual(0x03)

  memGet(0xCFFF)
  // set SLOTC3ROM
  memSet(0xC00B,0)
  expect(memGet(0xC300)).toEqual(0x03)
  expect(memGet(0xC800)).toEqual(0x03)

  // clear SLOTC3ROM
  memSet(0xC00A,0)
  expect(memGet(0xC300)).not.toEqual(0x03)

  // above get in $C3xx should also set INTC8ROM
  expect(memGet(0xC800)).toEqual(0x4C)

  // access S2, should still be internal
  memGet(0xC200)
  expect(memGet(0xC800)).not.toEqual(0x02)
})

test('test RamWorks', () => {
  memoryReset()
  doSetRamWorks(4096)
  
  // check regular zp
  memSet(0x00C0, 0xDE)
  expect(memGet(0x00C0)).toEqual(0xDE)
 
  // altzp, default memory fill is 0xFF
  memSet(0xC009,0)
  expect(memGet(0x00C0)).toEqual(0xFF)
  memSet(0x00C0, 0xCD)
  expect(memGet(0x00C0)).toEqual(0xCD)
  expect(memory[RamWorksMemoryStart + 0x00C0]).toEqual(0xCD)

  // RamWorks bank 0 is alt
  memSet(0xC073,0x00)
  expect(memGet(0x00C0)).toEqual(0xCD)

  // switch to all RamWorks banks
  let maxBank = 4096 / 64 - 1
  for (let bank = 1; bank <= maxBank; bank++) {
    memSet(0xC073, bank)
    expect(memGet(0x00C0)).toEqual(0xFF)
    memSet(0x00C0, bank)
    expect(memGet(0x00C0)).toEqual(bank)
    expect(memory[RamWorksMemoryStart + bank * 0x10000 + 0x00C0]).toEqual(bank)
  }

  // switch off altzp
  memSet(0xC008,0)
  expect(memGet(0x00C0)).toEqual(0xDE)

  // switch to RamWorks bank 2
  memSet(0xC073, 0x02)
  // since altzp is still off
  expect(memGet(0x00C0)).toEqual(0xDE)

  // altzp on, make sure it remembered to be in bank 2
  memSet(0xC009,0)
  expect(memGet(0x00C0)).toEqual(0x02)

  // Now make sure it remembered all of the values in the different banks
  for (let bank = 1; bank <= maxBank; bank++) {
    memSet(0xC073, bank)
    expect(memGet(0x00C0)).toEqual(bank)
  }

  // switch off altzp
  memSet(0xC008, 0)
  expect(memGet(0x00C0)).toEqual(0xDE)

  // altzp on, make sure it remembered to be in maxBank
  memSet(0xC009, 0)
  expect(memGet(0x00C0)).toEqual(maxBank)

  // Now crank up the memory and make sure it copied correctly
  doSetRamWorks(8192)

  // Did it remember that we were in maxBank?
  expect(memGet(0x00C0)).toEqual(maxBank)

  // Make sure it copied all of the indices
  for (let bank = 1; bank <= maxBank; bank++) {
    memSet(0xC073, bank)
    expect(memGet(0x00C0)).toEqual(bank)
  }

    // Test the upper 4096
  const oldMaxBank = maxBank
  maxBank = 8192 / 64 - 1
  for (let bank = oldMaxBank + 1; bank <= maxBank; bank++) {
    memSet(0xC073, bank)
    expect(memGet(0x00C0)).toEqual(0xFF)
    memSet(0x00C0, bank)
    expect(memGet(0x00C0)).toEqual(bank)
  }

  for (let bank = 1; bank <= maxBank; bank++) {
    memSet(0xC073, bank)
    expect(memGet(0x00C0)).toEqual(bank)
    expect(memory[RamWorksMemoryStart + bank * 0x10000 + 0x00C0]).toEqual(bank)
  }

  // Now kill all the memory. This should reset the bank index to 0
  // and remove all of the RamWorks memory.
  doSetRamWorks(64)
  expect(memGet(0x00C0)).toEqual(0xCD)
  for (let bank = 1; bank <= maxBank; bank++) {
    // This should be a nop, and should just leave the bank index in AUX mem.
    memSet(0xC073, bank)
    expect(memGet(0x00C0)).toEqual(0xCD)
  }

  memSet(0xC008,0)
})

test('test RamWorks Save/Restore', () => {
  setIsTesting()
  memoryReset()
  doSetRamWorks(4096)
  memSet(0x00C0, 99)
  memSet(0xC073, 5)
  memSet(0xC009, 0)
  memSet(0x00C0, 5)
  expect(memGet(0x00C0)).toEqual(5)
  const sState = getApple2State()
  memoryReset()
  expect(memGet(0x00C0)).toEqual(0xFF)
  setApple2State(sState, 1.0)
  expect(memGet(0x00C0)).toEqual(5)
})

const LOC1 = 0xD17B   // $53 in Apple II/plus/e/enhanced
const LOC2 = 0xFE1F		// $60 in Apple II/plus/e/enhanced

const setupBSR = () => {
  memGet(0xC089)  // enable R/W RAM, bank 1
  memGet(0xC089)  // enable R/W RAM, bank 1
  memSet(LOC1, 0x11)
  memSet(LOC2, 0x33)
  memGet(0xC083)  // enable R/W RAM, bank 2
  memGet(0xC083)  // enable R/W RAM, bank 2
  memSet(LOC1, 0x22)
  memGet(0xC082)  // enable ROM
}

test('test Bank-Switched-Ram READ ONLY', () => {
  for (let bank = 1; bank <= 2; bank++) {
    setupBSR()
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    const bankAddr = bank === 1 ? 0xC088 : 0xC080
    const value = bank === 1 ? 0x11 : 0x22
    memGet(bankAddr)  // enable Read RAM, bank 1
    expect(memGet(LOC1)).toEqual(value)
    expect(memGet(LOC2)).toEqual(0x33)
    // Should not be able to write at all
    memGet(bankAddr)  // enable Read RAM, bank 1
    memSet(LOC1, 0x99)
    expect(memGet(LOC1)).toEqual(value)
    expect(memGet(LOC2)).toEqual(0x33)
  }
})

test('test Bank-Switched-Ram WRITE ONLY', () => {
  for (let bank = 1; bank <= 2; bank++) {
    setupBSR()
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    const bankAddr = bank === 1 ? 0xC089 : 0xC081
    const value = bank === 1 ? 0x11 : 0x22
    memGet(bankAddr)  // enable pre-write
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    // Should not be able to write yet
    memSet(LOC1, 0x99)
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    memGet(bankAddr)  // enable write
    memSet(LOC1, value + 1)
    memSet(LOC2, 0x34)
    // We still can't read
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    const bankRead = bank === 1 ? 0xC088 : 0xC080
    memGet(bankRead)  // enable Read RAM, bank 1
    expect(memGet(LOC1)).toEqual(value + 1)
    expect(memGet(LOC2)).toEqual(0x34)
  }
})

test('test Bank-Switched-Ram READ/WRITE', () => {
  for (let bank = 1; bank <= 2; bank++) {
    setupBSR()
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    const bankAddr = bank === 1 ? 0xC08B : 0xC083
    const value = bank === 1 ? 0x11 : 0x22
    memGet(bankAddr)  // enable pre-write
    expect(memGet(LOC1)).toEqual(value)
    // Should not be able to write yet
    memSet(LOC1, 0x99)
    expect(memGet(LOC1)).toEqual(value)
    memGet(bankAddr)  // enable write
    memSet(LOC1, value + 2)
    memSet(LOC2, 0x34)
    // Should be able to read it right away
    expect(memGet(LOC1)).toEqual(value + 2)
    expect(memGet(LOC2)).toEqual(0x34)
    // A write to $C083/$C08B should reset the PRE-WRITE,
    // but should still be able to write and read...
    memSet(bankAddr, 1)
    memSet(LOC1, value + 3)
    memSet(LOC2, 0x35)
    expect(memGet(LOC1)).toEqual(value + 3)
    expect(memGet(LOC2)).toEqual(0x35)
  }
})

test('test Bank-Switched-Ram PRE-WRITE disable', () => {
  for (let bank = 1; bank <= 2; bank++) {
    setupBSR()
    expect(memGet(LOC1)).toEqual(0x53)
    expect(memGet(LOC2)).toEqual(0x60)
    const bankAddr = bank === 1 ? 0xC08B : 0xC083
    const value = bank === 1 ? 0x11 : 0x22
    memGet(bankAddr)  // enable pre-write
    expect(memGet(LOC1)).toEqual(value)
    // Should not be able to write yet
    memSet(LOC1, 0x99)
    expect(memGet(LOC1)).toEqual(value)

    // A write to $C083/$C08B should reset the PRE-WRITE to zero.
    memSet(bankAddr, 1)

    // Should not be able to write
    memSet(LOC1, 0x99)
    expect(memGet(LOC1)).toEqual(value)

    memGet(bankAddr)  // enable pre-write

    // Should STILL not be able to write
    memSet(LOC1, 0x99)
    expect(memGet(LOC1)).toEqual(value)

    // Finally, should be able to write!
    memGet(bankAddr)
    memSet(LOC1, value + 1)
    memSet(LOC2, 0x34)
    expect(memGet(LOC1)).toEqual(value + 1)
    expect(memGet(LOC2)).toEqual(0x34)
  }
})
