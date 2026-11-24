import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";
import SignupPage from "./pages/Signup";
import MapView from "./pages/MapView";
import About from "./pages/About";
import Assistant from "./pages/Assistant";
import News from "./pages/News";
import ProtectedRoute from "./components/ProtectedRoute";
import "./index.css";

// Render's free tier sleeps after 15 idle minutes; wake the API while the user reads the landing page.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
fetch(API_URL.replace(/\/api\/?$/, "") + "/health").catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<App />} />
            <Route path="/about" element={<About />} />
            
            {/* Protected routes - require authentication */}
            <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
            <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
            <Route path="/mapview" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
