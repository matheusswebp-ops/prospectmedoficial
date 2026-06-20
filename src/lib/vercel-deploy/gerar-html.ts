import fs from 'fs'
import path from 'path'
import specialtyColors from '@/lib/specialty-colors.json'
import specialtyContent from '@/lib/specialty-content.json'

type SpecialtyKey = keyof typeof specialtyColors
type SpecialtyContentKey = keyof typeof specialtyContent

/**
 * Mapeia qualquer string de especialidade para uma chave do specialty-colors.json.
 * Usa correspondência case-insensitive por keyword/substring.
 */
function mapearEspecialidade(especialidade: string): SpecialtyKey {
  const lower = especialidade.toLowerCase()

  if (/dentist|odontolog|cirurgião.dentista|cirurgiao.dentista|dent/.test(lower)) return 'odontologia'
  if (/cardio/.test(lower)) return 'cardiologia'
  if (/pediatr|infant/.test(lower)) return 'pediatria'
  if (/dermat/.test(lower)) return 'dermatologia'
  if (/psicolog|psiquiatr/.test(lower)) return 'psicologia'
  if (/nutri/.test(lower)) return 'nutricao'
  if (/fisio/.test(lower)) return 'fisioterapia'
  if (/oftalm/.test(lower)) return 'oftalmologia'
  if (/ortop/.test(lower)) return 'ortopedia'
  if (/neurol/.test(lower)) return 'neurologia'
  if (/endocrin/.test(lower)) return 'endocrinologia'
  if (/ginecol|obstetri/.test(lower)) return 'ginecologia'
  if (/urol/.test(lower)) return 'urologia'
  if (/gastro/.test(lower)) return 'gastroenterologia'
  if (/reumat/.test(lower)) return 'reumatologia'

  return 'default'
}

function mapearConteudo(especialidade: string): typeof specialtyContent['default'] {
  const key = mapearEspecialidade(especialidade) as SpecialtyContentKey
  return specialtyContent[key] ?? specialtyContent['default']
}

/**
 * Normaliza telefone para exibição amigável.
 * Ex: "5511999990000" → "(11) 99999-0000"
 */
function formatarTelefoneDisplay(telefone: string | null, telefoneRaw: string | null): string {
  const source = telefoneRaw ?? telefone ?? ''
  const digits = source.replace(/\D/g, '').replace(/^55/, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return source || 'Consultar'
}

/**
 * Gera o slug de tratamento a partir da especialidade.
 * Ex: "Cardiologia" → "cardiologia"
 *     "Clínico Geral" → "clinico-geral"
 */
function gerarSlugTratamento(especialidade: string): string {
  return especialidade
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50)
}

/**
 * Normaliza a query para o Google Maps embed.
 */
function gerarMapsQuery(nome: string, especialidade: string, cidade: string): string {
  const query = `${nome} ${especialidade} ${cidade}`
  return encodeURIComponent(query)
}

/**
 * Extrai o nome curto do profissional a partir do nome do Google Maps.
 * Ex: "Psicóloga Clínica em Fortaleza - Penélope Freitas" → "Penélope Freitas"
 * Ex: "Dr. João Silva" → "João Silva"
 * Ex: "Clínica Vamos Sorrir" → "Clínica Vamos Sorrir" (sem mudança)
 */
function extrairNomeCurto(nome: string): string {
  // Se tem " - ", pega a parte depois do traço (geralmente o nome pessoal)
  if (nome.includes(' - ')) {
    const parte = nome.split(' - ').pop()?.trim()
    if (parte && parte.length > 3) return parte
  }

  // Remove prefixos de especialidade + cidade antes do nome
  // Ex: "Psicóloga em Fortaleza | Ana Silva" → "Ana Silva"
  const pipeMatch = nome.match(/[|]\s*(.+)$/)
  if (pipeMatch?.[1]?.trim()) return pipeMatch[1].trim()

  // Remove prefixos Dr/Dra/Prof
  const semPrefixo = nome.replace(/^(dr\.?|dra\.?|prof\.?)\s+/i, '').trim()

  // Se o nome ainda é muito longo (>35 chars), pega as últimas 2-3 palavras
  if (semPrefixo.length > 35) {
    const palavras = semPrefixo.split(/\s+/)
    if (palavras.length > 3) {
      return palavras.slice(-2).join(' ')
    }
  }

  return semPrefixo
}

export interface GerarHtmlInput {
  nome: string
  especialidade: string
  cidade: string
  telefone_e164: string | null
  telefone: string | null
  foto_url: string | null
  endereco: string | null
}

/**
 * Lê o template HTML base, substitui todos os tokens {{TOKEN}} e retorna
 * o HTML final pronto para deploy.
 *
 * @throws {Error} Se algum token residual for encontrado após a substituição.
 */
export function gerarHtml(lead: GerarHtmlInput): string {
  // Localizar o template em relação à raiz do projeto (não do módulo)
  // Em produção/Railway: __dirname aponta para worker/ ou dist/
  // Tentamos várias localizações para garantir compatibilidade
  const possiblePaths = [
    path.resolve(process.cwd(), 'templates', 'base', 'index.html'),
    path.resolve(__dirname, '..', '..', 'templates', 'base', 'index.html'),
    path.resolve(__dirname, '..', '..', '..', 'templates', 'base', 'index.html'),
    path.resolve(__dirname, 'templates', 'base', 'index.html'),
  ]

  let templateHtml: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      templateHtml = fs.readFileSync(p, 'utf-8')
      break
    }
  }

  if (!templateHtml) {
    throw new Error(
      `Template HTML não encontrado. Caminhos testados:\n${possiblePaths.join('\n')}`
    )
  }

  // Determinar paleta de cores e conteúdo por especialidade
  const specialtyKey = mapearEspecialidade(lead.especialidade)
  const cores = specialtyColors[specialtyKey]
  const conteudo = mapearConteudo(lead.especialidade)

  // Preparar os valores dos tokens
  const telefoneE164 = lead.telefone_e164 ?? ''
  const telefoneDisplay = formatarTelefoneDisplay(lead.telefone_e164, lead.telefone)
  const slugTratamento = gerarSlugTratamento(lead.especialidade)
  const mapsQuery = gerarMapsQuery(lead.nome, lead.especialidade, lead.cidade)
  const anoAtual = new Date().getFullYear().toString()

  // Foto: se nula usar placeholder (será substituída pelo worker antes do deploy)
  const fotoUrl = lead.foto_url ?? ''

  // Gerar iniciais para o avatar do navbar
  const nomeCurto = extrairNomeCurto(lead.nome)
  const palavras = nomeCurto.trim().split(/\s+/)
  const initials = palavras.length >= 2
    ? (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase()
    : palavras[0].slice(0, 2).toUpperCase()

  // Mapa de tokens → valores
  const tokenMap: Record<string, string> = {
    '{{NOME}}': nomeCurto,
    '{{INITIALS}}': initials,
    '{{ESPECIALIDADE}}': lead.especialidade,
    '{{CIDADE}}': lead.cidade,
    '{{TELEFONE_DISPLAY}}': telefoneDisplay,
    '{{TELEFONE_E164}}': telefoneE164,
    '{{COR_PRIMARIA}}': cores.primaria,
    '{{COR_SECUNDARIA}}': cores.secundaria,
    '{{FOTO_URL}}': fotoUrl,
    '{{MAPS_QUERY}}': mapsQuery,
    '{{SLUG_TRATAMENTO}}': slugTratamento,
    '{{ANO_ATUAL}}': anoAtual,
    // Serviços específicos por especialidade
    '{{SERVICO_1_NOME}}': conteudo.servicos[0].nome,
    '{{SERVICO_1_DESC}}': conteudo.servicos[0].desc,
    '{{SERVICO_2_NOME}}': conteudo.servicos[1].nome,
    '{{SERVICO_2_DESC}}': conteudo.servicos[1].desc,
    '{{SERVICO_3_NOME}}': conteudo.servicos[2].nome,
    '{{SERVICO_3_DESC}}': conteudo.servicos[2].desc,
    // Áreas de atuação específicas por especialidade
    '{{AREA_1_NOME}}': conteudo.areas[0].nome,
    '{{AREA_1_DESC}}': conteudo.areas[0].desc,
    '{{AREA_2_NOME}}': conteudo.areas[1].nome,
    '{{AREA_2_DESC}}': conteudo.areas[1].desc,
    '{{AREA_3_NOME}}': conteudo.areas[2].nome,
    '{{AREA_3_DESC}}': conteudo.areas[2].desc,
    '{{AREA_4_NOME}}': conteudo.areas[3].nome,
    '{{AREA_4_DESC}}': conteudo.areas[3].desc,
    '{{AREA_5_NOME}}': conteudo.areas[4].nome,
    '{{AREA_5_DESC}}': conteudo.areas[4].desc,
    '{{AREA_6_NOME}}': conteudo.areas[5].nome,
    '{{AREA_6_DESC}}': conteudo.areas[5].desc,
    // FAQ específico por especialidade
    '{{FAQ_1_Q}}': conteudo.faq[0].q,
    '{{FAQ_1_A}}': conteudo.faq[0].a,
    '{{FAQ_2_Q}}': conteudo.faq[1].q,
    '{{FAQ_2_A}}': conteudo.faq[1].a,
    '{{FAQ_3_Q}}': conteudo.faq[2].q,
    '{{FAQ_3_A}}': conteudo.faq[2].a,
    '{{FAQ_4_Q}}': conteudo.faq[3].q,
    '{{FAQ_4_A}}': conteudo.faq[3].a,
    '{{FAQ_5_Q}}': conteudo.faq[4].q,
    '{{FAQ_5_A}}': conteudo.faq[4].a,
  }

  // Substituir todos os tokens de forma global
  let html = templateHtml
  for (const [token, value] of Object.entries(tokenMap)) {
    // Escapar caracteres especiais de regex no token (chaves, pipe, etc.)
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    html = html.replace(new RegExp(escapedToken, 'g'), value)
  }

  // Validar tokens residuais — qualquer {{TOKEN}} remanescente é um erro
  const residualTokens = html.match(/\{\{[A-Z_]+\}\}/g)
  if (residualTokens && residualTokens.length > 0) {
    throw new Error(
      `Tokens não substituídos no template HTML: ${Array.from(new Set(residualTokens)).join(', ')}`
    )
  }

  return html
}
