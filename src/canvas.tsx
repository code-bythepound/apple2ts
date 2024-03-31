import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import "./canvas.css"
import {
  passSetRunMode, passKeypress,
  passAppleCommandKeyPress, passAppleCommandKeyRelease,
  passGoBackInTime,
  passGoForwardInTime,
  setStartTextPage,
  passMouseEvent,
  passPasteText,
  handleGetShowMouse,
  handleGetCapsLock,
  handleGetRunMode,
} from "./main2worker"
import { ARROW, RUN_MODE, convertAppleKey, MouseEventSimple, COLOR_MODE, toHex } from "./emulator/utility/utility"
import { ProcessDisplay, getCanvasSize, getOverrideHiresPixels, handleGetOverrideHires, canvasCoordToNormScreenCoord, screenBytesToCanvasPixels, screenCoordToCanvasCoord } from './graphics';
import { checkGamepad, handleArrowKey } from './devices/gamepad';
import { handleCopyToClipboard } from './copycanvas';
import { drawHiresTile } from './graphicshgr';
import { useGlobalContext } from './globalcontext';
import { handleFileSave } from './savestate';

let width = 800
let height = 600

type keyEvent = KeyboardEvent<HTMLTextAreaElement> | KeyboardEvent<HTMLCanvasElement>

const Apple2Canvas = (props: DisplayProps) => {
  const { updateHgr: updateHgr, setUpdateHgr: setUpdateHgr,
    hgrview, setHgrview: setHgrview } = useGlobalContext()
  const [myInit, setMyInit] = useState(false)
  const [keyHandled, setKeyHandled] = useState(false)
  const [showhgrview, setShowhgrview] = useState(false)
  const [hgrviewLocal, setHgrviewLocal] = useState([-1, -1])
  const hgrviewRef = useRef([-1, -1]);
  const lockHgrViewRef = useRef(false);
  const myText = useRef(null)
  const myCanvas = useRef(null)
  const hiddenCanvas = useRef(null)
  const infoCanvas = useRef(null)
  const nlines = 8

  const pasteHandler = (e: ClipboardEvent) => {
    const canvas = document.getElementById('apple2canvas')
    if (document.activeElement === canvas && e.clipboardData) {
      const data = e.clipboardData.getData("text")
      if (data !== "") {
        passPasteText(data)
      }
      e.preventDefault()
    }
  };

  const syntheticPaste = () => {
    const canvas = document.getElementById('apple2canvas')
    if (document.activeElement === canvas && document.hasFocus()) {
      // Errors can sometimes occur during debugging, if the canvas loses
      // focus. I tried using a try/catch but it didn't help. Just ignore.
      navigator.clipboard
        .readText()
        .then((data) => passPasteText(data))
    }
  };

  const metaKeyHandlers: { [key: string]: () => void } = {
    ArrowLeft: () => passGoBackInTime(),
    ArrowRight: () => passGoForwardInTime(),
    c: () => handleCopyToClipboard(),
    o: () => props.setShowFileOpenDialog(true, 0),
    s: () => handleFileSave(false),
    v: () => syntheticPaste(),
  }

  const handleMetaKey = (key: string) => {
    if (key in metaKeyHandlers) {
      metaKeyHandlers[key]()
      return true
    }
    return false
  }

  const arrowKeys: { [key: string]: ARROW } = {
    ArrowLeft: ARROW.LEFT,
    ArrowRight: ARROW.RIGHT,
    ArrowUp: ARROW.UP,
    ArrowDown: ARROW.DOWN,
  };

  const isMac = navigator.platform.startsWith('Mac')

  const isOpenAppleDown = (e: keyEvent) => {
    return e.code === 'AltLeft'
  }

  const isOpenAppleUp = (e: keyEvent) => {
    return e.code === 'AltLeft'
  }

  const isClosedAppleDown = (e: keyEvent) => {
    return e.code === 'AltRight'
  }

  const isClosedAppleUp = (e: keyEvent) => {
    return e.code === 'AltRight'
  }

  // This is needed for Android, which does not send keydown/up events.
  // https://bugs.chromium.org/p/chromium/issues/detail?id=118639
  // https://stackoverflow.com/questions/36753548/keycode-on-android-is-always-229
  const handleOnInput = (e: FormEvent) => {
    if ('nativeEvent' in e) {
      const ev = e.nativeEvent as InputEvent
      const event = {
        key: '',
        code: '',
        shiftKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: () => { },
        stopPropagation: () => { }
      }
      // Is this a normal character, or a special one?
      if (ev.data) {
        event.key = ev.data as string
      } else if (ev.inputType === 'deleteContentBackward') {
        event.key = 'Backspace'
      } else if (ev.inputType === 'insertLineBreak') {
        event.key = 'Enter'
      }
      handleKeyDown(event as keyEvent)
    }
  }

  const isMetaSequence = (e: keyEvent): boolean => {
    // ctrl + "meta" but not shift
    return (!e.shiftKey && e.ctrlKey && (isMac ? (e.metaKey && e.key !== 'Meta') : (e.altKey && e.key !== 'Alt')));
  }

  const handleKeyDown = (e: keyEvent) => {
    let keyHandledLocal = false
    if (isOpenAppleDown(e)) {
      passAppleCommandKeyPress(true)
    }
    if (isClosedAppleDown(e)) {
      passAppleCommandKeyPress(false)
    }
    // TODO: What modifier key should be used on Windows? Can't use Ctrl
    // because that interferes with Apple II control keys like Ctrl+S
    //if (!e.shiftKey && (isMac ? (e.metaKey && e.key !== 'Meta') : (e.altKey && e.key !== 'Alt'))) {
    if (isMetaSequence(e)) {
      keyHandledLocal = handleMetaKey(e.key)
      // TODO: This allows Cmd+V to paste text, but breaks OpenApple+V.
      // How to handle both?
      //if (e.key === 'v') return;
    }
    // If we're paused, allow <space> to resume
    if (handleGetRunMode() === RUN_MODE.PAUSED && e.key === ' ') {
      passSetRunMode(RUN_MODE.RUNNING)
      keyHandledLocal = true
    }
    if (keyHandledLocal) {
      setKeyHandled(true)
      passAppleCommandKeyRelease(true)
      passAppleCommandKeyRelease(false)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (e.key in arrowKeys) {  // && handleGetArrowKeysAsJoystick()) {
      handleArrowKey(arrowKeys[e.key], false)
      e.preventDefault()
      e.stopPropagation()
      return
    }

    const capsLock = handleGetCapsLock()
    const key = convertAppleKey(e, capsLock, props.ctrlKeyMode);
    if (key > 0) {
      const key = convertAppleKey(e, capsLock, props.ctrlKeyMode);
      passKeypress(String.fromCharCode(key))
      e.preventDefault()
      e.stopPropagation()
    }
    if (props.ctrlKeyMode == 1) {
      props.handleCtrlDown(0)
    }
    if (props.openAppleKeyMode == 1) {
      props.handleOpenAppleDown(0)
    }
    if (props.closedAppleKeyMode == 1) {
      props.handleClosedAppleDown(0)
    }
  }

  const handleKeyUp = (e: keyEvent) => {
    if (isOpenAppleUp(e)) {
      passAppleCommandKeyRelease(true)
    } else if (isClosedAppleUp(e)) {
      passAppleCommandKeyRelease(false)
    } else if (e.key in arrowKeys) {
      handleArrowKey(arrowKeys[e.key], true)
    }
    if (keyHandled) {
      setKeyHandled(false)
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleResize = () => {
    if (myCanvas.current) {
      props.updateDisplay()
    }
  }

  const RenderCanvas = () => {
    if (myCanvas.current && hiddenCanvas.current) {
      const ctx = (myCanvas.current as HTMLCanvasElement).getContext('2d')
      const hiddenCtx = (hiddenCanvas.current as HTMLCanvasElement).getContext('2d')
      if (ctx && hiddenCtx) {
        ProcessDisplay(ctx, hiddenCtx, width, height)
      }
    }
    window.requestAnimationFrame(RenderCanvas)
  }

  const scaleMouseEvent = (event: MouseEvent): MouseEventSimple => {
    let x = 0
    let y = 0
    if (myCanvas.current) {
      [x, y] = canvasCoordToNormScreenCoord(myCanvas.current, event.clientX, event.clientY)
      x = Math.min(Math.max(x, 0), 1)
      y = Math.min(Math.max(y, 0), 1)
    }
    return { x, y, buttons: -1 }
  }

  const handleMouseDown = (event: MouseEvent) => {
    const evt = scaleMouseEvent(event)
    evt.buttons = event.button === 0 ? 0x10 : 0x11
    passMouseEvent(evt)
    if (handleGetOverrideHires()) {
      lockHgrViewRef.current = !lockHgrViewRef.current
      handleNewHgrViewCoord(event.clientX, event.clientY)
      setHgrview(hgrviewRef.current)
    }
  }

  const handleMouseUp = (event: MouseEvent) => {
    const evt = scaleMouseEvent(event)
    evt.buttons = event.button === 0 ? 0x00 : 0x01
    passMouseEvent(evt)
  }

  const handleNewHgrViewCoord = (clientX: number, clientY: number) => {
    let showView = false
    if (handleGetOverrideHires()) {
      if (myCanvas.current) {
        showView = true
        let [x, y] = canvasCoordToNormScreenCoord(myCanvas.current, clientX, clientY)
        x = Math.floor(x * 280)
        y = Math.floor(y * 192)
        if (x >= 0 && x < 280 && y >= 0 && y < 192) {
          // Make sure the showhgrview doesn't go off the edge of the screen.
          // Also shift it to the left so it falls more naturally on an
          // HGR screen byte boundary.
          x = Math.min(Math.max(Math.floor(x / 7), 0), 38) // Math.max(4, Math.min(x, 280 - 9)) - 4
          y = Math.max(3, Math.min(y, 191 - 4)) - 3
          if (!lockHgrViewRef.current) {
            setHgrviewLocal([x, y])
            hgrviewRef.current = [x, y]
          }
        }
      }
    }
    setShowhgrview(showView)
  }

  const handleMouseMove = (event: MouseEvent) => {
    const scaled = scaleMouseEvent(event)
    handleNewHgrViewCoord(event.clientX, event.clientY)
    passMouseEvent(scaled)
  }

  const drawBytes = (pixels: number[][]) => {
    if (infoCanvas.current) {
      const canvas = infoCanvas.current as HTMLCanvasElement
      const context = canvas.getContext('2d')
      if (context) {
        context.fillStyle = 'black'
        context.fillRect(0, 0, canvas.width, canvas.height)
        const tile = new Uint8Array(2 * nlines)
        for (let i = 0; i < nlines; i++) {
          tile[2 * i] = pixels[i][1]
          tile[2 * i + 1] = pixels[i][2]
        }
        context.imageSmoothingEnabled = false
        const addr = pixels[0][0]
        const isEven = addr % 2 === 0
        drawHiresTile(context, tile, COLOR_MODE.NOFRINGE,
          nlines, 0, 0, 11, isEven)
        // Draw 13 vertical lines
        for (let i = 1; i <= 13; i++) {
          const x = Math.round((canvas.width / 14) * i + 0.5) - 0.5;
          context.moveTo(x, 0);
          context.lineTo(x, canvas.height);
        }
        // Draw horizontal lines
        for (let i = 1; i <= nlines - 1; i++) {
          const y = Math.round((canvas.height / nlines) * i + 0.5) - 0.5;
          context.moveTo(0, y);
          context.lineTo(canvas.width, y);
        }
        context.strokeStyle = '#888';
        context.stroke();
      }
    }
  }

  const formatHgrView = () => {
    if (!myCanvas.current || hgrviewLocal[0] < 0) return <></>
    const pixels = getOverrideHiresPixels(hgrviewLocal[0], hgrviewLocal[1])
    if (!pixels) return <></>
    const result = pixels.map((line: Array<number>, i) => {
      return <div key={i}>{`${toHex(line[0])}: ${toHex(line[1], 2)} ${toHex(line[2], 2)}`}</div>
    })
    const [dx, dy] = screenBytesToCanvasPixels(myCanvas.current, 2, nlines)
    const col = 7 * hgrviewLocal[0]
    const row = hgrviewLocal[1]
    let [x, y] = screenCoordToCanvasCoord(myCanvas.current, col, row)
    x -= 2
    y -= 2
    setTimeout(() => drawBytes(pixels), 50)
    return <div className="hgr-view flex-row"
      style={{ left: `${x}px`, top: `${y}px` }}>
      <div className="hgr-view-box" style={{ width: `${dx}px`, height: `${dy}px` }}>&nbsp;</div>
      <div className="hgr-view-text">{result}</div>
      <canvas ref={infoCanvas}
        style={{ zIndex: "9999", border: "2px solid red" }}
        width={"154pt"} height={`${11 * nlines}pt`} />
    </div>
  }

  // We should probably be using a useEffect here, but when I tried that,
  // I needed to add dependencies such as RenderCanvas, and useEffect was then
  // called multiple times. Using an initialization flag forces this to
  // only get called once.
  if (!myInit) {
    const initialize = () => {
      if (myCanvas.current) {
        setMyInit(true)
        const canvas = myCanvas.current as HTMLCanvasElement
        canvas.addEventListener('mousemove', handleMouseMove)
        canvas.addEventListener('mousedown', handleMouseDown)
        canvas.addEventListener('mouseup', handleMouseUp)
        window.addEventListener("copy", () => { handleCopyToClipboard() })
        const paste = (e: object) => { pasteHandler(e as ClipboardEvent) }
        window.addEventListener("paste", paste)
        window.addEventListener("resize", handleResize)
        window.setInterval(() => { checkGamepad() }, 34)
        RenderCanvas()
        window.setTimeout(() => setStartTextPage(), 25);
      } else {
        // This doesn't ever seem to get hit. I guess just doing the 
        // setTimeout below (even with a timeout of 0) is enough to
        // let React get the "myCanvas" ref set properly.
        // But just leave it here as a backup.
        window.setTimeout(() => initialize(), 0);
      }
    }
    window.setTimeout(() => initialize(), 0);
  }

  const setFocus = () => {
    if (myText.current) {
      (myText.current as HTMLTextAreaElement).focus()
    } else if (myCanvas.current) {
      (myCanvas.current as HTMLCanvasElement).focus()
    }
  }

  [width, height] = getCanvasSize()

  // Make keyboard events work on touch devices by using a hidden textarea.
  const isTouchDevice = "ontouchstart" in document.documentElement
  const isAndroidDevice = /Android/i.test(navigator.userAgent);
  const txt = isAndroidDevice ?
    <textarea className="hiddenTextarea" hidden={false} ref={myText}
      onInput={handleOnInput} /> :
    (isTouchDevice ?
      <textarea className="hiddenTextarea" hidden={false} ref={myText}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      /> : <span></span>)

  if (handleGetOverrideHires() && updateHgr) {
    setTimeout(() => { setUpdateHgr(false) }, 0)
    // See if our view box position has changed, perhaps because the user
    // clicked on an HGR memory location in the memory dump panel.
    if (hgrview[0] !== -1 && hgrview[0] !== hgrviewLocal[0] && hgrview[1] !== hgrviewLocal[1]) {
      setHgrviewLocal(hgrview)
      hgrviewRef.current = hgrview
      setShowhgrview(true)
    }
  }

  const cursor = handleGetShowMouse() ?
    ((showhgrview && !lockHgrViewRef.current) ? "none" : "crosshair") : "none"

  return (
    <span className="canvasText">
      <canvas ref={myCanvas}
        id="apple2canvas"
        className="mainCanvas"
        style={{ cursor: cursor }}
        width={width} height={height}
        tabIndex={0}
        onKeyDown={isTouchDevice ? () => { null } : handleKeyDown}
        onKeyUp={isTouchDevice ? () => { null } : handleKeyUp}
        onMouseEnter={setFocus}
        onMouseDown={setFocus}
      />
      {/* Use hidden canvas/context so image rescaling works in iOS < 15.
          See graphics.ts drawImage() */}
      <canvas ref={hiddenCanvas}
        id="hiddenCanvas"
        hidden={true}
        width={560} height={384} />
      {txt}
      {showhgrview && formatHgrView()}
    </span>
  )
}

export default Apple2Canvas
