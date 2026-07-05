import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';
import { gerarTextoClinico } from '../../lib/geracaoTexto';

const VAZIO = {
  tipo_queda: '', classificacao: '', ferro: '', ferritina: '',
  vitamina_d: '', tsh: '', protocolo: '', data_sessao: '', observacoes: '',
  laudo: '', receituario: '',
};

export function FichaCapilar({ pacienteId, pacienteNome }) {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gerandoLaudo, setGerandoLaudo] = useState(false);
  const [gerandoReceituario, setGerandoReceituario] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('fichas_capilar')
      .select('*')
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
      ferro: r.ferro ?? '',
      ferritina: r.ferritina ?? '',
      vitamina_d: r.vitamina_d ?? '',
      tsh: r.tsh ?? '',
      protocolo: r.protocolo || '',
      data_sessao: r.data_sessao || '',
      observacoes: r.observacoes || '',
      laudo: r.laudo || '',
      receituario: r.receituario || '',
    });
    setEditandoId(r.id);
    setMostrarForm(true);
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return;
    await supabase.from('fichas_capilar').delete().eq('id', id);
    carregar();
  }

  async function gerarLaudo() {
    setGerandoLaudo(true);
    try {
      const texto = await gerarTextoClinico({
        tipo: 'laudo',
        servico: 'capilar',
        pacienteNome,
        dados: {
          'Tipo de queda': form.tipo_queda,
          'Classificação': form.classificacao,
          'Ferro': form.ferro,
          'Ferritina': form.ferritina,
          'Vitamina D': form.vitamina_d,
          'TSH': form.tsh,
          'Protocolo': form.protocolo,
          'Observações': form.observacoes,
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
      ...form,
      ferro: form.ferro || null,
      ferritina: form.ferritina || null,
      vitamina_d: form.vitamina_d || null,
      tsh: form.tsh || null,
      data_sessao: form.data_sessao || null,
    };

    const { error } = editandoId
      ? await supabase.from('fichas_capilar').update(dados).eq('id', editandoId)
      : await supabase.from('fichas_capilar').insert({ paciente_id: pacienteId, ...dados });

    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
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
                <label>Ferro</label>
                <input type="number" step="0.01" value={form.ferro} onChange={(e) => setForm({ ...form, ferro: e.target.value })} />
              </div>
              <div className="campo">
                <label>Ferritina</label>
                <input type="number" step="0.01" value={form.ferritina} onChange={(e) => setForm({ ...form, ferritina: e.target.value })} />
              </div>
              <div className="campo">
                <label>Vitamina D</label>
                <input type="number" step="0.01" value={form.vitamina_d} onChange={(e) => setForm({ ...form, vitamina_d: e.target.value })} />
              </div>
              <div className="campo">
                <label>TSH</label>
                <input type="number" step="0.01" value={form.tsh} onChange={(e) => setForm({ ...form, tsh: e.target.value })} />
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
              {(r.ferro || r.ferritina || r.vitamina_d || r.tsh) && (
                <p className="registro-exames">
                  {r.ferro && `Ferro: ${r.ferro} `}
                  {r.ferritina && `· Ferritina: ${r.ferritina} `}
                  {r.vitamina_d && `· Vit. D: ${r.vitamina_d} `}
                  {r.tsh && `· TSH: ${r.tsh}`}
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
    </div>
  );
}
