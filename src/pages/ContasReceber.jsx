import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { paciente_id: '', descricao: '', valor: '', data_prevista: '' };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function formatarData(data) {
  return data ? new Date(data).toLocaleDateString('pt-BR') : '—';
}

function recebidoDaConta(conta) {
  return (conta.contas_receber_baixas || []).reduce((s, b) => s + Number(b.valor || 0), 0);
}

export default function ContasReceber() {
  const [contas, setContas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  const [baixaAbertaId, setBaixaAbertaId] = useState(null);
  const [valorBaixa, setValorBaixa] = useState('');
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10));
  const [salvandoBaixa, setSalvandoBaixa] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('contas_receber')
      .select('*, pacientes(nome), contas_receber_baixas(*)')
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

  function abrirBaixa(conta) {
    const restante = Number(conta.valor) - recebidoDaConta(conta);
    setValorBaixa(restante > 0 ? restante.toFixed(2) : '');
    setDataBaixa(new Date().toISOString().slice(0, 10));
    setBaixaAbertaId(conta.id);
  }

  async function confirmarBaixa(conta) {
    if (!valorBaixa || Number(valorBaixa) <= 0) return;
    setSalvandoBaixa(true);

    const { error } = await supabase.from('contas_receber_baixas').insert({
      conta_receber_id: conta.id,
      valor: valorBaixa,
      data: dataBaixa,
    });

    if (error) { alert('Erro ao dar baixa: ' + error.message); setSalvandoBaixa(false); return; }

    const recebidoAntes = recebidoDaConta(conta);
    const novoRecebido = recebidoAntes + Number(valorBaixa);
    const novoStatus = novoRecebido >= Number(conta.valor) ? 'recebido' : 'parcial';

    await supabase.from('contas_receber').update({
      status: novoStatus,
      recebido_em: novoStatus === 'recebido' ? dataBaixa : conta.recebido_em,
    }).eq('id', conta.id);

    setSalvandoBaixa(false);
    setBaixaAbertaId(null);
    carregar();
  }

  async function excluirBaixa(baixa, conta) {
    if (!confirm('Excluir esta baixa? O status da conta será recalculado.')) return;

    await supabase.from('contas_receber_baixas').delete().eq('id', baixa.id);

    const recebidoDepois = recebidoDaConta(conta) - Number(baixa.valor);
    const novoStatus = recebidoDepois <= 0 ? 'pendente' : (recebidoDepois >= Number(conta.valor) ? 'recebido' : 'parcial');

    await supabase.from('contas_receber').update({ status: novoStatus }).eq('id', conta.id);
    carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir esta conta a receber e todas as baixas registradas nela?')) return;
    await supabase.from('contas_receber').delete().eq('id', id);
    carregar();
  }

  const filtradas = contas.filter((c) => filtro === 'todas' || c.status === filtro);
  const totalPendente = contas.filter((c) => c.status !== 'recebido').reduce((s, c) => s + (Number(c.valor || 0) - recebidoDaConta(c)), 0);

  return (
    <Layout titulo="Contas a Receber">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>Total pendente (considerando baixas parciais): <strong>{formatarMoeda(totalPendente)}</strong></p>
        {!mostrarForm && (
          <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>
            + Lançamento manual
          </button>
        )}
      </div>

      <p className="dica-texto" style={{ marginBottom: 20 }}>
        Contas geradas automaticamente a partir do valor cobrado em cada atendimento aparecem aqui sozinhas.
        Use o lançamento manual para outras cobranças. Dá pra dar baixa parcial quantas vezes precisar.
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
              <label>Valor total (R$)</label>
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
        <button className={`aba ${filtro === 'parcial' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('parcial')}>Parciais</button>
        <button className={`aba ${filtro === 'recebido' ? 'aba-ativa' : ''}`} onClick={() => setFiltro('recebido')}>Recebidas</button>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <div className="lista-registros">
          {filtradas.length === 0 && <p className="galeria-vazio">Nenhuma conta encontrada.</p>}
          {filtradas.map((conta) => {
            const recebido = recebidoDaConta(conta);
            const restante = Number(conta.valor) - recebido;
            return (
              <div className="registro-card" key={conta.id}>
                <div className="registro-topo">
                  <strong>{conta.descricao} {conta.pacientes?.nome && `— ${conta.pacientes.nome}`}</strong>
                  <div className="registro-topo-direita">
                    <span className={`status-pill ${conta.status === 'recebido' ? 'ativo' : conta.status === 'parcial' ? 'parcial' : 'inativo'}`}>
                      {conta.status === 'recebido' ? 'Recebido' : conta.status === 'parcial' ? 'Parcial' : 'Pendente'}
                    </span>
                    <div className="registro-acoes">
                      {conta.status !== 'recebido' && <button onClick={() => abrirBaixa(conta)}>Dar baixa</button>}
                      <button onClick={() => excluir(conta.id)}>Excluir</button>
                    </div>
                  </div>
                </div>

                <p>Valor total: {formatarMoeda(conta.valor)} · Recebido: {formatarMoeda(recebido)} · Restante: {formatarMoeda(restante)}</p>
                {conta.data_prevista && <p>Previsto para: {formatarData(conta.data_prevista)}</p>}

                {(conta.contas_receber_baixas || []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {conta.contas_receber_baixas.map((b) => (
                      <p key={b.id} style={{ fontSize: 13, color: 'var(--terracota-escuro)' }}>
                        Baixa de {formatarMoeda(b.valor)} em {formatarData(b.data)}
                        {' — '}
                        <button className="link-inline" onClick={() => excluirBaixa(b, conta)}>excluir</button>
                      </p>
                    ))}
                  </div>
                )}

                {baixaAbertaId === conta.id && (
                  <div className="aplicacao-linha" style={{ marginTop: 12 }}>
                    <div className="campo">
                      <label>Valor recebido agora (R$)</label>
                      <input type="number" step="0.01" value={valorBaixa} onChange={(e) => setValorBaixa(e.target.value)} />
                    </div>
                    <div className="campo">
                      <label>Data do recebimento</label>
                      <input type="date" value={dataBaixa} onChange={(e) => setDataBaixa(e.target.value)} />
                    </div>
                    <div className="ficha-form-acoes" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
                      <button type="button" className="botao" disabled={salvandoBaixa} onClick={() => confirmarBaixa(conta)} style={{ maxWidth: 200 }}>
                        {salvandoBaixa ? 'Salvando...' : 'Confirmar baixa'}
                      </button>
                      <button type="button" className="link-secundario" onClick={() => setBaixaAbertaId(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
