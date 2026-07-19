import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const PAPEIS = ['pendente', 'admin', 'recepcao', 'profissional', 'paciente'];
const TELAS = [
  { valor: 'agendamentos', label: 'Agendamentos' },
  { valor: 'pacientes', label: 'Pacientes' },
  { valor: 'custo', label: 'Custo' },
  { valor: 'contas_pagar', label: 'Contas a Pagar' },
  { valor: 'contas_receber', label: 'Contas a Receber' },
  { valor: 'caixa', label: 'Caixa' },
  { valor: 'usuarios', label: 'Usuários' },
];
const NOVO_VAZIO = { nome: '', email: '', senha: '', papel: 'recepcao', permissoes: [] };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState(null);

  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [novo, setNovo] = useState(NOVO_VAZIO);
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState('');

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, papel, ativo, permissoes, criado_em')
      .order('criado_em', { ascending: false });
    setUsuarios(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function atualizarLocal(id, campo, valor) {
    setUsuarios((lista) => lista.map((u) => (u.id === id ? { ...u, [campo]: valor } : u)));
  }

  function alternarPermissaoLocal(id, tela, marcado) {
    setUsuarios((lista) => lista.map((u) => {
      if (u.id !== id) return u;
      const atuais = u.permissoes || [];
      const permissoes = marcado ? [...atuais, tela] : atuais.filter((t) => t !== tela);
      return { ...u, permissoes };
    }));
  }

  async function salvar(id) {
    const usuario = usuarios.find((u) => u.id === id);
    setSalvandoId(id);
    const { error } = await supabase
      .from('usuarios')
      .update({ papel: usuario.papel, ativo: usuario.ativo, permissoes: usuario.permissoes || [] })
      .eq('id', id);
    setSalvandoId(null);
    if (error) alert('Erro ao salvar: ' + error.message);
  }

  function alternarPermissaoNovo(tela, marcado) {
    setNovo((n) => ({
      ...n,
      permissoes: marcado ? [...n.permissoes, tela] : n.permissoes.filter((t) => t !== tela),
    }));
  }

  async function criarUsuario(e) {
    e.preventDefault();
    setCriando(true);
    setErroCriacao('');

    const { data, error } = await supabase.functions.invoke('criar-usuario', { body: novo });

    setCriando(false);

    if (error || data?.error) {
      setErroCriacao(data?.error || 'Não foi possível criar o usuário. Confira se a Edge Function foi publicada.');
      return;
    }

    setNovo(NOVO_VAZIO);
    setMostrarNovo(false);
    carregar();
  }

  return (
    <Layout titulo="Usuários">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>
          Aprove solicitações de acesso ou cadastre um usuário diretamente.
        </p>
        <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => setMostrarNovo((v) => !v)}>
          {mostrarNovo ? 'Cancelar' : '+ Novo usuário'}
        </button>
      </div>

      {mostrarNovo && (
        <form className="ficha-form" onSubmit={criarUsuario} style={{ marginBottom: 32 }}>
          {erroCriacao && <div className="mensagem erro">{erroCriacao}</div>}
          <div className="ficha-grid">
            <div className="campo">
              <label>Nome completo</label>
              <input required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label>E-mail</label>
              <input required type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            </div>
            <div className="campo">
              <label>Senha inicial</label>
              <input required type="text" minLength={6} value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="campo">
              <label>Papel</label>
              <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })}>
                <option value="admin">admin</option>
                <option value="recepcao">recepcao</option>
                <option value="profissional">profissional</option>
                <option value="paciente">paciente</option>
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Telas permitidas</label>
            <div className="checkboxes-telas">
              {TELAS.map((t) => (
                <label key={t.valor} className="checkbox-tela">
                  <input
                    type="checkbox"
                    checked={novo.permissoes.includes(t.valor)}
                    onChange={(e) => alternarPermissaoNovo(t.valor, e.target.checked)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="dica-texto">Ignorado se o papel for "admin" — admin sempre tem acesso total.</p>
          </div>

          <button type="submit" className="botao" disabled={criando} style={{ maxWidth: 220 }}>
            {criando ? 'Criando...' : 'Criar usuário'}
          </button>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Telas permitidas</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome || '—'}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="select-papel"
                    value={u.papel}
                    onChange={(e) => atualizarLocal(u.id, 'papel', e.target.value)}
                  >
                    {PAPEIS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {u.papel === 'admin' ? (
                    <span className="acesso-full">Acesso total</span>
                  ) : (
                    <div className="checkboxes-telas">
                      {TELAS.map((t) => (
                        <label key={t.valor} className="checkbox-tela">
                          <input
                            type="checkbox"
                            checked={(u.permissoes || []).includes(t.valor)}
                            onChange={(e) => alternarPermissaoLocal(u.id, t.valor, e.target.checked)}
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span
                    className={`status-pill ${u.ativo ? 'ativo' : 'inativo'}`}
                    onClick={() => atualizarLocal(u.id, 'ativo', !u.ativo)}
                  >
                    {u.ativo ? 'Ativo' : 'Pendente'}
                  </span>
                </td>
                <td>
                  <button className="botao-salvar" onClick={() => salvar(u.id)}>
                    {salvandoId === u.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
