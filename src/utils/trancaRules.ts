import { Card as CardType } from '../services/api';

// --- Tipos e Interfaces ---

export type MeldType = 'set' | 'run';
export type CanastaType = 'clean' | 'dirty' | 'real';

export interface Meld {
  id: string;
  cards: CardType[];
  type: MeldType;
  canastaType?: CanastaType;
}

export interface Team {
  id: string;
  playerIds: string[]; // Padronizado para playerIds
  melds: Meld[];
  score: number;
  hasPickedUpDeadPile: boolean;
  redThrees: CardType[];
}

interface Player {
  id: string;
  hand: CardType[];
}

// --- Funções de Validação de Jogos (Melds) ---

const cardValueMap: { [key: string]: number } = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

function getCardNumericValue(card: CardType): number {
  if (card.isWildcard) return 2; // Curinga
  return cardValueMap[card.value] || 0;
}

/**
 * Verifica se uma carta pode ser adicionada a um jogo existente.
 * @param card A carta a ser adicionada.
 * @param meld O jogo onde a carta pode ser adicionada.
 * @returns Um objeto contendo `canAdd` (booleano) e o `newMeld` (o novo jogo com a carta).
 */
export function canAddToMeld(card: CardType, meld: Meld): { canAdd: boolean, newMeld?: Meld } {
  const prospectiveMeldCards = [...meld.cards, card];
  const { isValid, type, canastaType } = isValidMeld(prospectiveMeldCards);

  if (isValid) {
    return { 
      canAdd: true,
      newMeld: { ...meld, cards: prospectiveMeldCards, type: type!, canastaType }
    };
  }
  return { canAdd: false };
}

/**
 * Verifica se o jogador pode justificar a compra da lixeira.
 * @param topCard A carta no topo da lixeira.
 * @param hand A mão do jogador.
 * @param melds Os jogos da equipe do jogador.
 * @returns true se a compra for justificável, false caso contrário.
 */
export function canJustifyDiscardPickup(topCard: CardType, hand: CardType[], melds: Meld[]): boolean {
  // 1. Check if it can be added to an existing meld
  for (const meld of melds) {
    const prospectiveMeld = [...meld.cards, topCard];
    if (isValidMeld(prospectiveMeld).isValid) {
      return true;
    }
  }
  
  // 2. Check if a new meld can be formed with it
  const handWithoutCard = hand.filter(c => c.id !== topCard.id);
  
  // Simplificação: tenta encontrar 2 cartas na mão que formem um jogo válido com a carta do lixo.
  // Uma lógica mais avançada poderia tentar todas as combinações.
  for (let i = 0; i < handWithoutCard.length; i++) {
    for (let j = i + 1; j < handWithoutCard.length; j++) {
      const prospectiveMeld = [topCard, handWithoutCard[i], handWithoutCard[j]];
      if (isValidMeld(prospectiveMeld).isValid) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Verifica se um conjunto de cartas forma um jogo válido (trinca ou sequência).
 */
export function isValidMeld(cards: CardType[]): { isValid: boolean, type: MeldType | null, canastaType?: CanastaType } {
  if (cards.length < 3) {
    return { isValid: false, type: null };
  }

  const wildcards = cards.filter(c => c.isWildcard);
  const regularCards = cards.filter(c => !c.isWildcard);

  if (regularCards.length === 0) {
    return { isValid: false, type: null };
  }

  // Validação para Jogo de Trinca (Set)
  const firstValue = regularCards[0].value;
  if (regularCards.every(c => c.value === firstValue)) {
    if (wildcards.length >= regularCards.length) {
      return { isValid: false, type: null };
    }
    const canastaType = cards.length >= 7 ? (wildcards.length > 0 ? 'dirty' : 'clean') : undefined;
    return { isValid: true, type: 'set', canastaType };
  }

  // Validação para Jogo de Sequência (Run)
  const firstSuit = regularCards[0].suit;
  if (regularCards.every(c => c.suit === firstSuit)) {
    const sortedRegulars = [...regularCards].sort((a, b) => getCardNumericValue(a) - getCardNumericValue(b));
    let gaps = 0;
    for (let i = 1; i < sortedRegulars.length; i++) {
      const diff = getCardNumericValue(sortedRegulars[i]) - getCardNumericValue(sortedRegulars[i - 1]);
      if (diff > 1) {
        gaps += (diff - 1);
      } else if (diff === 0) {
        return { isValid: false, type: null }; // No duplicate cards in a run
      }
    }

    if (gaps <= wildcards.length) {
       const canastaType = cards.length >= 7 ? (wildcards.length > 0 ? 'dirty' : 'clean') : undefined;
       return { isValid: true, type: 'run', canastaType };
    }
  }

  return { isValid: false, type: null };
}

/**
 * Verifica se o jogador pode pegar a carta do topo da lixeira.
 * Para pegar, o jogador deve ser capaz de usar a carta imediatamente em um novo jogo
 * (com pelo menos duas cartas da sua mão) ou em um jogo já existente na mesa de sua dupla.
 */
export function canPickupDiscard(
  hand: CardType[],
  discardTopCard: CardType,
  teamMelds: Meld[]
): boolean {
  if (!discardTopCard) return false;

  // 1. Tenta formar um novo jogo com a carta da lixeira e cartas da mão.
  // Pega todas as combinações de 2 cartas da mão do jogador.
  for (let i = 0; i < hand.length - 1; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const potentialMeld = [discardTopCard, hand[i], hand[j]];
      if (isValidMeld(potentialMeld).isValid) {
        return true; // Encontrou um novo jogo válido
      }
    }
  }

  // 2. Tenta adicionar a carta da lixeira a um jogo existente na mesa da dupla.
  for (const meld of teamMelds) {
    const potentialMeld = [...meld.cards, discardTopCard];
    if (isValidMeld(potentialMeld).isValid) {
      return true; // A carta pode ser adicionada a um jogo existente
    }
  }

  return false;
}


// --- Funções de Pontuação ---

const cardPoints: { [key: string]: number } = {
  'A': 15,
  '2': 10, // Curinga
  'K': 10, 'Q': 10, 'J': 10, '8': 10, '9': 10, '10': 10,
  '7': 5, '6': 5, '5': 5, '4': 5,
  '3': 100, // Penalidade do 3 preto, bônus do 3 vermelho
};

const canastaBonus: { [key in CanastaType]: number } = {
  clean: 200,
  dirty: 100,
  real: 500, // Exemplo, pode não ser usado
};

const BATE_BONUS = 100;
const DEAD_PILE_PENALTY = -100;
const RED_THREE_BONUS = 100;
const BLACK_THREE_IN_HAND_PENALTY = -100;


/**
 * Calcula a pontuação final de uma equipe no final da rodada.
 * @param team A equipe a ser pontuada.
 * @param partnerHand As cartas na mão do parceiro.
 * @param hasGoneOut Se esta equipe foi a que bateu.
 */
export function calculateRoundScore(
  team: Team,
  allPlayers: Player[],
  hasGoneOut: boolean,
  unpickedDeadPile?: CardType[]
): number {
  let totalScore = 0;

  // 1. Somar pontos dos jogos na mesa (melds)
  team.melds.forEach(meld => {
    meld.cards.forEach(card => {
      if (card.value === '3') return; // 3 vermelho não conta pontos aqui
      totalScore += cardPoints[card.value] || 0;
    });
    // Bônus de Canasta
    if (meld.canastaType) {
      totalScore += canastaBonus[meld.canastaType];
    }
  });

  // 2. Bônus da Batida
  if (hasGoneOut) {
    totalScore += BATE_BONUS;
  }

  // 3. Somar (subtrair) pontos das cartas na mão dos jogadores da equipe
  team.playerIds.forEach(playerId => {
    const player = allPlayers.find(p => p.id === playerId);
    if (player) {
      player.hand.forEach(card => {
        if (card.isTranca) { // 3 preto na mão
          totalScore += BLACK_THREE_IN_HAND_PENALTY;
        } else {
          totalScore -= (cardPoints[card.value] || 0);
        }
      });
    }
  });

  // 4. Bônus/Penalidade dos Três Vermelhos
  const hasCanasta = team.melds.some(meld => meld.canastaType);
  if (team.redThrees.length > 0) {
    if (hasCanasta) {
      totalScore += team.redThrees.length * RED_THREE_BONUS;
    } else {
      totalScore -= team.redThrees.length * RED_THREE_BONUS;
    }
  }
  
  // 5. Penalidade por não pegar o morto
  if (!team.hasPickedUpDeadPile) {
    totalScore += DEAD_PILE_PENALTY;
    // Além da penalidade, as cartas do morto não pego contam como negativas
    if (unpickedDeadPile) {
      unpickedDeadPile.forEach(card => {
        totalScore -= (cardPoints[card.value] || 0);
      });
    }
  }
  
  return totalScore;
}

// Adicionando o valor numérico ao tipo Card para uso em toda a aplicação
declare module '@/services/api' {
  interface Card {
    numericValue: number;
  }
} 