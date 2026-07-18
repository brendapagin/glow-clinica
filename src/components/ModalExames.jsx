import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function ModalExames({ aberto, selecionados, onFechar, onAplicar }) {
  const [itens, setItens] = useState([]);
  const [marcados, setMarcados] = useState(new Set());
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  async function carregar() {
    const { data } = await supabase.from('exames_itens').select('*').eq('ativo', true).order('nome');
    setItens(data || []);
  }

  useEffect(() => {
    if (aberto) {
      carregar();
      setMarcados(new Set(selecionados.map((s) => s.exame_id)));
    }
  }, [aberto]);

  function alternar(id) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  async function adicionarNovoItem(e) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvandoNovo(true);
    const { data, error } = await supabase.from('exames_itens').insert({ nome: novoNome.trim() }).select().single();
    setSalvandoNovo(false);
    if (error) { alert('Erro ao adicionar: ' + error.message); return; }
    setItens((lista) => [...lista, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setMarcados((atual) => new Set(atual).add(data.id));
    setNovoNome('');
  }

  function aplicar() {
    const novaSelecao = itens
      .filter((i) => marcados.has(i.id))
      .map((i) => {
        const existente = selecionados.find((s) => s.exame_id === i.id);
        return { exame_id: i.id, nome: i.nome, valor: existente?.valor || '' };
      });
    onAplicar(novaSelecao);
    onFechar();
  }

  if (!aberto) return null;

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>Selecionar exames</h3>
          <button className="modal-fechar" onClick={onFechar}>×</button>
        </div>

        <div className="modal-lista-exames">
          {itens.map((item) => (
            <label key={item.id} className="checkbox-tela" style={{ fontSize: 15, padding: '7px 0' }}>
              <input type="checkbox" checked={marcados.has(item.id)} onChange={() => alternar(item.id)} />
              {item.nome}
            </label>
          ))}
          {itens.length === 0 && <p className="dica-texto">Nenhum exame cadastrado ainda.</p>}
        </div>

        <form onSubmit={adicionarNovoItem} className="modal-novo-item">
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Novo exame (ex: Zinco)" />
          <button type="submit" className="botao-secundario" disabled={salvandoNovo}>+ Adicionar</button>
        </form>

        <div className="ficha-form-acoes" style={{ marginTop: 20 }}>
          <button type="button" className="botao" onClick={aplicar} style={{ maxWidth: 200 }}>Aplicar</button>
          <button type="button" className="link-secundario" onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
