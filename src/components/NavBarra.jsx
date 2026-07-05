import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBarra({ titulo }) {
  const { sair } = useAuth();
  return (
    <div className="topo">
      <div className="topo-esquerda">
        <h1>{titulo}</h1>
        <nav className="topo-nav">
          <Link to="/pacientes">Pacientes</Link>
          <Link to="/usuarios">Usuários</Link>
        </nav>
      </div>
      <button onClick={sair}>Sair</button>
    </div>
  );
}
