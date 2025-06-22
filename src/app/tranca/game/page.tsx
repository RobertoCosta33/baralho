"use client";

import { useReducer, useEffect, useState, Suspense } from "react";
import { Box, Typography, Button } from "@mui/material";
import styled, { keyframes, css } from "styled-components";
import LockIcon from '@mui/icons-material/Lock';

import { Card as CardType } from "@/services/api";
import { dealCards, getCardValue } from "@/utils/cards";
import {
  Meld,
  isValidMeld,
  calculateRoundScore,
  CanastaType,
  canJustifyDiscardPickup,
} from "@/utils/trancaRules";
import { GameCard } from "@/components/tranca/GameCard";
import {
  OpponentPile,
  OpponentCardBack,
} from "@/components/tranca/TrancaComponents";

// #region Styled Components
const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  background-color: #0c3b2e;
  color: white;
  position: relative;
`;

const ScoreDisplay = styled(Box)<{ position: "left" | "right" }>`
  position: absolute;
  top: 1rem;
  ${({ position }) => (position === "left" ? "left: 1rem;" : "right: 1rem;")}
  background-color: rgba(0, 0, 0, 0.4);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  z-index: 10;
`;

const TableGrid = styled.div`
  display: grid;
  width: 100%;
  height: 100vh;
  grid-template-areas:
    ". partner ."
    "left-opponent table-center right-opponent"
    ". human-player .";
  grid-template-columns: 15.625rem 1fr 15.625rem;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: 1rem;
  gap: 1rem;
  transition: all 0.3s ease;
`;

const pulseGreenAnimation = keyframes`
  0% { 
    background-color: rgba(144, 238, 144, 0.2);
    border-color: rgba(144, 238, 144, 0.8);
  }
  50% { 
    background-color: rgba(144, 238, 144, 0.4);
    border-color: rgba(144, 238, 144, 1);
  }
  100% { 
    background-color: rgba(144, 238, 144, 0.2);
    border-color: rgba(144, 238, 144, 0.8);
  }
`;

const PlayerArea = styled.div<{ $area: string; $isCurrentTurn?: boolean }>`
  grid-area: ${(props) => props.$area};
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: ${(props) =>
    props.$isCurrentTurn ? "rgba(144, 238, 144, 0.2)" : "rgba(0, 0, 0, 0.1)"};
  border-radius: 8px;
  border: ${(props) =>
    props.$isCurrentTurn
      ? "2px solid rgba(144, 238, 144, 0.8)"
      : "1px solid rgba(255, 255, 255, 0.2)"};
  transition: all 0.3s ease;
  
  ${(props) =>
    props.$isCurrentTurn &&
    css`
      animation: ${pulseGreenAnimation} 2s ease-in-out infinite;
    `}
`;

const HandContainer = styled.div<{ $area: string }>`
  display: ${({ $area }) =>
    $area === "left-opponent" || $area === "right-opponent" ? "grid" : "flex"};
  gap: 0.5rem;
  padding: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;

  ${({ $area }) =>
    ($area === "left-opponent" || $area === "right-opponent") &&
    `
      grid-template-columns: 1fr 1fr;
      justify-items: center;
      align-content: start;
      width: 100%;
    `}
`;

const TableCenter = styled.div`
  grid-area: table-center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
`;

const DeckAndDiscardContainer = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
`;

const MeldContainer = styled.div<{ $isMeldable?: boolean }>`
  min-height: 100px;
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 1rem;
  background-color: ${(props) =>
    props.$isMeldable ? "rgba(76, 175, 80, 0.2)" : "rgba(0, 0, 0, 0.2)"};
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  cursor: ${(props) => (props.$isMeldable ? "pointer" : "default")};
  border: 2px solid ${(props) => (props.$isMeldable ? "#4caf50" : "transparent")};
  transition: all 0.2s ease-in-out;
`;

const DiscardPilePlaceholder = styled.div`
  width: 90px;
  height: 130px;
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  display: flex;
  align-items: center;
`;
// #endregion

// #region Types and Interfaces
interface Player {
  id: string;
  name: string;
  hand: CardType[];
  isBot: boolean;
}

interface Team {
  id: string;
  playerIds: string[];
  melds: Meld[];
  score: number;
  roundScore: number;
  hasPickedUpDeadPile: boolean;
  redThrees: CardType[];
}

interface GameState {
  players: Player[];
  teams: [Team, Team];
  deck: CardType[];
  discardPile: CardType[];
  isDiscardPileLocked: boolean;
  deadPiles: [CardType[], CardType[]];
  currentPlayerIndex: number;
  turnPhase: "DRAW" | "DISCARD" | "ENDED" | "MUST_JUSTIFY_DISCARD";
  gamePhase: "PLAYING" | "GAME_OVER";
  winner: Team | null;
  lastDrawnCardId: string | null;
  justificationCardId: string | null;
}

type GameAction =
  | { type: "INITIALIZE_GAME" }
  | { type: "DRAW_FROM_DECK" }
  | { type: "DISCARD"; payload: { cardId: string } }
  | { type: "MELD"; payload: { cardIds: string[] } }
  | { type: "MELD_RED_THREE"; payload: { cardId: string } }
  | { type: "ADD_TO_MELD"; payload: { cardIds: string[]; meldId: string } }
  | { type: "TAKE_DISCARD_PILE" }
  | { type: "ACKNOWLEDGE_DRAWN_CARD" }
  | { type: "SORT_HAND"; payload: { playerId: string; hand: CardType[] } };
// #endregion

// #region Game Reducer
function gameReducer(state: GameState, action: GameAction): GameState {
  const handleGameOver = (beatingTeamId?: string): GameState => {
    const finalState = { ...state, gamePhase: "GAME_OVER" as const, turnPhase: "ENDED" as const };
    const team1 = finalState.teams[0];
    const team2 = finalState.teams[1];
    
    const team1Score = calculateRoundScore(team1, finalState.players, team1.id === beatingTeamId);
    const team2Score = calculateRoundScore(team2, finalState.players, team2.id === beatingTeamId);

    const finalTeams: [Team, Team] = [
        { ...team1, roundScore: team1Score, score: team1.score + team1Score },
        { ...team2, roundScore: team2Score, score: team2.score + team2Score },
    ];
    
    const winner = finalTeams.find(t => t.id === beatingTeamId) || null;

    return { ...finalState, teams: finalTeams, winner };
  }

  switch (action.type) {
    case "INITIALIZE_GAME": {
      const { deck, hands, deadPiles } = dealCards();

      const initialPlayers: Player[] = [
        { id: "player-0", name: "Você", hand: hands[0], isBot: false },
        { id: "player-1", name: "Oponente Esquerda", hand: hands[1], isBot: true, },
        { id: "player-2", name: "Parceiro", hand: hands[2], isBot: true },
        { id: "player-3", name: "Oponente Direita", hand: hands[3], isBot: true, },
      ];

      const teams: [Team, Team] = [
        { id: "team-0", playerIds: ["player-0", "player-2"], melds: [], score: state.teams[0].score, roundScore: 0, hasPickedUpDeadPile: false, redThrees: [], },
        { id: "team-1", playerIds: ["player-1", "player-3"], melds: [], score: state.teams[1].score, roundScore: 0, hasPickedUpDeadPile: false, redThrees: [], },
      ];

      // Auto-meld red threes at the start
      const newDeck = [...deck];
      initialPlayers.forEach((player) => {
        const redThreesInHand = player.hand.filter((c) => c.isRedThree);
        if (redThreesInHand.length > 0) {
          player.hand = player.hand.filter((c) => !c.isRedThree);
          const team = teams.find((t) => t.playerIds.includes(player.id))!;
          team.redThrees.push(...redThreesInHand);
          for (let i = 0; i < redThreesInHand.length; i++) {
            const newCard = newDeck.pop();
            if(newCard) player.hand.push(newCard);
          }
        }
      });

      return {
        ...state,
        deck: newDeck,
        players: initialPlayers,
        teams,
        deadPiles: deadPiles as [CardType[], CardType[]],
        discardPile: [],
        currentPlayerIndex: 0,
        turnPhase: "DRAW",
        gamePhase: "PLAYING",
        winner: null,
        lastDrawnCardId: null,
        justificationCardId: null,
        isDiscardPileLocked: false,
      };
    }
    case "DRAW_FROM_DECK": {
      if (state.turnPhase !== "DRAW" || state.deck.length === 0) return state;

      const newDeck = [...state.deck];
      const drawnCard = newDeck.pop()!;

      const player = state.players[state.currentPlayerIndex];
      const newPlayers = [...state.players];

      if (drawnCard.isRedThree) {
          const team = state.teams.find(t => t.playerIds.includes(player.id))!;
          const newTeams = state.teams.map(t => t.id === team.id ? { ...t, redThrees: [...t.redThrees, drawnCard] } : t) as [Team, Team];
          const newCard = newDeck.pop();
          const newHand = newCard ? [...player.hand, newCard] : player.hand;
          newPlayers[state.currentPlayerIndex] = { ...player, hand: newHand };
          
          return { ...state, deck: newDeck, players: newPlayers, teams: newTeams, turnPhase: "DRAW", lastDrawnCardId: newCard?.id || null };
      }
      
      const newHand = [...player.hand, drawnCard];
      newPlayers[state.currentPlayerIndex] = { ...player, hand: newHand };

      return { ...state, deck: newDeck, players: newPlayers, turnPhase: "DISCARD", lastDrawnCardId: drawnCard.id };
    }
    case "DISCARD": {
      if (state.turnPhase !== "DISCARD") return state;

      const player = state.players[state.currentPlayerIndex];
      const cardToDiscard = player.hand.find(c => c.id === action.payload.cardId);
      if (!cardToDiscard) return state;

      const newHand = player.hand.filter(c => c.id !== action.payload.cardId);
      let newPlayers = state.players.map((p) => p.id === player.id ? { ...p, hand: newHand } : p);

      const newDiscardPile = [...state.discardPile, cardToDiscard];
      let newTeams = state.teams;
      let newDeadPiles = state.deadPiles;
      let turnPhase: "DRAW" | "DISCARD" = "DRAW";
      let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

      if (newHand.length === 0) {
        const playerTeam = state.teams.find((t) => t.playerIds.includes(player.id))!;
        if (playerTeam.hasPickedUpDeadPile || state.deadPiles.every((p) => p.length === 0)) {
          const teamHasCleanCanasta = playerTeam.melds.some(m => m.canastaType === 'clean');
          if (teamHasCleanCanasta) {
            return handleGameOver(playerTeam.id);
          } else {
            return state; 
          }
        } else { 
          const deadPileIndex = state.deadPiles.findIndex(p => p.length > 0);
          if (deadPileIndex !== -1) {
            const deadPile = state.deadPiles[deadPileIndex];
            const newHandWithDeadPile = [...newHand, ...deadPile];
            newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHandWithDeadPile } : p);
            newTeams = state.teams.map(t => t.id === playerTeam.id ? { ...t, hasPickedUpDeadPile: true } : t) as [Team, Team];
            newDeadPiles = state.deadPiles.map((p, index) => index === deadPileIndex ? [] : p) as [CardType[], CardType[]];
            turnPhase = 'DISCARD';
            nextPlayerIndex = state.currentPlayerIndex;
          }
        }
      }

      return {
        ...state,
        players: newPlayers,
        teams: newTeams,
        deadPiles: newDeadPiles,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextPlayerIndex,
        turnPhase,
        lastDrawnCardId: null,
        justificationCardId: null,
        isDiscardPileLocked: cardToDiscard.isTranca,
      };
    }
    case "MELD": {
      if (state.turnPhase !== "DISCARD") return state;
      const { cardIds } = action.payload;
      const player = state.players[state.currentPlayerIndex];
      const team = state.teams.find(t => t.playerIds.includes(player.id))!;
      
      const cardsToMeld = player.hand.filter(c => cardIds.includes(c.id));
      if (cardsToMeld.length !== cardIds.length) return state;

      const meldValidation = isValidMeld(cardsToMeld);
      if (!meldValidation.isValid) return state;

      const newHand = player.hand.filter(c => !cardIds.includes(c.id));
      
      const newMeld: Meld = { id: `meld-${Date.now()}`, cards: cardsToMeld, type: meldValidation.type!, canastaType: meldValidation.canastaType };
      
      const newTeams: [Team, Team] = state.teams.map(t => t.id === team.id ? { ...t, melds: [...t.melds, newMeld] } : t) as [Team, Team];
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);
      
      return { ...state, players: newPlayers, teams: newTeams, turnPhase: "DISCARD" };
    }
     case "ADD_TO_MELD": {
      if (state.turnPhase !== "DISCARD") return state;
      const { cardIds, meldId } = action.payload;
      const player = state.players[state.currentPlayerIndex];
      const team = state.teams.find(t => t.playerIds.includes(player.id))!;

      const meldToUpdate = team.melds.find(m => m.id === meldId);
      if (!meldToUpdate) return state;

      const cardsToAdd = player.hand.filter(c => cardIds.includes(c.id));
      if(cardsToAdd.length === 0) return state;
      
      const prospectiveMeldCards = [...meldToUpdate.cards, ...cardsToAdd];
      const meldValidation = isValidMeld(prospectiveMeldCards);

      if (!meldValidation.isValid) return state;

      const newHand = player.hand.filter(c => !cardIds.includes(c.id));
      const updatedMeld: Meld = { ...meldToUpdate, cards: prospectiveMeldCards, canastaType: meldValidation.canastaType };
      const newTeams: [Team, Team] = state.teams.map(t => t.id === team.id ? { ...t, melds: t.melds.map(m => m.id === meldId ? updatedMeld : m) } : t ) as [Team, Team];
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);

      return { ...state, players: newPlayers, teams: newTeams };
    }
     case "TAKE_DISCARD_PILE": {
      if (state.turnPhase !== "DRAW" || state.isDiscardPileLocked) return state;
      const player = state.players[state.currentPlayerIndex];
      const playerTeam = state.teams.find(t => t.playerIds.includes(player.id))!;
      const topCard = state.discardPile[state.discardPile.length - 1];
      if (!topCard) return state;

      const justification = canJustifyDiscardPickup(topCard, player.hand, playerTeam.melds);
      if (!justification) return state;

      const newHand = [...player.hand, ...state.discardPile];
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);

      return { ...state, players: newPlayers, discardPile: [], turnPhase: "DISCARD" };
    }
    case "ACKNOWLEDGE_DRAWN_CARD": {
      return { ...state, lastDrawnCardId: null, justificationCardId: null };
    }
    case "SORT_HAND": {
      const { playerId, hand } = action.payload;
      const newPlayers = state.players.map(p => p.id === playerId ? { ...p, hand } : p);
      return { ...state, players: newPlayers };
    }
  }
  return state;
}
// #endregion

function getSmartSortedMeld(meld: Meld): CardType[] {
  const sorted = [...meld.cards].sort((a, b) => {
    if (a.isWildcard && !b.isWildcard) return 1;
    if (!a.isWildcard && b.isWildcard) return -1;
    return getCardValue(a) - getCardValue(b);
  });
  return sorted;
}

const MeldAreaDisplay = ({
  teamName,
  melds,
  onMeldClick,
  highlightedMeldIds = [],
}: {
  teamName: string;
  melds: Meld[];
  onMeldClick?: (meldId: string) => void;
  highlightedMeldIds?: string[];
}) => {
  const getBorderColor = (canastaType?: CanastaType) => {
    if (canastaType === "clean") return "#4caf50";
    if (canastaType === "dirty") return "#f57c00";
    return "transparent";
  };

  if (melds.length === 0) {
    return (
      <Box sx={{ width: "100%", textAlign: "center", my: "auto" }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: "1rem" }}>
          {teamName}
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
          Nenhum jogo na mesa
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", textAlign: "center" }}>
      <Typography variant="h6" sx={{ mb: 1, fontSize: "1rem" }}>
        {teamName}
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "1rem" }}>
        {melds.map((meld) => {
          const sortedCards = getSmartSortedMeld(meld);
          const isHighlighted = highlightedMeldIds?.includes(meld.id);

          return (
            <Box
              key={meld.id}
              onClick={(e) => { if (onMeldClick) { e.stopPropagation(); onMeldClick(meld.id); } }}
              sx={{
                cursor: onMeldClick ? "pointer" : "default",
                padding: "0.5rem",
                border: `3px solid ${ isHighlighted ? "#ffd700" : getBorderColor(meld.canastaType) }`,
                borderRadius: "8px",
                backgroundColor: isHighlighted ? "rgba(255, 215, 0, 0.2)" : "transparent",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                {sortedCards.map((card) => (
                  <Box key={card.id} sx={{ position: "relative" }}>
                    <GameCard card={card} />
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

function TrancaGame() {
  const [state, dispatch] = useReducer(gameReducer, {
    players: [],
    teams: [
      { id: "team-0", playerIds: ["player-0", "player-2"], melds: [], score: 0, roundScore: 0, hasPickedUpDeadPile: false, redThrees: [] },
      { id: "team-1", playerIds: ["player-1", "player-3"], melds: [], score: 0, roundScore: 0, hasPickedUpDeadPile: false, redThrees: [] },
    ],
    deck: [],
    discardPile: [],
    deadPiles: [[], []],
    currentPlayerIndex: 0,
    turnPhase: "DRAW",
    gamePhase: "PLAYING",
    winner: null,
    lastDrawnCardId: null,
    justificationCardId: null,
    isDiscardPileLocked: false,
  });

  const { players, teams, discardPile, currentPlayerIndex, turnPhase, gamePhase, winner, lastDrawnCardId, justificationCardId, isDiscardPileLocked, } = state;
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [highlightedMeldIds] = useState<string[]>([]);

  useEffect(() => {
    dispatch({ type: "INITIALIZE_GAME" });
  }, []);

  const humanPlayer = players.find((p) => p.id === "player-0");

  const isValidMeldSelection = (cardIds: string[]): boolean => {
    if (!humanPlayer || cardIds.length < 3) return false;
    const selectedCardsFromHand = humanPlayer.hand.filter((card) => cardIds.includes(card.id)) || [];
    if (selectedCardsFromHand.length !== cardIds.length) return false;
    const meldValidation = isValidMeld(selectedCardsFromHand);
    return meldValidation.isValid;
  };

  useEffect(() => {
    if (gamePhase !== "PLAYING" || turnPhase === "ENDED") return;

    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer?.isBot) {
      const handleBotTurn = () => {
        if (turnPhase === 'DRAW') {
           // Lógica de Compra da IA (simplificada)
           dispatch({ type: "DRAW_FROM_DECK" });
        } else if (turnPhase === 'DISCARD') {
          // Lógica de Baixar Jogo e Descartar da IA
          const botHand = currentPlayer.hand;
          const valueGroups: { [key: string]: CardType[] } = {};
          botHand.forEach(card => {
            if (!card.isWildcard && !card.isTranca && !card.isRedThree) {
              if (!valueGroups[card.value]) valueGroups[card.value] = [];
              valueGroups[card.value].push(card);
            }
          });

          const cardsToMeldIds: string[] = [];
          for (const value in valueGroups) {
            if (valueGroups[value].length >= 3) {
              cardsToMeldIds.push(...valueGroups[value].map(c => c.id));
            }
          }
          
          if (cardsToMeldIds.length > 0) {
            dispatch({ type: "MELD", payload: { cardIds: cardsToMeldIds } });
          }
          
          const remainingHand = botHand.filter(c => !cardsToMeldIds.includes(c.id));
          if (remainingHand.length > 0) {
            // Lógica de descarte: descarta a carta de menor valor que não seja coringa
             const cardToDiscard = remainingHand.sort((a,b) => getCardValue(a) - getCardValue(b)).find(c => !c.isWildcard);
             if (cardToDiscard) {
                dispatch({ type: "DISCARD", payload: { cardId: cardToDiscard.id } });
             } else if (remainingHand.length > 0) {
                dispatch({ type: "DISCARD", payload: { cardId: remainingHand[0].id } });
             }
          }
        }
      };
      setTimeout(handleBotTurn, 1500);
    }
  }, [gamePhase, currentPlayerIndex, players, turnPhase, dispatch]);

  const partnerPlayer = players.find((p) => p.id === "player-2");
  const leftOpponentPlayer = players.find((p) => p.id === "player-1");
  const rightOpponentPlayer = players.find((p) => p.id === "player-3");

  const playerTeam = teams.find((t) => t.playerIds.includes("player-0"));
  const opponentTeam = teams.find((t) => !t.playerIds.includes("player-0"));

  const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isPlayerTurn = currentPlayerIndex === 0 && gamePhase === "PLAYING";
  const isSelectionMeldable = isValidMeldSelection(selectedCards);

  const handleCardClick = (cardId: string) => {
    if (lastDrawnCardId || justificationCardId) dispatch({ type: "ACKNOWLEDGE_DRAWN_CARD" });
    setSelectedCards(current => current.includes(cardId) ? current.filter(id => id !== cardId) : [...current, cardId]);
  };

  const handleAddToMeld = (meldId: string) => {
    if (selectedCards.length > 0 && turnPhase === "DISCARD") {
      dispatch({ type: "ADD_TO_MELD", payload: { cardIds: selectedCards, meldId } });
      setSelectedCards([]);
    }
  };

  const handleDiscardPileClick = () => {
    if (turnPhase !== "DRAW" || isDiscardPileLocked) return;
    dispatch({ type: "TAKE_DISCARD_PILE" });
  };
  
  const handleMeldAreaClick = () => {
    if (turnPhase !== "DISCARD" || !isSelectionMeldable) return;
    dispatch({ type: "MELD", payload: { cardIds: selectedCards } });
    setSelectedCards([]);
  };

  const handleDiscardClick = () => {
     if (selectedCards.length === 1 && turnPhase === "DISCARD") {
      dispatch({ type: "DISCARD", payload: { cardId: selectedCards[0] } });
      setSelectedCards([]);
    }
  };
  
  const sortBySuit = () => {
    if (!humanPlayer) return;
    const sortedHand = [...humanPlayer.hand].sort((a, b) => {
      const suitOrder: { [key: string]: number } = { hearts: 0, diamonds: 1, clubs: 2, spades: 3 };
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      return getCardValue(a) - getCardValue(b);
    });
    dispatch({ type: "SORT_HAND", payload: { playerId: humanPlayer.id, hand: sortedHand } });
  };

  const sortByValue = () => {
    if (!humanPlayer) return;
    const sortedHand = [...humanPlayer.hand].sort((a, b) => getCardValue(a) - getCardValue(b));
    dispatch({ type: "SORT_HAND", payload: { playerId: humanPlayer.id, hand: sortedHand } });
  };

  const isDiscardCardPotentiallyUseful = (discardCard: CardType): boolean => {
    if (!humanPlayer || !discardCard) return false;
    return canJustifyDiscardPickup(discardCard, humanPlayer.hand, playerTeam?.melds ?? []);
  };

  if (gamePhase === "GAME_OVER") {
    return (
      <GameArea>
        <Typography variant="h2">Fim de Jogo</Typography>
        <Typography variant="h4">
          {winner ? `Time Vencedor: ${winner.id === 'team-0' ? "Sua Dupla" : "Oponentes"}` : "Empate"}
        </Typography>
        <Button variant="contained" onClick={() => dispatch({ type: "INITIALIZE_GAME" })}>
          Jogar Novamente
        </Button>
      </GameArea>
    );
  }

  return (
    <GameArea>
      <ScoreDisplay position="left">
        <Typography>Sua Dupla: {playerTeam?.score ?? 0} (Rodada: {playerTeam?.roundScore ?? 0})</Typography>
        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mt: 1 }}>
            <Typography>3s Vermelhos:</Typography>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, minHeight: 42}}>
                {playerTeam?.redThrees.map(card => (
                    <Box key={card.id} sx={{ width: 27, height: 40, pointerEvents: 'none' }}>
                        <Box sx={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}>
                            <GameCard card={card} />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
      </ScoreDisplay>
      <ScoreDisplay position="right">
        <Typography>Oponentes: {opponentTeam?.score ?? 0} (Rodada: {opponentTeam?.roundScore ?? 0})</Typography>
         <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mt: 1 }}>
            <Typography>3s Vermelhos:</Typography>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, minHeight: 42}}>
                {opponentTeam?.redThrees.map(card => (
                    <Box key={card.id} sx={{ width: 27, height: 40, pointerEvents: 'none' }}>
                        <Box sx={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}>
                            <GameCard card={card} />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
      </ScoreDisplay>

      <TableGrid>
        <PlayerArea $area="partner">
          <Typography sx={{ mb: 1 }}>{partnerPlayer?.name}</Typography>
          <HandContainer $area="partner">
            {partnerPlayer?.hand.map((card) => <OpponentCardBack key={card.id} />)}
          </HandContainer>
        </PlayerArea>

        <PlayerArea $area="left-opponent" $isCurrentTurn={currentPlayerIndex === 1}>
          <Typography sx={{ mb: 1 }}>{leftOpponentPlayer?.name}</Typography>
          {leftOpponentPlayer && <OpponentPile count={leftOpponentPlayer.hand.length} />}
        </PlayerArea>

        <TableCenter>
          <MeldContainer>
            <MeldAreaDisplay teamName="Jogos da Dupla Oponente" melds={opponentTeam?.melds ?? []} />
          </MeldContainer>

          <DeckAndDiscardContainer>
            <Box sx={{ position: "relative", cursor: isPlayerTurn && turnPhase === 'DRAW' ? "pointer" : "default" }} onClick={isPlayerTurn && turnPhase === 'DRAW' ? () => dispatch({ type: "DRAW_FROM_DECK" }) : undefined}>
              <Typography variant="caption" sx={{ position: "absolute", top: "-1.5rem", width: "100%", textAlign: "center" }}>Monte ({state.deck.length})</Typography>
              <OpponentCardBack />
            </Box>
            <Box sx={{ position: "relative", cursor: "pointer" }} onClick={handleDiscardClick}>
              <Typography variant="caption" sx={{ position: "absolute", top: "-1.5rem", width: "100%", textAlign: "center" }}>Lixeira ({state.discardPile.length})</Typography>
              {isDiscardPileLocked && <LockIcon style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255, 255, 0, 0.8)', fontSize: '5rem', zIndex: 2 }} />}
              {topDiscard ? (
                <GameCard card={topDiscard} isDiscardValid={isDiscardCardPotentiallyUseful(topDiscard)} onClick={handleDiscardPileClick} />
              ) : (
                <DiscardPilePlaceholder />
              )}
            </Box>
          </DeckAndDiscardContainer>

          <MeldContainer onClick={handleMeldAreaClick} $isMeldable={isPlayerTurn && isSelectionMeldable}>
            <MeldAreaDisplay teamName="Seus Jogos" melds={playerTeam?.melds ?? []} onMeldClick={handleAddToMeld} highlightedMeldIds={highlightedMeldIds} />
          </MeldContainer>
        </TableCenter>

        <PlayerArea $area="right-opponent" $isCurrentTurn={currentPlayerIndex === 3}>
          <Typography sx={{ mb: 1 }}>{rightOpponentPlayer?.name}</Typography>
          {rightOpponentPlayer && <OpponentPile count={rightOpponentPlayer.hand.length} />}
        </PlayerArea>

        <PlayerArea $area="human-player" $isCurrentTurn={isPlayerTurn}>
          <HandContainer $area="human-player">
            {humanPlayer?.hand.map((card) => (
              <GameCard
                key={card.id}
                card={card}
                onClick={handleCardClick}
                isSelected={selectedCards.includes(card.id)}
                isNewlyDrawn={card.id === lastDrawnCardId || card.id === justificationCardId}
              />
            ))}
          </HandContainer>
          <Box sx={{ position: "absolute", top: "50%", right: "-5rem", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "0.5rem", zIndex: 10 }}>
            <Button variant="outlined" onClick={sortBySuit} sx={{ minWidth: "auto", px: 1.2, py: 0.5, borderColor: "rgba(0, 0, 0, 0.2)", backgroundColor: "rgba(255, 255, 255, 0.8)", "&:hover": { borderColor: "black", backgroundColor: "rgba(255, 255, 255, 1)", }, }}>
              <Box sx={{ display: "flex", gap: "3px", fontSize: "1rem" }}>
                <span style={{ color: "red" }}>♥</span><span style={{ color: "red" }}>♦</span><span style={{ color: "black" }}>♣</span><span style={{ color: "black" }}>♠</span>
              </Box>
            </Button>
            <Button variant="outlined" onClick={sortByValue} sx={{ minWidth: "auto", px: 1.2, py: 0.5, borderColor: "rgba(0, 0, 0, 0.2)", backgroundColor: "rgba(255, 255, 255, 0.8)", "&:hover": { borderColor: "black", backgroundColor: "rgba(255, 255, 255, 1)", }, }}>
              <Box sx={{ display: "flex", gap: "1px", fontSize: "0.9rem", fontWeight: "bold" }}>
                <span>1</span><span>2</span><span>3</span>
              </Box>
            </Button>
          </Box>
        </PlayerArea>
      </TableGrid>
    </GameArea>
  );
}

function TrancaGameWrapper() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#0c3b2e" }}>
          <Typography color="white">Carregando...</Typography>
        </Box>
      }
    >
      <TrancaGame />
    </Suspense>
  );
}

export default TrancaGameWrapper; 