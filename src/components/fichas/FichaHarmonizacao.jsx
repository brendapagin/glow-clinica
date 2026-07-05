import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';

const APLICACAO_VAZIA = {
  area_tratada: '', produto_id: '', quantidade_ml: '', unidade: 'ml', lote: '', validade: '', especificacao: '',
};
const FORM_VAZIO = {
  data_aplicacao: '', data_retorno: '', observacoes: '', aplicacoes: [{ ...APLICACAO_VAZIA }],
};

export function FichaHarmonizacao({ pacienteId }) {
  const [procedimentos, setProcedimentos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data: procs } = await supabase
      .from('harmonizacao_procedimentos')
      .select('*, harmonizacao_aplicacoes(*, produtos(nome))')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setProcedimentos(procs || []);

    const { data: prods } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
    setProdutos(prods || []);
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
    carregar();
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dadosProcedimento = {
      paciente_id: pacienteId,
      data_aplicacao: form.data_aplicacao || null,
      data_retorno: form.data_retorno || null,
      observacoes: form.observacoes,
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
      if (error) { alert('Erro ao salvar aplicações: ' + error.message); }
    }

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
              </div>
            ))}

            <button type="button" className="botao-secundario" onClick={adicionarLinha} style={{ marginBottom: 20 }}>
              + Adicionar outra aplicação
            </button>

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
              {(proc.harmonizacao_aplicacoes || []).map((a) => (
                <p key={a.id}>
                  {a.area_tratada}
                  {a.produtos?.nome && ` · ${a.produtos.nome}`}
                  {a.quantidade_ml && ` · ${a.quantidade_ml}${a.unidade || 'ml'}`}
                  {a.lote && ` · Lote ${a.lote}`}
                  {a.validade && ` · Val. ${new Date(a.validade).toLocaleDateString('pt-BR')}`}
                </p>
              ))}
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
