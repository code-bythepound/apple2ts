// DMAC Card for Apple2TS copyright Michael Morrison (codebythepound@gmail.com)

import { memGetSoftSwitch, memSetSoftSwitch, memGet, memSet } from "../../memory"

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

let interleaved = false

export const hblitLToT = (sbank: number, src:number, x: number, y: number, width: number, op : number) => 
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

export const blitLToT = (sbank: number, src:number, srcMod: number, dx: number, dy: number, width: number, height: number, op : number) => 
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

export const hlineT = (x: number, y: number, width: number, value: number) =>
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

export const rectT = (x: number, y: number, width: number, height: number, value: number) => {
  while(height--)
  {
    hlineT(x, y+height-1, width, value);
  }
}
