import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { tipo: 'entrada', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10) };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function formatarData(data) {
  return data ? new Date(data).toLocaleDateString('pt-BR') : '—';
}

export default function Caixa() {
  const [carregando, setCarregando] = useState(true);
  const [contasReceber, setContasReceber] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);

  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);

    const { data: receber } = await supabase.from('contas_receber').select('*, pacientes(nome), contas_receber_baixas(*)');
    setContasReceber(receber || []);

    const { data: pagar } = await supabase.from('contas_pagar').select('*');
    setContasPagar(pagar || []);

    const { data: lanc } = await supabase.from('caixa_lancamentos').select('*').order('data', { ascending: false });
    setLancamentos(lanc || []);

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function iniciarNovo() {
    setForm(VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(l) {
    setForm({ tipo: l.tipo, descricao: l.descricao, valor: l.valor, data: l.data });
    setEditandoId(l.id);
    setMostrarForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = { tipo: form.tipo, descricao: form.descricao, valor: form.valor || 0, data: form.data };
    const { error } = editandoId
      ? await supabase.from('caixa_lancamentos').update(dados).eq('id', editandoId)
      : await supabase.from('caixa_lancamentos').insert(dados);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setForm(VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir este lançamento?')) return;
    await supabase.from('caixa_lancamentos').delete().eq('id', id);
    carregar();
  }

  const entradasManual = lancamentos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor || 0), 0);
  const saidasManual = lancamentos.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor || 0), 0);
  const recebidoTotal = contasReceber.reduce((s, c) => s + (c.contas_receber_baixas || []).reduce((s2, b) => s2 + Number(b.valor || 0), 0), 0);
  const pagoTotal = contasPagar.filter((c) => c.status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0);

  const aReceberPendente = contasReceber
    .filter((c) => c.status !== 'recebido')
    .reduce((s, c) => s + (Number(c.valor || 0) - (c.contas_receber_baixas || []).reduce((s2, b) => s2 + Number(b.valor || 0), 0)), 0);
  const aPagarPendente = contasPagar.filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);

  const saldoAtual = entradasManual - saidasManual + recebidoTotal - pagoTotal;
  const saldoProjetado = saldoAtual + aReceberPendente - aPagarPendente;

  const movimentos = [
    ...lancamentos.map((l) => ({
      data: l.data, tipo: l.tipo, descricao: l.descricao, valor: Number(l.valor || 0), origem: 'manual', id: l.id,
    })),
    ...contasReceber.flatMap((c) => (c.contas_receber_baixas || []).map((b) => ({
      data: b.data, tipo: 'entrada', descricao: c.descricao + (c.pacientes?.nome ? ` — ${c.pacientes.nome}` : ''), valor: Number(b.valor || 0), origem: 'contas_receber',
    }))),
    ...contasPagar.filter((c) => c.status === 'pago').map((c) => ({
      data: c.pago_em, tipo: 'saida', descricao: c.descricao, valor: Number(c.valor || 0), origem: 'contas_pagar',
    })),
  ].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  return (
    <Layout titulo="Caixa">
      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div className="caixa-cartoes">
            <div className="caixa-cartao">
              <span className="caixa-cartao-label">Saldo atual</span>
              <strong className="caixa-cartao-valor">{formatarMoeda(saldoAtual)}</strong>
            </div>
            <div className="caixa-cartao">
              <span className="caixa-cartao-label">A receber (pendente)</span>
              <strong className="caixa-cartao-valor caixa-positivo">{formatarMoeda(aReceberPendente)}</strong>
            </div>
            <div className="caixa-cartao">
              <span className="caixa-cartao-label">A pagar (pendente)</span>
              <strong className="caixa-cartao-valor caixa-negativo">{formatarMoeda(aPagarPendente)}</strong>
            </div>
            <div className="caixa-cartao">
              <span className="caixa-cartao-label">Saldo projetado</span>
              <strong className="caixa-cartao-valor">{formatarMoeda(saldoProjetado)}</strong>
            </div>
          </div>

          <div className="lista-topo">
            <p className="dica-texto" style={{ margin: 0 }}>
              Lance aqui acertos de caixa, entradas ou saídas avulsas. Recebimentos e pagamentos de contas
              já cadastradas entram automaticamente no extrato abaixo.
            </p>
            {!mostrarForm && (
              <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>
                + Novo lançamento
              </button>
            )}
          </div>

          {mostrarForm && (
            <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
              <div className="ficha-grid">
                <div className="campo">
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <div className="campo">
                  <label>Descrição</label>
                  <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Acerto de caixa" />
                </div>
                <div className="campo">
                  <label>Valor (R$)</label>
                  <input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Data</label>
                  <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
              </div>
              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Lançar'}
                </button>
                <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              </div>
            </form>
          )}

          <h3 style={{ fontFamily: 'var(--fonte-display)', fontSize: 22 }}>Movimentações</h3>
          <table className="tabela-refinada">
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              {movimentos.map((m, i) => (
                <tr key={i}>
                  <td>{formatarData(m.data)}</td>
                  <td>
                    <span className={`status-pill ${m.tipo === 'entrada' ? 'ativo' : 'inativo'}`}>
                      {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td>{m.descricao}</td>
                  <td className={m.tipo === 'entrada' ? 'caixa-positivo' : 'caixa-negativo'}>
                    {m.tipo === 'entrada' ? '+ ' : '− '}{formatarMoeda(m.valor)}
                  </td>
                  <td className="celula-acoes">
                    {m.origem === 'manual' ? (
                      <>
                        <button className="botao-secundario" onClick={() => iniciarEdicao(lancamentos.find((l) => l.id === m.id))}>Editar</button>
                        <button className="botao-secundario" onClick={() => excluir(m.id)}>Excluir</button>
                      </>
                    ) : (
                      <span className="dica-texto" style={{ margin: 0 }}>
                        {m.origem === 'contas_receber' ? 'via Contas a Receber' : 'via Contas a Pagar'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {movimentos.length === 0 && <tr><td colSpan={5}>Nenhuma movimentação registrada ainda.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </Layout>
  );
}
