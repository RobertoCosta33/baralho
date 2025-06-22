import { Card as CardType } from "@/services/api";

// Tipos para multiplayer
export interface Player {
  id: string;
  name: string;
  hand: CardType[];
  score: number;
  isOnline: boolean;
  lastSeen: number;
}

export interface GameRoom {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  gameState: {
    deck: CardType[];
    discardPile: CardType[];
    currentTurn: string;
    tableGames: CardType[][];
    gameStarted: boolean;
    gameOver: boolean;
    winner: string | null;
    hands?: { playerId: string; hand: CardType[] }[];
  };
  createdAt: number;
  lastActivity: number;
}

export interface GameMessage {
  type: 'join' | 'leave' | 'move' | 'chat' | 'game_state';
  playerId: string;
  data: {
    action?: string;
    cards?: CardType[];
    score?: number;
    message?: string;
    [key: string]: unknown;
  };
  timestamp: number;
}

// Chaves para localStorage
const ROOMS_KEY = 'tranca_rooms';
const MESSAGES_KEY = 'tranca_messages';
const PLAYER_ID_KEY = 'tranca_player_id';

/**
 * Gera um ID único para o jogador
 */
export const generatePlayerId = (): string => {
  return 'player_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Obtém ou cria o ID do jogador atual
 */
export const getCurrentPlayerId = (): string => {
  if (typeof window === 'undefined') return '';
  
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = generatePlayerId();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
};

/**
 * Cria uma nova sala de jogo
 */
export const createRoom = (roomName: string, maxPlayers: number = 4): GameRoom => {
  const room: GameRoom = {
    id: 'room_' + Math.random().toString(36).substr(2, 9),
    name: roomName,
    players: [],
    maxPlayers,
    gameState: {
      deck: [],
      discardPile: [],
      currentTurn: '',
      tableGames: [],
      gameStarted: false,
      gameOver: false,
      winner: null,
    },
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  const rooms = getRooms();
  rooms.push(room);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  
  return room;
};

/**
 * Obtém todas as salas disponíveis
 */
export const getRooms = (): GameRoom[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const roomsData = localStorage.getItem(ROOMS_KEY);
    return roomsData ? JSON.parse(roomsData) : [];
  } catch {
    return [];
  }
};

/**
 * Entra em uma sala
 */
export const joinRoom = (roomId: string, playerName: string): boolean => {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  
  if (!room || room.players.length >= room.maxPlayers) {
    return false;
  }

  const playerId = getCurrentPlayerId();
  const player: Player = {
    id: playerId,
    name: playerName,
    hand: [],
    score: 0,
    isOnline: true,
    lastSeen: Date.now(),
  };

  room.players.push(player);
  room.lastActivity = Date.now();
  
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  return true;
};

/**
 * Sai de uma sala
 */
export const leaveRoom = (roomId: string): void => {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  
  if (room) {
    const playerId = getCurrentPlayerId();
    room.players = room.players.filter(p => p.id !== playerId);
    room.lastActivity = Date.now();
    
    // Remove a sala se estiver vazia
    if (room.players.length === 0) {
      const updatedRooms = rooms.filter(r => r.id !== roomId);
      localStorage.setItem(ROOMS_KEY, JSON.stringify(updatedRooms));
    } else {
      localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    }
  }
};

/**
 * Obtém o estado atual de uma sala
 */
export const getRoomState = (roomId: string): GameRoom | null => {
  const rooms = getRooms();
  return rooms.find(r => r.id === roomId) || null;
};

/**
 * Envia uma mensagem para a sala
 */
export const sendMessage = (roomId: string, message: Omit<GameMessage, 'timestamp'>): void => {
  if (typeof window === 'undefined') return;
  
  const fullMessage: GameMessage = {
    ...message,
    timestamp: Date.now(),
  };

  const messagesKey = `${MESSAGES_KEY}_${roomId}`;
  const messages = getRoomMessages(roomId);
  messages.push(fullMessage);
  
  // Manter apenas as últimas 100 mensagens
  if (messages.length > 100) {
    messages.splice(0, messages.length - 100);
  }
  
  localStorage.setItem(messagesKey, JSON.stringify(messages));
};

/**
 * Obtém as mensagens de uma sala
 */
export const getRoomMessages = (roomId: string): GameMessage[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const messagesKey = `${MESSAGES_KEY}_${roomId}`;
    const messagesData = localStorage.getItem(messagesKey);
    return messagesData ? JSON.parse(messagesData) : [];
  } catch {
    return [];
  }
};

/**
 * Atualiza o estado do jogo em uma sala
 */
export const updateGameState = (roomId: string, gameState: Partial<GameRoom['gameState']>): void => {
  const rooms = getRooms();
  const room = rooms.find(r => r.id === roomId);
  
  if (room) {
    room.gameState = { ...room.gameState, ...gameState };
    room.lastActivity = Date.now();
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  }
};

/**
 * Simula um "polling" para verificar atualizações
 */
export const subscribeToRoom = (
  roomId: string, 
  callback: (room: GameRoom, messages: GameMessage[]) => void
): (() => void) => {
  let lastRoomState = '';
  let lastMessagesLength = 0;
  
  const interval = setInterval(() => {
    const room = getRoomState(roomId);
    const messages = getRoomMessages(roomId);
    
    if (room) {
      const currentRoomState = JSON.stringify(room);
      const currentMessagesLength = messages.length;
      
      if (currentRoomState !== lastRoomState || currentMessagesLength !== lastMessagesLength) {
        callback(room, messages);
        lastRoomState = currentRoomState;
        lastMessagesLength = currentMessagesLength;
      }
    }
  }, 1000); // Verifica a cada segundo
  
  return () => clearInterval(interval);
};

/**
 * Limpa salas antigas (mais de 24 horas)
 */
export const cleanupOldRooms = (): void => {
  const rooms = getRooms();
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  
  const activeRooms = rooms.filter(room => now - room.lastActivity < dayInMs);
  
  if (activeRooms.length !== rooms.length) {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(activeRooms));
  }
}; 