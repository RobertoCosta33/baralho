import styled from "styled-components";
import { Card as MuiCard, Box } from "@mui/material";

export const OpponentCardBack = styled(MuiCard)`
  width: 90px;
  height: 130px;
  background: linear-gradient(45deg, #1a237e, #3949ab);
  border: 2px solid #fff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  cursor: pointer;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
`;

export const OpponentPile = ({ count }: { count: number }) => (
  <OpponentCardBack>
    <Box
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '3rem',
        borderRadius: 'inherit'
      }}
    >
      {count}
    </Box>
  </OpponentCardBack>
); 