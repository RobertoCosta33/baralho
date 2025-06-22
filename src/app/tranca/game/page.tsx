"use client";

import { useReducer, useEffect, useState, Suspense } from "react";
import { Box, Typography, Button } from "@mui/material";
import styled, { keyframes, css } from "styled-components";

import { Card as CardType } from "@/services/api";
import { dealCards, getCardValue } from "@/utils/cards";
import {
  Meld,
  isValidMeld,
  calculateRoundScore,
  CanastaType,
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

const PlayerArea = styled.div<{ area: string; $isCurrentTurn?: boolean }>`
  grid-area: ${(props) => props.area};
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

const MeldContainer = styled.div`
  min-height: 100px;
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 1rem;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
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
  turnPhase: "DRAW" | "MELD_OR_DISCARD" | "ENDED" | "MUST_JUSTIFY_DISCARD";
  gamePhase: "PLAYING" | "GAME_OVER";
  winner?: Team;
  lastDrawnCardId?: string | null;
  justificationCardId?: string | null;
}

type GameAction =
  | { type: "INITIALIZE_GAME" }
  | { type: "DRAW_FROM_DECK" }
  | { type: "DISCARD"; payload: { cardId: string } }
  | { type: "MELD"; payload: { cardIds: string[] } }
  | { type: "ADD_TO_MELD"; payload: { cardIds: string[]; meldId: string } }
  | { type: "TAKE_DISCARD_PILE" }
  | { type: "AI_TAKE_DISCARD_PILE" }
  | {
      type: "AI_MELD_AND_DISCARD";
      payload: { melds: Meld[]; discardCardId: string };
    }
  | { type: "ACKNOWLEDGE_DRAWN_CARD" }
  | { type: "SORT_HAND"; payload: { playerId: string; hand: CardType[] } };
// #endregion

// #region Game Reducer
function gameReducer(state: GameState, action: GameAction): GameState {
  function handleGameOver(beatingTeamId?: string): GameState {
    const finalState = {
      ...state,
      gamePhase: "GAME_OVER" as const,
      turnPhase: "ENDED" as const,
    };

    const team0 = finalState.teams[0];
    const team1 = finalState.teams[1];

    const unpickedPiles = finalState.deadPiles.filter((p) => p.length > 0);
    const team0DeadPilePenalty =
      !team0.hasPickedUpDeadPile && unpickedPiles.length > 0
        ? unpickedPiles.shift()
        : undefined;
    const team1DeadPilePenalty =
      !team1.hasPickedUpDeadPile && unpickedPiles.length > 0
        ? unpickedPiles.shift()
        : undefined;

    const team0Score = calculateRoundScore(
      team0,
      finalState.players,
      team0.id === beatingTeamId,
      team0DeadPilePenalty
    );
    const team1Score = calculateRoundScore(
      team1,
      finalState.players,
      team1.id === beatingTeamId,
      team1DeadPilePenalty
    );

    const finalTeams: [Team, Team] = [
      { ...team0, roundScore: team0Score, score: team0.score + team0Score },
      { ...team1, roundScore: team1Score, score: team1.score + team1Score },
    ];

    const winner = beatingTeamId
      ? finalTeams.find((t) => t.id === beatingTeamId)
      : team0Score > team1Score
      ? finalTeams[0]
      : team1Score > team0Score
      ? finalTeams[1]
      : undefined;

    return { ...finalState, teams: finalTeams, winner };
  }

  switch (action.type) {
    case "INITIALIZE_GAME": {
      const { deck, hands, deadPiles } = dealCards();

      const initialPlayers: Player[] = [
        { id: "player-0", name: "Você", hand: hands[0], isBot: false },
        {
          id: "player-1",
          name: "Oponente Esquerda",
          hand: hands[1],
          isBot: true,
        },
        { id: "player-2", name: "Parceiro", hand: hands[2], isBot: true },
        {
          id: "player-3",
          name: "Oponente Direita",
          hand: hands[3],
          isBot: true,
        },
      ];

      const teams: [Team, Team] = [
        {
          id: "team-0",
          playerIds: ["player-0", "player-2"],
          melds: [],
          score: state.teams[0].score,
          roundScore: 0,
          hasPickedUpDeadPile: false,
          redThrees: [],
        },
        {
          id: "team-1",
          playerIds: ["player-1", "player-3"],
          melds: [],
          score: state.teams[1].score,
          roundScore: 0,
          hasPickedUpDeadPile: false,
          redThrees: [],
        },
      ];

      initialPlayers.forEach((player) => {
        const redThreesInHand = player.hand.filter((c) => c.isRedThree);
        if (redThreesInHand.length > 0) {
          player.hand = player.hand.filter((c) => !c.isRedThree);

          const team = teams.find((t) => t.playerIds.includes(player.id))!;
          team.redThrees.push(...redThreesInHand);

          for (let i = 0; i < redThreesInHand.length; i++) {
            player.hand.push(deck.pop()!);
          }
        }
      });

      return {
        ...state,
        deck,
        players: initialPlayers,
        teams,
        deadPiles: deadPiles as [CardType[], CardType[]],
        discardPile: [],
        currentPlayerIndex: 0,
        turnPhase: "DRAW",
        gamePhase: "PLAYING",
        winner: undefined,
        lastDrawnCardId: null,
      };
    }
    case "DRAW_FROM_DECK": {
      if (state.turnPhase !== "DRAW" || state.deck.length === 0) return state;

      const newDeck = [...state.deck];
      const drawnCard = newDeck.pop()!;

      const newPlayers = [...state.players];
      const player = newPlayers[state.currentPlayerIndex];
      const newHand = [...player.hand, drawnCard];

      if (drawnCard.isRedThree) {
        const team = state.teams.find((t) => t.playerIds.includes(player.id))!;
        const newTeam = { ...team, redThrees: [...team.redThrees, drawnCard] };
        const newTeams: [Team, Team] =
          state.teams[0].id === newTeam.id
            ? [newTeam, state.teams[1]]
            : [state.teams[0], newTeam];

        const nextCard = newDeck.pop()!;
        newHand.push(nextCard);

        newPlayers[state.currentPlayerIndex] = {
          ...player,
          hand: newHand.filter((c) => c.id !== drawnCard.id),
        };

        return {
          ...state,
          deck: newDeck,
          players: newPlayers,
          teams: newTeams,
          lastDrawnCardId: nextCard.id,
        };
      }

      newPlayers[state.currentPlayerIndex] = { ...player, hand: newHand };

      return {
        ...state,
        deck: newDeck,
        players: newPlayers,
        turnPhase: "MELD_OR_DISCARD",
        lastDrawnCardId: drawnCard.id,
      };
    }
    case "DISCARD": {
      if (state.turnPhase !== "MELD_OR_DISCARD") return state;

      const player = state.players[state.currentPlayerIndex];
      const cardToDiscard = player.hand.find(
        (c) => c.id === action.payload.cardId
      );
      if (!cardToDiscard) return state;

      const newHand = player.hand.filter((c) => c.id !== action.payload.cardId);
      let newPlayers = state.players.map((p) =>
        p.id === player.id ? { ...p, hand: newHand } : p
      );

      const newDiscardPile = [...state.discardPile, cardToDiscard];
      let newTeams = state.teams;
      let newDeadPiles = state.deadPiles;
      let turnPhase = "DRAW";
      const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

      if (newHand.length === 0) {
        const playerTeam = state.teams.find((t) =>
          t.playerIds.includes(player.id)
        )!;
        if (
          playerTeam.hasPickedUpDeadPile ||
          state.deadPiles.every((p) => p.length === 0)
        ) {
          if (playerTeam.melds.some(m => m.canastaType === 'clean')) {
            return handleGameOver(playerTeam.id);
          }
          // Cannot win without a clean canasta, so can't discard last card
          return state; 
        } else {
          const [deadPile] = state.deadPiles.filter(
            (p) => p.length > 0
          );
          const newHandWithDeadPile = [...newHand, ...deadPile];
          newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHandWithDeadPile } : p);
          
          newTeams = state.teams.map((t) =>
            t.id === playerTeam.id ? { ...t, hasPickedUpDeadPile: true } : t
          ) as [Team, Team];
          
          newDeadPiles = state.deadPiles.map((p) =>
            p === deadPile ? [] : p
          ) as [CardType[], CardType[]];

          turnPhase = 'MELD_OR_DISCARD'; // Player continues their turn
        }
      }

      return {
        ...state,
        players: newPlayers,
        teams: newTeams,
        deadPiles: newDeadPiles,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextPlayerIndex,
        turnPhase: turnPhase as "DRAW" | "MELD_OR_DISCARD",
        isDiscardPileLocked: cardToDiscard.isTranca || cardToDiscard.isRedThree,
      };
    }
    case "MELD": {
      if (state.turnPhase !== "MELD_OR_DISCARD") return state;
      const { cardIds } = action.payload;
      const player = state.players[state.currentPlayerIndex];
      const team = state.teams.find(t => t.playerIds.includes(player.id))!;
      
      const cardsToMeld = player.hand.filter(c => cardIds.includes(c.id));
      if (cardsToMeld.length !== cardIds.length) return state;

      const meldValidation = isValidMeld(cardsToMeld);
      if (!meldValidation.isValid) return state;

      const newHand = player.hand.filter(c => !cardIds.includes(c.id));
      
      const newMeld: Meld = {
        id: `meld-${cardIds.sort().join('-')}`,
        cards: cardsToMeld,
        type: meldValidation.type!,
        canastaType: meldValidation.canastaType,
      };
      
      const newTeams: [Team, Team] = state.teams.map(t => t.id === team.id ? { ...t, melds: [...t.melds, newMeld] } : t) as [Team, Team];
      
      if (newHand.length === 0) {
         // Logic to pickup dead pile
      }
      
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);
      
      return { ...state, players: newPlayers, teams: newTeams };
    }
     case "ADD_TO_MELD": {
       if (state.turnPhase !== "MELD_OR_DISCARD") return state;
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
      
      if (newHand.length === 0) {
         // Logic to pickup dead pile
      }
      
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);

      return { ...state, players: newPlayers, teams: newTeams };
    }
     case "TAKE_DISCARD_PILE": {
      if (state.turnPhase !== "DRAW" || state.isDiscardPileLocked) return state;
      const player = state.players[state.currentPlayerIndex];
      const newHand = [...player.hand, ...state.discardPile];
      const newPlayers = state.players.map(p => p.id === player.id ? { ...p, hand: newHand } : p);

      return {
        ...state,
        players: newPlayers,
        discardPile: [],
        turnPhase: "MELD_OR_DISCARD",
      };
    }
    case "ACKNOWLEDGE_DRAWN_CARD": {
      return {
        ...state,
        lastDrawnCardId: null,
        justificationCardId: null,
      };
    }
    case "SORT_HAND": {
      const { playerId, hand } = action.payload;
      const player = state.players.find(p => p.id === playerId);
      if (!player) return state;
      const newPlayers = state.players.map(p =>
        p.id === playerId ? { ...p, hand } : p
      );
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

const MeldArea = ({
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {melds.map((meld) => {
          const sortedCards = getSmartSortedMeld(meld);
          const isHighlighted = highlightedMeldIds?.includes(meld.id);

          return (
            <Box
              key={meld.id}
              onClick={(e) => {
                if (onMeldClick) {
                  e.stopPropagation();
                  onMeldClick(meld.id);
                }
              }}
              sx={{
                cursor: onMeldClick ? "pointer" : "default",
                padding: "0.5rem",
                border: `2px solid ${
                  isHighlighted ? "#ffd700" : getBorderColor(meld.canastaType)
                }`,
                borderRadius: "8px",
                backgroundColor: isHighlighted
                  ? "rgba(255, 215, 0, 0.2)"
                  : "transparent",
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
      {
        id: "team-0",
        playerIds: ["player-0", "player-2"],
        melds: [],
        score: 0,
        roundScore: 0,
        hasPickedUpDeadPile: false,
        redThrees: [],
      },
      {
        id: "team-1",
        playerIds: ["player-1", "player-3"],
        melds: [],
        score: 0,
        roundScore: 0,
        hasPickedUpDeadPile: false,
        redThrees: [],
      },
    ],
    deck: [],
    discardPile: [],
    deadPiles: [[], []],
    currentPlayerIndex: 0,
    turnPhase: "DRAW",
    isDiscardPileLocked: false,
    gamePhase: "PLAYING",
    lastDrawnCardId: null,
    justificationCardId: null,
  });

  const {
    players,
    teams,
    discardPile,
    currentPlayerIndex,
    turnPhase,
    gamePhase,
    winner,
    lastDrawnCardId,
    justificationCardId,
  } = state;
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [highlightedMeldIds] = useState<string[]>([]);

  useEffect(() => {
    dispatch({ type: "INITIALIZE_GAME" });
  }, []);

  useEffect(() => {
    if (gamePhase !== "PLAYING") return;
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer?.isBot) {
      setTimeout(() => {
        // Mock bot logic
      }, 1000);
    }
  }, [gamePhase, currentPlayerIndex, players, dispatch]);

  const humanPlayer = players.find((p) => p.id === "player-0");
  const partnerPlayer = players.find((p) => p.id === "player-2");
  const leftOpponentPlayer = players.find((p) => p.id === "player-1");
  const rightOpponentPlayer = players.find((p) => p.id === "player-3");

  const playerTeam = teams.find((t) => t.playerIds.includes("player-0"));
  const opponentTeam = teams.find((t) => !t.playerIds.includes("player-0"));

  const topDiscard =
    discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isPlayerTurn = currentPlayerIndex === 0 && gamePhase === "PLAYING";

  const handleCardClick = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId));
    } else {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleAddToMeld = (meldId: string) => {
    if (selectedCards.length > 0) {
      dispatch({
        type: "ADD_TO_MELD",
        payload: { cardIds: selectedCards, meldId },
      });
      setSelectedCards([]);
    }
  };

  const handleDiscardPileClick = () => {
    if (
      turnPhase === "DRAW" &&
      discardPile.length > 0 &&
      !state.isDiscardPileLocked
    ) {
      dispatch({ type: "TAKE_DISCARD_PILE" });
    }
  };

  const sortBySuit = () => {
    if (!humanPlayer) return;
    const sortedHand = [...humanPlayer.hand].sort((a, b) => {
      const suitOrder: { [key: string]: number } = {
        hearts: 0,
        diamonds: 1,
        clubs: 2,
        spades: 3,
      };
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      return getCardValue(a) - getCardValue(b);
    });
    dispatch({
      type: "SORT_HAND",
      payload: { playerId: humanPlayer.id, hand: sortedHand },
    });
  };

  const sortByValue = () => {
    if (!humanPlayer) return;
    const sortedHand = [...humanPlayer.hand].sort(
      (a, b) => getCardValue(a) - getCardValue(b)
    );
    dispatch({
      type: "SORT_HAND",
      payload: { playerId: humanPlayer.id, hand: sortedHand },
    });
  };

  const sortBySequence = () => {
    if (!humanPlayer) return;
    const sortedHand = [...humanPlayer.hand].sort((a, b) => {
      const suitOrder: { [key: string]: number } = {
        hearts: 0,
        diamonds: 1,
        clubs: 2,
        spades: 3,
      };
      const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
      if (suitDiff !== 0) return suitDiff;
      return getCardValue(a) - getCardValue(b);
    });
    dispatch({
      type: "SORT_HAND",
      payload: { playerId: humanPlayer.id, hand: sortedHand },
    });
  };

  const isDiscardCardValidForMeld = (discardCard: CardType): boolean => {
    if (!humanPlayer) return false;
    
    // Verificar se a carta pode formar um jogo com as cartas da mão
    const handWithDiscard = [...humanPlayer.hand, discardCard];
    
    // Verificar se há pelo menos 3 cartas do mesmo valor (incluindo a do lixo)
    const valueGroups: { [key: string]: CardType[] } = {};
    handWithDiscard.forEach(card => {
      if (!valueGroups[card.value]) {
        valueGroups[card.value] = [];
      }
      valueGroups[card.value].push(card);
    });
    
    // Verificar se há algum grupo com 3 ou mais cartas
    for (const value in valueGroups) {
      if (valueGroups[value].length >= 3) {
        return true;
      }
    }
    
    // Verificar se pode formar uma sequência (mesmo naipe, valores consecutivos)
    const suitGroups: { [key: string]: CardType[] } = {};
    handWithDiscard.forEach(card => {
      if (!suitGroups[card.suit]) {
        suitGroups[card.suit] = [];
      }
      suitGroups[card.suit].push(card);
    });
    
    for (const suit in suitGroups) {
      if (suitGroups[suit].length >= 3) {
        const sortedCards = suitGroups[suit].sort((a, b) => getCardValue(a) - getCardValue(b));
        for (let i = 0; i <= sortedCards.length - 3; i++) {
          const sequence = sortedCards.slice(i, i + 3);
          const values = sequence.map(card => getCardValue(card));
          if (values[1] === values[0] + 1 && values[2] === values[1] + 1) {
            return true;
          }
        }
      }
    }
    
    return false;
  };

  const isValidMeldSelection = (cardIds: string[]): boolean => {
    if (!humanPlayer || cardIds.length < 3) return false;
    const selectedCardsFromHand =
      humanPlayer.hand.filter((card) => cardIds.includes(card.id)) || [];
    if (selectedCardsFromHand.length !== cardIds.length) return false;
    const meldValidation = isValidMeld(selectedCardsFromHand);
    return meldValidation.isValid;
  };

  const handleMeldAreaClick = () => {
    if (selectedCards.length >= 3 && isValidMeldSelection(selectedCards)) {
      dispatch({ type: "MELD", payload: { cardIds: selectedCards } });
      setSelectedCards([]);
    }
  };

  const handleDiscardPileClickWithSelection = () => {
    if (selectedCards.length === 1 && turnPhase === "MELD_OR_DISCARD") {
      dispatch({ type: "DISCARD", payload: { cardId: selectedCards[0] } });
      setSelectedCards([]);
    } else {
      handleDiscardPileClick();
    }
  };

  if (gamePhase === "GAME_OVER") {
    return (
      <GameArea>
        <Typography variant="h2">Fim de Jogo</Typography>
        <Typography variant="h4">
          {winner ? `Time Vencedor: ${winner.id}` : "Empate"}
        </Typography>
        <Button
          variant="contained"
          onClick={() => dispatch({ type: "INITIALIZE_GAME" })}
        >
          Jogar Novamente
        </Button>
      </GameArea>
    );
  }

  return (
    <GameArea>
      <ScoreDisplay position="left">
        <Typography>Sua Dupla: {playerTeam?.score ?? 0}</Typography>
        <Typography>3s Vermelhos: {playerTeam?.redThrees.length}</Typography>
      </ScoreDisplay>
      <ScoreDisplay position="right">
        <Typography>Dupla Oponente: {opponentTeam?.score ?? 0}</Typography>
        <Typography>3s Vermelhos: {opponentTeam?.redThrees.length}</Typography>
      </ScoreDisplay>

      <TableGrid>
        <PlayerArea area="partner">
          <Typography sx={{ mb: 1 }}>{partnerPlayer?.name}</Typography>
          <HandContainer $area="partner">
            {partnerPlayer?.hand.map((card) => (
              <OpponentCardBack key={card.id} />
            ))}
          </HandContainer>
        </PlayerArea>

        <PlayerArea
          area="left-opponent"
          $isCurrentTurn={currentPlayerIndex === 1}
        >
          <Typography sx={{ mb: 1 }}>{leftOpponentPlayer?.name}</Typography>
          {leftOpponentPlayer && (
            <OpponentPile count={leftOpponentPlayer.hand.length} />
          )}
        </PlayerArea>

        <TableCenter>
          <MeldContainer>
            <MeldArea
              teamName="Jogos da Dupla Oponente"
              melds={opponentTeam?.melds ?? []}
            />
          </MeldContainer>

          <DeckAndDiscardContainer>
            <Box
              sx={{ position: "relative", cursor: "pointer" }}
              onClick={() => dispatch({ type: "DRAW_FROM_DECK" })}
            >
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: "-1.5rem",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Monte ({state.deck.length})
              </Typography>
              <OpponentCardBack />
            </Box>
            <Box
              sx={{ position: "relative", cursor: "pointer" }}
              onClick={handleDiscardPileClickWithSelection}
            >
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: "-1.5rem",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Lixeira ({state.discardPile.length})
              </Typography>
              {topDiscard ? (
                <GameCard 
                  card={topDiscard} 
                  isDiscardValid={isDiscardCardValidForMeld(topDiscard)}
                />
              ) : (
                <DiscardPilePlaceholder />
              )}
            </Box>
          </DeckAndDiscardContainer>

          <MeldContainer
            onClick={handleMeldAreaClick}
          >
            <MeldArea
              teamName="Seus Jogos"
              melds={playerTeam?.melds ?? []}
              onMeldClick={handleAddToMeld}
              highlightedMeldIds={highlightedMeldIds}
            />
          </MeldContainer>
        </TableCenter>

        <PlayerArea
          area="right-opponent"
          $isCurrentTurn={currentPlayerIndex === 3}
        >
          <Typography sx={{ mb: 1 }}>{rightOpponentPlayer?.name}</Typography>
          {rightOpponentPlayer && (
            <OpponentPile count={rightOpponentPlayer.hand.length} />
          )}
        </PlayerArea>

        <PlayerArea area="human-player" $isCurrentTurn={isPlayerTurn}>
          <HandContainer $area="human-player">
            {humanPlayer?.hand.map((card) => (
              <GameCard
                key={card.id}
                card={card}
                onClick={handleCardClick}
                isSelected={selectedCards.includes(card.id)}
                isHighlighted={highlightedMeldIds.some((meldId) =>
                  playerTeam?.melds
                    .find((m) => m.id === meldId)
                    ?.cards.some((c) => c.id === card.id)
                )}
                isNewlyDrawn={
                  card.id === lastDrawnCardId || card.id === justificationCardId
                }
                isDrawnCard={
                  card.id === lastDrawnCardId || card.id === justificationCardId
                }
              />
            ))}
          </HandContainer>
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "100%",
              transform: "translateY(-50%)",
              marginLeft: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              zIndex: 10,
            }}
          >
            <Button
              variant="outlined"
              onClick={sortBySuit}
              sx={{
                minWidth: "auto",
                px: 1.2,
                py: 0.5,
                borderColor: "rgba(0, 0, 0, 0.2)",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                "&:hover": {
                  borderColor: "black",
                  backgroundColor: "rgba(255, 255, 255, 1)",
                },
              }}
            >
              <Box sx={{ display: "flex", gap: "3px", fontSize: "1rem" }}>
                <span style={{ color: "red" }}>♥</span>
                <span style={{ color: "red" }}>♦</span>
                <span style={{ color: "black" }}>♣</span>
                <span style={{ color: "black" }}>♠</span>
              </Box>
            </Button>
            <Button
              variant="outlined"
              onClick={sortByValue}
              sx={{
                minWidth: "auto",
                px: 1.2,
                py: 0.5,
                borderColor: "rgba(0, 0, 0, 0.2)",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                "&:hover": {
                  borderColor: "black",
                  backgroundColor: "rgba(255, 255, 255, 1)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: "1px",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                }}
              >
                <span style={{ color: "black" }}>1</span>
                <span style={{ color: "black" }}>2</span>
                <span style={{ color: "black" }}>3</span>
              </Box>
            </Button>
            <Button
              variant="outlined"
              onClick={sortBySequence}
              sx={{
                minWidth: "auto",
                px: 1.2,
                py: 0.5,
                borderColor: "rgba(0, 0, 0, 0.2)",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                "&:hover": {
                  borderColor: "black",
                  backgroundColor: "rgba(255, 255, 255, 1)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: "1px",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                }}
              >
                <span style={{ color: "black" }}>→</span>
                <span style={{ color: "black" }}>→</span>
                <span style={{ color: "black" }}>→</span>
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
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            backgroundColor: "#0c3b2e",
          }}
        >
          <Typography color="white">Carregando...</Typography>
        </Box>
      }
    >
      <TrancaGame />
    </Suspense>
  );
}

export default TrancaGameWrapper; 