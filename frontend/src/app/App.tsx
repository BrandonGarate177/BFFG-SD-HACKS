import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MapPage } from "../features/map";
import { InsightsPage } from "../features/insights";

/**
 * The shell owns routing and nothing else. It is the ONLY module allowed to
 * reference both features - they never import each other, and communicate
 * solely through the URL (/parcel/:apn).
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        {/* apn is optional: /parcel opens the finder, /parcel/:apn the detail. */}
        <Route path="/parcel" element={<InsightsPage />} />
        <Route path="/parcel/:apn" element={<InsightsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
