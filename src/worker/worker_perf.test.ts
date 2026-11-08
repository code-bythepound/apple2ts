import {
  estimateStructuredCloneBytes,
  recordMachineStateBuild,
  recordMachineStatePost,
  recordWorkerAdvance,
  recordVeraAudioBatchPost,
  recordVeraAudioBatchPrepare,
  recordVeraSync,
  recordVideoUpdate,
  recordWorkerTimerCallback,
  setWorkerPerfEnabled,
  takeWorkerPerfStats,
} from "./worker_perf"

afterEach(() => setWorkerPerfEnabled(false))

test("collects and resets worker scheduling and MachineState metrics", () => {
  setWorkerPerfEnabled(true)
  recordWorkerAdvance("timer", 3, 8)
  recordWorkerAdvance("audio", 1, 6)
  recordVeraSync(1.5, {
    videoStepMs: 0.6,
    spiStepMs: 0.1,
    frameUpdateMs: 0.2,
    irqMs: 0.4,
    scheduleMs: 0.1,
  })
  recordVeraAudioBatchPrepare(0.2, 5)
  recordVeraAudioBatchPost(0.4)
  recordVideoUpdate(0.75)
  recordWorkerTimerCallback(2.25)
  recordMachineStateBuild(2)
  recordMachineStatePost(0.5, 0.25, 4096)

  const stats = takeWorkerPerfStats()
  expect(stats).toEqual(expect.objectContaining({
    workerAdvanceCalls: 2,
    workerAdvanceMs: 14,
    maxWorkerAdvanceMs: 8,
    veraSyncCalls: 1,
    veraSyncMs: 1.5,
    maxVeraSyncMs: 1.5,
    veraVideoStepMs: 0.6,
    maxVeraVideoStepMs: 0.6,
    veraSpiStepMs: 0.1,
    maxVeraSpiStepMs: 0.1,
    veraFrameUpdateMs: 0.2,
    maxVeraFrameUpdateMs: 0.2,
    veraIrqMs: 0.4,
    maxVeraIrqMs: 0.4,
    veraScheduleMs: 0.1,
    maxVeraScheduleMs: 0.1,
    veraOtherMs: expect.any(Number),
    maxVeraOtherMs: expect.any(Number),
    veraAudioBatchCount: 1,
    veraAudioBatchEvents: 5,
    veraAudioBatchPrepareMs: 0.2,
    maxVeraAudioBatchPrepareMs: 0.2,
    veraAudioBatchPostCount: 1,
    veraAudioBatchPostMs: 0.4,
    maxVeraAudioBatchPostMs: 0.4,
    videoUpdateMs: 0.75,
    workerTimerCallbacks: 1,
    workerTimerCallbackMs: 2.25,
    maxWorkerTimerCallbackMs: 2.25,
    workerWakeCount: 2,
    workerTimerWakeCount: 1,
    workerAudioWakeCount: 1,
    workerWakeLatenessMs: 4,
    maxWorkerWakeLatenessMs: 3,
    machineStateBuildCount: 1,
    machineStateBuildMs: 2,
    machineStatePostCount: 1,
    machineStatePostMs: 0.5,
    machineStateEstimateMs: 0.25,
    machineStateBytes: 4096,
  }))
  expect(stats.veraOtherMs).toBeCloseTo(0.1)
  expect(stats.maxVeraOtherMs).toBeCloseTo(0.1)
  expect(takeWorkerPerfStats().workerAdvanceCalls).toBe(0)
})

test("does not collect metrics while disabled", () => {
  setWorkerPerfEnabled(false)
  recordWorkerAdvance("timer", 3, 8)
  recordVeraSync(1.5, {
    videoStepMs: 0.6,
    spiStepMs: 0.1,
    frameUpdateMs: 0.2,
    irqMs: 0.4,
    scheduleMs: 0.1,
  })
  recordVeraAudioBatchPrepare(0.2, 5)
  recordVeraAudioBatchPost(0.4)
  recordVideoUpdate(0.75)
  recordWorkerTimerCallback(2.25)
  recordMachineStateBuild(2)
  recordMachineStatePost(0.5, 0.25, 4096)
  expect(takeWorkerPerfStats()).toEqual(expect.objectContaining({
    workerAdvanceCalls: 0,
    veraSyncCalls: 0,
    videoUpdateMs: 0,
    workerTimerCallbacks: 0,
    machineStateBuildCount: 0,
    machineStatePostCount: 0,
    veraAudioBatchCount: 0,
    veraAudioBatchPostCount: 0,
  }))
})

test("estimates structured-clone payload data without double-counting views", () => {
  const bytes = new Uint8Array(32)
  const payload = {
    bytes,
    duplicate: new Uint8Array(bytes.buffer),
    text: "abcd",
    values: [1, true],
  }
  expect(estimateStructuredCloneBytes(payload)).toBe(32 + 8 + 8 + 1)
})
