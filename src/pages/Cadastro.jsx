import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PainelMarca } from '../components/PainelMarca';

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function cadastrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });

    if (error) {
      setErro(
        error.message.includes('already registered')
          ? 'Este e-mail já está cadastrado.'
          : 'Não foi possível concluir o cadastro. Tente novamente.'
      );
      setCarregando(false);
      return;
    }

    setEnviado(true);
  }

  return (
    <div className="tela">
      <PainelMarca />
      <div className="painel-form">
        <div className="form-caixa">
          {enviado ? (
            <>
              <h2>Solicitação enviada</h2>
              <p className="subtitulo">
                Sua conta foi criada e está aguardando aprovação do administrador da GLOW.
                Você receberá acesso assim que for liberado.
              </p>
              <a href="/login" className="link-secundario">Voltar para o login</a>
            </>
          ) : (
            <>
              <h2>Solicitar acesso</h2>
              <p className="subtitulo">Crie sua conta. Um administrador precisa liberar seu acesso antes de você poder entrar.</p>

              {erro && <div className="mensagem erro">{erro}</div>}

              <form onSubmit={cadastrar}>
                <div className="campo">
                  <label htmlFor="nome">Nome completo</label>
                  <input id="nome" type="text" required autoComplete="name"
                    value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="email">E-mail</label>
                  <input id="email" type="email" required autoComplete="username"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="senha">Senha</label>
                  <input id="senha" type="password" required minLength={6} autoComplete="new-password"
                    value={senha} onChange={(e) => setSenha(e.target.value)} />
                </div>
                <button type="submit" className="botao" disabled={carregando}>
                  {carregando ? 'Enviando...' : 'Solicitar acesso'}
                </button>
              </form>

              <a href="/login" className="link-secundario">Já tem conta? Entrar</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
