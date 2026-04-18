# encoding: utf-8
Encoding.default_external = 'UTF-8'
Encoding.default_internal = 'UTF-8'

require 'sinatra'
require 'mongo'

set :bind, '0.0.0.0' # Isso libera o acesso pelo IP
set :port, 4567

# Tenta conectar ao MongoDB local
client = Mongo::Client.new(
  ['100.70.14.58:27017'], 
  :database => 'projeto',
  :user => 'dev_user',
  :password => 'Projeto-BDII',
  :auth_source => 'admin'
)
db = client.database

# Rota Principal - Mostra o formulário
get '/' do
  erb :index
end