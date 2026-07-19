import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const ATIVO_VAZIO = { ativo: '', concentracao: '' };
const FORMULA_VAZIA = { formula_catalogo_id: '', nome: '', categoria: '', instrucoes_uso: '', ativos: [{ ...ATIVO_VAZIO }] };
const FORM_VAZIO = { data: new Date().toISOString().slice(0, 10), observacoes: '', formulas: [{ ...FORMULA_VAZIA }] };

export function FichaPrescricao({ pacienteId, pacienteNome }) {
  const [prescricoes, setPrescricoes] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data: prescs } = await supabase
      .from('prescricoes')
      .select('*, prescricao_formulas(*, prescricao_formula_ativos(*))')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setPrescricoes(prescs || []);

    const { data: cat } = await supabase
      .from('formulas_catalogo')
      .select('*, formulas_catalogo_ativos(*)')
      .eq('ativo', true)
      .order('nome');
    setCatalogo(cat || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  function iniciarNovo() {
    setForm({ ...FORM_VAZIO, data: new Date().toISOString().slice(0, 10), formulas: [{ ...FORMULA_VAZIA, ativos: [{ ...ATIVO_VAZIO }] }] });
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(p) {
    setForm({
      data: p.data,
      observacoes: p.observacoes || '',
      formulas: (p.prescricao_formulas || []).length > 0
        ? [...p.prescricao_formulas].sort((a, b) => a.ordem - b.ordem).map((f) => ({
            formula_catalogo_id: f.formula_catalogo_id || '',
            nome: f.nome,
            categoria: f.categoria || '',
            instrucoes_uso: f.instrucoes_uso || '',
            ativos: (f.prescricao_formula_ativos || []).length > 0
              ? [...f.prescricao_formula_ativos].sort((a, b) => a.ordem - b.ordem).map((a) => ({ ativo: a.ativo, concentracao: a.concentracao || '' }))
              : [{ ...ATIVO_VAZIO }],
          }))
        : [{ ...FORMULA_VAZIA }],
    });
    setEditandoId(p.id);
    setMostrarForm(true);
  }

  async function excluir(id) {
    if (!confirm('Excluir esta prescrição?')) return;
    await supabase.from('prescricoes').delete().eq('id', id);
    carregar();
  }

  function adicionarFormula() {
    setForm((f) => ({ ...f, formulas: [...f.formulas, { ...FORMULA_VAZIA, ativos: [{ ...ATIVO_VAZIO }] }] }));
  }

  function removerFormula(index) {
    setForm((f) => ({ ...f, formulas: f.formulas.filter((_, i) => i !== index) }));
  }

  function escolherDoCatalogo(index, formulaCatalogoId) {
    const original = catalogo.find((c) => c.id === formulaCatalogoId);
    setForm((f) => {
      const formulas = [...f.formulas];
      formulas[index] = original
        ? {
            formula_catalogo_id: original.id,
            nome: original.nome,
            categoria: original.categoria || '',
            instrucoes_uso: original.instrucoes_uso || '',
            ativos: (original.formulas_catalogo_ativos || []).length > 0
              ? [...original.formulas_catalogo_ativos].sort((a, b) => a.ordem - b.ordem).map((a) => ({ ativo: a.ativo, concentracao: a.concentracao || '' }))
              : [{ ...ATIVO_VAZIO }],
          }
        : { ...FORMULA_VAZIA, ativos: [{ ...ATIVO_VAZIO }] };
      return { ...f, formulas };
    });
  }

  function atualizarFormulaCampo(index, campo, valor) {
    setForm((f) => {
      const formulas = [...f.formulas];
      formulas[index] = { ...formulas[index], [campo]: valor };
      return { ...f, formulas };
    });
  }

  function atualizarAtivo(indexFormula, indexAtivo, campo, valor) {
    setForm((f) => {
      const formulas = [...f.formulas];
      const ativosDaFormula = [...formulas[indexFormula].ativos];
      ativosDaFormula[indexAtivo] = { ...ativosDaFormula[indexAtivo], [campo]: valor };
      formulas[indexFormula] = { ...formulas[indexFormula], ativos: ativosDaFormula };
      return { ...f, formulas };
    });
  }

  function adicionarAtivo(indexFormula) {
    setForm((f) => {
      const formulas = [...f.formulas];
      formulas[indexFormula] = { ...formulas[indexFormula], ativos: [...formulas[indexFormula].ativos, { ...ATIVO_VAZIO }] };
      return { ...f, formulas };
    });
  }

  function removerAtivo(indexFormula, indexAtivo) {
    setForm((f) => {
      const formulas = [...f.formulas];
      formulas[indexFormula] = { ...formulas[indexFormula], ativos: formulas[indexFormula].ativos.filter((_, i) => i !== indexAtivo) };
      return { ...f, formulas };
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dadosPrescricao = { paciente_id: pacienteId, data: form.data, observacoes: form.observacoes };
    let prescricaoId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('prescricoes').update(dadosPrescricao).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('prescricao_formulas').delete().eq('prescricao_id', editandoId);
    } else {
      const { data, error } = await supabase.from('prescricoes').insert(dadosPrescricao).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      prescricaoId = data.id;
    }

    for (let i = 0; i < form.formulas.length; i++) {
      const formula = form.formulas[i];
      if (!formula.nome.trim()) continue;

      const { data: formulaRow, error: erroFormula } = await supabase.from('prescricao_formulas').insert({
        prescricao_id: prescricaoId,
        formula_catalogo_id: formula.formula_catalogo_id || null,
        nome: formula.nome,
        categoria: formula.categoria,
        instrucoes_uso: formula.instrucoes_uso,
        ordem: i,
      }).select().single();

      if (erroFormula) { alert('Erro ao salvar fórmula: ' + erroFormula.message); continue; }

      const ativosParaSalvar = formula.ativos
        .filter((a) => a.ativo.trim())
        .map((a, ai) => ({ prescricao_formula_id: formulaRow.id, ativo: a.ativo, concentracao: a.concentracao, ordem: ai }));

      if (ativosParaSalvar.length > 0) {
        await supabase.from('prescricao_formula_ativos').insert(ativosParaSalvar);
      }
    }

    setSalvando(false);
    setForm(FORM_VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  function imprimir(prescricao) {
    const janela = window.open('', '_blank');
    const formulasHtml = (prescricao.prescricao_formulas || [])
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => `
        <div style="margin-bottom: 22px;">
          <p style="font-weight: 600; margin: 0 0 6px;">${f.nome}${f.categoria ? ` — ${f.categoria}` : ''}</p>
          <ul style="margin: 0 0 6px; padding-left: 20px;">
            ${(f.prescricao_formula_ativos || []).sort((a, b) => a.ordem - b.ordem).map((a) => `<li>${a.ativo}${a.concentracao ? ` — ${a.concentracao}` : ''}</li>`).join('')}
          </ul>
          ${f.instrucoes_uso ? `<p style="font-style: italic; margin: 0;">${f.instrucoes_uso}</p>` : ''}
        </div>
      `).join('');

    janela.document.write(`
      <html>
        <head>
          <title>Receituário</title>
          <style>
            body { font-family: Georgia, serif; padding: 60px; color: #2c2c2c; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .paciente { margin-bottom: 30px; color: #555; }
          </style>
        </head>
        <body>
          <h1>Receituário</h1>
          <p class="paciente">Paciente: ${pacienteNome} — ${new Date(prescricao.data).toLocaleDateString('pt-BR')}</p>
          ${formulasHtml}
          ${prescricao.observacoes ? `<p>${prescricao.observacoes}</p>` : ''}
        </body>
      </html>
    `);
    janela.document.close();
    janela.print();
  }

  return (
    <div className="ficha-servico">
      <div className="ficha-secao">
        <div className="ficha-secao-topo">
          <h3>Prescrições</h3>
          {!mostrarForm && <button className="botao-secundario" onClick={iniciarNovo}>+ Nova prescrição</button>}
        </div>

        <p className="dica-texto" style={{ marginTop: -6, marginBottom: 16 }}>
          O layout de impressão ainda é provisório — assim que você me mandar o modelo com o timbrado, eu ajusto pra ficar igual ao que você já usa.
        </p>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar}>
            <div className="campo">
              <label>Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={{ maxWidth: 200 }} />
            </div>

            {form.formulas.map((formula, indexFormula) => (
              <div className="aplicacao-bloco" key={indexFormula}>
                <div className="campo">
                  <label>Fórmula do catálogo (opcional)</label>
                  <select value={formula.formula_catalogo_id} onChange={(e) => escolherDoCatalogo(indexFormula, e.target.value)}>
                    <option value="">Digitar manualmente...</option>
                    {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                <div className="ficha-grid">
                  <div className="campo">
                    <label>Nome</label>
                    <input required value={formula.nome} onChange={(e) => atualizarFormulaCampo(indexFormula, 'nome', e.target.value)} />
                  </div>
                  <div className="campo">
                    <label>Categoria</label>
                    <input value={formula.categoria} onChange={(e) => atualizarFormulaCampo(indexFormula, 'categoria', e.target.value)} placeholder="Tônico, shampoo..." />
                  </div>
                </div>

                <div className="campo">
                  <label>Instruções de uso</label>
                  <input value={formula.instrucoes_uso} onChange={(e) => atualizarFormulaCampo(indexFormula, 'instrucoes_uso', e.target.value)} />
                </div>

                <p className="produtos-subtitulo">Ativos</p>
                {formula.ativos.map((a, indexAtivo) => (
                  <div className="aplicacao-linha" key={indexAtivo}>
                    <div className="campo">
                      <label>Ativo</label>
                      <input value={a.ativo} onChange={(e) => atualizarAtivo(indexFormula, indexAtivo, 'ativo', e.target.value)} />
                    </div>
                    <div className="campo">
                      <label>Concentração</label>
                      <input value={a.concentracao} onChange={(e) => atualizarAtivo(indexFormula, indexAtivo, 'concentracao', e.target.value)} placeholder="Ex: 5%" />
                    </div>
                    {formula.ativos.length > 1 && (
                      <button type="button" className="remover-aplicacao" onClick={() => removerAtivo(indexFormula, indexAtivo)}>Remover ativo</button>
                    )}
                  </div>
                ))}
                <button type="button" className="botao-secundario" onClick={() => adicionarAtivo(indexFormula)} style={{ marginBottom: 4 }}>+ Adicionar ativo</button>

                {form.formulas.length > 1 && (
                  <button type="button" className="remover-aplicacao-inteira" onClick={() => removerFormula(indexFormula)}>Remover esta fórmula</button>
                )}
              </div>
            ))}

            <button type="button" className="botao-secundario" onClick={adicionarFormula} style={{ marginBottom: 20 }}>
              + Adicionar outra fórmula
            </button>

            <div className="campo">
              <label>Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <div className="ficha-form-acoes">
              <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar prescrição'}
              </button>
              <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="lista-registros">
          {prescricoes.length === 0 && <p className="galeria-vazio">Nenhuma prescrição ainda.</p>}
          {prescricoes.map((p) => (
            <div className="registro-card" key={p.id}>
              <div className="registro-topo">
                <strong>{new Date(p.data).toLocaleDateString('pt-BR')}</strong>
                <div className="registro-topo-direita">
                  <div className="registro-acoes">
                    <button onClick={() => imprimir(p)}>Imprimir</button>
                    <button onClick={() => iniciarEdicao(p)}>Editar</button>
                    <button onClick={() => excluir(p.id)}>Excluir</button>
                  </div>
                </div>
              </div>
              {(p.prescricao_formulas || []).map((f) => (
                <p key={f.id}>
                  <strong>{f.nome}</strong>{f.categoria && ` (${f.categoria})`}
                  {(f.prescricao_formula_ativos || []).length > 0 && ` — ${f.prescricao_formula_ativos.map((a) => `${a.ativo}${a.concentracao ? ` ${a.concentracao}` : ''}`).join(', ')}`}
                </p>
              ))}
              {p.observacoes && <p>{p.observacoes}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
