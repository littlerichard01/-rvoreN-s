# ÁrvoreNós

# Documento de Descrição do Projeto
## Aplicação Web de Criação e Conexão de Nós

### 1. Apresentação

O projeto consiste no desenvolvimento de uma aplicação web destinada à criação, edição, organização e conexão visual de nós em um quadro de trabalho.

A aplicação permitirá que o usuário crie elementos denominados nós, atribuindo a cada um um texto identificador e uma cor personalizada. Esses elementos serão apresentados graficamente como círculos, podendo ser posicionados livremente no quadro e conectados uns aos outros por meio de linhas.

A interação com a aplicação será dividida em dois modos de operação: edição e conexão. Cada modo possuirá um comportamento específico para os cliques realizados sobre os nós.

Além das funcionalidades de criação e organização, a aplicação deverá oferecer recursos de exportação e importação dos dados, permitindo salvar estruturas completas em arquivos e recuperá-las posteriormente.

O sistema deverá ser simples, intuitivo, independente de infraestrutura de servidor e compatível com hospedagem estática, especialmente por meio do GitHub Pages.

### 2. Objetivo do sistema

Desenvolver uma ferramenta visual que permita ao usuário criar e organizar conjuntos de nós interconectados.

A aplicação deverá oferecer liberdade para posicionar os elementos no quadro, estabelecer conexões entre eles, personalizar sua aparência e transportar suas estruturas por meio de arquivos.

O objetivo é proporcionar uma interface simples para representar visualmente informações e seus relacionamentos, sem exigir estruturas hierárquicas ou classificações predefinidas.

### 3. Tecnologias e requisitos de publicação

A aplicação deverá ser desenvolvida utilizando exclusivamente tecnologias nativas da web:

- HTML para estruturação da interface.
- CSS para estilização e apresentação visual.
- JavaScript para implementação das funcionalidades e manipulação dos elementos.

Não deverá existir dependência obrigatória de frameworks, bibliotecas externas, processos de compilação ou servidores de aplicação.

A estrutura deverá permitir que os arquivos sejam publicados diretamente em um repositório do GitHub e disponibilizados por meio do GitHub Pages.

A organização inicial dos arquivos poderá seguir o seguinte modelo:

```text
/
├── index.html
├── styles.css
└── script.js
```

Todos os recursos necessários à execução da aplicação deverão ser carregados diretamente pelo navegador.

Não haverá necessidade de API, autenticação, backend ou banco de dados remoto.

### 4. Interface principal

A aplicação possuirá uma única tela principal, composta por um quadro de trabalho que ocupará toda a área disponível.

O quadro será responsável por apresentar os nós cadastrados e as conexões existentes entre eles.

A interface deverá possuir os seguintes controles:

- **Adicionar (+):** abre o modal de criação de um novo nó.
- **Conectar:** alterna entre os modos de edição e conexão.
- **Exportar:** gera um arquivo contendo os dados do quadro atual.
- **Importar:** permite selecionar um arquivo previamente exportado para recuperar os dados de um quadro.

Os controles deverão ficar organizados de maneira que não interfiram na área de manipulação dos nós. Os botões de adição e alternância de modo deverão permanecer posicionados no canto inferior direito, enquanto os controles de importação e exportação poderão compor uma pequena barra de ferramentas.

O botão de conexão deverá alterar sua aparência e seu texto de acordo com o modo ativo.

A aplicação deverá iniciar sempre no modo de edição.

#### 4.1. Aparência do quadro

O fundo do quadro deverá utilizar um tema escuro (dark mode).

Os nós deverão apresentar cores personalizadas, contrastando adequadamente com o fundo.

As conexões deverão utilizar uma cor suficientemente clara para permanecerem visíveis sem prejudicar a visualização dos elementos.

O tema escuro deverá ser aplicado ao quadro de trabalho como padrão.

### 5. Cadastro de nós

O cadastro será realizado por meio de um modal aberto ao clicar no botão de adição (+).

Cada nó possuirá somente dois atributos:

**Texto:** identificação textual do nó, utilizada para sua representação visual.

**Cor:** cor personalizada utilizada no preenchimento da representação circular do nó.

O campo de texto será obrigatório e deverá impedir a criação de nós sem identificação.

O campo de cor deverá utilizar o seletor nativo do navegador, por meio do elemento HTML `input type="color"`.

Não deverá ser implementado um seletor de cores personalizado, pois o objetivo é aproveitar o componente nativo disponibilizado pela plataforma.

Após o preenchimento dos campos e a confirmação, o nó deverá ser criado e apresentado no quadro.

A posição inicial poderá ser definida automaticamente pela aplicação, preferencialmente em uma região livre do quadro.

### 6. Representação visual dos nós

Cada nó será representado por uma circunferência preenchida com a cor escolhida durante seu cadastro.

O texto identificador deverá aparecer centralizado dentro da circunferência.

O tamanho do elemento poderá variar de acordo com o comprimento do texto, respeitando um limite máximo definido pela interface.

Quando o texto ultrapassar o espaço disponível, deverá ser truncado visualmente com reticências.

Os nós deverão possuir uma área de interação adequada para facilitar a seleção e movimentação.

A aplicação deverá manter uma distinção visual entre nós selecionados e não selecionados.

### 7. Modos de operação

A interação com os nós será controlada por dois modos distintos: edição e conexão.

A alternância entre eles ocorrerá por meio do botão localizado no canto inferior direito.

#### 7.1. Modo de edição

O modo de edição será o comportamento padrão da aplicação.

Nesse modo, clicar sobre um nó deverá abrir seu modal de edição.

O modal permitirá:

- Alterar o texto identificador.
- Alterar a cor.
- Excluir o nó.

Após confirmar as alterações, a representação visual deverá ser atualizada imediatamente.

A exclusão de um nó deverá solicitar confirmação antes de ser executada.

Ao confirmar a exclusão, o nó deverá ser removido do quadro, assim como todas as conexões associadas a ele.

#### 7.2. Modo de conexão

O modo de conexão permitirá estabelecer relacionamentos entre dois nós por meio de cliques sucessivos.

Ao ativar esse modo, o botão de alternância deverá mudar seu texto de "Conectar" para "Editar", além de apresentar uma alteração de cor que indique visualmente o estado ativo.

O comportamento dos cliques sobre os nós será modificado.

O procedimento deverá funcionar da seguinte maneira:

1. O usuário ativa o modo de conexão pelo botão "Conectar".
2. O usuário clica no primeiro nó, que será definido como ponto inicial da conexão.
3. O nó selecionado deverá receber um destaque visual, indicando que está aguardando a definição do segundo ponto.
4. O usuário clica em outro nó, que será definido como ponto final.
5. A aplicação estabelece uma conexão entre os dois elementos, representada por uma linha.
6. O destaque temporário do primeiro nó deverá ser removido.

O modo de conexão permanecerá ativo após a criação de cada relacionamento, permitindo que o usuário estabeleça várias conexões sem precisar alternar o modo repetidamente.

Enquanto o modo de conexão estiver ativo, clicar sobre um nó não deverá abrir seu modal de edição.

#### 7.3. Identificação visual dos modos

A aplicação deverá deixar evidente qual modo está ativo.

No modo de edição:
- O botão deverá apresentar o texto "Conectar".
- Sua aparência deverá indicar que o usuário está no modo de edição.

No modo de conexão:
- O botão deverá apresentar o texto "Editar".
- Sua cor deverá mudar para indicar que o modo de conexão está ativo.
- O quadro deverá apresentar algum indicador visual adicional, como uma mensagem "Modo de conexão ativo".
- O primeiro nó selecionado deverá apresentar um destaque visual diferente dos demais.

A intenção é evitar que o usuário confunda os comportamentos dos cliques.

#### 7.4. Alternância entre os modos

O botão de alternância deverá permitir retornar ao modo de edição a qualquer momento.

Caso exista um primeiro nó selecionado e o usuário retorne ao modo de edição antes de selecionar o segundo, a conexão pendente deverá ser cancelada.

Ao retornar ao modo de conexão, uma nova seleção deverá ser iniciada.

### 8. Regras de conexão

As conexões serão estabelecidas exclusivamente por meio da interação do usuário no modo de conexão.

Não existirão categorias, classificações ou conexões automáticas.

Cada conexão deverá representar uma relação direta entre dois nós.

As conexões deverão obedecer às seguintes regras:

- Um nó poderá possuir conexões com vários outros nós.
- Não será permitido conectar um nó a si próprio.
- Não será permitido criar conexões duplicadas entre os mesmos dois nós.
- Uma conexão deverá permanecer associada aos seus dois nós de origem.
- A movimentação dos nós deverá atualizar automaticamente as linhas correspondentes.
- A exclusão de um nó deverá remover todas as conexões associadas a ele.

As conexões serão representadas por linhas simples, sem indicação de direção. Portanto, serão consideradas relações bidirecionais.

### 9. Movimentação dos nós

Todos os nós deverão poder ser movimentados livremente pelo quadro.

A movimentação ocorrerá por meio de uma interação de clicar e arrastar.

Durante o deslocamento:

- A posição do nó deverá ser atualizada continuamente.
- As linhas conectadas ao elemento deverão acompanhar seu movimento.
- Os demais nós deverão permanecer em suas posições.
- As conexões existentes não deverão ser alteradas.

O sistema deverá preservar as posições dos elementos após a movimentação.

### 10. Edição e exclusão

A edição de um nó será realizada por meio do modal aberto ao clicar sobre ele no modo de edição.

O usuário poderá modificar o texto e a cor, além de excluir o elemento.

A exclusão deverá exigir confirmação.

Quando um nó for removido, todas as linhas que o conectam aos demais elementos também deverão ser removidas automaticamente.

A exclusão de um elemento não deverá afetar os demais nós que estavam conectados a ele.

### 11. Exportação dos dados

A aplicação deverá disponibilizar uma funcionalidade de exportação para permitir que o usuário salve o conteúdo completo do quadro em um arquivo externo.

A exportação deverá ser realizada por meio de um botão identificado como "Exportar".

Ao acioná-lo, a aplicação deverá gerar um arquivo no formato JSON contendo todos os dados necessários para reconstruir o quadro.

O arquivo deverá incluir:

- Identificadores dos nós.
- Textos identificadores.
- Cores selecionadas.
- Coordenadas de posicionamento.
- Identificadores das conexões.
- Referências aos nós de origem e destino de cada conexão.

O arquivo deverá utilizar uma extensão `.json`, sendo disponibilizado para download pelo próprio navegador, sem necessidade de comunicação com um servidor.

Sugere-se que o nome do arquivo contenha a identificação do projeto e a data de exportação, facilitando sua organização.

Exemplo: `quadro-nos-2026-11-11.json`.

A exportação deverá preservar integralmente a estrutura do quadro, permitindo que uma futura importação recupere os elementos e seus relacionamentos.

### 12. Importação dos dados

A aplicação deverá disponibilizar uma funcionalidade para importar arquivos previamente exportados.

A importação será realizada por meio de um botão identificado como "Importar", que deverá abrir o seletor de arquivos do sistema operacional.

O usuário poderá selecionar um arquivo JSON contendo os dados de um quadro.

Após a seleção, a aplicação deverá:

1. Ler o conteúdo do arquivo.
2. Verificar se o arquivo possui uma estrutura válida.
3. Validar os dados dos nós.
4. Validar as referências das conexões.
5. Verificar se os identificadores dos nós são únicos.
6. Confirmar que todas as conexões apontam para nós existentes.
7. Reconstruir o quadro utilizando os dados importados.

A importação deverá recuperar os nós com seus respectivos textos, cores e posições originais, além de reconstruir todas as conexões existentes.

#### 12.1. Substituição do quadro atual

Na primeira versão, a importação deverá substituir integralmente o conteúdo do quadro atual.

Antes de executar a operação, a aplicação deverá solicitar confirmação ao usuário, informando que os dados atualmente carregados serão substituídos.

Caso o usuário cancele, nenhuma alteração deverá ser realizada.

Caso confirme e o arquivo seja válido, os dados importados substituirão os dados atuais, que também deverão ser atualizados no armazenamento local.

A aplicação não deverá misturar automaticamente os nós importados com os nós existentes, evitando conflitos de identificadores e relacionamentos duplicados.

#### 12.2. Validação e tratamento de erros

A aplicação deverá impedir a importação de arquivos inválidos ou incompatíveis.

Entre as situações que deverão ser tratadas estão:

- Arquivo que não seja um JSON válido.
- Estrutura de dados incompatível com o formato esperado.
- Nós sem identificadores ou textos válidos.
- Identificadores duplicados.
- Conexões que apontem para nós inexistentes.
- Conexões duplicadas.
- Conexões de um nó para ele próprio.
- Versões de arquivo não suportadas.

Caso seja identificado algum problema, a aplicação deverá apresentar uma mensagem explicativa e cancelar a importação.

Uma importação malsucedida não deverá modificar ou apagar os dados atualmente armazenados.

A substituição deverá ocorrer somente após a validação completa do arquivo.

### 13. Formato e estrutura do arquivo JSON

O arquivo exportado deverá possuir uma estrutura padronizada, facilitando sua leitura, validação e recuperação.

Recomenda-se incluir uma identificação de formato e uma versão do esquema, permitindo que futuras alterações na aplicação sejam compatíveis com arquivos de versões anteriores, quando possível.

Exemplo de estrutura:

```json
{
  "format": "node-graph",
  "version": 1,
  "exportedAt": "2026-11-11T16:00:00.000Z",
  "nodes": [
    {
      "id": "uuid-no-1",
      "text": "Servidor principal",
      "color": "#3b82f6",
      "position": {
        "x": 300,
        "y": 200
      }
    },
    {
      "id": "uuid-no-2",
      "text": "Banco de dados",
      "color": "#22c55e",
      "position": {
        "x": 550,
        "y": 300
      }
    }
  ],
  "connections": [
    {
      "id": "uuid-conexao-1",
      "sourceId": "uuid-no-1",
      "targetId": "uuid-no-2"
    }
  ]
}
```

O atributo `format` deverá identificar o tipo de arquivo.

O atributo `version` deverá indicar a versão da estrutura de dados utilizada.

O atributo `exportedAt` deverá registrar a data e o horário da exportação.

A coleção `nodes` deverá conter os elementos e suas propriedades.

A coleção `connections` deverá armazenar os relacionamentos entre os elementos.

A aplicação deverá utilizar os identificadores originais durante a importação, preservando corretamente as referências entre os nós.

### 14. Armazenamento local

A aplicação deverá funcionar inteiramente no navegador, utilizando armazenamento local para preservar os dados.

Recomenda-se utilizar o `localStorage`, considerando a simplicidade da estrutura de dados e a ausência de necessidade de comunicação com servidores externos.

O armazenamento deverá preservar:

- Identificador único de cada nó.
- Texto identificador.
- Cor selecionada.
- Coordenadas de posicionamento.
- Relacionamentos existentes entre os nós.

As alterações realizadas deverão ser salvas automaticamente.

Isso inclui criação, edição, exclusão, movimentação e estabelecimento de conexões.

A importação deverá atualizar o armazenamento local com o conteúdo do arquivo selecionado.

A exportação deverá utilizar os dados atualmente carregados na aplicação, garantindo que o arquivo represente o estado atualizado do quadro.

Ao recarregar a página, a aplicação deverá recuperar os dados armazenados e reconstruir o quadro com os elementos e relacionamentos nas posições anteriormente definidas.

Os dados serão armazenados localmente no navegador e não serão sincronizados automaticamente entre dispositivos ou navegadores diferentes.

### 15. Requisitos de integridade

A aplicação deverá garantir que:

- Todo nó possua um identificador único.
- Todo nó possua um texto não vazio.
- Toda conexão faça referência a dois nós existentes.
- Um nó não possa ser conectado a si próprio.
- Não existam conexões duplicadas entre o mesmo par de nós.
- A exclusão de um nó remova suas conexões.
- A posição dos nós seja preservada após o recarregamento.
- Os dados armazenados sejam recuperados corretamente.
- Os arquivos exportados contenham todos os dados necessários para reconstruir o quadro.
- Os arquivos importados sejam validados antes de substituir os dados atuais.
- Uma importação inválida não comprometa os dados existentes.

### 16. Responsividade

A interface deverá funcionar em diferentes resoluções de tela.

O quadro deverá ocupar a área disponível, respeitando o posicionamento dos botões de controle.

Os modais deverão se adaptar ao tamanho da tela.

A interação de movimentação e conexão deverá considerar tanto dispositivos com mouse quanto dispositivos com tela sensível ao toque, utilizando mecanismos de interação compatíveis, como Pointer Events.

### 17. Escopo da primeira versão

A primeira versão deverá contemplar as seguintes funcionalidades:

- Tela única com quadro de fundo escuro.
- Botão de criação de nós.
- Modal de cadastro com texto e seletor nativo de cores.
- Representação circular dos nós.
- Movimentação livre dos elementos.
- Modal de edição.
- Exclusão de nós.
- Modo de edição.
- Modo de conexão.
- Criação de conexões por seleção de dois nós.
- Indicação visual do modo ativo.
- Atualização das linhas durante a movimentação.
- Armazenamento local automático.
- Recuperação dos dados após o recarregamento.
- Exportação do quadro completo em arquivo JSON.
- Importação de arquivos JSON.
- Validação dos arquivos antes da importação.
- Recuperação das posições e conexões originais.
- Confirmação antes de substituir o quadro existente.

Funcionalidades como autenticação, compartilhamento, sincronização entre dispositivos, múltiplos quadros, exportação para imagem, zoom, minimapa, histórico de alterações e mesclagem de quadros não fazem parte do escopo inicial.

### 18. Considerações finais

O projeto busca oferecer uma ferramenta simples e intuitiva para a construção de estruturas visuais compostas por nós e relacionamentos.

A simplificação dos atributos dos nós e a utilização de dois modos de interação tornam a experiência de uso mais direta, reduzindo a complexidade do cadastro e da manutenção das conexões.

A inclusão de recursos de exportação e importação permite que as estruturas criadas sejam preservadas em arquivos externos, facilitando a realização de cópias de segurança, o transporte dos dados e a recuperação de quadros em outras sessões ou navegadores.

A escolha de HTML, CSS e JavaScript puro garante que a aplicação possa ser executada diretamente pelo navegador e publicada em serviços de hospedagem estática, como o GitHub Pages.

A utilização do armazenamento local elimina a necessidade de infraestrutura adicional, mantendo os dados disponíveis no próprio navegador do usuário.

A arquitetura deverá manter separadas a estrutura dos nós, os relacionamentos, a lógica de interação, a persistência e a representação visual, permitindo futuras melhorias sem comprometer a simplicidade da primeira versão.