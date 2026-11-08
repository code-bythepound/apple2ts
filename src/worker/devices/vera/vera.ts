
// Vera Card for Apple2TS copyright Michael Morrison (codebythepound@gmail.com)

import { interruptRequest, registerCycleCountCallback } from "../../cpu6502"
import { s6502 } from "../../instructions"
import { setSlotIOCallback } from "../../memory"
import { passVeraFmReset, passVeraFmWrite } from "../../worker2main"
import { getCpuCyclesPerRefresh } from "../../motherboard"
import { isWorkerPerfEnabled, recordVeraSync } from "../../worker_perf"
import { video_cycles_until_next_event, video_init, video_step, video_update, video_reset, video_read, video_write, video_get_irq_out, video_set_perf_enabled } from "./video"
import { vera_spi_init, vera_spi_step, sdcard_select } from "./sdcard"

let slot: number = 5
let curInter: boolean = false
let prevCycleCount = 0
let nextSyncCycle = 0
let ymBusyUntil = 0
let fmEnabled = true
export const setVeraFmEnabled = (enabled: boolean) => {
  fmEnabled = enabled
  ymBusyUntil = 0
  passVeraFmReset()
}

export const setVeraPerfEnabled = (enabled: boolean) => {
  video_set_perf_enabled(enabled)
}

const interrupt = (onoff: boolean): void => {
  if (onoff != curInter) {
    curInter = onoff
    interruptRequest(slot, onoff)
  }
}

const veraInit = (): boolean => {
  const result = video_init()
  if (!result)
    console.log("video_init fails")

  vera_spi_init()
  return result
}

const scheduleNextSync = () => {
  nextSyncCycle = s6502.cycleCount + video_cycles_until_next_event()
}

export const syncVera = (reschedule = true): void => {
	const syncStart = isWorkerPerfEnabled() ? performance.now() : 0
  const cycleDelta = s6502.cycleCount - prevCycleCount
  if (cycleDelta < 0) {
    // Save-state restoration, time travel, and debugger edits can move the
    // global counter backward. Resynchronize at the new position.
    prevCycleCount = s6502.cycleCount
    scheduleNextSync()
    return
  }
  if (cycleDelta === 0) return

  const videoStepStart = syncStart ? performance.now() : 0
  const newFrame = video_step(1, cycleDelta, false)
  const videoStepMs = videoStepStart ? performance.now() - videoStepStart : 0
  const spiStepStart = syncStart ? performance.now() : 0
  vera_spi_step(cycleDelta)
  const spiStepMs = spiStepStart ? performance.now() - spiStepStart : 0
  const frameUpdateStart = syncStart && newFrame ? performance.now() : 0
  const publication = newFrame ? video_update(true) : null
  const frameUpdateMs = frameUpdateStart ? performance.now() - frameUpdateStart : 0
  const irqStart = syncStart ? performance.now() : 0
  interrupt(video_get_irq_out())
  const irqMs = irqStart ? performance.now() - irqStart : 0
  const scheduleStart = syncStart ? performance.now() : 0
  prevCycleCount = s6502.cycleCount
  if (reschedule) scheduleNextSync()
  const scheduleMs = scheduleStart ? performance.now() - scheduleStart : 0
	if (syncStart) {
    recordVeraSync(performance.now() - syncStart, {
      videoStepMs,
      spiStepMs,
      frameUpdateMs,
      irqMs,
      scheduleMs,
    })
  }
  if (typeof publication === "function") publication()
}

export const initVera = () => {
  video_reset()
  sdcard_select(false)
  interrupt(false)
  prevCycleCount = s6502.cycleCount
  scheduleNextSync()
  ymBusyUntil = 0
  passVeraFmReset()
}

export const resetVera = () => {
  video_reset()
  interrupt(false)
  prevCycleCount = s6502.cycleCount
  scheduleNextSync()
  ymBusyUntil = 0
  passVeraFmReset()
}

export const enableVera = (enable = true, aslot = 3) => {
  if (!enable)
    return

  resetVera()

  if (!veraInit())
    return

  slot = aslot
  prevCycleCount = s6502.cycleCount
  scheduleNextSync()

  // this card has no ROM, but has registers in the ROM area
  setSlotIOCallback(slot, handleVeraIO)
  registerCycleCountCallback(cycleCountCallback, slot)
}

const cycleCountCallback = (_slot: number) => {
  void _slot
  if (s6502.cycleCount >= prevCycleCount && s6502.cycleCount < nextSyncCycle) return
  syncVera()
}

const handleVeraIO = (addr: number, val = -1): number => {
  const ymBase = 0xC080 + slot * 0x10
  if (addr === ymBase || addr === ymBase + 1) {
    if (!fmEnabled) return 0xff
    const port = (addr - ymBase) as 0 | 1
    if (val >= 0) {
      passVeraFmWrite({ port, value: val & 0xff })
      if (port === 1) {
        // YM2151 writes hold BUSY for 32 chip clocks at the OPM prescale of 2.
        // Convert those 64 chip clocks to Apple II CPU cycles so software
        // probes (including VERA_FM_DETECT) can observe BUSY before it clears.
        const busyCycles = Math.ceil(64 * getCpuCyclesPerRefresh() * 60 / 3579545)
        ymBusyUntil = s6502.cycleCount + busyCycles
      }
      return 0
    }
    return addr === ymBase + 1 && s6502.cycleCount < ymBusyUntil ? 0x80 : 0
  }
  // We dont have any ROM, but we have vera regs starting at Cx00
  if (addr >= 0xc100) {
    // Register accesses must observe VERA at the current CPU cycle even though
    // background stepping is scheduled only at observable events.
    // Ordinary register and VRAM accesses do not change the already scheduled
    // absolute raster deadline. Preserve it instead of recalculating it for
    // every byte transferred through the VERA ports.
    syncVera(s6502.cycleCount >= nextSyncCycle)
    if (val >= 0) {
      const reg = addr & 0x1f
      video_write(reg, val)
      if ((reg >= 0x05 && reg <= 0x0c) || (reg >= 0x1b && reg <= 0x1d)) {
        // Interrupt control, display timing, reset, and PCM writes can change
        // the next observable deadline without advancing CPU time.
        interrupt(video_get_irq_out())
        scheduleNextSync()
      }
      return 0
    }
    else
      return video_read(addr&0xff, false)
  }
  return 0
}

export { sdcard_attach_image, sdcard_detach_image, sdcard_get_status, sdcard_get_image, set_sdcard_status_listener } from "./sdcard"
