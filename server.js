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
      'Devuelve highlights técnicos simples: chasis o plataforma, diseño distintivo, motor y años o generación.'
  }
};

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AutoFacts</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f6f6f6; color: #111; }
    h1 { margin-bottom: 20px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
    input, select, button { font-size: 16px; padding: 10px 12px; }
    input { min-width: 280px; }
    button { cursor: pointer; }
    .card { background: white; border: 1px solid #ddd; border-radius: 10px; padding: 16px; max-width: 900px; }
    .answer { font-size: 28px; font-weight: bold; margin-bottom: 12px; }
    .summary { line-height: 1.5; margin-bottom: 12px; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .chip { background: #eef3ff; border: 1px solid #c9d8ff; border-radius: 999px; padding: 6px 10px; font-size: 14px; }
    .source { font-size: 14px; color: #555; }
    .error { color: #b00020; margin-top: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>AutoFacts</h1>

  <div class="row">
    <input id="q" placeholder="Ej: Jeep Renegade, Audi A3, Nissan Skyline R34" />
    <select id="r">
      <option value="platform">comparte plataforma con</option>
      <option value="based_on">está basado en</option>
      <option value="engine">motor</option>
      <option value="highlights">highlights</option>
    </select>
    <button id="btn" onclick="ask()">Consultar</button>
  </div>

  <div class="card">
    <div id="title"></div>
    <div id="answer" class="answer">Todavía no hay consulta.</div>
    <div id="summary" class="summary">Probá con una marca o modelo.</div>
    <div id="chips" class="chips"></div>
    <div id="source" class="source"></div>
    <div id="error" class="error"></div>
  </div>

  <script>
    async function ask() {
      const query = document.getElementById('q').value.trim();
      const relation = document.getElementById('r').value;
      const btn = document.getElementById('btn');
      const answerEl = document.getElementById('answer');
      const summaryEl = document.getElementById('summary');
      const chipsEl = document.getElementById('chips');
      const sourceEl = document.getElementById('source');
      const errorEl = document.getElementById('error');
      const titleEl = document.getElementById('title');

      errorEl.textContent = '';
      chipsEl.innerHTML = '';

      if (!query) {
        errorEl.textContent = 'Poné una marca o modelo.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Consultando...';
      answerEl.textContent = 'Buscando...';
      summaryEl.textContent = '';
      sourceEl.textContent = '';
      titleEl.textContent = '';

      try {
        const res = await fetch('/api/lookup', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ query, relation })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error + (data.detail ? '\n\n' + JSON.stringify(data.detail, null, 2) : ''));
        }

        titleEl.textContent = query + ' · ' + relation;
        answerEl.textContent = data.answer || 'Sin respuesta clara';
        summaryEl.textContent = data.summary || '';

        chipsEl.innerHTML = '';
        (data.highlights || []).forEach(item => {
          const chip = document.createElement('div');
          chip.className = 'chip';
          chip.textContent = item;
          chipsEl.appendChild(chip);
        });

        sourceEl.innerHTML = data.source
          ? 'Fuente: <a href="' + data.source + '" target="_blank" rel="noopener noreferrer">' + data.source + '</a>'
          : '';

      } catch (err) {
        answerEl.textContent = 'No se pudo resolver';
        summaryEl.textContent = '';
        errorEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Consultar';
      }
    }
  </script>
</body>
</html>`);
});

app.post('/api/lookup', async (req, res) => {
  try {
    const query = String(req.body.query || '').trim();
    const relation = String(req.body.relation || '').trim();

    if (!query) {
      return res.status(400).json({ error: 'Falta la marca o modelo.' });
    }

    if (!RELATIONS[relation]) {
      return res.status(400).json({ error: 'Tipo de consulta inválido.' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta GEMINI_API_KEY.' });
    }

    const wiki = await fetchWikipediaContext(query);

    if (!wiki.contextText) {
      return res.status(404).json({ error: 'No encontré contexto suficiente en Wikipedia para esa búsqueda.' });
    }

    const prompt = `
Consulta del usuario: ${query}
Tipo de consulta: ${RELATIONS[relation].label}
Instrucción específica: ${RELATIONS[relation].instruction}

Contexto base:
${wiki.contextText}

Reglas:
- Respondé en español.
- No inventes datos.
- Si el contexto no alcanza, decilo explícitamente.
- La respuesta debe ser breve y clara.
- Devolvé SOLO JSON válido.
- Formato exacto:
{
  "answer": "respuesta principal corta",
  "summary": "resumen corto en 2 o 3 líneas",
  "highlights": ["dato 1", "dato 2", "dato 3"]
}
`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                answer: { type: 'STRING' },
                summary: { type: 'STRING' },
                highlights: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                }
              },
              required: ['answer', 'summary', 'highlights']
            }
          }
        })
      }
    );

    const json = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Error de Gemini', detail: json });
    }

    if (!json.candidates || !json.candidates.length) {
      return res.status(500).json({ error: 'Gemini no devolvió candidatos.', detail: json });
    }

    const text = json.candidates[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        answer: 'No pude estructurar la respuesta',
        summary: text,
        highlights: []
      };
    }

    return res.json({
      answer: parsed.answer || 'Sin respuesta clara',
      summary: parsed.summary || '',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      source: wiki.sourceUrl
    });
  } catch (e) {
    return res.status(500).json({ error: 'Error general', detail: e.message });
  }
});

async function fetchWikipediaContext(query) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`;
  const searchResponse = await fetch(searchUrl);

  if (!searchResponse.ok) {
    throw new Error('Falló la búsqueda en Wikipedia.');
  }

  const searchJson = await searchResponse.json();
  const first = searchJson?.query?.search?.[0];

  if (!first?.title) {
    return { contextText: '', sourceUrl: '' };
  }

  const title = first.title;
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const summaryResponse = await fetch(summaryUrl);

  if (!summaryResponse.ok) {
    throw new Error('Falló el resumen de Wikipedia.');
  }

  const summaryJson = await summaryResponse.json();

  return {
    contextText: `Título: ${title}\nDescripción: ${summaryJson.description || ''}\nResumen: ${summaryJson.extract || ''}`,
    sourceUrl: summaryJson.content_urls?.desktop?.page || ''
  };
}

app.listen(PORT, () => {
  console.log('Running on http://localhost:' + PORT);
});
