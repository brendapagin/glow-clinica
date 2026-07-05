import { useEffect, useRef, useState } from 'react';
import { enviarFoto, listarFotos, excluirFoto } from '../lib/fotos';

export function GaleriaFotos({ pacienteId, servicoSlug }) {
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(null);
  const inputAntes = useRef(null);
  const inputDepois = useRef(null);

  async function carregar() {
    const lista = await listarFotos(pacienteId, servicoSlug);
    setFotos(lista);
  }

  useEffect(() => { carregar(); }, [pacienteId, servicoSlug]);

  async function selecionarArquivo(tipo, e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    setEnviando(tipo);
    try {
      await enviarFoto(pacienteId, servicoSlug, tipo, arquivo);
      await carregar();
    } catch (err) {
      alert('Erro ao enviar foto: ' + err.message);
    }
    setEnviando(null);
    e.target.value = '';
  }

  async function remover(foto) {
    if (!confirm('Excluir esta foto?')) return;
    await excluirFoto(foto.id, foto.storage_path);
    carregar();
  }

  const antes = fotos.filter((f) => f.tipo === 'antes');
  const depois = fotos.filter((f) => f.tipo === 'depois');

  return (
    <div className="galeria-fotos">
      <div className="galeria-coluna">
        <div className="galeria-cabecalho">
          <h4>Antes</h4>
          <button className="botao-secundario" onClick={() => inputAntes.current.click()} disabled={enviando === 'antes'}>
            {enviando === 'antes' ? 'Enviando...' : '+ Adicionar foto'}
          </button>
          <input ref={inputAntes} type="file" accept="image/*" hidden onChange={(e) => selecionarArquivo('antes', e)} />
        </div>
        <div className="galeria-grade">
          {antes.length === 0 && <p className="galeria-vazio">Nenhuma foto ainda.</p>}
          {antes.map((f) => (
            <div className="galeria-item" key={f.id}>
              <img src={f.url} alt="Foto antes" />
              <button onClick={() => remover(f)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="galeria-coluna">
        <div className="galeria-cabecalho">
          <h4>Depois</h4>
          <button className="botao-secundario" onClick={() => inputDepois.current.click()} disabled={enviando === 'depois'}>
            {enviando === 'depois' ? 'Enviando...' : '+ Adicionar foto'}
          </button>
          <input ref={inputDepois} type="file" accept="image/*" hidden onChange={(e) => selecionarArquivo('depois', e)} />
        </div>
        <div className="galeria-grade">
          {depois.length === 0 && <p className="galeria-vazio">Nenhuma foto ainda.</p>}
          {depois.map((f) => (
            <div className="galeria-item" key={f.id}>
              <img src={f.url} alt="Foto depois" />
              <button onClick={() => remover(f)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
