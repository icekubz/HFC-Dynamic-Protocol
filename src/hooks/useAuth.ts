import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { User, UserRole } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user.id) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        setUser(userData);

        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('status', 'active');

        setRoles(rolesData?.map(r => r.role) as UserRole[] || []);
      }

      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          setSession(session);

          if (session?.user.id) {
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            setUser(userData);

            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .eq('status', 'active');

            setRoles(rolesData?.map(r => r.role) as UserRole[] || []);
          } else {
            setUser(null);
            setRoles([]);
          }
        })();
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const hasRole = (role: UserRole) => roles.includes(role);

  return {
    session,
    user,
    roles,
    loading,
    hasRole,
    isAuthenticated: !!session,
  };
}
