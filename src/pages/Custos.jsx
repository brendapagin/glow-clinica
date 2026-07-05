import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function calcularTotalComposicao(linhas, valorBase) {
  return linhas.reduce((soma, l) => {
    const valor = Number(l.valor) || 0;
    return soma + (l.tipo === 'percentual' ? (valor / 100) * valorBase : valor);
  }, 0);
}

const ITEM_VAZIO = { nome: '' };
const LINHA_VAZIA = { item_id: '', tipo: 'fixo', valor: '' };
const COMPOSICAO_VAZIA = { nome: '', servico_id: '', valor_base: '' };

export default function Custos() {
  const [aba, setAba] = useState('composicoes');

  // --- Itens de custo (catálogo) ---
  const [itens, setItens] = useState([]);
  const [formItem, setFormItem] = useState(ITEM_VAZIO);
  const [mostrarFormItem, setMostrarFormItem] = useState(false);
  const [editandoItemId, setEditandoItemId] = useState(null);

  // --- Composições ---
  const [composicoes, setComposicoes] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [formComposicao, setFormComposicao] = useState(COMPOSICAO_VAZIA);
  const [linhas, setLinhas] = useState([{ ...LINHA_VAZIA }]);
  const [mostrarFormComposicao, setMostrarFormComposicao] = useState(false);
  const [editandoComposicaoId, setEditandoComposicaoId] = useState(null);

  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const { data: itensData } = await supabase.from('custo_itens').select('*').order('nome');
    setItens(itensData || []);

    const { data: composicoesData } = await supabase
      .from('composicoes_custo')
      .select('*, servicos(nome), composicao_linhas(*, custo_itens(nome))')
      .order('nome');
    setComposicoes(composicoesData || []);

    const { data: servicosData } = await supabase.from('servicos').select('*').eq('ativo', true);
    setServicos(servicosData || []);

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  // --- Ações: itens de custo ---
  function iniciarNovoItem() {
    setFormItem(ITEM_VAZIO);
    setEditandoItemId(null);
    setMostrarFormItem(true);
  }

  function iniciarEdicaoItem(item) {
    setFormItem({ nome: item.nome });
    setEditandoItemId(item.id);
    setMostrarFormItem(true);
  }

  async function salvarItem(e) {
    e.preventDefault();
    setSalvando(true);
    const { error } = editandoItemId
      ? await supabase.from('custo_itens').update({ nome: formItem.nome }).eq('id', editandoItemId)
      : await supabase.from('custo_itens').insert({ nome: formItem.nome });
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setFormItem(ITEM_VAZIO);
    setMostrarFormItem(false);
    setEditandoItemId(null);
    carregar();
  }

  async function alternarAtivoItem(item) {
    await supabase.from('custo_itens').update({ ativo: !item.ativo }).eq('id', item.id);
    carregar();
  }

  async function excluirItem(id) {
    if (!confirm('Excluir este item de custo? Ele será removido de todas as composições que o usam.')) return;
    await supabase.from('custo_itens').delete().eq('id', id);
    carregar();
  }

  // --- Ações: composições ---
  function iniciarNovaComposicao() {
    setFormComposicao(COMPOSICAO_VAZIA);
    setLinhas([{ ...LINHA_VAZIA }]);
    setEditandoComposicaoId(null);
    setMostrarFormComposicao(true);
  }

  function iniciarEdicaoComposicao(c) {
    setFormComposicao({ nome: c.nome, servico_id: c.servico_id || '', valor_base: c.valor_base });
    setLinhas(
      (c.composicao_linhas || []).length > 0
        ? c.composicao_linhas.map((l) => ({ item_id: l.item_id || '', tipo: l.tipo, valor: l.valor }))
        : [{ ...LINHA_VAZIA }]
    );
    setEditandoComposicaoId(c.id);
    setMostrarFormComposicao(true);
  }

  function atualizarLinha(index, campo, valor) {
    setLinhas((lista) => {
      const nova = [...lista];
      nova[index] = { ...nova[index], [campo]: valor };
      return nova;
    });
  }

  function adicionarLinha() {
    setLinhas((lista) => [...lista, { ...LINHA_VAZIA }]);
  }

  function removerLinha(index) {
    setLinhas((lista) => lista.filter((_, i) => i !== index));
  }

  const totalFormComposicao = calcularTotalComposicao(linhas, Number(formComposicao.valor_base) || 0);

  async function salvarComposicao(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = {
      nome: formComposicao.nome,
      servico_id: formComposicao.servico_id || null,
      valor_base: formComposicao.valor_base || 0,
    };

    let composicaoId = editandoComposicaoId;

    if (editandoComposicaoId) {
      const { error } = await supabase.from('composicoes_custo').update(dados).eq('id', editandoComposicaoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('composicao_linhas').delete().eq('composicao_id', editandoComposicaoId);
    } else {
      const { data, error } = await supabase.from('composicoes_custo').insert(dados).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      composicaoId = data.id;
    }

    const linhasParaSalvar = linhas
      .filter((l) => l.item_id)
      .map((l) => ({ composicao_id: composicaoId, item_id: l.item_id, tipo: l.tipo, valor: l.valor || 0 }));

    if (linhasParaSalvar.length > 0) {
      const { error } = await supabase.from('composicao_linhas').insert(linhasParaSalvar);
      if (error) alert('Erro ao salvar itens da composição: ' + error.message);
    }

    setSalvando(false);
    setFormComposicao(COMPOSICAO_VAZIA);
    setLinhas([{ ...LINHA_VAZIA }]);
    setMostrarFormComposicao(false);
    setEditandoComposicaoId(null);
    carregar();
  }

  async function alternarAtivoComposicao(c) {
    await supabase.from('composicoes_custo').update({ ativo: !c.ativo }).eq('id', c.id);
    carregar();
  }

  async function excluirComposicao(id) {
    if (!confirm('Excluir esta composição de custo?')) return;
    await supabase.from('composicoes_custo').delete().eq('id', id);
    carregar();
  }

  return (
    <Layout titulo="Composição de Custos">
      <div className="abas-servico" style={{ marginBottom: 28 }}>
        <button className={`aba ${aba === 'composicoes' ? 'aba-ativa' : ''}`} onClick={() => setAba('composicoes')}>Composições</button>
        <button className={`aba ${aba === 'itens' ? 'aba-ativa' : ''}`} onClick={() => setAba('itens')}>Itens de Custo</button>
      </div>

      {aba === 'itens' && (
        <>
          <p className="dica-texto" style={{ marginBottom: 20 }}>
            Cadastre aqui os itens que podem compor um custo (Energia, Água, Meu serviço, Imposto...).
            Depois, na aba Composições, você monta quanto de cada item entra em cada serviço.
          </p>

          {!mostrarFormItem && (
            <button className="botao" style={{ width: 'auto', padding: '12px 24px', marginBottom: 20 }} onClick={iniciarNovoItem}>
              + Novo item de custo
            </button>
          )}

          {mostrarFormItem && (
            <form className="ficha-form" onSubmit={salvarItem} style={{ marginBottom: 32, maxWidth: 480 }}>
              <div className="campo">
                <label>Nome do item</label>
                <input required value={formItem.nome} onChange={(e) => setFormItem({ nome: e.target.value })} placeholder="Ex: Energia, Água, Meu serviço..." />
              </div>
              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 200 }}>
                  {salvando ? 'Salvando...' : editandoItemId ? 'Salvar alterações' : 'Adicionar item'}
                </button>
                <button type="button" className="link-secundario" onClick={() => setMostrarFormItem(false)}>Cancelar</button>
              </div>
            </form>
          )}

          {carregando ? <p>Carregando...</p> : (
            <table className="tabela-refinada">
              <thead><tr><th>Item</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>
                    <td><span className={`status-pill ${item.ativo ? 'ativo' : 'inativo'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="celula-acoes">
                      <button className="botao-secundario" onClick={() => iniciarEdicaoItem(item)}>Editar</button>
                      <button className="botao-secundario" onClick={() => alternarAtivoItem(item)}>{item.ativo ? 'Desativar' : 'Ativar'}</button>
                      <button className="botao-secundario" onClick={() => excluirItem(item.id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && <tr><td colSpan={3}>Nenhum item cadastrado ainda.</td></tr>}
              </tbody>
            </table>
          )}
        </>
      )}

      {aba === 'composicoes' && (
        <>
          <p className="dica-texto" style={{ marginBottom: 20 }}>
            Monte a composição de custo de cada serviço — ex: "Capilar" custa R$200, dividido entre
            Água, Luz, Imposto e seu serviço. Esse total é usado como custo operacional sugerido nos atendimentos.
          </p>

          {!mostrarFormComposicao && (
            <button className="botao" style={{ width: 'auto', padding: '12px 24px', marginBottom: 20 }} onClick={iniciarNovaComposicao}>
              + Nova composição
            </button>
          )}

          {mostrarFormComposicao && (
            <form className="ficha-form" onSubmit={salvarComposicao} style={{ marginBottom: 32 }}>
              <div className="ficha-grid">
                <div className="campo">
                  <label>Nome da composição</label>
                  <input required value={formComposicao.nome} onChange={(e) => setFormComposicao({ ...formComposicao, nome: e.target.value })} placeholder="Ex: Capilar" />
                </div>
                <div className="campo">
                  <label>Serviço vinculado (opcional)</label>
                  <select value={formComposicao.servico_id} onChange={(e) => setFormComposicao({ ...formComposicao, servico_id: e.target.value })}>
                    <option value="">Nenhum específico</option>
                    {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label>Valor de referência (R$)</label>
                  <input type="number" step="0.01" required value={formComposicao.valor_base} onChange={(e) => setFormComposicao({ ...formComposicao, valor_base: e.target.value })} placeholder="Ex: 200" />
                </div>
              </div>

              <h4 className="aplicacoes-titulo">Itens desta composição</h4>

              {linhas.map((linha, index) => (
                <div className="aplicacao-linha" key={index}>
                  <div className="campo">
                    <label>Item de custo</label>
                    <select value={linha.item_id} onChange={(e) => atualizarLinha(index, 'item_id', e.target.value)}>
                      <option value="">Selecione...</option>
                      {itens.filter((i) => i.ativo).map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label>Tipo</label>
                    <select value={linha.tipo} onChange={(e) => atualizarLinha(index, 'tipo', e.target.value)}>
                      <option value="fixo">Valor fixo (R$)</option>
                      <option value="percentual">Percentual (%)</option>
                    </select>
                  </div>
                  <div className="campo">
                    <label>{linha.tipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}</label>
                    <input type="number" step="0.01" value={linha.valor} onChange={(e) => atualizarLinha(index, 'valor', e.target.value)} />
                  </div>
                  {linhas.length > 1 && (
                    <button type="button" className="remover-aplicacao" onClick={() => removerLinha(index)}>Remover item</button>
                  )}
                </div>
              ))}

              <button type="button" className="botao-secundario" onClick={adicionarLinha} style={{ marginBottom: 16 }}>
                + Adicionar item
              </button>

              <p className="dica-texto">
                Total calculado desta composição: {formatarMoeda(totalFormComposicao)}
                {formComposicao.valor_base > 0 && ` (referência: ${formatarMoeda(formComposicao.valor_base)})`}
              </p>

              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                  {salvando ? 'Salvando...' : editandoComposicaoId ? 'Salvar alterações' : 'Salvar composição'}
                </button>
                <button type="button" className="link-secundario" onClick={() => { setMostrarFormComposicao(false); setEditandoComposicaoId(null); }}>Cancelar</button>
              </div>
            </form>
          )}

          {carregando ? <p>Carregando...</p> : (
            <div className="lista-registros">
              {composicoes.length === 0 && <p className="galeria-vazio">Nenhuma composição cadastrada ainda.</p>}
              {composicoes.map((c) => {
                const total = calcularTotalComposicao(c.composicao_linhas || [], c.valor_base);
                return (
                  <div className="registro-card" key={c.id}>
                    <div className="registro-topo">
                      <strong>{c.nome} {c.servicos?.nome && `· ${c.servicos.nome}`}</strong>
                      <div className="registro-topo-direita">
                        <span className={`status-pill ${c.ativo ? 'ativo' : 'inativo'}`}>{c.ativo ? 'Ativa' : 'Inativa'}</span>
                        <div className="registro-acoes">
                          <button onClick={() => iniciarEdicaoComposicao(c)}>Editar</button>
                          <button onClick={() => alternarAtivoComposicao(c)}>{c.ativo ? 'Desativar' : 'Ativar'}</button>
                          <button onClick={() => excluirComposicao(c.id)}>Excluir</button>
                        </div>
                      </div>
                    </div>
                    {(c.composicao_linhas || []).map((l) => (
                      <p key={l.id}>
                        {l.custo_itens?.nome || 'Item removido'}: {l.tipo === 'percentual' ? `${l.valor}% (${formatarMoeda((l.valor / 100) * c.valor_base)})` : formatarMoeda(l.valor)}
                      </p>
                    ))}
                    <p className="registro-custo-total">Total da composição: {formatarMoeda(total)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
