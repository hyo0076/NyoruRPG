FROM node:22-alpine
WORKDIR /relay
COPY package.json server.cjs ai-proxy.cjs ai-context.cjs ai-upstream.cjs client.js ./
COPY web ./web
RUN mkdir data && chown node:node data
USER node
EXPOSE 18765
CMD ["node", "server.cjs", "--host", "0.0.0.0"]
