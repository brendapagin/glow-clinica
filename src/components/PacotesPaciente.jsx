import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const VAZIO = { nome: '', servico_id: '', sessoes_totais: 10, valor_total: '', data_inicio: new Date().toISOString().slice(0, 10) };

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export function PacotesPaciente({ pacienteId }) {
  const [pacotes, setPacotes] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('pacotes')
      .select('*, servicos(nome)')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });
    setPacotes(data || []);

    const { data: servs } = await supabase.from('servicos').select('*').eq('ativo', true);
    setServicos(servs || []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const { data, error } = await supabase.from('pacotes').insert({
      paciente_id: pacienteId,
      servico_id: form.servico_id || null,
      nome: form.nome,
      sessoes_totais: form.sessoes_totais || 1,
      valor_total: form.valor_total || 0,
      data_inicio: form.data_inicio || null,
    }).select().single();

    if (error) { alert('Erro ao criar pacote: ' + error.message); setSalvando(false); return; }

    if (Number(form.valor_total) > 0) {
      await supabase.from('contas_receber').insert({
        paciente_id: pacienteId,
        origem_tipo: 'pacote',
        origem_id: data.id,
        descricao: form.nome,
        valor: form.valor_total,
        data_prevista: form.data_inicio || null,
        status: 'pendente',
      });
    }

    setSalvando(false);
    setForm(VAZIO);
    setMostrarForm(false);
    carregar();
  }

  async function mudarStatus(pacote, status) {
    await supabase.from('pacotes').update({ status }).eq('id', pacote.id);
    carregar();
  }

  async function excluir(pacote) {
    if (!confirm(`Excluir o pacote "${pacote.nome}"? Isso também remove a conta a receber gerada por ele, se ainda estiver pendente.`)) return;
    await supabase.from('contas_receber').delete().eq('origem_tipo', 'pacote').eq('origem_id', pacote.id);
    const { error } = await supabase.from('pacotes').delete().eq('id', pacote.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    carregar();
  }

  return (
    <div className="ficha-secao" style={{ marginBottom: 32 }}>
      <div className="ficha-secao-topo">
        <h3>Pacotes</h3>
        {!mostrarForm && <button className="botao-secundario" onClick={() => setMostrarForm(true)}>+ Novo pacote</button>}
      </div>

      {mostrarForm && (
        <form className="ficha-form" onSubmit={salvar} style={{ marginBottom: 20 }}>
          <div className="ficha-grid">
            <div className="campo">
              <label>Nome do pacote</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pacote 10 sessões Capilar" />
            </div>
            <div className="campo">
              <label>Serviço (opcional)</label>
              <select value={form.servico_id} onChange={(e) => setForm({ ...form, servico_id: e.target.value })}>
                <option value="">Qualquer serviço</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="campo">
              <label>Total de sessões</label>
              <input type="number" min="1" value={form.sessoes_totais} onChange={(e) => setForm({ ...form, sessoes_totais: e.target.value })} />
            </div>
            <div className="campo">
              <label>Valor total pago (R$)</label>
              <input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
            </div>
            <div className="campo">
              <label>Data de início</label>
              <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
          </div>
          <p className="dica-texto">Ao salvar, o valor total já entra em Contas a Receber automaticamente (uma única vez).</p>
          <div className="ficha-form-acoes">
            <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 200 }}>{salvando ? 'Salvando...' : 'Criar pacote'}</button>
            <button type="button" className="link-secundario" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {pacotes.length === 0 ? (
        <p className="dica-texto">Nenhum pacote cadastrado para este paciente.</p>
      ) : (
        <div className="lista-registros">
          {pacotes.map((p) => (
            <div className="registro-card" key={p.id}>
              <div className="registro-topo">
                <strong>{p.nome} {p.servicos?.nome && `· ${p.servicos.nome}`}</strong>
                <div className="registro-topo-direita">
                  <span className={`status-pill ${p.status === 'ativo' ? 'ativo' : p.status === 'concluido' ? 'parcial' : 'inativo'}`}>{p.status}</span>
                </div>
              </div>
              <p>{p.sessoes_utilizadas} de {p.sessoes_totais} sessões utilizadas · Valor pago: {formatarMoeda(p.valor_total)}</p>
              <div className="registro-acoes" style={{ marginTop: 6 }}>
                {p.status === 'ativo' && (
                  <>
                    <button onClick={() => mudarStatus(p, 'concluido')}>Marcar como concluído</button>
                    <button onClick={() => mudarStatus(p, 'cancelado')}>Cancelar</button>
                  </>
                )}
                <button onClick={() => excluir(p)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
