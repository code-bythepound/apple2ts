import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWaveSquare,
} from "@fortawesome/free-solid-svg-icons";
import { changeMockingboardMode, getMockingboardMode, getMockingboardName } from "./mockingboard_audio";

export const MockingboardWaveform = () => {
  const [mockOpen, setMockOpen] = React.useState<boolean>(false)
  const [position, setPosition] = React.useState<{ x: number, y: number }>({ x: 0, y: 0 })

  const handleMockClick = (event: React.MouseEvent) => {
    const y = Math.min(event.clientY, window.innerHeight - 200)
    setPosition({ x: event.clientX, y: y })
    setMockOpen(true);
  }

  const handleMockClose = (index = -1) => {
    setMockOpen(false);
    if (index >= 0) changeMockingboardMode(index)
  }

  return (
    <span>
      <button
        id="basic-button"
        className="push-button"
        title="Mockingboard wave form"
        onClick={handleMockClick}
      >
        <FontAwesomeIcon icon={faWaveSquare} />
      </button>
      {mockOpen &&
        <div className="modal-overlay"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          onClick={() => handleMockClose()}>
          <div className="floating-dialog flex-column droplist-option"
            style={{ left: position.x, top: position.y }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div className="droplist-option" style={{ padding: '5px' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ccc'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'inherit'}
                key={i} onClick={() => handleMockClose(i)}>
                {i === getMockingboardMode() ? '\u2714\u2009' : '\u2003'}{getMockingboardName(i)}
              </div>))}
          </div>
        </div>
      }

    </span>
  )
}
