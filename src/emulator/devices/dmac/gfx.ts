/* DMAC copyright(c) Michael Morrison (codebythepound@gmail.com) */

import { ROPTable } from "./ROPTable"
import { memGetSoftSwitch, memSetSoftSwitch, memGet, memSet } from "../../memory"

class SpriteHeader
{
  width: number;
  height: number;
  mode: number;
  id: number;
  data: Uint8Array;
};

class Rect
{
  x: number;
  y: number;
  width: number;
  height: number;
  xmax: number;
  ymax: number;
  xoff: number;
  yoff: number;
};

let gfxFramebuffer = new Uint8Array(140*192);
let txtFramebuffer = new Uint8Array(80*48);
let dmabuffer = new Uint8Array(80);
let spriteMem = new Uint8Array(128*1024);
let spriteHeaders: SpriteHeader[256];
let spriteid: number[256];
let nextSpriteId = 1;
let nextSpriteMem = 2;
const fbGWidth = 140;
const fbGHeight = 192;
const fbTWidth = 40;
const fbTHeight = 24;
let fbXPos = 0;
let fbYPos = 0;
let ScreenRect: Rect;

let framebuffer = gfxFramebuffer;
let fbWidth = fbGWidth;
let fbHeight = fbGHeight;
let vbits = 8;
let vmask = 0xff;
let bit8 = 0x80;
let rasterOp = 0x3;
let ccompOp = 0x0;
let ccompColor = 0x0;

let videoMode = 0;
let cycleCount = 0;

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

const getgfxaddr = (line:number, page:number) : number =>
{
    if (page)
      page = 0x4000
    else
      page = 0x2000

    if (line>191)
      return 0

    return page + (0x0028*Math.floor(line/64)) + (0x80*Math.floor(Math.floor(line%64)/8)) + (Math.floor(line%8)*0x400);
}

const CCOMP = (fb: number): boolean =>
{
  switch (ccompOp)
  {
    default: return false;
    case 1: return fb == ccompColor;
    case 2: return fb != ccompColor;
    case 3: return fb > ccompColor;
    case 4: return fb >= ccompColor;
    case 5: return fb < ccompColor;
    case 6: return fb <= ccompColor;
  }
}

const ROP = (fb: Uint8Array, off: number, sp: number): number =>
{
  const fbb = fb[off];
  const value = (fbb << 4) | sp & 0xf;
  fbb &= 0xf0;

  let upd = ROPTable[(rasterOp<<8)|value] & 0xf;

  // now check color compare
  if (!CCOMP(upd))
    fb[off] = fbb | upd;
}

const BearBits = new Uint8Array([
   0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,
   0x5,0x5,0x2,0x2,0x2,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x2,0x2,0x2,0x5,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x5,0x5,0x2,0x2,0x2,0x2,0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x5,
   0x5,0x5,0x5,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x2,0x5,0x5,0x5,
   0x5,0x5,0x2,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x2,0x2,0x5,0x5,
   0x5,0x5,0x2,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x2,0x2,0x5,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x5,
   0x5,0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x5,0x5,
   0x5,0x5,0x5,0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x5,0x5,0x5,0x5,
]);

const BearBits2 = new Uint8Array([
   0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,
   0x0,0x0,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x0,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x2,0x2,0x2,0x2,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,
   0x0,0x0,0x0,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x2,0x0,0x0,0x0,
   0x0,0x0,0x2,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x2,0x2,0x0,0x0,
   0x0,0x0,0x2,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x2,0x2,0x0,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,
   0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,
   0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,
   0x0,0x0,0x0,0x0,0x0,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x0,0x0,0x0,0x0,0x0,
]);

const AllocSprite = (width: number, height: number): number =>
{
  i=0;
  if (spriteid[nextSpriteId] == 0)
    i = nextSpriteId++;
  else
    while(spriteid[i] && i < 0xff) i++;

  if (i < 0xff)
  {
    spriteid[i] = nextSpriteMem;
    spriteHeaders[i].width = width;
    spriteHeaders[i].height = height;
    nextSpriteMem += (width * height);
  }

  // 0xff == error
  return i;
}

void DMAWrite(uint32_t dst, uint8_t * src, uint8_t inc, uint16_t len) 
{
  cycleCount+=len;
  uint8_t * dest = &memory[dst]; 
  for(int i=0;i<len;i++)
  {
    *dest++ = *src;
    src += inc; 
  }
}

Intersect(Rect result, Rect a, Rect b): boolean =>
{
  const x = Math::max(a.x, b.x);
  const num1 = Math::min(a.x + a.width, b.x + b.width);
  const y = Math::max(a.y, b.y);
  const num2 = Math::min(a.y + a.height, b.y + b.height);
  if (num1 >= x && num2 >= y)
  {
    result.x = x;
    result.y = y;
    result.width = num1 - x;
    result.height = num2 - y;
    // assumes A is always sprite, and B is always screen
    result.xoff = x - a.x;
    result.yoff = y - a.y;
    return true;
  }
  else
    return false;
}

struct Point 
{ 
  Point(int16_t x, int16_t y) :x(x), y(y) {} 
  void swap(Point& rhs) 
  { 
    rhs.x ^= x;
    x ^= rhs.x;
    rhs.x ^= x;
    rhs.y ^= y;
    y ^= rhs.y;
    rhs.y ^= y;
  }

  Point operator+(const Point & rhs) const
  {
    return Point( x + rhs.x, y + rhs.y );
  }

  Point operator-(const Point & rhs) const
  {
    return Point( x - rhs.x, y - rhs.y );
  }

  Point operator*(float rhs) const
  {
    return Point( (float)x * rhs, (float)y * rhs );
  }

  bool operator!=(const Point & rhs) const
  {
    return ( x != rhs.x ||  y != rhs.y );
  }

  int16_t x; 
  int16_t y;
};

const BPPMode =
{
  BPP_1: 1,
  BPP_2: 2,
  BPP_4: 4,
  BPP_8: 8
};

const Bit8Mode =
{
  BIT8_COPY: 0,
  BIT8_MASK: 1,
  BIT8_DATA: 2,
};

// match g() gfx modes
const ScrnMode =
{
  TXT40:  0,
  TXT80:  1,
  LGR40:  2,
  LGR40M: 3,
  LGR80:  4,
  LGR80M: 5,
  HGR40:  6,
  HGR40M: 7,
  HGR80:  8,
  HGR80M: 9
};

// THE EXTREMELY FAST LINE ALGORITHM Variation E (Addition Fixed Point PreCalc Small Display)
// Small Display (256x256) resolution.
const lLine = (Point& p0, Point& p1, uint8_t value) => void
{
 	let yLonger=false;
	let shortLen=p1.y-p0.y;
	let longLen=p1.x-p0.x;
	if (Math::abs(shortLen)>Math::abs(longLen))
  {
		let swap=shortLen;
		shortLen=longLen;
		longLen=swap;
		yLonger=true;
	}
	let decInc;
  let j;
  const shift = 7;
  const half = 1<<(shift-1);
	if (longLen==0)
    decInc=0;
	else 
    decInc = Math::floor((shortLen << shift) / longLen);

//  console.log(1,"yLonger: %s longLen: %d decInc: %d\n", yLonger?"true":"false", longLen, decInc);

	if (yLonger)
  {
		if (longLen>0)
    {
			longLen+=p0.y;
			for (j=half+(p0.x<<shift);p0.y<=longLen;++p0.y)
      {
				framebuffer[(j >> shift) + p0.y*fbWidth] = value;	
				j+=decInc;
			}
			return;
		}
		longLen+=p0.y;
		for (j=half+(p0.x<<shift);p0.y>=longLen;--p0.y)
    {
      framebuffer[(j >> shift) + p0.y*fbWidth] = value;	
			j-=decInc;
		}
		return;	
	}

	if (longLen>0)
  {
		longLen+=p0.x;
		for (j=half+(p0.y<<shift);p0.x<=longLen;++p0.x)
    {
			framebuffer[p0.x +(j >> shift)*fbWidth] = value;
			j+=decInc;
		}
		return;
	}
	longLen+=p0.x;
	for (j=half+(p0.y<<shift);p0.x>=longLen;--p0.x)
  {
    framebuffer[p0.x +(j >> shift)*fbWidth] = value;
		j-=decInc;
	}
}

static void
lHline(uint16_t x, uint16_t y, uint16_t width, uint8_t value, uint8_t mode)
{
  // clip against virtual FB values
  
  // clip
  if (y >= fbHeight || x >= fbWidth)
    return;
  // clip x
  uint16_t maxx = x + width;
  width = (maxx >= fbWidth) ? fbWidth - x : width;

  value &= vmask;

  // convert to byte position to start
  uint8_t * fb = &framebuffer[fbWidth * y + x];
  if (mode)
  {
    while (width--)
    {
      ROP(fb, value);
      fb++;
    }
  }
  else
  {
    while (width--)
      *fb++ = value;
  }
}

static void
lFRect(uint16_t x, uint16_t y, uint16_t width, uint16_t height, uint8_t value, uint8_t mode)
{
  Rect result;
  if (!Intersect(result, {x,y,width,height}, ScreenRect))
    return;

  while(result.height--)
  {
    lHline(result.x, result.y+result.height-1, result.width, value, mode);
  }
}

// NOTE: modified from here: https://github.com/ssloy/tinyrenderer/wiki/Lesson-2:-Triangle-rasterization-and-back-face-culling
void
lTriangle(Point& p0, Point& p1, Point& p2, uint8_t value)
{
  if (p0.y==p1.y && p0.y==p2.y) 
  {
    return; // skip degenerates
  }

  // sort the vertices, p0, p1, p2 lower−to−upper (bubblesort yay!) 
  if (p0.y>p1.y) p0.swap(p1); 
  if (p0.y>p2.y) p0.swap(p2); 
  if (p1.y>p2.y) p1.swap(p2); 

  int total_height = p2.y-p0.y; 
  int l=-1;
  for (int i=0; i<total_height; i++) 
  {
      bool second_half = i>p1.y-p0.y || p1.y==p0.y; 
      int segment_height = second_half ? p2.y-p1.y : p1.y-p0.y; 
      float alpha = (float)i/total_height; 
      float beta  = (float)(i-(second_half ? p1.y-p0.y : 0))/segment_height; // be careful: with above conditions no division by zero here 
      Point A =               p0 + (p2-p0)*alpha; 
      Point B = second_half ? p1 + (p2-p1)*beta : p0 + (p1-p0)*beta; 
      if (A.x>B.x) 
        A.swap(B); 
      // hack - not sure why
      //if (l==A.y)
      //{
      //  A.y++;
     // }
      //l = A.y;

      lHline( A.x, A.y, B.x-A.x, value,0 );
  }
}

enum RenderMode
{
};

static void
spriteCopy(SpriteHeader * sprite, uint16_t x, uint16_t y, uint8_t mode)
{
  uint8_t * fb = framebuffer;
  uint8_t * sp = sprite->data;

  Rect result;
  if (!Intersect(result, {x,y,sprite->width,sprite->height}, ScreenRect))
  {
    cinterp.log(1,"sprite off screen\n");
    return;
  }

  cinterp.log(1,"sprite rect: %d,%d %d,%d\n", result.x, result.y, result.width, result.height);
  cinterp.log(1,"sprite offs: %d,%d\n", result.xoff, result.yoff);

  // take UL clipping into account
  sp += result.xoff;
  if (result.yoff)
    sp += (result.yoff * sprite->width);

  fb += fbWidth * (y + result.yoff) + x + result.xoff;
  sp += result.yoff * sprite->width + result.xoff;

  switch(mode)
  {
    //opaque
    case 0:
    for(uint16_t i=0;i<result.height;i++)
    {
      memcpy(fb, sp, result.width);
      fb += fbWidth;
      sp += sprite->width;
    }
    break;

    //zero transparent
    case 1:
    {
      uint16_t scw = fbWidth-result.width;
      uint16_t spw = sprite->width-result.width;
      for(uint16_t i=0;i<result.height;i++)
      {
        for(uint16_t j=0;j<result.width;j++)
        {
          if (*sp)
            *fb = *sp;
          fb++;
          sp++;
        }
        fb += scw;
        sp += spw;
      }
    }
    break;

    // ROP
    case 2:
    {
      uint16_t scw = fbWidth-result.width;
      uint16_t spw = sprite->width-result.width;
      for(uint16_t i=0;i<result.height;i++)
      {
        for(uint16_t j=0;j<result.width;j++)
        {
          ROP(fb,*sp);
          fb++;
          sp++;
        }
        fb += scw;
        sp += spw;
      }
    }
    break;
  }
}

JSValue
cmdROP(JS_ARGS)
{
  long rop = xstrtol(argv[0], nullptr, 16);
  rasterOp = rop;

  return JS_TRUE;
}

JSValue
cmdCComp(JS_ARGS)
{
  long rop = xstrtol(argv[0], nullptr, 16);
  long color = xstrtol(argv[1], nullptr, 16);

  ccompOp = rop;
  ccompColor = color;

  return JS_TRUE;
}

JSValue
cmdLBlt(JS_ARGS)
{
  long id      = xstrtol(argv[0], nullptr, 16);
  long destx   = xstrtol(argv[1], nullptr, 16);
  long desty   = xstrtol(argv[2], nullptr, 16);
  long mode    = xstrtol(argv[3], nullptr, 16);

  uint32_t mem = spriteid[id];
  if (mem)
  {
    SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
    spriteCopy(sprite, destx, desty, mode);

    return JS_TRUE;
  }
  else
  {
    cinterp.log(1,"sprite id %d not found\n", id);
  }

  return JS_FALSE;
}

JSValue
cmdLSBlt(JS_ARGS)
{
  long id      = xstrtol(argv[0], nullptr, 16);
  long srcx    = xstrtol(argv[1], nullptr, 16);
  long srcy    = xstrtol(argv[2], nullptr, 16);
  long width   = xstrtol(argv[3], nullptr, 16);
  long height  = xstrtol(argv[4], nullptr, 16);
  long destx   = xstrtol(argv[5], nullptr, 16);
  long desty   = xstrtol(argv[6], nullptr, 16);
  long mode    = xstrtol(argv[7], nullptr, 16);

  return JS_TRUE;
}

JSValue
cmdLUploadSprite(JS_ARGS)
{
  long srcAddr = xstrtol(argv[0], nullptr, 16);
  long width   = xstrtol(argv[1], nullptr, 16);
  long height  = xstrtol(argv[2], nullptr, 16);
  long mode    = xstrtol(argv[3], nullptr, 16);

  uint8_t id = AllocSprite(width, height);
  if (id != 0xff)
  {
    uint32_t mem = spriteid[id];
    SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
    sprite->width = width;
    sprite->height = height;
    sprite->mode = mode;
    sprite->id = id;
    // DMARead..
    memcpy(sprite->data, &memory[srcAddr], width*height);
  }

  return JS_NewInt32(ctx, (int32_t)id);
}

JSValue
cmdLFRect(JS_ARGS)
{
  long destx   = xstrtol(argv[0], nullptr, 16);
  long desty   = xstrtol(argv[1], nullptr, 16);
  long width   = xstrtol(argv[2], nullptr, 16);
  long height  = xstrtol(argv[3], nullptr, 16);
  uint8_t value= (uint8_t)xstrtol(argv[4], nullptr, 16);
  uint8_t mode = (uint8_t)xstrtol(argv[5], nullptr, 16);

  lFRect(destx, desty, width, height, value, mode);

  return JS_TRUE;
}

static void
Clear()
{
  memset(framebuffer, 0x00, fbWidth * fbHeight);
}

static void
SetBits(uint16_t bits)
{
  switch(bits)
  {
    default:
    case 1:
      vbits = 1;
      vmask = 0x01;
      break;
    case 2:
      vbits = 2;
      vmask = 0x03;
      break;
    case 4:
      vbits = 4;
      vmask = 0x0f;
      break;
    case 8:
      vbits = 8;
      vmask = 0xff;
      break;
  }
}

JSValue
cmdSetBits(JS_ARGS)
{
  uint16_t bits = (int16_t)xstrtol(argv[0], nullptr, 0);

  SetBits(bits);

  return JS_TRUE;
}

static JSValue
cmdHLine(JS_ARGS)
{
  uint16_t x = (int16_t)xstrtol(argv[0], nullptr, 0);
  uint16_t y = (int16_t)xstrtol(argv[1], nullptr, 0);
  uint8_t width = (uint8_t)xstrtol(argv[2], nullptr, 0);
  uint8_t value = (uint8_t)xstrtol(argv[3], nullptr, 0);

  lHline(x,y,width,value,0);

  return JS_TRUE;
}

static JSValue
cmdLine(JS_ARGS)
{
  Point p0((int16_t)xstrtol(argv[0], nullptr, 0),
           (int16_t)xstrtol(argv[1], nullptr, 0));
  Point p1((int16_t)xstrtol(argv[2], nullptr, 0),
           (int16_t)xstrtol(argv[3], nullptr, 0));
  uint8_t value = (uint8_t)xstrtol(argv[4], nullptr, 0);

  lLine(p0,p1,value);

  return JS_TRUE;
}

static JSValue
cmdLine2(JS_ARGS)
{
  Point p0((int16_t)xstrtol(argv[0], nullptr, 0),
           (int16_t)xstrtol(argv[1], nullptr, 0));
  Point p1((int16_t)xstrtol(argv[2], nullptr, 0),
           (int16_t)xstrtol(argv[3], nullptr, 0));
  uint8_t value = (uint8_t)xstrtol(argv[4], nullptr, 0);

  eflaLine(p0,p1,value);

  return JS_TRUE;
}

// NOTE: modified from here: https://github.com/ssloy/tinyrenderer/wiki/Lesson-2:-Triangle-rasterization-and-back-face-culling
static JSValue
cmdTriangle(JS_ARGS)
{
  Point p0(xstrtol(argv[0], 0, 0),
           xstrtol(argv[1], 0, 0));
  Point p1(xstrtol(argv[2], 0, 0),
           xstrtol(argv[3], 0, 0));
  Point p2(xstrtol(argv[4], 0, 0),
           xstrtol(argv[5], 0, 0));
  uint8_t value = (uint8_t)xstrtol(argv[6], nullptr, 0);

  lTriangle(p0,p1,p2,value);

  return JS_TRUE;
}

static JSValue
cmdTexPoly(JS_ARGS)
{
  TPoint polyVerts[4];
  TPoint texCoords[4];
  PointListHeader poly = { 0, polyVerts };

  int j=0;
  poly.Length = xstrtol(argv[j++],0,0);
  for(int i=0;i<poly.Length;i++)
  {
    polyVerts[i].X = xstrtol(argv[j++],0,0);
    polyVerts[i].Y = xstrtol(argv[j++],0,0);
  }
  for(int i=0;i<poly.Length;i++)
  {
    texCoords[i].X = xstrtol(argv[j++],0,0);
    texCoords[i].Y = xstrtol(argv[j++],0,0);
  }

  DrawTexturedPolygon(&poly, texCoords, nullptr);

  return JS_TRUE;
}

static JSValue
cmdFillPoly(JS_ARGS)
{
  TPoint polyVerts[4];
  PointListHeader poly = { 0, polyVerts };

  int j=0;
  uint8_t color = xstrtol(argv[j++],0,0);
  poly.Length = xstrtol(argv[j++],0,0);

  for(int i=0;i<poly.Length;i++)
  {
    polyVerts[i].X = xstrtol(argv[j++],0,0);
    polyVerts[i].Y = xstrtol(argv[j++],0,0);
  }

  DrawFilledPolygon(&poly, color);

  return JS_TRUE;
}

JSValue
presentText40(uint16_t page)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    DMAWrite(gettxtaddr(y,page), fb, 1, 40);
    fb += 40;
  }

  return JS_TRUE;
}

JSValue
presentGr40(uint16_t page, bool mix)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    for(uint16_t x=0;x<40;x++)
    {
      dmabuffer[x] = (fb[x] & 0xf) | (fb[x+40] << 4);
    }

    DMAWrite(gettxtaddr(y,page), dmabuffer, 1, 40);
    fb += 80;
  }

  return JS_TRUE;
}

JSValue
presentText80(uint16_t page)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    DMAWrite(0x10000 + gettxtaddr(y,page), fb, 2, 40);
    DMAWrite(gettxtaddr(y,page), fb+1, 2, 40);
    fb += 80;
  }

  return JS_TRUE;
}

JSValue
presentGr80(uint16_t page, bool mix)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    for(uint16_t x=0;x<80;x++)
    {
      dmabuffer[x] = (fb[x] & 0xf) | (fb[x+80] << 4);
    }

    DMAWrite(0x10000 + gettxtaddr(y,page), dmabuffer, 2, 40);
    DMAWrite(gettxtaddr(y,page), dmabuffer+1, 2, 40);
    fb += 160;
  }

  return JS_TRUE;
}

JSValue
presentHgr40(uint16_t page, bool mix)
{
  uint8_t * fb = framebuffer;
  uint16_t maxy = mix ? 192-(5*8) : 192;
  int16_t p;
  uint16_t offset;
  for(uint16_t y=0;y<maxy;y++)
  {
    offset = 0;
    for(unsigned short i=0; i<140; i+=7)
    {
      // build a short filled with 7 pixels
      //
      // FEDCBA9876543210
      //   66554433221100
      unsigned short pixel = 0;
      unsigned char palette = 0;
      for(p=6;p>=0;p--)
      {
        pixel <<= 2;
        pixel |= (fb[i+p] & 3);
      }

      // set palette bits!!
      palette = 0;

      // now shift it out to real pixels
      for(p=0;p<2;p++)
      {
        dmabuffer[offset++] = (pixel & 0x7f) | palette;
        pixel >>= 7;
      }
    }
    DMAWrite(getgfxaddr(y,page), dmabuffer, 1, 40);
    fb += 140;
  }

  return JS_TRUE;
}

JSValue
presentHgr80(uint16_t page, bool mix)
{
  uint8_t * fb = framebuffer;
  uint16_t maxy = mix ? 192-(5*8) : 192;
  int16_t p;
  uint16_t offset;
  for(uint16_t y=0;y<maxy;y++)
  {
    offset = 0;
    for(unsigned short i=0; i<140; i+=7)
    {
      // build a dword filled with 7 pixels
      //
      // FEDCBA9876543210FEDCBA9876543210
      //     6666555544443333222211110000
      unsigned long pixel = 0;
      unsigned char palette = 0;
      for(p=6;p>=0;p--)
      {
        pixel <<= 4;
        pixel |= (fb[i+p] & 0xf);
      }

      // set palette bits!!
      palette = 0;

      // now shift it out to real pixels
      for(p=0;p<4;p++)
      {
        dmabuffer[offset++] = (pixel & 0x7f) | palette;
        pixel >>= 7;
      }
    }
    // first aux
    DMAWrite(0x10000 + getgfxaddr(y,page), dmabuffer, 2, 40);
    // second main
    DMAWrite(getgfxaddr(y,page), dmabuffer+1, 2, 40);
    fb += 140;
  }

  return JS_TRUE;
}

JSValue
cmdPresent(JS_ARGS)
{
  uint16_t page = (int16_t)xstrtol(argv[0], nullptr, 0);

  // (0=40 1=80 2=lo 3=lowmix 4=dlo 5=dlomix 6=hi 7=himix 8=dhi 9=dhimix)",
  switch( videoMode )
  {
    case 0:
      return presentText40(page);
    case 2:
      return presentGr40(page,false);
    case 3:
      return presentGr40(page,true);

    case 1:
      return presentText80(page);
    case 4:
      return presentGr80(page,false);
    case 5:
      return presentGr80(page,true);

    case 6:
      return presentHgr40(page, false);
    case 7:
      return presentHgr40(page, true);
    case 8:
      return presentHgr80(page, false);
    case 9:
      return presentHgr80(page, true);
    default:
      return JS_TRUE;
  }
}

JSValue
cmdLScreenOffset(JS_ARGS)
{
  uint16_t xoff = (int16_t)xstrtol(argv[0], nullptr, 0);
  uint16_t yoff = (int16_t)xstrtol(argv[1], nullptr, 0);

  ScreenRect.x = fbXPos = xoff;
  ScreenRect.y = fbYPos = yoff;
  ScreenRect.xmax = xoff + ScreenRect.width;
  ScreenRect.ymax = yoff + ScreenRect.height;

  return JS_TRUE;
}


JSValue
cmdSetMode(JS_ARGS)
{
  uint16_t videoMode = (int16_t)xstrtol(argv[0], nullptr, 0);
  uint16_t clear = (int16_t)xstrtol(argv[1], nullptr, 0);

  // (0=40 1=80 2=lo 3=lowmix 4=dlo 5=dlomix 6=hi 7=himix 8=dhi 9=dhimix)",
  switch( videoMode )
  {
    case 0:
      fbWidth = 40;
      fbHeight = 24;
      framebuffer = txtFramebuffer;
      SetBits(8);
      break;

    case 1:
      fbWidth = 80;
      fbHeight = 24;
      framebuffer = txtFramebuffer;
      SetBits(8);
      break;

    case 2:
      fbWidth = 40;
      fbHeight = 48;
      framebuffer = txtFramebuffer;
      SetBits(4);
      break;

    case 3:
      fbWidth = 40;
      fbHeight = 43;
      framebuffer = txtFramebuffer;
      SetBits(4);
      break;

    case 4:
      fbWidth = 80;
      fbHeight = 48;
      framebuffer = txtFramebuffer;
      SetBits(4);
      break;

    case 5:
      fbWidth = 80;
      fbHeight = 43;
      framebuffer = txtFramebuffer;
      SetBits(4);
      break;

    case 6:
      fbWidth = 140;
      fbHeight = 192;
      framebuffer = gfxFramebuffer;
      SetBits(2);
      break;

    case 7:
      fbWidth = 140;
      fbHeight = 152;
      framebuffer = gfxFramebuffer;
      SetBits(2);
      break;

    case 8:
      fbWidth = 140;
      fbHeight = 192;
      framebuffer = gfxFramebuffer;
      SetBits(4);
      break;

    case 9:
      fbWidth = 140;
      fbHeight = 152;
      framebuffer = gfxFramebuffer;
      SetBits(4);
      break;

    default:
      return JS_TRUE;
  }

  ScreenRect.x = fbXPos;
  ScreenRect.y = fbYPos;
  ScreenRect.xoff = ScreenRect.yoff = 0;
  ScreenRect.width = fbWidth;
  ScreenRect.height = fbHeight;
  ScreenRect.xmax = ScreenRect.x + ScreenRect.width;
  ScreenRect.ymax = ScreenRect.y + ScreenRect.height;

  if (clear)
    Clear();

  return JS_TRUE;
}

// P0011223 P3445566
// P3221100 P6655443

void addLinearCommands(CommandInterp* interp)
{
  interp->addCommand(new Command("loff", "Screen rectangle Offset (xoff,yoff)",
                                  2, BIND_FUNCTION(cmdLScreenOffset)));
  interp->addCommand(new Command("lsetMode", "(Mode, Clear) Set virtual video mode (0=40 1=80 2=lo 3=lowmix 4=dlo 5=dlomix 6=hi 7=himix 8=dhi 9=dhimix) (0/1 clear)",
                                  2, BIND_FUNCTION(cmdSetMode)));
  interp->addCommand(new Command("lsetBits", "Set bit representation ([1,2,4,8] bits per write)",
                                  1, BIND_FUNCTION(cmdSetBits)));
  interp->addCommand(new Command("lpresent", "DMA internal FB to system (0/1 page)",
                                  1, BIND_FUNCTION(cmdPresent)));
  interp->addCommand(new Command("lline", "Draw EFLA Line (x0,y0,x1,y1,value)",
                                  5, BIND_FUNCTION(cmdLine)));
  interp->addCommand(new Command("lline2", "Draw EFLA2 Line (x0,y0,x1,y1,value)",
                                  5, BIND_FUNCTION(cmdLine2)));
  interp->addCommand(new Command("lhline", "Draw Horiz Line (x0,y0,width,value)",
                                  4, BIND_FUNCTION(cmdHLine)));
  interp->addCommand(new Command("lfrect", "Draw Filled Rect (x0,y0,width,height,value,mode)",
                                  6, BIND_FUNCTION(cmdLFRect)));
  interp->addCommand(new Command("ltri", "Draw Filled Tri (x0,y0,x1,y1,x2,y2,value)",
                                  7, BIND_FUNCTION(cmdTriangle)));
  interp->addCommand(new Command("lblt", "Blit (spriteid,destx,desty,mode)",
                                  4, BIND_FUNCTION(cmdLBlt)));
  interp->addCommand(new Command("lsblt", "SubBlit (spriteid,srcx,srcy,width,height,destx,desty,mode)",
                                  8, BIND_FUNCTION(cmdLSBlt)));
  interp->addCommand(new Command("lups", "Define & Upload Sprite (srcAddr,width,height,mode) returns spriteid",
                                  4, BIND_FUNCTION(cmdLUploadSprite)));
  interp->addCommand(new Command("texpoly", "Draw textured poly (NumPts, NumPts*[x,y], NumPts*[u,v])",
                                  7, BIND_FUNCTION(cmdTexPoly)));
  interp->addCommand(new Command("fillpoly", "Draw filled poly (color, NuMPts, NumPts*[x,y])",
                                  5, BIND_FUNCTION(cmdFillPoly)));
  interp->addCommand(new Command("rop", "Set Raster Op (func_index)",
                                  1, BIND_FUNCTION(cmdROP)));
  interp->addCommand(new Command("ccomp", "Set Color Compare (func_index, color)",
                                  1, BIND_FUNCTION(cmdCComp)));

  uint8_t id = AllocSprite(20,20);
  interp->log(1,"default sprite: %d\n", id);
  uint32_t mem = spriteid[id];
  SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
  sprite->width = 20;
  sprite->height = 20;
  sprite->mode = 0;
  sprite->id = id;
  // DMARead..
  memcpy(sprite->data, BearBits, 20*20);

  id = AllocSprite(20,20);
  interp->log(1,"default sprite2: %d\n", id);
  mem = spriteid[id];
  sprite = (SpriteHeader*)&spriteMem[mem];
  sprite->width = 20;
  sprite->height = 20;
  sprite->mode = 1;
  sprite->id = id;
  // DMARead..
  memcpy(sprite->data, BearBits2, 20*20);
}

/*
      0            0     AB = (Bx-Ax),(By-Ay),0
   -Z |         -Z |     BA = (Ax-Bx),(Ay-By),0
     \|           \|     
      B------------A     ZnA = (Ax,Ay,-1)
      |\           |\    ZpA = (Ax,Ay,1) 
      | Z          | Z   
      0            0     PpA = -(-1)
*/

