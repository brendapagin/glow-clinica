import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';

const APLICACAO_VAZIA = {
  area_tratada: '', produto_id: '', quantidade_ml: '', unidade: 'ml', lote: '', validade: '', especificacao: '',
};
const FORM_VAZIO = {
  data_aplicacao: '', data_retorno: '', observacoes: '',
  composicao_id: '', custo_operacional: '', valor_cobrado: '',
  aplicacoes: [{ ...APLICACAO_VAZIA }],
};

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return null;
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function custoAplicacao(aplicacao) {
  const produto = aplicacao.produtos;
  if (!produto || !produto.custo_unitario || !aplicacao.quantidade_ml) return null;
  if (produto.unidade && aplicacao.unidade && produto.unidade !== aplicacao.unidade) return null;
  return produto.custo_unitario * aplicacao.quantidade_ml;
}

function custoAplicacaoForm(ap, listaProdutos) {
  const produto = listaProdutos.find((p) => p.id === ap.produto_id);
  if (!produto || !produto.custo_unitario || !ap.quantidade_ml) return null;
  if (produto.unidade && ap.unidade && produto.unidade !== ap.unidade) return null;
  return produto.custo_unitario * ap.quantidade_ml;
}

function custoProdutosProcedimento(procedimento) {
  const aplicacoes = procedimento.harmonizacao_aplicacoes || [];
  const custos = aplicacoes.map(custoAplicacao).filter((c) => c !== null);
  if (custos.length === 0) return null;
  return custos.reduce((soma, c) => soma + c, 0);
}

function calcularTotalComposicao(linhas, valorBase) {
  return (linhas || []).reduce((soma, l) => {
    const valor = Number(l.valor) || 0;
    return soma + (l.tipo === 'percentual' ? (valor / 100) * valorBase : valor);
  }, 0);
}

export function FichaHarmonizacao({ pacienteId }) {
  const [procedimentos, setProcedimentos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [composicoes, setComposicoes] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data: procs } = await supabase
      .from('harmonizacao_procedimentos')
      .select('*, harmonizacao_aplicacoes(*, produtos(nome, custo_unitario, unidade))')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setProcedimentos(procs || []);

    const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
    setProdutos(prods || []);

    const { data: composicoesData } = await supabase
      .from('composicoes_custo')
      .select('*, composicao_linhas(*)')
      .eq('ativo', true)
      .order('nome');
    setComposicoes(composicoesData || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  function atualizarAplicacao(index, campo, valor) {
    setForm((f) => {
      const aplicacoes = [...f.aplicacoes];
      aplicacoes[index] = { ...aplicacoes[index], [campo]: valor };
      return { ...f, aplicacoes };
    });
  }

  function selecionarProduto(index, produtoId) {
    const produto = produtos.find((p) => p.id === produtoId);
    atualizarAplicacao(index, 'produto_id', produtoId);
    if (produto?.especificacao) atualizarAplicacao(index, 'especificacao', produto.especificacao);
    if (produto?.unidade) atualizarAplicacao(index, 'unidade', produto.unidade);
  }

  function adicionarLinha() {
    setForm((f) => ({ ...f, aplicacoes: [...f.aplicacoes, { ...APLICACAO_VAZIA }] }));
  }

  function removerLinha(index) {
    setForm((f) => ({ ...f, aplicacoes: f.aplicacoes.filter((_, i) => i !== index) }));
  }

  function selecionarComposicao(composicaoId) {
    const composicao = composicoes.find((c) => c.id === composicaoId);
    const total = composicao ? calcularTotalComposicao(composicao.composicao_linhas, composicao.valor_base) : '';
    setForm((f) => ({ ...f, composicao_id: composicaoId, custo_operacional: total !== '' ? total.toFixed(2) : '' }));
  }

  function iniciarNovo() {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(proc) {
    setForm({
      data_aplicacao: proc.data_aplicacao || '',
      data_retorno: proc.data_retorno || '',
      observacoes: proc.observacoes || '',
      composicao_id: proc.composicao_id || '',
      custo_operacional: proc.custo_operacional ?? '',
      valor_cobrado: proc.valor_cobrado ?? '',
      aplicacoes: (proc.harmonizacao_aplicacoes || []).length > 0
        ? proc.harmonizacao_aplicacoes.map((a) => ({
            area_tratada: a.area_tratada || '',
            produto_id: a.produto_id || '',
            quantidade_ml: a.quantidade_ml ?? '',
            unidade: a.unidade || 'ml',
            lote: a.lote || '',
            validade: a.validade || '',
            especificacao: a.especificacao || '',
          }))
        : [{ ...APLICACAO_VAZIA }],
    });
    setEditandoId(proc.id);
    setMostrarForm(true);
  }

  async function excluirProcedimento(id) {
    if (!confirm('Excluir este atendimento e todas as suas aplicações?')) return;
    await supabase.from('harmonizacao_procedimentos').delete().eq('id', id);
    await supabase.from('contas_receber').delete().eq('origem_tipo', 'harmonizacao').eq('origem_id', id);
    carregar();
  }

  async function sincronizarContaReceber(procedimentoId, valor, dataRef) {
    if (!valor || valor <= 0) return;
    const { data: existente } = await supabase
      .from('contas_receber')
      .select('id')
      .eq('origem_tipo', 'harmonizacao')
      .eq('origem_id', procedimentoId)
      .maybeSingle();

    if (existente) {
      await supabase.from('contas_receber').update({ valor, data_prevista: dataRef || null }).eq('id', existente.id);
    } else {
      await supabase.from('contas_receber').insert({
        paciente_id: pacienteId,
        origem_tipo: 'harmonizacao',
        origem_id: procedimentoId,
        descricao: 'Harmonização Facial',
        valor,
        data_prevista: dataRef || null,
        status: 'pendente',
      });
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dadosProcedimento = {
      paciente_id: pacienteId,
      data_aplicacao: form.data_aplicacao || null,
      data_retorno: form.data_retorno || null,
      observacoes: form.observacoes,
      composicao_id: form.composicao_id || null,
      custo_operacional: form.custo_operacional || null,
      valor_cobrado: form.valor_cobrado || null,
    };

    let procedimentoId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('harmonizacao_procedimentos').update(dadosProcedimento).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('harmonizacao_aplicacoes').delete().eq('procedimento_id', editandoId);
    } else {
      const { data, error } = await supabase.from('harmonizacao_procedimentos').insert(dadosProcedimento).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      procedimentoId = data.id;
    }

    const aplicacoesParaSalvar = form.aplicacoes
      .filter((a) => a.area_tratada || a.produto_id)
      .map((a) => ({
        procedimento_id: procedimentoId,
        area_tratada: a.area_tratada,
        produto_id: a.produto_id || null,
        quantidade_ml: a.quantidade_ml || null,
        unidade: a.unidade || 'ml',
        lote: a.lote,
        validade: a.validade || null,
        especificacao: a.especificacao,
      }));

    if (aplicacoesParaSalvar.length > 0) {
      const { error } = await supabase.from('harmonizacao_aplicacoes').insert(aplicacoesParaSalvar);
      if (error) alert('Erro ao salvar aplicações: ' + error.message);
    }

    await sincronizarContaReceber(procedimentoId, Number(form.valor_cobrado) || 0, form.data_aplicacao);

    setSalvando(false);
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_VAZIO);
    carregar();
  }

  return (
    <div className="ficha-servico">
      <div className="ficha-secao">
        <div className="ficha-secao-topo">
          <h3>Histórico de atendimentos — Harmonização Facial</h3>
          {!mostrarForm && (
            <button className="botao-secundario" onClick={iniciarNovo}>+ Novo atendimento</button>
          )}
        </div>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar}>
            <div className="ficha-grid">
              <div className="campo">
                <label>Data da aplicação</label>
                <input type="date" value={form.data_aplicacao} onChange={(e) => setForm({ ...form, data_aplicacao: e.target.value })} />
              </div>
              <div className="campo">
                <label>Retorno previsto</label>
                <input type="date" value={form.data_retorno} onChange={(e) => setForm({ ...form, data_retorno: e.target.value })} />
              </div>
            </div>

            <h4 className="aplicacoes-titulo">Aplicações deste atendimento</h4>

            {form.aplicacoes.map((ap, index) => (
              <div className="aplicacao-linha" key={index}>
                <div className="campo">
                  <label>Área tratada</label>
                  <input value={ap.area_tratada} onChange={(e) => atualizarAplicacao(index, 'area_tratada', e.target.value)} placeholder="Lábio, malar, mandíbula..." />
                </div>
                <div className="campo">
                  <label>Produto</label>
                  <select value={ap.produto_id} onChange={(e) => selecionarProduto(index, e.target.value)}>
                    <option value="">Selecione...</option>
                    {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label>Quantidade</label>
                  <div className="campo-composto">
                    <input type="number" step="0.1" value={ap.quantidade_ml} onChange={(e) => atualizarAplicacao(index, 'quantidade_ml', e.target.value)} />
                    <select value={ap.unidade} onChange={(e) => atualizarAplicacao(index, 'unidade', e.target.value)}>
                      <option value="ml">ml</option>
                      <option value="mg">mg</option>
                      <option value="ui">UI</option>
                      <option value="unidade">un.</option>
                    </select>
                  </div>
                </div>
                <div className="campo">
                  <label>Lote</label>
                  <input value={ap.lote} onChange={(e) => atualizarAplicacao(index, 'lote', e.target.value)} />
                </div>
                <div className="campo">
                  <label>Validade</label>
                  <input type="date" value={ap.validade} onChange={(e) => atualizarAplicacao(index, 'validade', e.target.value)} />
                </div>
                <div className="campo">
                  <label>Especificação</label>
                  <input value={ap.especificacao} onChange={(e) => atualizarAplicacao(index, 'especificacao', e.target.value)} placeholder="Marca, concentração..." />
                </div>
                {form.aplicacoes.length > 1 && (
                  <button type="button" className="remover-aplicacao" onClick={() => removerLinha(index)}>Remover esta aplicação</button>
                )}
                {custoAplicacaoForm(ap, produtos) !== null && (
                  <p className="custo-linha-form">Custo estimado desta aplicação: {formatarMoeda(custoAplicacaoForm(ap, produtos))}</p>
                )}
              </div>
            ))}

            <button type="button" className="botao-secundario" onClick={adicionarLinha} style={{ marginBottom: 20 }}>
              + Adicionar outra aplicação
            </button>

            <div className="campo">
              <label>Composição de custo aplicada (opcional)</label>
              <select value={form.composicao_id} onChange={(e) => selecionarComposicao(e.target.value)}>
                <option value="">Nenhuma — preencher manualmente</option>
                {composicoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <p className="dica-texto" style={{ marginTop: 6 }}>Escolher uma composição preenche o custo operacional abaixo automaticamente (você pode ajustar).</p>
            </div>

            <div className="ficha-grid">
              <div className="campo">
                <label>Custo operacional deste atendimento (R$)</label>
                <input type="number" step="0.01" value={form.custo_operacional} onChange={(e) => setForm({ ...form, custo_operacional: e.target.value })} />
              </div>
              <div className="campo">
                <label>Valor cobrado da paciente (R$)</label>
                <input type="number" step="0.01" value={form.valor_cobrado} onChange={(e) => setForm({ ...form, valor_cobrado: e.target.value })} />
              </div>
            </div>

            {(() => {
              const custoProdutosForm = form.aplicacoes
                .map((ap) => custoAplicacaoForm(ap, produtos))
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
              <label>Observações gerais</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <div className="ficha-form-acoes">
              <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar atendimento'}
              </button>
              <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="lista-registros">
          {procedimentos.length === 0 && <p className="galeria-vazio">Nenhum atendimento ainda.</p>}
          {procedimentos.map((proc) => (
            <div className="registro-card" key={proc.id}>
              <div className="registro-topo">
                <strong>{proc.data_aplicacao ? new Date(proc.data_aplicacao).toLocaleDateString('pt-BR') : new Date(proc.criado_em).toLocaleDateString('pt-BR')}</strong>
                <div className="registro-topo-direita">
                  <div className="registro-acoes">
                    <button onClick={() => iniciarEdicao(proc)}>Editar</button>
                    <button onClick={() => excluirProcedimento(proc.id)}>Excluir</button>
                  </div>
                </div>
              </div>
              {(proc.harmonizacao_aplicacoes || []).map((a) => {
                const custo = custoAplicacao(a);
                return (
                  <p key={a.id}>
                    {a.area_tratada}
                    {a.produtos?.nome && ` · ${a.produtos.nome}`}
                    {a.quantidade_ml && ` · ${a.quantidade_ml}${a.unidade || 'ml'}`}
                    {a.lote && ` · Lote ${a.lote}`}
                    {a.validade && ` · Val. ${new Date(a.validade).toLocaleDateString('pt-BR')}`}
                    {custo !== null && ` · ${formatarMoeda(custo)}`}
                  </p>
                );
              })}
              {(() => {
                const custoProdutos = custoProdutosProcedimento(proc) || 0;
                const custoOperacional = Number(proc.custo_operacional) || 0;
                const valorCobrado = Number(proc.valor_cobrado) || 0;
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
              {proc.data_retorno && <p>Retorno previsto: {new Date(proc.data_retorno).toLocaleDateString('pt-BR')}</p>}
              {proc.observacoes && <p>{proc.observacoes}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="ficha-secao">
        <h3>Fotos</h3>
        <GaleriaFotos pacienteId={pacienteId} servicoSlug="harmonizacao" />
      </div>
    </div>
  );
}
