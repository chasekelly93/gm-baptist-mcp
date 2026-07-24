import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { RequireStaff } from "./components/RequireStaff";
import { SearchPage } from "./pages/SearchPage";
import { VideoDetailPage } from "./pages/VideoDetailPage";
import { AddEditVideoPage } from "./pages/AddEditVideoPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/videos/:videoId" element={<VideoDetailPage />} />
        <Route path="/staff-login" element={<StaffLoginPage />} />
        <Route
          path="/add"
          element={
            <RequireStaff>
              <AddEditVideoPage />
            </RequireStaff>
          }
        />
        <Route
          path="/categories"
          element={
            <RequireStaff>
              <CategoriesPage />
            </RequireStaff>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireStaff>
              <DashboardPage />
            </RequireStaff>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
