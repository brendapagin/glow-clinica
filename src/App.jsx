import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Usuarios from './pages/Usuarios';
import Pacientes from './pages/Pacientes';
import PacienteFicha from './pages/PacienteFicha';
import Custo from './pages/Custo';
import Painel from './pages/Painel';
import Agendamentos from './pages/Agendamentos';
import ContasPagar from './pages/ContasPagar';
import ContasReceber from './pages/ContasReceber';
import Caixa from './pages/Caixa';
import { Protegida } from './components/RotaProtegida';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route
        path="/usuarios"
        element={
          <Protegida telaRequerida="usuarios">
            <Usuarios />
          </Protegida>
        }
      />
      <Route
        path="/pacientes"
        element={
          <Protegida telaRequerida="pacientes">
            <Pacientes />
          </Protegida>
        }
      />
      <Route
        path="/pacientes/:id"
        element={
          <Protegida telaRequerida="pacientes">
            <PacienteFicha />
          </Protegida>
        }
      />
      <Route
        path="/custo"
        element={
          <Protegida telaRequerida="custo">
            <Custo />
          </Protegida>
        }
      />
      <Route
        path="/contas-pagar"
        element={
          <Protegida telaRequerida="contas_pagar">
            <ContasPagar />
          </Protegida>
        }
      />
      <Route
        path="/contas-receber"
        element={
          <Protegida telaRequerida="contas_receber">
            <ContasReceber />
          </Protegida>
        }
      />
      <Route
        path="/caixa"
        element={
          <Protegida telaRequerida="caixa">
            <Caixa />
          </Protegida>
        }
      />
      <Route
        path="/painel"
        element={
          <Protegida>
            <Painel />
          </Protegida>
        }
      />
      <Route
        path="/agendamentos"
        element={
          <Protegida telaRequerida="agendamentos">
            <Agendamentos />
          </Protegida>
        }
      />
      <Route path="/" element={<Navigate to="/painel" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
