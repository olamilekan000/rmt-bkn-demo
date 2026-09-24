# rumpty-demo-api

`GET /` health, `POST /items` create, `GET /items` list. Needs `DATABASE_URL`.

## Sample requests

Replace the host with your Rumpty URL.

```bash
# Health
curl https://YOUR-APP.rumptycloud.app/

# Create
curl -X POST https://YOUR-APP.rumptycloud.app/items \
  -H 'content-type: application/json' \
  -d '{"name":"hello from rumpty"}'

# List
curl https://YOUR-APP.rumptycloud.app/items
```

Local:

```bash
curl http://127.0.0.1:8000/
curl -X POST http://127.0.0.1:8000/items \
  -H 'content-type: application/json' \
  -d '{"name":"hello from rumpty"}'
curl http://127.0.0.1:8000/items
```
