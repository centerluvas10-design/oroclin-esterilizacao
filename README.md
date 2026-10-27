# Oroclin · Controle de esterilização

Sistema de registro e rastreabilidade da esterilização de materiais da **Oroclin Odontologia e Estética**, conforme a **RDC Anvisa nº 1.002/2025** (arts. 78 a 92).

- Abre em qualquer navegador, sem conta e sem login. A equipe só digita o **código de acesso da clínica** uma vez por aparelho.
- Os registros ficam numa **Planilha Google da clínica**, que pode ser aberta e conferida a qualquer momento.
- Gera lote único por carga, etiquetas com QR code (rolo térmico 50×30, 60×40 ou folha A4), ficha de rastreabilidade e livro mensal de registros em PDF e CSV.
- O QR da etiqueta é um link: com a câmera do celular, a ficha do pacote abre direto no sistema.

## Como funciona

```
Celular / computador  ──►  index.html (GitHub Pages)  ──►  Apps Script (servidor)  ──►  Planilha Google da clínica
                                                            confere o código de acesso
```

| Arquivo | O que é |
| --- | --- |
| `index.html` | O sistema inteiro: telas, etiquetas, QR e relatórios. |
| `apps-script/Codigo.gs` | O servidor que grava e lê a planilha e confere o código de acesso. |

Nenhum registro e nenhum código de acesso ficam neste repositório.

---

## Instalação (uma vez, cerca de 15 minutos)

Use a **conta Google da clínica** em todos os passos.

### 1. Criar a planilha e o servidor

1. No Google Drive, crie uma planilha chamada **Oroclin – Esterilização**.
2. Na planilha, abra **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de [`apps-script/Codigo.gs`](apps-script/Codigo.gs). Clique em **Salvar**.
4. No menu de funções, escolha **`configurar`** e clique em **Executar**. O Google pede autorização: avance e permita o acesso à planilha.
   - Isso cria as abas `cargas`, `equipamentos`, `pessoas`, `kits` e `config` e cadastra 8 kits iniciais.

### 2. Definir o código de acesso

1. No Apps Script, clique na engrenagem **Configurações do projeto**.
2. Em **Propriedades do script**, edite a propriedade **`PIN`** e coloque o código da clínica.
   - Use **pelo menos 6 dígitos** e não use datas ou sequências (123456).

### 3. Publicar o servidor

1. Clique em **Implantar → Nova implantação**.
2. Em tipo, escolha **App da Web**.
3. **Executar como:** *Eu* (a conta da clínica). **Quem pode acessar:** *Qualquer pessoa*.
4. Clique em **Implantar** e copie a **URL do App da Web** (termina em `/exec`).

> "Qualquer pessoa" só permite *chamar* o servidor. Sem o código de acesso, ele não lê nem grava nada.

### 4. Conectar o sistema à planilha

1. Neste repositório, abra `index.html` e clique no lápis (editar).
2. Procure a linha:
   ```js
   const API_URL = "COLE_AQUI_A_URL_DO_APP_DA_WEB";
   ```
3. Troque o texto entre aspas pela URL copiada no passo 3 e clique em **Commit changes**.

### 5. Publicar o sistema no GitHub Pages

1. No repositório, abra **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**, branch **`main`**, pasta **`/ (root)`**, e salve.
3. Em 1 ou 2 minutos o link aparece no topo da página, no formato `https://<usuario>.github.io/<repositorio>/`.

> No plano gratuito do GitHub, o Pages só funciona com repositório **público**. Isso não expõe dados: o código não contém registros nem o código de acesso.

### 6. Celulares da equipe

1. Abra o link do sistema no navegador do celular e digite o código de acesso.
2. No menu do navegador, toque em **Adicionar à tela inicial**. O sistema passa a abrir como um aplicativo, com o ícone da clínica.

Antes da primeira carga, cadastre a autoclave e a equipe na aba **Cadastros**.

---

## Manutenção

| Situação | O que fazer |
| --- | --- |
| Alguém saiu da equipe ou o código vazou | Troque o `PIN` nas Propriedades do script. Todos os aparelhos pedem o código novo na próxima abertura. |
| Atualizar o servidor (`Codigo.gs`) | Cole o novo código, salve e vá em **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma. |
| Atualizar o sistema (`index.html`) | Faça o commit no GitHub. O Pages atualiza em 1 ou 2 minutos. |
| Backup | A planilha fica no Drive da clínica, com histórico de versões (**Arquivo → Histórico de versões**). Exporte também o **livro de registros** mensal em PDF e CSV e arquive por no mínimo **5 anos** (art. 92). |
| Sistema mostra "Sem conexão com a planilha" | Confira a internet do aparelho. Se persistir, confira se a implantação do Apps Script continua ativa. |

### Sobre a planilha

- A coluna **`dados_json`** é o registro oficial usado pelo sistema. **Não edite essa coluna à mão.**
- As outras colunas (lote, datas, parâmetros, situação, pacotes) são uma cópia legível, refeita a cada gravação.
- Nenhum registro é apagado pelo sistema: cargas e cadastros são **cancelados** ou **desativados**, e o histórico fica preservado.

## Dados de pacientes (LGPD)

O registro de uso guarda o paciente em que o pacote foi usado. Prefira o **número do prontuário** em vez do nome. Assim a rastreabilidade fica completa e o nome continua só no sistema de gestão da clínica.
