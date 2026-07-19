import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { FichaCapilar } from '../components/fichas/FichaCapilar';
import { FichaHarmonizacao } from '../components/fichas/FichaHarmonizacao';
import { FichaGenerica } from '../components/fichas/FichaGenerica';
import { PacotesPaciente } from '../components/PacotesPaciente';

function renderizarFicha(slug, nome, pacienteId, pacienteNome) {
  if (slug === 'capilar') return <FichaCapilar pacienteId={pacienteId} pacienteNome={pacienteNome} />;
  if (slug === 'harmonizacao') return <FichaHarmonizacao pacienteId={pacienteId} pacienteNome={pacienteNome} />;
  return <FichaGenerica pacienteId={pacienteId} servicoSlug={slug} servicoNome={nome} pacienteNome={pacienteNome} />;
}

export default function PacienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [paciente, setPaciente] = useState(null);
  const [servicosAtivos, setServicosAtivos] = useState([]);
  const [servicosDisponiveis, setServicosDisponiveis] = useState([]);
  const [abaAtual, setAbaAtual] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);

  async function carregar() {
    setCarregando(true);

    const { data: pac } = await supabase.from('pacientes').select('*').eq('id', id).single();
    setPaciente(pac);

    const { data: vinculos } = await supabase
      .from('paciente_servicos')
      .select('id, data_inicio, servicos(id, nome, slug, ativo)')
      .eq('paciente_id', id);

    const ativos = (vinculos || [])
      .map((v) => v.servicos)
      .filter((s) => s && s.ativo);
    setServicosAtivos(ativos);
    if (ativos.length > 0 && !abaAtual) setAbaAtual(ativos[0].slug);

    const { data: todos } = await supabase.from('servicos').select('*').eq('ativo', true);
    const idsAtivos = ativos.map((a) => a.id);
    setServicosDisponiveis((todos || []).filter((s) => !idsAtivos.includes(s.id)));

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [id]);

  async function adicionarServico(servicoId) {
    const { error } = await supabase.from('paciente_servicos').insert({ paciente_id: id, servico_id: servicoId });
    if (error) { alert('Erro ao adicionar serviço: ' + error.message); return; }
    setMostrarAdicionar(false);
    carregar();
  }

  if (carregando) return <div className="tela-aviso">Carregando...</div>;
  if (!paciente) return <div className="tela-aviso">Paciente não encontrado.</div>;

  const servicoAtual = servicosAtivos.find((s) => s.slug === abaAtual);

  return (
    <Layout>
      <button className="link-secundario" style={{ textAlign: 'left', marginBottom: 16 }} onClick={() => navigate('/pacientes')}>
        ← Voltar para pacientes
      </button>

      <div className="paciente-cabecalho">
        <h2>{paciente.nome}</h2>
        <p>{[paciente.telefone, paciente.email, paciente.cpf].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</p>
      </div>

      <PacotesPaciente pacienteId={id} />

      <div className="abas-servico">
        {servicosAtivos.map((s) => (
          <button
            key={s.slug}
            className={`aba ${abaAtual === s.slug ? 'aba-ativa' : ''}`}
            onClick={() => setAbaAtual(s.slug)}
          >
            {s.nome}
          </button>
        ))}

        {servicosDisponiveis.length > 0 && (
          <div className="aba-adicionar">
            <button className="aba aba-adicionar-botao" onClick={() => setMostrarAdicionar((v) => !v)}>+ Adicionar serviço</button>
            {mostrarAdicionar && (
              <div className="aba-adicionar-menu">
                {servicosDisponiveis.map((s) => (
                  <button key={s.id} onClick={() => adicionarServico(s.id)}>{s.nome}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {servicosAtivos.length === 0 && (
        <p className="galeria-vazio">Este paciente ainda não tem nenhum serviço iniciado. Clique em "+ Adicionar serviço" acima.</p>
      )}

      {abaAtual && renderizarFicha(abaAtual, servicoAtual?.nome, id, paciente.nome)}
    </Layout>
  );
}
