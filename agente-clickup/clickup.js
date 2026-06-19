const axios = require('axios');
const { marked } = require('marked');
require('dotenv').config();

const BASE = 'https://api.clickup.com/api/v2';
const headers = { Authorization: process.env.CLICKUP_TOKEN };

// Status "a fazer" por workspace — NÃO adicionar: adiantado, em aprovação, aprovado, em alteração, em atraso
// ATENÇÃO: VD usa "fazer" (sem "a") nas subtarefas — ambos devem estar na lista
const STATUSES_PERMITIDOS = ['to do', 'a fazer', 'fazer', 'pendente', 'open', 'não iniciado', 'backlog', 'design', 'informações'];

async function buscarTarefasDaLista(listId, { filtrarAssignee = true, filtrarData = true, buscarSubtasks = false } = {}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const emCincoDias = new Date(hoje);
  // +6 para incluir o 5º dia completo (due_date_lt é estrito — +5 excluiria tarefas do 5º dia)
  emCincoDias.setDate(emCincoDias.getDate() + 6);

  const params = { include_closed: false, subtasks: buscarSubtasks };
  if (filtrarAssignee) params['assignees[]'] = process.env.CLICKUP_USER_ID;
  if (filtrarData) {
    params.due_date_gt = hoje.getTime();
    params.due_date_lt = emCincoDias.getTime();
  }

  const resp = await axios.get(`${BASE}/list/${listId}/task`, { headers, params });
  const tarefas = resp.data.tasks || [];

  return tarefas.filter(t => {
    const status = (t.status?.status || '').toLowerCase().trim();
    return STATUSES_PERMITIDOS.some(s => status.includes(s));
  });
}

async function buscarDetalhesTarefa(taskId) {
  // OBRIGATÓRIO: include_markdown_description=true — retorna links reais embutidos no markdown.
  // O campo plain 'description' perde todas as URLs dos links.
  const resp = await axios.get(`${BASE}/task/${taskId}`, {
    headers,
    params: { include_markdown_description: true }
  });
  let markdown = resp.data?.markdown_description || resp.data?.description || null;
  if (!markdown) return { descricao: null, linkArquivo: null };

  // Extrair link de pasta do Drive — detecta pelo formato da URL, não pelo label
  // Labels variam por cliente (Subir aqui / Anexar aqui / Pasta de entrega / etc.)
  const matchFinalizado = markdown.match(/https?:\/\/drive\.google\.com\/drive\/folders\/[^\s)"]+/);
  const linkArquivo = matchFinalizado ? matchFinalizado[0] : null;

  // Remover linha com o link + linha anterior se for label orfã (termina com ":")
  markdown = markdown.replace(
    /^(?:[^\n]*:\s*\n)?[^\n]*drive\.google\.com\/drive\/folders\/[^\n]*\n?/gim,
    ''
  ).trim();
  // Limpar linhas em branco extras geradas pela remoção
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Garantir parágrafo separado para cada Card/Slide
  // Lemos usa "**Card 1**", Scale Branding usa "**Slide 1:**" — ambos precisam de \n\n
  markdown = markdown.replace(/\n(\*\*(?:Card|Slide) \d+)/g, '\n\n$1');

  // Converter markdown para HTML — o editor do Fluxo renderiza HTML, não markdown cru
  const descricao = marked(markdown);

  return { descricao, linkArquivo };
}

function extrairPrazo(tarefa) {
  if (!tarefa.due_date) return null;
  const d = new Date(Number(tarefa.due_date));
  return d.toISOString().split('T')[0];
}

function extrairValorCampo(tarefa, nomeCampo) {
  const campo = (tarefa.custom_fields || []).find(f => f.name === nomeCampo);
  if (!campo || campo.value === undefined || campo.value === null) return null;
  if (campo.type === 'drop_down' && campo.type_config?.options) {
    const opt = campo.type_config.options.find(o => o.orderindex === campo.value);
    return opt ? opt.name : null;
  }
  return String(campo.value);
}

module.exports = { buscarTarefasDaLista, buscarDetalhesTarefa, extrairPrazo, extrairValorCampo };
