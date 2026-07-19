import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';
import { ModalExames } from '../ModalExames';
import { gerarTextoClinico } from '../../lib/geracaoTexto';

const PRODUTO_VAZIO = { produto_id: '', quantidade: '', unidade: 'ml', lote: '', validade: '', especificacao: '' };
const APLICACAO_VAZIA = { procedimento: '', produtos: [{ ...PRODUTO_VAZIO }] };
const VAZIO = {
  tipo_queda: '', classificacao: '', protocolo: '', data_sessao: '', observacoes: '',
  laudo: '', receituario: '', exames: [],
  composicao_id: '', custo_operacional: '', valor_cobrado: '', pacote_id: '',
  aplicacoes: [{ ...APLICACAO_VAZIA }],
};

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return null;
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function custoProduto(produtoLinha) {
  const produto = produtoLinha.produtos;
  if (!produto || !produto.custo_unitario || !produtoLinha.quantidade) return null;
  if (produto.unidade && produtoLinha.unidade && produto.unidade !== produtoLinha.unidade) return null;
  return produto.custo_unitario * produtoLinha.quantidade;
}

function custoProdutoForm(prod, listaProdutos) {
  const produto = listaProdutos.find((p) => p.id === prod.produto_id);
  if (!produto || !produto.custo_unitario || !prod.quantidade) return null;
  if (produto.unidade && prod.unidade && produto.unidade !== prod.unidade) return null;
  return produto.custo_unitario * prod.quantidade;
}

function custoAplicacaoSalva(aplicacao) {
  const produtos = aplicacao.capilar_aplicacao_produtos || [];
  const custos = produtos.map(custoProduto).filter((c) => c !== null);
  return custos.reduce((soma, c) => soma + c, 0);
}

function custoProdutosRegistro(registro) {
  const aplicacoes = registro.capilar_aplicacoes || [];
  if (aplicacoes.length === 0) return null;
  const total = aplicacoes.reduce((soma, ap) => soma + custoAplicacaoSalva(ap), 0);
  return total;
}

function calcularTotalComposicao(linhas, valorBase) {
  return (linhas || []).reduce((soma, l) => {
    const valor = Number(l.valor) || 0;
    return soma + (l.tipo === 'percentual' ? (valor / 100) * valorBase : valor);
  }, 0);
}

export function FichaCapilar({ pacienteId, pacienteNome }) {
  const [registros, setRegistros] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [composicoes, setComposicoes] = useState([]);
  const [pacotes, setPacotes] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [modalExamesAberto, setModalExamesAberto] = useState(false);
  const [gerandoLaudo, setGerandoLaudo] = useState(false);
  const [gerandoReceituario, setGerandoReceituario] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('fichas_capilar')
      .select('*, ficha_capilar_exames(*, exames_itens(nome)), capilar_aplicacoes(*, capilar_aplicacao_produtos(*, produtos(nome, custo_unitario, unidade)))')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setRegistros(data || []);

    const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
    setProdutos(prods || []);

    const { data: composicoesData } = await supabase
      .from('composicoes_custo')
      .select('*, composicao_linhas(*)')
      .eq('ativo', true)
      .order('nome');
    setComposicoes(composicoesData || []);

    const { data: pacotesData } = await supabase
      .from('pacotes')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('status', 'ativo')
      .order('criado_em', { ascending: false });
    setPacotes(pacotesData || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  function iniciarNovo() {
    setForm(VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(r) {
    setForm({
      tipo_queda: r.tipo_queda || '',
      classificacao: r.classificacao || '',
      protocolo: r.protocolo || '',
      data_sessao: r.data_sessao || '',
      observacoes: r.observacoes || '',
      laudo: r.laudo || '',
      receituario: r.receituario || '',
      composicao_id: r.composicao_id || '',
      custo_operacional: r.custo_operacional ?? '',
      valor_cobrado: r.valor_cobrado ?? '',
      pacote_id: r.pacote_id || '',
      exames: (r.ficha_capilar_exames || []).map((e) => ({
        exame_id: e.exame_id, nome: e.exames_itens?.nome || '', valor: e.valor || '',
      })),
      aplicacoes: (r.capilar_aplicacoes || []).length > 0
        ? r.capilar_aplicacoes.map((ap) => ({
            procedimento: ap.procedimento || '',
            produtos: (ap.capilar_aplicacao_produtos || []).length > 0
              ? ap.capilar_aplicacao_produtos.map((p) => ({
                  produto_id: p.produto_id || '',
                  quantidade: p.quantidade ?? '',
                  unidade: p.unidade || 'ml',
                  lote: p.lote || '',
                  validade: p.validade || '',
                  especificacao: p.especificacao || '',
                }))
              : [{ ...PRODUTO_VAZIO }],
          }))
        : [{ ...APLICACAO_VAZIA }],
    });
    setEditandoId(r.id);
    setMostrarForm(true);
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return;
    await supabase.from('fichas_capilar').delete().eq('id', id);
    await supabase.from('contas_receber').delete().eq('origem_tipo', 'capilar').eq('origem_id', id);
    carregar();
  }

  function atualizarValorExame(exameId, valor) {
    setForm((f) => ({
      ...f,
      exames: f.exames.map((e) => (e.exame_id === exameId ? { ...e, valor } : e)),
    }));
  }

  function atualizarProcedimento(indexAp, valor) {
    setForm((f) => {
      const aplicacoes = [...f.aplicacoes];
      aplicacoes[indexAp] = { ...aplicacoes[indexAp], procedimento: valor };
      return { ...f, aplicacoes };
    });
  }

  function atualizarProdutoDaAplicacao(indexAp, indexProd, campo, valor) {
    setForm((f) => {
      const aplicacoes = [...f.aplicacoes];
      const produtosDaAplicacao = [...aplicacoes[indexAp].produtos];
      produtosDaAplicacao[indexProd] = { ...produtosDaAplicacao[indexProd], [campo]: valor };
      aplicacoes[indexAp] = { ...aplicacoes[indexAp], produtos: produtosDaAplicacao };
      return { ...f, aplicacoes };
    });
  }

  function selecionarProdutoNaAplicacao(indexAp, indexProd, produtoId) {
    const produto = produtos.find((p) => p.id === produtoId);
    atualizarProdutoDaAplicacao(indexAp, indexProd, 'produto_id', produtoId);
    if (produto?.especificacao) atualizarProdutoDaAplicacao(indexAp, indexProd, 'especificacao', produto.especificacao);
    if (produto?.unidade) atualizarProdutoDaAplicacao(indexAp, indexProd, 'unidade', produto.unidade);
  }

  function adicionarAplicacao() {
    setForm((f) => ({ ...f, aplicacoes: [...f.aplicacoes, { ...APLICACAO_VAZIA, produtos: [{ ...PRODUTO_VAZIO }] }] }));
  }

  function removerAplicacao(indexAp) {
    setForm((f) => ({ ...f, aplicacoes: f.aplicacoes.filter((_, i) => i !== indexAp) }));
  }

  function adicionarProdutoNaAplicacao(indexAp) {
    setForm((f) => {
      const aplicacoes = [...f.aplicacoes];
      aplicacoes[indexAp] = { ...aplicacoes[indexAp], produtos: [...aplicacoes[indexAp].produtos, { ...PRODUTO_VAZIO }] };
      return { ...f, aplicacoes };
    });
  }

  function removerProdutoDaAplicacao(indexAp, indexProd) {
    setForm((f) => {
      const aplicacoes = [...f.aplicacoes];
      aplicacoes[indexAp] = { ...aplicacoes[indexAp], produtos: aplicacoes[indexAp].produtos.filter((_, i) => i !== indexProd) };
      return { ...f, aplicacoes };
    });
  }

  function selecionarComposicao(composicaoId) {
    const composicao = composicoes.find((c) => c.id === composicaoId);
    const total = composicao ? calcularTotalComposicao(composicao.composicao_linhas, composicao.valor_base) : '';
    setForm((f) => ({ ...f, composicao_id: composicaoId, custo_operacional: total !== '' ? total.toFixed(2) : '' }));
  }

  async function sincronizarContaReceber(fichaId, valor, dataRef) {
    if (!valor || valor <= 0) return;
    const { data: existente } = await supabase
      .from('contas_receber')
      .select('id')
      .eq('origem_tipo', 'capilar')
      .eq('origem_id', fichaId)
      .maybeSingle();

    if (existente) {
      await supabase.from('contas_receber').update({ valor, data_prevista: dataRef || null }).eq('id', existente.id);
    } else {
      await supabase.from('contas_receber').insert({
        paciente_id: pacienteId,
        origem_tipo: 'capilar',
        origem_id: fichaId,
        descricao: 'Capilar',
        valor,
        data_prevista: dataRef || null,
        status: 'pendente',
      });
    }
  }

  async function gerarLaudo() {
    setGerandoLaudo(true);
    try {
      const dadosExames = {};
      form.exames.forEach((e) => { dadosExames[e.nome] = e.valor; });
      const texto = await gerarTextoClinico({
        tipo: 'laudo',
        servico: 'capilar',
        pacienteNome,
        dados: {
          'Tipo de queda': form.tipo_queda,
          'Classificação': form.classificacao,
          'Protocolo': form.protocolo,
          'Observações': form.observacoes,
          ...dadosExames,
        },
      });
      setForm((f) => ({ ...f, laudo: texto }));
    } catch (err) {
      alert('Erro ao gerar laudo: ' + err.message);
    }
    setGerandoLaudo(false);
  }

  async function gerarReceituario() {
    setGerandoReceituario(true);
    try {
      const texto = await gerarTextoClinico({
        tipo: 'receituario',
        servico: 'capilar',
        pacienteNome,
        dados: {
          'Tipo de queda': form.tipo_queda,
          'Protocolo': form.protocolo,
          'Observações': form.observacoes,
        },
      });
      setForm((f) => ({ ...f, receituario: texto }));
    } catch (err) {
      alert('Erro ao gerar receituário: ' + err.message);
    }
    setGerandoReceituario(false);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = {
      tipo_queda: form.tipo_queda,
      classificacao: form.classificacao,
      protocolo: form.protocolo,
      data_sessao: form.data_sessao || null,
      observacoes: form.observacoes,
      laudo: form.laudo,
      receituario: form.receituario,
      composicao_id: form.composicao_id || null,
      custo_operacional: form.custo_operacional || null,
      valor_cobrado: form.valor_cobrado || null,
      pacote_id: form.pacote_id || null,
    };

    let fichaId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('fichas_capilar').update(dados).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('ficha_capilar_exames').delete().eq('ficha_capilar_id', editandoId);
      await supabase.from('capilar_aplicacoes').delete().eq('ficha_capilar_id', editandoId);
    } else {
      const { data, error } = await supabase.from('fichas_capilar').insert({ paciente_id: pacienteId, ...dados }).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      fichaId = data.id;
    }

    if (form.exames.length > 0) {
      const linhasExames = form.exames.map((ex) => ({ ficha_capilar_id: fichaId, exame_id: ex.exame_id, valor: ex.valor }));
      const { error } = await supabase.from('ficha_capilar_exames').insert(linhasExames);
      if (error) alert('Erro ao salvar exames: ' + error.message);
    }

    const aplicacoesValidas = form.aplicacoes.filter((ap) => ap.procedimento || ap.produtos.some((p) => p.produto_id));
    for (const ap of aplicacoesValidas) {
      const { data: apRow, error: erroAp } = await supabase
        .from('capilar_aplicacoes')
        .insert({ ficha_capilar_id: fichaId, procedimento: ap.procedimento })
        .select()
        .single();

      if (erroAp) { alert('Erro ao salvar aplicação: ' + erroAp.message); continue; }

      const produtosParaSalvar = ap.produtos
        .filter((p) => p.produto_id)
        .map((p) => ({
          aplicacao_id: apRow.id,
          produto_id: p.produto_id,
          quantidade: p.quantidade || null,
          unidade: p.unidade || 'ml',
          lote: p.lote,
          validade: p.validade || null,
          especificacao: p.especificacao,
        }));

      if (produtosParaSalvar.length > 0) {
        const { error: erroProd } = await supabase.from('capilar_aplicacao_produtos').insert(produtosParaSalvar);
        if (erroProd) alert('Erro ao salvar produtos: ' + erroProd.message);
      }
    }

    if (form.pacote_id) {
      // Atendimento coberto por um pacote já pago: não gera conta nova.
      // Se por acaso já existia uma conta avulsa deste registro, remove.
      await supabase.from('contas_receber').delete().eq('origem_tipo', 'capilar').eq('origem_id', fichaId);
      if (!editandoId) {
        const pacote = pacotes.find((p) => p.id === form.pacote_id);
        if (pacote) {
          await supabase.from('pacotes').update({ sessoes_utilizadas: (pacote.sessoes_utilizadas || 0) + 1 }).eq('id', pacote.id);
        }
      }
    } else {
      await sincronizarContaReceber(fichaId, Number(form.valor_cobrado) || 0, form.data_sessao);
    }

    setSalvando(false);
    setForm(VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  return (
    <div className="ficha-servico">
      <div className="ficha-secao">
        <div className="ficha-secao-topo">
          <h3>Histórico de registros — Capilar</h3>
          {!mostrarForm && (
            <button className="botao-secundario" onClick={iniciarNovo}>+ Novo registro</button>
          )}
        </div>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar}>
            <div className="ficha-grid">
              <div className="campo">
                <label>Tipo de queda</label>
                <input value={form.tipo_queda} onChange={(e) => setForm({ ...form, tipo_queda: e.target.value })} placeholder="Eflúvio telogênico, androgenética..." />
              </div>
              <div className="campo">
                <label>Classificação</label>
                <input value={form.classificacao} onChange={(e) => setForm({ ...form, classificacao: e.target.value })} placeholder="Ludwig, Norwood..." />
              </div>
              <div className="campo">
                <label>Protocolo</label>
                <input value={form.protocolo} onChange={(e) => setForm({ ...form, protocolo: e.target.value })} placeholder="Laser, fotobiomodulação, PRP..." />
              </div>
              <div className="campo">
                <label>Data da sessão</label>
                <input type="date" value={form.data_sessao} onChange={(e) => setForm({ ...form, data_sessao: e.target.value })} />
              </div>
            </div>

            <button type="button" className="botao-exames" onClick={() => setModalExamesAberto(true)}>
              🧪 Exames {form.exames.length > 0 ? `(${form.exames.length} selecionado${form.exames.length > 1 ? 's' : ''})` : '— nenhum selecionado'}
            </button>

            {form.exames.length > 0 && (
              <div className="exames-selecionados-grid">
                {form.exames.map((ex) => (
                  <div className="campo" key={ex.exame_id}>
                    <label>{ex.nome}</label>
                    <input value={ex.valor} onChange={(e) => atualizarValorExame(ex.exame_id, e.target.value)} placeholder="Resultado" />
                  </div>
                ))}
              </div>
            )}

            <h4 className="aplicacoes-titulo">Aplicações deste atendimento</h4>

            {form.aplicacoes.map((ap, indexAp) => (
              <div className="aplicacao-bloco" key={indexAp}>
                <div className="campo">
                  <label>Procedimento</label>
                  <input value={ap.procedimento} onChange={(e) => atualizarProcedimento(indexAp, e.target.value)} placeholder="Laser, PRP, mesoterapia..." />
                </div>

                <p className="produtos-subtitulo">Produtos usados nesta aplicação</p>

                {ap.produtos.map((prod, indexProd) => (
                  <div className="aplicacao-linha" key={indexProd}>
                    <div className="campo">
                      <label>Produto</label>
                      <select value={prod.produto_id} onChange={(e) => selecionarProdutoNaAplicacao(indexAp, indexProd, e.target.value)}>
                        <option value="">Selecione...</option>
                        {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div className="campo">
                      <label>Quantidade</label>
                      <div className="campo-composto">
                        <input type="number" step="0.1" value={prod.quantidade} onChange={(e) => atualizarProdutoDaAplicacao(indexAp, indexProd, 'quantidade', e.target.value)} />
                        <select value={prod.unidade} onChange={(e) => atualizarProdutoDaAplicacao(indexAp, indexProd, 'unidade', e.target.value)}>
                          <option value="ml">ml</option>
                          <option value="mg">mg</option>
                          <option value="ui">UI</option>
                          <option value="unidade">un.</option>
                        </select>
                      </div>
                    </div>
                    <div className="campo">
                      <label>Lote</label>
                      <input value={prod.lote} onChange={(e) => atualizarProdutoDaAplicacao(indexAp, indexProd, 'lote', e.target.value)} />
                    </div>
                    <div className="campo">
                      <label>Validade</label>
                      <input type="date" value={prod.validade} onChange={(e) => atualizarProdutoDaAplicacao(indexAp, indexProd, 'validade', e.target.value)} />
                    </div>
                    <div className="campo">
                      <label>Especificação</label>
                      <input value={prod.especificacao} onChange={(e) => atualizarProdutoDaAplicacao(indexAp, indexProd, 'especificacao', e.target.value)} placeholder="Marca, concentração..." />
                    </div>
                    {ap.produtos.length > 1 && (
                      <button type="button" className="remover-aplicacao" onClick={() => removerProdutoDaAplicacao(indexAp, indexProd)}>Remover este produto</button>
                    )}
                    {custoProdutoForm(prod, produtos) !== null && (
                      <p className="custo-linha-form">Custo estimado: {formatarMoeda(custoProdutoForm(prod, produtos))}</p>
                    )}
                  </div>
                ))}

                <button type="button" className="botao-secundario" onClick={() => adicionarProdutoNaAplicacao(indexAp)} style={{ marginBottom: 4 }}>
                  + Adicionar produto nesta aplicação
                </button>

                {form.aplicacoes.length > 1 && (
                  <button type="button" className="remover-aplicacao-inteira" onClick={() => removerAplicacao(indexAp)}>Remover esta aplicação inteira</button>
                )}
              </div>
            ))}

            <button type="button" className="botao-secundario" onClick={adicionarAplicacao} style={{ marginBottom: 20 }}>
              + Adicionar outra aplicação (novo procedimento)
            </button>

            <div className="campo">
              <label>Composição de custo aplicada (opcional)</label>
              <select value={form.composicao_id} onChange={(e) => selecionarComposicao(e.target.value)}>
                <option value="">Nenhuma — preencher manualmente</option>
                {composicoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <p className="dica-texto" style={{ marginTop: 6 }}>Escolher uma composição preenche o custo operacional abaixo automaticamente (você pode ajustar).</p>
            </div>

            <div className="campo">
              <label>Vincular a um pacote (opcional)</label>
              <select value={form.pacote_id} onChange={(e) => setForm({ ...form, pacote_id: e.target.value })}>
                <option value="">Nenhum — cobrança avulsa</option>
                {pacotes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} ({p.sessoes_utilizadas}/{p.sessoes_totais} usadas)</option>
                ))}
              </select>
              {form.pacote_id && (
                <p className="dica-texto" style={{ marginTop: 6 }}>
                  Esse atendimento vai descontar uma sessão do pacote e não vai gerar cobrança nova — já foi pago.
                </p>
              )}
            </div>

            <div className="ficha-grid">
              <div className="campo">
                <label>Custo operacional deste atendimento (R$)</label>
                <input type="number" step="0.01" value={form.custo_operacional} onChange={(e) => setForm({ ...form, custo_operacional: e.target.value })} />
              </div>
              <div className="campo">
                <label>Valor cobrado da paciente (R$)</label>
                <input type="number" step="0.01" value={form.valor_cobrado} onChange={(e) => setForm({ ...form, valor_cobrado: e.target.value })} disabled={!!form.pacote_id} placeholder={form.pacote_id ? 'Coberto pelo pacote' : ''} />
              </div>
            </div>

            {(() => {
              const custoProdutosForm = form.aplicacoes
                .flatMap((ap) => ap.produtos)
                .map((p) => custoProdutoForm(p, produtos))
                .filter((c) => c !== null)
                .reduce((soma, c) => soma + c, 0);
              const custoOperacional = Number(form.custo_operacional) || 0;
              const valorCobrado = Number(form.valor_cobrado) || 0;
              const custoTotal = custoProdutosForm + custoOperacional;
              return (
                <p className="dica-texto">
                  Custo dos produtos: {formatarMoeda(custoProdutosForm)} · Custo operacional: {formatarMoeda(custoOperacional)}
                  {' · '}<strong>Custo total: {formatarMoeda(custoTotal)}</strong>
                  {valorCobrado > 0 && <> · <strong>Lucro estimado: {formatarMoeda(valorCobrado - custoTotal)}</strong></>}
                </p>
              );
            })()}

            <div className="campo">
              <label>Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <div className="campo">
              <div className="campo-cabecalho">
                <label>Laudo</label>
                <button type="button" className="botao-secundario" onClick={gerarLaudo} disabled={gerandoLaudo}>
                  {gerandoLaudo ? 'Gerando...' : '✨ Gerar automaticamente'}
                </button>
              </div>
              <textarea rows={6} value={form.laudo} onChange={(e) => setForm({ ...form, laudo: e.target.value })} placeholder="Preencha os dados acima e clique em 'Gerar automaticamente', ou escreva manualmente." />
            </div>

            <div className="campo">
              <div className="campo-cabecalho">
                <label>Receituário</label>
                <button type="button" className="botao-secundario" onClick={gerarReceituario} disabled={gerandoReceituario}>
                  {gerandoReceituario ? 'Gerando...' : '✨ Gerar automaticamente'}
                </button>
              </div>
              <textarea rows={6} value={form.receituario} onChange={(e) => setForm({ ...form, receituario: e.target.value })} placeholder="Preencha os dados acima e clique em 'Gerar automaticamente', ou escreva manualmente." />
            </div>

            <div className="ficha-form-acoes">
              <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar registro'}
              </button>
              <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="lista-registros">
          {registros.length === 0 && <p className="galeria-vazio">Nenhum registro ainda.</p>}
          {registros.map((r) => (
            <div className="registro-card" key={r.id}>
              <div className="registro-topo">
                <strong>{r.tipo_queda || 'Sem tipo definido'}</strong>
                <div className="registro-topo-direita">
                  <span>{r.data_sessao ? new Date(r.data_sessao).toLocaleDateString('pt-BR') : new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                  <div className="registro-acoes">
                    <button onClick={() => iniciarEdicao(r)}>Editar</button>
                    <button onClick={() => excluir(r.id)}>Excluir</button>
                  </div>
                </div>
              </div>
              <p>{r.classificacao && `Classificação: ${r.classificacao}`}</p>
              <p>{r.protocolo && `Protocolo: ${r.protocolo}`}</p>
              {(r.ficha_capilar_exames || []).length > 0 && (
                <p className="registro-exames">
                  {r.ficha_capilar_exames.map((e) => `${e.exames_itens?.nome}: ${e.valor || '—'}`).join(' · ')}
                </p>
              )}
              {(r.capilar_aplicacoes || []).map((ap) => (
                <div key={ap.id} style={{ marginTop: 6 }}>
                  <p><strong>{ap.procedimento || 'Procedimento'}</strong></p>
                  {(ap.capilar_aplicacao_produtos || []).map((prod) => {
                    const custo = custoProduto(prod);
                    return (
                      <p key={prod.id} style={{ marginLeft: 14 }}>
                        {prod.produtos?.nome}
                        {prod.quantidade && ` · ${prod.quantidade}${prod.unidade || 'ml'}`}
                        {prod.lote && ` · Lote ${prod.lote}`}
                        {prod.validade && ` · Val. ${new Date(prod.validade).toLocaleDateString('pt-BR')}`}
                        {custo !== null && ` · ${formatarMoeda(custo)}`}
                      </p>
                    );
                  })}
                </div>
              ))}
              {(() => {
                const custoProdutos = custoProdutosRegistro(r) || 0;
                const custoOperacional = Number(r.custo_operacional) || 0;
                const valorCobrado = Number(r.valor_cobrado) || 0;
                const custoTotal = custoProdutos + custoOperacional;
                if (custoTotal === 0 && valorCobrado === 0) return null;
                return (
                  <p className="registro-custo-total">
                    Custo dos produtos: {formatarMoeda(custoProdutos)} · Custo operacional: {formatarMoeda(custoOperacional)}
                    {' · '}<strong>Total: {formatarMoeda(custoTotal)}</strong>
                    {valorCobrado > 0 && <> · Cobrado: {formatarMoeda(valorCobrado)} · <strong>Lucro: {formatarMoeda(valorCobrado - custoTotal)}</strong></>}
                  </p>
                );
              })()}
              {r.observacoes && <p>{r.observacoes}</p>}
              {r.laudo && <p><strong>Laudo:</strong> {r.laudo}</p>}
              {r.receituario && <p><strong>Receituário:</strong> {r.receituario}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="ficha-secao">
        <h3>Fotos</h3>
        <GaleriaFotos pacienteId={pacienteId} servicoSlug="capilar" />
      </div>

      <ModalExames
        aberto={modalExamesAberto}
        selecionados={form.exames}
        onFechar={() => setModalExamesAberto(false)}
        onAplicar={(novaSelecao) => setForm((f) => ({ ...f, exames: novaSelecao }))}
      />
    </div>
  );
}
