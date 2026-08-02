# Askio Frontend

6 files. See [flows.md](../flows.md) for how everything connects.

```
frontend/src/
  main.jsx        # entry
  App.jsx         # provider wrapper
  ChatApp.jsx     # entire UI
  chatState.jsx   # messages + send/stream
  api.js          # fetch + SSE
  utils.js        # helpers
```

```bash
cd frontend
npm install
npm run dev
```
