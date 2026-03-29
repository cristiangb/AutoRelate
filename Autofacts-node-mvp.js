// AutoFacts MVP - Node.js + Express + Wikipedia + Gemini
// -------------------------------------------------------
// Cambiado de OpenAI → Gemini (Google AI Studio)

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());

const RELATIONS = {
  platform: {
    label: 'comparte plataforma con',
    instruction:
      'Identifica con qué marca, grupo o modelo comparte plataforma principalmente. Si no hay una relación clara, dilo sin inventar.'
  },
  based_on: {
    label: 'está basado en',
    instruction:
      'Explica en qué plataforma, arquitectura, generación, chasis o base técnica se apoya el vehículo si corresponde. Si no aplica, dilo con claridad.'
  },
  engine: {
    label: 'qué motor usa',
    instruction:
      'Resume el motor o familia de motores más representativa.'
  },
  highlights: {
    label: 'dame highlights',
    instruction:
      'Devuelve highlights técnicos simples: chasis, diseño, motor y años.'
  }
};

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html><html><body>
  <h1>AutoFacts</h1>
  <input id="q" placeholder="Ej: Jeep Renegade" />
  <select id="r">
    <option value="platform">comparte plataforma con</option>
    <option value="based_on">está basado en</option>
    <option value="engine">motor</option>
    <option value="highlights">highlights</option>
  </select>
  <button onclick="ask()">Consultar</button>
  <pre id="out"></pre>

  <script>
  async function ask(){
    const query = document.getElementById('q').value;
    const relation = document.getElementById('r').value;
    const res = await fetch('/api/lookup', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({query, relation})
    });
    const data = await res.json();
    document.getElementById('out').textContent = JSON.stringify(data, null, 2);
  }
  </script>
  </body></html>`);
});

app.post('/api/lookup', async (req, res) => {
  try {
    const { query, relation } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta GEMINI_API_KEY' });
    }

    const wiki = await fetchWikipediaContext(query);

    const prompt = `
Consulta: ${query}
Tipo: ${RELATIONS[relation].label}
Instrucción: ${RELATIONS[relation].instruction}

Contexto:
${wiki.contextText}

Respondé en JSON:
{
 "answer": "...",
 "summary": "...",
 "highlights": ["...","..."]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const json = await response.json();

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { answer: text, summary: '', highlights: [] };
    }

    res.json({
      ...parsed,
      source: wiki.sourceUrl
    });

  } catch (e) {
    res.status(500).json({ error: 'Error general' });
  }
});

async function fetchWikipediaContext(query) {
  const search = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
  const json = await search.json();

  return {
    contextText: json.extract || '',
    sourceUrl: json.content_urls?.desktop?.page || ''
  };
}

app.listen(PORT, () => {
  console.log('Running on http://localhost:' + PORT);
});
