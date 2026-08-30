import React, { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { auth, db } from "./firebase";

// =========================================================================
// 1. MAPEAMENTO E FUNÇÃO AUXILIAR (DECLARADOS FORA DO COMPONENTE)
// =========================================================================
const MAPA_JOGADORES = {
  "jhowrod2013": "Jonathan Rodrigues",
  "jhowrod2013@gmail.com": "Jonathan Rodrigues",
  "renatoigawa": "Renato Igawa",
  "renatoigawa@gmail.com": "Renato Igawa",
  "ncpf1985": "Nirmen", // Ajuste para o nome correto do Nirmen se for diferente
};

const getNomeJogador = (partida) => {
  // 1. Se o userName já estiver no mapa, retorna o nome correto
  if (partida.userName && MAPA_JOGADORES[partida.userName]) {
    return MAPA_JOGADORES[partida.userName];
  }
  
  // 2. Se tiver userName válido e não precisar de mapa, usa ele
  if (partida.userName && partida.userName.trim() !== "" && !partida.userName.includes("@")) {
    return partida.userName;
  }

  // 3. Tratamento pelo e-mail se for registro antigo
  if (partida.userEmail) {
    if (MAPA_JOGADORES[partida.userEmail]) {
      return MAPA_JOGADORES[partida.userEmail];
    }
    const nick = partida.userEmail.split('@')[0];
    if (MAPA_JOGADORES[nick]) {
      return MAPA_JOGADORES[nick];
    }
    // Fallback caso seja um e-mail novo
    return nick.charAt(0).toUpperCase() + nick.slice(1);
  }

  return "Jogador Desconhecido";
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState([]);

  // Filtros de Visualização
  const [selectedFormato, setSelectedFormato] = useState("Pauper");
  const [selectedPlayer, setSelectedPlayer] = useState("Todos");
  const [selectedDeck, setSelectedDeck] = useState("Geral");

  // Form states (Modal)
  const [formato, setFormato] = useState("Pauper");
  const [meuDeck, setMeuDeck] = useState("");
  const [companion, setCompanion] = useState("");
  const [deckAdversario, setDeckAdversario] = useState("");
  const [oponente, setOponente] = useState("");
  const [placar, setPlacar] = useState("2-0");
  const [resultado, setResultado] = useState("Vitória");
  const [torneio, setTorneio] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Observador de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Busca TODAS as partidas do time no Firestore
  useEffect(() => {
    const q = query(collection(db, "partidas"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPartidas(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar partidas:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert("Erro ao abrir login: " + error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSubmitMatch = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Você precisa estar autenticado para salvar.");
      return;
    }

    const nomeJogador = user.displayName || (user.email ? user.email.split('@')[0] : "Jogador");

    try {
      await addDoc(collection(db, "partidas"), {
        userId: user.uid,
        userName: nomeJogador,
        userEmail: user.email || "",
        formato: formato,
        meuDeck: meuDeck || "Sem Nome",
        companion: formato === "Duel 500" ? companion : "",
        deckAdversario: deckAdversario || "",
        oponente: oponente || "",
        placar: placar || "2-0",
        resultado: resultado || "Vitória",
        torneio: torneio || "",
        data: new Date().toISOString().split('T')[0]
      });

      setMeuDeck("");
      setCompanion("");
      setDeckAdversario("");
      setOponente("");
      setTorneio("");
      setIsModalOpen(false);
      alert("Partida registrada com sucesso!");
    } catch (error) {
      alert("Erro ao salvar partida: " + error.message);
    }
  };

  const handleDeleteMatch = async (id) => {
    try {
      await deleteDoc(doc(db, "partidas", id));
    } catch (error) {
      console.error("Erro ao deletar partida:", error);
    }
  };

  // --- FILTRAGEM DOS DADOS (ATUALIZADOS PARA USAR getNomeJogador) ---
  // 1. Extração Global de todos os Jogadores do Banco de Dados sem duplicatas
  const jogadoresCadastrados = Array.from(
    new Set(
      partidas
        .map(p => getNomeJogador(p))
        .filter(Boolean)
    )
  );

  // 2. Filtra por Formato
  const partidasDoFormato = partidas.filter(p => {
    const fmt = (p.formato === "Duel Commander") ? "Duel 500" : (p.formato || "Pauper");
    return fmt === selectedFormato;
  });

  // 3. Filtra por Jogador selecionado
  const partidasDoJogador = selectedPlayer === "Todos"
    ? partidasDoFormato
    : partidasDoFormato.filter(p => getNomeJogador(p) === selectedPlayer);

  // 4. Lista de Decks disponíveis para o jogador/formato selecionado
  const decksCadastrados = Array.from(new Set(partidasDoJogador.map(p => p.meuDeck).filter(Boolean)));

  // 5. Filtra por Deck selecionado
  const partidasFiltradas = selectedDeck === "Geral"
    ? partidasDoJogador
    : partidasDoJogador.filter(p => p.meuDeck === selectedDeck);

  // --- MÉTRICAS GERAIS ---
  const totalJogos = partidasFiltradas.length;
  const vitorias = partidasFiltradas.filter(p => p.resultado === "Vitória").length;
  const empates = partidasFiltradas.filter(p => p.resultado === "Empate").length;
  const derrotas = partidasFiltradas.filter(p => p.resultado === "Derrota").length;
  const winrate = totalJogos > 0 ? ((vitorias / totalJogos) * 100).toFixed(0) : 0;

  // --- CONSOLIDAÇÃO DE WINRATE POR DECK ---
  const statsPorDeck = decksCadastrados.map(deckName => {
    const partidasDoDeck = partidasDoJogador.filter(p => p.meuDeck === deckName);
    const total = partidasDoDeck.length;
    const v = partidasDoDeck.filter(p => p.resultado === "Vitória").length;
    const e = partidasDoDeck.filter(p => p.resultado === "Empate").length;
    const d = partidasDoDeck.filter(p => p.resultado === "Derrota").length;
    const wr = total > 0 ? ((v / total) * 100).toFixed(0) : 0;

    return { deckName, total, v, e, d, wr };
  }).sort((a, b) => b.total - a.total);

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
              <p className="text-sm font-medium">{user.displayName || "Jogador"}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg transition">
              Sair
            </button>
          </div>
        ) : (
          <button onClick={handleGoogleLogin} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            Entrar com Google
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto mt-6 space-y-6">
        {/* BARRA DE FILTROS GLOBAIS */}
        <div className="bg-[#131b2e] p-4 rounded-xl border border-gray-800 flex flex-wrap items-center justify-between gap-4">
          {/* Seletor de Formato */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Formato:</span>
            <button
              onClick={() => { setSelectedFormato("Pauper"); setSelectedDeck("Geral"); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition font-bold ${
                selectedFormato === "Pauper" ? "bg-red-600 text-white" : "bg-[#1c263d] text-gray-400"
              }`}
            >
              Pauper
            </button>
            <button
              onClick={() => { setSelectedFormato("Duel 500"); setSelectedDeck("Geral"); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition font-bold ${
                selectedFormato === "Duel 500" ? "bg-red-600 text-white" : "bg-[#1c263d] text-gray-400"
              }`}
            >
              Duel 500
            </button>
          </div>

          {/* Seletor de Jogador */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Jogador:</span>
            <select
              value={selectedPlayer}
              onChange={(e) => { setSelectedPlayer(e.target.value); setSelectedDeck("Geral"); }}
              className="bg-[#1c263d] text-xs border border-gray-700 rounded-lg p-1.5 text-white focus:outline-none focus:border-red-500"
            >
              <option value="Todos">Toda a Equipe</option>
              {jogadoresCadastrados.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {/* Seletor de Deck */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">
              {selectedFormato === "Duel 500" ? "Comandante:" : "Deck:"}
            </span>
            <select
              value={selectedDeck}
              onChange={(e) => setSelectedDeck(e.target.value)}
              className="bg-[#1c263d] text-xs border border-gray-700 rounded-lg p-1.5 text-white focus:outline-none focus:border-red-500"
            >
              <option value="Geral">Todos os Decks</option>
              {decksCadastrados.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* METRICAS E BOTAO REGISTRAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131b2e] p-6 rounded-xl border border-gray-800">
          <div>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold uppercase text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/50">
                {selectedFormato}
              </span>
              <span className="text-xs font-semibold uppercase text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-800/50">
                Jogador: {selectedPlayer}
              </span>
            </div>
            <h2 className="text-2xl font-bold mt-2">
              {selectedDeck === "Geral" ? `Relatório - ${selectedPlayer}` : selectedDeck}
            </h2>
          </div>

          {user && (
            <button
              onClick={() => { setFormato(selectedFormato); setIsModalOpen(true); }}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              + Registrar Partida
            </button>
          )}
        </div>

        {/* CARDS DE STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
            <p className="text-xs text-gray-400 font-medium">Winrate ({selectedPlayer})</p>
            <p className="text-3xl font-extrabold text-white mt-2">{winrate}%</p>
            <p className="text-xs text-gray-500 mt-1">{vitorias}V - {empates}E - {derrotas}D ({totalJogos} jogos)</p>
          </div>

          <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
            <p className="text-xs text-gray-400 font-medium">Proporção de Resultados</p>
            <div className="w-full bg-red-950/60 h-3 rounded-full mt-4 overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${totalJogos > 0 ? (vitorias / totalJogos) * 100 : 0}%` }} />
              <div className="bg-yellow-500 h-full" style={{ width: `${totalJogos > 0 ? (empates / totalJogos) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span className="text-green-400">Vitórias ({vitorias})</span>
              <span className="text-yellow-400">Empates ({empates})</span>
              <span className="text-red-400">Derrotas ({derrotas})</span>
            </div>
          </div>

          <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
            <p className="text-xs text-gray-400 font-medium">Total de Registros Exibidos</p>
            <p className="text-3xl font-extrabold text-white mt-2">{totalJogos}</p>
            <p className="text-xs text-gray-500 mt-1">Filtrados no banco de dados</p>
          </div>
        </div>

        {/* TABELA DE WINRATE AGREGADA POR DECK */}
        <div className="bg-[#131b2e] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="font-bold text-sm text-gray-200">
              Desempenho por {selectedFormato === "Duel 500" ? "Comandante" : "Deck"} ({selectedPlayer})
            </h3>
            <span className="text-xs text-gray-500">Métricas consolidadas em {selectedFormato}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1c263d] text-gray-400 uppercase">
                <tr>
                  <th className="p-3">{selectedFormato === "Duel 500" ? "Comandante" : "Deck"}</th>
                  <th className="p-3">Jogos Totais</th>
                  <th className="p-3">Retrospecto (V-E-D)</th>
                  <th className="p-3">Winrate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {statsPorDeck.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-gray-500">
                      Nenhum registro encontrado para {selectedPlayer} em {selectedFormato}.
                    </td>
                  </tr>
                ) : (
                  statsPorDeck.map((item) => (
                    <tr key={item.deckName} className="hover:bg-[#182238] transition">
                      <td className="p-3 font-semibold text-gray-200">{item.deckName}</td>
                      <td className="p-3 text-gray-300">{item.total}</td>
                      <td className="p-3 text-gray-400">{item.v}V - {item.e}E - {item.d}D</td>
                      <td className="p-3">
                        <span className={`font-bold ${Number(item.wr) >= 50 ? "text-green-400" : "text-red-400"}`}>
                          {item.wr}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTÓRICO COMPLETO DE MATCHUPS */}
        <div className="bg-[#131b2e] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="font-bold text-sm text-gray-200">Histórico Detalhado de Partidas</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1c263d] text-gray-400 uppercase">
                <tr>
                  <th className="p-3">Jogador</th>
                  <th className="p-3">Resultado</th>
                  <th className="p-3">{selectedFormato === "Duel 500" ? "Meu Comandante" : "Meu Deck"}</th>
                  <th className="p-3">Oponente</th>
                  <th className="p-3">Deck Oponente</th>
                  <th className="p-3">Placar</th>
                  <th className="p-3">Torneio</th>
                  <th className="p-3">Data</th>
                  {user && <th className="p-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {partidasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-gray-500">
                      Nenhuma partida encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  partidasFiltradas.map((p) => (
                    <tr key={p.id} className="hover:bg-[#182238] transition">
                      {/* ATUALIZADO AQUI PARA USAR getNomeJogador */}
                      <td className="p-3 font-semibold text-red-400">
                        {getNomeJogador(p)}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          p.resultado === "Vitória" 
                            ? "bg-green-950 text-green-400 border border-green-800/50" 
                            : p.resultado === "Empate"
                            ? "bg-yellow-950 text-yellow-400 border border-yellow-800/50"
                            : "bg-red-950 text-red-400 border border-red-800/50"
                        }`}>
                          {p.resultado}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-200">
                        {p.meuDeck}
                        {p.companion && (
                          <span className="block text-[10px] text-purple-400 font-normal">
                            + {p.companion} (Companion)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-400">{p.oponente || "-"}</td>
                      <td className="p-3 text-gray-300">{p.deckAdversario}</td>
                      <td className="p-3 font-mono text-gray-300">{p.placar}</td>
                      <td className="p-3 text-gray-400">{p.torneio || "-"}</td>
                      <td className="p-3 text-gray-500">{p.data}</td>
                      {user && (
                        <td className="p-3 text-right">
                          {p.userId === user.uid && (
                            <button 
                              onClick={() => handleDeleteMatch(p.id)}
                              className="text-red-400 hover:text-red-300 font-semibold"
                            >
                              Excluir
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL DE REGISTRO DE PARTIDA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131b2e] border border-gray-800 w-full max-w-md rounded-xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Registrar Nova Partida</h3>
            
            <form onSubmit={handleSubmitMatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Formato</label>
                  <select
                    value={formato}
                    onChange={(e) => {
                      const newFormato = e.target.value;
                      setFormato(newFormato);
                      if (newFormato !== "Duel 500") setCompanion("");
                    }}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Pauper">Pauper</option>
                    <option value="Duel 500">Duel 500</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">
                    {formato === "Duel 500" ? "Meu Comandante" : "Meu Deck"}
                  </label>
                  <input
                    type="text"
                    required
                    list="modal-decks-sugeridos"
                    placeholder={formato === "Duel 500" ? "Ex: Kellan, Planar Trailblazer" : "Ex: Mono Red Burn"}
                    value={meuDeck}
                    onChange={(e) => setMeuDeck(e.target.value)}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  />
                  <datalist id="modal-decks-sugeridos">
                    {decksCadastrados.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* CAMPO DE COMPANION EXCLUSIVO PARA DUEL 500 */}
              {formato === "Duel 500" && (
                <div>
                  <label className="block text-purple-400 font-semibold mb-1">
                    Companion <span className="text-gray-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Lurrus, Obosh, Jegantha..."
                    value={companion}
                    onChange={(e) => setCompanion(e.target.value)}
                    className="w-full bg-[#1c263d] border border-purple-800/60 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-400 mb-1">
                  {formato === "Duel 500" ? "Comandante do Oponente" : "Deck Adversário"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={formato === "Duel 500" ? "Ex: Feldon, Rona, etc." : "Ex: Grixis Affinity, Burn..."}
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
                      const res = e.target.value;
                      setResultado(res);
                      if (res === "Vitória") setPlacar("2-0");
                      else if (res === "Empate") setPlacar("1-1");
                      else setPlacar("0-2");
                    }}
                    className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Vitória">Vitória</option>
                    <option value="Empate">Empate</option>
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
                    <option value="1-1">1-1</option>
                    <option value="1-1-1">1-1-1</option>
                    <option value="0-0">0-0</option>
                    <option value="1-2">1-2</option>
                    <option value="0-2">0-2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Torneio / Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: Semanal Duel 500"
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
