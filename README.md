# Brasa e Ruína (`sepe-souls`)

Protótipo de **soulslike 2D / metroidvania souls-lite** em visão lateral. Um andarilho de poncho
atravessa as ruínas de uma redução jesuítica num pampa decadente, sob névoa, enfrenta almas
penadas e, no fim da área, o **Boitatá**, a serpente de fogo da lenda.

Feito com Phaser 3 + TypeScript + Vite. Toda a arte é pixel art gerada por código (grade de 2 px)
e todo o som é sintetizado com Web Audio.

**Jogue no navegador:** https://dunkelhai.github.io/sepe-souls/

## Controles

| Tecla      | Ação                                                            |
| ---------- | --------------------------------------------------------------- |
| ← → / A D  | mover                                                           |
| ↑ / W      | pular (segure para pular mais alto)                             |
| Z / Espaço | ataque leve (combo de 3 golpes) · interagir com o fogão de chão |
| X / Shift  | esquiva com invencibilidade                                     |
| C          | beber o frasco de cura (3 cargas)                               |
| Esc        | pausa (com opção "Reduzir tremor/flash")                        |
| R          | reiniciar a run inteira                                         |

## Como jogar

- **Vida** (barra vermelha) e **fôlego** (barra ocre) ficam no canto superior esquerdo. Atacar e
  esquivar gastam fôlego; ele volta depois de uma breve pausa sem gastar.
- **Frascos** (3) curam 45 de vida. Ficam abaixo das barras.
- **Fogão de chão** (no meio da área, antes da porta do boss): chegue perto e aperte Z/Espaço.
  Ele acende, recupera a vida, recarrega os frascos e vira o seu ponto de retorno. Descansar de
  novo nele faz as almas penadas renascerem (o primeiro acendimento não), sempre a pelo menos
  300 px de você.
- **Almas penadas** (3): patrulham, perseguem quando o veem e, antes de atacar, os olhos ficam
  vermelhos e o corpo pisca. Aí é hora de esquivar.
- **Boitatá**: ao passar pela porta em arco, uma barreira de fogo fecha a arena e a barra de vida
  do boss aparece embaixo. Ataques, todos com aviso (a cabeça pisca em vermelho 3 vezes):
  - **Investida rasteira**: ele desce para um lado da arena, uma linha vermelha acende no chão e ele
    atravessa a arena rente ao solo. Pule por cima, suba numa das plataformas laterais ou esquive.
  - **Cuspe de fogo**: sobe e cospe bolas de fogo em arco (3 na fase 1, 5 na fase 2).
  - **Mergulho/erupção**: mergulha no chão; um brilho vermelho marca onde ele vai sair. Saia de cima.
    Na fase 2 são duas erupções seguidas.
  - Abaixo de 50% de vida entra na **fase 2**: ruge, fica com o fogo mais claro e intenso, e
    ataca mais rápido. Depois de cada ataque ele fica baixo e lento por um instante: é a janela
    para bater.
- **Derrota**: ao morrer aparece "VOCÊ CAIU"; Espaço (ou esperar ~3 s) volta ao último fogão aceso
  (ou ao início), com vida e frascos cheios. Inimigos renascem e o boss é reiniciado. R reinicia a
  run inteira.
- **Vitória**: matar o Boitatá mostra a tela de vitória com tempo, quedas e frascos usados.
  Espaço/R jogam de novo; Esc volta ao título.

## Como rodar

Requer Node ≥ 20.

```bash
npm install
npm run dev
```

Abra http://localhost:5173/sepe-souls/ (com atalhos de debug: http://localhost:5173/sepe-souls/?debug=1).

### Scripts

| Script            | O que faz                                                         |
| ----------------- | ----------------------------------------------------------------- |
| `npm run dev`     | servidor de desenvolvimento (Vite)                                |
| `npm run build`   | checagem de tipos (`tsc --noEmit`) + build de produção em `dist/` |
| `npm run preview` | serve o build de produção                                         |
| `npm run lint`    | ESLint + Prettier (checagem)                                      |
| `npm run format`  | formata tudo com Prettier                                         |

### Debug (`?debug=1`)

| Tecla | Efeito                                                                          |
| ----- | ------------------------------------------------------------------------------- |
| F1    | vitória imediata (mata o boss; se ele não estiver ativo, vence direto)          |
| F2    | morte imediata do jogador                                                       |
| F3    | teleporta para a frente da porta do boss (reinicia o boss se ele estiver ativo) |
| F4    | mostra/esconde o contador de FPS                                                |

Sem `?debug=1` nenhum desses atalhos funciona. O `Phaser.Game` fica exposto em `window.__game`
(ex.: `__game.scene.getScene('Game').boss.hp`).

## Estrutura

```
src/
  main.ts               espera as fontes e cria o Phaser.Game
  config/balance.ts     TODAS as constantes de balanceamento
  style/palette.ts      paleta do guia de estilo
  scenes/               Boot (gera texturas), Title, Game, UI (HUD/pausa/queda/vitória)
  entities/             Player, Ghost (alma penada), Boitata (boss)
  systems/              texturas procedurais, áudio, controles, juice, configurações
```

## Créditos

- Código, arte (gerada por código) e sons (sintetizados): este repositório, licença MIT.
- Fontes: [Cinzel](https://fonts.google.com/specimen/Cinzel) e
  [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), via Google Fonts (SIL Open Font License).
- Nenhum asset externo foi usado (nada de Kenney neste protótipo).
- O Boitatá é uma lenda do folclore brasileiro, de domínio público.

## Decisões

- **Nome do jogo**: o repositório se chama `sepe-souls`, mas o título exibido é **"Brasa e Ruína"**
  e o protagonista é um andarilho sem nome. Como o brief proíbe personagens reais, evitei usar o nome
  de uma figura histórica real no jogo. A redução e a área são inventadas ("Ruínas de Santa Cinza").
- **Pulo em ↑/W**: Z/Espaço é a ação principal (ataque/interagir) e X/Shift a secundária (esquiva),
  conforme os controles padronizados; o pulo ficou nas setas/WASD.
- **Frasco na tecla C** (não seta para baixo + ação), para não conflitar com o ataque e ser fácil de
  lembrar. Mostrado no título e no HUD.
- **Interagir x atacar**: perto do fogão (e no chão), Z/Espaço interage em vez de atacar.
- **Descansar no fogão aceso** recupera tudo e renasce as almas penadas (como no gênero). O primeiro
  acendimento não as renasce. Cada alma volta no ponto da sua patrulha mais distante do jogador e,
  se nenhum estiver a ≥ 300 px (`GHOST.safeRespawnDist`), espera invisível até o jogador se afastar.
  A mesma regra vale no respawn após a morte.
- **Contato com o boss só causa dano durante a investida e a erupção** (não no ócio nem na janela
  de punição), para o combate ser legível e justo.
- **Inimigos comuns são espectros que flutuam** sem colisão com o cenário (atravessam as ruínas),
  presos a uma faixa de patrulha. Golpes interrompem o preparo do ataque deles; durante a investida,
  só o terceiro golpe do combo interrompe.
- **Sem poços/queda mortal**: o chão é contínuo; a dificuldade vem do combate.
- **Hitstop** de 40 ms em cada acerto e 60 ms no terceiro golpe do combo.
- **F3 = teleporte**, como pedido no brief do jogo; por isso o contador de FPS sugerido no guia de
  estilo foi para **F4** (também só com `?debug=1`).
- **HUD do boss na base da tela** (abaixo da linha do chão), para não invadir a faixa central.
- **"Reduzir tremor/flash"** (menu de pausa) zera o shake e limita os flashes de tela a alpha 0,15.
- **Entrada robusta**: os toques de tecla são registrados por evento, então não se perdem mesmo
  se o fps cair.
- **Balanceamento** (em `src/config/balance.ts`): jogador 100 de vida; golpes de 12/12/22; boss com
  420 de vida e janelas de punição de ~1 s após cada ataque. Alvo: ~5–10 min para vencer.

## Próximos passos

- Animações com mais quadros (corrida, esquiva girando, morte do inimigo).
- Mais tipos de inimigo e uma segunda área conectada (o "vania" do metroidvania).
- Moeda de almas que cai ao morrer e pode ser recuperada.
- Trilha musical procedural e mixagem de áudio mais rica.
- Suporte a controle (gamepad) e remapeamento de teclas.
- Ajuste fino do balanceamento com testes de jogadores.

## Licença

MIT © 2026 dunkelhai
