import { Card } from '@/services/api';

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const cardValueMap: { [key: string]: number } = {
  'A': 13, 'K': 12, 'Q': 11, 'J': 10, '10': 9, '9': 8, '8': 7, '7': 6, '6': 5, '5': 4, '4': 3, '3': 2, '2': 1,
};

/**
 * Cria um baralho de Tranca padrão com 2 baralhos (104 cartas).
 * Os 2s são curingas, e os 3s pretos são trancas.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  // Criar dois baralhos
  for (let i = 0; i < 2; i++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        const id = `${value}-${suit}-${i}`;
        const isBlackSuit = suit === 'clubs' || suit === 'spades';
        const color = isBlackSuit ? 'black' : 'red';
        deck.push({
          id,
          suit,
          value,
          color,
          numericValue: cardValueMap[value] || 0,
          isWildcard: value === '2',
          isTranca: value === '3' && isBlackSuit,
          isRedThree: value === '3' && !isBlackSuit,
        });
      }
    }
  }
  return deck;
}

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Cria um baralho duplo (104 cartas), embaralha, e distribui.
 * @returns Um objeto com o baralho restante, as mãos dos 4 jogadores e os dois mortos.
 */
export function dealCards(): {
  deck: Card[];
  hands: [Card[], Card[], Card[], Card[]];
  deadPiles: [Card[], Card[]];
} {
  const deck = createDeck();
  const shuffledDeck = shuffleDeck(deck);

  const hands: Card[][] = [[], [], [], []];
  const deadPiles: Card[][] = [[], []];

  // Distribuir 11 cartas para cada um dos 4 jogadores
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 4; j++) {
      hands[j].push(shuffledDeck.pop()!);
    }
  }

  // Distribuir 11 cartas para cada um dos 2 mortos
  for (let i = 0; i < 11; i++) {
    deadPiles[0].push(shuffledDeck.pop()!);
    deadPiles[1].push(shuffledDeck.pop()!);
  }

  return {
    deck: shuffledDeck,
    hands: hands as [Card[], Card[], Card[], Card[]],
    deadPiles: deadPiles as [Card[], Card[]],
  };
}

export const drawCard = (deck: Card[]): { card: Card | null; remainingDeck: Card[] } => {
  if (deck.length === 0) {
    return { card: null, remainingDeck: [] };
  }
  
  const remainingDeck = [...deck];
  const card = remainingDeck.pop()!;
  
  return { card, remainingDeck };
};

export const isValidTrancaHand = (cards: Card[]): boolean => {
  // Verificar se há pelo menos 3 cartas do mesmo valor ou sequência
  const valueCounts: { [key: string]: number } = {};
  const suitCounts: { [key: string]: number } = {};
  
  cards.forEach(card => {
    valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  });
  
  // Verificar trinca (3 cartas do mesmo valor)
  const hasTrio = Object.values(valueCounts).some(count => count >= 3);
  
  // Verificar sequência (3 cartas consecutivas do mesmo naipe)
  const hasSequence = Object.keys(suitCounts).some(suit => {
    const suitCards = cards.filter(card => card.suit === suit);
    if (suitCards.length < 3) return false;
    
    const cardValues: number[] = suitCards.map(card => {
      const index: number = VALUES.indexOf(card.value);
      return index === -1 ? 0 : index;
    }).sort((a, b) => a - b);
    
    for (let i = 0; i <= cardValues.length - 3; i++) {
      if (cardValues[i + 1] === cardValues[i] + 1 && cardValues[i + 2] === cardValues[i] + 2) {
        return true;
      }
    }
    return false;
  });
  
  return hasTrio || hasSequence;
};

export const getCardPoints = (card: Card): number => {
  const value = card.value;
  if (['A', '2'].includes(value)) return 20;
  if (['K', 'Q', 'J', '10', '9', '8'].includes(value)) return 10;
  if (['7', '6', '5', '4', '3'].includes(value)) return 5;
  return 0;
};

export const calculateHandScore = (hand: Card[]): number => {
  return hand.reduce((total, card) => total + getCardPoints(card), 0);
};

export const getCardValue = (card: Card): number => {
  const valueMap: { [key: string]: number } = {
    'A': 14,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13
  };
  
  return valueMap[card.value] || 0;
}; 