export const xxcode = `
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

         ORG   $300
         lda <PUSHBUF
         sta DMALO
         lda >PUSHBUF
         sta DMAHI
         lda #PBLEN
         sta DMALEN
         rts

PBLEN    EQU 25
PUSHBUF  db MEMRD
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
         dw 20
         db COPYM
         dw $2000
         db $0
         dw $2400
         db $0
         dw $0028
PBEND    db $FF
`
