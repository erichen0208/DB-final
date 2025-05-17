// src/components/Controls.jsx
import React from "react";
import { FaPlay, FaPause, FaStepForward, FaStepBackward } from "react-icons/fa";

function Controls({
  currentFrame,
  totalFrames,
  onPrev,
  onNext,
  isPlaying,
  onTogglePlay,
}) {
  return (
    <div className="bg-gray-100 rounded-lg shadow-md p-4">
      <div className="flex justify-center items-center space-x-6">
        <button
          onClick={onPrev}
          disabled={currentFrame === 0}
          className={`flex items-center justify-center w-16 h-16 rounded-full ${
            currentFrame === 0
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-black hover:bg-blue-700"
          }`}
          aria-label="Previous frame"
        >
          <FaStepBackward />
        </button>

        <button
          onClick={onTogglePlay}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-black hover:bg-blue-700"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <FaPause size={24} /> : <FaPlay size={24} />}
        </button>

        <button
          onClick={onNext}
          disabled={currentFrame === totalFrames - 1}
          className={`flex items-center justify-center w-16 h-16 rounded-full ${
            currentFrame === totalFrames - 1
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-black hover:bg-blue-700"
          }`}
          aria-label="Next frame"
        >
          <FaStepForward />
        </button>
      </div>
    </div>
  );
}

export default Controls;
