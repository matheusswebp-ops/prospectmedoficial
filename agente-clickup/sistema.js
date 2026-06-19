const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const RESPONSAVEL = process.env.RESPONSAVEL_PADRAO_ID;

async function tarefaJaExiste(clickupTaskId) {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('clickup_task_id', clickupTaskId)
    .maybeSingle();
  return !!data;
}

async function buscarIdPorClickupId(clickupTaskId) {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('clickup_task_id', clickupTaskId)
    .single();
  return data?.id || null;
}

async function criarTarefa({ titulo, clienteId, clickupTaskId, parentId = null, prazo = null, descricao = null, linkArquivo = null }) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      titulo,
      descricao: descricao || '',
      // CRÍTICO: o frontend usa campos diferentes dependendo do tipo de tarefa:
      // link_demanda → "Link arquivos finalizados" em tarefas RAIZ (sem parentId)
      // link_arquivo → "Link dos arquivos finalizados" em SUBTAREFAS (com parentId)
      link_demanda: !parentId ? (linkArquivo || null) : null,
      link_arquivo:  parentId ? (linkArquivo || null) : null,
      status: 'a_fazer',
      prioridade: 'normal',
      responsavel: RESPONSAVEL,
      cliente_id: clienteId,
      parent_id: parentId,
      prazo,
      clickup_task_id: clickupTaskId,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Erro ao criar tarefa "${titulo}": ${error.message}`);
  return data.id;
}

module.exports = { tarefaJaExiste, buscarIdPorClickupId, criarTarefa };
