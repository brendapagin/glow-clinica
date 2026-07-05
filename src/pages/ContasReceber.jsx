import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { paciente_id: '', descricao: '', valor: '', data_prevista: '' };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export default function ContasReceber() {
  const [contas, setContas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('contas_receber')
      .select('*, pacientes(nome)')
      .order('data_prevista', { ascending: true });
    setContas(data || []);

    const { data: pacs } = await supabase.from('pacientes').select('id, nome').order('nome');
    setPacientes(pacs || []);

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function iniciarNovo() {
    setForm(VAZIO);
    setMostrarForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = {
      paciente_id: form.paciente_id || null,
      descricao: form.descricao,
      valor: form.valor || 0,
      data_prevista: form.data_prevista || null,
      status: 'pendente',
    };
    const { error } = await supabase.from('contas_receber').insert(dados);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setForm(VAZIO);
    setMostrarForm(false);
    carregar();
  }

  async function marcarComoRecebido(conta) {
    await supabase.from('contas_receber').update({ status: 'recebido', recebido_em: new Date().toISOString().slice(0, 10) }).eq('id', conta.id);
    carregar();
  }

  async function reabrir(conta) {
    await supabase.from('contas_receber').update({ status: 'pendente', recebido_em: null }).eq('id', conta.id);
    carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir esta conta a receber?')) return;
    await supabase.from('contas_receber').delete().eq('id', id);
    carregar();
  }

  const filtradas = contas.filter((c) => filtro === 'todas' || c.status === filtro);
  const totalPendente = contas.filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);

  return (
    <Layout titulo="Contas a Receber">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>Total pendente: <strong>{formatarMoeda(totalPendente)}</strong></p>
        {!mostrarForm && (
          <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>
            + Lançamento manual
          </button>
        )}
      </div>

      <p className="dica-texto" style={{ marginBottom: 20 }}>
        Contas geradas automaticamente a partir do valor cobrado em cada atendimento de Harmonização
        aparecem aqui sozinhas. Use o lançamento manual para outras cobranças.
      </p>

      {mostrarForm && (
        <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
          <div className="ficha-grid">
            <div className="campo">
              <label>Paciente (opcional)</label>
              <select value={form.paciente_id} onChange={(e) => setForm({ ...form, paciente_id: e.target.value })}>
                <option value="">Sem paciente vinculado</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="campo">
              <label>Descrição</label>
              <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="campo">
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div className="campo">
              <label>Data prevista</label>
              <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} />
            </div>
          </div>
          <div className="ficha-form-acoes">
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </button>
            <button type="button" className="link-secundario" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="abas-servico" style={{ marginBottom: 20 }}>
        <button className={`aba ${filtro === 'todas' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
        <button className={`aba ${filtro === 'pendente' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('pendente')}>Pendentes</button>
        <button className={`aba ${filtro === 'recebido' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('recebido')}>Recebidas</button>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead><tr><th>Paciente</th><th>Descrição</th><th>Valor</th><th>Previsto</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.id}>
                <td>{c.pacientes?.nome || '—'}</td>
                <td>{c.descricao}</td>
                <td>{formatarMoeda(c.valor)}</td>
                <td>{c.data_prevista ? new Date(c.data_prevista).toLocaleDateString('pt-BR') : '—'}</td>
                <td><span className={`status-pill ${c.status === 'recebido' ? 'ativo' : 'inativo'}`}>{c.status === 'recebido' ? 'Recebido' : 'Pendente'}</span></td>
                <td className="celula-acoes">
                  {c.status === 'pendente' ? (
                    <button className="botao-secundario" onClick={() => marcarComoRecebido(c)}>Marcar como recebido</button>
                  ) : (
                    <button className="botao-secundario" onClick={() => reabrir(c)}>Reabrir</button>
                  )}
                  <button className="botao-secundario" onClick={() => excluir(c.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && <tr><td colSpan={6}>Nenhuma conta encontrada.</td></tr>}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
