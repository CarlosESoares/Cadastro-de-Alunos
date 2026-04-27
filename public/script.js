// Variável global para armazenar os dados
let listaAlunos = [];
let listaTurmas = [];
const LIMITE_LINHAS = 500;

const modal = document.getElementById('Modal');
const modalContent = modal.querySelector('.modal-content');

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/alunos");
        listaAlunos = await response.json();

        listaAlunos.sort((a, b) =>
            String(a.turma || "").localeCompare(String(b.turma || "")) ||
            String(a.nome || "").localeCompare(String(b.nome || ""))
        );

        // Aplica limite inicial
        renderizar(listaAlunos.slice(0, LIMITE_LINHAS));
    } catch (erro) {
        console.error("Erro ao buscar dados:", erro);
    }

    // Filtro de busca otimizado
    const inputBusca = document.getElementById("inputBusca");
    inputBusca?.addEventListener("input", (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = listaAlunos.filter(aluno =>
            (aluno.nome || "").toLowerCase().includes(termo) ||
            String(aluno.matricula || "").toLowerCase().includes(termo)
        );
        renderizar(filtrados.slice(0, LIMITE_LINHAS));
    });

    modal.addEventListener("click", (e) => {
        if (e.target.id === "closeModal" || e.target.classList.contains("cancel-button")) {
            modal.close();
        }
    });

    await carregarOpcoesTurmas();

    const filtroTurma = document.getElementById("filtroTurma");
    filtroTurma?.addEventListener("change", (e) => {
        const turmaSelecionada = e.target.value;
        const filtrados = turmaSelecionada === ""
            ? listaAlunos
            : listaAlunos.filter(aluno => aluno.turma === turmaSelecionada);

        renderizar(filtrados.slice(0, LIMITE_LINHAS));
    });

    if (new URLSearchParams(window.location.search).has('login_error')) {
        setTimeout(() => abrirModal('login'), 100);
        window.history.replaceState({}, document.title, "/");
    }

    configurarBotaoAuth();
});

function renderizar(alunos) {
    const corpo = document.querySelector("#corpoTabela");
    if (!corpo) return;

    // Renderização em lote para melhor performance
    corpo.innerHTML = alunos.map(aluno => `
        <tr>
            <td>${aluno.nome}<br>${aluno.matricula}</td>
            <td>${aluno.turma || 'Não informado'}</td>
            <td><img src="/imgs/icon-eye.png" class="edit-button" onclick="abrirModal('view', '${aluno.id}')"></td>
            <td><img src="/imgs/icon-edit.png" class="edit-button" onclick="abrirModal('edit', '${aluno.id}')"></td>
            <td><img src="/imgs/icon-notes.png" class="trash-button" onclick="abrirModal('edit-notas', '${aluno.id}')"></td>
            <td><img src="/imgs/icon-trash.png" class="trash-button" onclick="abrirModal('remove', '${aluno.id}')"></td>
        </tr>
    `).join('');
}

function verificarAcesso() {
    return document.body.getAttribute("data-admin") === "true";
}

function abrirModal(acao, alunoId = null) {
    // 'view' e 'login' são liberados para todos. Outras ações exigem admin.
    const acoesPublicas = ['login', 'view'];
    if (!acoesPublicas.includes(acao) && !verificarAcesso()) {
        return alert("Acesso negado: Somente administradores podem realizar alterações.");
    }

    const aluno = alunoId ? listaAlunos.find(a => a.id === alunoId) : null;
    modal.showModal();

    switch (acao) {
        case 'login':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Login</h2>
                <form action='/login' method="POST">
                    <label>Username:</label><input type="text" name="username" required>
                    <label>Password:</label><input type="password" name="password" required>
                    <button type="submit">Entrar</button>
                    <button type="button" class="cancel-button">Cancelar</button>
                </form>`;
            break;

        case 'view':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Dados do Aluno</h2>
                <p><strong>Nome:</strong> ${aluno?.nome}</p>
                <p><strong>Matrícula:</strong> ${aluno?.matricula}</p>
                <div id="viewCurso"><strong>Disciplinas:</strong><ul>${gerarDisciplinas(aluno, "view")}</ul></div>
                <p><strong>Média:</strong> ${aluno?.media || 'N/A'}</p>
                <button class="cancel-button">Fechar</button>`;
            break;

        case 'edit':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Editar Aluno</h2>
                <input type="text" id="editNome" value="${aluno?.nome || ''}">
                <input type="text" id="editTurma" value="${aluno?.turma || ''}">
                <button id="confirmEdit">Salvar Alterações</button>
                <button class="cancel-button">Cancelar</button>`;
            document.getElementById('confirmEdit').onclick = () => salvarEdicao(aluno.id);
            break;

        case 'edit-notas':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Notas: ${aluno?.nome}</h2>
                <div id="editNotasContainer">${gerarDisciplinas(aluno, "edit-notas")}</div>
                <button type="button" id="addMateria">+ Matéria</button>
                <button id="confirmEditNotas">Salvar Notas</button>
                <button class="cancel-button">Cancelar</button>`;
            document.getElementById('addMateria').onclick = () => document.getElementById('editNotasContainer').appendChild(criarLinhaMateria());
            document.getElementById('confirmEditNotas').onclick = () => salvarNotas(aluno.id);
            break;

        case 'remove':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Excluir</h2>
                <p>Deseja remover <b>${aluno?.nome}</b>?</p>
                <button id="confirmRemove">Remover</button>
                <button class="cancel-button">Cancelar</button>`;
            document.getElementById('confirmRemove').onclick = () => deletarAluno(aluno.id);
            break;

        case 'add':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Adicionar Aluno</h2>
                <input type="text" id="addNome" placeholder="Nome">
                <input type="text" id="addMatricula" placeholder="Matrícula">
                <input type="text" id="addTurma" placeholder="Turma">
                <div id="addNotasContainer"></div>
                <button type="button" id="btnNovaMateria">+ Disciplina</button>
                <button id="confirmAdd">Adicionar Aluno</button>
                <button class="cancel-button">Cancelar</button>`;
            document.getElementById('btnNovaMateria').onclick = () => document.getElementById('addNotasContainer').appendChild(criarLinhaMateria());
            document.getElementById('confirmAdd').onclick = salvarNovoAluno;
            break;
    }
}

async function realizarFetchProtegido(url, metodo, corpo, mensagem) {
    if (!verificarAcesso()) return alert("Erro: Você perdeu a sessão de administrador.");
    await realizarFetch(url, metodo, corpo, mensagem);
}

async function salvarNovoAluno() {
    const nome = document.getElementById('addNome').value;
    const matricula = document.getElementById('addMatricula').value;
    const turma = document.getElementById('addTurma').value;
    const disciplinas = coletarNotas('#addNotasContainer');

    if (!nome || !matricula) return alert("Preencha Nome e Matrícula!");
    await realizarFetchProtegido("/alunos", "POST", { nome, matricula, turma, disciplinas }, "Aluno adicionado!");
}

async function salvarEdicao(id) {
    const nome = document.getElementById('editNome').value;
    const turma = document.getElementById('editTurma').value;
    await realizarFetchProtegido(`/alunos/${id}`, "PUT", { nome, turma }, "Aluno atualizado!");
}

async function salvarNotas(id) {
    const disciplinas = coletarNotas('#editNotasContainer');
    await realizarFetchProtegido(`/alunos/${id}/notas`, "PUT", { disciplinas }, "Notas atualizadas!");
}

async function deletarAluno(id) {
    await realizarFetchProtegido(`/alunos/${id}`, "DELETE", null, "Aluno removido!");
}

function gerarDisciplinas(aluno, modo) {
    const disciplinas = Object.entries(aluno?.disciplinas || {});
    if (disciplinas.length === 0) return `<p class="aviso-vazio">Nenhuma disciplina.</p>`;

    return disciplinas.map(([nome, nota]) => {
        if (modo === "view") return `<li><strong>${nome.replace(/_/g, " ")}:</strong> ${nota}</li>`;
        return `
            <div class="input-group-nota">
                <input type="text" value="${nome}" class="nova-materia-nome">
                <input type="number" 
                    step="0.1" 
                    min="0" 
                    max="10" 
                    value="${nota}" 
                    class="nova-materia-nota"
                    oninput="if(this.value > 10) this.value = 10; if(this.value < 0) this.value = 0;">
                <button type="button" onclick="this.parentElement.remove()">&times;</button>
            </div>`;
    }).join('');
}

function criarLinhaMateria() {
    const div = document.createElement('div');
    div.className = 'input-group-nota';
    div.style.marginTop = "10px";
    div.innerHTML = `
        <input type="text" placeholder="Matéria" class="nova-materia-nome">
        <input type="number" 
               step="0.1" 
               min="0" 
               max="10" 
               placeholder="Nota" 
               class="nova-materia-nota"
               oninput="if(this.value > 10) this.value = 10; if(this.value < 0) this.value = 0;">
        <button type="button" onclick="this.parentElement.remove()">&times;</button>`;
    return div;
}

function coletarNotas(containerId) {
    const disciplinas = {};
    document.querySelectorAll(`${containerId} .input-group-nota`).forEach(group => {
        const nome = group.querySelector('.nova-materia-nome').value.trim().replace(/\s+/g, '_');
        let nota = parseFloat(group.querySelector('.nova-materia-nota').value) || 0;

        if (nota > 10) nota = 10;
        if (nota < 0) nota = 0;

        if (nome) disciplinas[nome] = nota;
    });
    return disciplinas;
}
async function realizarFetch(url, metodo, corpo = null, tipo) {
    try {
        const options = {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: corpo ? JSON.stringify(corpo) : null
        };

        const response = await fetch(url, options);
        if (response.ok) {
            alert(tipo);
            location.reload();
        } else {
            const erroMsg = await response.text();
            alert("Erro no servidor: " + (erroMsg || "Ação não autorizada."));
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    }
}

function configurarBotaoAuth() {
    const btnAuth = document.getElementById("buttonLogin");
    if (!btnAuth) return;

    if (verificarAcesso()) {
        btnAuth.innerText = "Logout";
        btnAuth.onclick = fazerLogout;
    } else {
        btnAuth.innerText = "Login";
        btnAuth.onclick = () => abrirModal('login');
    }
}

async function fazerLogout() {
    try {
        const response = await fetch("/logout", { method: "GET" });
        if (response.ok) {
            alert("Você saiu do sistema.");
            location.reload();
        }
    } catch (erro) {
        console.error("Erro ao deslogar:", erro);
    }
}

async function carregarOpcoesTurmas() {
    try {
        const response = await fetch("/turmas");
        listaTurmas = await response.json();
        const select = document.getElementById("filtroTurma");
        if (select) {
            select.innerHTML = '<option value="">Todas as Turmas</option>' +
                listaTurmas.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    } catch (erro) {
        console.error("Erro ao carregar turmas:", erro);
    }
}