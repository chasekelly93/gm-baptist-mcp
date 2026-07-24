import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { NavBar } from "./components/NavBar";
import { RequireStaff } from "./components/RequireStaff";
import { SearchPage } from "./pages/SearchPage";
import { VideoDetailPage } from "./pages/VideoDetailPage";
import { AddEditVideoPage } from "./pages/AddEditVideoPage";

import { DashboardPage } from "./pages/DashboardPage";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const queryClient = new QueryClient();

import { AuthProvider } from "./components/AuthProvider";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <NavBar />
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/videos/:videoId" element={<VideoDetailPage />} />
            <Route path="/staff-login" element={<StaffLoginPage />} />
            <Route
              path="/add"
              element={<AddEditVideoPage />}
            />

            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
