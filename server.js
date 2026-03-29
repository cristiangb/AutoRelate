const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());

const RELATIONS = {
  platform: {
    label: 'comparte plataforma con',
    instruction: 'Identifica con qué marca o grupo comparte plataforma.'
  },
  based_on: {
    label: 'está basado en',
    instruction: 'Explica en qué plataforma o arquitectura se basa.'
  },
  engine: {
    label: 'motor',
    instruction: 'Resume el motor principal o familia de motores.'
  },
  highlights: {
    label: 'highlights',
    instruction: 'Devuelve highlights técnicos simples.'
  }
};

app.get('/', (_req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AutoFacts</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      background: #f6f6f6;
      color: #111;
    }
    h1 {
      margin-bottom: 20px;
    }
    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    input, select, button {
      font-size: 16px;
      padding: 10px 12px;
    }
    input {
      min-width: 260px;
    }
    button {
      cursor: pointer;
    }
    .card {
      background: white;
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 16px;
      max-width: 900px;
    }
    .answer {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 12px;
    }
    .summary {
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .chip {
      background: #eef3ff;
      border: 1px solid #c9d8ff;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 14px;
    }
    .source {
      font-size: 14px;
      color: #555;
      margin-top: 10px;
    }
    .error {
      color: #b00020;
      margin-top: 10px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>AutoFacts</h1>

  <div class="row">
    <input id="q" placeholder="Ej: Audi A3, Jeep Renegade, Skyline R34" />
    <select id="r">
      <option value="platform">comparte plataforma con</option>
      <option value="based_on">está basado en</option>
      <option value="engine">motor</option>
      <option value="highlights">highlights</option>
    </select>
    <button id="btn" type="button">Consultar</button>
  </div>

  <div class="card">
    <div id="answer" class="answer">Todavía no hay consulta.</div>
    <div id="summary" class="summary">Probá con una marca o modelo.</div>
    <div id="chips" class="chips"></div>
    <div id="source" class="source"></div>
    <div id="error" class="error"></div>
  </div>

  <script>
    const qEl = document.getElementById('q');
    const rEl = document.getElementById('r');
    const btn = document.getElementById('btn');
    const answerEl = document.getElementById('answer');
    const summaryEl = document.getElementById('summary');
    const chipsEl = document.getElementById('chips');
    const sourceEl = document.getElementById('source');
    const errorEl = document.getElementById('error');

    async function ask() {
      const query = qEl.value.trim();
      const relation = rEl.value;

      errorEl.textContent = '';
      chipsEl.innerHTML = '';
      sourceEl.innerHTML = '';

      if (!query) {
        errorEl.textContent = 'Poné una marca o modelo.';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Consultando...';
      answerEl.textContent = 'Buscando...';
      summaryEl.textContent = '';

      try {
        const res = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, relation })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Error desconocido');
        }

        answerEl.textContent = data.answer || 'Sin respuesta clara';
        summaryEl.textContent = data.summary || '';

        chipsEl.innerHTML = '';
        (data.highlights || []).forEach(function(item) {
          const chip = document.createElement('div');
          chip.className = 'chip';
          chip.textContent = item;
          chipsEl.appendChild(chip);
        });

        if (data.source) {
          sourceEl.innerHTML =
            'Fuente: <a href="' + data.source + '" target="_blank" rel="noopener noreferrer">' +
            data.source +
            '</a>';
        }
      } catch (err) {
        answerEl.textContent = 'No se pudo resolver';
        summaryEl.textContent = '';
        errorEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Consultar';
      }
    }

    btn.addEventListener('click', ask);
    qEl.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        ask();
      }
    });
  </script>
</body>
</html>
  `;
  res.send(html);
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

    const wikiText = await fetchWiki(query);

    if (!wikiText) {
      return res.status(404).json({ error: 'No encontré contexto suficiente en Wikipedia.' });
    }

    const prompt =
      'Consulta: ' + query + '\n' +
      'Tipo: ' + RELATIONS[relation].label + '\n' +
      'Instrucción: ' + RELATIONS[relation].instruction + '\n\n' +
      'Contexto:\n' + wikiText + '\n\n' +
      'Respondé SOLO en JSON válido con esta forma exacta:\n' +
      '{\n' +
      '  "answer": "respuesta corta",\n' +
      '  "summary": "resumen breve en 2 o 3 líneas",\n' +
      '  "highlights": ["dato 1", "dato 2", "dato 3"]\n' +
      '}\n' +
      'No inventes datos. Si no alcanza la fuente, decilo igual dentro de ese formato.';

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    const json = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: 'Error de Gemini',
        detail: json
      });
    }

    const text =
      json &&
      json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text
        ? json.candidates[0].content.parts[0].text
        : '{}';

let parsed;
try {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  parsed = JSON.parse(cleaned);
} catch (_err) {
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
      source: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(query.replace(/ /g, '_'))
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Error general',
      detail: err.message
    });
  }
});

async function fetchWiki(query) {
  const url =
    'https://en.wikipedia.org/api/rest_v1/page/summary/' +
    encodeURIComponent(query);

  const response = await fetch(url);

  if (!response.ok) {
    return '';
  }

  const json = await response.json();
  return json.extract || '';
}

app.listen(PORT, () => {
  console.log('Running on port ' + PORT);
});
