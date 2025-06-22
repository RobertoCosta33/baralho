import { Card } from '@/services/api';
import { isValidTrancaHand } from './cards';
import { isValidMeld, Meld, canAddToMeld } from "./trancaRules";

/**
 * Encontra todas as combinações possíveis de um determinado tamanho em um array.
 * @param array - O array de onde extrair as combinações.
 * @param size - O tamanho de cada combinação.
 * @returns Um array de todas as combinações possíveis.
 */
const getCombinations = <T,>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  const f = (prefix: T[], array: T[]) => {
    for (let i = 0; i < array.length; i++) {
      const newPrefix = [...prefix, array[i]];
      if (newPrefix.length === size) {
        result.push(newPrefix);
      } else {
        f(newPrefix, array.slice(i + 1));
      }
    }
  };
  f([], array);
  return result;
};

/**
 * Encontra o melhor jogo (trinca ou sequência) que pode ser baixado da mão do oponente.
 * @param hand - A mão do oponente.
 * @returns O melhor jogo válido encontrado, ou null se nenhum jogo for encontrado.
 */
export const findBestGameToLayDown = (hand: Card[]): Card[] | null => {
  if (hand.length < 3) {
    return null;
  }

  let bestGame: Card[] | null = null;
  let bestGameSize = 0;

  // Tenta encontrar jogos de tamanhos decrescentes (de 7 até 3)
  for (let size = Math.min(hand.length, 7); size >= 3; size--) {
    const combinations = getCombinations(hand, size);
    for (const combo of combinations) {
      if (isValidTrancaHand(combo)) {
        // Prioriza o primeiro jogo válido encontrado (que será o maior)
        if (combo.length > bestGameSize) {
          bestGame = combo;
          bestGameSize = combo.length;
        }
      }
    }
    // Se um jogo foi encontrado neste tamanho, não precisa verificar tamanhos menores
    if (bestGame) {
      return bestGame;
    }
  }

  return bestGame;
};

// Função auxiliar para gerar combinações de um determinado tamanho
const combinations = (arr: Card[], size: number): Card[][] => {
  if (size > arr.length) return [];
  if (size === 0) return [[]];
  if (size === arr.length) return [arr];
  
  const [head, ...tail] = arr;
  const withHead = combinations(tail, size - 1).map(c => [head, ...c]);
  const withoutHead = combinations(tail, size);

  return [...withHead, ...withoutHead];
};

/**
 * Encontra o melhor conjunto de jogos (melds) que podem ser baixados de uma mão,
 * garantindo que nenhuma carta seja usada em mais de um jogo.
 * @param hand A mão de cartas a ser analisada.
 * @returns Um array com os jogos válidos e disjuntos para baixar.
 */
export function findValidMelds(hand: Card[]): Meld[] {
  if (hand.length < 3) {
    return [];
  }

  // 1. Encontra TODAS as combinações que são jogos válidos
  const allPossibleMelds: Meld[] = [];
  for (let i = 3; i <= Math.min(hand.length, 7); i++) {
    const combos = combinations(hand, i);
    for (const combo of combos) {
      const { isValid, type } = isValidMeld(combo);
      if (isValid) {
        // ID estável baseado no conteúdo do jogo
        const sortedCardIds = combo.map(c => c.id).sort().join('-');
        allPossibleMelds.push({
          id: `meld-${sortedCardIds}`,
          cards: combo,
          type: type!,
          canastaType: undefined,
        });
      }
    }
  }

  if (allPossibleMelds.length === 0) {
    return [];
  }

  // 2. Ordena os jogos para priorizar os maiores, que usam mais cartas
  allPossibleMelds.sort((a, b) => b.cards.length - a.cards.length);

  // 3. Seleciona de forma gulosa os jogos, garantindo que não haja sobreposição de cartas
  const finalMelds: Meld[] = [];
  const usedCardIds = new Set<string>();

  for (const meld of allPossibleMelds) {
    const hasOverlaps = meld.cards.some(card => usedCardIds.has(card.id));
    
    if (!hasOverlaps) {
      finalMelds.push(meld);
      meld.cards.forEach(card => usedCardIds.add(card.id));
    }
  }

  return finalMelds;
}

/**
 * Escolhe a melhor carta para descartar da mão. A estratégia é atribuir uma pontuação
 * a cada carta e descartar a que tiver a menor pontuação.
 * @param hand A mão de cartas atual do jogador.
 * @param ownMelds Os jogos que a equipe do jogador já tem na mesa.
 * @param opponentMelds Os jogos que a equipe oponente tem na mesa (para dificuldade 'hard').
 * @returns O ID da carta a ser descartada.
 */
export function chooseCardToDiscard(hand: Card[], ownMelds: Meld[], opponentMelds: Meld[] = []): string {
    if (hand.length === 0) return ''; 

    const cardScores: { [cardId: string]: number } = {};

    const handValues = hand.map(c => c.value);

    for (const card of hand) {
        let score = 0;

        // 1. Penalidade base pelo valor da carta (cartas mais altas são mais valiosas)
        score -= card.numericValue;

        // 2. Bônus por fazer parte de um par ou mais
        const countByValue = handValues.filter(v => v === card.value).length;
        if (countByValue === 2) score += 10; // Bônus por ter um par
        if (countByValue >= 3) score += 20; // Bônus alto por ter uma trinca na mão

        // 3. Bônus por potencial de sequência
        const hasNeighbor = hand.some(c => 
            c.suit === card.suit && 
            (c.numericValue === card.numericValue + 1 || c.numericValue === card.numericValue - 1)
        );
        if (hasNeighbor) score += 5;

        // 4. Bônus se a carta puder ser adicionada a um dos jogos da própria equipe
        const canAddOwn = ownMelds.some(meld => canAddToMeld(card, meld).canAdd);
        if (canAddOwn) score += 15;

        // 5. Penalidade ENORME se a carta serve para o oponente (modo hard)
        if (opponentMelds.length > 0) {
            const canAddOpponent = opponentMelds.some(meld => canAddToMeld(card, meld).canAdd);
            if (canAddOpponent) {
                score -= 100;
            }
        }
        
        // 6. Penalidade para 3s pretos (são valiosos para trancar o lixo)
        if (card.value === '3' && (card.suit === '♠' || card.suit === '♣')) {
          score += 50; // Quase nunca descarte um 3 preto
        }
        
        // 7. Penalidade para Curingas (2)
        if (card.value === '2') {
          score += 40; // Muito valioso para ser descartado
        }

        cardScores[card.id] = score;
    }

    // Encontra a carta com a menor pontuação
    let cardToDiscardId = hand[0].id;
    let minScore = Infinity;

    for (const cardId in cardScores) {
        if (cardScores[cardId] < minScore) {
            minScore = cardScores[cardId];
            cardToDiscardId = cardId;
        }
    }

    return cardToDiscardId;
} 