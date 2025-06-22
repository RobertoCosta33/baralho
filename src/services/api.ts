import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
});

export interface Card {
  id: string;
  suit: string;
  value: string;
  color: string;
  numericValue: number;
  isWildcard: boolean;
  isRedThree: boolean;
  isTranca: boolean;
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  score: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  gamesPlayed: number;
  gamesWon: number;
}

export interface Game {
  id: number;
  type: string;
  mode: string;
  teamMode: string;
  status: string;
  players: Player[];
  deck: Card[];
  table: Card[];
  currentTurn: number;
  createdAt: string;
}

export const gameService = {
  // Buscar todos os jogos
  getGames: () => api.get<Game[]>('/games'),
  
  // Buscar um jogo específico
  getGame: (id: number) => api.get<Game>(`/games/${id}`),
  
  // Criar um novo jogo
  createGame: (game: Omit<Game, 'id' | 'createdAt'>) => api.post<Game>('/games', game),
  
  // Atualizar um jogo
  updateGame: (id: number, game: Partial<Game>) => api.put<Game>(`/games/${id}`, game),
  
  // Deletar um jogo
  deleteGame: (id: number) => api.delete(`/games/${id}`),
};

export const userService = {
  // Buscar todos os usuários
  getUsers: () => api.get<User[]>('/users'),
  
  // Buscar um usuário específico
  getUser: (id: number) => api.get<User>(`/users/${id}`),
  
  // Criar um novo usuário
  createUser: (user: Omit<User, 'id'>) => api.post<User>('/users', user),
  
  // Atualizar um usuário
  updateUser: (id: number, user: Partial<User>) => api.put<User>(`/users/${id}`, user),
};

export default api; 