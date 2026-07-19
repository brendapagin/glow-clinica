import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const ATIVO_VAZIO = { ativo: '', concentracao: '' };
const FORM_VAZIO = { nome: '', categoria: '', instrucoes_uso: '' };
const CATEGORIAS = ['Tônico', 'Fórmula oral', 'Shampoo', 'Sérum', 'Máscara', 'Loção', 'Outro'];

export default function Formulas() {
  const [formulas, setFormulas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState(FORM_VAZIO);
  const [ativos, setAtivos] = useState([{ ...ATIVO_VAZIO }]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('formulas_catalogo')
      .select('*, formulas_catalogo_ativos(*)')
      .order('nome');
    setFormulas(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function iniciarNovo() {
    setForm(FORM_VAZIO);
    setAtivos([{ ...ATIVO_VAZIO }]);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(f) {
    setForm({ nome: f.nome, categoria: f.categoria || '', instrucoes_uso: f.instrucoes_uso || '' });
    setAtivos(
      (f.formulas_catalogo_ativos || []).length > 0
        ? [...f.formulas_catalogo_ativos].sort((a, b) => a.ordem - b.ordem).map((a) => ({ ativo: a.ativo, concentracao: a.concentracao || '' }))
        : [{ ...ATIVO_VAZIO }]
    );
    setEditandoId(f.id);
    setMostrarForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = { nome: form.nome, categoria: form.categoria, instrucoes_uso: form.instrucoes_uso };
    let formulaId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('formulas_catalogo').update(dados).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('formulas_catalogo_ativos').delete().eq('formula_id', editandoId);
    } else {
      const { data, error } = await supabase.from('formulas_catalogo').insert(dados).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      formulaId = data.id;
    }

    const ativosParaSalvar = ativos
      .filter((a) => a.ativo.trim())
      .map((a, i) => ({ formula_id: formulaId, ativo: a.ativo, concentracao: a.concentracao, ordem: i }));

    if (ativosParaSalvar.length > 0) {
      const { error } = await supabase.from('formulas_catalogo_ativos').insert(ativosParaSalvar);
      if (error) alert('Erro ao salvar ativos: ' + error.message);
    }

    setSalvando(false);
    setForm(FORM_VAZIO);
    setAtivos([{ ...ATIVO_VAZIO }]);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  async function alternarAtivo(f) {
    await supabase.from('formulas_catalogo').update({ ativo: !f.ativo }).eq('id', f.id);
    carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir esta fórmula do catálogo?')) return;
    await supabase.from('formulas_catalogo').delete().eq('id', id);
    carregar();
  }

  return (
    <Layout titulo="Fórmulas">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>
          Cadastre aqui suas fórmulas padrão. Na hora de prescrever, você escolhe uma daqui e ainda pode
          ajustar concentrações ou ativos só naquela receita, sem alterar o padrão.
        </p>
        {!mostrarForm && <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>+ Nova fórmula</button>}
      </div>

      {mostrarForm && (
        <div className="modal-fundo" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>
          <div className="modal-caixa" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topo">
              <h3>{editandoId ? 'Editar fórmula' : 'Nova fórmula'}</h3>
              <button className="modal-fechar" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>×</button>
            </div>

            <form onSubmit={salvar}>
              <div className="ficha-grid">
                <div className="campo">
                  <label>Nome da fórmula</label>
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Tônico Anticaída" />
                </div>
                <div className="campo">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="campo">
                <label>Instruções de uso (posologia)</label>
                <input value={form.instrucoes_uso} onChange={(e) => setForm({ ...form, instrucoes_uso: e.target.value })} placeholder="Ex: Aplicar à noite, sobre o couro cabeludo seco" />
              </div>

              <h4 className="aplicacoes-titulo">Ativos</h4>

              {ativos.map((a, i) => (
                <div className="aplicacao-linha" key={i}>
                  <div className="campo">
                    <label>Ativo</label>
                    <input value={a.ativo} onChange={(e) => setAtivos((l) => l.map((x, xi) => xi === i ? { ...x, ativo: e.target.value } : x))} placeholder="Ex: Minoxidil" />
                  </div>
                  <div className="campo">
                    <label>Concentração</label>
                    <input value={a.concentracao} onChange={(e) => setAtivos((l) => l.map((x, xi) => xi === i ? { ...x, concentracao: e.target.value } : x))} placeholder="Ex: 5%" />
                  </div>
                  {ativos.length > 1 && (
                    <button type="button" className="remover-aplicacao" onClick={() => setAtivos((l) => l.filter((_, xi) => xi !== i))}>Remover ativo</button>
                  )}
                </div>
              ))}

              <button type="button" className="botao-secundario" onClick={() => setAtivos((l) => [...l, { ...ATIVO_VAZIO }])} style={{ marginBottom: 16 }}>
                + Adicionar ativo
              </button>

              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar fórmula'}
                </button>
                <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {carregando ? <p>Carregando...</p> : (
        <div className="lista-registros">
          {formulas.length === 0 && <p className="galeria-vazio">Nenhuma fórmula cadastrada ainda.</p>}
          {formulas.map((f) => (
            <div className="registro-card" key={f.id}>
              <div className="registro-topo">
                <strong>{f.nome} {f.categoria && `· ${f.categoria}`}</strong>
                <div className="registro-topo-direita">
                  <span className={`status-pill ${f.ativo ? 'ativo' : 'inativo'}`}>{f.ativo ? 'Ativa' : 'Inativa'}</span>
                  <div className="registro-acoes">
                    <button onClick={() => iniciarEdicao(f)}>Editar</button>
                    <button onClick={() => alternarAtivo(f)}>{f.ativo ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => excluir(f.id)}>Excluir</button>
                  </div>
                </div>
              </div>
              {(f.formulas_catalogo_ativos || []).length > 0 && (
                <p>{[...f.formulas_catalogo_ativos].sort((a, b) => a.ordem - b.ordem).map((a) => `${a.ativo}${a.concentracao ? ` ${a.concentracao}` : ''}`).join(' · ')}</p>
              )}
              {f.instrucoes_uso && <p className="tag">{f.instrucoes_uso}</p>}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
