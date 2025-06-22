# 🃏 Jogos de Cartas Online

Um site completo de jogos de cartas desenvolvido com Next.js, TypeScript, Material UI e Styled-Components.

## 🎮 Jogos Disponíveis

- **Tranca** ✅ (Disponível)
- Poker (Em breve)
- Black Jack (Em breve)
- Buraco (Em breve)
- Truco (Em breve)

## 🚀 Tecnologias Utilizadas

- **Next.js 15** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Material UI** - Componentes de interface
- **Styled-Components** - Estilização CSS-in-JS
- **Axios** - Cliente HTTP
- **JSON Server** - API REST simulada

## 📦 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd baralho
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Em outro terminal, inicie o JSON Server:
```bash
npm run server
```

5. Acesse [http://localhost:3000](http://localhost:3000)

## 🎯 Funcionalidades do Tranca

### Modos de Jogo
- **Contra Robôs**: Jogue contra IA
- **Online**: Jogue contra outros usuários (em desenvolvimento)

### Formatos
- **1 contra 1**: Partida individual
- **Dupla contra Dupla**: Partida em equipe

### Recursos
- Interface visual bonita e responsiva
- Animações fluidas nas cartas
- Lógica completa do jogo
- Persistência de dados com JSON Server
- Sistema de pontuação

## 🎨 Características Visuais

- Design moderno e intuitivo
- Gradientes coloridos
- Animações de hover e transição
- Cartas estilizadas com símbolos Unicode
- Layout responsivo para diferentes dispositivos

## 🔧 Estrutura do Projeto

```
src/
├── app/                 # Páginas do App Router
│   ├── page.tsx        # Página inicial
│   ├── layout.tsx      # Layout global
│   └── tranca/         # Páginas do jogo Tranca
│       ├── page.tsx    # Configuração da partida
│       └── game/       # Interface do jogo
├── services/           # Serviços de API
│   └── api.ts         # Cliente HTTP e interfaces
├── utils/             # Utilitários
│   └── cards.ts       # Lógica do baralho
└── components/        # Componentes reutilizáveis
```

## 🎲 Como Jogar Tranca

1. **Início**: Escolha o modo (robôs/online) e formato (1x1/2x2)
2. **Distribuição**: Cada jogador recebe 5 cartas
3. **Objetivo**: Formar jogos de 3+ cartas (trinca ou sequência)
4. **Ações**:
   - Comprar carta do monte
   - Descartar carta
   - Baixar jogos na mesa
5. **Vitória**: Primeiro a baixar todos os jogos vence

## 🚧 Próximos Passos

- [ ] Implementar lógica completa do Tranca
- [ ] Adicionar animações de cartas
- [ ] Criar sistema de IA para robôs
- [ ] Implementar modo online
- [ ] Adicionar outros jogos (Poker, Black Jack, etc.)
- [ ] Criar backend real com Node.js/Express

## 📝 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

---

Desenvolvido com ❤️ para amantes de jogos de cartas!
