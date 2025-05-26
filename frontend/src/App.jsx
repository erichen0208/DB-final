// src/App.jsx
import React, { useState, useEffect, use } from "react";
import axios from "axios";
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
  const [mode, setMode] = useState("insert"); // Default mode is insert
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showAllNodes, setShowAllNodes] = useState(true);

  const [searchPaths, setSearchPaths] = useState([]);
  const [currentSearchPathIndex, setCurrentSearchPathIndex] = useState(0);
  const [activeSearchNode, setActiveSearchNode] = useState(null);
  const [isSearchPathPlaying, setIsSearchPathPlaying] = useState(false);
  const [searchPathPlayInterval, setSearchPathPlayInterval] = useState(null);

  const handleNodeHover = (nodeData) => {
    setHoveredNode(nodeData);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Always start with ID 0 for both modes
    if (mode === "insert") {
      loadFrame(0, "insert");
    } else if (mode === "search") {
      loadFrame(0, "search");
    }
  }, [mode]); // Re-run when mode changes

  const loadFrame = (frameId, currentMode = mode) => {
    setLoading(true);
    const url = `${API_URL}/api/${currentMode}/frames/${frameId}`;

    axios.get(url).then((response) => {
      setFrameData(response.data);
      setLoading(false);

      if (currentMode === "search") {
        // Create a default search path if not already in the response
        if (response.data.searchPaths && response.data.searchPaths.length > 0) {
          setSearchPaths(response.data.searchPaths);
          setActiveSearchNode(response.data.searchPaths[0]);
          setCurrentSearchPathIndex(0);
        } else {
          // Create a basic search path from tree nodes
          const treeNodes = response.data.treeNodes || [];
          if (treeNodes.length > 0) {
            // Create a simple path from root to leaf nodes
            const simplePath = treeNodes
              .filter((node) => !node.isDataPoint)
              .sort((a, b) => (b.level || 0) - (a.level || 0));

            if (simplePath.length > 0) {
              setSearchPaths(simplePath);
              setActiveSearchNode(simplePath[0]);
              setCurrentSearchPathIndex(0);
            }
          }
        }
      } else if (currentMode === "insert" && frames.length === 0) {
        // For insert mode, use exactly 100 frames since we know that's the total
        const frameIds = Array.from({ length: 100 }, (_, i) => ({
          id: i,
        }));
        setFrames(frameIds);
        setCurrentFrame(frameId);
      }
    });
  };

  // Handle auto-play
  useEffect(() => {
    if (isPlaying && mode === "insert") {
      const interval = setInterval(() => {
        setCurrentFrame((prev) => {
          const nextFrame = prev + 1;
          if (nextFrame < frames.length) {
            loadFrame(frames[nextFrame].id, mode);
            return nextFrame;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 500);

      setPlayInterval(interval);
    } else if (playInterval) {
      clearInterval(playInterval);
      setPlayInterval(null);
    }

    return () => {
      if (playInterval) clearInterval(playInterval);
    };
  }, [isPlaying, frames, mode]);

  useEffect(() => {
    if (isSearchPathPlaying && searchPaths.length > 0) {
      const interval = setInterval(() => {
        setCurrentSearchPathIndex((prev) => {
          const nextIndex = prev + 1;
          if (nextIndex < searchPaths.length) {
            setActiveSearchNode(searchPaths[nextIndex]);
            return nextIndex;
          } else {
            setIsSearchPathPlaying(false);
            return prev;
          }
        });
      }, 500); // Slightly slower than insert animation for clarity

      setSearchPathPlayInterval(interval);
    } else if (searchPathPlayInterval) {
      clearInterval(searchPathPlayInterval);
      setSearchPathPlayInterval(null);
    }

    return () => {
      if (searchPathPlayInterval) clearInterval(searchPathPlayInterval);
    };
  }, [isSearchPathPlaying, searchPaths]);

  const handlePrevSearchPath = () => {
    if (currentSearchPathIndex > 0) {
      const prevIndex = currentSearchPathIndex - 1;
      setCurrentSearchPathIndex(prevIndex);
      setActiveSearchNode(searchPaths[prevIndex]);
    }
  };

  const handleNextSearchPath = () => {
    if (currentSearchPathIndex < searchPaths.length - 1) {
      const nextIndex = currentSearchPathIndex + 1;
      setCurrentSearchPathIndex(nextIndex);
      setActiveSearchNode(searchPaths[nextIndex]);
    }
  };

  // Handle mode change
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setCurrentFrame(0);
    setIsPlaying(false);
    setIsSearchPathPlaying(false);
    // Search paths will be set when loadFrame is called
  };

  const formatOperation = (operation, operationId) => {
    if (!operation) return "Unknown Operation";

    const formattedOp = operation.charAt(0).toUpperCase() + operation.slice(1);

    if (operationId !== undefined && operationId !== null) {
      return `${formattedOp} Operation #${operationId}`;
    }
    return `${formattedOp} Operation`;
  };

  return (
    <div className="min-h-screen w-screen flex flex-col overflow-hidden">
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
                    {mode === "insert" && (
                      <span>
                        Frame: {currentFrame + 1} / {frames.length}
                      </span>
                    )}
                    {mode === "search" && <span>Search Result</span>}
                  </div>
                </div>

                {/* Mode Selector with Toggle Buttons */}
                <div className="flex items-center space-x-4">
                  <div className="mb-3 md:mb-0">
                    <select
                      value={mode}
                      onChange={(e) => handleModeChange(e.target.value)}
                      className="px-1 py-1 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="insert">Insert</option>
                      <option value="search">Search</option>
                    </select>
                  </div>
                  {/* Controls - Only show for insert mode */}
                  {mode === "insert" ? (
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
                  ) : searchPaths.length > 0 ? (
                    <div>
                      <Controls
                        currentFrame={currentSearchPathIndex}
                        totalFrames={searchPaths.length}
                        onPrev={handlePrevSearchPath}
                        onNext={handleNextSearchPath}
                        isPlaying={isSearchPathPlaying}
                        onTogglePlay={() =>
                          setIsSearchPathPlaying(!isSearchPathPlaying)
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Rest of your visualization components */}
            <div className="grid md:grid-cols-2 gap-4 mb-2 mt-2 h-[calc(100vh-220px)]">
              {/* Spatial View */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
                <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
                  <h3 className="font-medium text-gray-700">Spatial View</h3>
                  <div
                    onClick={() => setShowAllNodes(!showAllNodes)}
                    role="checkbox"
                    aria-checked={showAllNodes}
                    tabIndex={0}
                    className={`w-8 h-8 rounded-full cursor-pointer focus:outline-none flex items-center justify-center transition-colors duration-200 ${
                      showAllNodes ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                </div>

                <div className="p-2 h-[calc(100%-40px)]">
                  <SpatialView
                    data={frameData}
                    hoveredNode={hoveredNode}
                    showAllNodes={showAllNodes}
                  />
                </div>
              </div>

              {/* Tree View */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden h-full">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <h3 className="font-medium text-gray-700">Tree Structure</h3>
                </div>
                <div className="p-2 h-[calc(100%-40px)]">
                  <TreeVisualization
                    data={frameData}
                    onNodeHover={handleNodeHover}
                    activeSearchNode={activeSearchNode}
                    mode={mode}
                  />
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
