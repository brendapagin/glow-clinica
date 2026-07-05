import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { nome: '', especificacao: '', unidade: 'ml' };

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('produtos').select('*').order('nome');
    setProdutos(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from('produtos').insert(form);
    setSalvando(false);
    if (error) { alert('Erro ao cadastrar: ' + error.message); return; }
    setForm(VAZIO);
    setMostrarForm(false);
    carregar();
  }

  async function alternarAtivo(produto) {
    await supabase.from('produtos').update({ ativo: !produto.ativo }).eq('id', produto.id);
    carregar();
  }

  return (
    <Layout titulo="Produtos">
      <div className="lista-topo">
        <p className="dica-texto" style={{ margin: 0 }}>
          Cadastro interno de produtos usados nos procedimentos — não é um catálogo de venda.
        </p>
        <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Novo produto'}
        </button>
      </div>

      {mostrarForm && (
        <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
          <div className="ficha-grid">
            <div className="campo">
              <label>Nome do produto</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label>Unidade</label>
              <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                <option value="ml">ml</option>
                <option value="mg">mg</option>
                <option value="unidade">unidade</option>
                <option value="ampola">ampola</option>
              </select>
            </div>
          </div>
          <div className="campo">
            <label>Especificação</label>
            <input value={form.especificacao} onChange={(e) => setForm({ ...form, especificacao: e.target.value })} placeholder="Marca, concentração, detalhes técnicos..." />
          </div>
          <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
            {salvando ? 'Salvando...' : 'Cadastrar produto'}
          </button>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead>
            <tr><th>Nome</th><th>Especificação</th><th>Unidade</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.especificacao || '—'}</td>
                <td>{p.unidade}</td>
                <td><span className={`status-pill ${p.ativo ? 'ativo' : 'inativo'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td><button className="botao-secundario" onClick={() => alternarAtivo(p)}>{p.ativo ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
