// DMAC Card for Apple2TS copyright Michael Morrison (codebythepound@gmail.com)

//import { interruptRequest } from "../cpu6502"
import { memGetSoftSwitch, memSetSoftSwitch,
         memGet, memSet, getMemoryBlock, setSlotIOCallback } from "../../memory"
import { assertDMA } from "../../motherboard"
import { DMACLib } from "./DMACLib.js"

// load dmac C++ module
let dmacLib;
let dmaBytePtr = 0;
let Loaded = false;

const DMAByte = (addr: number, value: number) => {
  memSet(addr, value)
}

DMACLib().then(instance => {
  Loaded = true
  dmacLib = instance
  dmaBytePtr = dmacLib.addFunction(DMAByte, 'vii')
})

let slot = 3

export const resetDMAC = () => {
}

export const enableDMACCard = (enable = true, aslot = 3) => {
  if (!enable)
    return

  slot = aslot

  if (Loaded) {
    dmacLib._Init();
    console.log("Loaded..");
  } else {
    console.log("NOT LOADED..");
  }

  setSlotIOCallback(slot, handleDMACIO)
}

let pushBuffer : Uint8Array
let pushBufferAddr = 0
let pushBufferLength = 0

const DMAPull = (addr: number, length: number) : Uint8Array => {
  // pushbuffers are always in the current bank
  console.log("DMAC: DMAPull " + pushBufferAddr.toString(16) + " : " + length.toString(16) + " bytes")
  return getMemoryBlock( addr, length )
}

const DMACommands = (arg: any) : number => {
  pushBuffer = DMAPull(pushBufferAddr, pushBufferLength)
  let cycles = pushBufferLength
  // parsing commands will be async on actual card
  cycles += ParseCmdBuffer()
  // deassert
  assertDMA(false, 0, 0)
  return cycles
}

const CMD = {
    CONFIG:  0x00,  // Set configuration
    FILL8:   0x01,  // 8 bit fill
    FILL16:  0x02,  // 16 bit fill
    COPY:    0x03,  // linear copy mem
    SSRD:    0x04,  // read mem (softswitch)
    SSWR:    0x05,  // write mem (softswitch)
    CLEAR:   0x06,  // clear current fb
    FTRI:    0x07,  // filled triangle
    TRI:     0x08,  // triangle outline
    FRECT:   0x09,  // filled rectangle
    RECT:    0x0a,  // rectangle outline
    LINE:    0x0b,  // general line
    HLINE:   0x0c,  // horizontal line
    SCOPY:   0x0d,  // sprite blit/copy
    PRESENT: 0xFD,  // present internal representation (dma to screen memory)
    EXIT:    0xFE,  // early exit
    CHAIN:   0xFF,  // chain next dma
}

const readSS = (addr:number) => {
  console.log("ssrd 0xC0" + addr.toString(16))

  memGetSoftSwitch(0xC000 + addr)
}

const writeSS = (addr:number) => {
  console.log("sswr 0xC0" + addr.toString(16))

  memSetSoftSwitch(0xC000 + addr,0x00)
}

const fillMem8 = (value:number, bank:number, addr:number, length:number) => {
  console.log("fillMem8 " + value.toString(16) + " " + addr.toString(16) + " " + length.toString(16))

  for(let i=0;i<length;addr++,i++)
    memSet(addr, value)
}

const fillMem16 = (value:number, bank:number, addr:number, length:number) => {
  console.log("fillMem16 " + value.toString(16) + " " + addr.toString(16) + " " + length.toString(16))
  const lo = value & 0xff
  const hi = (value & 0xff00) >> 8
  for(let i=0;i<length;addr+=2,i++)
  {
    memSet(addr+0, lo)
    memSet(addr+1, hi)
  }
}

const copyMem = (sbank:number, src:number, dbank:number, dest:number, length:number) => 
{
  console.log("copyMem " + src.toString(16) + " " + dest.toString(16) + " " + length.toString(16))

  for(let i=0;i<length;src++,dest++,i++)
  {
    memSet(dest, memGet(src))
  }
}

const ParseCmdBuffer = (): number => {

  let cycles = 0
  let pos = 0
  let buffer = pushBuffer

  while( pos < buffer.length )
  {
    let cmd = buffer[pos++]
    switch (cmd)
    {
      case CMD.FILL8: {
        let value = buffer[pos++]
        let addr = buffer[pos++]
        addr += buffer[pos++] * 256
        let bank = buffer[pos++]
        let length = buffer[pos++]
        length += buffer[pos++] * 256
        fillMem8(value, bank, addr, length)
        cycles += length
      }
      break

      case CMD.FILL16: {
        let value = buffer[pos++]
        value += buffer[pos++] * 256
        let addr = buffer[pos++]
        addr += buffer[pos++] * 256
        let bank = buffer[pos++]
        let length = buffer[pos++]
        length += buffer[pos++] * 256
        fillMem16(value, bank, addr, length)
        cycles += length*2
      }
      break

      case CMD.COPY: {
        let src = buffer[pos++]
        src += buffer[pos++] * 256
        let sbank = buffer[pos++]
        let dest = buffer[pos++]
        dest += buffer[pos++] * 256
        let dbank = buffer[pos++]
        let length = buffer[pos++]
        length += buffer[pos++] * 256
        copyMem(sbank, src, dbank, dest, length)
        cycles += length*2
      }
      break

      case CMD.SSRD: {
        let addr = buffer[pos++]
        readSS(addr)
        cycles += 2
      }
      break

      case CMD.SSWR: {
        let addr = buffer[pos++]
        writeSS(addr)
        cycles += 2
      }
      break

      case CMD.CONFIG: {
        let mode = buffer[pos++]
        dmacLib._cmdSetMode(mode, 1, dmaBytePtr)
      }
      break

      case CMD.CLEAR: {
        dmacLib._Clear()
      }
      break

      case CMD.PRESENT: {
        let page = buffer[pos++]
        dmacLib._cmdPresent(page)
      }
      break

      case CMD.FRECT:
      case CMD.RECT: {
        let value = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        let height = buffer[pos++]
        dmacLib._cmdLFRect(x, y, width, height, value, 0)
      }
      break

      case CMD.FTRI:
      case CMD.TRI: {
        let value = buffer[pos++]
        let x1 = buffer[pos++]
        let y1 = buffer[pos++]
        let x2 = buffer[pos++]
        let y2 = buffer[pos++]
        let x3 = buffer[pos++]
        let y3 = buffer[pos++]
        dmacLib._cmdTriangle(x1, y1, x2, y2, x3, y3, value)
      }
      break

      case CMD.LINE: {
        let value = buffer[pos++]
        let x1 = buffer[pos++]
        let y1 = buffer[pos++]
        let x2 = buffer[pos++]
        let y2 = buffer[pos++]
        dmacLib._cmdLine(x1, y1, x2, y2, value)
      }
      break

      case CMD.HLINE: {
        let value = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        dmacLib._cmdHLine(x, y, width, value)
      }
      break

      case CMD.SCOPY: {
        let id = buffer[pos++]
        let dx = buffer[pos++]
        let dy = buffer[pos++]
        let mode = buffer[pos++]
        dmacLib._cmdBlt(id, dx, dy, mode);
      }
      break

      /*
      case CMD.HBLITLT: {
        let src = buffer[pos++]
        src += buffer[pos++] * 256
        let sbank = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        let op = buffer[pos++]
        hblitLToT(sbank, src, x, y, width, op)
      }
      break
      */

      case CMD.EXIT:
        return cycles

      default:
        console.log("DMAC: CMD " + cmd.toString(16) + " unknown")
        break
    }
  }

  return cycles
}

// CONFIG register
//
// 7 6 5 4 3 2 1 0
// | | | | | | | +-> \
// | | | | | | +---> Max Cycles DMA 0=1/10 1=3/10 2=6/10 3=9/10
// | | | | | +-----> Expanded memory Type 1=RamWorks 0=NONE
// | | | | +-------> 0 = Text Mode, 1 = Gfx Mode 
// | | | +---------> Alt Mode 0 = 40/single 1 = 80/Double 
// | | +-----------> Txt/Gfx Page
// | +-------------> Interrupt on Vblank
// +---------------> Interrupt on transaction complete

let config = 0
const SetConfig = (value : number) => {
  config = value
}

const GetConfig = () => {
  return config
}

// Status Register
//
// 7 6 5 4 3 2 1 0
// | | | | | | | +->
// | | | | | | +---> 
// | | | | | +-----> 
// | | | | +-------> 
// | | | +---------> 
// | | +-----------> 
// | +-------------> DMA in progress
// +---------------> Interrupting

let status = 0
const SetStatus = (value : number) => {
  // setting status does nothing
}

const GetStatus = () => {
  return status
}

export const onDMACVBL = () => {
}

const handleDMACIO = (addr: number, val = -1): number => {

  // There is no ROM
  if (addr >= 0xC100)
    return -1

  const REG = {
      DMALO:   0x00,  // low byte of DMA pushbuffer addr
      DMAHI:   0x01,  // high byte of DMA pushbuffer addr
      DMALEN:  0x02,  // Length of DMA buffer.  Initiates DMA 
      CONFIG:  0x03,  // Configuration register
      STATUS:  0x04,  // Status register
  }

  switch (addr & 0x0f) {
    case REG.DMALO:
        if (val >= 0) {
          pushBufferAddr &= 0xFF00
          pushBufferAddr |= (val & 0x00FF)
          break
        }
        else
          return 0x44 | 0x80  // 'D'

    case REG.DMAHI:
        if (val >= 0) {
          pushBufferAddr &= 0x00FF
          pushBufferAddr |= ((val << 8) & 0xFF00)
          break
        }
        else
          return 0x4D | 0x80  // 'M'

    case REG.DMALEN:
        if(val >= 0)
        {
          pushBufferLength = val&0xff;
          assertDMA(true, DMACommands, 0)
          break;
        }
        else
          return 0x41 | 0x80  // 'A'

    case REG.STATUS:
        if(val >= 0) {
          SetStatus(val)
          break
        } else
          return GetStatus()

    case REG.CONFIG:
        if(val >= 0) {
          SetConfig(val) 
          break
        } else
          return GetConfig()

    default:
        console.log('DMAC unknown register', (addr&0xf).toString(16))
        break
    }

    return -1
}
