require 'sinatra'
require 'mongo'
require 'bcrypt'
require 'json'


set :bind, '0.0.0.0'
set :port, 4567
enable :sessions

use Rack::Session::Cookie, 
    :key => 'rack.session',
    :path => '/',
    :secret => 'abacate_teste_mochila_projeto_aleatorio_segredo_muito_longo_e_seguro_123456789_extra'

MONGO_OPTS = { auth_source: 'projeto', max_pool_size: 5, wait_queue_timeout: 5 }
DB_READ  = Mongo::Client.new(['100.70.14.58:27017'], MONGO_OPTS.merge(database: 'projeto', user: 'app_user', password: 'Projeto-APP-acesso'))
DB_ADMIN = Mongo::Client.new(['100.70.14.58:27017'], MONGO_OPTS.merge(database: 'projeto', user: 'AdminApp_user', password: 'Admin-app-projetobdii'))

helpers do
  def db
    session[:admin] ? DB_ADMIN : DB_READ
  end

  def registrar_log(tipo_acao, info_extra = "")
    db[:log].insert_one({
      usuario: session[:admin] ? "admin" : "visitante",
      ip: request.ip,
      metodo: request.request_method,
      caminho: request.path_info,
      acao: tipo_acao,
      detalhes: info_extra,
      data_hora: Time.now.getlocal("-03:00").strftime("%d-%m-%Y/%H:%M:%S")
    })
  rescue => e
    logger.error "Erro ao salvar log: #{e.message}"
  end

  def json_response(data, status_code = 200)
    status status_code
    data.to_json
  end
end

before do
  content_type :json
end

before '/alunos*' do
  if request.request_method != 'GET' && !session[:admin]
    registrar_log("TENTATIVA_NEGADA", "Acesso restrito")
    halt 403, { erro: "Acesso negado" }.to_json
  end
end

get '/' do
  content_type :html
  erb :index
end

get '/alunos' do
  pipeline = [
    { '$addFields' => { 'notas_array' => { '$objectToArray' => { '$ifNull' => ['$disciplinas', {}] } } } },
    { '$addFields' => { 
        'media' => { '$round' => [{ '$avg' => '$notas_array.v' }, 2] } 
    }},
    { '$project' => { 'notas_array' => 0 } }
  ]
  
  alunos = db[:alunos].aggregate(pipeline).map do |aluno|
    aluno['id'] = aluno['_id'].to_s
    aluno
  end
  alunos.to_json
end

post '/alunos' do
  data = JSON.parse(request.body.read) rescue {}
  
  if data["nome"].to_s.empty? || data["matricula"].to_s.empty?
    halt 400, { erro: "Nome e matrícula são obrigatórios" }.to_json
  end

  doc = {
    nome: data["nome"].strip,
    matricula: data["matricula"].strip,
    turma: data["turma"]&.strip,
    disciplinas: data["disciplinas"] || {}
  }

  result = db[:alunos].insert_one(doc)
  registrar_log("INSERCAO", "Aluno ID: #{result.inserted_id}")
  json_response({ mensagem: "Criado", id: result.inserted_id.to_s }, 201)
end

delete '/alunos/:id' do
  begin
    oid = BSON::ObjectId.from_string(params[:id])
    
    aluno = db[:alunos].find_one_and_delete({ _id: oid })
    
    if aluno
      aluno[:removido_em] = Time.now.getlocal("-03:00").strftime("%d-%m-%Y/%H:%M:%S")
      db[:alunos_removidos].insert_one(aluno)
      registrar_log("EXCLUSAO", "ID: #{params[:id]}")
      { mensagem: "Removido com sucesso" }.to_json
    else
      halt 404, { erro: "Aluno não encontrado" }.to_json
    end
  rescue BSON::ObjectId::Invalid
    halt 400, { erro: "ID inválido" }.to_json
  end
end

put '/alunos/:id' do
  data = JSON.parse(request.body.read) rescue {}
  halt 400, { erro: "Nome é obrigatório" }.to_json if data["nome"].to_s.empty?

  result = db[:alunos].update_one(
    { _id: BSON::ObjectId.from_string(params[:id]) },
    { "$set" => { nome: data["nome"].strip, turma: data["turma"]&.strip } }
  )

  result.matched_count > 0 ? { mensagem: "Atualizado" }.to_json : halt(404)
end

put '/alunos/:id/notas' do
  data = JSON.parse(request.body.read) rescue {}
  
  db[:alunos].update_one(
    { _id: BSON::ObjectId.from_string(params[:id]) },
    { "$set" => { disciplinas: data["disciplinas"] || {} } }
  )
  { mensagem: "Notas atualizadas" }.to_json
end

post '/login' do
  user_doc = db[:users].find(username: params[:username]).first
  
  if user_doc && BCrypt::Password.new(user_doc[:password_hash]) == params[:password]
    session[:admin] = true
    registrar_log("LOGIN_SUCESSO", "Usuário: #{params[:username]}")
    redirect '/'
  else
    registrar_log("LOGIN_FALHA", "Usuário: #{params[:username]}")
    redirect '/?login_error=1'
  end
end

get '/logout' do
  registrar_log("LOGOUT") if session[:admin]
  session.clear
  redirect '/'
end

get '/turmas' do
  db[:alunos].distinct(:turma).compact.sort.to_json
end