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

# Rota do Login
post '/login' do
  user_doc = db[:usuarios].find(username: params[:username]).first
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
# get '/logout' do
#   # Registra que o admin está saindo antes de apagar a sessão
#   if session[:admin]
#     registrar_log("LOGOUT", "O administrador encerrou a sessão")
#   end
#   session.clear
#   redirect '/'
# end
# post '/inserir' do
#   if session[:admin]
#     result = db[:alunos].insert_one({ nome: params[:nome] })
#     # Registra a ação
#     registrar_log("INSERCAO", "Inseriu o aluno com id: #{result.inserted_id}")
#     redirect '/'
#   else
#     # registra tentativa falha
#     registrar_log("TENTATIVA_NEGADA", "Visitante tentou inserir aluno")
#     halt 403, "Acesso negado"
#   end
# end
# # Rota para deletar um aluno
# get '/deletar/:id' do
#   if session[:admin]
#     # Registra antes de deletar para ter o ID no log
#     registrar_log("EXCLUSAO", "Deletou o aluno com ID: #{params[:id]}")
#     id_bson = BSON::ObjectId.from_string(params[:id])
#     db[:alunos].delete_one({ _id: id_bson })
#   else
#     registrar_log("TENTATIVA_NEGADA", "Visitante tentou deletar ID: #{params[:id]}")
#   end
#   redirect '/'
# end