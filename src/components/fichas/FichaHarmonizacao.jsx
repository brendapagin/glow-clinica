import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { GaleriaFotos } from '../GaleriaFotos';

const VAZIO = {
  area_tratada: '', produto: '', quantidade_ml: '', lote: '',
  data_aplicacao: '', data_retorno: '', observacoes: '',
};

export function FichaHarmonizacao({ pacienteId }) {
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('fichas_harmonizacao')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setRegistros(data || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from('fichas_harmonizacao').insert({
      paciente_id: pacienteId,
      ...form,
      quantidade_ml: form.quantidade_ml || null,
      data_aplicacao: form.data_aplicacao || null,
      data_retorno: form.data_retorno || null,
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
          <h3>Histórico de procedimentos — Harmonização Facial</h3>
          <button className="botao-secundario" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? 'Cancelar' : '+ Novo procedimento'}
          </button>
        </div>

        {mostrarForm && (
          <form className="ficha-form" onSubmit={salvar}>
            <div className="ficha-grid">
              <div className="campo">
                <label>Área tratada</label>
                <input value={form.area_tratada} onChange={(e) => setForm({ ...form, area_tratada: e.target.value })} placeholder="Lábio, malar, mandíbula..." />
              </div>
              <div className="campo">
                <label>Produto</label>
                <input value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })} />
              </div>
              <div className="campo">
                <label>Quantidade (ml)</label>
                <input type="number" step="0.1" value={form.quantidade_ml} onChange={(e) => setForm({ ...form, quantidade_ml: e.target.value })} />
              </div>
              <div className="campo">
                <label>Lote</label>
                <input value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} />
              </div>
              <div className="campo">
                <label>Data da aplicação</label>
                <input type="date" value={form.data_aplicacao} onChange={(e) => setForm({ ...form, data_aplicacao: e.target.value })} />
              </div>
              <div className="campo">
                <label>Retorno previsto</label>
                <input type="date" value={form.data_retorno} onChange={(e) => setForm({ ...form, data_retorno: e.target.value })} />
              </div>
            </div>
            <div className="campo">
              <label>Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 200 }}>
              {salvando ? 'Salvando...' : 'Salvar procedimento'}
            </button>
          </form>
        )}

        <div className="lista-registros">
          {registros.length === 0 && <p className="galeria-vazio">Nenhum procedimento ainda.</p>}
          {registros.map((r) => (
            <div className="registro-card" key={r.id}>
              <div className="registro-topo">
                <strong>{r.area_tratada || 'Área não informada'}</strong>
                <span>{r.data_aplicacao ? new Date(r.data_aplicacao).toLocaleDateString('pt-BR') : new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
              </div>
              <p>{r.produto && `Produto: ${r.produto}`} {r.quantidade_ml && `· ${r.quantidade_ml}ml`} {r.lote && `· Lote ${r.lote}`}</p>
              {r.data_retorno && <p>Retorno previsto: {new Date(r.data_retorno).toLocaleDateString('pt-BR')}</p>}
              {r.observacoes && <p>{r.observacoes}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="ficha-secao">
        <h3>Fotos</h3>
        <GaleriaFotos pacienteId={pacienteId} servicoSlug="harmonizacao" />
      </div>
    </div>
  );
}
