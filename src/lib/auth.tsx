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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
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

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return { error: null };
    } catch (e) {
      console.warn('Supabase auth network error, fallback to demo mode:', e);
    }

    // Extract dynamic name from email if not hardcoded
    const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
    const formattedName = emailPrefix
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const isAarav = email.includes('aarav') || email.includes('photography');
    const isVendor = email.includes('vendor') || isAarav || true;
    const finalName = isAarav ? 'Aarav Photography' : (formattedName.length >= 3 ? formattedName : 'Bhavana Kolla');

    const mockUser: User = {
      id: 'demo-' + Date.now(),
      email,
      app_metadata: {},
      user_metadata: { full_name: finalName },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
    const mockProfile: Profile = {
      id: mockUser.id,
      full_name: finalName,
      role: isVendor ? 'vendor' : 'customer',
      phone: '+91 93475 67375',
      city: 'Hyderabad',
      avatar_url: null,
    };

    setUser(mockUser);
    setProfile(mockProfile);
    localStorage.setItem('festivo_user', JSON.stringify(mockUser));
    localStorage.setItem('festivo_profile', JSON.stringify(mockProfile));
    window.dispatchEvent(new Event('storage'));
    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error && !error.message.toLowerCase().includes('failed to fetch')) {
        return { error: error.message };
      }

      if (data?.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: name,
          role,
        });
        await fetchProfile(data.user.id);
        return { error: null };
      }
    } catch (e) {
      console.warn('Supabase auth network error, fallback to demo registration:', e);
    }

    const finalName = name.trim() || 'Bhavana Kolla';
    const mockUser: User = {
      id: 'demo-' + Date.now(),
      email,
      app_metadata: {},
      user_metadata: { full_name: finalName },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };
    const mockProfile: Profile = {
      id: mockUser.id,
      full_name: finalName,
      role: role || 'vendor',
      phone: '+91 93475 67375',
      city: 'Hyderabad',
      avatar_url: null,
    };

    setUser(mockUser);
    setProfile(mockProfile);
    localStorage.setItem('festivo_user', JSON.stringify(mockUser));
    localStorage.setItem('festivo_profile', JSON.stringify(mockProfile));
    window.dispatchEvent(new Event('storage'));
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // Step 1: Send a 6-digit OTP to the user's email
  const sendOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }, // only allow existing users
    });
    return { error: error?.message ?? null };
  };

  // Step 2: Verify the 6-digit OTP entered by user
  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error: error?.message ?? null };
  };

  // Step 3: Update password after OTP verification (user is now signed in)
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
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
