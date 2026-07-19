import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function calcularTotalComposicao(linhas, valorBase) {
  return (linhas || []).reduce((soma, l) => {
    const valor = Number(l.valor) || 0;
    return soma + (l.tipo === 'percentual' ? (valor / 100) * valorBase : valor);
  }, 0);
}

const PRODUTO_VAZIO = { nome: '', preco_total: '', tipo: 'simples', unidade: 'unidade', quantidade_total: 1, especificacao: '' };
const ITEM_KIT_VAZIO = { nome_item: '', custo: '', quantidade: 1 };
const COMPOSICAO_VAZIA = { nome: '', servico_id: '', valor_base: '' };
const LINHA_VAZIA = { item_id: '', itemNome: '', tipo: 'fixo', valor: '' };

export default function Custo() {
  const [aba, setAba] = useState('composicoes');
  const [carregando, setCarregando] = useState(true);

  const [servicos, setServicos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [custoItens, setCustoItens] = useState([]);
  const [composicoes, setComposicoes] = useState([]);

  async function carregar() {
    setCarregando(true);
    const [{ data: s }, { data: p }, { data: ci }, { data: c }] = await Promise.all([
      supabase.from('servicos').select('*').order('criado_em'),
      supabase.from('produtos').select('*, produto_kit_itens(*)').order('nome'),
      supabase.from('custo_itens').select('*').order('nome'),
      supabase.from('composicoes_custo').select('*, servicos(nome), composicao_linhas(*, custo_itens(nome))').order('nome'),
    ]);
    setServicos(s || []);
    setProdutos(p || []);
    setCustoItens(ci || []);
    setComposicoes(c || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <Layout titulo="Custo">
      <div className="abas-servico" style={{ marginBottom: 28 }}>
        <button className={`aba ${aba === 'composicoes' ? 'aba-ativa' : ''}`} onClick={() => setAba('composicoes')}>Composições</button>
        <button className={`aba ${aba === 'produtos' ? 'aba-ativa' : ''}`} onClick={() => setAba('produtos')}>Produtos</button>
        <button className={`aba ${aba === 'servicos' ? 'aba-ativa' : ''}`} onClick={() => setAba('servicos')}>Serviços</button>
      </div>

      {carregando ? <p>Carregando...</p> : (
        <>
          {aba === 'servicos' && <AbaServicos servicos={servicos} recarregar={carregar} />}
          {aba === 'produtos' && <AbaProdutos produtos={produtos} recarregar={carregar} />}
          {aba === 'composicoes' && (
            <AbaComposicoes composicoes={composicoes} servicos={servicos} custoItens={custoItens} recarregar={carregar} />
          )}
        </>
      )}
    </Layout>
  );
}

// =====================================================================
// ABA: Serviços
// =====================================================================
function AbaServicos({ servicos, recarregar }) {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  function gerarSlug(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from('servicos').insert({ nome: nome.trim(), slug: gerarSlug(nome) });
    setSalvando(false);
    if (error) { alert('Erro ao cadastrar: ' + error.message); return; }
    setNome('');
    recarregar();
  }

  async function alternarAtivo(s) {
    await supabase.from('servicos').update({ ativo: !s.ativo }).eq('id', s.id);
    recarregar();
  }

  return (
    <>
      <p className="dica-texto" style={{ marginBottom: 20 }}>
        Os serviços aqui viram abas na ficha do paciente. Um serviço novo ganha automaticamente uma ficha padrão
        (registro + fotos) até que uma ficha específica seja programada para ele.
      </p>

      <form className="ficha-form" onSubmit={adicionar} style={{ marginBottom: 24, maxWidth: 460 }}>
        <div className="campo">
          <label>Novo serviço</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Depilação a Laser" />
        </div>
        <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
          {salvando ? 'Salvando...' : '+ Adicionar serviço'}
        </button>
      </form>

      <table className="tabela-refinada">
        <thead><tr><th>Nome</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {servicos.map((s) => (
            <tr key={s.id}>
              <td>{s.nome}</td>
              <td><span className={`status-pill ${s.ativo ? 'ativo' : 'inativo'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td><button className="botao-secundario" onClick={() => alternarAtivo(s)}>{s.ativo ? 'Desativar' : 'Ativar'}</button></td>
            </tr>
          ))}
          {servicos.length === 0 && <tr><td colSpan={3}>Nenhum serviço cadastrado ainda.</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// =====================================================================
// ABA: Produtos
// =====================================================================
function AbaProdutos({ produtos, recarregar }) {
  const [form, setForm] = useState(PRODUTO_VAZIO);
  const [itensKit, setItensKit] = useState([{ ...ITEM_KIT_VAZIO }]);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function iniciarNovo() {
    setForm(PRODUTO_VAZIO);
    setItensKit([{ ...ITEM_KIT_VAZIO }]);
    setDetalhesAbertos(false);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(p) {
    setForm({
      nome: p.nome, preco_total: p.preco_total ?? '', tipo: p.tipo || 'simples',
      unidade: p.unidade || 'unidade', quantidade_total: p.quantidade_total ?? 1, especificacao: p.especificacao || '',
    });
    setItensKit(p.produto_kit_itens?.length > 0 ? p.produto_kit_itens.map((i) => ({ nome_item: i.nome_item, custo: i.custo, quantidade: i.quantidade })) : [{ ...ITEM_KIT_VAZIO }]);
    setDetalhesAbertos(p.tipo === 'kit');
    setEditandoId(p.id);
    setMostrarForm(true);
  }

  const totalKit = itensKit.reduce((soma, it) => soma + (Number(it.custo) || 0) * (Number(it.quantidade) || 1), 0);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = form.tipo === 'kit'
      ? { nome: form.nome, especificacao: form.especificacao, tipo: 'kit', unidade: 'kit', quantidade_total: 1, preco_total: totalKit }
      : { nome: form.nome, especificacao: form.especificacao, tipo: 'simples', unidade: form.unidade || 'unidade', quantidade_total: form.quantidade_total || 1, preco_total: form.preco_total || 0 };

    let produtoId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('produtos').update(dados).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      if (form.tipo === 'kit') await supabase.from('produto_kit_itens').delete().eq('produto_id', editandoId);
    } else {
      const { data, error } = await supabase.from('produtos').insert(dados).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      produtoId = data.id;
    }

    if (form.tipo === 'kit') {
      const itensParaSalvar = itensKit.filter((i) => i.nome_item.trim()).map((i) => ({ produto_id: produtoId, nome_item: i.nome_item, custo: i.custo || 0, quantidade: i.quantidade || 1 }));
      if (itensParaSalvar.length > 0) await supabase.from('produto_kit_itens').insert(itensParaSalvar);
    }

    setSalvando(false);
    setForm(PRODUTO_VAZIO);
    setItensKit([{ ...ITEM_KIT_VAZIO }]);
    setMostrarForm(false);
    setEditandoId(null);
    recarregar();
  }

  async function alternarAtivo(p) {
    await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id);
    recarregar();
  }

  async function excluir(p) {
    if (!confirm(`Excluir o produto "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('produtos').delete().eq('id', p.id);
    if (error) {
      alert('Não foi possível excluir — esse produto já foi usado em algum atendimento. Você pode desativá-lo em vez de excluir, pra manter o histórico intacto.');
      return;
    }
    recarregar();
  }

  return (
    <>
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>Cadastro interno usado nas aplicações — não é catálogo de venda.</p>
        <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>+ Novo produto</button>
      </div>

      {mostrarForm && (
        <div className="modal-fundo" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>
          <div className="modal-caixa" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topo">
              <h3>{editandoId ? 'Editar produto' : 'Novo produto'}</h3>
              <button className="modal-fechar" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>×</button>
            </div>

            <form onSubmit={salvar}>
              <div className="row2 ficha-grid">
                <div className="campo">
                  <label>Nome do produto</label>
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Toxina botulínica" />
                </div>
                <div className="campo">
                  <label>{form.tipo === 'kit' ? 'Custo total do kit' : 'Preço pago (R$)'}</label>
                  {form.tipo === 'kit' ? (
                    <input disabled value={formatarMoeda(totalKit)} style={{ opacity: 0.7 }} />
                  ) : (
                    <input type="number" step="0.01" value={form.preco_total} onChange={(e) => setForm({ ...form, preco_total: e.target.value })} placeholder="Ex: 450" />
                  )}
                </div>
              </div>

              <button type="button" className="link-secundario" style={{ textAlign: 'left', width: 'auto', margin: '0 0 14px' }} onClick={() => setDetalhesAbertos((v) => !v)}>
                {detalhesAbertos ? '− menos detalhes' : '+ mais detalhes'}
              </button>

              {detalhesAbertos && (
                <div style={{ marginBottom: 16 }}>
                  <div className="campo">
                    <label>Tipo</label>
                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                      <option value="simples">Produto simples</option>
                      <option value="kit">Kit (composto por vários itens)</option>
                    </select>
                  </div>

                  {form.tipo === 'simples' ? (
                    <div className="ficha-grid">
                      <div className="campo">
                        <label>Unidade</label>
                        <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                          <option value="unidade">unidade</option>
                          <option value="ml">ml</option>
                          <option value="mg">mg</option>
                          <option value="ui">UI</option>
                        </select>
                      </div>
                      <div className="campo">
                        <label>Quantidade na embalagem</label>
                        <input type="number" step="0.01" value={form.quantidade_total} onChange={(e) => setForm({ ...form, quantidade_total: e.target.value })} />
                      </div>
                      <div className="campo">
                        <label>Especificação</label>
                        <input value={form.especificacao} onChange={(e) => setForm({ ...form, especificacao: e.target.value })} placeholder="Marca, concentração..." />
                      </div>
                    </div>
                  ) : (
                    <>
                      {itensKit.map((item, i) => (
                        <div className="aplicacao-linha" key={i}>
                          <div className="campo"><label>Item</label><input value={item.nome_item} onChange={(e) => setItensKit((l) => l.map((x, xi) => xi === i ? { ...x, nome_item: e.target.value } : x))} placeholder="Luva, seringa..." /></div>
                          <div className="campo"><label>Custo (R$)</label><input type="number" step="0.01" value={item.custo} onChange={(e) => setItensKit((l) => l.map((x, xi) => xi === i ? { ...x, custo: e.target.value } : x))} /></div>
                          <div className="campo"><label>Quantidade</label><input type="number" value={item.quantidade} onChange={(e) => setItensKit((l) => l.map((x, xi) => xi === i ? { ...x, quantidade: e.target.value } : x))} /></div>
                          {itensKit.length > 1 && <button type="button" className="remover-aplicacao" onClick={() => setItensKit((l) => l.filter((_, xi) => xi !== i))}>Remover item</button>}
                        </div>
                      ))}
                      <button type="button" className="botao-secundario" onClick={() => setItensKit((l) => [...l, { ...ITEM_KIT_VAZIO }])} style={{ marginBottom: 12 }}>+ Adicionar item</button>
                    </>
                  )}
                </div>
              )}

              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar produto'}</button>
                <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <table className="tabela-refinada">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Custo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.tipo === 'kit' ? 'Kit' : 'Simples'}</td>
              <td>{formatarMoeda(p.custo_unitario)}{p.tipo === 'simples' && p.quantidade_total > 1 ? ` / ${p.unidade}` : ''}</td>
              <td><span className={`status-pill ${p.ativo ? 'ativo' : 'inativo'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
              <td className="celula-acoes">
                <button className="botao-secundario" onClick={() => iniciarEdicao(p)}>Editar</button>
                <button className="botao-secundario" onClick={() => alternarAtivo(p)}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                <button className="botao-secundario" onClick={() => excluir(p)}>Excluir</button>
              </td>
            </tr>
          ))}
          {produtos.length === 0 && <tr><td colSpan={5}>Nenhum produto cadastrado ainda.</td></tr>}
        </tbody>
      </table>
    </>
  );
}

// =====================================================================
// ABA: Composições de custo
// =====================================================================
function AbaComposicoes({ composicoes, servicos, custoItens, recarregar }) {
  const [form, setForm] = useState(COMPOSICAO_VAZIA);
  const [linhas, setLinhas] = useState([{ ...LINHA_VAZIA }]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [sugestaoAberta, setSugestaoAberta] = useState(null);
  const [itensDisponiveis, setItensDisponiveis] = useState(custoItens);

  useEffect(() => { setItensDisponiveis(custoItens); }, [custoItens]);

  function iniciarNovo() {
    setForm(COMPOSICAO_VAZIA);
    setLinhas([{ ...LINHA_VAZIA }]);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(c) {
    setForm({ nome: c.nome, servico_id: c.servico_id || '', valor_base: c.valor_base });
    setLinhas(
      (c.composicao_linhas || []).length > 0
        ? c.composicao_linhas.map((l) => ({ item_id: l.item_id || '', itemNome: l.custo_itens?.nome || '', tipo: l.tipo, valor: l.valor }))
        : [{ ...LINHA_VAZIA }]
    );
    setEditandoId(c.id);
    setMostrarForm(true);
  }

  function atualizarLinha(index, campo, valor) {
    setLinhas((lista) => lista.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  function buscarItem(index, texto) {
    atualizarLinha(index, 'itemNome', texto);
    atualizarLinha(index, 'item_id', '');
    setSugestaoAberta(texto ? index : null);
  }

  function escolherItemExistente(index, item) {
    atualizarLinha(index, 'item_id', item.id);
    atualizarLinha(index, 'itemNome', item.nome);
    setSugestaoAberta(null);
  }

  async function criarECelecionarItem(index, nome) {
    const { data, error } = await supabase.from('custo_itens').insert({ nome }).select().single();
    if (error) { alert('Erro ao criar item: ' + error.message); return; }
    setItensDisponiveis((l) => [...l, data]);
    atualizarLinha(index, 'item_id', data.id);
    atualizarLinha(index, 'itemNome', data.nome);
    setSugestaoAberta(null);
  }

  const totalFormComposicao = calcularTotalComposicao(linhas, Number(form.valor_base) || 0);

  async function salvarComposicao(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = { nome: form.nome, servico_id: form.servico_id || null, valor_base: form.valor_base || 0 };
    let composicaoId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('composicoes_custo').update(dados).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('composicao_linhas').delete().eq('composicao_id', editandoId);
    } else {
      const { data, error } = await supabase.from('composicoes_custo').insert(dados).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      composicaoId = data.id;
    }

    const linhasParaSalvar = linhas.filter((l) => l.item_id).map((l) => ({ composicao_id: composicaoId, item_id: l.item_id, tipo: l.tipo, valor: l.valor || 0 }));
    if (linhasParaSalvar.length > 0) {
      const { error } = await supabase.from('composicao_linhas').insert(linhasParaSalvar);
      if (error) alert('Erro ao salvar itens: ' + error.message);
    }

    setSalvando(false);
    setForm(COMPOSICAO_VAZIA);
    setLinhas([{ ...LINHA_VAZIA }]);
    setMostrarForm(false);
    setEditandoId(null);
    recarregar();
  }

  async function alternarAtivo(c) {
    await supabase.from('composicoes_custo').update({ ativo: !c.ativo }).eq('id', c.id);
    recarregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir esta composição?')) return;
    await supabase.from('composicoes_custo').delete().eq('id', id);
    recarregar();
  }

  return (
    <>
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>Monte o custo de cada serviço combinando itens em R$ ou %.</p>
        <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>+ Nova composição</button>
      </div>

      {mostrarForm && (
        <div className="modal-fundo" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>
          <div className="modal-caixa" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topo">
              <h3>{editandoId ? 'Editar composição' : 'Nova composição'}</h3>
              <button className="modal-fechar" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>×</button>
            </div>

            <form onSubmit={salvarComposicao}>
              <div className="ficha-grid">
                <div className="campo">
                  <label>Nome da composição</label>
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Capilar" />
                </div>
                <div className="campo">
                  <label>Serviço vinculado (opcional)</label>
                  <select value={form.servico_id} onChange={(e) => setForm({ ...form, servico_id: e.target.value })}>
                    <option value="">Nenhum específico</option>
                    {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label>Valor de referência (R$)</label>
                  <input type="number" step="0.01" required value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value })} placeholder="Ex: 200" />
                </div>
              </div>

              <h4 className="aplicacoes-titulo">Itens desta composição</h4>

              {linhas.map((linha, index) => {
                const sugestoes = itensDisponiveis.filter((i) => i.nome.toLowerCase().includes((linha.itemNome || '').toLowerCase()));
                const existeExato = itensDisponiveis.some((i) => i.nome.toLowerCase() === (linha.itemNome || '').toLowerCase());
                return (
                  <div className="aplicacao-linha" key={index}>
                    <div className="campo autocomplete-wrap">
                      <label>Item de custo</label>
                      <input
                        value={linha.itemNome}
                        onChange={(e) => buscarItem(index, e.target.value)}
                        onFocus={() => linha.itemNome && setSugestaoAberta(index)}
                        placeholder="Ex: Água"
                        autoComplete="off"
                      />
                      {sugestaoAberta === index && linha.itemNome && (
                        <div className="sugestoes-caixa">
                          {sugestoes.map((s) => (
                            <div key={s.id} className="sugestao-item" onMouseDown={() => escolherItemExistente(index, s)}>{s.nome}</div>
                          ))}
                          {!existeExato && (
                            <div className="sugestao-item sugestao-criar" onMouseDown={() => criarECelecionarItem(index, linha.itemNome)}>
                              + Criar "{linha.itemNome}"
                            </div>
                          )}
                        </div>
                      )}
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
                    {linhas.length > 1 && <button type="button" className="remover-aplicacao" onClick={() => setLinhas((l) => l.filter((_, i) => i !== index))}>Remover item</button>}
                  </div>
                );
              })}

              <button type="button" className="botao-secundario" onClick={() => setLinhas((l) => [...l, { ...LINHA_VAZIA }])} style={{ marginBottom: 16 }}>+ Adicionar item</button>

              <p className="dica-texto">Total calculado: <strong>{formatarMoeda(totalFormComposicao)}</strong></p>

              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar composição'}</button>
                <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <button onClick={() => iniciarEdicao(c)}>Editar</button>
                    <button onClick={() => alternarAtivo(c)}>{c.ativo ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => excluir(c.id)}>Excluir</button>
                  </div>
                </div>
              </div>
              {(c.composicao_linhas || []).map((l) => (
                <p key={l.id}>{l.custo_itens?.nome || 'Item removido'}: {l.tipo === 'percentual' ? `${l.valor}% (${formatarMoeda((l.valor / 100) * c.valor_base)})` : formatarMoeda(l.valor)}</p>
              ))}
              <p className="registro-custo-total">Total da composição: {formatarMoeda(total)}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
