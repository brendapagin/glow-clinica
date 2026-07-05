import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { descricao: '', valor: '', vencimento: '' };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export default function ContasPagar() {
  const [contas, setContas] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('contas_pagar').select('*').order('vencimento', { ascending: true });
    setContas(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function iniciarNovo() {
    setForm(VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(c) {
    setForm({ descricao: c.descricao, valor: c.valor, vencimento: c.vencimento || '' });
    setEditandoId(c.id);
    setMostrarForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = { descricao: form.descricao, valor: form.valor || 0, vencimento: form.vencimento || null };
    const { error } = editandoId
      ? await supabase.from('contas_pagar').update(dados).eq('id', editandoId)
      : await supabase.from('contas_pagar').insert(dados);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setForm(VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  async function marcarComoPago(conta) {
    await supabase.from('contas_pagar').update({ status: 'pago', pago_em: new Date().toISOString().slice(0, 10) }).eq('id', conta.id);
    carregar();
  }

  async function reabrir(conta) {
    await supabase.from('contas_pagar').update({ status: 'pendente', pago_em: null }).eq('id', conta.id);
    carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir esta conta?')) return;
    await supabase.from('contas_pagar').delete().eq('id', id);
    carregar();
  }

  const filtradas = contas.filter((c) => filtro === 'todas' || c.status === filtro);
  const totalPendente = contas.filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);

  return (
    <Layout titulo="Contas a Pagar">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>Total pendente: <strong>{formatarMoeda(totalPendente)}</strong></p>
        {!mostrarForm && (
          <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>
            + Nova conta
          </button>
        )}
      </div>

      {mostrarForm && (
        <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
          <div className="ficha-grid">
            <div className="campo">
              <label>Descrição</label>
              <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Aluguel, fornecedor X..." />
            </div>
            <div className="campo">
              <label>Valor (R$)</label>
              <input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div className="campo">
              <label>Vencimento</label>
              <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
            </div>
          </div>
          <div className="ficha-form-acoes">
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar conta'}
            </button>
            <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="abas-servico" style={{ marginBottom: 20 }}>
        <button className={`aba ${filtro === 'todas' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('todas')}>Todas</button>
        <button className={`aba ${filtro === 'pendente' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('pendente')}>Pendentes</button>
        <button className={`aba ${filtro === 'pago' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('pago')}>Pagas</button>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.id}>
                <td>{c.descricao}</td>
                <td>{formatarMoeda(c.valor)}</td>
                <td>{c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : '—'}</td>
                <td><span className={`status-pill ${c.status === 'pago' ? 'ativo' : 'inativo'}`}>{c.status === 'pago' ? 'Paga' : 'Pendente'}</span></td>
                <td className="celula-acoes">
                  <button className="botao-secundario" onClick={() => iniciarEdicao(c)}>Editar</button>
                  {c.status === 'pendente' ? (
                    <button className="botao-secundario" onClick={() => marcarComoPago(c)}>Marcar como paga</button>
                  ) : (
                    <button className="botao-secundario" onClick={() => reabrir(c)}>Reabrir</button>
                  )}
                  <button className="botao-secundario" onClick={() => excluir(c.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && <tr><td colSpan={5}>Nenhuma conta encontrada.</td></tr>}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
