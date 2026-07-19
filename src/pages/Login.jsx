import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PainelMarca } from '../components/PainelMarca';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro('E-mail ou senha incorretos.');
      setCarregando(false);
      return;
    }

    const { data: perfil, error: erroPerfil } = await supabase
      .from('usuarios')
      .select('papel, ativo')
      .eq('id', data.user.id)
      .single();

    if (erroPerfil || !perfil) {
      setErro('Não foi possível carregar seu perfil. Fale com o administrador.');
      setCarregando(false);
      return;
    }

    if (!perfil.ativo) {
      setErro('Sua conta ainda está aguardando aprovação do administrador.');
      await supabase.auth.signOut();
      setCarregando(false);
      return;
    }

    navigate('/painel');
  }

  return (
    <div className="tela">
      <PainelMarca />
      <div className="painel-form">
        <div className="form-caixa">
          <h2>Bem-vinda de volta</h2>
          <p className="subtitulo">Entre com seu e-mail e senha para acessar o sistema.</p>

          {erro && <div className="mensagem erro">{erro}</div>}

          <form onSubmit={entrar}>
            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" required autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <input id="senha" type="password" required autoComplete="current-password"
                value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <button type="submit" className="botao" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <a href="/cadastro" className="link-secundario">Ainda não tem acesso? Solicitar cadastro</a>
        </div>
      </div>
    </div>
  );
}
