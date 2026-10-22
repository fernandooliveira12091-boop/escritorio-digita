import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { Layout } from "./components/layout/Layout";
import Agenda from "./pages/Agenda";
import Atividades from "./pages/Atividades";
import Configuracoes from "./pages/Configuracoes";
import Contatos from "./pages/Contatos";
import { Perfil, Suporte } from "./pages/Conta";
import Crm from "./pages/Crm";
import Financeiro from "./pages/Financeiro";
import Home from "./pages/Home";
import Intimacoes from "./pages/Intimacoes";
import Modelos from "./pages/Modelos";
import Parceiros from "./pages/Parceiros";
import ProcessoDetalhe from "./pages/ProcessoDetalhe";
import Processos from "./pages/Processos";
import Relatorios from "./pages/Relatorios";

// HashRouter: funciona em qualquer hospedagem estática, sem configurar o servidor.
export default function App() {
  return (
    <AuthGate>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/atividades" element={<Atividades />} />
            <Route path="/crm" element={<Crm />} />
            <Route path="/contatos" element={<Contatos />} />
            <Route path="/processos" element={<Processos />} />
            <Route path="/processos/:id" element={<ProcessoDetalhe />} />
            <Route path="/intimacoes" element={<Intimacoes />} />
            <Route path="/parceiros" element={<Parceiros />} />
            <Route path="/modelos" element={<Modelos section="agentes" />} />
            <Route path="/modelos/agentes/:agentId" element={<Modelos section="agentes" />} />
            <Route path="/modelos/meus" element={<Modelos section="meus" />} />
            <Route path="/modelos/biblioteca" element={<Modelos section="biblioteca" />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/suporte" element={<Suporte />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthGate>
  );
}
