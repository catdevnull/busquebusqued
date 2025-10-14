import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SearchPage from "./search";
import Results from "./Results";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/search/:query" element={<Results />} />
      </Routes>
    </Router>
  );
}
