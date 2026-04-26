# encoding: utf-8
require 'sinatra'
require 'mongo'
require 'bcrypt'
require 'json'

set :bind, '0.0.0.0'
set :port, 4567

enable :sessions

use Rack::Session::Cookie, :key => 'rack.session',
                           :path => '/',
                           :secret => 'abacate_teste_mochila_projeto_aleatorio_segredo_muito_longo_e_seguro_123456789_extra'

# CONFIGURAÇÃO DE CONEXÕES
helpers do
  def db
    if session[:admin]
      # Conexão de ESCRITA
      @db_admin ||= Mongo::Client.new(['100.70.14.58:27017'], 
                        :database => 'projeto', 
                        :user => 'AdminApp_user', 
                        :password => 'Admin-app-projetobdii', 
                        :auth_source => 'projeto')
    else
      # Conexão de LEITURA
      @db_read ||= Mongo::Client.new(['100.70.14.58:27017'], 
                       :database => 'projeto', 
                       :user => 'app_user', 
                       :password => 'Projeto-APP-acesso', 
                       :auth_source => 'projeto')
    end
  end
  def registrar_log(tipo_acao, info_extra = "")
    begin
      db[:log].insert_one({
        usuario: session[:admin] ? "admin" : "visitante",
        ip: request.ip,
        metodo: request.request_method, # GET, POST, etc.
        caminho: request.path_info,     # /deletar, /login, etc.
        acao: tipo_acao,
        detalhes: info_extra,
        data_hora: Time.now.getlocal("-03:00").strftime("%d-%m-%Y/%H:%M:%S")
      })
    rescue => e
      puts "Erro ao salvar log: #{e.message}"
    end
  end
end

def db = Mongo::Client.new(['100.70.14.58:27017'], 
                       :database => 'projeto', 
                       :user => 'app_user', 
                       :password => 'Projeto-APP-acesso', 
                       :auth_source => 'projeto')

get '/' do
  erb :index
end

# Rota para obter a lista de alunos em formato JSON
get '/alunos' do
  content_type :json
  begin
    alunos = db[:alunos].find.to_a.map do |doc| 
  { 
    id: doc[:_id].to_s, 
    nome: doc[:nome],
    matricula: doc[:matricula], 
    turma: doc[:turma],
    disciplinas: doc[:disciplinas] || [],
  } 
end
    alunos.to_json
  rescue => e
    puts "Erro ao buscar alunos: #{e.message}"
    [].to_json
  end
end
#rota do listar por tudo 
get '/alunos/turma/:turma' do
  content_type :json

  begin
    turma = params[:turma]

    alunos = db[:alunos].find({ turma: turma }).to_a

    alunos.map! do |doc|
      {
        id: doc[:_id].to_s,
        nome: doc[:nome],
        matricula: doc[:matricula],
        turma: doc[:turma],
        disciplinas: doc[:disciplinas] || {}
      }
    end

    alunos.to_json

  rescue => e
    puts "Erro ao buscar por turma: #{e.message}"
    [].to_json
  end
end

#rota do cadastrar
post '/alunos' do
  content_type :json

  # 🔐 Bloqueia se não for admin
  unless session[:admin]
    registrar_log("TENTATIVA_NEGADA", "Tentou inserir aluno sem permissão")
    halt 403, { erro: "Acesso negado" }.to_json
  end

  begin
    # 📥 Lê o JSON enviado pelo fetch
    data = JSON.parse(request.body.read)

    # 🧪 Validação básica
    nome = data["nome"]&.strip
    matricula = data["matricula"]&.strip
    turma = data["turma"]&.strip
    disciplinas = data["disciplinas"] || {}

    if nome.nil? || nome.empty? || matricula.nil? || matricula.empty?
      halt 400, { erro: "Nome e matrícula são obrigatórios" }.to_json
    end

    # 💾 Inserção no banco
    result = db[:alunos].insert_one({
      nome: nome,
      matricula: matricula,
      turma: turma,
      disciplinas: disciplinas
    })

    # 📝 Log
    registrar_log("INSERCAO", "Aluno criado ID: #{result.inserted_id}")

    # 📤 Resposta
    status 201
    {
      mensagem: "Aluno criado com sucesso",
      id: result.inserted_id.to_s
    }.to_json

  rescue => e
    puts "Erro ao inserir aluno: #{e.message}"
    halt 500, { erro: "Erro interno no servidor" }.to_json
  end
end
#rota do deletar
delete '/alunos/:id' do
  content_type :json

  halt 403, { erro: "Acesso negado" }.to_json unless session[:admin]

  begin
    id = params[:id]

    result = db[:alunos].delete_one({ _id: BSON::ObjectId(id) })

    if result.deleted_count == 0
      halt 404, { erro: "Aluno não encontrado" }.to_json
    end

    { mensagem: "Aluno removido com sucesso" }.to_json

  rescue => e
    puts "Erro ao deletar: #{e.message}"
    halt 500, { erro: "Erro ao deletar aluno" }.to_json
  end
end
put '/alunos/:id/notas' do
  content_type :json

  halt 403, { erro: "Acesso negado" }.to_json unless session[:admin]

  begin
    id = params[:id]

    request.body.rewind
    data = JSON.parse(request.body.read)

    disciplinas = data["disciplinas"] || {}

    result = db[:alunos].update_one(
      { _id: BSON::ObjectId(id) },
      { "$set" => { disciplinas: disciplinas } }
    )

    if result.matched_count == 0
      halt 404, { erro: "Aluno não encontrado" }.to_json
    end

    { mensagem: "Notas atualizadas com sucesso" }.to_json

  rescue => e
    puts "Erro ao atualizar notas: #{e.message}"
    halt 500, { erro: "Erro ao atualizar notas" }.to_json
  end
end


# Rota do Login
post '/login' do
  user_doc = db[:users].find(username: params[:username]).first
  if user_doc && BCrypt::Password.new(user_doc[:password_hash]) == params[:password]
    session[:admin] = true
    registrar_log("LOGIN_SUCESSO", "Usuário #{params[:username]} logou")
    redirect '/'
  else
    session[:erro_login] = "Usuário ou senha inválidos"
    registrar_log("LOGIN_FALHA", "Tentativa falha com usuário: #{params[:username]} e senha: #{params[:password]}")
    redirect '/?login_error=1'
  end
end

get '/logout' do
  # Registra que o admin está saindo antes de apagar a sessão
  if session[:admin]
    registrar_log("LOGOUT", "O administrador encerrou a sessão")
  end
  session.clear
  redirect '/'
end


get '/turmas' do
  content_type :json
  begin
    turmas = db[:alunos].distinct(:turma).compact.sort
    turmas.to_json
  rescue => e
    puts "Erro ao buscar turmas: #{e.message}"
    [].to_json
  end
end
#  post '/inserir' do
#    if session[:admin]
#      result = db[:alunos].insert_one({ nome: params[:nome] })
#      # Registra a ação
#      registrar_log("INSERCAO", "Inseriu o aluno com id: #{result.inserted_id}")
#      redirect '/'
#    else
#      # registra tentativa falha
#      registrar_log("TENTATIVA_NEGADA", "Visitante tentou inserir aluno")
#      halt 403, "Acesso negado"
#    end
#  end



 
#  # Rota para deletar um aluno
#  get '/deletar/:id' do
#    if session[:admin]
#      # Registra antes de deletar para ter o ID no log
#      registrar_log("EXCLUSAO", "Deletou o aluno com ID: #{params[:id]}")
#      id_bson = BSON::ObjectId.from_string(params[:id])
#      db[:alunos].delete_one({ _id: id_bson })
#    else
#      registrar_log("TENTATIVA_NEGADA", "Visitante tentou deletar ID: #{params[:id]}")
#    end
#    redirect '/'
#  end