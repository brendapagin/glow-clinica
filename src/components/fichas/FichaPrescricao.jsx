import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const ATIVO_VAZIO = { ativo: '', concentracao: '' };
const FORMULA_VAZIA = { formula_catalogo_id: '', nome: '', categoria: '', instrucoes_uso: '', veiculo: '', quantidade: '', ativos: [{ ...ATIVO_VAZIO }] };
const FORM_VAZIO = { data: new Date().toISOString().slice(0, 10), observacoes: '', formulas: [{ ...FORMULA_VAZIA }] };

const NOME_PROFISSIONAL = 'Brenda Ariane Pagin';
const TITULO_PROFISSIONAL = 'Farmacêutica Esteta e Clínica';
const ESPECIALIDADE_PROFISSIONAL = 'Tricologista';
const REGISTRO_PROFISSIONAL = 'CRF- 87.662/SP';
const CIDADE_CLINICA = 'Itápolis';
const URL_TIMBRADO = '/timbrado-glow.png';

export function FichaPrescricao({ pacienteId, pacienteNome, pacienteGenero }) {
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
            veiculo: f.veiculo || '',
            quantidade: f.quantidade || '',
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
            veiculo: original.veiculo || '',
            quantidade: original.quantidade || '',
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
        veiculo: formula.veiculo,
        quantidade: formula.quantidade,
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

  function saudacao() {
    const nome = (pacienteNome || '').toUpperCase();
    const genero = (pacienteGenero || '').toLowerCase();
    if (genero.startsWith('m')) return `A SR. ${nome}:`;
    if (genero.startsWith('f')) return `A SRA. ${nome}:`;
    return `PACIENTE: ${nome}`;
  }

  function imprimir(prescricao) {
    const formulasOrdenadas = [...(prescricao.prescricao_formulas || [])].sort((a, b) => a.ordem - b.ordem);
    const dataFormatada = new Date(prescricao.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    function blocoFormula(f, numero) {
      const ativosHtml = (f.prescricao_formula_ativos || [])
        .sort((a, b) => a.ordem - b.ordem)
        .map((a) => `<p style="margin: 4px 0;">${a.ativo.toUpperCase()}${a.concentracao ? ` ${a.concentracao}` : ''}</p>`)
        .join('');
      const veiculoHtml = (f.veiculo || f.quantidade)
        ? `<p style="margin: 4px 0;">${(f.veiculo || '').toUpperCase()}${f.quantidade ? ` Q.S.P. ${f.quantidade}` : ''}</p>`
        : '';
      return `
        <p style="font-weight: 700; margin: 18px 0 10px;">FÓRMULA ${numero}</p>
        ${ativosHtml}
        ${veiculoHtml}
        ${f.instrucoes_uso ? `<p style="margin: 18px 0 0;">${f.instrucoes_uso.toUpperCase()}</p>` : ''}
      `;
    }

    const assinaturaHtml = `
      <p style="margin: 60px 0 0; text-align: center;">${CIDADE_CLINICA} , ${dataFormatada}</p>
      <div style="margin-top: 70px; text-align: center;">
        <p style="margin: 0; font-weight: 600;">${NOME_PROFISSIONAL.toUpperCase()}</p>
        <p style="margin: 0;">${TITULO_PROFISSIONAL.toUpperCase()}</p>
        <p style="margin: 0;">${ESPECIALIDADE_PROFISSIONAL.toUpperCase()}</p>
        <p style="margin: 0;">${REGISTRO_PROFISSIONAL}</p>
      </div>
    `;

    const paginas = formulasOrdenadas.map((f, i) => {
      const conteudo = i === 0
        ? `
          <p style="margin: 0 0 24px;">${saudacao()}</p>
          <p style="text-decoration: underline; font-weight: 700; margin: 0 0 20px;">MANIPULAR :</p>
          ${blocoFormula(f, 1)}
        `
        : blocoFormula(f, i + 1);

      const ehUltima = i === formulasOrdenadas.length - 1;

      return `
        <div class="pagina">
          <img src="${window.location.origin}${URL_TIMBRADO}" class="fundo-timbrado" />
          <div class="conteudo-pagina">
            ${conteudo}
            ${ehUltima ? assinaturaHtml : ''}
          </div>
        </div>
      `;
    }).join('');

    const janela = window.open('', '_blank');
    janela.document.write(`
      <html>
        <head>
          <title>Receituário — ${pacienteNome}</title>
          <style>
            @page { size: A4; margin: 0; }
            body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1c1c1c; font-size: 13px; line-height: 1.6; }
            .pagina { position: relative; width: 210mm; height: 297mm; page-break-after: always; }
            .pagina:last-child { page-break-after: auto; }
            .fundo-timbrado { position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; z-index: 0; }
            .conteudo-pagina { position: relative; z-index: 1; padding: 52mm 26mm 40mm; }
          </style>
        </head>
        <body>
          ${paginas}
        </body>
      </html>
    `);
    janela.document.close();
    janela.onload = () => janela.print();
  }

  return (
    <div className="ficha-servico">
      <div className="ficha-secao">
        <div className="ficha-secao-topo">
          <h3>Prescrições</h3>
          {!mostrarForm && <button className="botao-secundario" onClick={iniciarNovo}>+ Nova prescrição</button>}
        </div>

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
                  <div className="campo">
                    <label>Veículo/base</label>
                    <input value={formula.veiculo} onChange={(e) => atualizarFormulaCampo(indexFormula, 'veiculo', e.target.value)} placeholder="Ex: Shampoo base" />
                  </div>
                  <div className="campo">
                    <label>Quantidade (Q.S.P.)</label>
                    <input value={formula.quantidade} onChange={(e) => atualizarFormulaCampo(indexFormula, 'quantidade', e.target.value)} placeholder="Ex: 200 ML" />
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
                <strong>{new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
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
