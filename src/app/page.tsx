"use client";

import { Box, Typography, Button, Grid, Paper } from "@mui/material";
import styled from "styled-components";
import Image from "next/image";

const games = [
  {
    name: "Tranca",
    description: "Monte sua mesa e jogue Tranca online ou contra robôs!",
    image: "/tranca-card.svg",
    available: true,
  },
  {
    name: "Poker",
    description: "Em breve!",
    image: "/poker-card.svg",
    available: false,
  },
  {
    name: "Black Jack",
    description: "Em breve!",
    image: "/blackjack-card.svg",
    available: false,
  },
  {
    name: "Buraco",
    description: "Em breve!",
    image: "/buraco-card.svg",
    available: false,
  },
  {
    name: "Truco",
    description: "Em breve!",
    image: "/truco-card.svg",
    available: false,
  },
];

const CardPaper = styled(Paper)`
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover {
    transform: scale(1.04);
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
`;

export default function Home() {
  return (
    <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ background: "linear-gradient(135deg, #1976d2 0%, #fff 100%)" }}>
      <Typography variant="h2" fontWeight={700} color="primary" mb={2} textAlign="center">
        Jogos de Cartas Online
      </Typography>
      <Typography variant="h5" color="text.secondary" mb={6} textAlign="center">
        Escolha seu jogo favorito para começar
      </Typography>
      <Grid container spacing={4} justifyContent="center" maxWidth={900}>
        {games.map((game) => (
          <Grid item xs={12} sm={6} md={4} key={game.name}>
            <CardPaper elevation={game.available ? 6 : 1} sx={{ p: 3, opacity: game.available ? 1 : 0.5 }}>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <Image
                  src={game.image}
                  alt={game.name}
                  width={120}
                  height={120}
                  style={{ borderRadius: 12, objectFit: "cover", background: "#eee" }}
                />
                <Typography variant="h6" fontWeight={600} color="primary">
                  {game.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {game.description}
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!game.available}
                  href={game.available ? "/tranca" : undefined}
                  sx={{ mt: 1 }}
                >
                  {game.available ? "Jogar" : "Em breve"}
                </Button>
              </Box>
            </CardPaper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
