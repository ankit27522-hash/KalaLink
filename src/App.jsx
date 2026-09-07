import React, { useState } from 'react'
import LoginPage from './components/LoginPage.jsx'
import Homepage from './components/Homepage.jsx'
import KalaLinkForm from './components/KalaLinkForm.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import './App.css'

// Simple view-based navigation — no real backend/auth yet, so this just
// tracks which screen is showing. 'add' is the name Homepage/ProfilePage's
// existing bottom-nav callbacks already use for the "+" button, so it's
// kept as the id for the form screen here too.
const VIEWS = {
  LOGIN: 'login',
  HOME: 'home',
  ADD: 'add',
  PROFILE: 'profile',
}

export default function App() {
  const [view, setView] = useState(VIEWS.LOGIN)

  function handleLoginSuccess() {
    setView(VIEWS.HOME)
  }

  function handleNavChange(nextView) {
    setView(nextView)
  }

  return (
    <div className="app-root">
      {view === VIEWS.LOGIN && <LoginPage onLoginSuccess={handleLoginSuccess} />}

      {view === VIEWS.HOME && (
        <Homepage activeNav="home" onNavChange={handleNavChange} />
      )}

      {view === VIEWS.ADD && <KalaLinkForm onNavChange={handleNavChange} />}

      {view === VIEWS.PROFILE && (
        <ProfilePage activeNav="profile" onNavChange={handleNavChange} />
      )}
    </div>
  )
}
