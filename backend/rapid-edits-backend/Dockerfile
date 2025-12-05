FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client (will fail if schema doesn't exist, but COPY . . brings it in)
# We might need to run this at runtime if we mount volumes, but for build it's good.
# However, for dev with volumes, we usually run it in CMD or entrypoint.
# For now, let's keep it simple.

EXPOSE 4000

CMD ["npm", "run", "start:dev"]
