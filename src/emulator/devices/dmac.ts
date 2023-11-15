// DMAC Card for Apple2TS copyright Michael Morrison (codebythepound@gmail.com)

//import { interruptRequest } from "../cpu6502"
import { memGetSoftSwitch, memSetSoftSwitch,
         memGet, memSet, getMemoryBlock, setSlotIOCallback } from "../memory"
import { blit } from "./blitter"

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
  console.log("DMAC: DMAPull " + pushBufferAddr.toString(16) + " : " + length.toString(16) + " bytes")
  return getMemoryBlock( addr, length )
}

const gettxtaddr = (line:number, page:number) : number =>
{
    if (page)
      page = 0x800
    else
      page = 0x400

    if (line>23)
      return 0

    const a = line >> 3; // div 8
    const b = line & 7; // mod 8
    return page + 0x80*b + 0x28*a
}

const CMD = {
    FILL8:   0x00,  // 8 bit fill
    FILL16:  0x01,  // 16 bit fill
    COPY:    0x02,  // copy mem
    SSRD:    0x03,  // read mem (softswitch)
    SSWR:    0x04,  // write mem (softswitch)
    RECTT:   0x05,  // text filled rectangle
    HLINET:  0x06,  // text filled horizontal line
    BLITLT:  0x07,  // linear to text blit
    BLITLH:  0x08,  // linear to HGR blit
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

let interleaved = false

const hblitLToT = (sbank: number, src:number, x: number, y: number, width: number, op : number) => 
{
  interleaved = memGetSoftSwitch(0xC01F) & 0x80 ? true : false
  
  console.log("hbltLtoT: " + src.toString(16) + " " + x + "," + y + " " + width)

  // clip x
  const maxwidth = (interleaved ? 80 : 40) - x;
  width = (width > maxwidth) ? maxwidth : width;

  let ypos = gettxtaddr(y,0);

  // clip y
  if (!ypos)
    return;

  if (interleaved )
  {
    // set up two fills, one for aux, one for main
    // 00 01 02 03 04 05 06 07
    // A0 M0 A1 M1 A2 M2 A3 M3
    //
    //    ** ** ** ** ** **
    //    X=1 Width=6
    //    ** ** ** ** **
    //    X=1 Width=5
    // ** ** ** ** ** ** **
    //    X=0 Width=7
    //       ** ** ** **
    //    X=2 Width=4
    //
    const state = x&1 | ((width&1) << 1)
    x >>= 1
    width >>= 1
    let astart = x
    let asrc = src
    let awidth = width
    let mstart = x
    let msrc = src
    let mwidth = width

    switch (state)
    {
      case 0x00: // X even, Width even
        msrc++
        break;

      case 0x02: // X even, Width odd
        awidth++
        msrc++
        break;

      case 0x01: // X odd, Width even
        astart++
        asrc++
        break;

      case 0x03: // X odd, Width odd
        astart++
        asrc++
        mwidth++
        break;
    }

    let pos = ypos + astart;
    // write aux
    memSetSoftSwitch(0xC005,0)
    while(awidth)
    {
      memSet(pos++, memGet(asrc))
      asrc += 2
      awidth--
    }
    pos = ypos + mstart;
    // write main
    memSetSoftSwitch(0xC004,0)
    while(mwidth)
    {
      memSet(pos++, memGet(msrc))
      msrc += 2
      mwidth--
    }
  }
  else
  {
    ypos += x
    while(width)
    {
      memSet(ypos++, memGet(src++));

      width--;
    }
  }
}

const blitLToT = (sbank: number, src:number, srcMod: number, dx: number, dy: number, width: number, height: number, op : number) => 
{
  interleaved = memGetSoftSwitch(0xC01F) & 0x80 ? true : false

  console.log("bltLtoT: " + src.toString(16) + " " + dx + "," + dy + " " + width + " " + height)

  // clip width
  const clip = dx + width
  const cmax = interleaved ? 80 : 40;
  if (clip > cmax)
  {
    srcMod += clip-cmax;
    width = (cmax+1)-dx;
  }

  while(height--)
  {
    hblitLToT(sbank, src, dx, dy, width, op)
    src += (width + srcMod);
    dy++;
  }
}

const hlineT = (x: number, y: number, width: number, value: number) =>
{
  interleaved = memGetSoftSwitch(0xC01F) & 0x80 ? true : false

  // clip x
  const maxwidth = (interleaved ? 80 : 40) - x;
  width = (width > maxwidth) ? maxwidth : width;

  let ypos = gettxtaddr(y,0);

  //cinterp.print("hl: y: %d (%02x) x: %d w: %d\n", y, ypos, x, width);

  // clip y
  if (!ypos)
    return;

  if (interleaved )
  {
    // set up two fills, one for aux, one for main
    // 00 01 02 03 04 05 06 07
    // A0 M0 A1 M1 A2 M2 A3 M3
    //
    //    ** ** ** ** ** **
    //    X=1 Width=6
    //    ** ** ** ** **
    //    X=1 Width=5
    // ** ** ** ** ** ** **
    //    X=0 Width=7
    //       ** ** ** **
    //    X=2 Width=4
    //
    const state = x&1 | ((width&1) << 1)
    x >>= 1
    width >>= 1
    let astart = x
    let awidth = width
    let mstart = x
    let mwidth = width

    switch (state)
    {
      case 0x00: // X even, Width even
        break;

      case 0x02: // X even, Width odd
        awidth = width+1
        break;

      case 0x01: // X odd, Width even
        astart = x+1
        break;

      case 0x03: // X odd, Width odd
        astart = x+1
        mwidth = width+1
        break;
    }

    let pos = ypos + astart;
    // write aux
    memSetSoftSwitch(0xC005,0)
    while(awidth)
    {
      memSet(pos++, value);
      awidth--;
    }
    pos = ypos + mstart;
    // write main
    memSetSoftSwitch(0xC004,0)
    while(mwidth)
    {
      memSet(pos++, value);
      mwidth--;
    }
  }
  else
  {
    while(width)
    {
      memSet(ypos + x, value);

      x++;
      width--;
    }
  }
}

const rectT = (x: number, y: number, width: number, height: number, value: number) => {
  while(height--)
  {
    hlineT(x, y+height-1, width, value);
  }
}

const ParseCmdBuffer = (buffer : Uint8Array) => {

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
      }
      break

      case CMD.SSRD: {
        let addr = buffer[pos++]
        readSS(addr)
      }
      break

      case CMD.SSWR: {
        let addr = buffer[pos++]
        writeSS(addr)
      }
      break

      case CMD.RECTT: {
        let value = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        let height = buffer[pos++]
        rectT(x, y, width, height, value)
      }
      break

      case CMD.HLINET: {
        let value = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        hlineT(x, y, width, value)
      }
      break

      case CMD.BLITLT: {
        let src = buffer[pos++]
        src += buffer[pos++] * 256
        let sbank = buffer[pos++]
        let smod = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        let height = buffer[pos++]
        let op = buffer[pos++]
        blitLToT(sbank, src, smod, x, y, width, height, op)
      }
      break

      case CMD.BLITLH: {
        let src = buffer[pos++]
        src += buffer[pos++] * 256
        let swid = buffer[pos++]
        let srcx = buffer[pos++]
        let x = buffer[pos++]
        let y = buffer[pos++]
        let width = buffer[pos++]
        let height = buffer[pos++]
        let op = buffer[pos++]
        blit(src, swid, srcx, x, y, width, height)
      }
      break

      case CMD.EXIT:
        return

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
          const pushBuffer = DMAPull(pushBufferAddr, val&0xff)
          ParseCmdBuffer(pushBuffer)
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
