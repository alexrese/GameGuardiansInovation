# Alex Rese: Guardiões da Inovação

Protótipo jogável original em JavaScript puro, HTML5 Canvas e CSS. O jogo combina ação lateral arcade com progressão persistente em níveis e uma Academia Nexus para investir Cristais de Inovação.

## Como executar

Abra o arquivo `index.html` diretamente no navegador. O protótipo não possui dependências externas nem exige instalação.

Opcionalmente, também é possível executar um servidor local na pasta do projeto:

```bash
python -m http.server 8000
```

Depois, acesse `http://localhost:8000` no navegador.

## Controles

| Ação | Teclas |
| --- | --- |
| Mover | `A` / `D` ou setas esquerda / direita |
| Pular | `K`, `X` ou seta para cima |
| Energia rúnica | `J` ou `Z` |
| Pausar | `P` |
| Comprar melhorias na Academia | mouse ou teclas `1` a `4` |

Em telas sensíveis ao toque, botões virtuais são exibidos sobre o jogo.

## Escopo implementado

- Tela inicial narrativa com Mestre Nexus.
- Academia com quatro linhas de investimento permanente.
- Três missões progressivas.
- Movimento lateral, salto, plataformas e energia rúnica.
- Inimigos Buglings e chefes por fase.
- Cristais, experiência e níveis de guardião.
- Salvamento do progresso no navegador com `localStorage`.
- Interface responsiva e controles básicos para dispositivos móveis.
- Efeitos visuais, partículas, pausa e áudio sintetizado simples.

## Próximos incrementos sugeridos

1. Missões secundárias e personagens jogáveis com classes distintas.
2. Diálogos ramificados com decisões de empreendedorismo.
3. Novas regiões, desafios ambientais e quebra-cabeças de lógica.
4. Inventário de artefatos tecnológicos e árvore de habilidades visual.
5. Migração opcional para Phaser caso o projeto cresça em mapas, animações e assets.

## Teste automatizado

O projeto inclui um teste de fumaça sem dependências externas. Para executá-lo:

```bash
node test/smoke-test.mjs
```

O teste valida carregamento, loop de animação, clique inicial, persistência local, compra de melhoria, início da missão, movimento, energia rúnica e pausa.
