# Deployment templates

- `nginx.nexcoregraph.conf.example`: HTTPS static hosting and `/api/*` reverse proxy.
- `nexcoregraph-backend.service.example`: systemd service for the Node backend.

These are templates. Replace domain names, users and paths before use. Do not put
the backend `.env` inside the web root. The public guide is:

`docs/Web端部署指南.md`
