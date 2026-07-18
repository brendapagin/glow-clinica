import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function ModalExames({ aberto, selecionados, onFechar, onAplicar }) {
  const [itens, setItens] = useState([]);
  const [valores, setValores] = useState({});
  const [novoNome, setNovoNome] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  async function carregar() {
    const { data } = await supabase.from('exames_itens').select('*').eq('ativo', true).order('nome');
    setItens(data || []);
  }

  useEffect(() => {
    if (aberto) {
      carregar();
      const iniciais = {};
      selecionados.forEach((s) => { iniciais[s.exame_id] = s.valor || ''; });
      setValores(iniciais);
    }
  }, [aberto]);

  function atualizarValor(id, valor) {
    setValores((atual) => ({ ...atual, [id]: valor }));
  }

  async function adicionarNovoItem(e) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSalvandoNovo(true);
    const { data, error } = await supabase.from('exames_itens').insert({ nome: novoNome.trim() }).select().single();
    setSalvandoNovo(false);
    if (error) { alert('Erro ao adicionar: ' + error.message); return; }
    setItens((lista) => [...lista, data].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNovoNome('');
  }

  function aplicar() {
    const novaSelecao = itens
      .filter((i) => (valores[i.id] || '').trim() !== '')
      .map((i) => ({ exame_id: i.id, nome: i.nome, valor: valores[i.id] }));
    onAplicar(novaSelecao);
    onFechar();
  }

  if (!aberto) return null;

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>Exames</h3>
          <button className="modal-fechar" onClick={onFechar}>×</button>
        </div>

        <p className="dica-texto" style={{ marginTop: 0 }}>Preencha o valor dos exames solicitados. Deixe em branco os que não se aplicam.</p>

        <div className="modal-lista-exames">
          {itens.map((item) => (
            <div className="modal-linha-exame" key={item.id}>
              <label>{item.nome}</label>
              <input value={valores[item.id] || ''} onChange={(e) => atualizarValor(item.id, e.target.value)} placeholder="Resultado" />
            </div>
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
