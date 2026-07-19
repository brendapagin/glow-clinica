import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function isoData(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function Painel() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);

  const [nota, setNota] = useState('');
  const [notaId, setNotaId] = useState(null);
  const [salvandoNota, setSalvandoNota] = useState(false);

  const [agendamentosHoje, setAgendamentosHoje] = useState([]);
  const [aniversariantes, setAniversariantes] = useState([]);
  const [pacotesAcabando, setPacotesAcabando] = useState([]);

  const [saldoCaixa, setSaldoCaixa] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [aPagar, setAPagar] = useState(0);
  const [contasVencendoHoje, setContasVencendoHoje] = useState([]);

  async function carregar() {
    setCarregando(true);

    const { data: notaData } = await supabase.from('notas_clinica').select('*').limit(1).maybeSingle();
    if (notaData) { setNota(notaData.conteudo || ''); setNotaId(notaData.id); }

    const hojeIso = isoData(new Date());
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999);

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, pacientes(nome), servicos(nome)')
      .gte('data_hora', inicioHoje.toISOString())
      .lte('data_hora', fimHoje.toISOString())
      .order('data_hora');
    setAgendamentosHoje(ags || []);

    const { data: pacs } = await supabase.from('pacientes').select('id, nome, data_nascimento').order('nome');

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

    const vencendoHoje = (pagar || []).filter((c) => c.status === 'pendente' && c.vencimento === hojeIso);
    setContasVencendoHoje(vencendoHoje);

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

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

  const totalVenceHoje = contasVencendoHoje.reduce((s, c) => s + Number(c.valor || 0), 0);

  return (
    <Layout titulo="Painel">
      <div className="campo" style={{ marginBottom: 24 }}>
        <div className="campo-cabecalho">
          <label>Bloco de notas</label>
          <button className="botao-secundario" onClick={salvarNota} disabled={salvandoNota}>{salvandoNota ? 'Salvando...' : 'Salvar nota'}</button>
        </div>
        <textarea rows={7} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Anote algo pra lembrar hoje..." />
      </div>

      {carregando ? <p>Carregando...</p> : (
        <div className="painel-duas-colunas">
          <div className="ficha-secao" style={{ marginBottom: 0 }}>
            <div className="ficha-secao-topo">
              <h3>Pacientes de hoje</h3>
              <button className="botao-secundario" onClick={() => navigate('/agendamentos')}>Ver agenda completa</button>
            </div>
            {agendamentosHoje.length === 0 ? (
              <p className="dica-texto">Nenhum agendamento para hoje.</p>
            ) : (
              agendamentosHoje.map((a) => (
                <p key={a.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {a.pacientes?.nome}</span>
                  <span className={`status-pill ${a.status === 'realizado' ? 'ativo' : a.status === 'cancelado' || a.status === 'faltou' ? 'inativo' : 'parcial'}`}>{a.status}</span>
                </p>
              ))
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
      )}

      {!carregando && (
        <div className="painel-financeiro-rodape">
          <p className="dica-texto" style={{ marginBottom: 10 }}>Resumo financeiro</p>
          <div className="caixa-cartoes">
            <button className="caixa-cartao caixa-cartao-clicavel" onClick={() => navigate('/caixa')}>
              <span className="caixa-cartao-label">Saldo em caixa</span>
              <strong className="caixa-cartao-valor">{formatarMoeda(saldoCaixa)}</strong>
            </button>
            <button className="caixa-cartao caixa-cartao-clicavel" onClick={() => navigate('/contas-receber')}>
              <span className="caixa-cartao-label">A receber</span>
              <strong className="caixa-cartao-valor caixa-positivo">{formatarMoeda(aReceber)}</strong>
            </button>
            <button className="caixa-cartao caixa-cartao-clicavel" onClick={() => navigate('/contas-pagar')}>
              <span className="caixa-cartao-label">A pagar</span>
              <strong className="caixa-cartao-valor caixa-negativo">{formatarMoeda(aPagar)}</strong>
            </button>
            <button className="caixa-cartao caixa-cartao-clicavel" onClick={() => navigate('/contas-pagar')}>
              <span className="caixa-cartao-label">Vence hoje</span>
              <strong className="caixa-cartao-valor caixa-negativo">{formatarMoeda(totalVenceHoje)}</strong>
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
