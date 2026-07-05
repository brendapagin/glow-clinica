import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Uso: <Protegida papeisPermitidos={['admin']}><Usuarios /></Protegida>
// Sem "papeisPermitidos", qualquer usuário ativo e logado pode acessar.
export function Protegida({ children, papeisPermitidos }) {
  const { session, perfil, carregando } = useAuth();

  if (carregando) {
    return <div className="tela-aviso">Carregando...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!perfil || !perfil.ativo) {
    return (
      <div className="tela-aviso">
        <h2>Acesso pendente</h2>
        <p>Sua conta ainda está aguardando aprovação do administrador.</p>
      </div>
    );
  }

  if (papeisPermitidos && !papeisPermitidos.includes(perfil.papel)) {
    return (
      <div className="tela-aviso">
        <h2>Acesso restrito</h2>
        <p>Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  return children;
}
