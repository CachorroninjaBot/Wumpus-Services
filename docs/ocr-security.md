# Segurança do OCR

O bot baixa imagens somente de `cdn.discordapp.com`, sem seguir
redirecionamentos, confere a assinatura binária e envia o arquivo em multipart
diretamente para `https://api.ocr.space/parse/image`. A chave fica em
`OCR_SPACE_API_KEY`, enviada pelo header `apikey` e nunca colocada na URL ou nos
logs. O processo iniciado com `npm start` carrega essa variável do `.env`;
deployments podem fornecê-la pelo ambiente do serviço. `.env` não deve ser
versionado.

O código limita o arquivo a 1 MiB (limite do endpoint público gratuito), o
processamento a três imagens por mensagem e quatro solicitações simultâneas.
Downloads e respostas têm limites de bytes; a chamada tem timeout; o texto
reconhecido é limitado a 12.000 caracteres. Apenas resultados de parsing
explicitamente bem-sucedidos (`OCRExitCode` e `FileParseExitCode`) são usados.

OCR.space não retorna score de confiança calibrado, portanto `confidenceThreshold`
não mede a qualidade da transcrição nesse provedor. Após uma leitura bem-sucedida,
o AutoMod procura somente os `blockedTerms` configurados pelo usuário, sem
aplicar regras de convite, links, caixa alta ou flood ao texto da imagem. Se
encontrar um termo, aplica a ação configurada no AutoMod e grava um evento de
auditoria/log identificando o termo, a ação e a origem OCR. Sem correspondência,
nenhuma ação de moderação nem evento de incidente é gerado. Os canais e cargos
ignorados pelo AutoMod também são respeitados.

`retainExtractedText` controla se o texto reconhecido é gravado no registro de
auditoria do AutoMod. Com a opção desativada (padrão), o conteúdo e trechos
derivados dele não são incluídos nos eventos de auditoria. O cache em memória
continua sendo temporário e controlado separadamente por `cacheResults` e
`cacheTtlMinutes`.

O processo do bot também escreve no console etapas de diagnóstico do OCR:
detecção de anexos, motivo de ignorar a leitura, envio ao provedor, código de
resposta, quantidade de texto reconhecido e resultado da busca de termos. Os
logs não incluem a chave, URL da imagem nem o texto reconhecido.
