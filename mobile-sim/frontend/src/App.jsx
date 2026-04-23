import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import SimulatorPage from './pages/SimulatorPage'

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('tyb_token'))

  const handleLogin = (t) => {
    sessionStorage.setItem('tyb_token', t)
    setToken(t)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('tyb_token')
    setToken(null)
  }

  return token
    ? <SimulatorPage token={token} onLogout={handleLogout} />
    : <LoginPage onLogin={handleLogin} />
}
