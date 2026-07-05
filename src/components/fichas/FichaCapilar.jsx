import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';

const VAZIO = {
  tipo_queda: '', classificacao: '', ferro: '', ferritina: '',
  vitamina_d: '', tsh: '', protocolo: '', data_sessao: '', observacoes: '',
};

export function FichaCapilar({ pacienteId }) {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('fichas_capilar')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setRegistros(data || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from('fichas_capilar').insert({
      paciente_id: pacienteId,
      ...form,
      ferro: form.ferro || null,
      ferritina: form.ferritina || null,
      vitamina_d: form.vitamina_d || null,
      tsh: form.tsh || null,
      data_sessao: form.data_sessao || null,
    });
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setForm(VAZIO);
    setMostrarForm(false);
    carregar();
  }

  return (
    <div className="ficha-servico">
      <div className="ficha-secao">
        <div className="ficha-secao-topo">
          <h3>Histórico de registros — Capilar</h3>
          <button className="botao-secundario" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Cancelar' : '+ Novo registro'}
          </button>
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
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 200 }}>
              {salvando ? 'Salvando...' : 'Salvar registro'}
            </button>
          </form>
        )}

        <div className="lista-registros">
          {registros.length === 0 && <p className="galeria-vazio">Nenhum registro ainda.</p>}
          {registros.map((r) => (
            <div className="registro-card" key={r.id}>
              <div className="registro-topo">
                <strong>{r.tipo_queda || 'Sem tipo definido'}</strong>
                <span>{r.data_sessao ? new Date(r.data_sessao).toLocaleDateString('pt-BR') : new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
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
