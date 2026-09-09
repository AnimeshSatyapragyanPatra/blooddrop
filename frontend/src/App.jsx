import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import AdminOverview from "./pages/AdminOverview.jsx";
import AdminReports from "./pages/AdminReports.jsx";
import AdminVerifications from "./pages/AdminVerifications.jsx";
import DonorHome from "./pages/DonorHome.jsx";
import DonorProfile from "./pages/DonorProfile.jsx";
import FindDonors from "./pages/FindDonors.jsx";
import Login from "./pages/Login.jsx";
import MyRequests from "./pages/MyRequests.jsx";
import NearbyRequests from "./pages/NearbyRequests.jsx";
import NewRequest from "./pages/NewRequest.jsx";
import Notifications from "./pages/Notifications.jsx";
import Register from "./pages/Register.jsx";
import RequestDetail from "./pages/RequestDetail.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";
import Verification from "./pages/Verification.jsx";

const ALL_ROLES = ["donor", "requester", "admin"];

export default function App() {
  const { user, loading, homePath } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-stone-500">Loading BloodDrop…</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<DonorHome />} />
        <Route path="/nearby" element={<NearbyRequests />} />
        <Route path="/profile" element={<DonorProfile />} />
        <Route path="/notifications" element={<Notifications />} />

        <Route path="/requests" element={<MyRequests />} />
        <Route path="/requests/new" element={<NewRequest />} />
        <Route path="/requests/:id" element={<RequestDetail />} />

        <Route
          path="/donors"
          element={
            <ProtectedRoute roles={["requester", "admin", "donor"]}>
              <FindDonors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute roles={["requester", "donor"]}>
              <Verification />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verifications"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminVerifications />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to={user ? homePath() : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
