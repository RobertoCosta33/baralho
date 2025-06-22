import { CardContent, Typography } from "@mui/material";
import { Card as CardType } from '@/services/api';
import styled, { keyframes, css } from "styled-components";
import { Card } from "@mui/material";

const suitSymbols: { [key: string]: string } = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const pulseAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
`;

const glowAnimation = keyframes`
  0% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
  50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.8); }
  100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
`;

const justificationAnimation = keyframes`
  0% { 
    box-shadow: 0 0 5px rgba(255, 255, 224, 0.5);
    border-color: rgba(255, 255, 224, 0.8);
  }
  50% { 
    box-shadow: 0 0 20px rgba(255, 255, 224, 0.8);
    border-color: rgba(255, 255, 224, 1);
  }
  100% { 
    box-shadow: 0 0 5px rgba(255, 255, 224, 0.5);
    border-color: rgba(255, 255, 224, 0.8);
  }
`;

const StyledGameCard = styled(Card)<{ 
  $isRed?: boolean; 
  $isSelected?: boolean; 
  $isHighlighted?: boolean; 
  $isNewlyDrawn?: boolean;
  $isDiscardValid?: boolean;
  $isDrawnCard?: boolean;
  $isJustificationCard?: boolean;
  $noInteraction?: boolean;
}>`
  width: 90px;
  height: 130px;
  cursor: ${(props) => (props.$noInteraction ? "default" : "pointer")};
  transition: all 0.2s ease;
  overflow: hidden;
  background-color: ${(props) => {
    if (props.$isJustificationCard) return "rgba(255, 255, 224, 0.3)";
    return "white";
  }};
  border: ${(props) => {
    if (props.$isSelected) return "3px solid #2196f3";
    if (props.$isHighlighted) return "3px solid #4caf50";
    if (props.$isDiscardValid) return "3px solid #ff9800";
    if (props.$isDrawnCard) return "3px solid #ffd700";
    if (props.$isJustificationCard) return "3px solid rgba(255, 255, 224, 0.8)";
    return "1px solid #555";
  }};
  transform: ${(props) =>
    props.$isSelected ? "translateY(-10px)" : "none"};
  
  ${(props) =>
    props.$isDiscardValid &&
    css`
      animation: ${glowAnimation} 2s ease-in-out infinite;
    `}
  
  ${(props) =>
    props.$isDrawnCard &&
    css`
      animation: ${pulseAnimation} 1.5s ease-in-out infinite;
    `}

  ${(props) =>
    props.$isJustificationCard &&
    css`
      animation: ${justificationAnimation} 2s ease-in-out infinite;
    `}
  
  &:hover {
    transform: translateY(-10px) scale(1.05);
  }
`;

interface CardFaceProps {
  card: CardType;
}

const CardFace = ({ card }: CardFaceProps) => (
  <CardContent sx={{ 
    position: 'relative', 
    width: '100%', 
    height: '100%', 
    p: '4px', 
    boxSizing: 'border-box', 
    color: (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  }}>
    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
      {card.value}{suitSymbols[card.suit]}
    </Typography>
    <Typography 
      variant="h4" 
      component="div" 
      sx={{ 
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontWeight: 'bold', 
        fontSize: '4rem',
        lineHeight: 1,
        zIndex: 1,
        color: (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black',
        opacity: 0.85,
        pointerEvents: 'none',
      }}
    >
      {suitSymbols[card.suit]}
    </Typography>
  </CardContent>
);

export interface GameCardProps {
  card: CardType;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  isNewlyDrawn?: boolean;
  isDiscardValid?: boolean;
  noInteraction?: boolean;
  isHighlighted?: boolean;
  isDrawnCard?: boolean;
  isJustificationCard?: boolean;
}

export const GameCard = ({ 
  card, 
  onClick, 
  isSelected, 
  isNewlyDrawn, 
  isDiscardValid,
  noInteraction,
  isHighlighted,
  isDrawnCard,
  isJustificationCard,
}: GameCardProps) => {
  return (
    <StyledGameCard
      onClick={() => !noInteraction && onClick?.(card.id)}
      $isRed={card.suit === 'hearts' || card.suit === 'diamonds'}
      $isSelected={isSelected}
      $isHighlighted={isHighlighted}
      $isNewlyDrawn={isNewlyDrawn}
      $isDiscardValid={isDiscardValid}
      $isDrawnCard={isDrawnCard}
      $isJustificationCard={isJustificationCard}
      $noInteraction={noInteraction}
    >
      <CardFace card={card} />
    </StyledGameCard>
  );
}; 