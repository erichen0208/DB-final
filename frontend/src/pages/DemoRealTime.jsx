import { useEffect, useState, useRef } from "react";

const DemoRealTime = () => {
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [searchParams, setSearchParams] = useState({
    lon: 121.565,
    lat: 25.033,
    radius: 2000,
    min_score: 40,
    crowd: 0.5,
    rating: 0.3,
    price: 0.7,
    distance: 0.8,
  });
  const [useSliders, setUseSliders] = useState({
    crowd: true,
    rating: true,
    price: true,
    distance: true,
  });
  const [mapScale, setMapScale] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapMode, setMapMode] = useState("drag");
  const [showRadiusPreview, setShowRadiusPreview] = useState(false);

  const readerRef = useRef(null);
  const controllerRef = useRef(null);
  const mapRef = useRef(null);
  const radiusTimeoutRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const mapBounds = {
    minLon: 121.49,
    maxLon: 121.61,
    minLat: 25.01,
    maxLat: 25.11,
  };

  // Calculate distance in meters between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate scale needed to show a specific distance (in meters) across the map
  const getScaleForDistance = (distanceInMeters) => {
    if (!mapRef.current) return 1;

    const rect = mapRef.current.getBoundingClientRect();
    const centerLat = (mapBounds.maxLat + mapBounds.minLat) / 2;
    const centerLon = (mapBounds.maxLon + mapBounds.minLon) / 2;

    // Calculate the distance that the full map width represents
    const mapWidthDistance = calculateDistance(
      centerLat,
      mapBounds.minLon,
      centerLat,
      mapBounds.maxLon
    );

    // Calculate scale needed to show the desired distance across the view
    const baseScale = mapWidthDistance / distanceInMeters;

    // Adjust for the actual viewport size vs map size
    const viewportRatio =
      Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);

    return baseScale * viewportRatio;
  };

  // Calculate max scale based on minimum useful view distance (1000 meters)
  const getMaxScale = () => {
    const minViewDistance = 1000; // 1000 meters minimum view
    return getScaleForDistance(minViewDistance);
  };

  // Focus on current position with 1000m view
  const focusOnPosition = () => {
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const targetScale = getScaleForDistance(2000); // 2000m view (1000m radius)

    // Calculate the position in pixel coordinates
    const position = getPixelPosition(searchParams.lon, searchParams.lat);

    // Center the view on the current position
    const newOffset = {
      x: rect.width / 2 - (position.x / 100) * rect.width * targetScale,
      y: rect.height / 2 - (position.y / 100) * rect.height * targetScale,
    };

    setMapScale(targetScale);
    setMapOffset(newOffset);
  };

  const handleMapClick = (event) => {
    if (!mapRef.current || mapMode !== "select") return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - mapOffset.x) / mapScale;
    const y = (event.clientY - rect.top - mapOffset.y) / mapScale;

    const lon =
      mapBounds.minLon +
      (x / rect.width) * (mapBounds.maxLon - mapBounds.minLon);
    const lat =
      mapBounds.maxLat -
      (y / rect.height) * (mapBounds.maxLat - mapBounds.minLat);

    // Clamp coordinates to map bounds
    const clampedLon = Math.max(
      mapBounds.minLon,
      Math.min(mapBounds.maxLon, lon)
    );
    const clampedLat = Math.max(
      mapBounds.minLat,
      Math.min(mapBounds.maxLat, lat)
    );

    setSearchParams((prev) => ({
      ...prev,
      lon: parseFloat(clampedLon.toFixed(6)),
      lat: parseFloat(clampedLat.toFixed(6)),
    }));
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate zoom center relative to current view
    const zoomCenterX = (mouseX - mapOffset.x) / mapScale;
    const zoomCenterY = (mouseY - mapOffset.y) / mapScale;

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const maxScale = getMaxScale();
    const newScale = Math.max(0.5, Math.min(maxScale, mapScale * delta));

    if (newScale !== mapScale) {
      // Adjust offset to zoom towards mouse position
      const newOffset = {
        x: mouseX - zoomCenterX * newScale,
        y: mouseY - zoomCenterY * newScale,
      };

      setMapScale(newScale);
      setMapOffset(newOffset);
    }
  };

  const handleMouseDown = (event) => {
    if (mapMode !== "drag") return;

    setIsDragging(true);
    setDragStart({
      x: event.clientX - mapOffset.x,
      y: event.clientY - mapOffset.y,
    });
  };

  const handleMouseMove = (event) => {
    if (!isDragging || mapMode !== "drag") return;
    setMapOffset({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getPixelPosition = (lon, lat) => {
    const x =
      ((lon - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon)) * 100;
    const y =
      ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  // Get current view distance in meters
  const getCurrentViewDistance = () => {
    if (!mapRef.current) return 0;

    const rect = mapRef.current.getBoundingClientRect();
    const centerLat = (mapBounds.maxLat + mapBounds.minLat) / 2;

    // Calculate the distance that the full map width represents
    const mapWidthDistance = calculateDistance(
      centerLat,
      mapBounds.minLon,
      centerLat,
      mapBounds.maxLon
    );

    // Calculate current view distance based on scale
    const viewportRatio =
      Math.min(rect.width, rect.height) / Math.max(rect.width, rect.height);
    return mapWidthDistance / mapScale / viewportRatio;
  };

  // Handle radius change with preview
  const handleRadiusChange = (newRadius) => {
    setSearchParams((prev) => ({
      ...prev,
      radius: newRadius,
    }));

    // Show preview and set timeout to hide it
    setShowRadiusPreview(true);
    if (radiusTimeoutRef.current) {
      clearTimeout(radiusTimeoutRef.current);
    }
    radiusTimeoutRef.current = setTimeout(() => {
      setShowRadiusPreview(false);
    }, 500); // Hide after 1 second
  };

  // Calculate radius size in pixels for visualization
  const getRadiusSize = () => {
    if (!mapRef.current) return 0;

    const rect = mapRef.current.getBoundingClientRect();
    const centerLat = (mapBounds.maxLat + mapBounds.minLat) / 2;

    // Calculate the distance that the full map width represents
    const mapWidthDistance = calculateDistance(
      centerLat,
      mapBounds.minLon,
      centerLat,
      mapBounds.maxLon
    );

    // Calculate radius as percentage of map width
    const radiusPercentage = (searchParams.radius / mapWidthDistance) * 100;

    return radiusPercentage * 2; // Remove cap to allow any size
  };

  // Update weights in backend
  const updateWeights = async () => {
    try {
      const weights = {};
      if (useSliders.crowd) weights.current_crowd = searchParams.crowd;
      if (useSliders.rating) weights.rating = searchParams.rating;
      if (useSliders.price) weights.price = searchParams.price;
      if (useSliders.distance) weights.distance = searchParams.distance;

      await fetch(`${API_URL}/api/update/weights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights),
      });
    } catch (error) {
      console.error("Error updating weights:", error);
    }
  };

  // Streaming search function
  const startSearchStreaming = async (isSearchAll = false) => {
    if (streaming) return;
    setLoading(true);
    setStreaming(true);
    setCafes([]);

    try {
      // Update weights first
      await updateWeights();

      // Prepare query parameters
      const queryParams = new URLSearchParams({
        lon: searchParams.lon.toString(),
        lat: searchParams.lat.toString(),
        radius: isSearchAll ? "0" : searchParams.radius.toString(),
        min_score: isSearchAll ? "-1" : searchParams.min_score.toString(),
      });

      const response = await fetch(
        `${API_URL}/api/search/cafes/regular?${queryParams}`
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      readerRef.current = reader;
      controllerRef.current = new AbortController();

      const decoder = new TextDecoder();
      let buffer = "";

      const processChunk = async ({ done, value }) => {
        if (done || controllerRef.current?.signal.aborted) {
          setLoading(false);
          setStreaming(false);
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const start = buffer.indexOf("{");
          if (start === -1) break;

          let braceCount = 0;
          let end = start;

          for (let i = start; i < buffer.length; i++) {
            if (buffer[i] === "{") braceCount++;
            if (buffer[i] === "}") braceCount--;
            if (braceCount === 0) {
              end = i;
              break;
            }
          }

          if (braceCount !== 0) break;

          const jsonStr = buffer.slice(start, end + 1);
          buffer = buffer.slice(end + 1);

          try {
            const cafe = JSON.parse(jsonStr);
            setCafes((prev) => [...prev, cafe]);
            await new Promise((resolve) => setTimeout(resolve, 10));
          } catch (err) {
            console.error("Error parsing JSON:", err);
            break;
          }
        }

        if (!controllerRef.current?.signal.aborted) {
          return reader.read().then(processChunk);
        }
      };

      reader.read().then(processChunk);
    } catch (error) {
      console.error("Error starting stream:", error);
      setLoading(false);
      setStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (controllerRef.current) controllerRef.current.abort();
    if (readerRef.current) readerRef.current.cancel();
    setLoading(false);
    setStreaming(false);
  };

  const clearData = () => setCafes([]);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, mapMode]);

  useEffect(() => {
    return () => {
      stopStreaming();
      if (radiusTimeoutRef.current) {
        clearTimeout(radiusTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-50 p-4">
      <div className="h-full flex gap-4">
        {/* Left Panel - Controls */}
        <div className="w-1/3 flex flex-col space-y-4">
          {/* Search Parameters */}
          <div className="bg-white rounded-lg shadow p-4">
            {/* Location */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={searchParams.lon}
                  onChange={(e) =>
                    setSearchParams((prev) => ({
                      ...prev,
                      lon: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={searchParams.lat}
                  onChange={(e) =>
                    setSearchParams((prev) => ({
                      ...prev,
                      lat: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button
                onClick={() => startSearchStreaming(false)}
                disabled={loading || streaming}
                className={`py-1 px-2 text-xs rounded transition-colors ${
                  loading || streaming
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-green-500 hover:bg-green-600 text-black"
                }`}
              >
                Search
              </button>
              <button
                onClick={() => startSearchStreaming(true)}
                disabled={streaming || loading}
                className={`py-1 px-2 text-xs rounded transition-colors ${
                  streaming || loading
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-blue-500 hover:bg-blue-600 text-black"
                }`}
              >
                Search All
              </button>
              <button
                onClick={stopStreaming}
                disabled={!streaming}
                className={`py-1 px-2 text-xs rounded transition-colors ${
                  !streaming
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-red-500 hover:bg-red-600 text-black"
                }`}
              >
                Stop
              </button>
              <button
                onClick={clearData}
                disabled={streaming || loading}
                className={`py-1 px-2 text-xs rounded transition-colors ${
                  streaming || loading
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-gray-500 hover:bg-gray-600 text-black"
                }`}
              >
                Clear
              </button>
            </div>

            {/* All Sliders */}
            <div className="grid grid-cols-2 gap-3">
              {/* Radius */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Radius
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="100"
                    value={searchParams.radius}
                    onChange={(e) =>
                      handleRadiusChange(parseInt(e.target.value))
                    }
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="100"
                    value={searchParams.radius}
                    onChange={(e) =>
                      handleRadiusChange(parseInt(e.target.value) || 0)
                    }
                    className="w-16 px-1 py-0.5 border rounded text-xs text-center"
                  />
                </div>
              </div>

              {/* Min Score */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Min Score
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={searchParams.min_score}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        min_score: parseInt(e.target.value),
                      }))
                    }
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={searchParams.min_score}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        min_score: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-16 px-1 py-0.5 border rounded text-xs text-center"
                  />
                </div>
              </div>

              {/* Crowd */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={useSliders.crowd}
                    onChange={(e) =>
                      setUseSliders((prev) => ({
                        ...prev,
                        crowd: e.target.checked,
                      }))
                    }
                    className="w-3 h-3"
                  />
                  <label className="block text-sm text-gray-600">Crowd</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.crowd}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        crowd: parseFloat(e.target.value),
                      }))
                    }
                    disabled={!useSliders.crowd}
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.crowd.toFixed(2)}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        crowd: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled={!useSliders.crowd}
                    className="w-16 px-1 py-0.5 border rounded text-xs text-center disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Rating */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={useSliders.rating}
                    onChange={(e) =>
                      setUseSliders((prev) => ({
                        ...prev,
                        rating: e.target.checked,
                      }))
                    }
                    className="w-3 h-3"
                  />
                  <label className="block text-sm text-gray-600">Rating</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.rating}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        rating: parseFloat(e.target.value),
                      }))
                    }
                    disabled={!useSliders.rating}
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.rating.toFixed(2)}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        rating: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled={!useSliders.rating}
                    className="w-16 px-1 py-0.5 border rounded text-xs text-center disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={useSliders.price}
                    onChange={(e) =>
                      setUseSliders((prev) => ({
                        ...prev,
                        price: e.target.checked,
                      }))
                    }
                    className="w-3 h-3"
                  />
                  <label className="block text-sm text-gray-600">Price</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.price}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        price: parseFloat(e.target.value),
                      }))
                    }
                    disabled={!useSliders.price}
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.price.toFixed(2)}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        price: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled={!useSliders.price}
                    className="w-16 px-1 py-0.5 border rounded text-xs text-center disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Distance */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={useSliders.distance}
                    onChange={(e) =>
                      setUseSliders((prev) => ({
                        ...prev,
                        distance: e.target.checked,
                      }))
                    }
                    className="w-3 h-3"
                  />
                  <label className="block text-sm text-gray-600">
                    Distance
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.distance}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        distance: parseFloat(e.target.value),
                      }))
                    }
                    disabled={!useSliders.distance}
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={searchParams.distance.toFixed(2)}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        distance: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled={!useSliders.distance}
                    className="w-16 px-1 py-0.5 border rounded text-xs text-center disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="mt-3 pt-3 border-t flex justify-between text-sm">
              <span>
                Status:{" "}
                {streaming ? "Streaming" : loading ? "Searching" : "Ready"}
              </span>
              <span>Results: {cafes.length}</span>
            </div>
          </div>

          {/* Cafe Results - Fixed height with scroller */}
          <div className="bg-white rounded-lg shadow flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b">
              <h3 className="text-lg font-semibold">
                Results ({cafes.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cafes.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="text-2xl mb-2">☕</div>
                  <p className="text-sm">No results yet</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {cafes.map((cafe, index) => (
                    <li
                      key={`${cafe.id}-${index}`}
                      className="p-3 hover:bg-gray-50"
                    >
                      <div className="flex justify-between">
                        <div>
                          <div className="font-medium text-sm">{cafe.name}</div>
                          <div className="text-xs text-gray-500">
                            {cafe.lat?.toFixed(4)}, {cafe.lon?.toFixed(4)}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="text-yellow-600">★ {cafe.rating}</div>
                          <div
                            className={`font-medium ${
                              cafe.current_crowd > 70
                                ? "text-red-600"
                                : cafe.current_crowd > 40
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {cafe.current_crowd}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Full Map */}
        <div className="w-2/3 bg-white rounded-lg shadow overflow-hidden">
          <div className="h-full relative">
            {/* Map Mode Toggle */}
            <div className="absolute top-4 left-4 bg-white bg-opacity-90 px-2 py-1 rounded text-sm z-10 border">
              <div className="flex gap-2">
                <button
                  onClick={() => setMapMode("drag")}
                  className={`px-3 py-1 rounded text-xs ${
                    mapMode === "drag"
                      ? "bg-blue-500 text-black"
                      : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                  }`}
                >
                  🖐️ Drag
                </button>
                <button
                  onClick={() => setMapMode("select")}
                  className={`px-3 py-1 rounded text-xs ${
                    mapMode === "select"
                      ? "bg-blue-500 text-black"
                      : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                  }`}
                >
                  📍 Select
                </button>
              </div>
            </div>

            {/* Map Scale Ruler */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 px-2 py-1 rounded text-sm z-10 border">
              View: {Math.round(getCurrentViewDistance())}m • Scale:{" "}
              {mapScale.toFixed(1)}x
            </div>

            {/* Control Buttons */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button
                onClick={focusOnPosition}
                className="bg-white bg-opacity-90 hover:bg-opacity-100 px-3 py-1 rounded border text-sm"
              >
                📍 Focus (1km)
              </button>
              <button
                onClick={() => {
                  setMapScale(1);
                  setMapOffset({ x: 0, y: 0 });
                }}
                className="bg-white bg-opacity-90 hover:bg-opacity-100 px-3 py-1 rounded border text-sm"
              >
                🗺️ Full View
              </button>
            </div>

            {/* Full Map */}
            <div
              ref={mapRef}
              onClick={handleMapClick}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              className={`w-full h-full bg-gradient-to-br from-blue-100 to-green-100 relative overflow-hidden ${
                mapMode === "drag" ? "cursor-grab" : "cursor-crosshair"
              } ${isDragging ? "cursor-grabbing" : ""}`}
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${20 * mapScale}px ${20 * mapScale}px`,
                backgroundPosition: `${mapOffset.x}px ${mapOffset.y}px`,
              }}
            >
              {/* Map Content with Transform */}
              <div
                style={{
                  transform: `scale(${mapScale}) translate(${
                    mapOffset.x / mapScale
                  }px, ${mapOffset.y / mapScale}px)`,
                  transformOrigin: "0 0",
                  width: "100%",
                  height: "100%",
                  position: "relative",
                }}
              >
                {/* Current Position */}
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 text-xl"
                  style={{
                    left: `${
                      getPixelPosition(searchParams.lon, searchParams.lat).x
                    }%`,
                    top: `${
                      getPixelPosition(searchParams.lon, searchParams.lat).y
                    }%`,
                  }}
                >
                  📍
                </div>

                {/* Radius Preview Rectangle - only show when adjusting radius */}
                {showRadiusPreview && !streaming && !loading && (
                  <div
                    className="absolute border-2 border-red-400 border-dashed bg-red-100 bg-opacity-10"
                    style={{
                      left: `${
                        getPixelPosition(searchParams.lon, searchParams.lat).x
                      }%`,
                      top: `${
                        getPixelPosition(searchParams.lon, searchParams.lat).y
                      }%`,
                      width: `${getRadiusSize()}%`,
                      height: `${getRadiusSize()}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: 15,
                    }}
                  />
                )}

                {/* Cafe Markers */}
                {cafes.map((cafe, index) => {
                  const position = getPixelPosition(cafe.lon, cafe.lat);
                  return (
                    <div
                      key={`${cafe.id}-${index}`}
                      className={`absolute w-1.5 h-1.5 rounded-full transform -translate-x-0.5 -translate-y-0.5 ${
                        cafe.current_crowd > 70
                          ? "bg-red-600"
                          : cafe.current_crowd > 40
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                      }}
                      title={`${cafe.name} - ${cafe.current_crowd}`}
                    />
                  );
                })}

                {/* Map Labels */}
                <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                  {mapBounds.minLon.toFixed(3)}°, {mapBounds.maxLat.toFixed(3)}°
                </div>
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                  {mapBounds.minLon.toFixed(3)}°, {mapBounds.minLat.toFixed(3)}°
                </div>
                <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                  {mapBounds.maxLon.toFixed(3)}°, {mapBounds.maxLat.toFixed(3)}°
                </div>
                <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                  {mapBounds.maxLon.toFixed(3)}°, {mapBounds.minLat.toFixed(3)}°
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-2 rounded text-xs">
              <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                  <span>Position</span>
                </div>
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                  <span>Low</span>
                </div>
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1"></div>
                  <span>Med</span>
                </div>
                <div className="flex items-center">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1"></div>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoRealTime;
