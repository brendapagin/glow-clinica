import { Link, useLocation } from 'react-router-dom';
import { Users, ShieldCheck, LogOut, Sparkles, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ITENS_NAV = [
  { to: '/pacientes', label: 'Pacientes', Icone: Users, papeis: ['admin', 'recepcao', 'profissional'] },
  { to: '/servicos', label: 'Serviços', Icone: Sparkles, papeis: ['admin'] },
  { to: '/produtos', label: 'Produtos', Icone: Package, papeis: ['admin', 'profissional'] },
  { to: '/usuarios', label: 'Usuários', Icone: ShieldCheck, papeis: ['admin'] },
];

export function Layout({ titulo, children }) {
  const { sair, perfil } = useAuth();
  const location = useLocation();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-marca">
          <svg viewBox="0 0 100 100" className="flor-mini">
            <path d="M50 30
              C 50 30, 40 15, 50 5
              C 60 15, 50 30, 50 30
              M50 30
              C 50 30, 30 25, 20 35
              C 30 40, 50 30, 50 30
              M50 30
              C 50 30, 70 25, 80 35
              C 70 40, 50 30, 50 30
              M50 30
              C 50 30, 35 45, 30 60
              C 45 60, 50 30, 50 30
              M50 30
              C 50 30, 65 45, 70 60
              C 55 60, 50 30, 50 30" />
          </svg>
          <h1>GLOW</h1>
        </div>

        <nav className="sidebar-nav">
          {ITENS_NAV.filter((item) => !perfil || item.papeis.includes(perfil.papel)).map(({ to, label, Icone }) => (
            <Link
              key={to}
              to={to}
              className={`sidebar-link ${location.pathname.startsWith(to) ? 'sidebar-link-ativo' : ''}`}
            >
              <Icone size={18} strokeWidth={1.6} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-rodape">
          <button className="sidebar-sair" onClick={sair}>
            <LogOut size={16} strokeWidth={1.6} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-main-conteudo">
          {titulo && <h2 className="app-main-titulo">{titulo}</h2>}
          {children}
        </div>
      </main>
    </div>
  );
}
