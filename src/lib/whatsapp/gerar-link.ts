export function gerarLinkWhatsApp(telefone: string, mensagem: string): string {
  const digits = telefone.replace(/\D/g, '')
  const comDDI = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(mensagem)}`
}

export function renderizarTemplate(
  template: string,
  vars: { nome: string; especialidade: string; link: string }
): string {
  return template
    .replace(/\{\{NOME\}\}/g, vars.nome)
    .replace(/\{\{ESPECIALIDADE\}\}/g, vars.especialidade)
    .replace(/\{\{LINK\}\}/g, vars.link)
}

export const TEMPLATE_PADRAO = `Oi {{NOME}}, tudo bem?

Montei um site profissional pro seu consultório de {{ESPECIALIDADE}} — já tá no ar pra você dar uma olhada:
👉 {{LINK}}

O que achou? Posso ajustar qualquer detalhe pra ficar do seu jeito.`
