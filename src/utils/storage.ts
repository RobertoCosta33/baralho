import { Card as CardType } from "@/services/api";

// Define a interface para o estado salvo do jogo
export interface SavedGameState {
  playerHand: CardType[];
  opponentHand: CardType[];
  deck: CardType[];
  discardPile: CardType[];
  playerScore: number;
  opponentScore: number;
  currentTurn: 'player' | 'opponent';
  gameMode: string;
  teams: string;
  timestamp: number;
  version: string;
}

// Chave para o localStorage
const GAME_STORAGE_KEY = 'tranca_saved_game';
const GAME_VERSION = '1.0.0';

/**
 * Salva o estado atual do jogo no localStorage
 */
export const saveGameState = (state: Omit<SavedGameState, 'timestamp' | 'version'>): void => {
  if (typeof window === 'undefined') return;

  try {
    const gameState: SavedGameState = {
      ...state,
      timestamp: Date.now(),
      version: GAME_VERSION,
    };

    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
    console.log('Jogo salvo com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar o jogo:', error);
  }
};

/**
 * Carrega o estado salvo do jogo do localStorage
 */
export const loadGameState = (): SavedGameState | null => {
  if (typeof window === 'undefined') return null;

  try {
    const savedState = localStorage.getItem(GAME_STORAGE_KEY);
    if (!savedState) return null;

    const gameState: SavedGameState = JSON.parse(savedState);
    
    // Verifica se o jogo salvo não é muito antigo (mais de 24 horas)
    const isExpired = Date.now() - gameState.timestamp > 24 * 60 * 60 * 1000;
    if (isExpired) {
      localStorage.removeItem(GAME_STORAGE_KEY);
      return null;
    }

    return gameState;
  } catch (error) {
    console.error('Erro ao carregar o jogo salvo:', error);
    return null;
  }
};

/**
 * Verifica se existe um jogo salvo
 */
export const hasSavedGame = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(GAME_STORAGE_KEY) !== null;
};

/**
 * Remove o jogo salvo
 */
export const clearSavedGame = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GAME_STORAGE_KEY);
  console.log('Jogo salvo removido!');
};

/**
 * Obtém informações sobre o jogo salvo (sem carregar o estado completo)
 */
export const getSavedGameInfo = (): { timestamp: number; gameMode: string; teams: string } | null => {
  if (typeof window === 'undefined') return null;

  try {
    const savedState = localStorage.getItem(GAME_STORAGE_KEY);
    if (!savedState) return null;

    const gameState: SavedGameState = JSON.parse(savedState);
    return {
      timestamp: gameState.timestamp,
      gameMode: gameState.gameMode,
      teams: gameState.teams,
    };
  } catch {
    return null;
  }
}; 