// DMAC Card for Apple2TS copyright Michael Morrison (codebythepound@gmail.com)

//import { interruptRequest } from "../cpu6502"
import { memGetSoftSwitch, memSetSoftSwitch,
         memGet, memSet, getMemoryBlock, setSlotIOCallback } from "../memory"

let slot = 1

export const enableDMACCard = (enable = true, aslot = 1) => {
  if (!enable)
    return

  slot = aslot

  setSlotIOCallback(slot, handleDMACIO)
}

let pushBufferAddr = 0

const DMAPull = (addr: number, length: number) : Uint8Array => {
  // pushbuffers are always in the current bank
  console.log("DMAC: DMAPull" + pushBufferAddr.toString(16) + " : " + length.toString(16) + " bytes")
  return getMemoryBlock( addr, length )
}

const CMD = {
    FILL8:   0x00,  // 8 bit fill
    FILL16:  0x01,  // 16 bit fill
    COPY:    0x02,  // copy mem
    SSRD:    0x03,  // read mem (softswitch)
    SSWR:    0x04,  // write mem (softswitch)
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
  const lo = value & 0xff
  const hi = (value & 0xff00) >> 8
  for(let i=0;i<length;addr+=2,i++)
  {
    memSet(addr+0, lo)
    memSet(addr+1, hi)
  }
}

const copyMem = (sbank:number, src:number, dbank:number, dest:number, length:number) => {
  console.log("copyMem " + src.toString(16) + " " + dest.toString(16) + " " + length.toString(16))

  for(let i=0;i<length;src++,dest++,i++)
  {
    memSet(dest, memGet(src))
  }
}

const ParseCmdBuffer = (buffer : Uint8Array) => {
  let pos = 0
  let value = 0
  let addr = 0
  let length = 0
  let bank = 0
  let sbank = 0
  let dbank = 0
  let src = 0
  let dest = 0

  while( pos < buffer.length )
  {
    let cmd = buffer[pos++]
    switch (cmd)
    {
      case CMD.FILL8:
        value = buffer[pos++]
        addr = buffer[pos++]
        addr += buffer[pos++] * 256
        bank = buffer[pos++]
        length = buffer[pos++]
        length += buffer[pos++] * 256
        fillMem8(value, bank, addr, length)
        break

      case CMD.FILL16:
        value = buffer[pos++]
        value += buffer[pos++] * 256
        addr = buffer[pos++]
        addr += buffer[pos++] * 256
        bank = buffer[pos++]
        length = buffer[pos++]
        length += buffer[pos++] * 256
        fillMem16(value, bank, addr, length)
        break

      case CMD.SSRD:
        addr = buffer[pos++]
        readSS(addr)
        break

      case CMD.SSWR:
        addr = buffer[pos++]
        writeSS(addr)
        break

      default:
        console.log("DMAC: CMD " + cmd.toString(16) + " unknown")
        break
    }
  }
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

  // We don't manage the ROM
  if (addr >= 0xC100)
    return -1

  const REG = {
      DMALO:   0x00,  // low byte of DMA pushbuffer
      DMAHI:   0x01,  // high byte of DMA pushbuffer
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
          return 0x44 | 0x80

    case REG.DMAHI:
        if (val >= 0) {
          pushBufferAddr &= 0x00FF
          pushBufferAddr |= ((val << 8) & 0xFF00)
          break
        }
        else
          return 0x4D | 0x80

    case REG.DMALEN:
        if(val >= 0)
        {
          const pushBuffer = DMAPull(pushBufferAddr, val&0xff)
          ParseCmdBuffer(pushBuffer)
          break;
        }
        else
          return 0x41 | 0x80

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
