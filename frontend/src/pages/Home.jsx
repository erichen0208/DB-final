import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 overflow-hidden">
      {/* Top Title Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-800">RTree</h1>
        <p className="text-xl text-gray-600 mt-4">
          Choose a demo mode to continue
        </p>
      </div>

      {/* Button Container - Full Width */}
      <div className="flex w-full px-12">
        {/* Left Button */}
        <div className="w-1/2 px-6">
          <button
            onClick={() => navigate("/demo-realtime")}
            className="w-full h-64 bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white rounded-xl shadow-xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center p-8"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-20 w-20 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span className="text-2xl font-bold">Real-Time Demo</span>
            <span className="text-sm mt-2 opacity-80">
              Search cafes in real-time using RTree
            </span>
          </button>
        </div>

        {/* Right Button */}
        <div className="w-1/2 px-6">
          <button
            onClick={() => navigate("/demo-rtree")}
            className="w-full h-64 bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white rounded-xl shadow-xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center p-8"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-20 w-20 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4"
              />
            </svg>
            <span className="text-2xl font-bold">RTree Visualization</span>
            <span className="text-sm mt-2 opacity-80">
              Explore RTree structure and operations
            </span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-center text-gray-500 text-sm">
        <p>© 2025 Database Final Project - Group 8</p>
      </div>
    </div>
  );
}

export default Home;
