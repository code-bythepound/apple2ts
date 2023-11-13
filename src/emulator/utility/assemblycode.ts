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
RECTT    EQU   5
HLINET   EQU   6
BLITLT   EQU   7

         ORG   $300
         ldy #0
loop     tya
         sta $800,y
         iny
         bne loop
         lda <PUSHBUF
         sta DMALO
         lda >PUSHBUF
         sta DMAHI
         lda #PBLEN
         sta DMALEN
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

PBLEN2   EQU 43
PUSHBUF2  db MEMRD
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
         db COPYM
         dw $2000
         db $0
         dw $2800
         db $0
         dw $0028
         db COPYM
         dw $2000
         db $0
         dw $2C00
         db $0
         dw $0028
PBEND    db $FF
`
