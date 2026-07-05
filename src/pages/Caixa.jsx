import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

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

  const [configId, setConfigId] = useState(null);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [dataInicial, setDataInicial] = useState('');
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [salvandoSaldo, setSalvandoSaldo] = useState(false);

  async function carregar() {
    setCarregando(true);

    const { data: receber } = await supabase.from('contas_receber').select('*, pacientes(nome)').order('data_prevista', { ascending: false });
    setContasReceber(receber || []);

    const { data: pagar } = await supabase.from('contas_pagar').select('*').order('vencimento', { ascending: false });
    setContasPagar(pagar || []);

    const { data: config } = await supabase.from('caixa_config').select('*').limit(1).maybeSingle();
    if (config) {
      setConfigId(config.id);
      setSaldoInicial(config.saldo_inicial);
      setDataInicial(config.data_inicial);
    } else {
      setDataInicial(new Date().toISOString().slice(0, 10));
    }

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvarSaldoInicial() {
    setSalvandoSaldo(true);
    const dados = { saldo_inicial: saldoInicial || 0, data_inicial: dataInicial, atualizado_em: new Date().toISOString() };
    const { error } = configId
      ? await supabase.from('caixa_config').update(dados).eq('id', configId)
      : await supabase.from('caixa_config').insert(dados);
    setSalvandoSaldo(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setEditandoSaldo(false);
    carregar();
  }

  const recebidoTotal = contasReceber
    .filter((c) => c.status === 'recebido' && (!dataInicial || (c.recebido_em && c.recebido_em >= dataInicial)))
    .reduce((s, c) => s + Number(c.valor || 0), 0);

  const pagoTotal = contasPagar
    .filter((c) => c.status === 'pago' && (!dataInicial || (c.pago_em && c.pago_em >= dataInicial)))
    .reduce((s, c) => s + Number(c.valor || 0), 0);

  const aReceberPendente = contasReceber.filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);
  const aPagarPendente = contasPagar.filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);

  const saldoAtual = Number(saldoInicial || 0) + recebidoTotal - pagoTotal;
  const saldoProjetado = saldoAtual + aReceberPendente - aPagarPendente;

  const movimentos = [
    ...contasReceber.filter((c) => c.status === 'recebido').map((c) => ({
      data: c.recebido_em, tipo: 'entrada', descricao: c.descricao, paciente: c.pacientes?.nome, valor: Number(c.valor || 0),
    })),
    ...contasPagar.filter((c) => c.status === 'pago').map((c) => ({
      data: c.pago_em, tipo: 'saida', descricao: c.descricao, valor: Number(c.valor || 0),
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

          <div className="ficha-form" style={{ maxWidth: 480, marginBottom: 32 }}>
            <div className="ficha-secao-topo">
              <h3 style={{ margin: 0, fontSize: 19 }}>Saldo inicial</h3>
              {!editandoSaldo && (
                <button className="botao-secundario" onClick={() => setEditandoSaldo(true)}>Editar</button>
              )}
            </div>
            {editandoSaldo ? (
              <>
                <div className="ficha-grid">
                  <div className="campo">
                    <label>Valor (R$)</label>
                    <input type="number" step="0.01" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
                  </div>
                  <div className="campo">
                    <label>A partir de</label>
                    <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
                  </div>
                </div>
                <div className="ficha-form-acoes">
                  <button className="botao" disabled={salvandoSaldo} onClick={salvarSaldoInicial} style={{ maxWidth: 200 }}>
                    {salvandoSaldo ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button type="button" className="link-secundario" onClick={() => setEditandoSaldo(false)}>Cancelar</button>
                </div>
              </>
            ) : (
              <p className="dica-texto" style={{ margin: 0 }}>
                {formatarMoeda(saldoInicial)} a partir de {formatarData(dataInicial)}
              </p>
            )}
          </div>

          <h3 style={{ fontFamily: 'var(--fonte-display)', fontSize: 22 }}>Movimentações</h3>
          <table className="tabela-refinada">
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead>
            <tbody>
              {movimentos.map((m, i) => (
                <tr key={i}>
                  <td>{formatarData(m.data)}</td>
                  <td>
                    <span className={`status-pill ${m.tipo === 'entrada' ? 'ativo' : 'inativo'}`}>
                      {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td>{m.descricao}{m.paciente && ` — ${m.paciente}`}</td>
                  <td className={m.tipo === 'entrada' ? 'caixa-positivo' : 'caixa-negativo'}>
                    {m.tipo === 'entrada' ? '+ ' : '− '}{formatarMoeda(m.valor)}
                  </td>
                </tr>
              ))}
              {movimentos.length === 0 && <tr><td colSpan={4}>Nenhuma movimentação registrada ainda.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </Layout>
  );
}
