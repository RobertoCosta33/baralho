"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  List,
  Chip
} from "@mui/material";
import styled from "styled-components";
import { 
  getRooms, 
  createRoom, 
  joinRoom, 
  getCurrentPlayerId,
  GameRoom,
  Player
} from "@/utils/multiplayer";

const LobbyArea = styled(Box)`
  min-height: 100vh;
  background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
  padding: 20px;
`;

const RoomCard = styled(Card)`
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
  }
`;

export default function LobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<GameRoom | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [currentPlayerId] = useState(getCurrentPlayerId());

  // Atualizar lista de salas periodicamente
  useEffect(() => {
    const updateRooms = () => {
      setRooms(getRooms());
    };

    updateRooms();
    const interval = setInterval(updateRooms, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = () => {
    if (!roomName.trim() || !playerName.trim()) return;

    const newRoom = createRoom(roomName, maxPlayers);
    joinRoom(newRoom.id, playerName);
    
    setShowCreateDialog(false);
    setRoomName("");
    setPlayerName("");
    
    // Navegar para a sala
    router.push(`/tranca/game?mode=online&room=${newRoom.id}&player=${playerName}`);
  };

  const handleJoinRoom = () => {
    if (!selectedRoom || !playerName.trim()) return;

    const success = joinRoom(selectedRoom.id, playerName);
    if (success) {
      setShowJoinDialog(false);
      setPlayerName("");
      setSelectedRoom(null);
      
      // Navegar para a sala
      router.push(`/tranca/game?mode=online&room=${selectedRoom.id}&player=${playerName}`);
    } else {
      alert("Não foi possível entrar na sala. Ela pode estar cheia.");
    }
  };

  const isPlayerInRoom = (room: GameRoom): boolean => {
    return room.players.some(player => player.id === currentPlayerId);
  };

  const getPlayerStatus = (player: Player): string => {
    const now = Date.now();
    const isOnline = now - player.lastSeen < 30000; // 30 segundos
    return isOnline ? "🟢 Online" : "🔴 Offline";
  };

  return (
    <LobbyArea>
      <Box display="flex" flexDirection="column" height="100vh">
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h3" color="white" fontWeight={700}>
            🎮 Lobby Multiplayer - Tranca
          </Typography>
          <Box display="flex" gap={2}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => setShowCreateDialog(true)}
              size="large"
            >
              Criar Sala
            </Button>
            <Button 
              variant="outlined" 
              color="inherit" 
              onClick={() => router.push("/tranca")}
              size="large"
            >
              Voltar
            </Button>
          </Box>
        </Box>

        {/* Salas Disponíveis */}
        <Box flex={1}>
          <Typography variant="h5" color="white" mb={2}>
            Salas Disponíveis ({rooms.length})
          </Typography>
          
          {rooms.length === 0 ? (
            <Card sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "white" }}>
              <CardContent>
                <Typography variant="h6" textAlign="center">
                  Nenhuma sala disponível. Crie uma nova sala para começar!
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <List>
              {rooms.map((room) => (
                <RoomCard key={room.id}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box flex={1}>
                        <Typography variant="h6" fontWeight="bold">
                          {room.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Criada em {new Date(room.createdAt).toLocaleString()}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip 
                            label={`${room.players.length}/${room.maxPlayers} jogadores`}
                            color={room.players.length >= room.maxPlayers ? "error" : "primary"}
                            size="small"
                          />
                          <Chip 
                            label={room.gameState.gameStarted ? "Em jogo" : "Aguardando"}
                            color={room.gameState.gameStarted ? "warning" : "success"}
                            size="small"
                          />
                          {isPlayerInRoom(room) && (
                            <Chip 
                              label="Você está aqui"
                              color="secondary"
                              size="small"
                            />
                          )}
                        </Box>
                      </Box>
                      
                      <Box textAlign="right">
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          Jogadores:
                        </Typography>
                        {room.players.map((player) => (
                          <Typography 
                            key={player.id} 
                            variant="body2"
                            color={player.id === currentPlayerId ? "primary" : "text.primary"}
                          >
                            {player.name} {getPlayerStatus(player)}
                          </Typography>
                        ))}
                        
                        {!isPlayerInRoom(room) && room.players.length < room.maxPlayers && (
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowJoinDialog(true);
                            }}
                            sx={{ mt: 1 }}
                          >
                            Entrar
                          </Button>
                        )}
                        
                        {isPlayerInRoom(room) && (
                          <Button
                            variant="contained"
                            color="secondary"
                            size="small"
                            onClick={() => {
                              router.push(`/tranca/game?mode=online&room=${room.id}&player=${room.players.find(p => p.id === currentPlayerId)?.name}`);
                            }}
                            sx={{ mt: 1 }}
                          >
                            Continuar
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </RoomCard>
              ))}
            </List>
          )}
        </Box>

        {/* Dialog Criar Sala */}
        <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Criar Nova Sala</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Nome da Sala"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Seu Nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Máximo de Jogadores"
              type="number"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              margin="normal"
              inputProps={{ min: 2, max: 6 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateRoom} variant="contained" color="primary">
              Criar e Entrar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog Entrar na Sala */}
        <Dialog open={showJoinDialog} onClose={() => setShowJoinDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Entrar na Sala</DialogTitle>
          <DialogContent>
            <Typography variant="body1" mb={2}>
              Entrando em: <strong>{selectedRoom?.name}</strong>
            </Typography>
            <TextField
              fullWidth
              label="Seu Nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              margin="normal"
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowJoinDialog(false)}>Cancelar</Button>
            <Button onClick={handleJoinRoom} variant="contained" color="primary">
              Entrar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LobbyArea>
  );
} 