import React, { useState, useEffect } from 'react';
import { ExternalLink, Trophy, Flame, Plus, Swords, X, Layers, Pencil } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';

export default function DeckDashboard() {
  // Meus Decks cadastrados
  const [meusDecks, setMeusDecks] = useState([
    { id: 1, nome: "Mono Red Madness", formato: "Pauper", linkLista: "https://moxfield.com" },
    { id: 2, nome: "Red Rally", formato: "Pauper", linkLista: "https://moxfield.com" },
    { id: 3, nome: "Gruul Ramp", formato: "Pauper", linkLista: "https://moxfield.com" },
  ]);

  // Deck Selecionado no Filtro ("Todos" para visão geral ou o nome do deck)
  const [deckFiltro, setDeckFiltro] = useState("Todos");

  // Lista de partidas vindas do Firebase
  const [partidas, setPartidas] = useState([]);

  // Estado para controlar a edição (null se for criação, ou o ID da partida sendo editada)
  const [editingId, setEditingId] = useState(null);

  // Escuta as partidas do Firestore em tempo real
  useEffect(() => {
    const q = query(collection(db, "partidas"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPartidas(docs);
    });

    return () => unsubscribe();
  }, []);

  // Controle do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulário de Partida
  const [formData, setFormData] = useState({
    meuDeck: "Mono Red Madness",
    novoDeckNome: "",
    adversario: '',
    deckAdversario: '',
    vitoriasDeck: 2,
    derrotasDeck: 0,
    torneio: 'League MTGO',
    data: new Date().toISOString().split('T')[0]
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Prepara o formulário para criar uma nova partida
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      meuDeck: meusDecks[0]?.nome || "Mono Red Madness",
      novoDeckNome: "",
      adversario: '',
      deckAdversario: '',
      vitoriasDeck: 2,
      derrotasDeck: 0,
      torneio: 'League MTGO',
      data: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // Prepara o formulário com os dados da partida para edição
  const handleOpenEditModal = (partida) => {
    setEditingId(partida.id);
    
    // Converte o placar "X-Y" de volta para vitorias e derrotas
    const [v, d] = partida.placar.split('-').map(Number);

    setFormData({
      meuDeck: partida.meuDeck,
      novoDeckNome: "",
      adversario: partida.adversario,
      deckAdversario: partida.deckAdversario,
      vitoriasDeck: isNaN(v) ? 2 : v,
      derrotasDeck: isNaN(d) ? 0 : d,
      torneio: partida.torneio || 'League MTGO',
      data: partida.data || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let deckUsado = formData.meuDeck;
    
    if (formData.meuDeck === "NOVO" && formData.novoDeckNome.trim() !== "") {
      deckUsado = formData.novoDeckNome.trim();
      const novoDeckObj = {
        id: Date.now(),
        nome: deckUsado,
        formato: "Pauper",
        linkLista: "https://moxfield.com"
      };
      setMeusDecks([...meusDecks, novoDeckObj]);
    }

    const v = parseInt(formData.vitoriasDeck);
    const d = parseInt(formData.derrotasDeck);
    const resultado = v > d ? 'Vitória' : 'Derrota';
    const placar = `${v}-${d}`;

    const partidaPayload = {
      meuDeck: deckUsado,
      adversario: formData.adversario,
      deckAdversario: formData.deckAdversario,
      placar: placar,
      resultado: resultado,
      torneio: formData.torneio,
      data: formData.data
    };

    try {
      if (editingId) {
        // Atualiza a partida existente no Firestore
        const partidaRef = doc(db, "partidas", editingId);
        await updateDoc(partidaRef, partidaPayload);
      } else {
        // Salva uma nova partida no Firestore
        await addDoc(collection(db, "partidas"), partidaPayload);
      }
      
      setIsModalOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error("Erro ao salvar/editar partida no Firebase:", error);
    }
  };

  // Filtragem das Partidas
  const partidasFiltradas = deckFiltro === "Todos"
    ? partidas
    : partidas.filter(p => p.meuDeck === deckFiltro);

  // Cálculos de Estatísticas
  const vitoriasTotais = partidasFiltradas.filter(p => p.resultado === 'Vitória').length;
  const totalPartidas = partidasFiltradas.length;
  const winrateGeral = totalPartidas > 0 ? ((vitoriasTotais / totalPartidas) * 100).toFixed(1) : 0;

  const deckInfoAtual = meusDecks.find(d => d.nome === deckFiltro);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* SELETOR DE DECK NO TOPO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold text-slate-300">Visualizar Estatísticas de:</span>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setDeckFiltro("Todos")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                deckFiltro === "Todos"
                  ? "bg-red-600 text-white shadow-md shadow-red-950/50"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              Geral (Todos os Decks)
            </button>
            {meusDecks.map((d) => (
              <button
                key={d.id}
                onClick={() => setDeckFiltro(d.nome)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  deckFiltro === d.nome
                    ? "bg-red-600 text-white shadow-md shadow-red-950/50"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {d.nome}
              </button>
            ))}
          </div>
        </div>

        {/* CABEÇALHO DO DASHBOARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950 text-red-400 border border-red-800/50 flex items-center gap-1">
                <Flame className="w-3 h-3" /> {deckInfoAtual ? deckInfoAtual.formato : "Pauper (Geral)"}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {deckFiltro === "Todos" ? "Visão Geral dos Decks" : deckFiltro}
            </h1>
            {deckInfoAtual && (
              <a href={deckInfoAtual.linkLista} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300 hover:underline pt-1">
                Ver Lista Completa <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-red-950/50 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Registrar Partida
          </button>
        </div>

        {/* METRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">
                {deckFiltro === "Todos" ? "Winrate Geral do Jogador" : `Winrate (${deckFiltro})`}
              </p>
              <h3 className="text-3xl font-bold text-white mt-1">{winrateGeral}%</h3>
              <p className="text-xs text-slate-500 mt-1">{vitoriasTotais}V - {totalPartidas - vitoriasTotais}D ({totalPartidas} jogos)</p>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl text-amber-400">
              <Trophy className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Melhor Matchup</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">-</h3>
              <p className="text-xs text-slate-500 mt-1">Nenhum dado</p>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl text-emerald-400">
              <Swords className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-400">Proporção de Vitórias</p>
            <div className="w-full bg-slate-800 rounded-full h-2.5 mt-4 overflow-hidden flex">
              <div className="bg-emerald-500 h-2.5" style={{ width: `${winrateGeral}%` }}></div>
              <div className="bg-red-500 h-2.5" style={{ width: `${100 - winrateGeral}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span className="text-emerald-400 font-medium">Vitórias ({vitoriasTotais})</span>
              <span className="text-red-400 font-medium">Derrotas ({totalPartidas - vitoriasTotais})</span>
            </div>
          </div>
        </div>

        {/* TABELA DE MATCHUPS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-lg text-white">Histórico de Matchups</h2>
            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">
              Mostrando: {deckFiltro}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-slate-400 uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Resultado</th>
                  <th className="px-6 py-3.5">Meu Deck</th>
                  <th className="px-6 py-3.5">Deck Adversário</th>
                  <th className="px-6 py-3.5">Oponente</th>
                  <th className="px-6 py-3.5">Placar</th>
                  <th className="px-6 py-3.5">Torneio</th>
                  <th className="px-6 py-3.5">Data</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {partidasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">
                      Nenhuma partida registrada para este deck.
                    </td>
                  </tr>
                ) : (
                  partidasFiltradas.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        {item.resultado === 'Vitória' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                            Vitória
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-950 text-red-400 border border-red-800/60">
                            Derrota
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-red-400">{item.meuDeck}</td>
                      <td className="px-6 py-4 font-semibold text-white">{item.deckAdversario}</td>
                      <td className="px-6 py-4">{item.adversario}</td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-200">{item.placar}</td>
                      <td className="px-6 py-4 text-slate-400">{item.torneio}</td>
                      <td className="px-6 py-4 text-slate-500">{item.data}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                          title="Editar Partida"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL DE CADASTRO OU EDIÇÃO DE PARTIDA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingId ? "Editar Partida" : "Registrar Nova Partida"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              {/* Selecionar MEU DECK */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Qual Deck VOCÊ usou?</label>
                <select
                  name="meuDeck"
                  value={formData.meuDeck}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                >
                  {meusDecks.map((d) => (
                    <option key={d.id} value={d.nome}>{d.nome}</option>
                  ))}
                  <option value="NOVO">+ Cadastrar Novo Deck...</option>
                </select>
              </div>

              {/* Se escolheu cadastrar um novo deck */}
              {formData.meuDeck === "NOVO" && (
                <div>
                  <label className="block text-xs font-medium text-red-400 mb-1">Nome do Seu Novo Deck</label>
                  <input
                    type="text"
                    name="novoDeckNome"
                    required
                    placeholder="Ex: Gruul Ramp, Rakdos Burn..."
                    value={formData.novoDeckNome}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-red-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Deck Adversário</label>
                <input
                  type="text"
                  name="deckAdversario"
                  required
                  placeholder="Ex: Mono Blue Terror, Affinity..."
                  value={formData.deckAdversario}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Oponente</label>
                <input
                  type="text"
                  name="adversario"
                  required
                  placeholder="Ex: Fulano"
                  value={formData.adversario}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Seus Games</label>
                  <input
                    type="number"
                    name="vitoriasDeck"
                    min="0"
                    max="2"
                    required
                    value={formData.vitoriasDeck}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Games Oponente</label>
                  <input
                    type="number"
                    name="derrotasDeck"
                    min="0"
                    max="2"
                    required
                    value={formData.derrotasDeck}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Torneio</label>
                  <input
                    type="text"
                    name="torneio"
                    placeholder="Ex: FNM, League"
                    value={formData.torneio}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    name="data"
                    value={formData.data}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium shadow-md shadow-red-950/50"
                >
                  {editingId ? "Atualizar Partida" : "Salvar Partida"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}