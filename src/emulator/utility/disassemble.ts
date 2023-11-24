import { pcodes } from "../instructions"
import { memGetRaw } from "../memory"
import { ADDR_MODE, isBranchInstruction, toHex } from "./utility"

const nlines = 40  // should this be an argument?

const decodeBranch = (addr: number, vLo: number) => {
  // The extra +2 is for the branch instruction itself
  return addr + 2 + (vLo > 127 ? vLo - 256 : vLo)
}

const getInstructionString = (addr: number, code: PCodeInstr,
  vLo: number, vHi: number) => {
  let value = ''
  let hex = `${toHex(code.pcode)}`
  let sLo = ''
  let sHi = ''
  switch (code.bytes) {
    case 1: hex += '      '; break
    case 2: sLo = toHex(vLo); hex += ` ${sLo}   `; break
    case 3: sLo = toHex(vLo); sHi = toHex(vHi); hex += ` ${sLo} ${sHi}`; break
  }
  const vRel = isBranchInstruction(code.name) ? toHex(decodeBranch(addr, vLo)) : sLo
  switch (code.mode) {
    case ADDR_MODE.IMPLIED: break  // BRK
    case ADDR_MODE.IMM: value = ` #$${sLo}`; break      // LDA #$01
    case ADDR_MODE.ZP_REL: value = ` $${vRel}`; break   // LDA $C0 or BCC $FF
    case ADDR_MODE.ZP_X: value = ` $${sLo},X`; break     // LDA $C0,X
    case ADDR_MODE.ZP_Y: value = ` $${sLo},Y`; break     // LDX $C0,Y
    case ADDR_MODE.ABS: value = ` $${sHi}${sLo}`; break      // LDA $1234
    case ADDR_MODE.ABS_X: value = ` $${sHi}${sLo},X`; break    // LDA $1234,X
    case ADDR_MODE.ABS_Y: value = ` $${sHi}${sLo},Y`; break    // LDA $1234,Y
    case ADDR_MODE.IND_X: value = ` ($${sHi.trim()}${sLo},X)`; break    // LDA ($FF,X) or JMP ($1234,X)
    case ADDR_MODE.IND_Y: value = ` ($${sLo}),Y`; break    // LDA ($FF),Y
    case ADDR_MODE.IND: value = ` ($${sHi.trim()}${sLo})`; break       // JMP ($1234) or LDA ($C0)
  }
  return `${toHex(addr, 4)}: ${hex}  ${code.name}${value}`
}

export const getDisassembly = (start: number) => {
  let addr = start
  if (addr > (0xFFFF - nlines)) addr = 0xFFFF - nlines
  let r = ''
  for (let i=0; i < 2 * nlines; i++) {
    if (addr > 0xFFFF) {
      r += '\n'
      continue
    }
    const instr = memGetRaw(addr)
    const code =  pcodes[instr]
    const vLo = memGetRaw(addr + 1)
    const vHi = memGetRaw(addr + 2)
    r += getInstructionString(addr, code, vLo, vHi) + '\n'
    addr += code.bytes
  }
  return r
}

export const verifyAddressWithinDisassembly = (start: number, check: number) => {
  if (check < start || start < 0) return false
  let addr = start
  for (let i=0; i < nlines; i++) {
    if (addr === check) return true
    const instr = memGetRaw(addr)
    addr += pcodes[instr].bytes
    if (addr > 0xFFFF) break
  }
  return false
}

export const getInstruction = (addr: number) => {
  const instr = memGetRaw(addr)
  return pcodes[instr].name
}
