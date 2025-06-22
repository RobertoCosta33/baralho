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

export function getCardNumericValue(card: CardType): number {
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

  // Regra: 3 preto (Tranca) e 3 vermelho não podem ser usados em jogos.
  if (cards.some(c => c.isTranca || c.isRedThree)) {
    return { isValid: false, type: null };
  }

  const wildcards = cards.filter(c => c.isWildcard);
  const regularCards = cards.filter(c => !c.isWildcard);

  // Regra: Não pode haver mais de 1 coringa por jogo.
  if (wildcards.length > 1) {
    return { isValid: false, type: null };
  }
  
  if (regularCards.length === 0) {
    return { isValid: false, type: null };
  }

  // Validação para Jogo de Trinca (Set)
  const firstValue = regularCards[0].value;
  if (regularCards.every(c => c.value === firstValue)) {
    // Regra: Um jogo de coringas puros não é válido se forem todos do mesmo valor
    // A regra de `wildcards.length > 1` já previne isso, mas é uma checagem de segurança.
    if (wildcards.length >= regularCards.length && regularCards.length > 0) {
      return { isValid: false, type: null };
    }
    const canastaType = cards.length >= 7 ? (wildcards.length > 0 ? 'dirty' : 'clean') : undefined;
    return { isValid: true, type: 'set', canastaType };
  }

  // Validação para Jogo de Sequência (Run)
  const firstSuit = regularCards[0].suit;
  if (regularCards.every(c => c.suit === firstSuit)) {
    const sortedRegulars = [...regularCards].sort((a, b) => getCardNumericValue(a) - getCardNumericValue(b));
    
    // Verifica se há cartas duplicadas na sequência
    for (let i = 0; i < sortedRegulars.length - 1; i++) {
      if (getCardNumericValue(sortedRegulars[i]) === getCardNumericValue(sortedRegulars[i + 1])) {
        return { isValid: false, type: null }; // Duplicatas não são permitidas em sequências
      }
    }

    const requiredWildcards = (getCardNumericValue(sortedRegulars[sortedRegulars.length - 1]) - getCardNumericValue(sortedRegulars[0])) - (sortedRegulars.length - 1);
    
    if (requiredWildcards <= wildcards.length) {
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
  'A': 10,
  '2': 10, // Curinga
  'K': 10, 'Q': 10, 'J': 10, '8': 10, '9': 10, '10': 10,
  '7': 10, '6': 10, '5': 10, '4': 10,
  '3': 100, // Penalidade do 3 preto, bônus do 3 vermelho
};

const canastaBonus: { [key in CanastaType]: number } = {
  clean: 200,
  dirty: 100,
  real: 500, // Exemplo, pode não ser usado
};

const BATE_BONUS = 100;
const RED_THREE_BONUS = 100;
const RED_THREE_PENALTY = -100;
const BLACK_THREE_IN_HAND_PENALTY = -100;


/**
 * Calcula a pontuação em tempo real de uma equipe com base nos jogos na mesa.
 * @param team A equipe a ser pontuada.
 */
export function calculateLiveScore(team: Team): number {
  let score = 0;
  const teamHasCanasta = team.melds.some(m => !!m.canastaType);

  // 1. Pontos das cartas nos jogos
  team.melds.forEach(meld => {
    meld.cards.forEach(card => {
      score += cardPoints[card.value] || 0;
    });
  });

  // 2. Bônus de Canasta
  team.melds.forEach(meld => {
    if (meld.canastaType) {
      score += canastaBonus[meld.canastaType];
    }
  });

  // 3. Pontos dos 3s Vermelhos
  if (team.redThrees.length > 0) {
    const redThreeScore = teamHasCanasta ? RED_THREE_BONUS : RED_THREE_PENALTY;
    score += team.redThrees.length * redThreeScore;
  }

  return score;
}

/**
 * Calcula a pontuação final de uma equipe no final da rodada.
 * @param team A equipe a ser pontuada.
 * @param allPlayers Todos os jogadores.
 * @param hasGoneOut Se esta equipe foi a que bateu.
 */
export function calculateRoundScore(
  team: Team,
  allPlayers: Player[],
  hasGoneOut: boolean
): number {
  let roundScore = 0;

  // 1. Soma dos pontos das cartas nos jogos (melds) da equipe.
  team.melds.forEach(meld => {
    meld.cards.forEach(card => {
      roundScore += cardPoints[card.value] || (card.isWildcard ? 10 : 0); // Pontuação para cartas normais e coringas (2).
    });
  });

  // 2. Soma dos bônus de canastra.
  team.melds.forEach(meld => {
    if (meld.canastaType) {
      roundScore += canastaBonus[meld.canastaType];
    }
  });

  // 3. Bônus por bater.
  if (hasGoneOut) {
    roundScore += BATE_BONUS;
  }

  // 4. Deduz os pontos das cartas que sobraram nas mãos dos jogadores da equipe.
  const teamPlayers = allPlayers.filter(p => team.playerIds.includes(p.id));
  teamPlayers.forEach(player => {
    player.hand.forEach(card => {
      if (card.isTranca) {
        roundScore += BLACK_THREE_IN_HAND_PENALTY; // Penalidade específica para 3 preto na mão.
      } else {
        roundScore -= cardPoints[card.value] || (card.isWildcard ? 10 : 0);
      }
    });
  });
  
  // 5. Pontuação dos 3s Vermelhos.
  if (team.redThrees.length > 0) {
    const hasAnyCanasta = team.melds.some(m => m.canastaType);
    if (hasAnyCanasta) {
      roundScore += team.redThrees.length * RED_THREE_BONUS;
    } else {
      // Se não tem canastra, cada 3 vermelho conta como penalidade.
      roundScore += team.redThrees.length * RED_THREE_PENALTY;
    }
  }

  // 6. Penalidade do morto (se a equipe adversária bateu e esta equipe não pegou o morto).
  // Esta lógica precisa ser aplicada fora, no reducer, pois depende do estado da outra equipe.
  // Mas para o caso de batida indireta, podemos ter uma indicação.
  // Assumimos que o reducer vai verificar se !team.hasPickedUpDeadPile && !hasGoneOut
  if (!team.hasPickedUpDeadPile && !hasGoneOut) {
     // A lógica principal de -100 pontos para o time que não bateu e não pegou o morto
     // será inferida pelo `handleGameOver` no reducer, que verifica qual time bateu.
     // No entanto, a regra da "batida indireta" precisa ser considerada.
     // A implementação atual no reducer já cobre o cenário de não ter pego o morto.
     // Se uma equipe não pegou o morto, ela simplesmente não soma os 100 da batida
     // e paga as cartas da mão. A penalidade de -100 é aplicada à dupla que NÃO BATEU e não pegou o morto.
     
     // O `handleGameOver` no `page.tsx` precisa ser ajustado para essa lógica.
     // Aqui, apenas calculamos os pontos base da equipe. O reducer fará o resto.
  }
  
  return roundScore;
}

// Adicionando o valor numérico ao tipo Card para uso em toda a aplicação
declare module '@/services/api' {
  interface Card {
    numericValue: number;
  }
} 