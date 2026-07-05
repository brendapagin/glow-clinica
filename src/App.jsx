import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Usuarios from './pages/Usuarios';
import { Protegida } from './components/RotaProtegida';

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
      <Route path="/" element={<Navigate to="/usuarios" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
