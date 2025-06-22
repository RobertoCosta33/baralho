import { Card as CardType } from "@/services/api";

// Tipos de canastra
export type CanastraType = 'limpa' | 'suja' | 'natural';

// Interface para um jogo baixado
export interface LaidDownGame {
  cards: CardType[];
  type: 'trinca' | 'sequencia' | 'canastra';
  canastraType?: CanastraType;
  isNatural?: boolean;
  score: number;
}

/**
 * Verifica se um conjunto de cartas forma uma canastra (7 cartas do mesmo valor)
 */
export const isCanastra = (cards: CardType[]): { isCanastra: boolean; type: CanastraType; isNatural: boolean } => {
  if (cards.length !== 7) {
    return { isCanastra: false, type: 'limpa', isNatural: false };
  }

  const firstValue = cards[0].value;
  const allSameValue = cards.every(card => card.value === firstValue);
  
  if (!allSameValue) {
    return { isCanastra: false, type: 'limpa', isNatural: false };
  }

  // Verifica se é uma canastra natural (sem coringas)
  const isNatural = !cards.some(card => card.value === 'Joker' || card.value === '2');
  
  // Verifica se é limpa (todas do mesmo naipe) ou suja (naipes diferentes)
  const firstSuit = cards[0].suit;
  const allSameSuit = cards.every(card => card.suit === firstSuit);
  
  let type: CanastraType = 'limpa';
  if (!allSameSuit) {
    type = 'suja';
  } else if (isNatural) {
    type = 'natural';
  }

  return { isCanastra: true, type, isNatural };
};

/**
 * Calcula a pontuação de uma canastra
 */
export const calculateCanastraScore = (type: CanastraType, isNatural: boolean): number => {
  switch (type) {
    case 'natural':
      return 500;
    case 'limpa':
      return isNatural ? 300 : 200;
    case 'suja':
      return isNatural ? 200 : 100;
    default:
      return 0;
  }
};

/**
 * Verifica se um conjunto de cartas pode ser adicionado a um jogo existente
 */
export const canAddToGame = (newCards: CardType[], existingGame: LaidDownGame): boolean => {
  if (existingGame.type === 'canastra') {
    // Para canastras, só pode adicionar se ainda não estiver completa
    return existingGame.cards.length < 7;
  }

  if (existingGame.type === 'trinca') {
    // Para trincas, pode adicionar cartas do mesmo valor
    const gameValue = existingGame.cards[0].value;
    return newCards.every(card => card.value === gameValue);
  }

  if (existingGame.type === 'sequencia') {
    // Para sequências, pode adicionar cartas que mantenham a sequência
    const sortedGame = [...existingGame.cards].sort((a, b) => {
      const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      return values.indexOf(a.value) - values.indexOf(b.value);
    });
    
    const sortedNew = [...newCards].sort((a, b) => {
      const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      return values.indexOf(a.value) - values.indexOf(b.value);
    });

    // Verifica se as novas cartas podem ser adicionadas ao início ou fim da sequência
    const firstGameValue = sortedGame[0].value;
    const lastGameValue = sortedGame[sortedGame.length - 1].value;
    const firstNewValue = sortedNew[0].value;
    const lastNewValue = sortedNew[sortedNew.length - 1].value;

    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const firstGameIndex = values.indexOf(firstGameValue);
    const lastGameIndex = values.indexOf(lastGameValue);
    const firstNewIndex = values.indexOf(firstNewValue);
    const lastNewIndex = values.indexOf(lastNewValue);

    // Pode adicionar antes do início ou depois do fim
    return firstNewIndex === firstGameIndex - 1 || lastNewIndex === lastGameIndex + 1;
  }

  return false;
};

/**
 * Regras do "lixo" - verifica se o jogador pode pegar o lixo
 */
export const canTakeDiscard = (discardPile: CardType[], playerHand: CardType[]): boolean => {
  if (discardPile.length === 0) return false;

  const topCard = discardPile[discardPile.length - 1];
  
  // Pode pegar o lixo se:
  // 1. Tem pelo menos uma carta na mão
  // 2. A carta do topo pode ser usada em um jogo válido
  
  // Verifica se a carta pode formar uma trinca
  const sameValueCards = playerHand.filter(card => card.value === topCard.value);
  if (sameValueCards.length >= 2) return true;

  // Verifica se a carta pode formar uma sequência
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const topCardIndex = values.indexOf(topCard.value);
  
  const adjacentValues = [];
  if (topCardIndex > 0) adjacentValues.push(values[topCardIndex - 1]);
  if (topCardIndex < values.length - 1) adjacentValues.push(values[topCardIndex + 1]);

  for (const value of adjacentValues) {
    const hasAdjacent = playerHand.some(card => card.value === value);
    if (hasAdjacent) return true;
  }

  return false;
};

/**
 * Calcula pontuação total considerando regras avançadas
 */
export const calculateAdvancedScore = (games: LaidDownGame[], remainingCards: CardType[]): number => {
  let totalScore = 0;

  // Pontuação dos jogos baixados
  for (const game of games) {
    totalScore += game.score;
  }

  // Penalidade por cartas restantes na mão
  const remainingPenalty = remainingCards.length * 10;
  totalScore -= remainingPenalty;

  return totalScore;
};

/**
 * Verifica se um jogo é válido para ser baixado
 */
export const isValidGameToLayDown = (cards: CardType[]): { isValid: boolean; type: string; score: number } => {
  if (cards.length < 3) {
    return { isValid: false, type: '', score: 0 };
  }

  // Verifica se é uma canastra
  const canastraCheck = isCanastra(cards);
  if (canastraCheck.isCanastra) {
    const score = calculateCanastraScore(canastraCheck.type, canastraCheck.isNatural);
    return { 
      isValid: true, 
      type: `Canastra ${canastraCheck.type}`, 
      score 
    };
  }

  // Verifica se é uma trinca
  const firstValue = cards[0].value;
  const isTrio = cards.every(card => card.value === firstValue);
  if (isTrio) {
    return { 
      isValid: true, 
      type: 'Trinca', 
      score: cards.length * 10 
    };
  }

  // Verifica se é uma sequência
  const sortedCards = [...cards].sort((a, b) => {
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    return values.indexOf(a.value) - values.indexOf(b.value);
  });

  const isSequence = sortedCards.every((card, index) => {
    if (index === 0) return true;
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const prevIndex = values.indexOf(sortedCards[index - 1].value);
    const currentIndex = values.indexOf(card.value);
    return currentIndex === prevIndex + 1;
  });

  if (isSequence) {
    return { 
      isValid: true, 
      type: 'Sequência', 
      score: cards.length * 10 
    };
  }

  return { isValid: false, type: '', score: 0 };
}; 