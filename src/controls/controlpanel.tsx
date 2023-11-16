import ConfigButtons from "./configbuttons";
import ControlButtons from "./controlbuttons";
import DebugButtons from "./debugbuttons";
import FullScreenButton from "./fullscreenbutton";
import KeyboardButtons from "./keyboardbuttons";

const ControlPanel = (props: DisplayProps) => {
  return (
    <span className="flexColumn">
      <span className="flexRow wrap">
      <ControlButtons {...props}/>
      <DebugButtons {...props}/>
      <ConfigButtons {...props}/>
      <FullScreenButton {...props}/>
      </span>
      <KeyboardButtons/>
    </span>
  )
}

export default ControlPanel;