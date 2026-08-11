import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ClipboardList,
  Factory,
  Gauge,
  Mail,
  PackageSearch,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PRODUCT } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Operon — Otimização digital para PMEs industriais",
  description:
    "A Operon ajuda PMEs industriais a digitalizar processos de chão de fábrica — produção, encomendas, orçamentos e qualidade — começando com um trial gratuito antes de escalar.",
};

const CONTACT_EMAIL = "geral@operon.pt";
const FOUNDERS = "Nuno Oliveira & Duarte Bastos";

const PAINS = [
  {
    icon: ClipboardList,
    title: "Produção em papel ou Excel",
    body: "Ordens de fabrico, registos de máquina e apontamentos feitos à mão — lentos, sujeitos a erro e sem histórico fiável.",
  },
  {
    icon: Gauge,
    title: "Zero visibilidade em tempo real",
    body: "Ninguém sabe, ao certo e agora, o que está parado, o que está atrasado ou qual a real capacidade disponível.",
  },
  {
    icon: PackageSearch,
    title: "Stock descontrolado",
    body: "Matéria-prima gerida de cabeça ou em folhas soltas — faltas inesperadas e compras de última hora.",
  },
  {
    icon: ScanLine,
    title: "Orçamentos demorados",
    body: "Cada orçamento é feito do zero, sem histórico de custos por operação — resposta lenta ao cliente e margens incertas.",
  },
  {
    icon: ShieldCheck,
    title: "Qualidade sem rastreio",
    body: "Não-conformidades resolvidas verbalmente, sem registo — o mesmo problema repete-se sem ninguém perceber porquê.",
  },
  {
    icon: Sparkles,
    title: "Decisões às cegas",
    body: "Sem dados consolidados, decidir onde investir tempo e dinheiro é sempre um palpite, nunca uma certeza.",
  },
];

const MODULES = [
  {
    name: PRODUCT.modules.core,
    body: "Backoffice de gestão — encomendas, orçamentos, produtos, stock e utilizadores por área (produção, armazém, comercial, qualidade).",
  },
  {
    name: PRODUCT.modules.station,
    body: "Terminal de chão de fábrica para operadores registarem produção, paragens e não-conformidades em segundos.",
  },
  {
    name: PRODUCT.modules.link,
    body: "Ponte entre as máquinas e a cloud — recolhe dados de produção diretamente do equipamento, sem apontamentos manuais.",
  },
  {
    name: PRODUCT.modules.portal,
    body: "Portal para os vossos clientes acompanharem encomendas, pedirem orçamentos e falarem convosco sem telefonemas.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Conversa de diagnóstico",
    body: "Vamos até à fábrica perceber, na prática, onde estão as maiores perdas de tempo e dinheiro.",
  },
  {
    n: "2",
    title: "Trial gratuito, sem compromisso",
    body: "Digitalizamos um processo concreto (ex: encomendas ou chão de fábrica) e medimos o impacto real, sem custos.",
  },
  {
    n: "3",
    title: "Resultados à vista",
    body: "Comparam o antes e o depois com números concretos — tempo poupado, erros evitados, decisões mais rápidas.",
  },
  {
    n: "4",
    title: "Escala e faturação",
    body: "Só depois de validado o valor é que escalamos para o resto da fábrica e passamos a cobrar.",
  },
];

const SCREENSHOTS = [
  {
    src: "/screenshots/orders-board.png",
    alt: "Painel administrativo com o quadro de encomendas por estado",
    caption: "Encomendas organizadas por estado, sem folhas de Excel",
  },
  {
    src: "/screenshots/producao.png",
    alt: "Quadro de produção com ordens de fabrico em curso",
    caption: "Chão de fábrica em tempo real, com máquinas e operadores",
  },
  {
    src: "/screenshots/armazem.png",
    alt: "Painel de armazém com controlo de stock de matérias-primas",
    caption: "Stock controlado, com alertas antes de faltar material",
  },
];

export default function OperonLandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-brand-line/30 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Image
            src={PRODUCT.logo}
            alt="Operon"
            width={120}
            height={29}
            priority
          />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <a href="#problema" className="hover:text-brand">
              O problema
            </a>
            <a href="#solucao" className="hover:text-brand">
              A solução
            </a>
            <a href="#como-funciona" className="hover:text-brand">
              Como funciona
            </a>
            <a href="#prova" className="hover:text-brand">
              Demonstração
            </a>
          </nav>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-soft"
          >
            Marcar conversa
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-dark">
            <Factory size={14} /> PMEs industriais · Vale de Cambra
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-brand sm:text-5xl">
            Otimização digital para fábricas que ainda trabalham no papel
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            A Operon digitaliza os processos do dia-a-dia da vossa fábrica —
            produção, encomendas, orçamentos e qualidade — com um trial
            gratuito antes de escalar e cobrar seja o que for.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-accent-dark"
            >
              <Mail size={16} /> Marcar uma conversa
            </a>
            <a
              href="#como-funciona"
              className="rounded-lg border border-brand-line px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-slate-50"
            >
              Ver como funciona
            </a>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section id="problema" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-brand">
              Dores que conhecemos bem
            </h2>
            <p className="mt-3 text-slate-600">
              A maioria das PMEs industriais na região enfrenta os mesmos
              problemas, todos os dias.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PAINS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-brand-line/20 bg-white p-6 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 font-semibold text-brand">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solução */}
      <section id="solucao" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-brand">A solução Operon</h2>
            <p className="mt-3 text-slate-600">
              Um único sistema, quatro módulos — cada um a resolver uma parte
              concreta do problema.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {MODULES.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl border border-brand-line/20 p-6"
              >
                <h3 className="font-semibold text-brand">{m.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-brand py-20 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Como funciona</h2>
            <p className="mt-3 text-slate-200">
              Começamos pequeno e sem risco — só escalamos depois de provado o
              valor.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-brand">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prova / demo */}
      <section id="prova" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-brand">
              Sistema real, não um mockup
            </h2>
            <p className="mt-3 text-slate-600">
              Capturas do sistema a correr, com dados de demonstração.
            </p>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {SCREENSHOTS.map((s) => (
              <figure
                key={s.src}
                className="overflow-hidden rounded-2xl border border-brand-line/20 shadow-sm"
              >
                <a
                  href={s.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Image
                    src={s.src}
                    alt={s.alt}
                    width={1440}
                    height={900}
                    className="h-56 w-full cursor-zoom-in object-cover object-top transition-opacity hover:opacity-85"
                  />
                </a>
                <figcaption className="border-t border-brand-line/20 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {s.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl font-bold text-brand">
            Vamos falar sobre a vossa fábrica?
          </h2>
          <p className="mt-3 text-slate-600">
            Sem apresentações genéricas — queremos perceber as vossas dores
            específicas e mostrar, na prática, o que conseguimos melhorar.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-accent-dark"
          >
            <Mail size={16} /> {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-line/20 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center text-sm text-slate-500">
          <Image src={PRODUCT.icon} alt="Operon" width={28} height={28} />
          <p>
            Operon · {FOUNDERS} · Vale de Cambra, Portugal
          </p>
          <p>
            <Link href="/login" className="hover:text-brand">
              Já são clientes? Entrar no portal →
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
