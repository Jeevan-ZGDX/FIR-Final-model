import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HOME from "./Pages/Home";
import FIRServices from "./Pages/FIRServices";
import FIRForm from "./Components/FIRForm";
import FIRAudio from "./Components/FIRAudio";
import FIRLogs from "./Pages/FIRLogs";
import VictimDashboard from "./Pages/VictimDashboard";
import GovDashboard from "./Pages/GovDashboard";

function App() {
  return (
    <Router>
      <Routes>
        {/* Home Page */}
        <Route path="/" element={<HOME />} />

        {/* FIR Services Page */}
        <Route path="/services" element={<FIRServices />}>
          <Route path="form" element={<FIRForm />} />
          <Route path="audio" element={<FIRAudio />} />
        </Route>

        {/* FIR Logs Page */}
        <Route path="/fir-logs" element={<FIRLogs />} />

        {/* Role-based Dashboards */}
        <Route path="/victim" element={<VictimDashboard />} />
        <Route path="/gov" element={<GovDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
