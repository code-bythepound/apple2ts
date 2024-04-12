export const xxcode = `
         ORG   $300
         LDA   #$FE
         LDA   $01
         LDA   $A0,X
         LDA   $1234
         LDA   $1234,X
         LDA   $1234,Y
         LDA   ($04,X)
         LDA   ($04),Y
         LDA   ($04)
         JMP   $1234
         JMP   ($0003)
         JMP   ($0003,X)
         STA   $C0
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
export const code = `
DMACBASE EQU   $C0B0
DMALO    EQU   DMACBASE+0
DMAHI    EQU   DMACBASE+1
DMALEN   EQU   DMACBASE+2

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

PBLEN    EQU 4
PUSHBUF  db CONFIG
         db 0
         db PRESENT
         db 0
XPOS     dw $ffff
`
