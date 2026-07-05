import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const ITEM_VAZIO = { nome: '', valor_mensal: '' };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export default function Custos() {
  const [custos, setCustos] = useState([]);
  const [form, setForm] = useState(ITEM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [atendimentosPorMes, setAtendimentosPorMes] = useState(1);
  const [configId, setConfigId] = useState(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data: itens } = await supabase.from('custos_operacionais').select('*').order('nome');
    setCustos(itens || []);

    const { data: config } = await supabase.from('configuracoes_custo').select('*').limit(1).maybeSingle();
    if (config) {
      setConfigId(config.id);
      setAtendimentosPorMes(config.atendimentos_por_mes);
    }

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function iniciarNovo() {
    setForm(ITEM_VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(c) {
    setForm({ nome: c.nome, valor_mensal: c.valor_mensal });
    setEditandoId(c.id);
    setMostrarForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = { nome: form.nome, valor_mensal: form.valor_mensal || 0 };
    const { error } = editandoId
      ? await supabase.from('custos_operacionais').update(dados).eq('id', editandoId)
      : await supabase.from('custos_operacionais').insert(dados);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setForm(ITEM_VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir este item de custo?')) return;
    await supabase.from('custos_operacionais').delete().eq('id', id);
    carregar();
  }

  async function alternarAtivo(c) {
    await supabase.from('custos_operacionais').update({ ativo: !c.ativo }).eq('id', c.id);
    carregar();
  }

  async function salvarConfig() {
    setSalvandoConfig(true);
    const dados = { atendimentos_por_mes: atendimentosPorMes || 1, atualizado_em: new Date().toISOString() };
    const { error } = configId
      ? await supabase.from('configuracoes_custo').update(dados).eq('id', configId)
      : await supabase.from('configuracoes_custo').insert(dados);
    setSalvandoConfig(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    carregar();
  }

  const totalMensal = custos.filter((c) => c.ativo).reduce((soma, c) => soma + Number(c.valor_mensal || 0), 0);
  const custoPorAtendimento = atendimentosPorMes > 0 ? totalMensal / atendimentosPorMes : 0;

  return (
    <Layout titulo="Composição de Custos">
      <p className="dica-texto" style={{ marginBottom: 24 }}>
        Cadastre os custos fixos da clínica (energia, internet, imposto, aluguel...) para calcular
        automaticamente quanto cada atendimento "pesa" nesses custos.
      </p>

      {!mostrarForm && (
        <button className="botao" style={{ width: 'auto', padding: '12px 24px', marginBottom: 24 }} onClick={iniciarNovo}>
          + Novo custo
        </button>
      )}

      {mostrarForm && (
        <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
          <div className="ficha-grid">
            <div className="campo">
              <label>Nome do custo</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Energia elétrica" />
            </div>
            <div className="campo">
              <label>Valor mensal (R$)</label>
              <input required type="number" step="0.01" value={form.valor_mensal} onChange={(e) => setForm({ ...form, valor_mensal: e.target.value })} />
            </div>
          </div>
          <div className="ficha-form-acoes">
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Adicionar custo'}
            </button>
            <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada" style={{ marginBottom: 32 }}>
          <thead>
            <tr><th>Custo</th><th>Valor mensal</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {custos.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>{formatarMoeda(c.valor_mensal)}</td>
                <td><span className={`status-pill ${c.ativo ? 'ativo' : 'inativo'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td className="celula-acoes">
                  <button className="botao-secundario" onClick={() => iniciarEdicao(c)}>Editar</button>
                  <button className="botao-secundario" onClick={() => alternarAtivo(c)}>{c.ativo ? 'Desativar' : 'Ativar'}</button>
                  <button className="botao-secundario" onClick={() => excluir(c.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {custos.length === 0 && <tr><td colSpan={4}>Nenhum custo cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      )}

      <div className="ficha-form" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Rateio por atendimento</h3>
        <div className="campo">
          <label>Quantos atendimentos você faz por mês (estimativa)</label>
          <input type="number" step="1" value={atendimentosPorMes} onChange={(e) => setAtendimentosPorMes(e.target.value)} />
        </div>
        <button className="botao-secundario" onClick={salvarConfig} disabled={salvandoConfig} style={{ marginBottom: 20 }}>
          {salvandoConfig ? 'Salvando...' : 'Salvar estimativa'}
        </button>

        <p className="dica-texto" style={{ marginTop: 0 }}>Total de custos ativos por mês: {formatarMoeda(totalMensal)}</p>
        <p className="registro-custo-total" style={{ border: 'none', paddingTop: 0 }}>
          Custo operacional sugerido por atendimento: {formatarMoeda(custoPorAtendimento)}
        </p>
      </div>
    </Layout>
  );
}
