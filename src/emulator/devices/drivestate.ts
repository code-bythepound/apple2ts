import { Buffer } from "buffer"
import { passDriveProps, passDriveSound } from "../worker2main"
import { decodeDiskData, isHardDriveImage } from "./decodedisk"
import { doPauseDiskDrive, doResetDiskDrive } from "./diskdata"
import { DRIVE } from "../utility/utility"

const initDriveState = (index: number, drive: number, hardDrive: boolean): DriveState => {
  return {
    index: index,
    hardDrive: hardDrive,
    drive: drive,
    status: "",
    filename: "",
    diskHasChanges: false,
    motorRunning: false,
    isWriteProtected: false,
    halftrack: 0,
    prevHalfTrack: 0,
    writeMode: false,
    currentPhase: 0,
    trackStart: !hardDrive ? Array<number>(80) : Array<number>(),
    trackNbits: !hardDrive ? Array<number>(80) : Array<number>(),
    trackLocation: 0,
  }
}

const initializeDriveState = () => {
  driveState[0] = initDriveState(0, 1, true)
  driveState[1] = initDriveState(1, 2, true)
  driveState[2] = initDriveState(2, 1, false)
  driveState[3] = initDriveState(3, 2, false)
  for (let i = 0; i < driveState.length; i++) {
    driveData[i] = new Uint8Array()
  }
}

const driveState: DriveState[] = []
const driveData: Array<Uint8Array> = []

initializeDriveState()

let currentDrive = 2

export const setCurrentDrive = (drive: number) => {currentDrive = drive}

export const getCurrentDriveState = () => driveState[currentDrive]

export const getCurrentDriveData = () => driveData[currentDrive]

export const getHardDriveState = (drive: number) => driveState[(drive == 2) ? 1 : 0]
export const getHardDriveData = (drive: number) => driveData[(drive == 2) ? 1 : 0]

export const getFilename = () => {
  for (let i = 0; i < driveState.length; i++) {
    if (driveState[i].filename !== "") return driveState[i].filename
  }
  return ""
}

export const passData = () => {
  for (let i = 0; i < driveState.length; i++) {
    const dprops: DriveProps = {
      index: i,
      hardDrive: driveState[i].hardDrive,
      drive: driveState[i].drive,
      filename: driveState[i].filename,
      status: driveState[i].status,
      motorRunning: driveState[i].motorRunning,
      diskHasChanges: driveState[i].diskHasChanges,
      diskData: driveState[i].diskHasChanges ? driveData[i] : new Uint8Array()
    }
    passDriveProps(dprops)
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getDriveSaveState = (full: boolean): DriveSaveState => {
  const data = ['', '', '']
  for (let i=0; i < driveState.length; i++) {
    // Always save small disk images (< 32Mb), or if a full save was requested
    if (full || driveData[i].length < 32000000) {
      data[i] = Buffer.from(driveData[i]).toString("base64")
    }
  }
  const result = { currentDrive: currentDrive,
    driveState: [initDriveState(0, 1, true), initDriveState(1, 2, true),
      initDriveState(2, 1, false), initDriveState(3, 2, false)],
    driveData: data }
  for (let i=0; i < driveState.length; i++) {
    result.driveState[i] = { ...driveState[i] }
  }
  return result
}

export const restoreDriveSaveState = (newState: DriveSaveState) => {
  passDriveSound(DRIVE.MOTOR_OFF)
  currentDrive = newState.currentDrive
  // If this is an old save state, we may need to adjust the current drive.
  if (newState.driveState.length === 3 && currentDrive > 0) {
    currentDrive++
  }
  initializeDriveState()
  let dindex = 0;
  for (let i=0; i < newState.driveState.length; i++) {
    driveState[dindex] = { ...newState.driveState[i] }
    if (newState.driveData[i] !== '') {
      driveData[dindex] = new Uint8Array(Buffer.from(newState.driveData[i], 'base64'))
    }
    // See if we had a second hard drive in our save state or not.
    if (newState.driveState.length === 3 && i === 0) dindex = 1
    dindex++
  }
  passData()
}

export const resetDrive = () => {
  doResetDiskDrive(driveState[1])
  doResetDiskDrive(driveState[2])
  passData()
}

export const doPauseDrive = (resume = false) => {
  doPauseDiskDrive(resume)
  passData()
}

export const doSetEmuDriveProps = (props: DriveProps) => {
  let index = props.index
  let drive = props.drive
  // See if the "wrong" disk image was put into a drive. If so, swap the drive.
  let isHardDrive = props.hardDrive
  if (props.filename !== '') {
    if (isHardDriveImage(props.filename)) {
      isHardDrive = true
      index = (props.drive <= 1) ? 0 : 1
      drive = index + 1
    } else {
      isHardDrive = false
      index = (props.drive <= 1) ? 2 : 3
      drive = index - 1
    }
  }
  driveState[index] = initDriveState(index, drive, isHardDrive)
  driveState[index].filename = props.filename
  driveState[index].motorRunning = props.motorRunning
  driveData[index] = decodeDiskData(driveState[index], props.diskData)
  if (driveData[index].length === 0) {
    driveState[index].filename = ''
  }
  passData()
}
