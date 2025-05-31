import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import DemoRealTime from "./pages/DemoRealTime";
import DemoRtree from "./pages/DemoRtree";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demo-realtime" element={<DemoRealTime />} />
      <Route path="/demo-rtree" element={<DemoRtree />} />
    </Routes>
  );
}

export default App;
