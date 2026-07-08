FROM node:20-slim

# Instala o ping do sistema, necessário para a biblioteca npm 'ping' funcionar no Linux
RUN apt-get update && apt-get install -y \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de definição de dependências
COPY package*.json ./

# Instala apenas as dependências de produção
RUN npm install --only=production

# Copia o código da aplicação (respeitando o .dockerignore)
COPY . .

# Expõe a porta que a aplicação escuta
EXPOSE 5100

# Variáveis de ambiente padrão
ENV PORT=5100
ENV NODE_ENV=production

# Comando para iniciar o servidor
CMD ["npm", "start"]
