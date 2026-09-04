# Convite Liz & Luna — 1 Aninho

Projeto de convite digital interativo mobile-first.

Tema: Circo Rosa Candy Color.

Tecnologias:

- HTML5
- CSS3
- JavaScript

Funcionalidades:

- convite mobile-first;
- personalização por código `?c=`;
- countdown;
- RSVP;
- seleção de convidados;
- música;
- assets próprios;
- layout responsivo.

Referência visual oficial: `assets/images/reference/reference.png`.

Catálogo dos assets: `assets/images/README.md`.

## Executar localmente

Como o projeto usa módulos simples de navegador e `sessionStorage`, rode o servidor HTTP na raiz:

```bash
node server.js
```

O servidor escuta em `0.0.0.0:8765`, permitindo acesso por outros dispositivos da mesma rede local. No próprio computador, abra:

`http://localhost:8765/?c=CODIGO_DO_CONVITE`

No celular conectado à mesma rede, substitua `IP-DO-COMPUTADOR` pelo endereço IPv4 atual do computador:

`http://IP-DO-COMPUTADOR:8765/?c=CODIGO_DO_CONVITE`

Para testar a personalização localmente, use:

```text
http://localhost:8765/?c=CODIGO_DO_CONVITE
```

O código deve ser fornecido pela API de convites. Sem código ou com código inexistente, o site mostra uma mensagem de convite não encontrado.

## Onde editar

- `js/convidados.js`: endpoint da API e carregamento dos dados do convite.
- `css/style.css`: identidade visual, responsividade e composições das oito telas.
- `assets/audio/ambient.mp3`: arquivo opcional de música ambiente.
- `assets/images/`: assets organizados de personagens, circo, decorações e interface.

## RSVP

As respostas são enviadas à API do Google Apps Script e o estado da sessão fica temporariamente no navegador, em `sessionStorage`, usando a chave do convite.

## Direção visual

A referência visual está em `assets/images/reference/reference.png` e orienta as oito telas verticais. Ela não é carregada pelo site. A interface usa os PNGs reais do catálogo em `assets/images/`, com layout mobile-first, paleta rosa candy, azul pastel, creme e dourado. Os dados privados do convite são fornecidos somente pela API para o código válido da família.

> Para ativar a música, adicione o arquivo `assets/audio/ambient.mp3`. Sem ele, o controle de som informa a ausência do arquivo sem iniciar reprodução automática.
