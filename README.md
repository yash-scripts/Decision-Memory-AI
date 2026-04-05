# Decision Memory AI — Dark Theme

## Quick Start

### Terminal 1 — App
```
npm install
npm run dev
```
Open http://localhost:5174

### Terminal 2 — Ollama (keep open)
Mac/Linux:
```
OLLAMA_ORIGINS=* ollama serve
```
Windows (PowerShell):
```
$env:OLLAMA_ORIGINS="*"
ollama serve
```

### First time setup
```
ollama pull llama3.2
```

## Change model
Edit `src/App.jsx` line:
```js
const MODEL = "llama3.2";
```
