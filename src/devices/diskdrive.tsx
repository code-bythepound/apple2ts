import { useState } from "react"
import { crc32, uint32toBytes } from "../emulator/utility/utility"
import { imageList } from "./assets"
import { handleSetDiskData, handleGetDriveProps } from "./driveprops"

const downloadDisk = (diskData: Uint8Array, filename: string) => {
  // Only WOZ requires a checksum. Other formats should be ready to download.
  if (filename.toLowerCase().endsWith('.woz')) {
    const crc = crc32(diskData, 12)
    diskData.set(uint32toBytes(crc), 8)
  }
  const blob = new Blob([diskData]);
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const resetDrive = (drive: number) => {
  //  const dprops = handleGetDriveProps(drive)
  handleSetDiskData(drive, new Uint8Array(), "")
}

type DiskDriveProps = {
  drive: number,
  renderCount: number,
  setShowFileOpenDialog: (show: boolean, drive: number) => void
}

const DiskDrive = (props: DiskDriveProps) => {
  const dprops = handleGetDriveProps(props.drive)

  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [position, setPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 })

  const menuNames = ['Download Disk', 'Download and Eject Disk', 'Eject Disk']

  const handleMenuClick = (event: React.MouseEvent) => {
    if (dprops.filename.length > 0) {
      const y = Math.min(event.clientY, window.innerHeight - 200)
      setPosition({ x: event.clientX, y: y })
      setMenuOpen(true)
    } else {
      props.setShowFileOpenDialog(true, props.drive)
    }
  }

  const handleMenuClose = (index = -1) => {
    setMenuOpen(false)
    if (index === 0 || index === 1) {
      if (dprops.diskData.length > 0) {
        downloadDisk(dprops.diskData, filename)
        dprops.diskHasChanges = false
      }
    }
    if (index === 1 || index === 2) {
      resetDrive(props.drive)
    }
  }

  let img1: string
  if (dprops.hardDrive) {
    img1 = dprops.motorRunning ? imageList.hardDriveOn : imageList.hardDriveOff
  } else {
    img1 = (dprops.filename.length > 0) ?
      (dprops.motorRunning ? imageList.disk2on : imageList.disk2off) :
      (dprops.motorRunning ? imageList.disk2onEmpty : imageList.disk2offEmpty)
  }
  const filename = (dprops.filename.length > 0) ? dprops.filename : "(empty)"
  let status = ['S7D1', 'S6D1', 'S6D2'][props.drive]
  status += dprops.status
  return (
    <span className="flex-column">
      <img className="disk-image"
        src={img1} alt={filename}
        title={filename + (dprops.diskHasChanges ? ' (modified)' : '')}
        onClick={handleMenuClick} />
      <span className={"disk-label" + (dprops.diskHasChanges ? " disk-label-unsaved" : "")}>
        {dprops.diskHasChanges ? '*' : ''}{dprops.filename}</span>
      <span className={"default-font disk-status"}>{status}</span>
      {menuOpen &&
        <div className="modal-overlay"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          onClick={() => handleMenuClose()}>
          <div className="floating-dialog flex-column droplist-option"
            style={{ left: position.x, top: position.y }}>
            {[0, 1, 2].map((i) => (
              <div className="droplist-option"
                style={{ padding: '5px', paddingLeft: '10px', paddingRight: '10px' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ccc'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'inherit'}
                key={i} onClick={() => handleMenuClose(i)}>
                {menuNames[i]}
              </div>))}
          </div>
        </div>
      }
    </span>
  )
}

export default DiskDrive;
