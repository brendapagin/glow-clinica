import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { descricao: '', valor: '', vencimento: '', parcelado: false, numeroParcelas: 2 };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function somarMeses(dataIso, meses) {
  const data = new Date(dataIso + 'T00:00:00');
  data.setMonth(data.getMonth() + meses);
  return data.toISOString().slice(0, 10);
}

export default function ContasPagar() {
  const [contas, setContas] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());

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

    if (!editandoId && form.parcelado && form.numeroParcelas > 1) {
      const grupoId = crypto.randomUUID();
      const total = Number(form.numeroParcelas);
      const linhas = Array.from({ length: total }, (_, i) => ({
        descricao: `${form.descricao} (${i + 1}/${total})`,
        valor: form.valor || 0,
        vencimento: form.vencimento ? somarMeses(form.vencimento, i) : null,
        grupo_parcelamento: grupoId,
        parcela_numero: i + 1,
        parcela_total: total,
      }));
      const { error } = await supabase.from('contas_pagar').insert(linhas);
      setSalvando(false);
      if (error) { alert('Erro ao salvar parcelas: ' + error.message); return; }
      setForm(VAZIO);
      setMostrarForm(false);
      carregar();
      return;
    }

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

  const filtradas = contas.filter((c) => {
    if (filtro !== 'todas' && c.status !== filtro) return false;
    if (busca && !c.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
    if (dataInicio && (!c.vencimento || c.vencimento < dataInicio)) return false;
    if (dataFim && (!c.vencimento || c.vencimento > dataFim)) return false;
    return true;
  });

  const totalPendente = contas.filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalSelecionado = filtradas.filter((c) => selecionados.has(c.id)).reduce((s, c) => s + Number(c.valor || 0), 0);

  function alternarSelecionado(id) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  function alternarTodosVisiveis() {
    const idsVisiveis = filtradas.map((c) => c.id);
    const todosMarcados = idsVisiveis.every((id) => selecionados.has(id));
    setSelecionados((atual) => {
      const novo = new Set(atual);
      idsVisiveis.forEach((id) => (todosMarcados ? novo.delete(id) : novo.add(id)));
      return novo;
    });
  }

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
              <label>{form.parcelado ? 'Valor de cada parcela (R$)' : 'Valor (R$)'}</label>
              <input required type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </div>
            <div className="campo">
              <label>{form.parcelado ? 'Vencimento da 1ª parcela' : 'Vencimento'}</label>
              <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
            </div>
          </div>

          {!editandoId && (
            <div className="campo">
              <label className="checkbox-tela" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={form.parcelado} onChange={(e) => setForm({ ...form, parcelado: e.target.checked })} />
                Comprei parcelado (gerar várias contas automaticamente)
              </label>
              {form.parcelado && (
                <div style={{ marginTop: 14, maxWidth: 200 }}>
                  <label>Número de parcelas</label>
                  <input type="number" min="2" step="1" value={form.numeroParcelas} onChange={(e) => setForm({ ...form, numeroParcelas: e.target.value })} />
                  <p className="dica-texto">Gera {form.numeroParcelas || 0} contas, uma por mês, cada uma com o valor informado acima.</p>
                </div>
              )}
            </div>
          )}
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

      <div className="filtros-linha">
        <input className="busca" style={{ maxWidth: 280 }} placeholder="Buscar por descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="filtro-datas">
          <span>Vencimento de</span>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <span>até</span>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </div>

      {selecionados.size > 0 && (
        <div className="selecao-resumo">
          <span>{selecionados.size} conta(s) selecionada(s) · Total: <strong>{formatarMoeda(totalSelecionado)}</strong></span>
          <button onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
        </div>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead>
            <tr>
              <th><input type="checkbox" className="checkbox-linha" checked={filtradas.length > 0 && filtradas.every((c) => selecionados.has(c.id))} onChange={alternarTodosVisiveis} /></th>
              <th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" className="checkbox-linha" checked={selecionados.has(c.id)} onChange={() => alternarSelecionado(c.id)} /></td>
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
            {filtradas.length === 0 && <tr><td colSpan={6}>Nenhuma conta encontrada.</td></tr>}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
