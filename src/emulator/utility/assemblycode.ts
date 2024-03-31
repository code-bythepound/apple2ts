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
DMACBASE EQU   $C0C0
DMALO    EQU   DMACBASE+0
DMAHI    EQU   DMACBASE+1
DMALEN   EQU   DMACBASE+2

FILLM8   EQU   0
FILLM16  EQU   1
COPYM    EQU   2
MEMRD    EQU   3
MEMWR    EQU   4
RECTT    EQU   5
HLINET   EQU   6
BLITLT   EQU   7
BLITLH   EQU   8
EXIT     EQU   0xFE
CHAIN    EQU   0xFF

         ORG   $300
         ldy #0
loop     tya
         sta $800,y
         iny
         bne loop
rloop    lda <PUSHBUF2
         sta DMALO
         lda >PUSHBUF2
         sta DMAHI
         lda #PBLEN2
         sta DMALEN
         inc XPOS
kloop    lda $C000
         bpl kloop
         bit $C010
         cmp #$D1  ; 'q'
         bne rloop
         rts

PBLEN    EQU 31
PUSHBUF  db MEMWR
         db $00     ; turn off 80 store
         db MEMWR
         db $00     ; turn on 80 col
         db RECTT
         db 0x20
         db 0
         db 0
         db 80
         db 24
         db RECTT
         db 0
         db 10
         db 10
         db 10
         db 10
         db HLINET
         db 0
         db 30
         db 10
         db 10
         db BLITLT
         dw $800
         db 0
         db 1
         db 30
         db 15
         db 5
         db 5
         db 0
         dw $ffff

PBLEN2   EQU 26
PUSHBUF2 db MEMRD
         db $50   ; display gfx
         db MEMRD
         db $53   ; split screen
         db MEMRD
         db $54   ; page 1
         db MEMRD
         db $57   ; hires
         db FILLM16
         dw $ffff
         dw $2000
         db 0
         dw $1000
         db BLITLH
         dw $800
         db 28
         db 0
XPOS     db 0
         db 0
         db 28
         db 5
         db 0
PBEND    db $FF
`
