// Variável global para armazenar os dados
let listaAlunos = [];
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

        renderizar(listaAlunos);
    } catch (erro) {
        console.error("Erro ao buscar dados:", erro);
    }

    const inputBusca = document.getElementById("inputBusca");
    inputBusca?.addEventListener("input", (e) => {
        const termo = e.target.value.toLowerCase();
        const filtrados = listaAlunos.filter(aluno =>
            (aluno.nome || "").toLowerCase().includes(termo) ||
            String(aluno.matricula || "").toLowerCase().includes(termo)
        );
        renderizar(filtrados);
    });

    modal.addEventListener("click", (e) => {
        const rect = modal.getBoundingClientRect();
        const clicouFora = (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom);
        if (clicouFora || e.target.id === "closeModal" || e.target.classList.contains("cancel-button")) {
            modal.close();
        }
    });

    if (new URLSearchParams(window.location.search).has('login_error')) {
        setTimeout(() => abrirModal('login'), 100);
        window.history.replaceState({}, document.title, "/");
    }
});

function renderizar(alunos) {
    const corpo = document.querySelector("#corpoTabela");
    if (!corpo) return;

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

// FUNÇÕES AUXILIARES (Definidas antes para evitar o erro de ReferenceError)
function gerarDisciplinas(aluno, modo) {
    const disciplinas = Object.entries(aluno?.disciplinas || {});
    if (disciplinas.length === 0) return `<p class="aviso-vazio">Nenhuma disciplina.</p>`;

    return disciplinas.map(([nome, nota]) => {
        if (modo === "view") return `<li><strong>${nome.replace(/_/g, " ")}:</strong> ${nota}</li>`;
        return `
            <div class="input-group-nota" style="margin-top:10px">
                <input type="text" value="${nome}" class="nova-materia-nome" style="width: 40%">
                <input type="number" step="0.1" value="${nota}" class="nova-materia-nota" style="width: 20%">
                <button type="button" onclick="this.parentElement.remove()" style="color:red; border:none; background:none; cursor:pointer;">&times;</button>
            </div>`;
    }).join('');
}

function criarLinhaMateria() {
    const div = document.createElement('div');
    div.className = 'input-group-nota';
    div.style.marginTop = "10px";
    div.innerHTML = `
        <input type="text" placeholder="Matéria" class="nova-materia-nome" style="width: 40%">
        <input type="number" step="0.1" placeholder="Nota" class="nova-materia-nota" style="width: 20%">
        <button type="button" onclick="this.parentElement.remove()" style="color:red; border:none; background:none; cursor:pointer;">&times;</button>`;
    return div;
}

// FUNÇÃO PRINCIPAL DO MODAL
function abrirModal(acao, alunoId = null) {
    if (acao !== 'login' && !verificarAcesso()) {
        return alert("Acesso negado: Você não tem permissão.");
    }

    const aluno = alunoId ? listaAlunos.find(a => a.id === alunoId) : null;
    modal.showModal();

    switch (acao) {
        case 'login':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Login</h2>
                <form action='/login' method="POST">
                    <label>Username:</label><input type="text" name="username">
                    <label>Password:</label><input type="password" name="password">
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
            
            document.getElementById('addMateria').onclick = () => {
                document.getElementById('editNotasContainer').appendChild(criarLinhaMateria());
            };
            document.getElementById('confirmEditNotas').onclick = () => salvarNotas(aluno.id);
            break;

        case 'remove':
            modalContent.innerHTML = `
                <span id="closeModal">&times;</span>
                <h2>Excluir</h2>
                <p>Deseja remover <b>${aluno?.nome}</b>?</p>
                <button id="confirmRemove" style="background-color:red; color:white">Remover</button>
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

            document.getElementById('btnNovaMateria').onclick = () => {
                document.getElementById('addNotasContainer').appendChild(criarLinhaMateria());
            };
            document.getElementById('confirmAdd').onclick = salvarNovoAluno;
            break;
    }
}

// FUNÇÕES DE COMUNICAÇÃO COM O SERVIDOR (FETCH)
async function salvarNovoAluno() {
    const nome = document.getElementById('addNome').value;
    const matricula = document.getElementById('addMatricula').value;
    const turma = document.getElementById('addTurma').value;
    const disciplinas = coletarNotas('#addNotasContainer');

    if (!nome || !matricula) return alert("Preencha Nome e Matrícula!");

    await realizarFetch("/alunos", "POST", { nome, matricula, turma, disciplinas });
}

async function salvarEdicao(id) {
    const nome = document.getElementById('editNome').value;
    const turma = document.getElementById('editTurma').value;
    await realizarFetch(`/alunos/${id}`, "PUT", { nome, turma });
}

async function salvarNotas(id) {
    const disciplinas = coletarNotas('#editNotasContainer');
    await realizarFetch(`/alunos/${id}/notas`, "PUT", { disciplinas });
}

async function deletarAluno(id) {
    await realizarFetch(`/alunos/${id}`, "DELETE");
}

// Funções utilitárias para o Fetch e coleta de dados
function coletarNotas(containerId) {
    const disciplinas = {};
    const nomes = document.querySelectorAll(`${containerId} .nova-materia-nome`);
    const notas = document.querySelectorAll(`${containerId} .nova-materia-nota`);
    nomes.forEach((input, i) => {
        const nome = input.value.trim().replace(/\s+/g, '_');
        if (nome) disciplinas[nome] = parseFloat(notas[i].value) || 0;
    });
    return disciplinas;
}

async function realizarFetch(url, metodo, corpo = null) {
    try {
        const options = { method: metodo, headers: { "Content-Type": "application/json" } };
        if (corpo) options.body = JSON.stringify(corpo);
        
        const response = await fetch(url, options);
        if (response.ok) {
            alert("Operação realizada!");
            location.reload();
        } else {
            alert("Erro no servidor.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão.");
    }
}