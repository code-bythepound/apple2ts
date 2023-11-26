import React from "react"
import { crc32, uint32toBytes } from "../emulator/utility/utility"
import { handleGetDriveProps, handleSetDiskData } from "../main2worker"
import { imageList } from "./assets"
import BinaryFileDialog from "./binaryfiledialog"

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

class DiskDrive extends React.Component<{drive: number},
  { displayBinaryDialog: boolean }> {
  hiddenFileInput = React.createRef<HTMLInputElement>()
  binaryBuffer: Uint8Array = new Uint8Array()
  isTouchDevice = "ontouchstart" in document.documentElement

  constructor(props: {drive: number}) {
    super(props);
    this.state = {
      displayBinaryDialog: false,
    };
  }

  // https://medium.com/@650egor/simple-drag-and-drop-file-upload-in-react-2cb409d88929
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleDrop = (e: any) => {this.dropHandler(e as DragEvent)}
  handleDrag = (e: DragEvent) => 
    {e.preventDefault(); e.stopPropagation()}

  componentDidMount() {
    if (this.props.drive === 0) {
      window.addEventListener('drop', this.handleDrop)
      window.addEventListener('dragover', this.handleDrag)
    }
  }

  componentWillUnmount() {
    if (this.props.drive === 0) {
      window.removeEventListener('drop', this.handleDrop)
      window.removeEventListener('dragover', this.handleDrag)
    }
  }

  readDisk = async (file: File, drive: number) => {
    const buffer = await file.arrayBuffer();
    if (file.name.toLowerCase().endsWith('.bin')) {
      // throw up dialog, ask for address
      // put into memory
      this.binaryBuffer = new Uint8Array(buffer)
      if (this.binaryBuffer.length > 0) {
        this.setState( {displayBinaryDialog: true} )
      }
      return
    }
    handleSetDiskData(drive, new Uint8Array(buffer), file.name)
  }
  
  dropHandler = (e: DragEvent) => {    
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer?.files
    if (f && f.length > 0) {
      this.readDisk(f[0], 0)
    }
  }

  render() {
    const dprops = handleGetDriveProps(this.props.drive)
    let img1: string
    if (dprops.hardDrive) {
      img1 = dprops.motorRunning ? imageList.hardDriveOn : imageList.hardDriveOff
    } else {
      img1 = (dprops.filename.length > 0) ?
        (dprops.motorRunning ? imageList.disk2on : imageList.disk2off) :
        (dprops.motorRunning ? imageList.disk2onEmpty : imageList.disk2offEmpty)
    }
    const filename = (dprops.filename.length > 0) ? dprops.filename : "(empty)"
    let status = ['S7D1', 'S6D1', 'S6D2'][this.props.drive]
    status += dprops.status
    return (
      <span className="driveClass">
        <img className="disk2"
          src={img1} alt={filename}
          title={filename}
          onClick={() => {
            if (dprops.filename.length > 0) {
              if (dprops.diskHasChanges) {
                downloadDisk(dprops.diskData, filename)
              }
              resetDrive(this.props.drive)
            }
            if (this.hiddenFileInput.current) {
              // Hack - clear out old file so we can pick the same file again
              this.hiddenFileInput.current.value = "";
              this.hiddenFileInput.current.click()
            }
          }} />
        <input
          type="file"
          accept={this.isTouchDevice ? "" : ".hdv,.2mg,.dsk,.woz,.po,.do,.bin"}
          ref={this.hiddenFileInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target?.files?.length) {
              this.readDisk(e.target.files[0], this.props.drive)
            }
          }}
          style={{display: 'none'}}
        />
        <span className={"diskLabel"}>{dprops.filename}</span>
        <span className={"defaultFont diskStatus"}>{status}</span>
        <BinaryFileDialog displayDialog={this.state.displayBinaryDialog}
          displayClose={() => this.setState({displayBinaryDialog: false})}
          binaryBuffer={this.binaryBuffer}/>
      </span>
    )
  }
}

export default DiskDrive;
