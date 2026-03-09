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
import Dimensions from './pages/admin/Dimensions'
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
import InterestSurvey from './pages/InterestSurvey'
import ResetPassword from './pages/ResetPassword'
import ExportReport from './pages/Export'
import NotFound from './pages/NotFound'
import SchoolsPage from './pages/system/Schools'

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

        {/* System admin routes */}
        <Route path="/system/schools" element={<SchoolsPage />} />

        {/* Admin routes */}
        <Route
          path="/admin/educators"
          element={
            <ProtectedRoute requiredRole="admin">
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
            <ProtectedRoute requiredRole="admin">
              <Families />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/family-view/:parentId"
          element={
            <ProtectedRoute requiredRole="admin">
              <FamilyView />
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
          path="/admin/dimensions"
          element={
            <ProtectedRoute requiredRole="admin">
              <Dimensions />
            </ProtectedRoute>
          }
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
          path="/settings"
          element={
            <ProtectedRoute requiredRole="admin">
              <SchoolProfile />
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
