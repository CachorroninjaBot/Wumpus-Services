# Segurança do OCR

O bot valida as URLs de imagem como HTTPS e limita o host a
`cdn.discordapp.com`. Também valida o endpoint OCR,
limita cada imagem a 8 MiB, processa no máximo três imagens por mensagem e
mantém até quatro solicitações OCR simultâneas. Respostas são limitadas a
128 KiB e o texto reconhecido a 12.000 caracteres. Texto sem confiança numérica
válida entre 0 e 1, ou abaixo da confiança mínima configurada, não é usado para
moderação automatizada.

O serviço configurado por `WUMPUS_HAIZ_OCR_URL` não está neste repositório.
Essas validações no bot não substituem validações do próprio serviço, pois ele
é quem baixa e decodifica a imagem. O serviço deve:

- validar novamente o esquema HTTPS e uma allowlist fixa de hosts antes de cada
  download, sem confiar em URLs ou políticas enviadas pelo cliente;
- desabilitar redirecionamentos ou validar cada destino após cada redirecionamento,
  rejeitando IPs privados, loopback, link-local, endereços de metadata e IPv4/IPv6
  mapeados;
- resolver DNS com proteção contra rebinding e garantir que o IP efetivamente
  conectado permaneça público e permitido;
- impor limite de bytes durante o streaming (não apenas confiar em
  `Content-Length`), timeout, limite de dimensões/pixels e formatos por
  assinatura do arquivo; rejeitar SVG e arquivos truncados/malformados;
- exigir `X-Internal-Key` por canal seguro, comparar em tempo constante, limitar
  taxa e concorrência e nunca registrar a chave, URL assinada ou conteúdo da
  imagem;
- devolver JSON com `confidence` numérica normalizada de 0 a 1, aplicando os
  mesmos limites de tamanho ao resultado.

`retainExtractedText` controla se o texto reconhecido é gravado no registro de
auditoria do AutoMod. Com a opção desativada (padrão), o conteúdo e trechos
derivados dele não são incluídos nos eventos de auditoria. O cache em memória
continua sendo temporário e controlado separadamente por `cacheResults` e
`cacheTtlMinutes`.
