// Chris Torrence, 2022
import { setDisplay, handleGetRunMode, passSetRunMode,
  passSetNormalSpeed, handleGetTextPage,
  passSetDebug,
  passRestoreSaveState, handleGetSaveState, handleGetAltCharSet,
  handleGetFilename } from "./main2worker"
import { RUN_MODE, getPrintableChar, COLOR_MODE } from "./emulator/utility/utility"
import Apple2Canvas from "./canvas"
import ControlPanel from "./controls/controlpanel"
import DiskInterface from "./devices/diskinterface"
import React from 'react';
import HelpPanel from "./panels/helppanel"
import DebugPanel from "./panels/debugpanel"
import { preloadAssets } from "./devices/assets"
import { changeMockingboardMode, getMockingboardMode } from "./devices/mockingboard_audio"
import ImageWriter from "./devices/imagewriter"
import { audioEnable, isAudioEnabled } from "./devices/speaker"
// import Test from "./components/test";

class DisplayApple2 extends React.Component<object,
  { currentSpeed: number;
    speedCheck: boolean;
    uppercase: boolean;
    useArrowKeysAsJoystick: boolean;
    colorMode: COLOR_MODE;
    doDebug: boolean;
    breakpoint: string;
    helptext: string;
  }> {
  timerID = 0
  refreshTime = 16.6881
  myCanvas = React.createRef<HTMLCanvasElement>()
  hiddenFileOpen = React.createRef<HTMLInputElement>();

  constructor(props: object) {
    super(props);
    this.state = {
      doDebug: true,
      currentSpeed: 1.02,
      speedCheck: true,
      uppercase: true,
      useArrowKeysAsJoystick: true,
      colorMode: COLOR_MODE.COLOR,
      breakpoint: '',
      helptext: '',
    };
  }

  updateDisplay = (speed = 0, helptext = '') => {
    if (helptext) {
      this.setState( {helptext} )
    } else {
      this.setState( {currentSpeed: (speed ? speed : this.state.currentSpeed)} )
    }
  }

  updatehelptext = (helptext: string) => {
    this.setState( {helptext} )
  }

  componentDidMount() {
    setDisplay(this)
    if ("launchQueue" in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queue: any = window.launchQueue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queue.setConsumer(async (launchParams: any) => {
        const files: FileSystemFileHandle[] = launchParams.files
        if (files && files.length) {
          const fileContents = await (await files[0].getFile()).text()
          this.restoreSaveStateFunc(fileContents)
        }
      });
    }
    preloadAssets()
    passSetNormalSpeed(true)
  //    window.addEventListener("resize", handleResize)
  }

  componentWillUnmount() {
    if (this.timerID) clearInterval(this.timerID);
//    window.removeEventListener("resize", handleResize)
  }

  handleSpeedChange = (enable: boolean) => {
    passSetNormalSpeed(enable)
    this.setState({ speedCheck: enable });
  };

  handleColorChange = (mode: COLOR_MODE) => {
    this.setState({ colorMode: mode });
  };

  handleDebugChange = (enable: boolean) => {
    passSetDebug(enable)
    this.setState({ doDebug: enable });
  };

  handleUpperCaseChange = (enable: boolean) => {
    this.setState({ uppercase: enable });
  };

  handleUseArrowKeyJoystick = (enable: boolean) => {
    this.setState({ useArrowKeysAsJoystick: enable });
  };

  restoreSaveStateFunc = (fileContents: string) => {
    const saveState: EmulatorSaveState = JSON.parse(fileContents)
    passRestoreSaveState(saveState)
    if (saveState.emulator?.colorMode !== undefined) {
      this.handleColorChange(saveState.emulator.colorMode)
    }
    if (saveState.emulator?.uppercase !== undefined) {
      this.handleUpperCaseChange(saveState.emulator.uppercase)
    }
    if (saveState.emulator?.audioEnable !== undefined) {
      audioEnable(saveState.emulator.audioEnable)
    }
    if (saveState.emulator?.mockingboardMode !== undefined) {
      changeMockingboardMode(saveState.emulator.mockingboardMode)
    }
    passSetRunMode(RUN_MODE.RUNNING)
  }

  handleRestoreState = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target?.files?.length) {
      const fileread = new FileReader()
      const saveStateReader = this.restoreSaveStateFunc
      fileread.onload = function(e) {
        if (e.target) {
          saveStateReader(e.target.result as string)
        }
      };
      fileread.readAsText(e.target.files[0]);
    }
  };

  handleFileOpen = () => {
    if (this.hiddenFileOpen.current) {
      // Hack - clear out old file so we can pick the same file again
      this.hiddenFileOpen.current.value = "";
      this.hiddenFileOpen.current.click()
    }
  }

  doSaveStateCallback = (saveState: EmulatorSaveState) => {
    const d = new Date()
    let datetime = new Date(d.getTime() - (d.getTimezoneOffset() * 60000 )).toISOString()
    saveState.emulator = {
      name: `Apple2TS Emulator`,
      date: datetime,
      help: this.state.helptext.split('\n')[0],
      colorMode: this.state.colorMode,
      uppercase: this.state.uppercase,
      audioEnable: isAudioEnabled(),
      mockingboardMode: getMockingboardMode(),
    }
    const state = JSON.stringify(saveState, null, 2)
    const blob = new Blob([state], {type: "text/plain"});
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    let name = handleGetFilename(0)
    if (!name) {
      name = handleGetFilename(1)
      if (!name) {
        name = "apple2ts"
      }
    }
    datetime = datetime.replaceAll('-','').replaceAll(':','').split('.')[0]
    link.setAttribute('download', `${name}${datetime}.a2ts`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  handleFileSave = () => {
    handleGetSaveState(this.doSaveStateCallback)
  }

  /**
   * For text mode, copy all of the screen text.
   * For graphics mode, do a bitmap copy of the canvas.
   */
  handleCopyToClipboard = () => {
    const textPage = handleGetTextPage()
    if (textPage.length === 960 || textPage.length === 1920) {
      const nchars = textPage.length / 24
      const isAltCharSet = handleGetAltCharSet()
      let output = ''
      for (let j = 0; j < 24; j++) {
        let line = ''
        for (let i = 0; i < nchars; i++) {
          const value = textPage[j * nchars + i]
          const v1 = getPrintableChar(value, isAltCharSet)
          if (v1 >= 32 && v1 !== 127) {
            const c = String.fromCharCode(v1);
            line += c
          }
        }
        line = line.trim()
        output += line + '\n'
      }
      navigator.clipboard.writeText(output);
    } else {
      try {
        this.myCanvas.current?.toBlob((blob) => {
          if (blob) {
            navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob,
              })
            ])
          }
        })
      }
      catch (error) {
        console.error(error);
      }
    }
  }

  render() {
    const props: DisplayProps = {
      runMode: handleGetRunMode(),
      speed: this.state.currentSpeed,
      myCanvas: this.myCanvas,
      speedCheck: this.state.speedCheck,
      uppercase: this.state.uppercase,
      useArrowKeysAsJoystick: this.state.useArrowKeysAsJoystick,
      colorMode: this.state.colorMode,
      doDebug: this.state.doDebug,
      handleDebugChange: this.handleDebugChange,
      handleSpeedChange: this.handleSpeedChange,
      handleColorChange: this.handleColorChange,
      handleCopyToClipboard: this.handleCopyToClipboard,
      handleUpperCaseChange: this.handleUpperCaseChange,
      handleUseArrowKeyJoystick: this.handleUseArrowKeyJoystick,
      handleFileOpen: this.handleFileOpen,
      handleFileSave: this.handleFileSave,
    }
    const width = props.myCanvas.current?.width
    const height = window.innerHeight - 30
    let paperWidth = window.innerWidth - (width ? width : 600) - 70
    if (paperWidth < 300) paperWidth = 300
    return (
      <div>
        <span className="flex-row">
          <span className="flex-column">
            <Apple2Canvas {...props}/>
            <div className="flex-row-space-between wrap" style={{width: width, display: width ? '' : 'none'}}>
                <ControlPanel {...props}/>
                <DiskInterface />
                <ImageWriter />
            </div>
            <span className="defaultFont statusItem">
              <span>{props.speed} MHz</span>
              <br/>
              <span>Apple2TS ©{new Date().getFullYear()} Chris Torrence&nbsp;
                <a href="https://github.com/ct6502/apple2ts/issues">Report an Issue</a></span>
            </span>
          </span>
          <span className="sidePanels">
            {props.doDebug ? <DebugPanel/> :
              <HelpPanel helptext={this.state.helptext}
                height={height ? height : 400} width={paperWidth} />}
          </span>
        </span>
        <input
          type="file"
          accept=".a2ts"
          ref={this.hiddenFileOpen}
          onChange={this.handleRestoreState}
          style={{display: 'none'}}
        />
      </div>
    );
  }
}

export default DisplayApple2;
