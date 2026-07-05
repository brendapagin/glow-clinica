import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Usuarios from './pages/Usuarios';
import Pacientes from './pages/Pacientes';
import PacienteFicha from './pages/PacienteFicha';
import { Protegida } from './components/RotaProtegida';

const EQUIPE = ['admin', 'recepcao', 'profissional'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route
        path="/usuarios"
        element={
          <Protegida papeisPermitidos={['admin']}>
            <Usuarios />
          </Protegida>
        }
      />
      <Route
        path="/pacientes"
        element={
          <Protegida papeisPermitidos={EQUIPE}>
            <Pacientes />
          </Protegida>
        }
      />
      <Route
        path="/pacientes/:id"
        element={
          <Protegida papeisPermitidos={EQUIPE}>
            <PacienteFicha />
          </Protegida>
        }
      />
      <Route path="/" element={<Navigate to="/pacientes" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
