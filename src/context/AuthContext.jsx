import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarPerfil(userId) {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, papel, ativo')
      .eq('id', userId)
      .single();
    setPerfil(data || null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await carregarPerfil(session.user.id);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await carregarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    setSession(null);
    setPerfil(null);
  }

  return (
    <AuthContext.Provider value={{ session, perfil, carregando, sair, recarregarPerfil: () => carregarPerfil(session?.user?.id) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
