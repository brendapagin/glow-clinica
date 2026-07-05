import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NavBarra } from '../components/NavBarra';

const VAZIO = { nome: '', cpf: '', telefone: '', email: '', data_nascimento: '', genero: '', endereco: '' };

export default function Pacientes() {
  const navigate = useNavigate();
  const [pacientes, setPacientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('pacientes').select('*').order('criado_em', { ascending: false });
    setPacientes(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const { data, error } = await supabase.from('pacientes').insert({
      ...form,
      data_nascimento: form.data_nascimento || null,
    }).select().single();
    setSalvando(false);
    if (error) { alert('Erro ao cadastrar: ' + error.message); return; }
    navigate(`/pacientes/${data.id}`);
  }

  const filtrados = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.cpf || '').includes(busca) ||
    (p.telefone || '').includes(busca)
  );

  return (
    <div>
      <NavBarra titulo="GLOW — Pacientes" />

      <div className="conteudo">
        <div className="lista-topo">
          <input
            className="busca"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Cancelar' : '+ Novo paciente'}
          </button>
        </div>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
            <div className="ficha-grid">
              <div className="campo">
                <label>Nome completo</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="campo">
                <label>CPF</label>
                <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="campo">
                <label>Telefone</label>
                <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div className="campo">
                <label>E-mail</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="campo">
                <label>Data de nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
              </div>
              <div className="campo">
                <label>Gênero</label>
                <input value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })} />
              </div>
            </div>
            <div className="campo">
              <label>Endereço</label>
              <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 240 }}>
              {salvando ? 'Salvando...' : 'Cadastrar paciente'}
            </button>
          </form>
        )}

        {carregando ? (
          <p>Carregando...</p>
        ) : (
          <table>
            <thead>
              <tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Cadastrado em</th><th></th></tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="linha-clicavel" onClick={() => navigate(`/pacientes/${p.id}`)}>
                  <td>{p.nome}</td>
                  <td>{p.telefone || '—'}</td>
                  <td>{p.email || '—'}</td>
                  <td>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td>→</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={5}>Nenhum paciente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
