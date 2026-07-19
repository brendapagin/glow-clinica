import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const ATIVO_VAZIO = { ativo: '', concentracao: '' };
const FORM_VAZIO = { nome: '', categoria: '', instrucoes_uso: '', veiculo: '', quantidade: '' };

export default function Formulas() {
  const [formulas, setFormulas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState(FORM_VAZIO);
  const [ativos, setAtivos] = useState([{ ...ATIVO_VAZIO }]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [abaCategorias, setAbaCategorias] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [editandoCategoriaId, setEditandoCategoriaId] = useState(null);
  const [nomeCategoriaEditado, setNomeCategoriaEditado] = useState('');

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('formulas_catalogo')
      .select('*, formulas_catalogo_ativos(*)')
      .order('nome');
    setFormulas(data || []);

    const { data: cats } = await supabase.from('formulas_categorias').select('*').order('nome');
    setCategorias(cats || []);

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
    setForm({
      nome: f.nome, categoria: f.categoria || '', instrucoes_uso: f.instrucoes_uso || '',
      veiculo: f.veiculo || '', quantidade: f.quantidade || '',
    });
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

    const dados = { nome: form.nome, categoria: form.categoria, instrucoes_uso: form.instrucoes_uso, veiculo: form.veiculo, quantidade: form.quantidade };
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

  async function adicionarCategoria(e) {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    const { error } = await supabase.from('formulas_categorias').insert({ nome: novaCategoria.trim() });
    if (error) { alert('Erro ao adicionar: ' + error.message); return; }
    setNovaCategoria('');
    carregar();
  }

  function iniciarEdicaoCategoria(c) {
    setEditandoCategoriaId(c.id);
    setNomeCategoriaEditado(c.nome);
  }

  async function salvarCategoriaEditada(id) {
    if (!nomeCategoriaEditado.trim()) return;
    const { error } = await supabase.from('formulas_categorias').update({ nome: nomeCategoriaEditado.trim() }).eq('id', id);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setEditandoCategoriaId(null);
    carregar();
  }

  async function excluirCategoria(id) {
    if (!confirm('Excluir esta categoria? Fórmulas que já usam ela mantêm o texto salvo, só some da lista de opções.')) return;
    await supabase.from('formulas_categorias').delete().eq('id', id);
    carregar();
  }

  return (
    <Layout titulo="Fórmulas">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>
          Cadastre aqui suas fórmulas padrão. Na hora de prescrever, você escolhe uma daqui e ainda pode
          ajustar concentrações ou ativos só naquela receita, sem alterar o padrão.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="botao-secundario" onClick={() => setAbaCategorias((v) => !v)}>
            {abaCategorias ? 'Voltar' : 'Gerenciar categorias'}
          </button>
          {!mostrarForm && !abaCategorias && <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>+ Nova fórmula</button>}
        </div>
      </div>

      {abaCategorias ? (
        <div className="ficha-form" style={{ maxWidth: 460 }}>
          <h3 style={{ marginTop: 0 }}>Categorias de fórmula</h3>
          <form onSubmit={adicionarCategoria} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} placeholder="Nova categoria" />
            <button type="submit" className="botao-secundario">+ Adicionar</button>
          </form>

          {categorias.map((c) => (
            <div key={c.id} className="registro-card" style={{ marginBottom: 10 }}>
              {editandoCategoriaId === c.id ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input value={nomeCategoriaEditado} onChange={(e) => setNomeCategoriaEditado(e.target.value)} style={{ flex: 1 }} />
                  <button className="botao-secundario" onClick={() => salvarCategoriaEditada(c.id)}>Salvar</button>
                  <button className="link-secundario" style={{ width: 'auto', margin: 0 }} onClick={() => setEditandoCategoriaId(null)}>Cancelar</button>
                </div>
              ) : (
                <div className="registro-topo" style={{ marginBottom: 0 }}>
                  <span>{c.nome}</span>
                  <div className="registro-acoes">
                    <button onClick={() => iniciarEdicaoCategoria(c)}>Editar</button>
                    <button onClick={() => excluirCategoria(c.id)}>Excluir</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {categorias.length === 0 && <p className="dica-texto">Nenhuma categoria cadastrada ainda.</p>}
        </div>
      ) : (
        <>
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
                        {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div className="campo">
                      <label>Veículo/base</label>
                      <input value={form.veiculo} onChange={(e) => setForm({ ...form, veiculo: e.target.value })} placeholder="Ex: Shampoo base" />
                    </div>
                    <div className="campo">
                      <label>Quantidade (Q.S.P.)</label>
                      <input value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} placeholder="Ex: 200 ML" />
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
                  {(f.veiculo || f.quantidade) && <p className="tag">{f.veiculo} {f.quantidade && `Q.S.P. ${f.quantidade}`}</p>}
                  {f.instrucoes_uso && <p className="tag">{f.instrucoes_uso}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
