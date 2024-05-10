
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>
#include <functional>
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <algorithm>
#ifdef TST_HARNESS
#include "xsharp21/texpoly.h"
#define LOG cinterp.log
#else
#define LOG(n,...) { if(n > 0) printf(__VA_ARGS__); }
#endif
//#include "shifttab.h"
//#include "ROPTable.h"
#include "a2font.h"
#include "ibmfont.h"

#include <emscripten/emscripten.h>

#define EXPORT extern "C" EMSCRIPTEN_KEEPALIVE

struct SpriteHeader
{
  uint8_t width;
  uint8_t height;
  uint8_t mode;
  uint8_t id;
  uint8_t data[0];
};

struct Rect
{
  Rect()
    :x(0), y(0), width(0), height(0)
    ,xmax(0), ymax(0)
    ,xoff(0), yoff(0)
  {
  }
  Rect(uint16_t xx, uint16_t yy, uint16_t w, uint16_t h)
    :x(xx), y(yy), width(w), height(h)
    ,xmax(xx+w), ymax(yy+h)
    ,xoff(0), yoff(0)
  {
  }
  void position(uint16_t xx, uint16_t yy)
  {
    x = xx;
    y = yy;
    xmax = xx + width;
    ymax = yy + height;
  }
  uint16_t x;
  uint16_t y;
  uint16_t width;
  uint16_t height;
  uint16_t xmax;
  uint16_t ymax;
  uint16_t xoff;
  uint16_t yoff;
};

static uint8_t gfxFramebuffer[140*192];
static uint8_t txtFramebuffer[80*48];
static uint8_t dmabuffer[80];
static uint8_t spriteMem[128*1024];
static uint32_t spriteid[256] = {0};
static uint8_t  nextSpriteId = 1;
static uint32_t nextSpriteMem = 2;
static uint16_t fbGWidth = 140;
static uint16_t fbGHeight = 192;
static uint16_t fbTWidth = 40;
static uint16_t fbTHeight = 24;
static uint16_t fbXPos = 0;
static uint16_t fbYPos = 0;
static Rect ScreenRect;
static uint32_t frame = 0;

static uint8_t * framebuffer = gfxFramebuffer;
static uint16_t fbWidth = fbGWidth;
static uint16_t fbHeight = fbGHeight;
static uint8_t vbits = 8;
static uint8_t vmask = 0xff;
static uint8_t bit8 = 0x80;
static uint8_t rasterOp = 0x3;
static uint8_t ccompOp = 0x0;
static uint8_t ccompColor = 0x0;
static uint8_t primaryFontBits[8*256];
static uint8_t secondaryFontBits[8*256];
static uint8_t ibmFontBits[8*256];
static uint32_t biFontWidth = 6;
static uint32_t biFontHeight = 8;

// bit reverse table for 4 bits
uint8_t bitrev[16] = 
{
  0b00000000,
  0b00001000,
  0b00000100,
  0b00001100,
  0b00000010,
  0b00001010,
  0b00000110,
  0b00001110,
  0b00000001,
  0b00001001,
  0b00000101,
  0b00001101,
  0b00000011,
  0b00001011,
  0b00000111,
  0b00001111,
};

// default palette is bit reverse table entries
#define MAX_PALETTE_STACK 16
uint8_t paletteStack[MAX_PALETTE_STACK][16] =
{
  {
    0b00000000,
    0b00001000,
    0b00000100,
    0b00001100,
    0b00000010,
    0b00001010,
    0b00000110,
    0b00001110,
    0b00000001,
    0b00001001,
    0b00000101,
    0b00001101,
    0b00000011,
    0b00001011,
    0b00000111,
    0b00001111,
  }
};
uint8_t *palette = paletteStack[0];
uint8_t paletteStackPtr = 0;

void pushPalette()
{
  if (paletteStackPtr < (MAX_PALETTE_STACK-1))
    paletteStackPtr++;
  
  palette = paletteStack[paletteStackPtr];
}

void popPalette()
{
  if (paletteStackPtr > 0)
    paletteStackPtr--;

  palette = paletteStack[paletteStackPtr];
}

void loadPalette(uint8_t * newpal)
{
  for(int i=0;i<16;i++)
    palette[i] = bitrev[newpal[i]&0xf];
}

//uint8_t memory[65536*2];
static int videoMode;
static int cycleCount;

#ifdef TST_HARNESS
extern CommandInterp cinterp;
extern long _strtol(JSContext *ctx, JSValue jsv, void * ptr, int base);
#define xstrtol(a,b,c) _strtol(ctx,(a),(b),(c))
#endif

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
    // round
    return Point( floorf(((float)x * rhs)+0.5f), floorf(((float)y * rhs)+0.5f) );
  }

  bool operator!=(const Point & rhs) const
  {
    return ( x != rhs.x ||  y != rhs.y );
  }

  int16_t x; 
  int16_t y;
};

inline void colorExpandByte(uint8_t byte, uint8_t fore, uint8_t back, uint8_t *result)
{
    result[0] = byte & 0x80 ? fore : back;
    result[1] = byte & 0x40 ? fore : back;
    result[2] = byte & 0x20 ? fore : back;
    result[3] = byte & 0x10 ? fore : back;
    result[4] = byte & 0x08 ? fore : back;
    result[5] = byte & 0x04 ? fore : back;
    result[6] = byte & 0x02 ? fore : back;
    result[7] = byte & 0x01 ? fore : back;
}

// taken from bithacks website
static const uint8_t BitReverseTable256[256] = 
{
#   define R2(n)     n,     n + 2*64,     n + 1*64,     n + 3*64
#   define R4(n) R2(n), R2(n + 2*16), R2(n + 1*16), R2(n + 3*16)
#   define R6(n) R4(n), R4(n + 2*4 ), R4(n + 1*4 ), R4(n + 3*4 )
    R6(0), R6(2), R6(1), R6(3)
};

static
void createFont()
{
  // create font bitmap from chargen dump
  unsigned char * indata = a2chars;
  uint8_t * pri = primaryFontBits;
  uint8_t * sec = secondaryFontBits;

  for(int i=0;i<8*256;i++)
    // clear high bit before reversing
    indata[i] = BitReverseTable256[indata[i]&0x7f];

  // put into 16x16 array, or 128x128
  for( int r = 0; r < 16*8; r++ )
  {
    for( int c = 0; c < 16; c++ )
    {
      // flip bits
      sec[r*16+c] = ~indata[(r/8*15*8)+r+c*8];
    }
  }

  // copy sec to pri
  memcpy( pri, sec, 8*256 );
  // copy first 0x40 inv chars to second 0x40 chars, in place of flashing
  memcpy( &pri[8*0x40], pri, 8*0x40 );

  // now ibmfont
  indata = ibmfont;
  pri = ibmFontBits;

  // put into 16x16 array, or 128x128
  for( int r = 0; r < 16*8; r++ )
  {
    for( int c = 0; c < 16; c++ )
    {
      pri[r*16+c] = indata[(r/8*15*8)+r+c*8];
    }
  }
}

uint16_t getgfxaddr(uint8_t line, uint16_t page)
{
    if (page)
      page = 0x4000;
    else
      page = 0x2000;

    if (line>191)
      return 0;

    return page + (0x0028*(line/64)) + (0x80*((line%64)/8)) + ((line%8)*0x400);
}

uint16_t gettxtaddr(uint8_t line, uint16_t page)
{
    if (page)
      page = 0x800;
    else
      page = 0x400;

    if (line>23)
      return 0;

    uint16_t a = line >> 3; // div 8
    uint16_t b = line & 7; // mod 8
    uint16_t addr = page + 0x80*b + 0x28*a;
    //cinterp.log(2,"text addr: %04x\n", addr);
    return addr;
}


inline bool CCOMP(uint8_t fb)
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

#if 0
inline void ROP(uint8_t *fb, uint8_t sp)
{
  uint8_t fbb = *fb;
  uint8_t value = (fbb << 4) | sp & 0xf;
  fbb &= 0xf0;

  uint8_t upd = ROPTable[rasterOp][value] & 0xf;

  // now check color compare
  if (!CCOMP(upd))
    *fb = fbb | upd;
}
#endif

uint8_t doROP(uint8_t fb, uint8_t sp)
{
  switch(rasterOp)
  {
    default:
    case 0x00:
      return 0;
    case 0x01:
      return 0xf;

    case 0x02:
      return (sp&0xf);
    case 0x03:
      return (~sp&0xf);
    case 0x04:
      return (fb&0xf);
    case 0x05:
      return (~fb&0xf);

    case 0x06:
      return ((fb&sp)&0xf);
    case 0x07:
      return ((~fb&sp)&0xf);
    case 0x08:
      return ((fb&~sp)&0xf);
    case 0x09:
      return ((~fb&~sp)&0xf);

    case 0x0a:
      return ((fb|sp)&0xf);
    case 0x0b:
      return ((~fb|sp)&0xf);
    case 0x0c:
      return ((fb|~sp)&0xf);
    case 0x0d:
      return ((~fb|~sp)&0xf);

    case 0x0e:
      return ((fb^sp)&0xf);
    case 0x0f:
      return ((~fb^sp)&0xf);
    case 0x10:
      return ((fb^~sp)&0xf);
    case 0x11:
      return ((~fb^~sp)&0xf);

    case 0x12:
      // max
      sp&=0xf;
      fb&=0xf;
      return (sp>fb)?sp:fb;
    case 0x13:
      // min
      sp&=0xf;
      fb&=0xf;
      return (sp>fb)?fb:sp;
    case 0x14:
      // avg
      sp&=0xf;
      fb&=0xf;
      return (((fb+sp)>>1));
    case 0x15:
      // add with ceil
      sp&=0xf;
      fb&=0xf;
      sp = sp+fb;
      return (sp>0xf)?0xf:sp;
    case 0x16:
      // fb-sp with floor
      sp&=0xf;
      fb&=0xf;
      return (sp>fb)?0x0:(fb-sp);
    case 0x17:
      // sb-fp with floor
      sp&=0xf;
      fb&=0xf;
      return (fb>sp)?0x0:(sp-fb);
  }
}

inline void ROP(uint8_t *fb, uint8_t sp)
{
  uint8_t fbb = *fb;
  uint8_t upd = doROP(fbb, sp);

  // now check color compare
  if (!CCOMP(upd))
    *fb = (fbb&0xf0) | upd;
}

uint8_t BearBits[] = {
   0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,
   0x5,0x5,0x2,0x2,0x2,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x2,0x2,0x2,0x5,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x5,0x5,0x2,0x2,0x2,0x2,0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,
   0x5,0x5,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x2,0x5,0x5,
   0x5,0x5,0x5,0x2,0x2,0x2,0x3,0x3,0x3,0x2,0x2,0x4,0x4,0x4,0x2,0x2,0x2,0x5,0x5,0x5,
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
};

uint8_t BearBits2[] = {
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
};

// 18x21
uint8_t PacManBits0[] = {
	5,5,5,5,5,5,0,0,0,0,0,5,5,5,5,5,5,5,
	5,5,5,5,0,0,7,7,7,7,7,0,0,5,5,5,5,5,
	5,5,5,0,7,7,0,0,7,0,0,7,7,0,5,5,5,5,
	5,5,5,0,7,7,7,0,7,0,7,7,7,0,5,5,5,5,
	5,5,0,7,7,7,0,0,7,0,0,7,7,0,0,5,0,5,
	5,5,0,7,7,7,7,7,7,7,7,0,7,7,0,0,3,0,
	5,5,0,0,7,0,0,0,7,7,0,7,7,7,0,0,3,0,
	5,5,0,7,0,0,7,7,0,0,7,7,7,7,0,3,3,0,
	5,5,0,7,0,7,7,7,7,7,0,7,7,7,0,0,0,5,
	5,5,0,0,3,0,7,7,7,7,7,7,7,0,5,5,5,5,
	5,0,3,3,3,0,7,0,0,7,7,7,7,0,5,5,5,5,
	5,5,0,3,3,0,0,7,7,0,7,0,0,5,5,5,5,5,
	5,5,0,3,3,0,7,7,0,0,0,5,5,5,5,5,5,5,
	5,5,5,0,0,0,0,0,3,3,3,0,0,5,5,5,5,5,
	5,5,0,3,0,7,7,0,3,3,3,3,3,0,5,5,5,5,
	5,0,3,3,0,7,0,5,0,3,3,0,0,0,5,5,5,5,
	0,3,3,3,3,0,5,5,0,3,0,0,0,5,5,5,5,5,
	0,3,3,0,0,5,5,5,5,0,0,0,5,5,5,5,5,5,
	0,3,3,3,0,5,5,5,5,5,5,5,5,5,5,5,5,5,
	5,0,3,3,0,5,5,5,5,5,5,5,5,5,5,5,5,5,
	5,5,0,0,5,5,5,5,5,5,5,5,5,5,5,5,5,5
	};

// 18x42
uint8_t PacManBits1[] = {
	128,128,128,128,128,128,0,0,0,0,0,128,128,128,128,128,128,128,
	128,128,128,128,128,128,0,0,0,0,0,128,128,128,128,128,128,128,
	128,128,128,128,0,0,7,7,7,7,7,0,0,128,128,128,128,128,
	128,128,128,128,0,0,7,7,7,7,7,0,0,128,128,128,128,128,
	128,128,128,0,7,7,0,0,7,0,0,7,7,0,128,128,128,128,
	128,128,128,0,7,7,0,0,7,0,0,7,7,0,128,128,128,128,
	128,128,128,0,7,7,7,0,7,0,7,7,7,0,128,128,128,128,
	128,128,128,0,7,7,7,0,7,0,7,7,7,0,128,128,128,128,
	128,128,0,7,7,7,0,0,7,0,0,7,7,0,0,128,0,128,
	128,128,0,7,7,7,0,0,7,0,0,7,7,0,0,128,0,128,
	128,128,0,7,7,7,7,7,7,7,7,0,7,7,0,0,3,0,
	128,128,0,7,7,7,7,7,7,7,7,0,7,7,0,0,3,0,
	128,128,0,0,7,0,0,0,7,7,0,7,7,7,0,0,3,0,
	128,128,0,0,7,0,0,0,7,7,0,7,7,7,0,0,3,0,
	128,128,0,7,0,0,7,7,0,0,7,7,7,7,0,3,3,0,
	128,128,0,7,0,0,7,7,0,0,7,7,7,7,0,3,3,0,
	128,128,0,7,0,7,7,7,7,7,0,7,7,7,0,0,0,128,
	128,128,0,7,0,7,7,7,7,7,0,7,7,7,0,0,0,128,
	128,128,0,0,3,0,7,7,7,7,7,7,7,0,128,128,128,128,
	128,128,0,0,3,0,7,7,7,7,7,7,7,0,128,128,128,128,
	128,0,3,3,3,0,7,0,0,7,7,7,7,0,128,128,128,128,
	128,0,3,3,3,0,7,0,0,7,7,7,7,0,128,128,128,128,
	128,128,0,3,3,0,0,7,7,0,7,0,0,128,128,128,128,128,
	128,128,0,3,3,0,0,7,7,0,7,0,0,128,128,128,128,128,
	128,128,0,3,3,0,7,7,0,0,0,128,128,128,128,128,128,128,
	128,128,0,3,3,0,7,7,0,0,0,128,128,128,128,128,128,128,
	128,128,128,0,0,0,0,0,1,1,1,0,0,128,128,128,128,128,
	128,128,128,0,0,0,0,0,1,1,1,0,0,128,128,128,128,128,
	128,128,0,1,0,7,7,0,1,1,1,1,1,0,128,128,128,128,
	128,128,0,1,0,7,7,0,1,1,1,1,1,0,128,128,128,128,
	128,0,1,1,0,7,0,128,0,1,1,0,0,0,128,128,128,128,
	128,0,1,1,0,7,0,128,0,1,1,0,0,0,128,128,128,128,
	0,1,1,1,1,0,128,128,0,1,0,0,0,128,128,128,128,128,
	0,1,1,1,1,0,128,128,0,1,0,0,0,128,128,128,128,128,
	0,1,1,0,0,128,128,128,128,0,0,0,128,128,128,128,128,128,
	0,1,1,0,0,128,128,128,128,0,0,0,128,128,128,128,128,128,
	0,1,1,1,0,128,128,128,128,128,128,128,128,128,128,128,128,128,
	0,1,1,1,0,128,128,128,128,128,128,128,128,128,128,128,128,128,
	128,0,1,1,0,128,128,128,128,128,128,128,128,128,128,128,128,128,
	128,0,1,1,0,128,128,128,128,128,128,128,128,128,128,128,128,128,
	128,128,0,0,128,128,128,128,128,128,128,128,128,128,128,128,128,128,
	128,128,0,0,128,128,128,128,128,128,128,128,128,128,128,128,128,128
	};

int GetImagePixel(char *tex, int width, int u, int v)
{
  //LOG(1,"tex(%d,%d)\n", u, v);
  u %= 20;
  v %= 20;
  uint8_t texel = BearBits[u + v*20];

  switch( texel )
  {
    case 60:
      texel = 6;
      break;
    case 20:
      texel = 2;
      break;
    default:
      break;
  }

  return texel & vmask;
}

#if 0
void WritePixelX(int x, int y, int pix)
{
  uint8_t *fb = framebuffer;

  //LOG(1,"%d,%d\n", x, y); 
  fb[x + y*fbWidth] = pix;
}
#endif

#ifdef TST_HARNESS
/* Texture-map-draw the scan line between two edges. */
void ScanOutLine(EdgeScan * LeftEdge, EdgeScan * RightEdge)
{
   extern char * TexMapBits;
   extern int TexMapWidth;
   extern int DestY;
   Fixedpoint SourceX;
   Fixedpoint SourceY;
   int DestX = LeftEdge->DestX;
   int DestXMax = RightEdge->DestX;
   Fixedpoint DestWidth;
   Fixedpoint SourceStepX, SourceStepY;

   /* Nothing to do if fully X clipped */
   if ((DestXMax <= ScreenRect.x) || (DestX >= ScreenRect.xmax)) {
      return;
   }

   if ((DestXMax - DestX) <= 0) {
      return;  /* nothing to draw */
   }

   SourceX = LeftEdge->SourceX;
   SourceY = LeftEdge->SourceY;

   /* Width of destination scan line, for scaling. Note: because this is an
      integer-based scaling, it can have a total error of as much as nearly
      one pixel. For more precise scaling, also maintain a fixed-point DestX
      in each edge, and use it for scaling. If this is done, it will also
      be necessary to nudge the source start coordinates to the right by an
      amount corresponding to the distance from the the real (fixed-point)
      DestX and the first pixel (at an integer X) to be drawn) */
   DestWidth = INT_TO_FIXED(DestXMax - DestX);

   /* Calculate source steps that correspond to each dest X step (across
      the scan line) */
   SourceStepX = FixedDiv(RightEdge->SourceX - SourceX, DestWidth);
   SourceStepY = FixedDiv(RightEdge->SourceY - SourceY, DestWidth);

   /* Advance 1/2 step in the stepping direction, to space scanned pixels
      evenly between the left and right edges. (There's a slight inaccuracy
      in dividing negative numbers by 2 by shifting rather than dividing,
      but the inaccuracy is in the least significant bit, and we'll just
      live with it.) */
   //SourceX += SourceStepX >> 1;
   //SourceY += SourceStepY >> 1;
   SourceX += SourceStepX;
   SourceY += SourceStepY;
   //SourceX -= SourceStepX >> 1;
   //SourceY -= SourceStepY >> 1;

#if 0
   printf("SourceStep: %.4f,%.4f Source: %.4f,%.4f\n", 
        FIXED_TO_FLOAT(SourceStepX),
        FIXED_TO_FLOAT(SourceStepY),
        FIXED_TO_FLOAT(SourceX),
        FIXED_TO_FLOAT(SourceY));
#endif

   /* Clip right edge if necssary */
   if (DestXMax > ScreenRect.xmax)
      DestXMax = ScreenRect.xmax;

   /* Clip left edge if necssary */
   if (DestX < ScreenRect.x) {
      SourceX += FixedMul(SourceStepX, INT_TO_FIXED(ScreenRect.x - DestX));
      SourceY += FixedMul(SourceStepY, INT_TO_FIXED(ScreenRect.x - DestX));
      DestX = ScreenRect.x;
   }

   /* Scan across the destination scan line, updating the source image
      position accordingly */
   uint8_t * fb = &framebuffer[DestX + DestY * fbWidth];
   for (; DestX<DestXMax; DestX++) {
      /* Get the currently mapped pixel out of the image and draw it to
         the screen */
      //WritePixelX(DestX, DestY,
      *fb++ = GetImagePixel(TexMapBits, TexMapWidth,
            ROUND_FIXED_TO_INT(SourceX), ROUND_FIXED_TO_INT(SourceY));
            //FIXED_TO_INT(SourceX), FIXED_TO_INT(SourceY)) );

      /* Point to the next source pixel */
      SourceX += SourceStepX;
      SourceY += SourceStepY;
   }
}

/* Texture-map-draw the scan line between two edges. */
void ScanOutLineFill(EdgeScan * LeftEdge, EdgeScan * RightEdge, unsigned char texel)
{
   extern int DestY;
   int DestX = LeftEdge->DestX;
   int DestXMax = RightEdge->DestX;

   /* Nothing to do if fully X clipped */
   if ((DestXMax <= ScreenRect.x) || (DestX >= ScreenRect.xmax)) {
      return;
   }

   if ((DestXMax - DestX) <= 0) {
      return;  /* nothing to draw */
   }

   /* Clip right edge if necssary */
   if (DestXMax > ScreenRect.xmax)
      DestXMax = ScreenRect.xmax;

   /* Clip left edge if necssary */
   if (DestX < ScreenRect.x) {
      DestX = ScreenRect.x;
   }

   /* Scan across the destination scan line, updating the source image
      position accordingly */
   uint8_t * fb = &framebuffer[DestX + DestY * fbWidth];
   for (; DestX<DestXMax; DestX++) {
      //WritePixelX(DestX, DestY, texel);
      *fb++ = texel;   
   }
}
#endif

void AllocSprite(uint8_t id, uint8_t width, uint8_t height)
{
#if 0
  uint8_t i=0;
  if (spriteid[nextSpriteId] == 0)
    i = nextSpriteId++;
  else
    while(spriteid[i] && i < 0xff) i++;
#endif

  if (id < 0xff)
  {
    spriteid[id] = nextSpriteMem;
    nextSpriteMem += (sizeof(SpriteHeader) + width * height);
  }
}

extern "C" void (*DMAByteOut)(uint32_t dest, uint32_t value) = nullptr;
extern "C" uint32_t (*DMAByteIn)(uint32_t src) = nullptr;

void DMAWrite(uint32_t dst, uint8_t * src, uint8_t inc, uint16_t len) 
{
  cycleCount+=len;
  //uint8_t * dest = &memory[dst]; 
  for(int i=0;i<len;i++)
  {
    // *dest++ = *src;
    DMAByteOut(dst++, *src);
    src += inc; 
  }
}

void DMARead(uint8_t *dest, uint16_t src, uint16_t len) 
{
  cycleCount+=len;
  for(int i=0;i<len;i++)
  {
    *dest++ = DMAByteIn(src++) & 0xff;
  }
}

// A is intersected with B and result is screen coords for rendering,
// if return value is true.  If return is false, A did not intersect B.
bool Intersect(Rect& result, const Rect& a, const Rect& b)
{
  uint16_t x = std::max(a.x, b.x);
  //uint16_t xm = std::min(a.x + a.width, b.x + b.width);
  uint16_t xm = std::min(a.xmax, b.xmax);
  uint16_t y = std::max(a.y, b.y);
  //uint16_t ym = std::min(a.y + a.height, b.y + b.height);
  uint16_t ym = std::min(a.ymax, b.ymax);
  //if (xm >= x && ym >= y)
  if (xm > x && ym > y)
  {
    result.x = x - b.x;
    result.y = y - b.y;
    result.width = xm - x;
    result.height = ym - y;
    result.xoff = x - a.x;
    result.yoff = y - a.y;
    // may not be necessary
    result.xmax = result.x + result.width;
    result.ymax = result.y + result.height;
    return true;
  }
  else
    return false;
}

enum BPPMode
{
  BPP_1 = 1,
  BPP_2 = 2,
  BPP_4 = 4,
  BPP_8 = 8
};

enum Bit8Mode
{
  BIT8_COPY = 0,
  BIT8_MASK = 1,
  BIT8_DATA = 2,
};

// match g() gfx modes
enum ScrnMode
{
  TXT40 =  0,
  TXT80 =  1,
  LGR40 =  2,
  LGR40M = 3,
  LGR80 =  4,
  LGR80M = 5,
  HGR40 =  6,
  HGR40M = 7,
  HGR80 =  8,
  HGR80M = 9
};

void
xlLine(Point& p0, Point& p1, uint8_t value)
{
  if (p0.x > p1.x)
    p0.swap(p1);

  // bresenham line draw
  int16_t dx = abs((int32_t)p1.x-(int32_t)p0.x), sx = p0.x<p1.x ? 1 : -1;
  int16_t dy = abs((int32_t)p1.y-(int32_t)p0.y), sy = p0.y<p1.y ? 1 : -1; 
  int16_t err = (dx>dy ? dx : -dy)/2, e2;
  int16_t x0 = p0.x;
  int16_t y0 = p0.y;

  value &= vmask;
  uint8_t * fb = framebuffer;

  while(1)
  {
    // clip 
    if (y0>=fbHeight)
      break;
    if (x0>=fbWidth)
      break;

    //LOG(2,"y: %d (%04x%c) xs: %d x: %d div: %d mod: %d v: %02x v+1: %02x \n", y0, ypos+xpos, (xpos&1)?'M':'A',xv, x0, xpos, xmod, val&0x7f, val>>7); 

    fb[y0*fbWidth + x0] = value;

    if (x0==p1.x && y0==p1.y) 
    {
      break;
    }

    e2 = err;
    if (e2 > -dx) 
    { 
      err -= dy; 
      x0 += sx; 
    }
    if (e2 < dy) 
    { 
      err += dx; 
      y0 += sy; 
    }
  }
}

// THE EXTREMELY FAST LINE ALGORITHM Variation E (Addition Fixed Point PreCalc Small Display)
// Small Display (256x256) resolution.
void lLine(Point& p0, Point& p1, uint8_t value)
{
  uint8_t * fb = framebuffer;
 	bool yLonger=false;
	int16_t shortLen=p1.y-p0.y;
	int16_t longLen=p1.x-p0.x;
	if (abs(shortLen)>abs(longLen))
  {
		int16_t swap=shortLen;
		shortLen=longLen;
		longLen=swap;
		yLonger=true;
	}
	int16_t decInc;
  int16_t j;
  constexpr uint8_t shift = 7;
  constexpr uint32_t half = 1<<(shift-1);
	if (longLen==0)
    decInc=0;
	else 
    decInc = (shortLen << shift) / longLen;

//  LOG(1,"yLonger: %s longLen: %d decInc: %d\n", yLonger?"true":"false", longLen, decInc);

	if (yLonger) {
		if (longLen>0) {
			longLen+=p0.y;
			for (j=half+(p0.x<<shift);p0.y<=longLen;++p0.y) {
				fb[(j >> shift) + p0.y*fbWidth] = value;	
				j+=decInc;
			}
			return;
		}
		longLen+=p0.y;
		for (j=half+(p0.x<<shift);p0.y>=longLen;--p0.y) {
      fb[(j >> shift) + p0.y*fbWidth] = value;	
			j-=decInc;
		}
		return;	
	}

	if (longLen>0) {
		longLen+=p0.x;
		for (j=half+(p0.y<<shift);p0.x<=longLen;++p0.x) {
			fb[p0.x +(j >> shift)*fbWidth] = value;
			j+=decInc;
		}
		return;
	}
	longLen+=p0.x;
	for (j=half+(p0.y<<shift);p0.x>=longLen;--p0.x) {
    fb[p0.x +(j >> shift)*fbWidth] = value;
		j-=decInc;
	}
}

void eflaLine(Point& p0, Point& p1, uint8_t value)
{
  uint8_t * fb = framebuffer;
 	bool yLonger=false;
	int16_t shortLen=p1.y-p0.y;
	int16_t longLen=p1.x-p0.x;
	if (abs(shortLen)>abs(longLen))
  {
		int16_t swap=shortLen;
		shortLen=longLen;
		longLen=swap;
		yLonger=true;
	}
	int16_t decInc;
  int16_t j;
  int16_t offset;
  constexpr uint16_t shift = 7;
  constexpr uint16_t half = 1<<(shift-1);
	if (longLen==0)
    decInc=0;
	else 
    decInc = (shortLen << shift) / longLen;

//  LOG(1,"yLonger: %s longLen: %d decInc: %d\n", yLonger?"true":"false", longLen, decInc);

	if (yLonger) {
		if (longLen>0) {
			longLen+=p0.y;
      longLen *= fbWidth;
      offset = p0.y * fbWidth;
			for (j=half+(p0.x<<shift);offset<=longLen;offset+=fbWidth) {
				fb[(j >> shift) + offset] = value;	
				j+=decInc;
			}
			return;
		}
		longLen+=p0.y;
    longLen *= fbWidth;
    offset = p0.y * fbWidth;
		for (j=half+(p0.x<<shift);offset>=longLen;offset-=fbWidth) {
      fb[(j >> shift) + offset] = value;	
			j-=decInc;
		}
		return;	
	}

	if (longLen>0) {
		longLen+=p0.x;
    offset = p0.x;
    decInc += (fbWidth<<shift);
		for (j=half+((p0.y*fbWidth)<<shift);offset<=longLen;++offset) {
			fb[offset + (j >> shift)] = value;
			j+=decInc;
		}
		return;
	}
	longLen+=p0.x;
  offset = p0.x;
  decInc += (fbWidth<<shift);
	for (j=half+((p0.y*fbWidth)<<shift);offset>=longLen;--offset) {
    fb[offset +(j >> shift)] = value;
		j-=decInc;
	}
}

static void
hline(uint16_t x, uint16_t y, uint16_t width, uint8_t value, uint8_t mode)
{
  // values already clipped
  
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
lHline(uint16_t x, uint16_t y, uint16_t width, uint8_t value, uint8_t mode)
{
  // clip against virtual FB values
  
  // clip
  if (y >= fbHeight || x >= fbWidth)
    return;
  // clip x
  uint16_t maxx = x + width;
  width = (maxx >= fbWidth) ? fbWidth - x : width;

  return hline(x,y,width, value, mode);
}

static void
lFRect(uint16_t x, uint16_t y, uint16_t width, uint16_t height, uint8_t value, uint8_t mode)
{
  Rect result;
  if (!Intersect(result, Rect(x,y,width,height), ScreenRect))
    return;

  //printf("%d,%d [%d %d]\n", result.x, result.y, result.width, result.height);
  while(result.height--)
  {
    hline(result.x, result.y++, result.width, value, mode);
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

      lHline( A.x, A.y, B.x-A.x, value,0 );
  }
}

void
xTriangle(Point& p0, Point& p1, Point& p2, uint8_t value)
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

      lHline( A.x, A.y, B.x-A.x, value,0 );
  }
}

enum RenderMode
{
};

static void
spriteCopyRect(SpriteHeader * sprite, const Rect& clip, uint8_t mode)
{
  uint8_t * fb = framebuffer;
  uint8_t * sp = sprite->data;

  LOG(0,"sprite rect: %d,%d %d,%d\n", clip.x, clip.y, clip.width, clip.height);
  LOG(0,"sprite offs: %d,%d\n", clip.xoff, clip.yoff);

  fb += fbWidth * clip.y + clip.x;

  switch(mode)
  {
    //opaque
    case 0:
    {
      // take UL clipping into account
      sp += clip.yoff * sprite->width + clip.xoff;
      for(uint16_t i=0;i<clip.height;i++)
      {
        memcpy(fb, sp, clip.width);
        fb += fbWidth;
        sp += sprite->width;
      }
    }
    break;
    
#if 0
    //zero transparent
    case 1:
    {
      // take UL clipping into account
      sp += clip.yoff * sprite->width + clip.xoff;
      uint16_t scw = fbWidth-clip.width;
      uint16_t spw = sprite->width-clip.width;
      for(uint16_t i=0;i<clip.height;i++)
      {
        for(uint16_t j=0;j<clip.width;j++)
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
#else
    //high bit = transparent
    case 1:
    {
      // take UL clipping into account
      sp += clip.yoff * sprite->width + clip.xoff;
      uint16_t scw = fbWidth-clip.width;
      uint16_t spw = sprite->width-clip.width;
      for(uint16_t i=0;i<clip.height;i++)
      {
        for(uint16_t j=0;j<clip.width;j++)
        {
          if (*sp<0x80)
            *fb = *sp;
          fb++;
          sp++;
        }
        fb += scw;
        sp += spw;
      }
    }
    break;
#endif

    // ROP
    case 2:
    {
      // take UL clipping into account
      sp += clip.yoff * sprite->width + clip.xoff;
      uint16_t scw = fbWidth-clip.width;
      uint16_t spw = sprite->width-clip.width;
      for(uint16_t i=0;i<clip.height;i++)
      {
        for(uint16_t j=0;j<clip.width;j++)
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

  //   0123456789
  //      |
  // 0 abcdefghij
  // 1 abcdefghij
  // 2-abcdefghij
  // 3 abcdefghij
  // 4 abcdefghij
  // 5 abcdefghij
  // 6 abcdefghij

  // forward
  //   0123456789
  // 2    defghij
  // 3    defghij
  // 4    defghij
  // 5    defghij
  // 6    defghij
  
  // reverse
  // 2-   gfedcba
  // 3-   gfedcba
  // 4-   gfedcba
  // 5-   gfedcba
  // 6-   gfedcba
  
    //allow reverse/flip
    //  0011
    //  0111
    //  1011
    //  1111
    case 3: // normal
    case 7: // rev
    case 11: // flip
    case 15: // both
    {
      bool rev  = mode & 0x4;
      bool flip = mode & 0x8;
      bool rorf = rev || flip;
      bool raf  = rev && flip;

      // if rev, start at width-1, else start at 0
      int32_t xstart = rev ? sprite->width-1 - clip.xoff : clip.xoff;
      int32_t xinc = rev ? -1 : 1;
      // if flip, start at height-1, else start at 0
      int32_t ystart = flip ? sprite->height-1 - clip.yoff : clip.yoff;

      uint16_t scw = fbWidth-clip.width;
      int32_t spw = rorf ? 2*sprite->width-(sprite->width-clip.width) : sprite->width-clip.width;
      spw = raf ? -(sprite->width-clip.width) : flip ? -spw : spw;
      int32_t off = ystart * sprite->width + xstart;

      for(uint16_t i=0;i<clip.height;i++)
      {
        for(uint16_t j=0;j<clip.width;j++)
        {
          *fb++ = sp[off];
          off += xinc;
        }
        fb += scw;
        off += spw;
      }
    }
    break;
  }
}

static void
spriteCopy(SpriteHeader * sprite, uint16_t x, uint16_t y, uint8_t mode)
{
  LOG(0,"sprite: %p %d,%d\n", sprite, x, y);

  Rect result;
  if (!Intersect(result, Rect(x,y,sprite->width,sprite->height), ScreenRect))
  {
    LOG(0,"sprite off screen\n");
    return;
  }

  return spriteCopyRect(sprite, result, mode);
}

//        012345678901234567890123
//0          +-------------------+
//1          |Screen             |
//2          |                   |
//3   +----------------+         |
//4   |Spr   |         |         |
//4   |    +--------+  |         |
//5   |    |Sub     |  |         |
//6   |    | |      |  |         |
//7   |    +--------+  |         |
//8   |      |         |         |
//9   |      +---------|---------+
//    +----------------+

static void
spriteSubCopy(SpriteHeader * sprite, uint16_t x, uint16_t y, const Rect& region, uint8_t mode)
{
  LOG(0,"spritesub: %p %d,%d [%d,%d %d,%d]\n", sprite, x, y, region.x, region.y, region.width, region.height);

  Rect result;
  if (!Intersect(result, Rect(x,y,region.width,region.height), ScreenRect))
  {
    LOG(0,"spritesub off screen\n");
    return;
  }

  // add in the region offset
  result.xoff += region.x;
  result.yoff += region.y;

  return spriteCopyRect(sprite, result, mode);
}

EXPORT void
cmdROP(uint8_t rop)
{
  rasterOp = rop;
}

EXPORT void
cmdCComp(uint8_t rop, uint8_t color)
{
  ccompOp = rop;
  ccompColor = color;
}

static void
cexpCopyRect(uint8_t *sp, uint16_t pitch, uint8_t fore, uint8_t back, const Rect& clip, uint8_t mode)
{
  uint8_t * fb = framebuffer;

  LOG(0,"cexp rect: %d,%d %d,%d\n", clip.x, clip.y, clip.width, clip.height);
  LOG(0,"cexp offs: %d,%d\n", clip.xoff, clip.yoff);

  fb += fbWidth * clip.y + clip.x;
  // take UL clipping into account
  sp += clip.yoff * pitch;
  uint8_t expandBuf[8];

  switch(mode)
  {
    //opaque
    case 0:
    for(uint16_t i=0;i<clip.height;i++)
    {
      colorExpandByte(*sp, fore, back, expandBuf);
      memcpy(fb, &expandBuf[clip.xoff], clip.width);
      fb += fbWidth;
      sp += pitch;
    }
    break;

    //zero transparent
    case 1:
    {
      uint16_t scw = fbWidth-clip.width;
      for(uint16_t i=0;i<clip.height;i++)
      {
        colorExpandByte(*sp, fore, 0, expandBuf);
        for(uint16_t j=0;j<clip.width;j++)
        {
          if (expandBuf[clip.xoff+j])
            *fb = expandBuf[clip.xoff+j];
          fb++;
        }
        fb += scw;
        sp += pitch;
      }
    }
    break;

    // ROP
    case 2:
    {
      uint16_t scw = fbWidth-clip.width;
      for(uint16_t i=0;i<clip.height;i++)
      {
        colorExpandByte(*sp, fore, back, expandBuf);
        for(uint16_t j=0;j<clip.width;j++)
        {
          ROP(fb,expandBuf[clip.xoff+j]);
          fb++;
        }
        fb += scw;
        sp += pitch;
      }
    }
    break;
  }
}

void
bltFontChar(uint8_t id, uint8_t ch, uint16_t x, uint16_t y, uint8_t fore, uint8_t back, uint8_t mode)
{
  Rect result;
  if (!Intersect(result, Rect(x,y,biFontWidth,biFontHeight), ScreenRect))
  {
    LOG(0,"spritesub off screen\n");
    return;
  }

  uint8_t * font = nullptr;
  switch (id)
  {
    case 0:
      font = primaryFontBits;
      biFontWidth = 6;
      break;
    case 1:
      font = secondaryFontBits;
      biFontWidth = 6;
      break;
    case 2:
      font = ibmFontBits;
      biFontWidth = 8;
      break;
  }

  if (font == nullptr)
    return;

  uint16_t sx = (ch % 16);
  uint16_t sy = (ch / 16) * biFontHeight;

  // add in the in-font offset
  font += sx;
  result.yoff += sy;

  return cexpCopyRect(font, 16, fore, back, result, mode);
}

EXPORT bool
cmdBlt(uint8_t id, uint16_t destx, uint16_t desty, uint8_t mode)
{
  uint32_t mem = spriteid[id];
  if (mem)
  {
    SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
    spriteCopy(sprite, destx, desty, mode);

    return true;
  }
  else
  {
    LOG(1,"sprite id %d not found\n", id);
  }

  return false;
}

EXPORT bool
cmdSubBlt(uint8_t id, uint16_t destx, uint16_t desty, uint16_t sx, uint16_t sy, uint8_t sw, uint8_t sh, uint8_t mode)
{
  uint32_t mem = spriteid[id];
  if (mem)
  {
    SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
    spriteSubCopy(sprite, destx, desty, Rect(sx, sy, sw, sh), mode);

    return true;
  }
  else
  {
    LOG(1,"sprite id %d not found\n", id);
  }

  return false;
}

#if 0
EXPORT void
cmdSBlt(JS_ARGS)
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
#endif

EXPORT void
cmdUploadSprite(uint8_t id, uint16_t srcAddr, uint8_t width, uint8_t height, uint8_t mode)
{
  AllocSprite(id, width, height);
  if (id != 0xff)
  {
    uint32_t mem = spriteid[id];
    SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
    sprite->width = width;
    sprite->height = height;
    sprite->mode = mode;
    sprite->id = id;
    DMARead(sprite->data, srcAddr, width*height);
  }
}

EXPORT void
cmdFRect(uint16_t x, uint16_t y, uint16_t width, uint16_t height, uint8_t value, uint8_t mode)
{
  lFRect(x, y, width, height, value, mode);
}

EXPORT void
cmdClear(uint8_t value)
{
  memset(framebuffer, value, fbWidth * fbHeight);
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

EXPORT void
cmdSetBits(uint16_t bits)
{
  SetBits(bits);
}

EXPORT void
cmdHLine( uint16_t x, uint16_t y, uint8_t width, uint8_t value)
{
  lHline(x,y,width,value,0);
}

EXPORT void
cmdLine(int16_t p0x, int16_t p0y,
        int16_t p1x, int16_t p1y,
        uint8_t value)
{
  Point p0(p0x, p0y);
  Point p1(p1x, p1y);

  lLine(p0,p1,value);
}

EXPORT void
cmdLine2(int16_t p0x, int16_t p0y,
         int16_t p1x, int16_t p1y,
         uint8_t value)
{
  Point p0(p0x, p0y);
  Point p1(p1x, p1y);

  eflaLine(p0,p1,value);
}

// NOTE: modified from here: https://github.com/ssloy/tinyrenderer/wiki/Lesson-2:-Triangle-rasterization-and-back-face-culling
EXPORT void
cmdTriangle(int16_t p0x, int16_t p0y,
            int16_t p1x, int16_t p1y,
            int16_t p2x, int16_t p2y,
            uint8_t value)
{
  Point p0(p0x, p0y);
  Point p1(p1x, p1y);
  Point p2(p2x, p2y);

  lTriangle(p0,p1,p2,value);
}

#if 0
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
#endif

static void
presentText40(uint16_t page)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    DMAWrite(gettxtaddr(y,page), fb, 1, 40);
    fb += 40;
  }
}

static void
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
}

static void
presentText80(uint16_t page)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    //DMAWrite(0x10000 + gettxtaddr(y,page), fb, 2, 40);
    DMAWrite(0xC005, fb, 0, 1); 
    DMAWrite(gettxtaddr(y,page), fb, 2, 40);
    DMAWrite(0xC004, fb, 0, 1); 
    DMAWrite(gettxtaddr(y,page), fb+1, 2, 40);
    fb += 80;
  }
}

static void
presentGr80(uint16_t page, bool mix)
{
  uint8_t * fb = framebuffer;
  for(uint16_t y=0;y<24;y++)
  {
    for(uint16_t x=0;x<80;x++)
    {
      dmabuffer[x] = (fb[x] & 0xf) | (fb[x+80] << 4);
    }

    //DMAWrite(0x10000 + gettxtaddr(y,page), dmabuffer, 2, 40);
    DMAWrite(0xC005, fb, 0, 1); 
    DMAWrite(gettxtaddr(y,page), dmabuffer, 2, 40);
    DMAWrite(0xC004, fb, 0, 1); 
    DMAWrite(gettxtaddr(y,page), dmabuffer+1, 2, 40);
    fb += 160;
  }
}

static void
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
}

void unpackHgr40( uint8_t* packed, uint8_t* dest, uint16_t width, uint16_t height)
{
  // shift in packed pixels, storing palette bit for now
  uint32_t p;
  uint8_t palette = 0;
  uint16_t pixel = 0;

  // for now must be a multiple of 7 pixels wide
  uint32_t offset = 0;
  for(uint32_t i=0; i<width*height; i+=7)
  {
    // build a short filled with 7 pixels
    for(p=0;p<2;p++)
    {
      pixel <<= 7;
      palette = *packed & 0x80;
      pixel |= (*packed++ & 0x7f);
    }

    // now have a short filled with 7 pixels
    //
    // FEDCBA9876543210
    //   00112233445566
    for(p=0;p<6;p++)
    {
      dest[offset+p] = pixel & 3;
      pixel >>= 2;
    }

    // palette bits!!
  }
}

static void
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
        //pixel |= bitrev[fb[i+p] & 0xf];
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
    //DMAWrite(0x10000 + getgfxaddr(y,page), dmabuffer, 2, 40);
    DMAWrite(0xC005, fb, 0, 1); 
    DMAWrite(getgfxaddr(y,page), dmabuffer, 2, 40);
    // second main
    DMAWrite(0xC004, fb, 0, 1); 
    DMAWrite(getgfxaddr(y,page), dmabuffer+1, 2, 40);
    fb += 140;
  }
}

EXPORT void
cmdPresent(uint16_t page)
{
  LOG(0,"Present %d to page %d\n", videoMode, page);

#if 0
  char buf[32];
  sprintf(buf, "Frame: %d", frame);

  uint32_t len = strlen(buf);
  for(uint32_t i =0;i<len;i++)
  {
    bltFontChar(0, buf[i] | 0x80, ScreenRect.x + i*biFontWidth, ScreenRect.y + biFontHeight, 0xff, 0x00, 1);
  }
#endif

#if 0
  for(uint32_t i =0;i<256;i++)
  {
    bltFontChar(2, i, i%16*biFontWidth, i/16 * biFontHeight, 0xff, 0x00, 0);
  }
#endif

  cmdBlt(4, 0, 5, 1);
  cmdBlt(4, 20, 5, 1);
  cmdBlt(4, 40, 5, 1);
  cmdBlt(4, 60, 5, 1);
  cmdBlt(4, 80, 5, 1);

  cmdBlt(4, 100+0, 5, 1);
  cmdBlt(4, 100+20, 5, 1);
  cmdBlt(4, 100+40, 5, 1);
  cmdBlt(4, 100+60, 5, 1);
  cmdBlt(4, 100+80, 5, 1);

  cmdBlt(4, 100+0, 190, 1);
  cmdBlt(4, 100+20, 190, 1);
  cmdBlt(4, 100+40, 190, 1);
  cmdBlt(4, 100+60, 190, 1);
  cmdBlt(4, 100+80, 190, 1);

  frame++;
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
      return;
  }
}

EXPORT void
cmdScreenOffset(uint16_t xoff, uint16_t yoff)
{
  ScreenRect.position(xoff, yoff);
  fbXPos = xoff;
  fbYPos = yoff;
}

EXPORT void
cmdScreenRect(uint16_t x, uint16_t y, uint16_t width, uint16_t height)
{
  ScreenRect = Rect(x, y, width, height);
  fbXPos = x;
  fbYPos = y;
}

EXPORT void
cmdSetMode(uint16_t vMode, uint16_t clear)
{
  uint8_t cv = 0;
  videoMode = vMode;

  // (0=40 1=80 2=lo 3=lowmix 4=dlo 5=dlomix 6=hi 7=himix 8=dhi 9=dhimix)",
  switch( videoMode )
  {
    case 0:
      fbWidth = 40;
      fbHeight = 24;
      framebuffer = txtFramebuffer;
      SetBits(8);
      cv = 0x20 | 0x80;
      break;

    case 1:
      fbWidth = 80;
      fbHeight = 24;
      framebuffer = txtFramebuffer;
      SetBits(8);
      cv = 0x20 | 0x80;
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
      return;
  }

  ScreenRect = Rect(fbXPos, fbYPos, fbWidth, fbHeight);

  if (clear)
    cmdClear(cv);

  LOG(0,"Setting Mode: %d (%dx%d) (%s) %d bits\n", videoMode, fbWidth, fbHeight, ((framebuffer == gfxFramebuffer)?"GFX":"TXT"), vbits);
}

EXPORT void Init(uint32_t dmaByteOutPtr, uint32_t dmaByteInPtr)
{
  // set pointer
  DMAByteOut = reinterpret_cast<void (*)(uint32_t, uint32_t)>(dmaByteOutPtr);
  DMAByteIn  = reinterpret_cast<uint32_t (*)(uint32_t)>(dmaByteInPtr);

  uint8_t id = 1;
  AllocSprite(id, 20,20);
  LOG(1,"default sprite: %d\n", id);
  uint32_t mem = spriteid[id];
  SpriteHeader * sprite = (SpriteHeader*)&spriteMem[mem];
  sprite->width = 20;
  sprite->height = 20;
  sprite->mode = 0;
  sprite->id = id;
  // DMARead..
  memcpy(sprite->data, BearBits, 20*20);

  id++;
  AllocSprite(id, 20,20);
  LOG(1,"default sprite2: %d\n", id);
  mem = spriteid[id];
  sprite = (SpriteHeader*)&spriteMem[mem];
  sprite->width = 20;
  sprite->height = 20;
  sprite->mode = 1;
  sprite->id = id;
  // DMARead..
  memcpy(sprite->data, BearBits2, 20*20);

  id++;
  AllocSprite(id, 18,21);
  LOG(1,"default sprite3: %d\n", id);
  mem = spriteid[id];
  sprite = (SpriteHeader*)&spriteMem[mem];
  sprite->width = 18;
  sprite->height = 21;
  sprite->mode = 1;
  sprite->id = id;
  // DMARead..
  memcpy(sprite->data, PacManBits0, 18*21);

  id++;
  AllocSprite(id, 18,42);
  LOG(1,"default sprite4: %d\n", id);
  mem = spriteid[id];
  sprite = (SpriteHeader*)&spriteMem[mem];
  sprite->width = 18;
  sprite->height = 42;
  sprite->mode = 1;
  sprite->id = id;
  // DMARead..
  memcpy(sprite->data, PacManBits1, 18*42);

  createFont();
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

