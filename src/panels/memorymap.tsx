// import { handleGetStackString } from "../main2worker";

import { handleGetC800Slot, handleGetSoftSwitches } from "../main2worker"

const MemoryMap = () => {
  const switches = handleGetSoftSwitches()
  if (Object.keys(switches).length <= 1) return (<div></div>)
  const altZP = switches.ALTZP
  const bank2 = switches.BSRBANK2
  const bsrRead = switches.BSRREADRAM
  const bsrWrite = switches.WRITEBSR1 || switches.WRITEBSR2 ||
    switches.RDWRBSR1 || switches.RDWRBSR2
  let bankSwitchedRam = 'ROM'
  let bankD000 = 'ROM'
  let classBSR = 'mem-rom'
  if (bsrRead || bsrWrite) {
    classBSR = altZP ? 'mem-aux' : ''
    if (bsrRead && bsrWrite) {
      bankSwitchedRam = 'R/W RAM'
    } else {
      bankSwitchedRam = bsrRead ? 'Read RAM' : 'Read ROM\nWrite RAM'
    }
    bankD000 = bankSwitchedRam + '\nBank ' + (bank2 ? '2' : '1')
  }
  const auxRead = switches.RAMRD
  const auxWrite = switches.RAMWRT
  const isAux = auxRead || auxWrite
  const store80 = switches.STORE80
  const page2 = switches.PAGE2
  const isHGR = switches.HIRES
  const textIsAux = store80 ? page2 : isAux
  // See Inside the Apple //e, p. 296-7
  const hgrIsAux = store80 ? (isHGR ? page2 : isAux) : isAux
  // if (is80column) {
  //   // Only select second 80-column text page if STORE80 is also OFF
  //   const pageOffset = (SWITCHES.PAGE2.isSet && !SWITCHES.STORE80.isSet) ? TEXT_PAGE2 : TEXT_PAGE1
  const internalCxRom = switches.INTCXROM
  // Are we still hooked up to the internal ROM for C300?
  const internalC3Rom = switches.INTCXROM || (!switches.SLOTC3ROM)
  // 255 is our flag for no slot selected, so just wrap it back around to 0
  const c800Slot = internalCxRom ? 0 : (handleGetC800Slot() % 255)

  return (
    <div>
      <table className="memory-map">
        <tbody>
          <tr>
            <td>$0000</td><td className={altZP ? "mem-aux" : ""}>Zero Page</td>
          </tr>
          <tr>
            <td>$0100</td><td className={altZP ? "mem-aux" : ""}>6502 Stack</td>
          </tr>
          <tr>
            <td>$0200</td><td className={isAux ? "mem-aux" : ""}></td>
          </tr>
          <tr>
            <td>$0400</td><td className={textIsAux ? "mem-aux" : ""}>Text page 1</td>
          </tr>
          <tr>
            <td>$0800</td><td className={isAux ? "mem-aux" : ""}></td>
          </tr>
          <tr>
            <td>$2000</td><td className={hgrIsAux ? "mem-aux" : ""}>HGR page 1</td>
          </tr>
          <tr>
            <td>$4000</td><td className={isAux ? "mem-aux" : ""}></td>
          </tr>
          <tr>
            <td>$C100<br />$C7FF</td><td className={internalCxRom ? "mem-rom" : ""}>{internalCxRom ? "Internal ROM" : "Peripheral ROM"}</td>
          </tr>
          <tr>
            <td>$C300</td><td className={internalC3Rom ? "mem-rom" : ""}>{internalC3Rom ? "Internal ROM" : "Peripheral ROM"}</td>
          </tr>
          <tr>
            <td>$C800</td><td className={c800Slot ? "" : "mem-rom"}>{c800Slot ? `Slot ${c800Slot}` : "Internal ROM"}</td>
          </tr>
          <tr>
            <td>$D000</td><td className={classBSR}>{bankD000}</td>
          </tr>
          <tr>
            <td>$E000<br /><br />$FFFF</td><td className={classBSR}>{bankSwitchedRam}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ paddingTop: "20px" }}>Key:</div>
      <table className="memory-map">
        <tbody>
          <tr><td> Main </td>
            <td className="mem-rom"> ROM </td>
            <td className="mem-aux"> Aux </td></tr>
        </tbody>
      </table>

    </div>
  )
}

export default MemoryMap
