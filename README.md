# Graph Lab

Interactive experiment workflow visualization platform.

## Docker deployment

The Docker deployment runs two containers:

- `api`: the Express API service
- `web`: nginx serving the built frontend and proxying `/api` to the API container

The deployment does not include PostgreSQL. It reads `DATABASE_URL` from [docker/graph-lab.env](docker/graph-lab.env) and connects to the external database directly.

### Deploy on a Linux server

```sh
sh docker/deploy-server.sh
```

### Deploy on Windows locally

```bat
docker\deploy-local.cmd
```

### Deploy on Windows locally through host proxy `127.0.0.1:10808`

```bat
docker\deploy-local-proxy.cmd
```

This script sets proxy environment variables for `docker compose` and also passes `host.docker.internal:10808` into the image build stages for package downloads inside the containers.

After startup, open `http://localhost:4173`.
