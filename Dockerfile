# 1. Base
FROM node:22-alpine

# 2. Directorio de trabajo
WORKDIR /app

# 3. Copiar archivos
COPY package*.json ./
RUN npm install

# 4. Copiar resto
COPY . .

# 5. Exponer puerto y run
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
