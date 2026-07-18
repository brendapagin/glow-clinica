import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';
import { ModalExames } from '../ModalExames';
import { gerarTextoClinico } from '../../lib/geracaoTexto';

const VAZIO = {
  tipo_queda: '', classificacao: '', protocolo: '', data_sessao: '', observacoes: '',
  laudo: '', receituario: '', exames: [],
};

export function FichaCapilar({ pacienteId, pacienteNome }) {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [modalExamesAberto, setModalExamesAberto] = useState(false);
  const [gerandoLaudo, setGerandoLaudo] = useState(false);
  const [gerandoReceituario, setGerandoReceituario] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('fichas_capilar')
      .select('*, ficha_capilar_exames(*, exames_itens(nome))')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setRegistros(data || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  function iniciarNovo() {
    setForm(VAZIO);
    setEditandoId(null);
    setMostrarForm(true);
  }

  function iniciarEdicao(r) {
    setForm({
      tipo_queda: r.tipo_queda || '',
      classificacao: r.classificacao || '',
      protocolo: r.protocolo || '',
      data_sessao: r.data_sessao || '',
      observacoes: r.observacoes || '',
      laudo: r.laudo || '',
      receituario: r.receituario || '',
      exames: (r.ficha_capilar_exames || []).map((e) => ({
        exame_id: e.exame_id, nome: e.exames_itens?.nome || '', valor: e.valor || '',
      })),
    });
    setEditandoId(r.id);
    setMostrarForm(true);
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return;
    await supabase.from('fichas_capilar').delete().eq('id', id);
    carregar();
  }

  function atualizarValorExame(exameId, valor) {
    setForm((f) => ({
      ...f,
      exames: f.exames.map((e) => (e.exame_id === exameId ? { ...e, valor } : e)),
    }));
  }

  async function gerarLaudo() {
    setGerandoLaudo(true);
    try {
      const dadosExames = {};
      form.exames.forEach((e) => { dadosExames[e.nome] = e.valor; });
      const texto = await gerarTextoClinico({
        tipo: 'laudo',
        servico: 'capilar',
        pacienteNome,
        dados: {
          'Tipo de queda': form.tipo_queda,
          'Classificação': form.classificacao,
          'Protocolo': form.protocolo,
          'Observações': form.observacoes,
          ...dadosExames,
        },
      });
      setForm((f) => ({ ...f, laudo: texto }));
    } catch (err) {
      alert('Erro ao gerar laudo: ' + err.message);
    }
    setGerandoLaudo(false);
  }

  async function gerarReceituario() {
    setGerandoReceituario(true);
    try {
      const texto = await gerarTextoClinico({
        tipo: 'receituario',
        servico: 'capilar',
        pacienteNome,
        dados: {
          'Tipo de queda': form.tipo_queda,
          'Protocolo': form.protocolo,
          'Observações': form.observacoes,
        },
      });
      setForm((f) => ({ ...f, receituario: texto }));
    } catch (err) {
      alert('Erro ao gerar receituário: ' + err.message);
    }
    setGerandoReceituario(false);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = {
      tipo_queda: form.tipo_queda,
      classificacao: form.classificacao,
      protocolo: form.protocolo,
      data_sessao: form.data_sessao || null,
      observacoes: form.observacoes,
      laudo: form.laudo,
      receituario: form.receituario,
    };

    let fichaId = editandoId;

    if (editandoId) {
      const { error } = await supabase.from('fichas_capilar').update(dados).eq('id', editandoId);
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      await supabase.from('ficha_capilar_exames').delete().eq('ficha_capilar_id', editandoId);
    } else {
      const { data, error } = await supabase.from('fichas_capilar').insert({ paciente_id: pacienteId, ...dados }).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); setSalvando(false); return; }
      fichaId = data.id;
    }

    if (form.exames.length > 0) {
      const linhas = form.exames.map((ex) => ({ ficha_capilar_id: fichaId, exame_id: ex.exame_id, valor: ex.valor }));
      const { error } = await supabase.from('ficha_capilar_exames').insert(linhas);
      if (error) alert('Erro ao salvar exames: ' + error.message);
    }

    setSalvando(false);
    setForm(VAZIO);
    setMostrarForm(false);
    setEditandoId(null);
    carregar();
  }

  return (
    <div className="ficha-servico">
      <div className="ficha-secao">
        <div className="ficha-secao-topo">
          <h3>Histórico de registros — Capilar</h3>
          {!mostrarForm && (
            <button className="botao-secundario" onClick={iniciarNovo}>+ Novo registro</button>
          )}
        </div>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar}>
            <div className="ficha-grid">
              <div className="campo">
                <label>Tipo de queda</label>
                <input value={form.tipo_queda} onChange={(e) => setForm({ ...form, tipo_queda: e.target.value })} placeholder="Eflúvio telogênico, androgenética..." />
              </div>
              <div className="campo">
                <label>Classificação</label>
                <input value={form.classificacao} onChange={(e) => setForm({ ...form, classificacao: e.target.value })} placeholder="Ludwig, Norwood..." />
              </div>
              <div className="campo">
                <label>Protocolo</label>
                <input value={form.protocolo} onChange={(e) => setForm({ ...form, protocolo: e.target.value })} placeholder="Laser, fotobiomodulação, PRP..." />
              </div>
              <div className="campo">
                <label>Data da sessão</label>
                <input type="date" value={form.data_sessao} onChange={(e) => setForm({ ...form, data_sessao: e.target.value })} />
              </div>
            </div>

            <button type="button" className="botao-exames" onClick={() => setModalExamesAberto(true)}>
              🧪 Exames {form.exames.length > 0 ? `(${form.exames.length} selecionado${form.exames.length > 1 ? 's' : ''})` : '— nenhum selecionado'}
            </button>

            {form.exames.length > 0 && (
              <div className="exames-selecionados-grid">
                {form.exames.map((ex) => (
                  <div className="campo" key={ex.exame_id}>
                    <label>{ex.nome}</label>
                    <input value={ex.valor} onChange={(e) => atualizarValorExame(ex.exame_id, e.target.value)} placeholder="Resultado" />
                  </div>
                ))}
              </div>
            )}

            <div className="campo">
              <label>Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <div className="campo">
              <div className="campo-cabecalho">
                <label>Laudo</label>
                <button type="button" className="botao-secundario" onClick={gerarLaudo} disabled={gerandoLaudo}>
                  {gerandoLaudo ? 'Gerando...' : '✨ Gerar automaticamente'}
                </button>
              </div>
              <textarea rows={6} value={form.laudo} onChange={(e) => setForm({ ...form, laudo: e.target.value })} placeholder="Preencha os dados acima e clique em 'Gerar automaticamente', ou escreva manualmente." />
            </div>

            <div className="campo">
              <div className="campo-cabecalho">
                <label>Receituário</label>
                <button type="button" className="botao-secundario" onClick={gerarReceituario} disabled={gerandoReceituario}>
                  {gerandoReceituario ? 'Gerando...' : '✨ Gerar automaticamente'}
                </button>
              </div>
              <textarea rows={6} value={form.receituario} onChange={(e) => setForm({ ...form, receituario: e.target.value })} placeholder="Preencha os dados acima e clique em 'Gerar automaticamente', ou escreva manualmente." />
            </div>

            <div className="ficha-form-acoes">
              <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar registro'}
              </button>
              <button type="button" className="link-secundario" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="lista-registros">
          {registros.length === 0 && <p className="galeria-vazio">Nenhum registro ainda.</p>}
          {registros.map((r) => (
            <div className="registro-card" key={r.id}>
              <div className="registro-topo">
                <strong>{r.tipo_queda || 'Sem tipo definido'}</strong>
                <div className="registro-topo-direita">
                  <span>{r.data_sessao ? new Date(r.data_sessao).toLocaleDateString('pt-BR') : new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                  <div className="registro-acoes">
                    <button onClick={() => iniciarEdicao(r)}>Editar</button>
                    <button onClick={() => excluir(r.id)}>Excluir</button>
                  </div>
                </div>
              </div>
              <p>{r.classificacao && `Classificação: ${r.classificacao}`}</p>
              <p>{r.protocolo && `Protocolo: ${r.protocolo}`}</p>
              {(r.ficha_capilar_exames || []).length > 0 && (
                <p className="registro-exames">
                  {r.ficha_capilar_exames.map((e) => `${e.exames_itens?.nome}: ${e.valor || '—'}`).join(' · ')}
                </p>
              )}
              {r.observacoes && <p>{r.observacoes}</p>}
              {r.laudo && <p><strong>Laudo:</strong> {r.laudo}</p>}
              {r.receituario && <p><strong>Receituário:</strong> {r.receituario}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="ficha-secao">
        <h3>Fotos</h3>
        <GaleriaFotos pacienteId={pacienteId} servicoSlug="capilar" />
      </div>

      <ModalExames
        aberto={modalExamesAberto}
        selecionados={form.exames}
        onFechar={() => setModalExamesAberto(false)}
        onAplicar={(novaSelecao) => setForm((f) => ({ ...f, exames: novaSelecao }))}
      />
    </div>
  );
}
