import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const PAPEIS = ['pendente', 'admin', 'recepcao', 'profissional', 'paciente'];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState(null);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, papel, ativo, criado_em')
      .order('criado_em', { ascending: false });
    setUsuarios(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function atualizarLocal(id, campo, valor) {
    setUsuarios((lista) => lista.map((u) => (u.id === id ? { ...u, [campo]: valor } : u)));
  }

  async function salvar(id) {
    const usuario = usuarios.find((u) => u.id === id);
    setSalvandoId(id);
    const { error } = await supabase
      .from('usuarios')
      .update({ papel: usuario.papel, ativo: usuario.ativo })
      .eq('id', id);
    setSalvandoId(null);
    if (error) alert('Erro ao salvar: ' + error.message);
  }

  return (
    <Layout titulo="Usuários">
      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Criado em</th>
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
                  <span
                    className={`status-pill ${u.ativo ? 'ativo' : 'inativo'}`}
                    onClick={() => atualizarLocal(u.id, 'ativo', !u.ativo)}
                  >
                    {u.ativo ? 'Ativo' : 'Pendente'}
                  </span>
                </td>
                <td>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
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
