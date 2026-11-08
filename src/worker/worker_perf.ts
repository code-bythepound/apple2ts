type WorkerPerfStats = Pick<VeraFrameStats,
  "workerAdvanceCalls" | "workerAdvanceMs" |
  "maxWorkerAdvanceMs" | "veraSyncCalls" | "veraSyncMs" | "maxVeraSyncMs" |
  "veraVideoStepMs" | "maxVeraVideoStepMs" | "veraSpiStepMs" | "maxVeraSpiStepMs" |
  "veraFrameUpdateMs" | "maxVeraFrameUpdateMs" | "veraIrqMs" | "maxVeraIrqMs" |
  "veraScheduleMs" | "maxVeraScheduleMs" | "veraOtherMs" | "maxVeraOtherMs" |
  "veraAudioBatchCount" | "veraAudioBatchEvents" | "veraAudioBatchPrepareMs" |
  "maxVeraAudioBatchPrepareMs" | "veraAudioBatchPostCount" | "veraAudioBatchPostMs" |
  "maxVeraAudioBatchPostMs" | "videoUpdateMs" |
  "workerTimerCallbacks" | "workerTimerCallbackMs" | "maxWorkerTimerCallbackMs" |
  "workerWakeCount" | "workerTimerWakeCount" | "workerAudioWakeCount" |
  "workerWakeLatenessMs" | "maxWorkerWakeLatenessMs" |
  "machineStateBuildCount" | "machineStateBuildMs" |
  "machineStatePostCount" | "machineStatePostMs" |
  "machineStateEstimateMs" | "machineStateBytes">

const emptyStats = (): WorkerPerfStats => ({
  workerAdvanceCalls: 0,
  workerAdvanceMs: 0,
  maxWorkerAdvanceMs: 0,
  veraSyncCalls: 0,
  veraSyncMs: 0,
  maxVeraSyncMs: 0,
  veraVideoStepMs: 0,
  maxVeraVideoStepMs: 0,
  veraSpiStepMs: 0,
  maxVeraSpiStepMs: 0,
  veraFrameUpdateMs: 0,
  maxVeraFrameUpdateMs: 0,
  veraIrqMs: 0,
  maxVeraIrqMs: 0,
  veraScheduleMs: 0,
  maxVeraScheduleMs: 0,
  veraOtherMs: 0,
  maxVeraOtherMs: 0,
  veraAudioBatchCount: 0,
  veraAudioBatchEvents: 0,
  veraAudioBatchPrepareMs: 0,
  maxVeraAudioBatchPrepareMs: 0,
  veraAudioBatchPostCount: 0,
  veraAudioBatchPostMs: 0,
  maxVeraAudioBatchPostMs: 0,
  videoUpdateMs: 0,
  workerTimerCallbacks: 0,
  workerTimerCallbackMs: 0,
  maxWorkerTimerCallbackMs: 0,
  workerWakeCount: 0,
  workerTimerWakeCount: 0,
  workerAudioWakeCount: 0,
  workerWakeLatenessMs: 0,
  maxWorkerWakeLatenessMs: 0,
  machineStateBuildCount: 0,
  machineStateBuildMs: 0,
  machineStatePostCount: 0,
  machineStatePostMs: 0,
  machineStateEstimateMs: 0,
  machineStateBytes: 0,
})

let enabled = false
let totals = emptyStats()

export const setWorkerPerfEnabled = (value: boolean) => {
  enabled = value
  totals = emptyStats()
}

export const isWorkerPerfEnabled = () => enabled

export const recordWorkerAdvance = (
  source: "timer" | "audio",
  wakeLatenessMs: number,
  advanceMs: number,
) => {
  if (!enabled) return
  totals.workerAdvanceCalls++
  totals.workerAdvanceMs += advanceMs
  totals.maxWorkerAdvanceMs = Math.max(totals.maxWorkerAdvanceMs, advanceMs)
  totals.workerWakeCount++
  if (source === "timer") totals.workerTimerWakeCount++
  else totals.workerAudioWakeCount++
  totals.workerWakeLatenessMs += wakeLatenessMs
  totals.maxWorkerWakeLatenessMs = Math.max(totals.maxWorkerWakeLatenessMs, wakeLatenessMs)
}

export const recordVeraSync = (elapsedMs: number, phases: {
  videoStepMs: number,
  spiStepMs: number,
  frameUpdateMs: number,
  irqMs: number,
  scheduleMs: number,
}) => {
  if (!enabled) return
  totals.veraSyncCalls++
  totals.veraSyncMs += elapsedMs
  totals.maxVeraSyncMs = Math.max(totals.maxVeraSyncMs, elapsedMs)
  totals.veraVideoStepMs += phases.videoStepMs
  totals.maxVeraVideoStepMs = Math.max(totals.maxVeraVideoStepMs, phases.videoStepMs)
  totals.veraSpiStepMs += phases.spiStepMs
  totals.maxVeraSpiStepMs = Math.max(totals.maxVeraSpiStepMs, phases.spiStepMs)
  totals.veraFrameUpdateMs += phases.frameUpdateMs
  totals.maxVeraFrameUpdateMs = Math.max(totals.maxVeraFrameUpdateMs, phases.frameUpdateMs)
  totals.veraIrqMs += phases.irqMs
  totals.maxVeraIrqMs = Math.max(totals.maxVeraIrqMs, phases.irqMs)
  totals.veraScheduleMs += phases.scheduleMs
  totals.maxVeraScheduleMs = Math.max(totals.maxVeraScheduleMs, phases.scheduleMs)
  const otherMs = Math.max(
    0,
    elapsedMs - phases.videoStepMs - phases.spiStepMs - phases.frameUpdateMs - phases.irqMs - phases.scheduleMs,
  )
  totals.veraOtherMs += otherMs
  totals.maxVeraOtherMs = Math.max(totals.maxVeraOtherMs, otherMs)
}

export const recordVeraAudioBatchPrepare = (elapsedMs: number, eventCount: number) => {
  if (!enabled) return
  totals.veraAudioBatchCount++
  totals.veraAudioBatchEvents += eventCount
  totals.veraAudioBatchPrepareMs += elapsedMs
  totals.maxVeraAudioBatchPrepareMs = Math.max(totals.maxVeraAudioBatchPrepareMs, elapsedMs)
}

export const recordVeraAudioBatchPost = (elapsedMs: number) => {
  if (!enabled) return
  totals.veraAudioBatchPostCount++
  totals.veraAudioBatchPostMs += elapsedMs
  totals.maxVeraAudioBatchPostMs = Math.max(totals.maxVeraAudioBatchPostMs, elapsedMs)
}

export const recordVideoUpdate = (elapsedMs: number) => {
  if (!enabled) return
  totals.videoUpdateMs += elapsedMs
}

export const recordWorkerTimerCallback = (elapsedMs: number) => {
  if (!enabled) return
  totals.workerTimerCallbacks++
  totals.workerTimerCallbackMs += elapsedMs
  totals.maxWorkerTimerCallbackMs = Math.max(totals.maxWorkerTimerCallbackMs, elapsedMs)
}

export const recordMachineStateBuild = (buildMs: number) => {
  if (!enabled) return
  totals.machineStateBuildCount++
  totals.machineStateBuildMs += buildMs
}

export const recordMachineStatePost = (
  postMs: number,
  estimateMs: number,
  estimatedBytes: number,
) => {
  if (!enabled) return
  totals.machineStatePostCount++
  totals.machineStatePostMs += postMs
  totals.machineStateEstimateMs += estimateMs
  totals.machineStateBytes += estimatedBytes
}

// Counts the byte-bearing parts of a structured-clone payload. Object headers and
// browser-internal serialization metadata are intentionally excluded, so this is
// a stable payload estimate rather than a claim about allocator or IPC byte counts.
export const estimateStructuredCloneBytes = (value: unknown): number => {
  const seen = new WeakSet<object>()
  const visit = (item: unknown): number => {
    if (item === null || item === undefined) return 0
    if (typeof item === "string") return item.length * 2
    if (typeof item === "number") return 8
    if (typeof item === "boolean") return 1
    if (typeof item !== "object") return 0
    if (seen.has(item)) return 0
    seen.add(item)
    if (ArrayBuffer.isView(item)) {
      if (seen.has(item.buffer)) return 0
      seen.add(item.buffer)
      return item.buffer.byteLength
    }
    if (item instanceof ArrayBuffer) return item.byteLength
    if (item instanceof Map) {
      let bytes = 0
      item.forEach((mapValue, key) => { bytes += visit(key) + visit(mapValue) })
      return bytes
    }
    if (item instanceof Set) {
      let bytes = 0
      item.forEach(setValue => { bytes += visit(setValue) })
      return bytes
    }
    let bytes = 0
    for (const child of Object.values(item)) bytes += visit(child)
    return bytes
  }
  return visit(value)
}

export const takeWorkerPerfStats = (): WorkerPerfStats => {
  const result = totals
  totals = emptyStats()
  return result
}
