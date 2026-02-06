import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  useEffect(() => {
    // Check for existing session
    if (isSupabaseConfigured()) {
      checkUser()
      
      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    } else {
      setLoading(false)
    }
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    } catch (error) {
      console.error('Error checking user session:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      if (isDemoMode) {
        setUser(null)
        setIsDemoMode(false)
        return { error: null }
      }
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const enterDemoMode = () => {
    const demoUser = {
      id: 'demo-user',
      email: 'demo@icid.co',
      user_metadata: {
        full_name: 'Demo Inspector',
        role: 'inspector'
      }
    }
    setUser(demoUser)
    setIsDemoMode(true)
  }

  const value = {
    user,
    loading,
    isDemoMode,
    signIn,
    signOut,
    enterDemoMode,
    isSupabaseConfigured: isSupabaseConfigured()
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
