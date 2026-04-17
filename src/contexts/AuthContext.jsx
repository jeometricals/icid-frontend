import { createContext, useContext, useState } from 'react'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Dev user — hardcoded for development (user_id=28 in the DB)
const DEV_USER = {
  id: 28,
  email: 'KhanG@magnoleng.pc',
  user_metadata: {
    full_name: 'Genghis Khan',
    role: 'inspector'
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const signIn = async (_email, _password) => {
    // Auth is hardcoded for development — always signs in as the dev user
    setUser(DEV_USER)
    setIsDemoMode(false)
    return { data: DEV_USER, error: null }
  }

  const signOut = async () => {
    setUser(null)
    setIsDemoMode(false)
    return { error: null }
  }

  const enterDemoMode = () => {
    setUser(DEV_USER)
    setIsDemoMode(true)
  }

  const value = {
    user,
    loading: false,
    isDemoMode,
    signIn,
    signOut,
    enterDemoMode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
