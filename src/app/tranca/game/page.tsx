"use client";

import { useReducer, useEffect, useState, Suspense, useMemo } from "react";
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
  canAddToMeld,
  getCardNumericValue,
  calculateLiveScore,
} from "@/utils/trancaRules";
import { GameCard } from "@/components/tranca/GameCard";
import {
  OpponentPile,
  OpponentCardBack,
} from "@/components/tranca/TrancaComponents";

// #region Styled Components
const pulseGlowAnimation = keyframes`
  0% { 
    box-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
  }
  50% { 
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.6);
  }
  100% { 
    box-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
  }
`;

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

const RedThreeAnimation = styled.div<{ $isAnimating: boolean }>`
  position: fixed;
  z-index: 1000;
  transition: ${({ $isAnimating }) => $isAnimating ? 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'};
  pointer-events: none;
  transform-origin: center;
  
  ${({ $isAnimating }) => $isAnimating && `
    animation: float 1.5s ease-in-out;
  `}
  
  @keyframes float {
    0% {
      transform: scale(1) rotate(0deg);
    }
    25% {
      transform: scale(1.1) rotate(5deg);
    }
    50% {
      transform: scale(1.05) rotate(-3deg);
    }
    75% {
      transform: scale(1.1) rotate(2deg);
    }
    100% {
      transform: scale(0.8) rotate(0deg);
    }
  }
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
    background-color: rgba(144, 238, 144, 0.1);
    border-color: rgba(144, 238, 144, 0.4);
  }
  50% { 
    background-color: rgba(144, 238, 144, 0.2);
    border-color: rgba(144, 238, 144, 0.6);
  }
  100% { 
    background-color: rgba(144, 238, 144, 0.1);
    border-color: rgba(144, 238, 144, 0.4);
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
    props.$isCurrentTurn ? "rgba(144, 238, 144, 0.1)" : "rgba(0, 0, 0, 0.1)"};
  border-radius: 8px;
  border: ${(props) =>
    props.$isCurrentTurn
      ? "2px solid rgba(144, 238, 144, 0.4)"
      : "1px solid rgba(255, 255, 255, 0.2)"};
  transition: all 0.3s ease;
  
  ${(props) =>
    props.$isCurrentTurn &&
    css`
      animation: ${pulseGreenAnimation} 2s ease-in-out infinite;
    `}
`;

const HandContainer = styled.div<{ $area: string }>`
  display: flex;
  gap: ${({ $area }) =>
    $area === "left-opponent" || $area === "right-opponent" ? "0.5rem" : "0"};
  padding: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;

  ${({ $area }) =>
    $area === "human-player" &&
    `
    & > div {
      &:not(:first-child) {
        margin-left: -45px;
      }
    }
  `}

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

const ReplacementCardHighlight = styled.div`
  animation: ${pulseGlowAnimation} 2s ease-in-out infinite;
  border-radius: 8px;
  padding: 2px;
`;
// #endregion

// #region Types and Interfaces
interface Player {
  id: string;
  name: string;
  hand: CardType[];
  isBot: boolean;
  redThreesInHand: CardType[];
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
  turnPhase: "DRAW" | "DISCARD" | "ENDED" | "MUST_JUSTIFY_DISCARD" | "PROCESSING_RED_THREES";
  gamePhase: "PLAYING" | "GAME_OVER";
  winner: Team | null;
  lastDrawnCardId: string | null;
  justificationCardId: string | null;
  processingRedThreeIndex: number;
  hasDrawnCardThisTurn: boolean;
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
  | { type: "SORT_HAND"; payload: { playerId: string; hand: CardType[] } }
  | { type: "PROCESS_RED_THREES" }
  | { type: "COMPLETE_RED_THREE_PROCESSING" };
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
        { id: "player-0", name: "Você", hand: hands[0], isBot: false, redThreesInHand: [] },
        { id: "player-1", name: "Oponente Esquerda", hand: hands[1], isBot: true, redThreesInHand: [] },
        { id: "player-2", name: "Parceiro", hand: hands[2], isBot: true, redThreesInHand: [] },
        { id: "player-3", name: "Oponente Direita", hand: hands[3], isBot: true, redThreesInHand: [] },
      ];

      const teams: [Team, Team] = [
        { id: "team-0", playerIds: ["player-0", "player-2"], melds: [], score: state.teams[0].score, roundScore: 0, hasPickedUpDeadPile: false, redThrees: [], },
        { id: "team-1", playerIds: ["player-1", "player-3"], melds: [], score: state.teams[1].score, roundScore: 0, hasPickedUpDeadPile: false, redThrees: [], },
      ];

      // Não mover automaticamente os 3s vermelhos - eles ficam na mão até a vez do jogador
      const updatedTeams = teams.map(t => ({ ...t, roundScore: calculateLiveScore(t) }));

      return {
        ...state,
        deck: deck,
        players: initialPlayers,
        teams: updatedTeams as [Team, Team],
        deadPiles: deadPiles as [CardType[], CardType[]],
        discardPile: [],
        currentPlayerIndex: 0,
        turnPhase: "DRAW",
        gamePhase: "PLAYING",
        winner: null,
        lastDrawnCardId: null,
        justificationCardId: null,
        isDiscardPileLocked: false,
        processingRedThreeIndex: -1,
        hasDrawnCardThisTurn: false,
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
          
          const updatedTeams = newTeams.map(t => ({ ...t, roundScore: calculateLiveScore(t) }));

          return { ...state, deck: newDeck, players: newPlayers, teams: updatedTeams as [Team, Team], turnPhase: "DRAW", lastDrawnCardId: newCard?.id || null, hasDrawnCardThisTurn: true };
      }
      
      const newHand = [...player.hand, drawnCard];
      newPlayers[state.currentPlayerIndex] = { ...player, hand: newHand };

      return { ...state, deck: newDeck, players: newPlayers, turnPhase: "DISCARD", lastDrawnCardId: drawnCard.id, hasDrawnCardThisTurn: true };
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
        hasDrawnCardThisTurn: false,
      };
    }
    case "MELD": {
      if (state.turnPhase !== "DISCARD" && state.turnPhase !== "MUST_JUSTIFY_DISCARD") return state;
      const { cardIds } = action.payload;
      const player = state.players[state.currentPlayerIndex];
      const team = state.teams.find(t => t.playerIds.includes(player.id))!;
      
      if (state.turnPhase === "MUST_JUSTIFY_DISCARD" && !cardIds.includes(state.justificationCardId!)) {
        return state; // Block if not using the justification card
      }
      
      const cardsToMeld = player.hand.filter(c => cardIds.includes(c.id));
      if (cardsToMeld.length !== cardIds.length) return state;

      const meldValidation = isValidMeld(cardsToMeld);
      if (!meldValidation.isValid) return state;

      const newHand = player.hand.filter(c => !cardIds.includes(c.id));
      
      const newMeld: Meld = { id: `meld-${Date.now()}`, cards: cardsToMeld, type: meldValidation.type!, canastaType: meldValidation.canastaType };
      
      let newTeams: [Team, Team] = state.teams.map(t => t.id === team.id ? { ...t, melds: [...t.melds, newMeld] } : t) as [Team, Team];
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);
      
      newTeams = newTeams.map(t => ({ ...t, roundScore: calculateLiveScore(t) })) as [Team, Team];
      
      return { ...state, players: newPlayers, teams: newTeams, turnPhase: "DISCARD", justificationCardId: null };
    }
     case "ADD_TO_MELD": {
      if (state.turnPhase !== "DISCARD" && state.turnPhase !== "MUST_JUSTIFY_DISCARD") return state;
      const { cardIds, meldId } = action.payload;
      const player = state.players[state.currentPlayerIndex];
      const team = state.teams.find(t => t.playerIds.includes(player.id))!;

      if (state.turnPhase === "MUST_JUSTIFY_DISCARD" && !cardIds.includes(state.justificationCardId!)) {
        return state; // Block if not using the justification card
      }

      const meldToUpdate = team.melds.find(m => m.id === meldId);
      if (!meldToUpdate) return state;

      const cardsToAdd = player.hand.filter(c => cardIds.includes(c.id));
      if(cardsToAdd.length === 0) return state;
      
      const prospectiveMeldCards = [...meldToUpdate.cards, ...cardsToAdd];
      const meldValidation = isValidMeld(prospectiveMeldCards);

      if (!meldValidation.isValid) return state;

      const newHand = player.hand.filter(c => !cardIds.includes(c.id));
      const updatedMeld: Meld = { ...meldToUpdate, cards: prospectiveMeldCards, canastaType: meldValidation.canastaType };
      let newTeams: [Team, Team] = state.teams.map(t => t.id === team.id ? { ...t, melds: t.melds.map(m => m.id === meldId ? updatedMeld : m) } : t ) as [Team, Team];
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);

      newTeams = newTeams.map(t => ({ ...t, roundScore: calculateLiveScore(t) })) as [Team, Team];

      return { ...state, players: newPlayers, teams: newTeams, turnPhase: "DISCARD", justificationCardId: null };
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

      return { ...state, players: newPlayers, discardPile: [], turnPhase: "MUST_JUSTIFY_DISCARD", justificationCardId: topCard.id };
    }
    case "ACKNOWLEDGE_DRAWN_CARD": {
      return { ...state, lastDrawnCardId: null, justificationCardId: null };
    }
    case "SORT_HAND": {
      const { playerId, hand } = action.payload;
      const newPlayers = state.players.map(p => p.id === playerId ? { ...p, hand } : p);
      return { ...state, players: newPlayers };
    }
    case "PROCESS_RED_THREES": {
      return { ...state, turnPhase: "PROCESSING_RED_THREES" };
    }
    case "COMPLETE_RED_THREE_PROCESSING": {
      const player = state.players[state.currentPlayerIndex];
      const team = state.teams.find(t => t.playerIds.includes(player.id))!;
      const redThree = player.hand.find(c => c.isRedThree);
      if (!redThree) return state;

      const newHand = player.hand.filter(c => c.id !== redThree.id);
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);
      const newTeams = state.teams.map(t => t.id === team.id ? { ...t, redThrees: [...t.redThrees, redThree] } : t) as [Team, Team];

      // Adicionar uma carta do monte se ainda houver cartas
      let finalPlayers = newPlayers;
      const finalDeck = [...state.deck];
      let newCardId: string | null = null;
      if (finalDeck.length > 0) {
        const newCard = finalDeck.pop()!;
        newCardId = newCard.id;
        finalPlayers = newPlayers.map(p => p.id === player.id ? { ...p, hand: [...newHand, newCard] } : p);
      }

      // Se o jogador já comprou uma carta na rodada, vai para fase de descarte
      // Se não comprou, pode comprar uma carta adicional
      const nextTurnPhase = state.hasDrawnCardThisTurn ? "DISCARD" : "DRAW";

      return {
        ...state,
        players: finalPlayers,
        teams: newTeams,
        deck: finalDeck,
        turnPhase: nextTurnPhase,
        justificationCardId: null,
        processingRedThreeIndex: -1,
        lastDrawnCardId: newCardId, // Marca a carta do monte como recém-comprada
      };
    }
  }
  return state;
}
// #endregion

function getSmartSortedMeld(meld: Meld): CardType[] {
  const wildcards = meld.cards.filter(c => c.isWildcard);
  const regularCards = meld.cards.filter(c => !c.isWildcard);

  // Para jogos de trinca (set), posiciona os coringas no início.
  if (meld.type === 'set') {
    return [...wildcards, ...regularCards];
  }

  // Lógica para sequências
  if (meld.type === 'run') {
    if (regularCards.length === 0) {
      return meld.cards; // Apenas coringas, não há como ordenar.
    }

    // Verifica se é uma sequência baixa com Ás (A-2-3) para ordenar corretamente.
    const isAceLow = regularCards.some(c => c.value === 'A') && regularCards.some(c => c.value === '2');

    const sortedRegularCards = [...regularCards].sort((a, b) => {
      let valA = getCardNumericValue(a);
      let valB = getCardNumericValue(b);
      if (isAceLow) {
        if (a.value === 'A') valA = 1;
        if (b.value === 'A') valB = 1;
      }
      return valA - valB;
    });

    const tempWildcards = [...wildcards];
    
    let minCardVal = getCardNumericValue(sortedRegularCards[0]);
    if (isAceLow && sortedRegularCards[0].value === 'A') minCardVal = 1;
    
    const maxCardVal = getCardNumericValue(sortedRegularCards[sortedRegularCards.length - 1]);
    
    // Determina o tamanho da sequência ideal e quantos coringas a estendem.
    const idealSequenceLength = maxCardVal - minCardVal + 1;
    const wildcardsUsedInGaps = idealSequenceLength - sortedRegularCards.length;
    const extendingWildcards = tempWildcards.length - wildcardsUsedInGaps;
    
    // Coringas que estendem a sequência vão para o início, conforme a regra.
    const startVal = minCardVal - extendingWildcards;
    const endVal = maxCardVal;

    const result: CardType[] = [];
    const mutableRegularCards = [...sortedRegularCards];

    for (let val = startVal; val <= endVal; val++) {
      const cardForValueIndex = mutableRegularCards.findIndex(c => {
        let cardVal = getCardNumericValue(c);
        if (isAceLow && c.value === 'A') cardVal = 1;
        return cardVal === val;
      });

      if (cardForValueIndex !== -1) {
        result.push(mutableRegularCards[cardForValueIndex]);
        mutableRegularCards.splice(cardForValueIndex, 1);
      } else if (tempWildcards.length > 0) {
        result.push(tempWildcards.pop()!);
      }
    }
    
    return result;
  }

  // Fallback para a ordenação antiga caso o tipo de jogo não seja identificado.
  return [...meld.cards].sort((a, b) => {
    if (a.isWildcard && !b.isWildcard) return 1;
    if (!a.isWildcard && b.isWildcard) return -1;
    return getCardValue(a) - getCardValue(b);
  });
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
    if (canastaType === "clean") return "blue";
    if (canastaType === "dirty") return "red";
    if (canastaType === "real") return "purple";
    return "transparent";
  };

  const sortedMelds = useMemo(() => {
    return [...melds].sort((a, b) => {
      const aValue = getCardNumericValue(a.cards.find(c => !c.isWildcard) || a.cards[0]);
      const bValue = getCardNumericValue(b.cards.find(c => !c.isWildcard) || b.cards[0]);
      return bValue - aValue;
    });
  }, [melds]);

  if (melds.length === 0) {
    return <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", mt: 2 }}>Nenhum jogo na mesa</Typography>;
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography sx={{ textAlign: "center", mb: 2, fontWeight: "bold" }}>{teamName}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
        {sortedMelds.map((meld) => {
          const sortedCards = getSmartSortedMeld(meld);
          const isHighlighted = highlightedMeldIds.includes(meld.id);

          return (
            <Box
              key={meld.id}
              onClick={() => onMeldClick?.(meld.id)}
              sx={{
                cursor: onMeldClick ? "pointer" : "default",
                border: `3px solid ${ isHighlighted ? "#ffd700" : getBorderColor(meld.canastaType) }`,
                borderRadius: "8px",
                p: 1,
                backgroundColor: isHighlighted ? "rgba(255, 215, 0, 0.2)" : "rgba(0,0,0,0.1)",
                transition: "all 0.2s ease",
                "&:hover": onMeldClick
                  ? {
                      borderColor: "lightblue",
                      backgroundColor: "rgba(0,0,0,0.2)",
                    }
                  : {},
              }}
            >
              <Box sx={{ display: 'flex', position: 'relative' }}>
                {sortedCards.map((card, index) => (
                  <Box
                    key={card.id}
                    sx={{
                      marginLeft: index > 0 ? "-45px" : 0,
                      transition: "transform 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-10px) scale(1.05)",
                        zIndex: 10,
                      },
                      zIndex: index,
                    }}
                  >
                    <GameCard card={card} noInteraction />
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
    processingRedThreeIndex: -1,
    hasDrawnCardThisTurn: false,
  });

  const { players, teams, discardPile, currentPlayerIndex, turnPhase, gamePhase, winner, lastDrawnCardId, justificationCardId, isDiscardPileLocked, processingRedThreeIndex } = state;
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [animatingRedThree, setAnimatingRedThree] = useState<{ card: CardType; startPos: { x: number; y: number }; endPos: { x: number; y: number } } | null>(null);
  const [replacementCardId, setReplacementCardId] = useState<string | null>(null);
  
  useEffect(() => {
    dispatch({ type: "INITIALIZE_GAME" });
  }, []);

  const humanPlayer = players.find((p) => p.id === "player-0");
  const playerTeam = teams.find((t) => t.playerIds.includes("player-0"));
  const isPlayerTurn = currentPlayerIndex === 0 && gamePhase === "PLAYING";

  // Lógica de animação dos 3s vermelhos para o jogador humano
  useEffect(() => {
    if (turnPhase === "PROCESSING_RED_THREES" && humanPlayer) {
      const redThreesInHand = humanPlayer.hand.filter(c => c.isRedThree);
      if (redThreesInHand.length > 0 && processingRedThreeIndex === -1) {
        const redThree = redThreesInHand[0];
        const startPos = { x: 50, y: 85 };
        const endPos = { x: 15, y: 15 };
        setAnimatingRedThree({ card: redThree, startPos, endPos });
        setTimeout(() => {
          dispatch({ type: "COMPLETE_RED_THREE_PROCESSING" });
          setAnimatingRedThree(null);
        }, 1500);
      }
    }
  }, [turnPhase, humanPlayer, processingRedThreeIndex, dispatch]);

  // Efeito para o jogador HUMANO iniciar o processamento de 3s vermelhos
  useEffect(() => {
    if (isPlayerTurn && turnPhase === "DRAW" && humanPlayer?.hand.some(c => c.isRedThree)) {
      dispatch({ type: "PROCESS_RED_THREES" });
    }
  }, [isPlayerTurn, turnPhase, humanPlayer, dispatch]);
  
  // Efeito para o BOT controlar seu turno
  useEffect(() => {
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer?.isBot && gamePhase === "PLAYING") {
      const handleBotTurn = () => {
        const totalRedThreesOnBoard = teams.reduce((acc, t) => acc + t.redThrees.length, 0);

        // ESTADO 1: Finalizar o processamento de um 3 vermelho que já foi iniciado.
        if (turnPhase === 'PROCESSING_RED_THREES') {
          dispatch({ type: 'COMPLETE_RED_THREE_PROCESSING' });
          return;
        }

        // ESTADO 2: Iniciar o processamento de um 3 vermelho, se houver.
        if (totalRedThreesOnBoard < 4 && currentPlayer.hand.some(c => c.isRedThree)) {
          dispatch({ type: 'PROCESS_RED_THREES' });
          return;
        }

        // ESTADO 3: Comprar uma carta.
        if (turnPhase === 'DRAW') {
          dispatch({ type: 'DRAW_FROM_DECK' });
          return;
        }
        
        // ESTADO 4: Fazer um jogo ou descartar.
        if (turnPhase === 'DISCARD') {
          const botHand = currentPlayer.hand;
          
          // Tenta fazer um jogo (meld)
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
              break; 
            }
          }
          
          if (cardsToMeldIds.length > 0) {
            dispatch({ type: "MELD", payload: { cardIds: cardsToMeldIds } });
            return;
          }

          // Se não fez meld, descarta
          const cardToDiscard = botHand
            .filter(c => !c.isWildcard)
            .sort((a,b) => getCardValue(a) - getCardValue(b))
            .pop() || botHand[0]; 

          if (cardToDiscard) {
            dispatch({ type: "DISCARD", payload: { cardId: cardToDiscard.id } });
          }
        }
      };

      setTimeout(handleBotTurn, 1200);
    }
  }, [gamePhase, currentPlayerIndex, players, turnPhase, dispatch, teams]);

  // Acknowledge a carta recém-comprada do monte após processar 3 vermelho
  useEffect(() => {
    if (lastDrawnCardId && turnPhase === "DRAW" && humanPlayer) {
      const newlyDrawnCard = humanPlayer.hand.find(c => c.id === lastDrawnCardId);
      if (newlyDrawnCard && !newlyDrawnCard.isRedThree) {
        setReplacementCardId(lastDrawnCardId);
        setTimeout(() => {
          dispatch({ type: "ACKNOWLEDGE_DRAWN_CARD" });
          setReplacementCardId(null);
        }, 3000);
      }
    }
  }, [lastDrawnCardId, turnPhase, humanPlayer, dispatch]);
  
  const meldableMeldIds = useMemo(() => {
    if (!humanPlayer || !playerTeam || selectedCards.length !== 1) {
      return [];
    }
    const selectedCard = humanPlayer.hand.find(c => c.id === selectedCards[0]);
    if (!selectedCard) {
      return [];
    }
    return playerTeam.melds
      .filter(meld => canAddToMeld(selectedCard, meld).canAdd)
      .map(meld => meld.id);
  }, [selectedCards, humanPlayer, playerTeam]);

  const isValidMeldSelection = (cardIds: string[]): boolean => {
    if (!humanPlayer || cardIds.length < 3) return false;
    const selectedCardsFromHand = humanPlayer.hand.filter((card) => cardIds.includes(card.id)) || [];
    if (selectedCardsFromHand.length !== cardIds.length) return false;
    const meldValidation = isValidMeld(selectedCardsFromHand);
    return meldValidation.isValid;
  };

  const partnerPlayer = players.find((p) => p.id === "player-2");
  const leftOpponentPlayer = players.find((p) => p.id === "player-1");
  const rightOpponentPlayer = players.find((p) => p.id === "player-3");

  const opponentTeam = teams.find((t) => !t.playerIds.includes("player-0"));

  const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isSelectionMeldable = isValidMeldSelection(selectedCards);

  const handleCardClick = (cardId: string) => {
    if (lastDrawnCardId && !justificationCardId) {
      dispatch({ type: "ACKNOWLEDGE_DRAWN_CARD" });
    }

    setSelectedCards(current => 
      current.includes(cardId) 
        ? current.filter(id => id !== cardId) 
        : [...current, cardId]
    );
  };
  
  const handleAddToMeld = (meldId: string) => {
    if (turnPhase === "MUST_JUSTIFY_DISCARD" && justificationCardId) {
      dispatch({ type: "ADD_TO_MELD", payload: { cardIds: [justificationCardId], meldId } });
      setSelectedCards([]);
      return;
    }
    if (selectedCards.length > 0 && turnPhase === "DISCARD") {
      dispatch({ type: "ADD_TO_MELD", payload: { cardIds: selectedCards, meldId } });
      setSelectedCards([]);
    }
  };

  const handleDiscardAreaClick = () => {
    if (isPlayerTurn && turnPhase === 'DRAW' && !isDiscardPileLocked) {
      dispatch({ type: "TAKE_DISCARD_PILE" });
      return;
    }
    if (isPlayerTurn && turnPhase === 'DISCARD' && selectedCards.length === 1) {
      dispatch({ type: "DISCARD", payload: { cardId: selectedCards[0] } });
      setSelectedCards([]);
      return;
    }
  };

  const handleMeldAreaClick = () => {
     if (!isPlayerTurn || (turnPhase !== "DISCARD" && turnPhase !== "MUST_JUSTIFY_DISCARD") || !isSelectionMeldable) return;
     dispatch({ type: "MELD", payload: { cardIds: selectedCards } });
     setSelectedCards([]);
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
      {/* Animação dos 3s vermelhos */}
      {animatingRedThree && (
        <RedThreeAnimation
          $isAnimating={true}
          style={{
            left: `${animatingRedThree.startPos.x}%`,
            top: `${animatingRedThree.startPos.y}%`,
            transform: `translate(${animatingRedThree.endPos.x - animatingRedThree.startPos.x}%, ${animatingRedThree.endPos.y - animatingRedThree.startPos.y}%)`,
          }}
        >
          <Box sx={{ 
            transform: 'scale(0.8)',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            '&:hover': {
              transform: 'scale(0.85)',
            }
          }}>
            <GameCard card={animatingRedThree.card} noInteraction />
          </Box>
        </RedThreeAnimation>
      )}

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
            <MeldAreaDisplay teamName="Jogos da Dupla Oponente" melds={opponentTeam?.melds ?? []} onMeldClick={handleMeldAreaClick} />
          </MeldContainer>

          <DeckAndDiscardContainer>
            <Box sx={{ position: "relative", cursor: isPlayerTurn && turnPhase === 'DRAW' ? "pointer" : "default" }} onClick={isPlayerTurn && turnPhase === 'DRAW' ? () => dispatch({ type: "DRAW_FROM_DECK" }) : undefined}>
              <Typography variant="caption" sx={{ position: "absolute", top: "-1.5rem", width: "100%", textAlign: "center" }}>Monte ({state.deck.length})</Typography>
              <OpponentCardBack />
            </Box>
            <Box sx={{ position: "relative", cursor: "pointer" }} onClick={handleDiscardAreaClick}>
              <Typography variant="caption" sx={{ position: "absolute", top: "-1.5rem", width: "100%", textAlign: "center" }}>Lixeira ({state.discardPile.length})</Typography>
              {isDiscardPileLocked && <LockIcon style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255, 255, 0, 0.8)', fontSize: '5rem', zIndex: 2 }} />}
              {topDiscard ? (
                <GameCard
                   card={topDiscard}
                   isDiscardValid={isPlayerTurn && turnPhase === 'DRAW' && isDiscardCardPotentiallyUseful(topDiscard)}
                />
              ) : (
                <DiscardPilePlaceholder />
              )}
            </Box>
          </DeckAndDiscardContainer>

          <MeldContainer onClick={handleMeldAreaClick} $isMeldable={isPlayerTurn && isSelectionMeldable}>
            <MeldAreaDisplay teamName="Seus Jogos" melds={playerTeam?.melds ?? []} onMeldClick={handleAddToMeld} highlightedMeldIds={meldableMeldIds} />
          </MeldContainer>
        </TableCenter>

        <PlayerArea $area="right-opponent" $isCurrentTurn={currentPlayerIndex === 3}>
          <Typography sx={{ mb: 1 }}>{rightOpponentPlayer?.name}</Typography>
          {rightOpponentPlayer && <OpponentPile count={rightOpponentPlayer.hand.length} />}
        </PlayerArea>

        <PlayerArea $area="human-player" $isCurrentTurn={isPlayerTurn}>
          <HandContainer $area="human-player">
            {humanPlayer?.hand.map((card, index) => (
              <Box
                key={card.id}
                sx={{
                  position: 'relative',
                  zIndex: index,
                  '&:hover': {
                    zIndex: 100,
                  }
                }}
              >
                {card.id === replacementCardId ? (
                  <ReplacementCardHighlight>
                    <GameCard
                      card={card}
                      onClick={handleCardClick}
                      isSelected={selectedCards.includes(card.id)}
                      isNewlyDrawn={card.id === lastDrawnCardId || card.id === justificationCardId || card.id === replacementCardId}
                      isJustificationCard={card.id === justificationCardId}
                    />
                  </ReplacementCardHighlight>
                ) : (
                  <GameCard
                    card={card}
                    onClick={handleCardClick}
                    isSelected={selectedCards.includes(card.id)}
                    isNewlyDrawn={card.id === lastDrawnCardId || card.id === justificationCardId || card.id === replacementCardId}
                    isJustificationCard={card.id === justificationCardId}
                  />
                )}
              </Box>
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
    <Suspense fallback={<div>Carregando...</div>}>
      <TrancaGame />
    </Suspense>
  );
}

export default TrancaGameWrapper; 
