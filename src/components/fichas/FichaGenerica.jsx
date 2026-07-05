import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';

const VAZIO = { data_registro: '', observacoes: '' };

export function FichaGenerica({ pacienteId, servicoSlug, servicoNome }) {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('fichas_genericas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('servico_slug', servicoSlug)
      .order('criado_em', { ascending: false });
    setRegistros(data || []);
  }

  useEffect(() => { carregar(); }, [pacienteId, servicoSlug]);

  function iniciarEdicao(r) {
    setForm({ data_registro: r.data_registro || '', observacoes: r.observacoes || '' });
    setEditandoId(r.id);
    setMostrarForm(true);
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return;
    await supabase.from('fichas_genericas').delete().eq('id', id);
    carregar();
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = {
      paciente_id: pacienteId,
      servico_slug: servicoSlug,
      data_registro: form.data_registro || null,
      observacoes: form.observacoes,
    };
    const { error } = editandoId
      ? await supabase.from('fichas_genericas').update(dados).eq('id', editandoId)
      : await supabase.from('fichas_genericas').insert(dados);
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
          <h3>Histórico de registros — {servicoNome}</h3>
          {!mostrarForm && (
            <button className="botao-secundario" onClick={() => { setForm(VAZIO); setEditandoId(null); setMostrarForm(true); }}>
              + Novo registro
            </button>
          )}
        </div>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar}>
            <div className="campo">
              <label>Data</label>
              <input type="date" value={form.data_registro} onChange={(e) => setForm({ ...form, data_registro: e.target.value })} />
            </div>
            <div className="campo">
              <label>Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <div className="ficha-form-acoes">
              <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar registro'}
              </button>
              <button type="button" className="link-secundario" onClick={() => setMostrarForm(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="lista-registros">
          {registros.length === 0 && <p className="galeria-vazio">Nenhum registro ainda.</p>}
          {registros.map((r) => (
            <div className="registro-card" key={r.id}>
              <div className="registro-topo">
                <strong>{r.data_registro ? new Date(r.data_registro).toLocaleDateString('pt-BR') : new Date(r.criado_em).toLocaleDateString('pt-BR')}</strong>
                <div className="registro-acoes">
                  <button onClick={() => iniciarEdicao(r)}>Editar</button>
                  <button onClick={() => excluir(r.id)}>Excluir</button>
                </div>
              </div>
              {r.observacoes && <p>{r.observacoes}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="ficha-secao">
        <h3>Fotos</h3>
        <GaleriaFotos pacienteId={pacienteId} servicoSlug={servicoSlug} />
      </div>
    </div>
  );
}
