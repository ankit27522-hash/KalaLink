import React, { useState } from 'react'
import { EyeIcon } from './Icons.jsx'
import logo from '../assets/logo.png'
import botanicalTop from '../assets/botanical-top.png'
import botanicalBottom from '../assets/botanical-bottom.png'
import bgTexture from '../assets/background-texture.jpg'
import './LoginPage.css'
import KalaLinkForm from './KalaLinkForm.jsx'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [loggedIn, setLoggedIn] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = {}
    if (!identifier.trim()) nextErrors.identifier = 'Enter your username, email or phone number'
    if (!password) nextErrors.password = 'Enter your password'
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length === 0) {
      setNotice({ type: 'success', text: `Welcome back${identifier ? ', ' + identifier : ''}!` })
      setLoggedIn(true)
    }
  }

  function handleForgotPassword(e) {
    e.preventDefault()
    setNotice({
      type: 'info',
      text: identifier.trim()
        ? `Password reset instructions would be sent to "${identifier}".`
        : 'Enter your username, email or phone number first, then tap "Forgot Password?"',
    })
  }

  function handleSignUp(e) {
    e.preventDefault()
    setNotice({ type: 'info', text: 'Sign up is not available in this preview yet.' })
  }

  // Once logged in, show KalaLinkForm instead of the login card.
  if (loggedIn) {
    return <KalaLinkForm />
  }

  return (
    <div className="kl-card" style={{ backgroundImage: `url(${bgTexture})` }}>
      <img className="kl-illustration kl-illustration--top" src={botanicalTop} alt="" aria-hidden="true" />
      <img className="kl-illustration kl-illustration--bottom" src={botanicalBottom} alt="" aria-hidden="true" />

      <div className="kl-content">
        <div className="kl-brand">
          <img className="kl-logo" src={logo} alt="KalaLink: Hunar, Vyapar, Aur Aap" />
        </div>

        <form className="kl-form" onSubmit={handleSubmit} noValidate>
          <div className="kl-field">
            <label className="kl-label" htmlFor="identifier">
              Username, Email or Phone Number
            </label>
            <input
              id="identifier"
              className="kl-input"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            {errors.identifier && <span className="kl-error">{errors.identifier}</span>}
          </div>

          <div className="kl-field">
            <label className="kl-label" htmlFor="password">
              Password
            </label>
            <div className="kl-password-row">
              <input
                id="password"
                className="kl-input kl-input--password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="kl-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {errors.password && <span className="kl-error">{errors.password}</span>}
          </div>

          <div className="kl-row">
            <label className="kl-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="kl-checkbox-box" aria-hidden="true" />
              <span>Remember Me</span>
            </label>

            <button type="button" className="kl-link kl-forgot" onClick={handleForgotPassword}>
              Forgot Password ?
            </button>
          </div>

          <button type="submit" className="kl-submit">
            Log In
          </button>
        </form>

        {notice && (
          <div className={`kl-notice kl-notice--${notice.type}`} role="status">
            {notice.text}
          </div>
        )}

        <div className="kl-spacer" />

        <p className="kl-signup-row">
          Don&apos;t have an account ?{' '}
          <button type="button" className="kl-link kl-signup" onClick={handleSignUp}>
            Sign Up
          </button>
        </p>
      </div>
    </div>
  )
}