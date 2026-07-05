import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Uso: <Protegida telaRequerida="pacientes">...</Protegida>
// Admin sempre tem acesso total. Para os demais, verifica se a tela
// está na lista de permissões do usuário.
export function Protegida({ children, telaRequerida }) {
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

  const temAcesso = !telaRequerida || perfil.papel === 'admin' || (perfil.permissoes || []).includes(telaRequerida);

  if (!temAcesso) {
    return (
      <div className="tela-aviso">
        <h2>Acesso restrito</h2>
        <p>Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  return children;
}
