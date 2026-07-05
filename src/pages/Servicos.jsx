import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

function gerarSlug(nome) {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function Servicos() {
  const [servicos, setServicos] = useState([]);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from('servicos').select('*').order('criado_em');
    setServicos(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from('servicos').insert({ nome: nome.trim(), slug: gerarSlug(nome) });
    setSalvando(false);
    if (error) { alert('Erro ao cadastrar: ' + error.message); return; }
    setNome('');
    carregar();
  }

  async function alternarAtivo(servico) {
    await supabase.from('servicos').update({ ativo: !servico.ativo }).eq('id', servico.id);
    carregar();
  }

  return (
    <Layout titulo="Serviços">
      <form className="ficha-form" onSubmit={adicionar} style={{ marginBottom: 32, maxWidth: 480 }}>
        <div className="campo">
          <label>Novo serviço</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Depilação a Laser" />
        </div>
        <button type="submit" className="botao" disabled={salvando} style={{ maxWidth: 220 }}>
          {salvando ? 'Salvando...' : '+ Adicionar serviço'}
        </button>
        <p className="dica-texto">
          Serviços novos ganham automaticamente uma ficha padrão (registro + fotos) até que uma ficha
          específica seja programada para eles.
        </p>
      </form>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-refinada">
          <thead>
            <tr><th>Nome</th><th>Identificador</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <tr key={s.id}>
                <td>{s.nome}</td>
                <td>{s.slug}</td>
                <td><span className={`status-pill ${s.ativo ? 'ativo' : 'inativo'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td><button className="botao-secundario" onClick={() => alternarAtivo(s)}>{s.ativo ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
