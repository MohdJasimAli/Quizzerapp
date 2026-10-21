import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Components
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/StudentDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { TestBuilder } from './pages/TestBuilder';
import { QuestionEditor } from './pages/QuestionEditor';
import { TestPreview } from './pages/TestPreview';
import { InstructionsPage } from './pages/InstructionsPage';
import { TestTakingPage } from './pages/TestTakingPage';
import { SubmittedConfirmationPage } from './pages/SubmittedConfirmationPage';
import { ResultsPage } from './pages/ResultsPage';
import { StudentManagementPage } from './pages/StudentManagementPage';
import { TeacherManagementPage } from './pages/TeacherManagementPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

// Smart Home Redirector based on user role
const HomeRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
};

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public */}
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/login" element={<Login />} />

                {/* Student Routes */}
                <Route
                  path="/student/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:id/instructions"
                  element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <InstructionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:id/take"
                  element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <TestTakingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:id/submitted"
                  element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <SubmittedConfirmationPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/results/:attemptId"
                  element={
                    <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
                      <ResultsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Teacher & Admin Test Builder & Management */}
                <Route
                  path="/teacher/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <TeacherDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/create"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <TestBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:id/edit"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <TestBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:id/questions"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <QuestionEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:id/preview"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <TestPreview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tests/:testId/results"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <ResultsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Management Routes */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/students"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <StudentManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/teachers"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <TeacherManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/activity-logs"
                  element={
                    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                      <ActivityLogsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Common Protected Routes */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Not Found */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
