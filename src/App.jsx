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
  updateDoc,
  query, 
  onSnapshot, 
  deleteDoc, 
  doc,
  getDocs,
  where
} from "firebase/firestore";
import { auth, db } from "./firebase";

// =========================================================================
// 0. LINK DO GOOGLE DRIVE
// =========================================================================
const LINK_DRIVE_GUIDES = "https://drive.google.com/drive/folders/13dCumB0jtuRjgRoZbQdMbA-foo6LAjmC?usp=sharing";

// EMAIL DO ADMINISTRADOR (SÓ VOCÊ VERÁ A ABA ADMIN)
const ADMIN_EMAIL = "jhowrod2013@gmail.com";

// =========================================================================
// 1. MAPEAMENTO DE JOGADORES
// =========================================================================
const MAPA_JOGADORES = {
  "jhowrod2013": "Jonathan Rodrigues",
  "jhowrod2013@gmail.com": "Jonathan Rodrigues",
  "Jonathan Rodrigues": "Jonathan Rodrigues",

  "renatoigawa": "Renato Igawa",
  "renatoigawa@gmail.com": "Renato Igawa",
  "Renato": "Renato Igawa",
  "Renato Igawa": "Renato Igawa",

  "ncpf1985": "Nirmen",
  "Nirmen": "Nirmen",
  "nirmen": "Nirmen",

  "André Vitor SalinasPereira": "André Vitor Salinas Pereira",
  "Dener Ulian": "Dener Ulian"
};

const getNomeJogador = (partida) => {
  const userName = partida.userName ? partida.userName.trim() : "";
  const userEmail = partida.userEmail ? partida.userEmail.trim() : "";

  if (userName && MAPA_JOGADORES[userName]) return MAPA_JOGADORES[userName];
  if (userEmail && MAPA_JOGADORES[userEmail]) return MAPA_JOGADORES[userEmail];
  if (userName !== "" && !userName.includes("@")) return userName;

  if (userEmail) {
    const nick = userEmail.split('@')[0];
    if (MAPA_JOGADORES[nick]) return MAPA_JOGADORES[nick];
    return nick.charAt(0).toUpperCase() + nick.slice(1);
  }

  return "Jogador Desconhecido";
};

// Algoritmo de emparelhamento Suíço
const gerarRodadaSuico = (jogadores, historicoConfrontos) => {
  const ordenados = [...jogadores].sort((a, b) => b.pontos - a.pontos);
  const emparamentos = [];
  const copia = [...ordenados];

  if (copia.length % 2 !== 0) {
    const byeIdx = copia.findLastIndex(j => !j.teveBye);
    const jBye = byeIdx !== -1 ? copia.splice(byeIdx, 1)[0] : copia.pop();
    jBye.teveBye = true;
    emparamentos.push({ p1: jBye, p2: null, placarP1: 2, placarP2: 0, status: "BYE" });
  }

  while (copia.length > 0) {
    const p1 = copia.shift();
    let p2Idx = 0;

    while (p2Idx < copia.length) {
      const candidato = copia[p2Idx];
      const jaJogaram = historicoConfrontos.some(
        h => (h.p1 === p1.nome && h.p2 === candidato.nome) || (h.p1 === candidato.nome && h.p2 === p1.nome)
      );
      if (!jaJogaram) break;
      p2Idx++;
    }

    if (p2Idx >= copia.length) p2Idx = 0;

    const p2 = copia.splice(p2Idx, 1)[0];
    emparamentos.push({ p1, p2, placarP1: 0, placarP2: 0, status: "Pendente" });
  }

  return emparamentos;
};

// =========================================================================
// COMPONENTE PRINCIPAL
// =========================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'torneios' | 'admin'

  // Filtros de Visualização Dashboard
  const [selectedFormato, setSelectedFormato] = useState("Pauper");
  const [selectedPlayer, setSelectedPlayer] = useState("Todos");
  const [selectedDeck, setSelectedDeck] = useState("Geral");

  // Form states (Modal Dashboard)
  const [editingId, setEditingId] = useState(null);
  const [formato, setFormato] = useState("Pauper");
  const [meuDeck, setMeuDeck] = useState("");
  const [companion, setCompanion] = useState("");
  const [deckAdversario, setDeckAdversario] = useState("");
  const [oponente, setOponente] = useState("");
  const [placar, setPlacar] = useState("2-0");
  const [resultado, setResultado] = useState("Vitória");
  const [torneio, setTorneio] = useState("");
  const [dataPartida, setDataPartida] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- ESTADOS DO MÓDULO DE TORNEIOS ---
  const [nomeTorneio, setNomeTorneio] = useState("");
  const [formatoTorneio, setFormatoTorneio] = useState("Pauper");
  const [jogadoresTorneio, setJogadoresTorneio] = useState([]);
  const [novoJogadorNome, setNovoJogadorNome] = useState("");
  const [novoJogadorDeck, setNovoJogadorDeck] = useState("");
  const [rodadaAtual, setRodadaAtual] = useState(0);
  const [rodadas, setRodadas] = useState([]); 
  const [historicoConfrontos, setHistoricoConfrontos] = useState([]);
  const [torneioAtivo, setTorneioAtivo] = useState(null);

  // Observador de Autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Busca TODAS as partidas no Firestore
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

  const resetForm = () => {
    setEditingId(null);
    setFormato(selectedFormato);
    setMeuDeck("");
    setCompanion("");
    setDeckAdversario("");
    setOponente("");
    setPlacar("2-0");
    setResultado("Vitória");
    setTorneio("");
    setDataPartida(new Date().toISOString().split('T')[0]);
  };

  const handleEditMatch = (p) => {
    setEditingId(p.id);
    setFormato(p.formato || "Pauper");
    setMeuDeck(p.meuDeck || "");
    setCompanion(p.companion || "");
    setDeckAdversario(p.deckAdversario || "");
    setOponente(p.oponente || "");
    setPlacar(p.placar || "2-0");
    setResultado(p.resultado || "Vitória");
    setTorneio(p.torneio || "");
    setDataPartida(p.data || new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSubmitMatch = async (e) => {
    e.preventDefault();
    if (!user) {
      alert("Você precisa estar autenticado para salvar.");
      return;
    }

    const payload = {
      formato: formato,
      meuDeck: meuDeck ? meuDeck.trim() : "Sem Nome",
      companion: formato === "Duel 500" ? companion.trim() : "",
      deckAdversario: deckAdversario ? deckAdversario.trim() : "",
      oponente: oponente ? oponente.trim() : "",
      placar: placar || "2-0",
      resultado: resultado || "Vitória",
      torneio: torneio ? torneio.trim() : "",
      data: dataPartida || new Date().toISOString().split('T')[0]
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "partidas", editingId), payload);
        alert("Partida atualizada com sucesso!");
      } else {
        const nomeJogador = user.displayName || (user.email ? user.email.split('@')[0] : "Jogador");
        await addDoc(collection(db, "partidas"), {
          ...payload,
          userId: user.uid,
          userName: nomeJogador,
          userEmail: user.email || ""
        });
        alert("Partida registrada com sucesso!");
      }
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      alert("Erro ao salvar partida: " + error.message);
    }
  };

  const handleDeleteMatch = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta partida?")) {
      try {
        await deleteDoc(doc(db, "partidas", id));
      } catch (error) {
        console.error("Erro ao deletar partida:", error);
      }
    }
  };

  // --- RECURSO: DELETAR TODAS AS PARTIDAS DE UM TORNEIO COMPLETO (EXCLUSIVO ADMIN) ---
  const handleDeletarTorneioInteiro = async (nomeTorneioParaDeletar) => {
    if (!window.confirm(`ATENÇÃO: Deseja EXCLUIR TODAS as partidas cadastradas do torneio "${nomeTorneioParaDeletar}"? Esta ação é irreversível.`)) return;

    try {
      const q = query(collection(db, "partidas"), where("torneio", "==", nomeTorneioParaDeletar));
      const querySnapshot = await getDocs(q);
      
      const promises = [];
      querySnapshot.forEach((documento) => {
        promises.push(deleteDoc(doc(db, "partidas", documento.id)));
      });

      await Promise.all(promises);
      alert(`Todas as partidas do torneio "${nomeTorneioParaDeletar}" foram excluídas!`);
    } catch (err) {
      alert("Erro ao deletar torneio: " + err.message);
    }
  };

  // --- FUNÇÕES DO MÓDULO DE TORNEIO ---
  const handleAdicionarJogadorTorneio = () => {
    if (!novoJogadorNome.trim()) {
      alert("Informe pelo menos o nome do jogador!");
      return;
    }

    // Deck/Comandante agora é OPCIONAL
    const deckFinal = novoJogadorDeck.trim() || "Não Informado";

    setJogadoresTorneio([
      ...jogadoresTorneio, 
      { id: Date.now(), nome: novoJogadorNome.trim(), deck: deckFinal, pontos: 0, teveBye: false }
    ]);
    setNovoJogadorNome("");
    setNovoJogadorDeck("");
  };

  const handleRemoverJogadorTorneio = (id) => {
    setJogadoresTorneio(jogadoresTorneio.filter(j => j.id !== id));
  };

  const handleIniciarTorneio = () => {
    if (jogadoresTorneio.length < 2) {
      alert("É necessário pelo menos 2 jogadores para iniciar o torneio.");
      return;
    }
    const nomeFinal = nomeTorneio.trim() || `Torneio ${formatoTorneio} ${new Date().toLocaleDateString('pt-BR')}`;
    const primeiraRodada = gerarRodadaSuico(jogadoresTorneio, []);
    
    setTorneioAtivo({ nome: nomeFinal, formato: formatoTorneio, data: new Date().toISOString().split('T')[0] });
    setRodadas([primeiraRodada]);
    setRodadaAtual(1);
  };

  const handleAtualizarPlacarMatch = (rodadaIdx, matchIdx, p1G, p2G) => {
    const novasRodadas = [...rodadas];
    const m = novasRodadas[rodadaIdx][matchIdx];
    m.placarP1 = p1G;
    m.placarP2 = p2G;
    m.status = "Concluído";
    setRodadas(novasRodadas);

    recalcularPontuacaoGeral(novasRodadas);
  };

  const recalcularPontuacaoGeral = (todasRodadas) => {
    const novosJogadores = jogadoresTorneio.map(j => ({ ...j, pontos: 0 }));

    todasRodadas.forEach(rodada => {
      rodada.forEach(m => {
        if (m.status === "Concluído" || !m.p2) {
          if (!m.p2) {
            const j = novosJogadores.find(x => x.nome === m.p1.nome);
            if (j) j.pontos += 3;
          } else {
            const j1 = novosJogadores.find(x => x.nome === m.p1.nome);
            const j2 = novosJogadores.find(x => x.nome === m.p2.nome);

            if (m.placarP1 > m.placarP2) {
              if (j1) j1.pontos += 3;
            } else if (m.placarP2 > m.placarP1) {
              if (j2) j2.pontos += 3;
            } else if (m.placarP1 === m.placarP2 && m.placarP1 > 0) {
              if (j1) j1.pontos += 1;
              if (j2) j2.pontos += 1;
            }
          }
        }
      });
    });

    setJogadoresTorneio(novosJogadores);
  };

  const handleProximaRodada = () => {
    const rodadaAtualMatches = rodadas[rodadaAtual - 1];
    const pendentes = rodadaAtualMatches.some(m => m.p2 && m.status !== "Concluído");
    
    if (pendentes) {
      alert("Ainda existem partidas pendentes nesta rodada!");
      return;
    }

    const novoHist = [...historicoConfrontos];
    rodadaAtualMatches.forEach(m => {
      if (m.p2) novoHist.push({ p1: m.p1.nome, p2: m.p2.nome });
    });
    setHistoricoConfrontos(novoHist);

    const proxima = gerarRodadaSuico(jogadoresTorneio, novoHist);
    setRodadas([...rodadas, proxima]);
    setRodadaAtual(rodadaAtual + 1);
  };

  const handleEncerrarEExportarTorneio = async () => {
    if (!window.confirm("Deseja encerrar o torneio e enviar todas as partidas para o banco de dados do Dashboard?")) return;

    try {
      for (let rIdx = 0; rIdx < rodadas.length; rIdx++) {
        const matches = rodadas[rIdx];
        for (let m of matches) {
          if (!m.p2) continue;

          let resP1 = "Empate";
          if (m.placarP1 > m.placarP2) resP1 = "Vitória";
          else if (m.placarP2 > m.placarP1) resP1 = "Derrota";

          await addDoc(collection(db, "partidas"), {
            formato: torneioAtivo.formato,
            meuDeck: m.p1.deck,
            deckAdversario: m.p2.deck,
            oponente: m.p2.nome,
            placar: `${m.placarP1}-${m.placarP2}`,
            resultado: resP1,
            torneio: torneioAtivo.nome,
            data: torneioAtivo.data,
            userId: user ? user.uid : "torneio-auto",
            userName: m.p1.nome,
            userEmail: ""
          });

          let resP2 = "Empate";
          if (m.placarP2 > m.placarP1) resP2 = "Vitória";
          else if (m.placarP1 > m.placarP2) resP2 = "Derrota";

          await addDoc(collection(db, "partidas"), {
            formato: torneioAtivo.formato,
            meuDeck: m.p2.deck,
            deckAdversario: m.p1.deck,
            oponente: m.p1.nome,
            placar: `${m.placarP2}-${m.placarP1}`,
            resultado: resP2,
            torneio: torneioAtivo.nome,
            data: torneioAtivo.data,
            userId: user ? user.uid : "torneio-auto",
            userName: m.p2.nome,
            userEmail: ""
          });
        }
      }

      alert("Torneio finalizado com sucesso! As partidas foram registradas no Dashboard.");
      setTorneioAtivo(null);
      setRodadas([]);
      setRodadaAtual(0);
      setJogadoresTorneio([]);
      setHistoricoConfrontos([]);
      setActiveTab("dashboard");
    } catch (err) {
      alert("Erro ao exportar torneio: " + err.message);
    }
  };

  // VERIFICAÇÃO SE O USUÁRIO LOGADO É O ADMIN
  const isAdmin = user && (user.email === ADMIN_EMAIL || user.displayName === "Jonathan Rodrigues");

  // --- FILTRAGEM DOS DADOS DASHBOARD ---
  const jogadoresCadastrados = Array.from(
    new Set(partidas.map(p => getNomeJogador(p)).filter(Boolean))
  ).sort();

  const torneiosCadastrados = Array.from(
    new Set(partidas.map(p => p.torneio ? p.torneio.trim() : "").filter(Boolean))
  ).sort();

  const partidasDoFormato = partidas.filter(p => {
    const fmt = (p.formato === "Duel Commander") ? "Duel 500" : (p.formato || "Pauper");
    return fmt === selectedFormato;
  });

  const partidasDoJogador = selectedPlayer === "Todos"
    ? partidasDoFormato
    : partidasDoFormato.filter(p => getNomeJogador(p) === selectedPlayer);

  const decksCadastrados = Array.from(
    new Set(partidasDoJogador.map(p => p.meuDeck ? p.meuDeck.trim() : "").filter(Boolean))
  ).sort();

  const partidasFiltradas = selectedDeck === "Geral"
    ? partidasDoJogador
    : partidasDoJogador.filter(p => p.meuDeck && p.meuDeck.trim().toLowerCase() === selectedDeck.toLowerCase());

  const partidasOrdenadas = [...partidasFiltradas].sort((a, b) => {
    const stringDataA = a.data ? String(a.data).trim() : "";
    const stringDataB = b.data ? String(b.data).trim() : "";
    if (stringDataA !== stringDataB) return stringDataB.localeCompare(stringDataA);
    return getNomeJogador(a).localeCompare(getNomeJogador(b));
  });

  const totalJogos = partidasFiltradas.length;
  const vitorias = partidasFiltradas.filter(p => p.resultado === "Vitória").length;
  const empates = partidasFiltradas.filter(p => p.resultado === "Empate").length;
  const derrotas = partidasFiltradas.filter(p => p.resultado === "Derrota").length;
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
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-red-500">EQUIPE CÃO MTG</h1>
          <p className="text-xs text-gray-400">Dashboard de Performance & Torneios</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <a
            href={LINK_DRIVE_GUIDES}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#1c263d] hover:bg-[#253352] text-blue-400 border border-blue-900/50 text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            📁 Guides do Time
          </a>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-300 hidden sm:inline">{user.displayName}</span>
              <button onClick={handleLogout} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg transition">Sair</button>
            </div>
          ) : (
            <button onClick={handleGoogleLogin} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">Entrar com Google</button>
          )}
        </div>
      </header>

      {/* NAVEGAÇÃO DE ABAS */}
      <nav className="max-w-6xl mx-auto mt-4 flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === "dashboard" ? "bg-red-600 text-white" : "bg-[#131b2e] text-gray-400 hover:text-white"
          }`}
        >
          📊 Dashboard & Reports
        </button>
        <button
          onClick={() => setActiveTab("torneios")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === "torneios" ? "bg-red-600 text-white" : "bg-[#131b2e] text-gray-400 hover:text-white"
          }`}
        >
          ⚔️ Módulo de Torneio (Swiss)
        </button>

        {/* ABA EXCLUSIVA DO ADMINISTRADOR */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab("admin")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "admin" ? "bg-purple-600 text-white" : "bg-[#131b2e] text-gray-400 hover:text-white"
            }`}
          >
            ⚙️ Admin (Apagar Testes)
          </button>
        )}
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-6xl mx-auto mt-6 space-y-6">
        {activeTab === "dashboard" && (
          <>
            <div className="bg-[#131b2e] p-4 rounded-xl border border-gray-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Formato:</span>
                <button
                  onClick={() => { setSelectedFormato("Pauper"); setSelectedDeck("Geral"); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold ${selectedFormato === "Pauper" ? "bg-red-600 text-white" : "bg-[#1c263d] text-gray-400"}`}
                >Pauper</button>
                <button
                  onClick={() => { setSelectedFormato("Duel 500"); setSelectedDeck("Geral"); }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold ${selectedFormato === "Duel 500" ? "bg-red-600 text-white" : "bg-[#1c263d] text-gray-400"}`}
                >Duel 500</button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Jogador:</span>
                <select
                  value={selectedPlayer}
                  onChange={(e) => { setSelectedPlayer(e.target.value); setSelectedDeck("Geral"); }}
                  className="bg-[#1c263d] text-xs border border-gray-700 rounded-lg p-1.5 text-white"
                >
                  <option value="Todos">Toda a Equipe</option>
                  {jogadoresCadastrados.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">{selectedFormato === "Duel 500" ? "Comandante:" : "Deck:"}</span>
                <select
                  value={selectedDeck}
                  onChange={(e) => setSelectedDeck(e.target.value)}
                  className="bg-[#1c263d] text-xs border border-gray-700 rounded-lg p-1.5 text-white"
                >
                  <option value="Geral">Todos os Decks</option>
                  {decksCadastrados.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#131b2e] p-6 rounded-xl border border-gray-800">
              <div>
                <h2 className="text-2xl font-bold mt-2">{selectedDeck === "Geral" ? `Relatório - ${selectedPlayer}` : selectedDeck}</h2>
              </div>
              {user && (
                <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl">
                  + Registrar Partida
                </button>
              )}
            </div>

            {/* STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400 font-medium">Winrate ({selectedPlayer})</p>
                <p className="text-3xl font-extrabold text-white mt-2">{winrate}%</p>
                <p className="text-xs text-gray-500 mt-1">{vitorias}V - {empates}E - {derrotas}D ({totalJogos} jogos)</p>
              </div>
              <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400 font-medium">Proporção</p>
                <div className="w-full bg-red-950/60 h-3 rounded-full mt-4 overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${totalJogos > 0 ? (vitorias / totalJogos) * 100 : 0}%` }} />
                  <div className="bg-yellow-500 h-full" style={{ width: `${totalJogos > 0 ? (empates / totalJogos) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="bg-[#131b2e] p-5 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400 font-medium">Total de Registros</p>
                <p className="text-3xl font-extrabold text-white mt-2">{totalJogos}</p>
              </div>
            </div>

            {/* TABELA MATCHUPS */}
            <div className="bg-[#131b2e] rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800"><h3 className="font-bold text-sm text-gray-200">Histórico de Partidas</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1c263d] text-gray-400 uppercase">
                    <tr>
                      <th className="p-3">Jogador</th>
                      <th className="p-3">Resultado</th>
                      <th className="p-3">Meu Deck</th>
                      <th className="p-3">Oponente</th>
                      <th className="p-3">Deck Oponente</th>
                      <th className="p-3">Placar</th>
                      <th className="p-3">Torneio</th>
                      <th className="p-3">Data</th>
                      {user && <th className="p-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {partidasOrdenadas.map((p) => (
                      <tr key={p.id} className="hover:bg-[#182238]">
                        <td className="p-3 font-semibold text-red-400">{getNomeJogador(p)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${p.resultado === "Vitória" ? "bg-green-950 text-green-400" : p.resultado === "Empate" ? "bg-yellow-950 text-yellow-400" : "bg-red-950 text-red-400"}`}>
                            {p.resultado}
                          </span>
                        </td>
                        <td className="p-3">{p.meuDeck}</td>
                        <td className="p-3 text-gray-400">{p.oponente || "-"}</td>
                        <td className="p-3 text-gray-300">{p.deckAdversario}</td>
                        <td className="p-3 font-mono">{p.placar}</td>
                        <td className="p-3 text-gray-400">{p.torneio || "-"}</td>
                        <td className="p-3 text-gray-500">{p.data}</td>
                        {user && (
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleEditMatch(p)} className="text-blue-400 hover:underline">Editar</button>
                              <button onClick={() => handleDeleteMatch(p.id)} className="text-red-400 hover:underline">Excluir</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ABA MÓDULO DE TORNEIOS (SWISS) */}
        {activeTab === "torneios" && (
          <div className="space-y-6">
            {!torneioAtivo ? (
              <div className="bg-[#131b2e] p-6 rounded-xl border border-gray-800 space-y-6">
                <h2 className="text-xl font-bold text-red-500">🏆 Iniciar Novo Torneio do Time</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nome do Torneio</label>
                    <input
                      type="text"
                      placeholder="Ex: Semanal Duel 500 #01"
                      value={nomeTorneio}
                      onChange={(e) => setNomeTorneio(e.target.value)}
                      className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Formato</label>
                    <select
                      value={formatoTorneio}
                      onChange={(e) => setFormatoTorneio(e.target.value)}
                      className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="Pauper">Pauper</option>
                      <option value="Duel 500">Duel 500</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">Inscrição de Jogadores</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome do Jogador"
                      value={novoJogadorNome}
                      onChange={(e) => setNovoJogadorNome(e.target.value)}
                      className="bg-[#1c263d] border border-gray-700 rounded-lg p-2 text-xs text-white flex-1"
                    />
                    <input
                      type="text"
                      placeholder={formatoTorneio === "Duel 500" ? "Comandante (Opcional)" : "Deck (Opcional)"}
                      value={novoJogadorDeck}
                      onChange={(e) => setNovoJogadorDeck(e.target.value)}
                      className="bg-[#1c263d] border border-gray-700 rounded-lg p-2 text-xs text-white flex-1"
                    />
                    <button onClick={handleAdicionarJogadorTorneio} className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 rounded-lg font-bold">
                      + Adicionar
                    </button>
                  </div>

                  <div className="bg-[#1c263d] p-3 rounded-lg max-h-48 overflow-y-auto space-y-2">
                    {jogadoresTorneio.length === 0 ? (
                      <p className="text-xs text-gray-500">Nenhum jogador inscrito até o momento.</p>
                    ) : (
                      jogadoresTorneio.map((j) => (
                        <div key={j.id} className="flex justify-between items-center text-xs bg-[#131b2e] p-2 rounded border border-gray-800">
                          <span><strong className="text-red-400">{j.nome}</strong> ({j.deck})</span>
                          <button onClick={() => handleRemoverJogadorTorneio(j.id)} className="text-red-500 font-bold hover:underline">Remover</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button onClick={handleIniciarTorneio} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition">
                  🚀 Gerar Rodada 1 e Startar Torneio
                </button>
              </div>
            ) : (
              /* PAINEL DE RODADAS */
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-[#131b2e] p-4 rounded-xl border border-gray-800">
                  <div>
                    <h2 className="text-xl font-bold text-red-500">{torneioAtivo.nome}</h2>
                    <p className="text-xs text-gray-400">Rodada Atual: <strong className="text-white">{rodadaAtual}</strong> | Formato: {torneioAtivo.formato}</p>
                  </div>
                  <button onClick={handleEncerrarEExportarTorneio} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-lg">
                    🏁 Encerrar & Enviar p/ Dashboard
                  </button>
                </div>

                <div className="space-y-6">
                  {rodadas.map((matches, rIdx) => (
                    <div key={rIdx} className={`p-4 rounded-xl border ${rIdx + 1 === rodadaAtual ? "bg-[#131b2e] border-red-500/50" : "bg-[#0f1626] border-gray-800 opacity-90"}`}>
                      <h3 className="font-bold text-sm text-gray-200 mb-3 flex items-center justify-between">
                        <span>Rodada {rIdx + 1} {rIdx + 1 === rodadaAtual && <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded ml-2">Em andamento</span>}</span>
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {matches.map((match, mIdx) => (
                          <div key={mIdx} className="bg-[#1c263d] p-4 rounded-lg border border-gray-700 space-y-3">
                            {!match.p2 ? (
                              <p className="text-xs font-bold text-yellow-400">🎉 {match.p1.nome} ({match.p1.deck}) recebeu BYE (Vitória 2-0)</p>
                            ) : (
                              <>
                                <div className="flex justify-between items-center text-xs font-semibold">
                                  <span className="text-red-400">{match.p1.nome} <span className="text-gray-500 text-[10px]">({match.p1.deck})</span></span>
                                  <span className="text-gray-400">VS</span>
                                  <span className="text-blue-400">{match.p2.nome} <span className="text-gray-500 text-[10px]">({match.p2.deck})</span></span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                                  <span className="text-[10px] text-gray-400">Placar:</span>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="0" max="2"
                                      value={match.placarP1}
                                      onChange={(e) => handleAtualizarPlacarMatch(rIdx, mIdx, parseInt(e.target.value) || 0, match.placarP2)}
                                      className="w-12 bg-[#131b2e] text-center border border-gray-600 rounded p-1 text-sm font-mono"
                                    />
                                    <span className="text-gray-400 font-bold">-</span>
                                    <input
                                      type="number"
                                      min="0" max="2"
                                      value={match.placarP2}
                                      onChange={(e) => handleAtualizarPlacarMatch(rIdx, mIdx, match.placarP1, parseInt(e.target.value) || 0)}
                                      className="w-12 bg-[#131b2e] text-center border border-gray-600 rounded p-1 text-sm font-mono"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={handleProximaRodada} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg">
                    Próxima Rodada ➔
                  </button>
                </div>

                <div className="bg-[#131b2e] rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-3 border-b border-gray-800"><h3 className="font-bold text-xs text-gray-200">Classificação Parcial</h3></div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1c263d] text-gray-400 uppercase">
                      <tr>
                        <th className="p-2">Pos</th>
                        <th className="p-2">Jogador</th>
                        <th className="p-2">Deck</th>
                        <th className="p-2">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {[...jogadoresTorneio].sort((a,b) => b.pontos - a.pontos).map((j, idx) => (
                        <tr key={j.id}>
                          <td className="p-2 font-bold">{idx + 1}º</td>
                          <td className="p-2 font-semibold text-red-400">{j.nome}</td>
                          <td className="p-2 text-gray-300">{j.deck}</td>
                          <td className="p-2 font-bold text-green-400">{j.pontos} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA EXCLUSIVA DE ADMIN (SÓ VOCÊ PODE VER) */}
        {activeTab === "admin" && isAdmin && (
          <div className="bg-[#131b2e] p-6 rounded-xl border border-purple-900/50 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-purple-400">⚙️ Painel de Administração</h2>
              <p className="text-xs text-gray-400">Esta página é visível exclusivamente para você ({user.email}).</p>
            </div>

            <div className="border-t border-gray-800 pt-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-300">🗑️ Excluir Partidas Fictícias de Torneios</h3>
              
              {torneiosCadastrados.length === 0 ? (
                <p className="text-xs text-gray-500">Nenhum torneio cadastrado encontrado no banco de dados.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {torneiosCadastrados.map(tNome => (
                    <div key={tNome} className="flex items-center justify-between bg-[#1c263d] p-3 rounded-lg border border-gray-700 text-xs">
                      <span className="font-semibold text-gray-200">{tNome}</span>
                      <button 
                        onClick={() => handleDeletarTorneioInteiro(tNome)} 
                        className="bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 px-2.5 py-1 rounded text-[11px] font-bold transition"
                      >
                        🗑️ Apagar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL PADRÃO DE REGISTRO/EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#131b2e] border border-gray-800 w-full max-w-md rounded-xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editingId ? "Editar Partida" : "Registrar Nova Partida"}</h3>
            <form onSubmit={handleSubmitMatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Formato</label>
                  <select value={formato} onChange={(e) => setFormato(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white">
                    <option value="Pauper">Pauper</option>
                    <option value="Duel 500">Duel 500</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">{formato === "Duel 500" ? "Meu Comandante" : "Meu Deck"}</label>
                  <input type="text" required list="modal-decks-sugeridos" value={meuDeck} onChange={(e) => setMeuDeck(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white" />
                  <datalist id="modal-decks-sugeridos">{decksCadastrados.map(d => <option key={d} value={d} />)}</datalist>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Deck Adversário</label>
                <input type="text" required value={deckAdversario} onChange={(e) => setDeckAdversario(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Nome do Oponente</label>
                  <input type="text" value={oponente} onChange={(e) => setOponente(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Resultado</label>
                  <select value={resultado} onChange={(e) => setResultado(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white">
                    <option value="Vitória">Vitória</option>
                    <option value="Empate">Empate</option>
                    <option value="Derrota">Derrota</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Placar Exato</label>
                  <select value={placar} onChange={(e) => setPlacar(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white">
                    <option value="2-0">2-0</option>
                    <option value="2-1">2-1</option>
                    <option value="1-1">1-1</option>
                    <option value="1-2">1-2</option>
                    <option value="0-2">0-2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Torneio / Evento</label>
                  <input type="text" list="modal-torneios-sugeridos" value={torneio} onChange={(e) => setTorneio(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white" />
                  <datalist id="modal-torneios-sugeridos">{torneiosCadastrados.map(t => <option key={t} value={t} />)}</datalist>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Data</label>
                <input type="date" required value={dataPartida} onChange={(e) => setDataPartida(e.target.value)} className="w-full bg-[#1c263d] border border-gray-700 rounded-lg p-2.5 text-white" />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-800 text-gray-300 font-semibold px-4 py-2 rounded-lg">Cancelar</button>
                <button type="submit" className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg">{editingId ? "Salvar Alterações" : "Salvar Partida"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
