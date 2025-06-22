// Define os tipos de sons que podem ser tocados
export type SoundType = 'shuffle' | 'draw' | 'discard' | 'laydown' | 'win' | 'lose';

// Mapeia os tipos de som para os caminhos dos arquivos de áudio
const soundFiles: Record<SoundType, string> = {
  shuffle: '/sounds/shuffle.mp3',
  draw: '/sounds/card-draw.mp3',
  discard: '/sounds/card-discard.mp3',
  laydown: '/sounds/card-laydown.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
};

/**
 * Toca um efeito sonoro específico.
 * @param type - O tipo de som a ser tocado.
 * @param volume - O volume do som (0 a 1). O padrão é 0.5.
 */
export const playSound = (type: SoundType, volume: number = 0.5): void => {
  // Evita erros no lado do servidor (SSR)
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const audio = new Audio(soundFiles[type]);
    audio.volume = volume;
    
    // Tenta tocar o som e lida com possíveis erros
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // A interação do usuário pode ser necessária para tocar o som
        console.error(`Erro ao tocar o som (${type}):`, error);
      });
    }
  } catch (error) {
    console.error(`Não foi possível carregar o arquivo de som (${type}):`, error);
  }
}; 