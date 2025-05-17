// src/App.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlay, FaPause, FaStepForward, FaStepBackward } from "react-icons/fa";
import TreeVisualization from "./components/TreeVisualization";
import SpatialView from "./components/SpatialView";
import Controls from "./components/Controls";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [frameData, setFrameData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch list of all frames
  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/frames`)
      .then((response) => {
        setFrames(response.data);
        if (response.data.length > 0) {
          loadFrame(response.data[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error fetching frames:", error);
        setError(
          "Failed to load frames. Please check if the server is running."
        );
        setLoading(false);
      });
  }, []);

  // Handle auto-play
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentFrame((prev) => {
          const nextFrame = prev + 1;
          if (nextFrame < frames.length) {
            loadFrame(frames[nextFrame].id);
            return nextFrame;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 1500);

      setPlayInterval(interval);
    } else if (playInterval) {
      clearInterval(playInterval);
      setPlayInterval(null);
    }

    return () => {
      if (playInterval) clearInterval(playInterval);
    };
  }, [isPlaying, frames]);

  const loadFrame = (frameId) => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/frames/${frameId}`)
      .then((response) => {
        setFrameData(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(`Error fetching frame ${frameId}:`, error);
        setError(`Failed to load frame ${frameId}.`);
        setLoading(false);
      });
  };

  const formatOperation = (operation, operationId) => {
    if (!operation) return "";

    let formattedOp = operation.replace("_", " ");
    formattedOp = formattedOp.charAt(0).toUpperCase() + formattedOp.slice(1);

    if (operationId >= 0) {
      formattedOp += ` (ID: ${operationId})`;
    }

    return formattedOp;
  };

  return (
    <div className="min-h-screen w-screen flex flex-col overflow-hidden">
      {/* Header */}
      {/* <header className="bg-blue-500 text-white shadow-lg py-2">
        <div className="container mx-auto px-4">
          <h1 className="text-xl font-bold text-center">RTree Visualization</h1>
        </div>
      </header> */}

      {/* Main content */}
      <main className="flex-grow container mx-auto px-4 py-4 overflow-hidden">
        {loading && !frameData ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500 text-xl">
              Loading visualization data...
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p>{error}</p>
          </div>
        ) : frameData ? (
          <>
            {/* Operation info */}
            <div className="bg-blue-100 rounded-lg shadow-md p-4 mb-6">
              <div className="flex flex-col md:flex-row justify-between items-center">
                {/* Operation Info */}
                <div className="mb-3 md:mb-0">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {formatOperation(
                        frameData.operation,
                        frameData.operationId
                      )}
                    </h2>
                    <p className="text-gray-600">
                      Tree Size: {frameData.treeSize}
                    </p>
                  </div>
                  <div className="text-gray-600 mt-1">
                    Frame: {currentFrame + 1} / {frames.length}
                  </div>
                </div>

                {/* Controls */}
                <div>
                  <Controls
                    currentFrame={currentFrame}
                    totalFrames={frames.length}
                    onPrev={() => {
                      if (currentFrame > 0) {
                        const prevFrame = currentFrame - 1;
                        setCurrentFrame(prevFrame);
                        loadFrame(frames[prevFrame].id);
                      }
                    }}
                    onNext={() => {
                      if (currentFrame < frames.length - 1) {
                        const nextFrame = currentFrame + 1;
                        setCurrentFrame(nextFrame);
                        loadFrame(frames[nextFrame].id);
                      }
                    }}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                  />
                </div>
              </div>
            </div>

            {/* Visualization container */}
            <div className="grid md:grid-cols-2 gap-4 mb-2 mt-2 h-[calc(100vh-220px)]">
              {/* Spatial View */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <h3 className="font-medium text-gray-700">Spatial View</h3>
                </div>
                <div className="p-2 h-[calc(100%-40px)]">
                  <SpatialView data={frameData} />
                </div>
              </div>

              {/* Tree View */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <h3 className="font-medium text-gray-700">Tree Structure</h3>
                </div>
                <div className="p-2 h-[calc(100%-40px)]">
                  <TreeVisualization data={frameData} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
            <p>
              No visualization data available. Please make sure you've generated
              frame files.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-1 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>RTree Visualization &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
