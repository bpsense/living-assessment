import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Classrooms from './pages/Classrooms'
import Students from './pages/Students'
import LearnerProfileAdmin from './pages/admin/LearnerProfile'
import Educators from './pages/admin/Educators'
import EducatorProfilePage from './pages/admin/EducatorProfile'
import Families from './pages/admin/Families'
import FamilyView from './pages/admin/FamilyView'
import Departments from './pages/admin/Departments'
import Standards from './pages/Standards'
import Observe from './pages/Observe'
import Profile from './pages/Profile'
import SchoolProfile from './pages/SchoolProfile'
import StudentProfile from './pages/StudentProfile'
import RecordObservation from './pages/RecordObservation'
import ClassroomPage from './pages/Classroom'
import DepartmentDashboard from './pages/DepartmentDashboard'
import InterestSurvey from './pages/InterestSurvey'
import ResetPassword from './pages/ResetPassword'
import ExportReport from './pages/Export'
import NotFound from './pages/NotFound'
import SchoolsPage from './pages/system/Schools'
import SystemActivity from './pages/system/SystemActivity'
import UsersPage from './pages/admin/Users'
import LearnerProfile from './pages/LearnerProfile'
import Permissions from './pages/admin/Permissions'
import Messages from './pages/Messages'
import IncidentReportPage from './pages/IncidentReport'
import IncidentsPage from './pages/admin/IncidentsPage'
import SnapshotVisibility from './pages/admin/SnapshotVisibility'
import TranslatePage from './pages/Translate'

function PasswordRecoveryRedirect() {
  const { isPasswordRecovery } = useAuth()
  if (isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />
  }
  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Password reset — user arrives here after clicking the reset link in email */}
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Student-facing survey — token-based, no auth required */}
      <Route path="/survey/:token" element={<InterestSurvey />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/classrooms" element={<Classrooms />} />
        <Route path="/classroom/:id" element={<ClassroomPage />} />
        <Route path="/students" element={<Students />} />
        <Route path="/observe" element={<Observe />} />
        <Route path="/student/:id" element={<StudentProfile />} />
        <Route path="/student/:id/observe" element={<RecordObservation />} />
        <Route path="/export/:id" element={<ExportReport />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/department" element={<DepartmentDashboard />} />
        <Route path="/incident/:id" element={<IncidentReportPage />} />
        <Route path="/settings" element={<SchoolProfile />} />
        <Route path="/messages" element={<Messages />} />

        {/* Learner routes */}
        <Route path="/learner/profile" element={<LearnerProfile />} />

        {/* System admin routes */}
        <Route path="/system/schools" element={<SchoolsPage />} />
        <Route path="/system/activity" element={<SystemActivity />} />

        {/* User management — dept admins (4) and up */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute minAccessLevel={4}>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/educators"
          element={
            <ProtectedRoute requiredRole="admin" allowDepartmentAdmin>
              <Educators />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/educator/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <EducatorProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/families"
          element={
            <ProtectedRoute requiredRole="admin" allowDepartmentAdmin>
              <Families />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/family-view/:parentId"
          element={
            <ProtectedRoute requiredRole="admin" allowDepartmentAdmin>
              <FamilyView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/incidents"
          element={
            <ProtectedRoute requiredRole="admin">
              <IncidentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <ProtectedRoute requiredRole="admin">
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/learner-profile"
          element={
            <ProtectedRoute requiredRole="admin">
              <LearnerProfileAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dimensions"
          element={<Navigate to="/admin/learner-profile" replace />}
        />
        <Route
          path="/standards"
          element={
            <ProtectedRoute requiredRole="admin">
              <Standards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/translate"
          element={
            <ProtectedRoute requiredRole="admin">
              <TranslatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/permissions"
          element={
            <ProtectedRoute requiredRole="admin">
              <Permissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/snapshot-visibility"
          element={
            <ProtectedRoute requiredRole="admin" allowDepartmentAdmin>
              <SnapshotVisibility />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <ToastProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <PasswordRecoveryRedirect />
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthContext.Provider>
  )
}
