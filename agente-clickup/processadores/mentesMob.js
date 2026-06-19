const { tarefaJaExiste, buscarIdPorClickupId, criarTarefa } = require('../sistema');
const { extrairValorCampo, extrairPrazo, buscarDetalhesTarefa } = require('../clickup');

async function processar(tarefas, cliente) {
  let criadas = 0;
  const grupos = {};

  for (const t of tarefas) {
    const clienteFinal = extrairValorCampo(t, cliente.campo_cliente_final) || '_sem_cliente';
    if (!grupos[clienteFinal]) grupos[clienteFinal] = [];
    grupos[clienteFinal].push(t);
  }

  for (const [clienteFinal, grupo] of Object.entries(grupos)) {
    if (grupo.length === 1 || clienteFinal === '_sem_cliente') {
      for (const t of grupo) {
        if (await tarefaJaExiste(t.id)) continue;
        const { descricao, linkArquivo } = await buscarDetalhesTarefa(t.id);
        await criarTarefa({
          titulo: `MentesMob_${t.name}`,
          clienteId: cliente.supabase_cliente_id,
          clickupTaskId: t.id,
          prazo: extrairPrazo(t),
          descricao,
          linkArquivo,
        });
        criadas++;
      }
      continue;
    }

    const idMae = `mentesmob_grupo_${clienteFinal}_${new Date().toISOString().split('T')[0]}`;
    let parentId;

    if (!(await tarefaJaExiste(idMae))) {
      parentId = await criarTarefa({
        titulo: `MentesMob_${clienteFinal}`,
        clienteId: cliente.supabase_cliente_id,
        clickupTaskId: idMae,
      });
      criadas++;
    } else {
      parentId = await buscarIdPorClickupId(idMae);
    }

    for (const t of grupo) {
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
  }
  return criadas;
}

module.exports = { processar };
