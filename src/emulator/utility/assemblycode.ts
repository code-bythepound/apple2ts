export const xxcode = `
         ORG   $300
AGAIN    LDA   $C000
         BPL   AGAIN
         LDA   $C010
         JSR   $FCA8
         LDA   $C019
         BRK
         LDA   #$FE
         LDA   LOC1
         LDA   LOC1,X
         LDA   LOC3
         LDA   LOC3,X
         LDA   LOC3,Y
         LDA   (LOC1,X)
         LDA   (LOC1),Y
         LDA   (LOC1)
         JMP   LOC3
         JMP   (LOC2)
         JMP   (LOC2,X)
         STA   LOC1
LOC1     EQU   $04
LOC2     EQU   $0003
LOC3     EQU   $1234
         RTS
`

export const codeOrig = `
         ORG   $300
FREQ     EQU   $350
PLSWIDTH EQU   $352

         LDA   #$FF
         STA   FREQ
         LDA   #$80
         STA   PLSWIDTH
PLAY     LDA   $C030
         LDY   PLSWIDTH
PULSE    DEY
         BNE   PULSE
         LDA   $C030
         LDX   FREQ
COUNTDN  DEX
         BNE   COUNTDN
         JSR   READKB
         JMP   PLAY

INCR     INC   FREQ
         RTS

DECR     DEC   FREQ
         RTS

PULSEINC DEC   PLSWIDTH
         INC   FREQ
         RTS

PULSEDEC INC   PLSWIDTH
         DEC   FREQ
         RTS

READKB   LDA   $C000
         STA   $C010   
         CMP   #$88
         BEQ   INCR
         CMP   #$95
         BEQ   DECR
         CMP   #$C1
         BEQ   PULSEINC
         CMP   #$DA
         BEQ   PULSEDEC
         RTS
`
export const codezz = `
DMACBASE EQU   $C0B0
DMALO    EQU   DMACBASE+0
DMAHI    EQU   DMACBASE+1
DMALEN   EQU   DMACBASE+2
DMARND   EQU   DMACBASE+5

CONFIG   EQU   0
FILLM8   EQU   1
FILLM16  EQU   2
COPYM    EQU   3
MEMRD    EQU   4
MEMWR    EQU   5
CLEAR    EQU   6
FTRI     EQU   7
TRI      EQU   8
FRECT    EQU   9
RECT     EQU   0xa
LINE     EQU   0xb
HLINE    EQU   0xc
SCOPY    EQU   0xd
SSCOPY   EQU   0xe
SUPLD    EQU   0xf
SCOFF    EQU   0x10
PRESENT  EQU   0xFD
EXIT     EQU   0xFE
CHAIN    EQU   0xFF

         ORG   $300
         ldy #0
loop     tya
         sta $800,y
         iny
         bne loop
rloop    lda <PUSHBUF
         sta DMALO
         lda >PUSHBUF
         sta DMAHI
         lda #PBLEN
         sta DMALEN
         inc XPOS
kloop    lda $C000
         bpl kloop
         bit $C010
         cmp #$D1  ; 'q'
         bne rloop
         rts

PBLEN    EQU 14
PUSHBUF  db CONFIG
         db 7
         db SCOPY
         db 1
XPOS     db 5
YPOS     db 5
         db 0
         db SCOPY
         db 2
         db 5
         db 35
         db 0
         db PRESENT
         db 0

PBLEN2   EQU 6
PUSHBUF2 db SCOPY
         db 1
XPOSR    db 5
YPOSR    db 5
         db 0
         db 0

PRESENTL 2
PRESENTP db PRESENT
         db 0
`

export const zzzcode = `
DMACBASE EQU   $C0B0
DMALO    EQU   DMACBASE+0
DMAHI    EQU   DMACBASE+1
DMALEN   EQU   DMACBASE+2
DMACNF   EQU   DMACBASE+3
DMARND   EQU   DMACBASE+5

CONFIG   EQU   0
FILLM8   EQU   1
FILLM16  EQU   2
COPYM    EQU   3
MEMRD    EQU   4
MEMWR    EQU   5
CLEAR    EQU   6
FTRI     EQU   7
TRI      EQU   8
FRECT    EQU   9
RECT     EQU   0xa
LINE     EQU   0xb
HLINE    EQU   0xc
SCOPY    EQU   0xd
SSCOPY   EQU   0x0e
SUPLD    EQU   0x0f
SCOFF    EQU   0x10
SCRECT   EQU   0x11
DEBUG    EQU   0xFC
PRESENT  EQU   0xFD
EXIT     EQU   0xFE
CHAIN    EQU   0xFF

floorx   equ $F0
floory   equ $F1
floorc   equ $F2
offx     equ $F3
offy     equ $F4

         ORG   $900
         lda $c057  ; hires on
         lda $c050  ; text off
         lda $c05e  ; an3 off
         lda $c052  ; mixed off
         sta $c000  ; 80store off
         sta $c00d  ; 80 col on

         stz offx
         stz offy

start    lda #8
         sta DMACNF

         jsr SetOffset

         ldy #100
lloop    ;jsr DrawRndLine
         dey
         bne lloop

         ldy #100
bloop    ;jsr DrawRndSprite
         dey
         bne bloop

         ldy #100
tloop    ;jsr DrawRndTri
         dey
         bne tloop

ttloop   jsr DrawFloor
         jsr DoPresent

;xloop    lda $C000
;         bmi kend
;         bra right

kloop    lda $C000
         bpl kloop
         bit $C010
         cmp #$88 ; left
         beq left
         cmp #$95 ; right
         beq right
         cmp #$8b ; up
         beq up
         cmp #$8a ; down
         beq down
         cmp #$D1  ; 'q'
         bne start

kend     bit $C010
         lda $c056  ; hires off
         lda $c051  ; text on
         lda $c05f  ; an3 on
         sta $c00c  ; 80 col off
         rts

left     lda offx
         beq start
         dec
         sta offx
         bra start
right    inc offx
         bra start
up       lda offy
         beq start
         dec
         sta offy
         bra start
down     inc offy
         bra start

DrawRndLine lda #140    ; rand number 0->139
         sta DMARND
         lda DMARND
         sta XP0LN
         lda DMARND
         sta YP0LN
         lda DMARND
         sta XP1LN
         lda DMARND
         sta YP1LN
         lda #16
         sta DMARND
         lda DMARND
         sta LNCLR
         lda <DRAWLIN
         sta DMALO
         lda >DRAWLIN
         sta DMAHI
         lda #6
         sta DMALEN
         rts

DrawRndTri lda #140    ; rand number 0->139
         sta DMARND
         lda DMARND
         sta XP0TR
         lda DMARND
         sta YP0TR
         lda DMARND
         sta XP1TR
         lda DMARND
         sta YP1TR
         lda DMARND
         sta XP2TR
         lda DMARND
         sta YP2TR
         lda #16
         sta DMARND
         lda DMARND
         sta TRCLR
         lda <DRAWTRI
         sta DMALO
         lda >DRAWTRI
         sta DMAHI
         lda #8
         sta DMALEN
         rts

DrawRndSprite
         lda #120
         sta DMARND
         lda DMARND
         sta XPOSR
         lda #130
         sta DMARND
         lda DMARND
         sta YPOSR
         lda <DRAWPB
         sta DMALO
         lda >DRAWPB
         sta DMAHI
         lda #5
         sta DMALEN
         rts

DrawFloor stz floory
          stz floorc

          ldy #8
vloop     ldx #16
          stz floorx
hloop     jsr DrawRect
          lda floorc
          inc
          and #$f
          sta floorc
          lda #16
          clc
          adc floorx
          sta floorx
          dex
          bne hloop
          lda #32
          clc
          adc floory
          sta floory
          dey
          bne vloop
          rts

DrawRect lda floorc
         sta RECTC
         lda floorx
         sta RECTX
         lda floory
         sta RECTY
         lda <DDRAWRECT
         sta DMALO
         lda >DDRAWRECT
         sta DMAHI
         lda #6
         sta DMALEN
         rts

SetOffset 
        lda offx
        sta OFFSX
        lda offy
        sta OFFSY
        lda <OFFSETP
        sta DMALO
        lda >OFFSETP
        sta DMAHI
        lda #3
        sta DMALEN
        rts

DoPresent lda <PRESENTP
        sta DMALO
        lda >PRESENTP
        sta DMAHI
        lda #2
        sta DMALEN
        rts

OFFSETP db SCOFF
OFFSX   db 0
OFFSY   db 0

PRESENTP db PRESENT
         db 0

DRAWPB   db SCOPY
         db 1
XPOSR    db 5
YPOSR    db 5
         db 0

DDRAWRECT db FRECT
RECTC    db 1
RECTX    db 0
RECTY    db 0
RECTW    db 16
RECTH    db 32

DRAWLIN  db LINE
LNCLR    db 0
XP0LN    db 5
YP0LN    db 5
XP1LN    db 5
YP1LN    db 5

DRAWTRI  db TRI
TRCLR    db 0
XP0TR    db 5
YP0TR    db 5
XP1TR    db 5
YP1TR    db 5
XP2TR    db 5
YP2TR    db 5

`

export const code = `
DMACBASE EQU   $C0B0
DMALO    EQU   DMACBASE+0
DMAHI    EQU   DMACBASE+1
DMALEN   EQU   DMACBASE+2
DMACNF   EQU   DMACBASE+3
DMARND   EQU   DMACBASE+5

CONFIG   EQU   0
FILLM8   EQU   1
FILLM16  EQU   2
COPYM    EQU   3
MEMRD    EQU   4
MEMWR    EQU   5
CLEAR    EQU   6
FTRI     EQU   7
TRI      EQU   8
FRECT    EQU   9
RECT     EQU   0xa
LINE     EQU   0xb
HLINE    EQU   0xc
SCOPY    EQU   0xd
SSCOPY   EQU   0x0e
SUPLD    EQU   0x0f
SCOFF    EQU   0x10
SCRECT   EQU   0x11
DEBUG    EQU   0xFC
PRESENT  EQU   0xFD
EXIT     EQU   0xFE
CHAIN    EQU   0xFF

floorx   equ $F0
floory   equ $F1
floorc   equ $F2
offx     equ $F3
offy     equ $F4

         ORG   $900
         lda $c057  ; hires on
         lda $c050  ; text off
         lda $c05e  ; an3 off
         lda $c052  ; mixed off
         sta $c000  ; 80store off
         sta $c00d  ; 80 col on

         stz offx
         stz offy
         stz floorx
         stz floory

start    lda #8
         sta DMACNF

         jsr SetOffset
         jsr SetFOffset

         jsr DoPresent

kloop    lda $C000
         bpl kloop
         bit $C010
         cmp #$88 ; left
         beq left
         cmp #$95 ; right
         beq right
         cmp #$8b ; up
         beq up
         cmp #$8a ; down
         beq down
         cmp #$C1 ; 'a'
         beq sleft
         cmp #$C4 ; 'd'
         beq sright
         cmp #$D7 ; 'w'
         beq sup
         cmp #$D3 ; 's'
         beq sdown
         cmp #$D1  ; 'q'
         bne start

kend     bit $C010
         lda $c056  ; hires off
         lda $c051  ; text on
         lda $c05f  ; an3 on
         sta $c00c  ; 80 col off
         rts

left     lda offx
         beq start
         dec
         sta offx
         bra start
right    inc offx
         bra start
up       lda offy
         beq start
         dec
         sta offy
         bra start
down     inc offy
         bra start

sleft    lda floorx
         beq start
         dec
         sta floorx
         bra start
sright   inc floorx
         bra start
sup      lda floory
         beq start
         dec
         sta floory
         bra start
sdown    inc floory
         bra start

SetOffset 
        lda offx
        sta OFFSX
        lda offy
        sta OFFSY
        lda <OFFSETP
        sta DMALO
        lda >OFFSETP
        sta DMAHI
        lda #3
        sta DMALEN
        rts

SetFOffset 
        lda floorx
        sta OFFFSX
        lda floory
        sta OFFFSY
        lda <OFFFSETP
        sta DMALO
        lda >OFFFSETP
        sta DMAHI
        lda #3
        sta DMALEN
        rts

DoPresent lda <PRESENTP
        sta DMALO
        lda >PRESENTP
        sta DMAHI
        lda #2
        sta DMALEN
        rts

OFFSETP db SCOFF
OFFSX   db 0
OFFSY   db 0

OFFFSETP db DEBUG
OFFFSX   db 0
OFFFSY   db 0

PRESENTP db PRESENT
         db 0


`
