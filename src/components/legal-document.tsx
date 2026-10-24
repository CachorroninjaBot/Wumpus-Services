import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/brand";

/* eslint-disable react-refresh/only-export-components */

/*
 * THESIS: Make the two legal documents easy to navigate without turning them into marketing.
 * OWN-WORLD: The Wumpus public site's restrained green, warm neutral surfaces, and fine rules.
 * STORY: Readers identify the responsible contact, understand the service's real data flows, and find the exact clause they need.
 * FIRST VIEWPORT: Brand navigation, document title and date, document switcher, then a contents rail beside the opening clauses.
 * FORM: Read-mode wayfinding, candidate 3; fixed visual identity, with a responsive contents rail that becomes a horizontal scroll list.
 */

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: "privacidade" | "termos";
  title: string;
  description: string;
  sections: LegalSection[];
};

const updatedAt = "23 de outubro de 2026";
const contactEmail = "luizantoniomuniz26@gmail.com";

export const privacyDocument: LegalDocument = {
  slug: "privacidade",
  title: "Política de Privacidade",
  description: "Como o Wumpus trata dados da conta, dos servidores conectados e das ferramentas de atendimento.",
  sections: [
    {
      id: "responsavel",
      title: "Quem é responsável",
      paragraphs: [
        `O serviço Wumpus é mantido pela Haiz Team. O contato responsável informado para privacidade é Luiz Antonio, pelo e-mail ${contactEmail}. Para dados da sua conta e da utilização direta da dashboard, a Haiz Team decide as finalidades e os meios essenciais do tratamento descritos nesta política.`,
        "Quando um administrador ativa recursos do bot em seu servidor, esse administrador pode ser o controlador dos dados dos membros da comunidade; a Haiz Team trata esses dados para disponibilizar e operar o serviço, conforme a configuração feita pelo servidor e as instruções aplicáveis.",
      ],
    },
    {
      id: "dados",
      title: "Dados tratados",
      paragraphs: ["O tipo de dado depende dos recursos que você ou a equipe do servidor utilizam. Podemos tratar:"],
      bullets: [
        "Conta Discord: ID, nome de usuário, nome de exibição e avatar obtidos no login. O login solicita os escopos identify e guilds.",
        "Servidores conectados: IDs, nomes, ícones e informação de propriedade/gerenciamento usada para validar quais servidores podem ser administrados.",
        "Configurações do Wumpus: módulos, canais, cargos, formulários, regras, textos e preferências salvos pelo administrador.",
        "Operação do bot: IDs de canais, usuários e mensagens, registros de moderação e auditoria, tickets, respostas a formulários e estatísticas necessários aos recursos ativados.",
        "Ajuda e atendimento: perguntas e respostas do chat com IA, histórico escolhido, seção da dashboard e contexto relevante da configuração; se solicitado, mensagens encaminhadas ao atendimento humano e espelhadas no tópico privado de suporte.",
        "OCR: imagem publicada no Discord e texto reconhecido quando o administrador habilita a leitura de imagens. O texto extraído só é incluído no registro de auditoria se a opção correspondente estiver ativada.",
        "Assinatura: identificadores Discord vinculados, plano, estado e datas da assinatura informados pela ShardPay. O checkout e os dados de pagamento são tratados no ambiente do provedor de pagamento.",
      ],
    },
    {
      id: "finalidades",
      title: "Para que usamos os dados",
      paragraphs: ["Usamos os dados necessários para:"],
      bullets: [
        "Autenticar sua conta, manter a sessão segura e verificar o acesso aos servidores e recursos contratados.",
        "Salvar as configurações e executar no Discord as funções que o administrador habilitou.",
        "Responder no chat de ajuda, recuperar conversas anteriores e encaminhar ao suporte humano quando a pessoa solicitar.",
        "Gerar auditorias, métricas, limites de uso, diagnóstico de falhas, prevenção de abuso e proteção do serviço.",
        "Consultar e sincronizar informações de plano e assinatura com a ShardPay e cumprir obrigações legais aplicáveis.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies e armazenamento no navegador",
      paragraphs: [
        "A dashboard usa um cookie HttpOnly para manter a sessão e um cookie temporário para validar o início do login com Discord. Em produção, o cookie de sessão é protegido por HTTPS; a sessão pode durar até 30 dias e expira antes após 14 dias sem atividade. O estado temporário do login dura até cinco minutos.",
        "O navegador também pode guardar preferências de interface e o identificador necessário para retomar um atendimento humano em andamento. Esses dados não substituem a autenticação no servidor.",
      ],
    },
    {
      id: "fornecedores",
      title: "Serviços de terceiros",
      paragraphs: [
        "Para que as integrações funcionem, alguns dados são enviados ou consultados em serviços externos. Cada provedor aplica seus próprios termos e práticas de privacidade:",
      ],
      bullets: [
        "Discord: autenticação, dados básicos da conta e servidores autorizados; o bot também acessa os canais e conteúdos necessários às permissões e funções habilitadas pelo administrador.",
        "Groq: recebe a pergunta, o histórico enviado e o contexto relevante da dashboard quando a ajuda por IA é usada.",
        "OCR.space: recebe a imagem enviada ao OCR quando a leitura está habilitada e acionada no servidor.",
        "Haiz Transcript: pode receber o identificador de um canal ou tópico para gerar uma transcrição quando o fluxo e a retenção configurados permitem o transcript externo.",
        "ShardPay (loja Hub Express): processa checkout e pagamento e fornece ao Wumpus informações de produto e assinatura necessárias para aplicar o plano.",
        "ShardCloud e outros provedores de infraestrutura: podem armazenar ou transmitir dados como parte da hospedagem e operação do serviço.",
      ],
    },
    {
      id: "retencao",
      title: "Retenção e exclusão",
      paragraphs: [
        "Mantemos os dados pelo tempo necessário às finalidades acima, à operação dos recursos, à segurança e a obrigações legais. O prazo concreto varia conforme o tipo de registro e as configurações do servidor; não existe um único prazo que se aplique a todos os dados.",
        "As sessões têm limite técnico de 30 dias, com expiração após 14 dias sem atividade. O histórico da ajuda por IA mantém até 25 conversas por usuário e servidor e permite excluir conversas pela dashboard. Atendimentos humanos ativos não podem ser removidos do histórico até serem encerrados; a exclusão de um atendimento encerrado na dashboard não apaga o tópico nem as mensagens já existentes no Discord.",
        "O administrador pode configurar a retenção de conteúdo de tickets. Quando aplicada, o bot remove conteúdo local e cópias conhecidas no Discord; metadados usados em estatísticas podem permanecer. Links de transcrições já geradas por serviço externo podem não ser removíveis pelo Wumpus.",
        "Registros podem ser preservados por mais tempo quando necessário para cumprir a lei, resolver disputas, proteger pessoas ou manter a segurança do serviço.",
      ],
    },
    {
      id: "compartilhamento",
      title: "Compartilhamento e transferências",
      paragraphs: [
        "Não compartilhamos dados fora dos fluxos necessários ao uso do Wumpus, às integrações descritas, à proteção do serviço ou ao cumprimento da lei. Os provedores podem processar dados em países diferentes do seu; nesse caso, aplicam-se as salvaguardas e regras de transferência previstas na legislação aplicável e nos compromissos de cada provedor.",
        "O Wumpus não controla os dados que o administrador publica ou mantém no Discord nem as cópias mantidas pelos serviços externos de transcrição, pagamento, IA, OCR ou hospedagem.",
      ],
    },
    {
      id: "direitos",
      title: "Seus direitos",
      paragraphs: [
        "Nos termos da legislação aplicável, incluindo a LGPD quando aplicável, você pode solicitar confirmação do tratamento, acesso, correção, informação sobre compartilhamento, anonimização, bloqueio ou eliminação de dados, portabilidade quando cabível, revisão de decisões automatizadas aplicáveis e informações sobre consentimento ou sua revogação.",
        `Envie sua solicitação para ${contactEmail}, usando o assunto “Privacidade — Wumpus”. Podemos pedir informações proporcionais para confirmar sua identidade e localizar os dados. Para conteúdo de um servidor Discord, procure também o administrador responsável pelo servidor.`,
      ],
    },
    {
      id: "seguranca",
      title: "Segurança",
      paragraphs: [
        "Adotamos medidas técnicas e operacionais para proteger contas, credenciais e dados, incluindo autenticação por sessão protegida, controles de acesso e limitação de solicitações. Nenhum sistema conectado à internet pode garantir segurança absoluta; avise o contato de privacidade se suspeitar de acesso indevido.",
      ],
    },
    {
      id: "atualizacoes",
      title: "Atualizações desta política",
      paragraphs: [
        `Podemos atualizar esta política para refletir mudanças no produto, nos fornecedores ou na legislação. A versão vigente será publicada nesta página com a data de atualização. Última atualização: ${updatedAt}.`,
      ],
    },
  ],
};

export const termsDocument: LegalDocument = {
  slug: "termos",
  title: "Termos de Uso",
  description: "Regras para acessar a dashboard, conectar o bot e usar as ferramentas Wumpus em servidores Discord.",
  sections: [
    {
      id: "aceitacao",
      title: "Aceitação e serviço",
      paragraphs: [
        "Estes termos regulam o acesso à dashboard Wumpus, ao bot e aos recursos relacionados. Ao entrar, instalar ou usar o serviço, você confirma que leu estes termos e que tem capacidade e autorização para aceitá-los. Se não concordar, não use o serviço.",
        "A Haiz Team mantém o Wumpus; Luiz Antonio é o contato responsável informado. Recursos dependem do Discord, da conexão do bot, do plano e das configurações publicadas pelo administrador.",
      ],
    },
    {
      id: "conta",
      title: "Conta e autorização",
      paragraphs: [
        "O acesso à dashboard usa a autenticação do Discord e solicita os escopos identify e guilds. Você deve proteger sua conta Discord e usar a dashboard apenas nos servidores que administra ou para os quais recebeu autorização suficiente.",
        "O administrador é responsável por selecionar permissões adequadas para o bot, configurar canais e cargos corretamente e manter a equipe autorizada. Não tente contornar controles de acesso, limites de plano ou proteções técnicas.",
      ],
    },
    {
      id: "planos",
      title: "Planos e pagamentos",
      paragraphs: [
        "Os recursos, limites, preços e ciclos podem variar conforme o plano e a oferta vigente exibida no checkout. A cobrança é processada pela loja Hub Express na ShardPay, que mantém seus próprios termos e política de privacidade.",
        "O Wumpus recebe informações de assinatura necessárias para validar o acesso e aplicar limites. Consulte a ShardPay para pagamento, renovação, cancelamento e comprovantes; direitos obrigatórios do consumidor continuam preservados.",
      ],
    },
    {
      id: "uso",
      title: "Uso permitido",
      paragraphs: ["Você concorda em:"],
      bullets: [
        "Usar o serviço de acordo com a lei, os termos do Discord e as permissões concedidas no servidor.",
        "Ter base legal, autorização e transparência adequadas para tratar conteúdo e dados dos membros do seu servidor.",
        "Revisar configurações de moderação, OCR, transcrição e formulários antes de publicá-las e informar sua comunidade quando necessário.",
        "Manter credenciais, chaves e variáveis de ambiente sob seu controle e não tentar acessar dados de outra conta ou servidor.",
        "Não usar o Wumpus para assédio, fraude, spam, violação de direitos, coleta indevida de dados ou qualquer atividade ilegal.",
      ],
    },
    {
      id: "conteudo",
      title: "Conteúdo e dados do servidor",
      paragraphs: [
        "Você mantém os direitos sobre o conteúdo que envia ou configura. Concede à Haiz Team apenas a autorização técnica necessária para armazenar, transmitir e processar esse conteúdo para operar as funções que você habilitou.",
        "O administrador do servidor é responsável pelos avisos, permissões, perguntas de formulários, regras de retenção e decisões tomadas com base em logs, OCR, estatísticas ou conteúdo de tickets. O Wumpus não substitui suas obrigações perante os membros da comunidade.",
      ],
    },
    {
      id: "ia-integracoes",
      title: "IA e integrações",
      paragraphs: [
        "A ajuda por IA gera orientação automatizada a partir da pergunta, do histórico enviado e do contexto da tela. A resposta pode estar incompleta ou incorreta: confira instruções importantes antes de agir. A IA não altera configurações por conta própria.",
        "OCR, geração de transcrições, login, pagamentos e comunicação do bot dependem de provedores externos. A disponibilidade, retenção e processamento desses serviços também seguem as regras dos respectivos provedores.",
      ],
    },
    {
      id: "disponibilidade",
      title: "Disponibilidade e alterações",
      paragraphs: [
        "Buscamos manter o serviço funcional, mas não garantimos operação ininterrupta. Manutenções, incidentes, mudanças do Discord ou de outros provedores, falhas de rede e configurações incorretas podem limitar funções.",
        "Podemos corrigir, atualizar ou descontinuar recursos, respeitando a legislação aplicável e os direitos relacionados a serviços pagos. Podemos suspender o acesso quando necessário para proteger usuários, servidores, provedores ou a integridade do serviço, ou para responder a uma violação destes termos.",
      ],
    },
    {
      id: "responsabilidade",
      title: "Responsabilidades e limites",
      paragraphs: [
        "Você é responsável pelas configurações que publica e pelas decisões da equipe no servidor. A Haiz Team não controla os serviços do Discord nem as ações de administradores, membros ou provedores externos.",
        "Na extensão permitida pela lei, o Wumpus é fornecido conforme sua disponibilidade. Nada nestes termos exclui garantias, direitos do consumidor ou responsabilidades que não possam ser afastados por lei. Eventuais limitações não se aplicam a dolo, culpa ou hipóteses em que a legislação proíba sua exclusão.",
      ],
    },
    {
      id: "vigencia",
      title: "Vigência e mudanças nos termos",
      paragraphs: [
        `Estes termos permanecem aplicáveis enquanto você usa o serviço. Podemos atualizá-los para refletir mudanças operacionais, legais ou de produto; a versão vigente e a data serão publicadas nesta página. Última atualização: ${updatedAt}. O uso continuado após a publicação significa ciência das condições atualizadas, sem afastar direitos que exijam consentimento específico.`,
      ],
    },
    {
      id: "contato",
      title: "Contato",
      paragraphs: [
        `Para dúvidas, reclamações ou solicitações relacionadas a estes termos, escreva para ${contactEmail}. Para pedidos sobre dados pessoais, consulte também a Política de Privacidade.`,
      ],
    },
  ],
};

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const otherDocument = document.slug === "privacidade" ? termsDocument : privacyDocument;
  const otherLabel = document.slug === "privacidade" ? "Termos de Uso" : "Política de Privacidade";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" aria-label="Wumpus, página inicial" className="flex items-center gap-2.5 text-foreground no-underline">
            <BrandMark size={27} />
            <span className="font-semibold tracking-tight">Wumpus</span>
          </Link>
          <nav aria-label="Documentos legais" className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              to="/privacidade"
              aria-current={document.slug === "privacidade" ? "page" : undefined}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground sm:px-3 sm:text-sm"
            >
              Privacidade
            </Link>
            <Link
              to="/termos"
              aria-current={document.slug === "termos" ? "page" : undefined}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground sm:px-3 sm:text-sm"
            >
              Termos
            </Link>
            <Link to="/entrar" className="ml-1 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover sm:ml-2 sm:text-sm">
              Entrar <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" /> Página inicial
        </Link>
        <div className="mt-7 border-b border-border pb-7 sm:mt-9 sm:pb-8">
          <h1 className="m-0 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{document.title}</h1>
          <p className="mb-0 mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{document.description}</p>
          <p className="mb-0 mt-4 text-xs font-medium text-muted-foreground">Última atualização: {updatedAt}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">Outro documento:</span>
            <Link to={`/${otherDocument.slug}`} className="font-semibold text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
              {otherLabel}
            </Link>
          </div>
        </div>

        <div className="grid gap-8 pt-7 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:pt-9">
          <aside aria-label="Navegação do documento" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <h2 className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Nesta página</h2>
            <nav className="mt-3 flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {document.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:shrink"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 max-w-[72ch]">
            <div className="mb-8 border-b border-border pb-6">
              <p className="m-0 text-sm leading-6">
                Responsável: <strong>Haiz Team</strong> · Contato:{" "}
                <a href={`mailto:${contactEmail}`} className="font-medium text-primary underline underline-offset-4">{contactEmail}</a>
              </p>
              <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
                Este documento descreve os fluxos do Wumpus com base no funcionamento atual do serviço. As regras obrigatórias da legislação aplicável prevalecem.
              </p>
            </div>
            <div className="divide-y divide-border">
              {document.sections.map((section) => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28 py-6 first:pt-0">
                  <h2 id={`${section.id}-title`} className="mb-3 mt-0 text-xl font-semibold tracking-tight">{section.title}</h2>
                  <div className="space-y-3 text-sm leading-7 text-foreground">
                    {section.paragraphs.map((paragraph, index) => <p key={index} className="m-0">{paragraph}</p>)}
                    {section.bullets ? (
                      <ul className="my-0 space-y-2 pl-5 marker:text-primary">
                        {section.bullets.map((item) => <li key={item} className="pl-1">{item}</li>)}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Haiz Team · Wumpus · {updatedAt}</span>
          <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">
            Falar sobre privacidade <ArrowUpRight aria-hidden="true" className="size-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
