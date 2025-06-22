"use client";

import { useState } from "react";
import { Box, Typography, Button, Card, CardContent, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Select, MenuItem } from "@mui/material";
import Grid from '@mui/material/Grid';
import styled from "styled-components";
import { useRouter } from "next/navigation";

const ConfigCard = styled(Card)`
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
`;

export default function TrancaConfig() {
  const router = useRouter();
  const [gameMode, setGameMode] = useState("bots");
  const [difficulty, setDifficulty] = useState("normal");

  const handleStartGame = () => {
    const params = new URLSearchParams({
      mode: gameMode,
      teams: "2v2", // Sempre 2v2
    });
    if (gameMode === 'bots') {
      params.append('difficulty', difficulty);
    }
    router.push(`/tranca/game?${params.toString()}`);
  };

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ background: "linear-gradient(135deg, #1976d2 0%, #fff 100%)" }}>
      <Typography variant="h2" fontWeight={700} color="primary" mb={2} textAlign="center">
        Configurar Partida de Tranca
      </Typography>
      <Typography variant="h5" color="text.secondary" mb={6} textAlign="center">
        Escolha como você quer jogar
      </Typography>
      
      <Grid container spacing={4} justifyContent="center" maxWidth={800}>
        <Grid xs={12} md={6}>
          <ConfigCard elevation={6}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight={600} color="primary" mb={3}>
                Modo de Jogo
              </Typography>
              <FormControl component="fieldset">
                <FormLabel component="legend">Contra quem você quer jogar?</FormLabel>
                <RadioGroup value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                  <FormControlLabel value="bots" control={<Radio />} label="Contra Robôs (IA)" />
                  <FormControlLabel value="online" control={<Radio />} label="Contra Usuários Online (Em breve!)" disabled />
                </RadioGroup>
              </FormControl>
            </CardContent>
          </ConfigCard>
        </Grid>
        
        <Grid xs={12} md={6}>
          <ConfigCard elevation={6}>
            <CardContent sx={{ p: 4, opacity: gameMode === 'bots' ? 1 : 0.5 }}>
              <Typography variant="h5" fontWeight={600} color="primary" mb={3}>
                Dificuldade da IA
              </Typography>
              <FormControl fullWidth component="fieldset" disabled={gameMode !== 'bots'}>
                <FormLabel component="legend">Selecione o nível dos oponentes</FormLabel>
                <Select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  variant="outlined"
                  sx={{ mt: 1 }}
                >
                  <MenuItem value="easy">Fácil</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="hard">Difícil</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </ConfigCard>
        </Grid>
      </Grid>
      
      <Box mt={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleStartGame}
        >
          Iniciar Jogo
        </Button>
      </Box>
    </Box>
  );
} 