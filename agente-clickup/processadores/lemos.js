const { tarefaJaExiste, buscarIdPorClickupId, criarTarefa } = require('../sistema');
const { extrairPrazo, buscarDetalhesTarefa } = require('../clickup');

async function processar(tarefas, cliente) {
  if (tarefas.length === 0) return 0;

  const hoje = new Date();
  const data = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
  const idMae = `lemos_mae_${hoje.toISOString().split('T')[0]}`;
  let parentId;
  let criadas = 0;

  if (!(await tarefaJaExiste(idMae))) {
    parentId = await criarTarefa({
      titulo: `Lemos_${data}`,
      clienteId: cliente.supabase_cliente_id,
      clickupTaskId: idMae,
    });
    criadas++;
  } else {
    parentId = await buscarIdPorClickupId(idMae);
  }

  for (const t of tarefas) {
    if (await tarefaJaExiste(t.id)) continue;
    const { descricao, linkArquivo } = await buscarDetalhesTarefa(t.id);
    await criarTarefa({
      titulo: t.name,
      clienteId: cliente.supabase_cliente_id,
      clickupTaskId: t.id,
      parentId,
      prazo: extrairPrazo(t),
      descricao,
      linkArquivo,
    });
    criadas++;
  }
  return criadas;
}

module.exports = { processar };
