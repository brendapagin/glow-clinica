import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const HORA_INICIO = 8;
const HORA_FIM = 19;
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function isoData(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somarDias(d, n) {
  const nova = new Date(d);
  nova.setDate(nova.getDate() + n);
  return nova;
}

function gerarSlots() {
  const slots = [];
  for (let h = HORA_INICIO; h < HORA_FIM; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

function horaSlotDe(dt) {
  const h = dt.getHours();
  const m = dt.getMinutes() >= 30 ? 30 : 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const FORM_VAZIO = { paciente_id: '', servico_id: '', data: '', hora: '', duracao_minutos: 30, status: 'confirmado', observacoes: '' };

export default function Agendamentos() {
  const [carregando, setCarregando] = useState(true);
  const [mesRef, setMesRef] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const [agendamentos, setAgendamentos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [servicos, setServicos] = useState([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  async function carregar() {
    setCarregando(true);
    try {
      const inicioMes = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
      const fimMes = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1);

      const { data: ags } = await supabase
        .from('agendamentos')
        .select('*, pacientes(nome), servicos(nome)')
        .gte('data_hora', inicioMes.toISOString())
        .lt('data_hora', fimMes.toISOString())
        .order('data_hora');
      setAgendamentos(ags || []);

      const { data: pacs } = await supabase.from('pacientes').select('id, nome').order('nome');
      setPacientes(pacs || []);

      const { data: servs } = await supabase.from('servicos').select('*').eq('ativo', true);
      setServicos(servs || []);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados: ' + err.message);
    }
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [mesRef]);

  function agendamentosDoDia(dia) {
    const isoAlvo = isoData(dia);
    return agendamentos.filter((a) => isoData(new Date(a.data_hora)) === isoAlvo);
  }

  function abrirNovoAgendamento(hora) {
    setErroModal('');
    setForm({ ...FORM_VAZIO, data: isoData(diaSelecionado), hora: hora || '', duracao_minutos: 30, status: 'confirmado' });
    setEditandoId(null);
    setModalAberto(true);
  }

  function abrirEdicaoAgendamento(ag) {
    setErroModal('');
    const dt = new Date(ag.data_hora);
    setForm({
      paciente_id: ag.paciente_id,
      servico_id: ag.servico_id || '',
      data: isoData(dt),
      hora: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
      duracao_minutos: ag.duracao_minutos,
      status: ag.status,
      observacoes: ag.observacoes || '',
    });
    setEditandoId(ag.id);
    setModalAberto(true);
  }

  async function salvarAgendamento(e) {
    e.preventDefault();
    setErroModal('');

    if (!form.paciente_id) { setErroModal('Selecione um paciente.'); return; }
    if (!form.data || !form.hora) { setErroModal('Preencha data e hora.'); return; }

    setSalvando(true);
    try {
      const dataHoraLocal = new Date(`${form.data}T${form.hora}:00`);
      if (isNaN(dataHoraLocal.getTime())) { throw new Error('Data ou hora inválida.'); }

      const dados = {
        paciente_id: form.paciente_id,
        servico_id: form.servico_id || null,
        data_hora: dataHoraLocal.toISOString(),
        duracao_minutos: Number(form.duracao_minutos) || 30,
        status: form.status,
        observacoes: form.observacoes,
      };

      const { error } = editandoId
        ? await supabase.from('agendamentos').update(dados).eq('id', editandoId)
        : await supabase.from('agendamentos').insert(dados);

      if (error) throw error;

      setModalAberto(false);
      setEditandoId(null);
      await carregar();
    } catch (err) {
      console.error(err);
      setErroModal('Erro ao salvar: ' + err.message);
    }
    setSalvando(false);
  }

  async function excluirAgendamento() {
    if (!confirm('Excluir este agendamento?')) return;
    await supabase.from('agendamentos').delete().eq('id', editandoId);
    setModalAberto(false);
    setEditandoId(null);
    carregar();
  }

  const inicioMes = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
  const fimMesData = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0);
  const primeiroDiaSemana = inicioMes.getDay();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= fimMesData.getDate(); d++) celulas.push(new Date(mesRef.getFullYear(), mesRef.getMonth(), d));

  const hoje = new Date();
  const slots = gerarSlots();

  return (
    <Layout titulo="Agendamentos">
      {!diaSelecionado ? (
        <>
          <div className="agenda-navegacao">
            <button className="botao-secundario" onClick={() => setMesRef((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>← Mês anterior</button>
            <strong>{mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
            <button className="botao-secundario" onClick={() => setMesRef((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Próximo mês →</button>
          </div>

          {carregando ? <p>Carregando...</p> : (
            <>
              <div className="calendario-cabecalho">
                {DIAS_SEMANA.map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="calendario-grade">
                {celulas.map((dia, i) => {
                  const qtd = dia ? agendamentosDoDia(dia).length : 0;
                  const ehHoje = dia && isoData(dia) === isoData(hoje);
                  return (
                    <button
                      key={i}
                      className={`calendario-dia ${ehHoje ? 'calendario-dia-hoje' : ''}`}
                      disabled={!dia}
                      onClick={() => dia && setDiaSelecionado(dia)}
                    >
                      {dia && (
                        <>
                          <span className="calendario-dia-numero">{dia.getDate()}</span>
                          {qtd > 0 && <span className="calendario-dia-badge">{qtd} agendamento{qtd > 1 ? 's' : ''}</span>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <button className="link-secundario" style={{ textAlign: 'left', width: 'auto', marginBottom: 16 }} onClick={() => setDiaSelecionado(null)}>← Voltar ao mês</button>

          <div className="agenda-navegacao">
            <button className="botao-secundario" onClick={() => setDiaSelecionado((d) => somarDias(d, -1))}>← Dia anterior</button>
            <strong>{diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</strong>
            <button className="botao-secundario" onClick={() => setDiaSelecionado((d) => somarDias(d, 1))}>Próximo dia →</button>
          </div>

          <div className="agenda-dia">
            {slots.map((hora) => {
              const agsDoSlot = agendamentosDoDia(diaSelecionado).filter((a) => horaSlotDe(new Date(a.data_hora)) === hora);
              return (
                <div className="horario-linha" key={hora}>
                  <div className="hora-label">{hora}</div>
                  <div className="slot-conteudo">
                    {agsDoSlot.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {agsDoSlot.map((ag) => (
                          <div key={ag.id} className={`bloco-agendamento status-${ag.status}`} onClick={() => abrirEdicaoAgendamento(ag)}>
                            <span className="bloco-nome">{ag.pacientes?.nome}</span>
                            <span className="bloco-servico">{ag.servicos?.nome || 'Sem serviço'} · {ag.duracao_minutos}min · {ag.status}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="slot-vazio" onClick={() => abrirNovoAgendamento(hora)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modalAberto && (
        <div className="modal-fundo" onClick={() => setModalAberto(false)}>
          <div className="modal-caixa" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topo">
              <h3>{editandoId ? 'Editar agendamento' : 'Novo agendamento'}</h3>
              <button className="modal-fechar" onClick={() => setModalAberto(false)}>×</button>
            </div>

            {erroModal && <div className="mensagem erro">{erroModal}</div>}

            <form onSubmit={salvarAgendamento}>
              <div className="campo">
                <label>Paciente</label>
                <select required value={form.paciente_id} onChange={(e) => setForm({ ...form, paciente_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="ficha-grid">
                <div className="campo">
                  <label>Serviço (opcional)</label>
                  <select value={form.servico_id} onChange={(e) => setForm({ ...form, servico_id: e.target.value })}>
                    <option value="">Nenhum</option>
                    {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label>Data</label>
                  <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Hora</label>
                  <input type="time" step="1800" required value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Duração (min)</label>
                  <input type="number" step="5" value={form.duracao_minutos} onChange={(e) => setForm({ ...form, duracao_minutos: e.target.value })} />
                </div>
              </div>

              {editandoId && (
                <div className="campo">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="confirmado">Confirmado</option>
                    <option value="realizado">Realizado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="faltou">Faltou</option>
                  </select>
                </div>
              )}

              <div className="campo">
                <label>Observações</label>
                <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>

              <div className="ficha-form-acoes">
                <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 200 }}>
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Agendar'}
                </button>
                {editandoId && <button type="button" className="link-secundario" onClick={excluirAgendamento}>Excluir</button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
