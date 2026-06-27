import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Editor from './pages/Editor'
import Admin from './pages/Admin'
import Suggestions from './pages/Suggestions'
import Present from './pages/Present'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#C9A84C'}}>Cargando...</div>
  return user ? children : <Navigate to="/login" />
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to="/dashboard" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/jpestudio">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
          <Route path="/editor/:tipo/:id?" element={<PrivateRoute><Editor /></PrivateRoute>} />
          <Route path="/suggestions" element={<PrivateRoute><Suggestions /></PrivateRoute>} />
          <Route path="/present/:id" element={<PrivateRoute><Present /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
