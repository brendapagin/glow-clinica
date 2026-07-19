import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

const HORA_INICIO = 8;
const HORA_FIM = 19;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function isoData(d) {
  return d.toISOString().slice(0, 10);
}

function somarDias(d, n) {
  const nova = new Date(d);
  nova.setDate(nova.getDate() + n);
  return nova;
}

function inicioSemana(d) {
  const nova = new Date(d);
  const diaSemana = nova.getDay();
  nova.setDate(nova.getDate() - diaSemana);
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

const FORM_VAZIO = { paciente_id: '', servico_id: '', data: '', hora: '', duracao_minutos: 30, status: 'confirmado', observacoes: '' };

export default function Painel() {
  const [carregando, setCarregando] = useState(true);

  const [nota, setNota] = useState('');
  const [notaId, setNotaId] = useState(null);
  const [salvandoNota, setSalvandoNota] = useState(false);

  const [visao, setVisao] = useState('dia');
  const [dataRef, setDataRef] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [servicos, setServicos] = useState([]);

  const [aniversariantes, setAniversariantes] = useState([]);
  const [pacotesAcabando, setPacotesAcabando] = useState([]);

  const [saldoCaixa, setSaldoCaixa] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [aPagar, setAPagar] = useState(0);
  const [venceHoje, setVenceHoje] = useState(0);

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [salvandoAgendamento, setSalvandoAgendamento] = useState(false);

  async function carregar() {
    setCarregando(true);

    const { data: notaData } = await supabase.from('notas_clinica').select('*').limit(1).maybeSingle();
    if (notaData) { setNota(notaData.conteudo || ''); setNotaId(notaData.id); }

    const inicio = visao === 'dia' ? new Date(dataRef) : visao === 'semana' ? inicioSemana(dataRef) : new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
    const fim = visao === 'dia' ? somarDias(dataRef, 1) : visao === 'semana' ? somarDias(inicioSemana(dataRef), 7) : new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 1);

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome), servicos(nome)')
      .gte('data_hora', inicio.toISOString())
      .lt('data_hora', fim.toISOString())
      .order('data_hora');
    setAgendamentos(ags || []);

    const { data: pacs } = await supabase.from('pacientes').select('id, nome, data_nascimento').order('nome');
    setPacientes(pacs || []);

    const { data: servs } = await supabase.from('servicos').select('*').eq('ativo', true);
    setServicos(servs || []);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const aniversariantesLista = (pacs || [])
      .filter((p) => p.data_nascimento)
      .map((p) => {
        const nasc = new Date(p.data_nascimento + 'T00:00:00');
        const esteAno = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
        if (esteAno < hoje) esteAno.setFullYear(hoje.getFullYear() + 1);
        const diffDias = Math.round((esteAno - hoje) / 86400000);
        return { nome: p.nome, data: esteAno, diffDias };
      })
      .filter((a) => a.diffDias >= 0 && a.diffDias <= 6)
      .sort((a, b) => a.diffDias - b.diffDias);
    setAniversariantes(aniversariantesLista);

    const { data: pacotesData } = await supabase.from('pacotes').select('*, pacientes(nome)').eq('status', 'ativo');
    const acabando = (pacotesData || [])
      .filter((p) => p.sessoes_totais - p.sessoes_utilizadas <= 2)
      .sort((a, b) => (a.sessoes_totais - a.sessoes_utilizadas) - (b.sessoes_totais - b.sessoes_utilizadas));
    setPacotesAcabando(acabando);

    const { data: lancamentos } = await supabase.from('caixa_lancamentos').select('*');
    const { data: receber } = await supabase.from('contas_receber').select('*, contas_receber_baixas(*)');
    const { data: pagar } = await supabase.from('contas_pagar').select('*');

    const entradasManual = (lancamentos || []).filter((l) => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor || 0), 0);
    const saidasManual = (lancamentos || []).filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor || 0), 0);
    const recebidoTotal = (receber || []).reduce((s, c) => s + (c.contas_receber_baixas || []).reduce((s2, b) => s2 + Number(b.valor || 0), 0), 0);
    const pagoTotal = (pagar || []).filter((c) => c.status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0);
    setSaldoCaixa(entradasManual - saidasManual + recebidoTotal - pagoTotal);

    const pendenteReceber = (receber || [])
      .filter((c) => c.status !== 'recebido')
      .reduce((s, c) => s + (Number(c.valor || 0) - (c.contas_receber_baixas || []).reduce((s2, b) => s2 + Number(b.valor || 0), 0)), 0);
    setAReceber(pendenteReceber);

    const pendentePagar = (pagar || []).filter((c) => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);
    setAPagar(pendentePagar);

    const hojeIso = isoData(new Date());
    const venceHojeTotal = (pagar || []).filter((c) => c.status === 'pendente' && c.vencimento === hojeIso).reduce((s, c) => s + Number(c.valor || 0), 0);
    setVenceHoje(venceHojeTotal);

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [visao, dataRef]);

  async function salvarNota() {
    setSalvandoNota(true);
    const dados = { conteudo: nota, atualizado_em: new Date().toISOString() };
    if (notaId) {
      await supabase.from('notas_clinica').update(dados).eq('id', notaId);
    } else {
      const { data } = await supabase.from('notas_clinica').insert(dados).select().single();
      if (data) setNotaId(data.id);
    }
    setSalvandoNota(false);
  }

  function abrirNovoAgendamento(dataSlot, horaSlot) {
    setForm({ ...FORM_VAZIO, data: isoData(dataSlot), hora: horaSlot || '', duracao_minutos: 30, status: 'confirmado' });
    setEditandoId(null);
    setModalAberto(true);
  }

  function abrirEdicaoAgendamento(ag) {
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
    setSalvandoAgendamento(true);

    const dataHoraLocal = new Date(`${form.data}T${form.hora || '00:00'}:00`);
    const dados = {
      paciente_id: form.paciente_id,
      servico_id: form.servico_id || null,
      data_hora: dataHoraLocal.toISOString(),
      duracao_minutos: form.duracao_minutos || 30,
      status: form.status,
      observacoes: form.observacoes,
    };

    const { error } = editandoId
      ? await supabase.from('agendamentos').update(dados).eq('id', editandoId)
      : await supabase.from('agendamentos').insert(dados);

    setSalvandoAgendamento(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setModalAberto(false);
    setEditandoId(null);
    carregar();
  }

  async function excluirAgendamento() {
    if (!confirm('Excluir este agendamento?')) return;
    await supabase.from('agendamentos').delete().eq('id', editandoId);
    setModalAberto(false);
    setEditandoId(null);
    carregar();
  }

  const slots = gerarSlots();
  const diasSemana = visao === 'semana' ? Array.from({ length: 7 }, (_, i) => somarDias(inicioSemana(dataRef), i)) : [];
  const diasMes = visao === 'mes' ? (() => {
    const inicioMes = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
    const fimMes = new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 0);
    const primeiroDiaSemana = inicioMes.getDay();
    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let d = 1; d <= fimMes.getDate(); d++) dias.push(new Date(dataRef.getFullYear(), dataRef.getMonth(), d));
    return dias;
  })() : [];

  function agendamentosDoDia(dia) {
    const isoAlvo = isoData(dia);
    return agendamentos.filter((a) => isoData(new Date(a.data_hora)) === isoAlvo);
  }

  return (
    <Layout titulo="Painel">
      <div className="campo" style={{ marginBottom: 24 }}>
        <div className="campo-cabecalho">
          <label>Bloco de notas</label>
          <button className="botao-secundario" onClick={salvarNota} disabled={salvandoNota}>{salvandoNota ? 'Salvando...' : 'Salvar nota'}</button>
        </div>
        <textarea rows={7} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Anote algo pra lembrar hoje..." />
      </div>

      <div className="painel-duas-colunas">
        <div className="ficha-secao" style={{ marginBottom: 0 }}>
          <div className="ficha-secao-topo">
            <h3>Agenda</h3>
            <div className="abas-servico" style={{ marginBottom: 0 }}>
              <button className={`aba ${visao === 'dia' ? 'aba-ativa' : ''}`} onClick={() => setVisao('dia')}>Dia</button>
              <button className={`aba ${visao === 'semana' ? 'aba-ativa' : ''}`} onClick={() => setVisao('semana')}>Semana</button>
              <button className={`aba ${visao === 'mes' ? 'aba-ativa' : ''}`} onClick={() => setVisao('mes')}>Mês</button>
            </div>
          </div>

          <div className="agenda-navegacao">
            <button className="botao-secundario" onClick={() => setDataRef((d) => somarDias(d, visao === 'mes' ? -30 : visao === 'semana' ? -7 : -1))}>← Anterior</button>
            <strong>
              {visao === 'dia' && dataRef.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              {visao === 'semana' && `Semana de ${inicioSemana(dataRef).toLocaleDateString('pt-BR')}`}
              {visao === 'mes' && dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </strong>
            <button className="botao-secundario" onClick={() => setDataRef((d) => somarDias(d, visao === 'mes' ? 30 : visao === 'semana' ? 7 : 1))}>Próximo →</button>
          </div>

          {carregando ? <p>Carregando...</p> : (
            <>
              {visao === 'dia' && (
                <div className="agenda-dia">
                  {slots.map((hora) => {
                    const ag = agendamentosDoDia(dataRef).find((a) => {
                      const dt = new Date(a.data_hora);
                      return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` === hora;
                    });
                    return (
                      <div className="horario-linha" key={hora}>
                        <div className="hora-label">{hora}</div>
                        <div className="slot-conteudo">
                          {ag ? (
                            <div className={`bloco-agendamento status-${ag.status}`} onClick={() => abrirEdicaoAgendamento(ag)}>
                              <span className="bloco-nome">{ag.pacientes?.nome}</span>
                              <span className="bloco-servico">{ag.servicos?.nome || 'Sem serviço'} · {ag.duracao_minutos}min</span>
                            </div>
                          ) : (
                            <div className="slot-vazio" onClick={() => abrirNovoAgendamento(dataRef, hora)} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {visao === 'semana' && (
                <div className="agenda-semana">
                  {diasSemana.map((dia) => (
                    <div className="agenda-semana-coluna" key={isoData(dia)}>
                      <button className="agenda-semana-cabecalho" onClick={() => { setDataRef(dia); setVisao('dia'); }}>
                        {dia.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                      </button>
                      {agendamentosDoDia(dia).map((a) => (
                        <div key={a.id} className={`bloco-agendamento-mini status-${a.status}`} onClick={() => abrirEdicaoAgendamento(a)}>
                          {new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {a.pacientes?.nome}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {visao === 'mes' && (
                <div className="agenda-mes">
                  {diasMes.map((dia, i) => (
                    <button key={i} className="agenda-mes-dia" disabled={!dia} onClick={() => dia && (setDataRef(dia), setVisao('dia'))}>
                      {dia && (
                        <>
                          <span>{dia.getDate()}</span>
                          {agendamentosDoDia(dia).length > 0 && <span className="agenda-mes-badge">{agendamentosDoDia(dia).length}</span>}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <div className="ficha-secao">
            <h3>Aniversariantes da semana</h3>
            {aniversariantes.length === 0 ? <p className="dica-texto">Nenhum aniversário esta semana.</p> : (
              aniversariantes.map((a, i) => (
                <p key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{a.nome}</span>
                  <span className="tag">{a.data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                </p>
              ))
            )}
          </div>

          <div className="ficha-secao">
            <h3>Pacotes acabando</h3>
            {pacotesAcabando.length === 0 ? <p className="dica-texto">Nenhum pacote perto do fim.</p> : (
              pacotesAcabando.map((p) => (
                <p key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.pacientes?.nome}</span>
                  <span className="tag">{p.sessoes_utilizadas}/{p.sessoes_totais} sessões</span>
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="painel-financeiro-rodape">
        <p className="dica-texto" style={{ marginBottom: 10 }}>Resumo financeiro</p>
        <div className="caixa-cartoes">
          <div className="caixa-cartao">
            <span className="caixa-cartao-label">Saldo em caixa</span>
            <strong className="caixa-cartao-valor">{formatarMoeda(saldoCaixa)}</strong>
          </div>
          <div className="caixa-cartao">
            <span className="caixa-cartao-label">A receber</span>
            <strong className="caixa-cartao-valor caixa-positivo">{formatarMoeda(aReceber)}</strong>
          </div>
          <div className="caixa-cartao">
            <span className="caixa-cartao-label">A pagar</span>
            <strong className="caixa-cartao-valor caixa-negativo">{formatarMoeda(aPagar)}</strong>
          </div>
          <div className="caixa-cartao">
            <span className="caixa-cartao-label">Vence hoje</span>
            <strong className="caixa-cartao-valor caixa-negativo">{formatarMoeda(venceHoje)}</strong>
          </div>
        </div>
      </div>

      {modalAberto && (
        <div className="modal-fundo" onClick={() => setModalAberto(false)}>
          <div className="modal-caixa" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topo">
              <h3>{editandoId ? 'Editar agendamento' : 'Novo agendamento'}</h3>
              <button className="modal-fechar" onClick={() => setModalAberto(false)}>×</button>
            </div>

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
                  <input type="time" required value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
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
                <button type="submit" className="botao" disabled={salvandoAgendamento} style={{ maxWidth: 200 }}>
                  {salvandoAgendamento ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Agendar'}
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
