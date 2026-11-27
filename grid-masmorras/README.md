# Montador de Masmorras por Grid

## 1. Visão geral

O **Montador de Masmorras** é uma aplicação web para criar mapas de masmorras de RPG sobre um grid de quadrados. O usuário desenha salas, adiciona portas nas paredes, conecta salas abrindo passagens entre elas e, se quiser, gera uma masmorra aleatória completa com um clique. O mapa pode ser exportado e importado como arquivo JSON.

A ferramenta prioriza a praticidade e a clareza visual. O mapa é formado por cores sólidas, sem texturas, imagens ou elementos gráficos complexos. A aplicação funciona inteiramente no navegador, sem backend, sem dependências externas e sem etapa de build.

O projeto está **implementado** e é composto por poucos arquivos estáticos: `index.html`, `css/style.css` e `js/app.js`.

## 2. Objetivo

Disponibilizar um editor visual de masmorras que permita:

- Criar salas por meio de seleção e arraste do mouse sobre o grid.
- Definir salas com diferentes dimensões, respeitando o alinhamento das células.
- Adicionar e remover portas em segmentos de parede existentes.
- Conectar salas por meio de uma passagem aberta (sem porta), unindo as áreas.
- Traçar um caminho sobre o grid, destacando as bordas das células percorridas, e limpá-lo quando quiser.
- Gerar uma masmorra aleatória com a quantidade de salas informada.
- Exportar e importar o mapa em formato JSON.
- Desfazer as últimas ações.
- Visualizar a estrutura da masmorra de maneira simples e organizada.

## 3. Tecnologias e restrições

O projeto utiliza exclusivamente recursos nativos da web:

- **HTML** para estruturar a interface.
- **CSS** para apresentação, cores, posicionamento e estados visuais.
- **JavaScript puro (Vanilla JS)** para implementar o grid, as ferramentas de edição, o gerador e as interações.

### Restrições técnicas

- Não utiliza frameworks ou bibliotecas externas (React, Vue, Angular, jQuery, etc.).
- Não depende de servidor, banco de dados ou processamento no backend.
- Não exige instalação nem etapa de build para executar o projeto.
- Mantém todos os arquivos necessários no próprio repositório.
- Pode ser publicada diretamente pelo **GitHub Pages**.

A aplicação funciona inteiramente no navegador. O GitHub Pages é responsável apenas por disponibilizar os arquivos estáticos.

## 4. Diretrizes visuais

A interface é minimalista e funcional, mantendo o foco no mapa, em **modo escuro** com superfícies neutras e destaque quente (laranja), seguindo o tema genérico compartilhado entre as ferramentas do hub.

- Cores sólidas para diferenciar os elementos da masmorra.
- Nenhuma textura, imagem de material ou fundo ilustrado.
- Grid sempre visível durante a edição, facilitando o posicionamento dos elementos.
- Diferenciação visual clara entre salas, paredes, portas e corredores.
- Painéis e botões compactos, que não competem visualmente com a área de trabalho.
- Paleta consistente, com contraste suficiente para distinguir cada elemento.

### Paleta atual

As cores de base provêm do tema genérico compartilhado em `../theme.css` (`:root`); a masmorra define apenas suas cores de domínio e apelidos locais em `css/style.css`.

| Variável | Cor | Origem | Uso |
| --- | --- | --- | --- |
| `--bg` | `#0e1116` | `../theme.css` | Fundo da página e do grid |
| `--surface` | `#171b23` | `../theme.css` | Fundo das barras (topo e status) |
| `--border` | `#2a303b` | `../theme.css` | Linhas do grid e contornos |
| `--text` / `--muted` | `#e9edf3` / `#98a1b0` | `../theme.css` | Texto principal e secundário |
| `--accent` | `#e8873c` | `../theme.css` | Ferramenta ativa e pré-visualização |
| `--danger` | `#e5484d` | `../theme.css` | Pré-visualização inválida |
| `--room` | `#3d3428` | `css/style.css` | Preenchimento das salas |
| `--corridor` | `#6b5836` | `css/style.css` | Células de corredor conectando salas |
| `--wall` | `#c2a47c` | `css/style.css` | Segmentos de parede |
| `--door` | `#e6a13a` | `css/style.css` | Segmentos de porta |
| `--path` | `#5cc8d6` | `css/style.css` | Cor base/fallback do caminho traçado; em uso, cada célula recebe uma cor da rampa do seletor (`js/picker.js`) |

As métricas principais são `--cell: 28px` (tamanho da célula), `--wall-thickness: 4px` e `--door-thickness: 7px`.

## 5. Estrutura da interface

A interface é composta por três áreas principais, empilhadas verticalmente: a barra de ferramentas (topo), a área de edição (workspace) e a barra de controles (inferior), com o gerador e o zoom alinhados na mesma linha.

### 5.1. Barra de ferramentas (topo)

Fixa no topo, contém:

- Os botões **Hub**, **Exportar** e **Importar**, na mesma ordem e estilo das demais ferramentas do hub.
- Cinco ferramentas de edição (botões mutuamente exclusivos, com estado ativo destacado):
  - **Criar sala** (`data-tool="room"`).
  - **Adicionar porta** (`data-tool="door"`).
  - **Conectar** (`data-tool="connect"`).
  - **Marcador** (`data-tool="marker"`).
  - **Traçar caminho** (`data-tool="path"`).
- A ação **Limpar caminho** — apaga o caminho traçado, ao lado da ferramenta de traçado.
- A ação **Limpar mapa** — apaga tudo, mediante confirmação.

### 5.2. Área de edição (workspace)

É a região principal da aplicação, contendo o grid no qual a masmorra é construída.

- O grid é formado por células quadradas uniformes (28px).
- A área de edição ocupa toda a tela disponível (ver seção 6.8).
- O grid é desenhado no fundo do `#stage`; sobre ele há sete camadas sobrepostas (`position: absolute`, `pointer-events: none`) que recebem o conteúdo:
  - `#layer-rooms` — preenchimento das salas.
  - `#layer-corridors` — células de corredor (trechos de conexão fora das salas).
  - `#layer-walls` — segmentos de parede.
  - `#layer-doors` — segmentos de porta.
  - `#layer-path` — bordas das células do caminho traçado.
  - `#layer-markers` — marcadores coloridos.
  - `#layer-preview` — pré-visualizações de sala e de trajeto.
- A interação é feita por **Pointer Events** diretamente sobre o `#stage`, com captura de ponteiro durante o arraste.

### 5.3. Barra de controles (inferior)

Barra sobreposta na base da área de trabalho, alinhando na mesma linha:

- O **gerador**: rótulo **Salas**, campo numérico `#room-count` (mínimo 1, máximo 200, valor inicial 6) e o botão **GERAR MASMORRA**.
- O **controle de zoom**: reduzir, indicador de nível (que também restaura para 100%) e aumentar.

O zoom usa os mesmos limites e passo da ferramenta de nós (`MIN_ZOOM = 0.4`, `MAX_ZOOM = 2.5`, `ZOOM_STEP = 1.25`), ancorado na posição do cursor. O deslocamento (pan) do mapa é feito com o **botão do meio** do mouse.

## 6. Funcionalidades principais

### 6.1. Criação de salas por seleção

Com a ferramenta **Criar sala** ativa, o usuário arrasta sobre o grid para definir a área da sala.

Comportamento atual:

1. O usuário pressiona o botão esquerdo do mouse sobre uma célula livre.
2. Enquanto arrasta, a área selecionada é destacada como prévia: **válida** em tom de destaque (`--accent`) e **inválida** em vermelho (`--danger`).
3. A seleção acompanha as células do grid, sem posicionamento livre entre elas; a célula atual é limitada ao grid durante o arraste.
4. Ao soltar o botão, se a área for válida, ela é convertida em uma sala (com preenchimento e paredes próprios).
5. **Clique simples em uma célula vazia** (sem arrastar) cria uma sala de 1x1.
6. **Clique simples em uma parede** (sem arrastar) alterna aquele segmento entre parede e porta — o mesmo atalho da ferramenta de porta.

A seleção é considerada **inválida** (e a sala não é criada) quando a área:

- Sobreponha qualquer sala existente.
- Sobreponha células ocupadas por um corredor (trecho de conexão fora das salas).
- Ultrapasse os limites do grid.

### 6.2. Paredes e portas

Cada sala tem paredes identificáveis em seu contorno. As paredes são tratadas como **segmentos individuais**, identificados por chaves de aresta:

- `h:col:linha` — segmento horizontal (borda superior ou inferior de uma célula).
- `v:col:linha` — segmento vertical (borda esquerda ou direita de uma célula).

Comportamento atual:

- Com a ferramenta **Adicionar porta**, clicar em um segmento de parede válido alterna seu estado entre parede e porta.
- O reconhecimento considera a borda da célula mais próxima do cursor, dentro de uma tolerância de 9px (`EDGE_TOL`), e apenas segmentos que **realmente são paredes**.
- **Segmentos já abertos por uma conexão (aberturas, ver 6.3) não são reconhecidos pelo cursor**: não é possível colocar uma porta sobre uma passagem aberta. O segmento também deixa de ser desenhado como parede.
- A porta ocupa apenas o segmento selecionado e é desenhada mais espessa e em cor própria (`--door`), sem alterar o restante da sala.
- Clicar novamente no mesmo segmento devolve o estado de parede (alternância).
- Ao passar o cursor sobre uma parede (com as ferramentas de sala ou porta), ela é destacada (classe `is-hover`).
- Sempre que as salas são reconstruídas (criação, geração, importação), portas e aberturas que não correspondem mais a um segmento de parede são descartadas automaticamente.

### 6.3. Conexão entre salas

Com a ferramenta **Conectar** ativa, o usuário arrasta de dentro de uma sala até outra sala. Diferente de uma versão anterior, **a conexão não cria portas**: ela remove os segmentos de parede ao longo do trajeto, de modo que as salas passam a formar uma **área contínua e única**.

Comportamento atual:

1. O arraste só inicia se o botão for pressionado **dentro de uma sala**; caso contrário, nada acontece.
2. Durante o arraste, a aplicação mostra uma **prévia do trajeto** (validada em cor de destaque ou inválida em vermelho).
3. Ao soltar sobre uma célula **pertencente a outra sala**, a conexão é criada.
4. O trajeto é desenhado como células de corredor (`--corridor`) nos trechos que ficam **fora** das salas.
5. Os **segmentos de parede atravessados pelo trajeto são abertos** — registrados em um conjunto de **aberturas** (`openings`) — e deixam de ser desenhados como parede, permitindo a passagem livre entre as áreas. Se um trecho atravessado tiver uma **porta**, ela é **removida** (a passagem aberta tem prioridade), evitando portas remanescentes sobre a abertura.

Regras do trajeto:

- A origem e o destino devem pertencer a salas diferentes.
- O trajeto é simples: primeiro na horizontal e depois na vertical, ou primeiro na vertical e depois na horizontal (o app tenta as duas opções e usa a primeira que for válida).
- O trajeto é inválido se atravessar qualquer sala que não seja a de origem e a de destino.
- O destino precisa cair em uma célula dentro do grid.

Observação sobre aberturas (`openings`): são distintas das portas. Enquanto a porta é um elemento visual (segmento espesso colorido) que ainda pertence à parede, a abertura **some** visualmente e bloqueia novas interações de porta/sala naquele ponto, garantindo que a passagem permaneça livre.

### 6.4. Pré-visualização das ações

Durante a criação de salas e de conexões, a aplicação mostra uma prévia antes de confirmar:

- Salas: retângulo prévio sobre as células que serão usadas.
- Conexões: conjunto de células do trajeto.
- A prévia distingue visualmente ação **válida** (tom de destaque) de **inválida** (vermelho).
- A prévia é removida ao cancelar (`Esc`), ao confirmar a ação ou ao trocar de ferramenta.

### 6.5. Desfazer (Ctrl+Z)

O editor mantém um **histórico de estados** em formato de snapshots JSON, com limite de **60 estados** (`HISTORY_LIMIT`). Ao exceder o limite, os estados mais antigos são descartados.

- Atalho: **Ctrl+Z** (ou **Cmd+Z** no macOS).
- Desfaz, uma etapa por vez, todas as operações que alteram o mapa: criar sala, alternar porta, criar conexão, criar/editar/remover/arrastar marcador, traçar/limpar caminho, limpar mapa, gerar masmorra, importar arquivo.
- O estado atual inclui salas, portas, aberturas, conexões, marcadores e o caminho traçado; ao desfazer, paredes, portas e aberturas são recalculadas e redesenhadas.
- O atalho é ignorado quando o foco está no campo numérico do gerador, para não interferir na edição do valor.

### 6.6. Geração aleatória de masmorra

O gerador (na barra de controles) cria uma masmorra completa com a quantidade de salas definida no campo numérico: um **aglomerado compacto** de salas pequenas, todas encostadas umas nas outras e unidas por passagens.

Ao clicar em **GERAR MASMORRA**:

1. O valor do campo é lido e normalizado: menores que 1 viram 1, e maiores que 200 viram 200 (`MAX_ROOMS`). O campo é reescrito com o valor ajustado.
2. O mapa atual é substituído por um novo (a operação entra no histórico e pode ser desfeita com Ctrl+Z).

Como a masmorra é construída:

- **Aglomerado compacto:** a primeira sala nasce no centro da área. Cada sala seguinte é encaixada **encostada** em uma sala já existente (compartilhando a parede); entre várias tentativas, vence o encaixe que **encosta em mais salas** e que fica **mais próximo do centro** do aglomerado — o que preenche os vãos e mantém o conjunto unido e arredondado.
- **Tamanho/forma da sala:** predominam as **tiras de 1 célula** de espessura — 1×1 (28%), tiras curtas 2×1/1×2 (38%), médias 3×1/1×3 (12%) e longas 4×1/1×4 (6%) — além de cômodos quadrados 2×2 (16%). A orientação (horizontal ou vertical) é sorteada a cada sala.
- **Espaço de encaixe:** a área disponível cresce com o número de salas solicitado (`span` proporcional à raiz do total); a compactação vem da escolha do melhor encaixe, não do limite de espaço.

**Regras das passagens** (aplicadas à aresta compartilhada entre duas salas encostadas):

1. Entre cada par de salas vizinhas, a parede vira passagem com probabilidade `OPEN_CHANCE` (~75%); as demais permanecem como parede. A escolha garante que **nenhuma sala fique isolada**, mantendo o conjunto ligado e criando **rotas alternativas (ciclos)**.
2. Cada passagem é randomizada entre **porta** (~8%, `DOOR_CHANCE`) e **abertura** (sem porta).
3. Uma passagem **não pode ficar ao lado de outra porta**: se ficar, permanece como **parede** (evita portas adjacentes).
4. Uma passagem **ao lado de uma abertura** vira **abertura**, alargando a passagem (2 células).

### 6.7. Exportar e importar

**Exportar** gera um arquivo `masmorra.json` com a estrutura:

```json
{
  "version": 1,
  "rooms": [{ "id": 1, "x": 2, "y": 3, "w": 4, "h": 5 }],
  "doors": ["h:2:3", "v:6:4"],
  "connections": [{ "id": 7, "from": 1, "to": 2, "cells": [{ "c": 2, "r": 3 }] }],
  "markers": [{ "id": 8, "c": 2, "r": 3, "color": "#ef4444", "label": "Tesouro" }],
  "path": ["16:9", "17:9", "18:9"]
}
```

O download é feito no navegador (Blob + `URL.createObjectURL`), sem backend.

**Importar** abre o seletor de arquivo (aceita `.json`) e, ao escolher o arquivo:

1. O conteúdo é parseado e validado: precisa ser um objeto com `rooms` e `connections` como arrays.
2. Cada sala precisa ter `x`, `y`, `w`, `h` inteiros e não negativos, com largura e altura ≥ 1.
3. Cada conexão precisa ter um array `cells` não vazio, com `c` e `r` inteiros.
4. Salas e conexões são recarregadas; em seguida, as **aberturas são recalculadas a partir das conexões** (o arquivo não guarda aberturas), garantindo a consistência visual de passagens sem porta.
5. As portas listadas em `doors` são restauradas apenas se ainda corresponderem a um segmento de parede existente.
6. Os marcadores em `markers` são restaurados quando possuem `c` e `r` inteiros; cor e texto ausentes assumem os padrões.
7. As células em `path` (chaves `col:linha`) são restauradas quando válidas; se o campo estiver ausente, o caminho fica vazio.
8. A operação entra no histórico e pode ser desfeita com Ctrl+Z.

Se o arquivo for inválido ou estiver corrompido, a aplicação exibe um alerta e mantém o mapa atual intacto.

### 6.8. Grid dinâmico

O grid se adapta à tela e ao conteúdo do mapa:

- Ao carregar e a cada redimensionamento da janela, o tamanho é recalculado para **preencher toda a área disponível**, considerando o padding do workspace.
- Há um mínimo de 4 colunas e 4 linhas (`MIN_CELLS`) para telas muito pequenas.
- Se o mapa (salas e conexões) ocupar mais espaço do que a tela, o grid **cresce além dela** o quanto for necessário, e o workspace passa a rolar.
- O recálculo em redimensionamentos é feito de forma econômica, via `requestAnimationFrame`.

### 6.9. Limpar mapa

O botão **Limpar mapa** remove todas as salas, portas, aberturas, conexões, marcadores e o caminho traçado. A ação pede confirmação antes de apagar e **é registrada no histórico**, portanto pode ser desfeita com Ctrl+Z. Se o mapa já estiver vazio, nada acontece.

### 6.10. Marcadores

Com a ferramenta **Marcador** ativa, o usuário pode anotar pontos de interesse no mapa (tesouro, entrada, chefe, etc.) como uma **bolinha colorida**.

- **Criar:** clique em uma célula **vazia** (sem marcador) para abrir o diálogo **Novo marcador**, informar um **texto opcional** e escolher a **cor**. Ao salvar, o marcador é encaixado no **centro da célula**.
- **Cor:** o seletor reaproveita o componente de cor da ferramenta de nós (`window.ColorPicker`), com dez cores predefinidas (swatches) e ajuste livre por HSV/hexadecimal.
- **Texto opcional:** quando informado, aparece em um pequeno rótulo acima da bolinha; sem texto, só a bolinha é desenhada.
- **Arrastar:** pressione sobre um marcador existente e arraste para movê-lo entre as salas; a posição **encaixa na grade** (snap por célula). O movimento é registrado no histórico.
- **Editar/remover:** um clique simples (sem arrastar) sobre um marcador abre **Editar marcador**, onde é possível alterar texto e cor ou **Remover** o marcador.

Cada célula comporta um marcador.

### 6.11. Caminho traçado

Com a ferramenta **Traçar caminho** ativa, o usuário desenha um caminho sobre o grid e o app **ressalta as bordas** de cada quadradinho percorrido, formando o contorno das células.

- **Traçar:** pressione o botão esquerdo sobre uma célula e arraste; cada célula atingida tem as suas **quatro bordas** realçadas por um contorno tracejado.
- **Cor por célula:** cada quadradinho do caminho recebe uma cor sólida, vinda de uma rampa montada em `app.js` (`buildPathRamp`) a partir da paleta fixa do seletor (`js/picker.js` → `PRESET_COLORS`), com **5 cores de transição** interpoladas entre cada par de cores.
- **Mudança gradual ao longo do traço:** a rampa é aplicada **em ordem**, célula a célula na sequência em que o caminho é traçado. Assim um caminho longo mostra várias cores, passando aos poucos de uma para a outra (ex.: verde → transições verde-amarelo → amarelo). A cor é fixa por célula (definida por `--path` inline); não há animação por tempo.
- **Linha contínua:** entre um movimento e outro, as células intermediárias são preenchidas (interpolação de Bresenham), de modo que arrastes rápidos não deixam falhas no traço.
- **Acumulativo:** o traço só cresce; passar novamente sobre células já marcadas não cria painéis duplicados.
- **Cruzamento — o mais recente vence:** quando um traço cruza outro, as células e bordas do cruzamento assumem a cor do traço **mais recente**. Para isso, em `paintPath` a célula repintada é removida e reinserida no fim da ordem do `Set` (assumindo a cor mais nova da rampa), e em `renderPath` as arestas compartilhadas ficam com a cor da **última** célula que as toca (o `Map` de bordas faz a sobrescrita), em vez de manter a primeira.
- **Limpar caminho:** o botão **Limpar caminho**, ao lado da ferramenta, apaga todo o traçado de uma vez (registrado no histórico, desfazível com Ctrl+Z).
- O caminho é desenhado acima das paredes e portas e abaixo dos marcadores, e é **salvo localmente** junto com o mapa (restaurado ao recarregar a página).
- Todo o traçado feito em um mesmo arraste conta como **uma única etapa** no histórico.

## 7. Modelo lógico dos elementos

O estado do editor é mantido em um único objeto (`state`) e o histórico em um array de snapshots.

### Sala

```js
{ id, x, y, w, h }   // posição no grid (em células) e dimensões
```

### Paredes, portas e aberturas

- Todas as paredes atuais ficam em `wallSegments` (um `Set` de chaves `h:col:linha` / `v:col:linha`), com um `wallMap` (`Map`) associando cada chave ao id da sala.
- As **portas** ficam em `doors` (um `Set` de chaves).
- As **aberturas** (passagens sem porta, criadas por conexões) ficam em `openings` (um `Set` de chaves). Um segmento em `openings` não é desenhado e não responde ao cursor.

### Conexão

```js
{ id, from, to, cells: [{ c, r }] }   // salas de origem/destino e células do trajeto
```

### Marcador

```js
{ id, c, r, color, label }   // célula (encaixe na grade), cor hexadecimal e texto opcional
```

### Caminho

- O caminho traçado fica em `path` (um `Set` de chaves `col:linha` das células marcadas).
- As bordas desenhadas são derivadas dessas células: para cada célula somam-se as quatro arestas (`h`/`v`) e as duplicadas são unificadas no desenho.
- A cor de cada célula vem de `buildPathRamp()` (paleta + 5 transições por par) e é aplicada **na ordem do `Set`** (ordem de traçado): a célula de posição `n` usa `ramp[n % ramp.length]`. Células repintadas são movidas para o fim da ordem (`delete` + `add`), assumindo a cor mais recente.
- As arestas compartilhadas entre células ficam com a cor da **última** célula que as toca (renderizadas a partir de um `Map` chave→cor, com sobrescrita), de forma que um cruzamento assume a cor do traço mais recente.

### Histórico

`history` guarda snapshots JSON com `{ rooms, doors, openings, connections, markers, path }`, limitado a 60 entradas.

A representação interna pode ser ajustada, desde que permita identificar os elementos e redesenhar o mapa sem inconsistências.

## 8. Organização dos arquivos

A masmorra é uma das ferramentas do hub, mantida em sua própria pasta. Estrutura simples, compatível com publicação estática:

```text
ÁrvoreNós/                (raiz do repositório / hub)
├── index.html            (hub de ferramentas)
├── theme.css             (paleta genérica compartilhada)
└── grid-masmorras/       (esta ferramenta)
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js
    │   └── picker.js
    └── README.md
```

- `index.html` (raiz): hub de ferramentas, com acesso a cada ferramenta.
- `theme.css` (raiz): tokens de cor genéricos, compartilhados por todas as ferramentas.
- `grid-masmorras/index.html`: estrutura da página e carregamento dos arquivos.
- `grid-masmorras/css/style.css`: aparência da interface, grid e estados visuais (usa os tokens de `../theme.css`).
- `grid-masmorras/js/app.js`: lógica de desenho, criação de salas, portas, conexões, marcadores, gerador, histórico (desfazer) e importação/exportação. Organizado por regiões (`#region`).
- `grid-masmorras/js/picker.js`: seletor de cor reaproveitado da ferramenta de nós, exposto como `window.ColorPicker` para uso em script clássico.
- `grid-masmorras/README.md`: instruções para executar e publicar o projeto.

Não é necessário utilizar ferramentas de compilação ou dependências externas.

## 9. Critérios de aceitação

- [x] A aplicação abre diretamente no navegador a partir dos arquivos estáticos.
- [x] A aplicação pode ser publicada e utilizada pelo GitHub Pages.
- [x] O grid é exibido de forma uniforme, preenche a tela e permite interação com o mouse.
- [x] É possível clicar e arrastar para selecionar uma área e criar uma sala.
- [x] As salas podem possuir dimensões diferentes e permanecem alinhadas ao grid.
- [x] As salas apresentam paredes identificáveis.
- [x] É possível clicar em um segmento de parede para transformá-lo em porta (e voltar a parede).
- [x] É possível iniciar uma conexão dentro de uma sala e arrastar até outra sala.
- [x] A conexão abre uma passagem sem porta, unindo as salas em uma área contínua.
- [x] A aplicação apresenta uma prévia das salas e conexões durante o arraste.
- [x] É possível gerar uma masmorra aleatória com a quantidade de salas informada.
- [x] É possível criar marcadores coloridos com texto opcional, arrastá-los entre as salas e editá-los/removê-los.
- [x] É possível traçar um caminho destacando as bordas das células percorridas e limpá-lo com um botão.
- [x] É possível desfazer as ações com Ctrl+Z.
- [x] É possível exportar e importar a masmorra em formato JSON.
- [x] O mapa utiliza apenas elementos visuais simples e cores sólidas, sem depender de imagens ou texturas.
- [x] A edição não permite sobreposição indevida de salas ou perda de elementos existentes.

## 10. Fora do escopo

Os itens abaixo não fazem parte da versão atual:

- Texturas, imagens, iluminação ou efeitos tridimensionais.
- Sistema de regras ou integração com algum sistema específico de RPG.
- Cadastro de monstros, armadilhas ou tesouros com atributos de jogo (os marcadores são apenas anotações visuais coloridas, sem regras).
- Colaboração em tempo real entre usuários.
- Backend, autenticação ou banco de dados.
- Exportação para formatos de imagem ou impressão.

## 11. Resultado

O projeto oferece um editor de masmorras leve, acessível pelo navegador e fácil de publicar no GitHub Pages. O usuário monta a estrutura de uma masmorra desenhando salas no grid, adicionando portas às paredes, conectando salas por passagens abertas, anotando pontos de interesse com marcadores coloridos e, opcionalmente, gerando uma masmorra aleatória. O mapa pode ser salvo e reaberto via JSON, e qualquer ação pode ser desfeita com Ctrl+Z, tudo com uma interface simples baseada em cores sólidas e tema escuro.

## 12. Como executar e publicar

### 12.1. Estrutura de arquivos

A ferramenta fica em sua própria pasta dentro do repositório, pronta para publicação estática:

```text
ÁrvoreNós/                (raiz do repositório / hub)
├── index.html            (hub de ferramentas)
├── theme.css             (paleta genérica compartilhada)
└── grid-masmorras/       (esta ferramenta)
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js
    │   └── picker.js
    └── README.md
```

### 12.2. Executar localmente

Basta abrir o arquivo `index.html` da raiz (hub) diretamente no navegador e escolher a ferramenta; o `grid-masmorras/index.html` também pode ser aberto diretamente. Nenhuma instalação, dependência ou etapa de build é necessária.

Caso prefira servir por HTTP (opcional), use qualquer servidor estático simples na raiz do repositório, por exemplo:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000` (hub) ou `http://localhost:8000/grid-masmorras/`.

### 12.3. Publicar no GitHub Pages

1. Envie os arquivos do projeto para o repositório no GitHub.
2. No repositório, abra **Settings → Pages**.
3. Em **Source**, selecione **Deploy from a branch**.
4. Selecione a branch **main** (ou a branch padrão) e a pasta **/ (root)**.
5. Salve e aguarde a publicação. A aplicação ficará disponível em:

```text
https://<usuario>.github.io/<repositorio>/
```

### 12.4. Uso rápido

- **Criar sala:** arraste sobre o grid para definir a área da sala. Um clique simples cria uma sala de 1 célula.
- **Adicionar porta:** clique em um segmento de parede para alternar entre parede e porta.
- **Conectar:** arraste de dentro de uma sala até outra sala para abrir uma passagem entre elas (sem porta).
- **Marcador:** clique em uma célula vazia para criar uma bolinha colorida (com texto opcional), arraste um marcador existente para movê-lo e clique nele para editar ou remover.
- **Traçar caminho:** arraste sobre o grid para destacar as bordas das células percorridas; use **Limpar caminho** para apagar todo o traçado.
- **Importar / Exportar:** carregue um `masmorra.json` ou baixe o mapa atual em JSON.
- **Limpar mapa:** remove todos os elementos criados, mediante confirmação.
- **GERAR MASMORRA:** informe a quantidade de salas no campo numérico e clique no botão na barra inferior.
- **Zoom / pan:** use os botões de zoom ou a roda do mouse (ancorada no cursor); arraste o mapa com o botão do meio do mouse.

### 12.5. Atalhos de teclado

| Atalho | Ação |
| --- | --- |
| `Ctrl+Z` / `Cmd+Z` | Desfazer a última ação (até 60 estados) |
| `Esc` | Cancelar a ação em andamento (arraste/prévia) |
