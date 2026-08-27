import React, { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { auth, db } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState("Geral");

  // Form states
  const [meuDeck, setMeuDeck] = useState("Mono Red Madness");
  const [deckAdversario, setDeckAdversario] = useState("");
  const [oponente, setOponente] = useState("");
  const [placar, setPlacar] = useState("2-0");
  const [resultado, setResultado] = useState("Vitória");
  const [torneio, setTorneio] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Trata o estado de autenticação e retorno do Login Redirect
  useEffect(() => {
    // Processa o resultado do redirecionamento no mobile
    getRedirectResult(auth).catch((error) => {
      console.error("Erro no retorno do login:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Busca as partidas em tempo real para o usuário logado
  useEffect(() => {
    if (!user) {
      setPartidas([]);
      return;
    }

    const q = query(
      collection(db, "partidas"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPartidas(docs);
    });

    return () => unsubscribe();
  }, [user]);

  // Função de Login (Otimizada para Mobile)
  // Função de Login (Otimizada para Mobile e à prova de falhas)
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Erro ao iniciar login com Google:", error);
      alert("Erro ao abrir login: " + error.message);
    }
  };

  // Função de Logout
  const handleLogout = () => {
    signOut(auth);
  };

  // Cadastrar Partida
  // Cadastrar Partida
  const handleSubmitMatch = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Você precisa estar autenticado para salvar.");
      return;
    }

    try {
      await addDoc(collection(db, "partidas"), {
        userId: user.uid,
        userEmail: user.email || "",
        meuDeck: meuDeck || "Mono Red Madness",
        deckAdversario: deckAdversario || "",
        oponente: oponente || "",
        placar: placar || "2-0",
        resultado: resultado || "Vitória",
        torneio: torneio || "",
        data: new Date().toISOString().split('T')[0]
      });

      // Limpar formulário e fechar modal
      setDeckAdversario("");
      setOponente("");
      setTorneio("");
      setIsModalOpen(false);
      alert("Partida registrada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar partida:", error);
      alert("Erro ao salvar partida: " + error.message);
    }
  };

      // Limpar formulário
      setDeckAdversario("");
      setOponente("");
      setTorneio("");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar partida:", error);
    }
  };

  // Deletar Partida
  const handleDeleteMatch = async (id) => {
    try {
      await deleteDoc(doc(db, "partidas", id));
    } catch (error) {
      console.error("Erro ao deletar partida:", error);
    }
  };

  // Filtro por Deck
  const partidasFiltradas = selectedDeck === "Geral" 
    ? partidas 
    : partidas.filter(p => p.meuDeck === selectedDeck);

  // Cálculos de Estatísticas
  const totalJogos = partidasFiltradas.length;
  const vitorias = partidasFiltradas.filter(p => p.resultado === "Vitória").length;
  const derrotas = totalJogos - vitorias;
  const winrate = totalJogos > 0 ? ((vitorias / totalJogos) * 100).toFixed(0) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Carregando Sistema Equipe Cão...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-red-500">EQUIPE CÃO MTG</h1>
          <p className="text-xs text-gray-400">Dashboard de Performance & Matchups</p>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg transition"
            >
              Sair
            </button>
          </div>
        ) : (
          <button 
            onClick={handleGoogleLogin}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            Entrar com Google
          </button>
        )}
      </header>

      {/* Conteúdo Principal */}
      {user ? (
        <main className="max-w-6xl mx-auto mt-6 space-y-6">
          {/* Seletor de Decks */}
          <div className="bg-[#131b2e] p-4 rounded-xl border border-gray-800 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-400">Visualizar Estatísticas de:</span>
            {["Geral", "Mono Red Madness", "Red Rally", "Gruul Ramp"].map((deck) => (
              <button
                key={deck}
                onClick={() => setSelectedDeck(deck === "Geral" ? "Geral" : deck)}
                className={`text-xs px-3 py-1.5 rounded-lg transition ${
                  (selectedDeck === deck || (selectedDeck === "Geral" && deck === "Geral"))
                    ? "bg-red-600 text-white font-bold"
                    : "bg-[#1c263d] text-gray-400 hover:bg-gray-700"
                }`}
              >
                {deck === "Geral" ? "Geral (Todos os Decks)" : deck}
              </button>
            ))}
          </div>

          {/* Cards de Métricas & Botão de Registro */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131b2e] p-6 rounded-xl border border-gray-800">
            <div>
              <span className="text-xs font-semibold uppercase text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/50">
                Pauper ({selectedDeck})
              </span>
              <h2 className="text-2xl font-bold mt-1">Visão Geral dos Decks</h2>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2"
            >
              + Registrar Partida
            </button>
          </div>

          {/* Grid de Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400 font-medium">Winrate Geral do Jogador</p>
              <p className="text-3xl font-extrabold text-white mt-2">{winrate}%</p>
              <p className="text-xs text-gray-500 mt-1">{vitorias}V - {derrotas}D ({totalJogos} jogos)</p>
            </div>

            <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400 font-medium">Proporção de Vitórias</p>
              <div className="w-full bg-red-950/60 h-3 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-red-500 h-full transition-all duration-300"
                  style={{ width: `${winrate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Vitórias ({vitorias})</span>
                <span>Derrotas ({derrotas})</span>
              </div>
            </div>

            <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400 font-medium">Total de Registros</p>
              <p className="text-3xl font-extrabold text-white mt-2">{totalJogos}</p>
              <p className="text-xs text-gray-500 mt-1">Partidas salvas no banco</p>
            </div>
          </div>

          {/* Tabela de Historico */}
          <div className="bg-[#131b2e] rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-bold text-sm text-gray-200">Histórico de Matchups</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1c263d] text-gray-400 uppercase">
                  <tr>
                    <th className="p-3">Resultado</th>
                    <th className="p-3">Meu Deck</th>
                    <th className="p-3">Deck Adversário</th>
                    <th className="p-3">Oponente</th>
                    <th className="p-3">Placar</th>
                    <th className="p-3">Torneio</th>
                    <th className="p-3">Data</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {partidasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        Nenhuma partida registrada para este deck.
                      </td>
                    </tr>
                  ) : (
                    partidasFiltradas.map((p) => (
                      <tr key={p.id} className="hover:bg-[#182238] transition">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            p.resultado === "Vitória" 
                              ? "bg-green-950 text-green-400 border border-green-800/50" 
                              : "bg-red-950 text-red-400 border border-red-800/50"
                          }`}>
                            {p.resultado}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-gray-200">{p.meuDeck}</td>
                        <td className="p-3 text-gray-300">{p.deckAdversario}</td>
                        <td className="p-3 text-gray-400">{p.oponente || "-"}</td>
                        <td className="p-3 font-mono text-gray-300">{p.placar}</td>
                        <td className="p-3 text-gray-400">{p.torneio || "-"}</td>
                        <td className="p-3 text-gray-500">{p.data}</td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => handleDeleteMatch(p.id)}
                            className="text-red-400 hover:text-red-300 font-semibold"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        <div className="max-w-md mx-auto mt-20 text-center bg-[#131b2e] p-8 rounded-xl border border-gray-800">
          <h2 className="text-xl font-bold mb-2">Bem-vindo ao Dashboard</h2>
          <p className="text-sm text-gray-400 mb-6">
            Faça login com sua conta do Google para visualizar e registrar seus relatórios de partidas do time.
          </p>
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition"
          >
            Entrar com Google
          </button>
        </div>
      )}

      {/* Modal de Registro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131b2e] border border-gray-800 w-full max-w-md rounded-xl p-6 relative">
            <h3 className="text-lg font-bold mb-4">Registrar Nova Partida</h3>
            
            <form onSubmit={handleSubmitMatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Meu Deck</label>
                <select
                  value={meuDeck}
                  onChange={(e) => setMeuDeck(e.target.value)}
                  className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="Mono Red Madness">Mono Red Madness</option>
                  <option value="Red Rally">Red Rally</option>
                  <option value="Gruul Ramp">Gruul Ramp</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Deck Adversário</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jund Wildfire, Kuldotha Burn..."
                  value={deckAdversario}
                  onChange={(e) => setDeckAdversario(e.target.value)}
                  className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Nome do Oponente</label>
                  <input
                    type="text"
                    placeholder="Ex: Fernando"
                    value={oponente}
                    onChange={(e) => setOponente(e.target.value)}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Resultado</label>
                  <select
                    value={resultado}
                    onChange={(e) => {
                      setResultado(e.target.value);
                      if (e.target.value === "Vitória") setPlacar("2-0");
                      else setPlacar("0-2");
                    }}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Vitória">Vitória</option>
                    <option value="Derrota">Derrota</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Placar Exato</label>
                  <select
                    value={placar}
                    onChange={(e) => setPlacar(e.target.value)}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="2-0">2-0</option>
                    <option value="2-1">2-1</option>
                    <option value="1-2">1-2</option>
                    <option value="0-2">0-2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Torneio / Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: Mensal Agosto"
                    value={torneio}
                    onChange={(e) => setTorneio(e.target.value)}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition"
                >
                  Salvar Partida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
