# Operon — Landing page

Site estático de marketing/pitch da Operon (a empresa), **separado da app
de cliente** (`portal-cliente`, que é single-tenant — cada fábrica tem a
sua própria instância/domínio).

Não depende de Next.js, build step, nem de nada dentro de `src/`. É só
HTML + CSS puro, com os assets ao lado (`operon-logo.svg`,
`operon-icon.svg`, `screenshots/`).

## Ver localmente

Basta abrir `index.html` diretamente no browser (duplo-clique / `open
landing/index.html`) — não precisa de servidor.

## Deploy (Vercel, projeto separado do mesmo repo)

1. No dashboard da Vercel: **Add New → Project** → importar este mesmo
   repositório (`portal-cliente`) outra vez, como um **novo projeto**.
2. Em **Root Directory**, escolher `landing`.
3. Em **Framework Preset**, escolher **Other** (site estático, sem build).
4. Deploy. Fica com um domínio Vercel próprio
   (ex: `operon-landing.vercel.app`), completamente independente do
   domínio da app de qualquer fábrica cliente.
5. Opcional: atribuir um domínio próprio (ex: `operon.pt`) nas
   definições desse projeto.

Cada `git push` no repo atualiza os dois projetos Vercel de forma
independente (cada um só rebuilda se algo dentro da sua Root Directory
mudar).
