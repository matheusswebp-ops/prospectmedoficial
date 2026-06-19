const { tarefaJaExiste, criarTarefa } = require('../sistema');
const { extrairPrazo, buscarDetalhesTarefa } = require('../clickup');

async function processar(tarefas, cliente) {
  let criadas = 0;
  for (const t of tarefas) {
    if (await tarefaJaExiste(t.id)) continue;
    const { descricao, linkArquivo } = await buscarDetalhesTarefa(t.id);
    await criarTarefa({
      titulo: `${cliente.prefixo}_${t.name}`,
      clienteId: cliente.supabase_cliente_id,
      clickupTaskId: t.id,
      prazo: extrairPrazo(t),
      descricao,
      linkArquivo,
    });
    criadas++;
  }
  return criadas;
}

module.exports = { processar };
