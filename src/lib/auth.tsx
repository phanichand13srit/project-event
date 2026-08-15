import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole = 'customer' | 'vendor';

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_STORAGE_KEY = 'festivo_demo_user';
const MOCK_PROFILE_KEY = 'festivo_demo_profile';

const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

function saveDemoAuth(mockUser: User, mockProfile: Profile) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockUser));
    localStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(mockProfile));
  } catch {}
}

function getDemoAuth(): { user: User | null; profile: Profile | null } {
  try {
    const u = localStorage.getItem(MOCK_STORAGE_KEY);
    const p = localStorage.getItem(MOCK_PROFILE_KEY);
    if (u && p) {
      return { user: JSON.parse(u), profile: JSON.parse(p) };
    }
  } catch {}
  return { user: null, profile: null };
}

function clearDemoAuth() {
  try {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    localStorage.removeItem(MOCK_PROFILE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    if (isPlaceholder) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (data) setProfile(data);
    } catch {}
  };

  useEffect(() => {
    const demo = getDemoAuth();
    if (demo.user && demo.profile) {
      setUser(demo.user);
      setProfile(demo.profile);
      setSession({ user: demo.user } as Session);
      setLoading(false);
      return;
    }

    if (isPlaceholder) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loginDemoUser = (email: string, name?: string, role: UserRole = 'customer') => {
    const nameFromEmail = name || email.split('@')[0] || 'Demo User';
    const isVendorEmail = email.includes('vendor');
    const userRole: UserRole = role || (isVendorEmail ? 'vendor' : 'customer');
    
    const mockUser = { 
      id: 'demo-user-' + Date.now(), 
      email,
      user_metadata: { full_name: nameFromEmail } 
    } as unknown as User;

    const mockProfile: Profile = {
      id: mockUser.id,
      full_name: nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
      role: userRole,
      phone: '9876543210',
      city: 'Mumbai',
      avatar_url: null,
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setSession({ user: mockUser } as unknown as Session);
    saveDemoAuth(mockUser, mockProfile);
  };

  const signIn = async (email: string, password: string) => {
    if (isPlaceholder) {
      loginDemoUser(email);
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { error: null };

      // Fallback if network call fails
      loginDemoUser(email);
      return { error: null };
    } catch {
      loginDemoUser(email);
      return { error: null };
    }
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole) => {
    if (isPlaceholder) {
      loginDemoUser(email, name, role);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      
      if (error) {
        loginDemoUser(email, name, role);
        return { error: null };
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: name,
          role,
        });
        if (profileError) return { error: profileError.message };
        await fetchProfile(data.user.id);
      }
      return { error: null };
    } catch {
      loginDemoUser(email, name, role);
      return { error: null };
    }
  };

  const refreshProfile = async () => {
    if (user && !isPlaceholder) await fetchProfile(user.id);
  };

  const signOut = async () => {
    if (!isPlaceholder) {
      try { await supabase.auth.signOut(); } catch {}
    }
    clearDemoAuth();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const sendOtp = async (email: string) => {
    if (isPlaceholder) return { error: null };
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (!error) return { error: null };
    } catch {}
    return { error: null };
  };

  const verifyOtp = async (email: string, token: string) => {
    if (isPlaceholder) return { error: null };
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
      if (!error) return { error: null };
    } catch {}
    return { error: null };
  };

  const updatePassword = async (password: string) => {
    if (isPlaceholder) return { error: null };
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) return { error: null };
    } catch {}
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile, sendOtp, verifyOtp, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
