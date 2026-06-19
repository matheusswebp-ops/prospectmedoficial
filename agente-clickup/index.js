require('dotenv').config();
const clientes = require('./regras/clientes.json');
const { buscarTarefasDaLista } = require('./clickup');
const { processar: processarSimples } = require('./processadores/simples');
const { processar: processarMentesMob } = require('./processadores/mentesMob');
const { processar: processarLemos } = require('./processadores/lemos');

const processadores = {
  simples: processarSimples,
  agrupamento: processarMentesMob,
  lemos: processarLemos,
};

async function executar() {
  console.log(`[${new Date().toISOString()}] Iniciando sincronização ClickUp → Fluxo`);
  const resumo = [];

  for (const cliente of clientes) {
    try {
      let tarefas = [];
      for (const listId of cliente.clickup_list_ids) {
        tarefas = tarefas.concat(await buscarTarefasDaLista(listId, {
          filtrarAssignee: cliente.filtrar_assignee !== false,
          filtrarData: cliente.filtrar_data !== false,
          buscarSubtasks: cliente.buscar_subtasks === true,
        }));
      }

      const processar = processadores[cliente.logica];
      if (!processar) throw new Error(`Lógica desconhecida: ${cliente.logica}`);

      const criadas = await processar(tarefas, cliente);
      resumo.push({ cliente: cliente.nome_exibicao, tarefas: tarefas.length, criadas });
      console.log(`✓ ${cliente.nome_exibicao}: ${tarefas.length} tarefas → ${criadas} criadas`);
    } catch (err) {
      console.error(`✗ ${cliente.nome_exibicao}: ${err.message}`);
      resumo.push({ cliente: cliente.nome_exibicao, erro: err.message });
    }
  }

  console.log('\n── Resumo ──');
  resumo.forEach(r => {
    if (r.erro) console.log(`  ${r.cliente}: ERRO — ${r.erro}`);
    else console.log(`  ${r.cliente}: ${r.criadas} criada(s)`);
  });
  return resumo;
}

module.exports = { executar };
if (require.main === module) executar();
