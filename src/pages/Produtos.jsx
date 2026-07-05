import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { nome: '', especificacao: '', unidade: 'ml', quantidade_total: '', preco_total: '' };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('produtos').select('*').order('nome');
    setProdutos(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  function iniciarNovo() {
    setForm(VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(p) {
    setForm({
      nome: p.nome,
      especificacao: p.especificacao || '',
      unidade: p.unidade || 'ml',
      quantidade_total: p.quantidade_total ?? '',
      preco_total: p.preco_total ?? '',
    });
    setEditandoId(p.id);
    setMostrarForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = {
      nome: form.nome,
      especificacao: form.especificacao,
      unidade: form.unidade,
      quantidade_total: form.quantidade_total || null,
      preco_total: form.preco_total || null,
    };
    const { error } = editandoId
      ? await supabase.from('produtos').update(dados).eq('id', editandoId)
      : await supabase.from('produtos').insert(dados);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setForm(VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
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
        {!mostrarForm && (
          <button className="botao" style={{ width: 'auto', padding: '12px 24px' }} onClick={iniciarNovo}>
            + Novo produto
          </button>
        )}
      </div>

      {mostrarForm && (
        <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 32 }}>
          <div className="ficha-grid">
            <div className="campo">
              <label>Nome do produto</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label>Unidade da embalagem</label>
              <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                <option value="ml">ml</option>
                <option value="mg">mg</option>
                <option value="ui">UI</option>
                <option value="unidade">unidade</option>
              </select>
            </div>
            <div className="campo">
              <label>Quantidade na embalagem</label>
              <input type="number" step="0.01" value={form.quantidade_total} onChange={(e) => setForm({ ...form, quantidade_total: e.target.value })} placeholder="Ex: 2" />
            </div>
            <div className="campo">
              <label>Preço pago (R$)</label>
              <input type="number" step="0.01" value={form.preco_total} onChange={(e) => setForm({ ...form, preco_total: e.target.value })} placeholder="Ex: 4.50" />
            </div>
          </div>
          <div className="campo">
            <label>Especificação</label>
            <input value={form.especificacao} onChange={(e) => setForm({ ...form, especificacao: e.target.value })} placeholder="Marca, concentração, detalhes técnicos..." />
          </div>
          {form.quantidade_total > 0 && form.preco_total > 0 && (
            <p className="dica-texto">
              Custo por {form.unidade}: {formatarMoeda(form.preco_total / form.quantidade_total)}
            </p>
          )}
          <div className="ficha-form-acoes">
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
            <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead>
            <tr><th>Nome</th><th>Especificação</th><th>Embalagem</th><th>Custo/unid.</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.especificacao || '—'}</td>
                <td>{p.quantidade_total ? `${p.quantidade_total} ${p.unidade}` : '—'}</td>
                <td>{formatarMoeda(p.custo_unitario)}</td>
                <td><span className={`status-pill ${p.ativo ? 'ativo' : 'inativo'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td className="celula-acoes">
                  <button className="botao-secundario" onClick={() => iniciarEdicao(p)}>Editar</button>
                  <button className="botao-secundario" onClick={() => alternarAtivo(p)}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
