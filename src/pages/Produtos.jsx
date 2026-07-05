import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const VAZIO = { nome: '', especificacao: '', tipo: 'simples', unidade: 'ml', quantidade_total: '', preco_total: '' };
const ITEM_VAZIO = { nome_item: '', custo: '', quantidade: 1 };

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [itensKit, setItensKit] = useState([{ ...ITEM_VAZIO }]);
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
    setItensKit([{ ...ITEM_VAZIO }]);
    setEditandoId(null);
    setMostrarForm(true);
  }

  async function iniciarEdicao(p) {
    setForm({
      nome: p.nome,
      especificacao: p.especificacao || '',
      tipo: p.tipo || 'simples',
      unidade: p.unidade || 'ml',
      quantidade_total: p.quantidade_total ?? '',
      preco_total: p.preco_total ?? '',
    });

    if (p.tipo === 'kit') {
      const { data } = await supabase.from('produto_kit_itens').select('*').eq('produto_id', p.id).order('criado_em');
      setItensKit(data && data.length > 0 ? data.map((i) => ({ nome_item: i.nome_item, custo: i.custo, quantidade: i.quantidade })) : [{ ...ITEM_VAZIO }]);
    } else {
      setItensKit([{ ...ITEM_VAZIO }]);
    }

    setEditandoId(p.id);
    setMostrarForm(true);
  }

  function atualizarItem(index, campo, valor) {
    setItensKit((lista) => {
      const nova = [...lista];
      nova[index] = { ...nova[index], [campo]: valor };
      return nova;
    });
  }

  function adicionarItem() {
    setItensKit((lista) => [...lista, { ...ITEM_VAZIO }]);
  }

  function removerItem(index) {
    setItensKit((lista) => lista.filter((_, i) => i !== index));
  }

  const totalKit = itensKit.reduce((soma, it) => soma + (Number(it.custo) || 0) * (Number(it.quantidade) || 1), 0);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = form.tipo === 'kit'
      ? { nome: form.nome, especificacao: form.especificacao, tipo: 'kit', unidade: 'kit', quantidade_total: 1, preco_total: totalKit }
      : { nome: form.nome, especificacao: form.especificacao, tipo: 'simples', unidade: form.unidade, quantidade_total: form.quantidade_total || null, preco_total: form.preco_total || null };

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
      const itensParaSalvar = itensKit
        .filter((i) => i.nome_item.trim())
        .map((i) => ({ produto_id: produtoId, nome_item: i.nome_item, custo: i.custo || 0, quantidade: i.quantidade || 1 }));
      if (itensParaSalvar.length > 0) {
        const { error } = await supabase.from('produto_kit_itens').insert(itensParaSalvar);
        if (error) alert('Erro ao salvar itens do kit: ' + error.message);
      }
    }

    setSalvando(false);
    setForm(VAZIO);
    setItensKit([{ ...ITEM_VAZIO }]);
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
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Botox 100U ou Kit Botox" />
            </div>
            <div className="campo">
              <label>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="simples">Produto simples</option>
                <option value="kit">Kit (composto por vários itens)</option>
              </select>
            </div>
          </div>

          {form.tipo === 'simples' ? (
            <>
              <div className="ficha-grid">
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
              {form.quantidade_total > 0 && form.preco_total > 0 && (
                <p className="dica-texto">
                  Custo por {form.unidade}: {formatarMoeda(form.preco_total / form.quantidade_total)}
                </p>
              )}
            </>
          ) : (
            <>
              <h4 className="aplicacoes-titulo">Itens do kit</h4>
              {itensKit.map((item, index) => (
                <div className="aplicacao-linha" key={index}>
                  <div className="campo">
                    <label>Item</label>
                    <input value={item.nome_item} onChange={(e) => atualizarItem(index, 'nome_item', e.target.value)} placeholder="Ex: Luva, seringa, máscara..." />
                  </div>
                  <div className="campo">
                    <label>Custo unitário (R$)</label>
                    <input type="number" step="0.01" value={item.custo} onChange={(e) => atualizarItem(index, 'custo', e.target.value)} />
                  </div>
                  <div className="campo">
                    <label>Quantidade</label>
                    <input type="number" step="1" value={item.quantidade} onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)} />
                  </div>
                  {itensKit.length > 1 && (
                    <button type="button" className="remover-aplicacao" onClick={() => removerItem(index)}>Remover item</button>
                  )}
                </div>
              ))}
              <button type="button" className="botao-secundario" onClick={adicionarItem} style={{ marginBottom: 16 }}>
                + Adicionar item
              </button>
              <p className="dica-texto">Custo total do kit: {formatarMoeda(totalKit)}</p>
            </>
          )}

          <div className="campo">
            <label>Especificação</label>
            <input value={form.especificacao} onChange={(e) => setForm({ ...form, especificacao: e.target.value })} placeholder="Marca, concentração, detalhes técnicos..." />
          </div>

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
            <tr><th>Nome</th><th>Tipo</th><th>Especificação</th><th>Custo</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.tipo === 'kit' ? 'Kit' : 'Simples'}</td>
                <td>{p.especificacao || '—'}</td>
                <td>{formatarMoeda(p.custo_unitario)}{p.tipo === 'simples' && p.quantidade_total ? ` / ${p.unidade}` : ''}</td>
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
