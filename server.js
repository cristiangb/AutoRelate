const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());

const RELATIONS = {
  platform: {
    label: 'comparte plataforma con',
    instruction:
      'Identifica con qué marca o grupo comparte plataforma.'
  },
  based_on: {
    label: 'está basado en',
    instruction:
      'Explica en qué plataforma o arquitectura se basa.'
  },
  engine: {
    label: 'motor',
    instruction:
      'Resume el motor principal.'
  },
  highlights: {
    label: 'highlights',
    instruction:
      'Devuelve highlights técnicos simples.'
  }
};

app.get('/', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>AutoFacts</title>
</head>
<body style="font-family: Arial; padding: 30px;">

<h1>AutoFacts</h1>

<input id="q" placeholder="Ej: Audi A3" style="padding:8px; width:250px;" />
<select id="r">
  <option value="platform">comparte plataforma con</option>
  <option value="based_on">está basado en</option>
  <option value="engine">motor</option>
  <option value="highlights">highlights</option>
</select>
<button id="btn">Consultar</button>

<pre id="out"></pre>

<script>
const btn = document.getElementById('btn');

btn.addEventListener('click', async () => {
  const query = document.getElementById('q').value;
  const relation = document.getElementById('r').value;

  const res = await fetch('/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, relation })
  });

  const data = await res.json();

  document.getElementById('out').textContent = JSON.stringify(data, null, 2);
});
</script>

</body>
</html>
`);
});

app.post('/api/lookup', async (req, res) => {
  try {
    const { query, relation } = req.body;

    if (!GEMINI_API_KEY) {
      return res.json({ error: 'Falta API key' });
    }

    const wiki = await fetchWiki(query);

    const prompt = \`
Consulta: \${query}
Tipo: \${RELATIONS[relation].label}
Instrucción: \${RELATIONS[relation].instruction}

Contexto:
\${wiki}

Respondé en JSON:
{
 "answer": "...",
 "summary": "...",
 "highlights": ["...","..."]
}
\`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const json = await response.json();

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    res.json({
      ...parsed,
      source: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(query)
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});

async function fetchWiki(query) {
  const res = await fetch(
    \`https://en.wikipedia.org/api/rest_v1/page/summary/\${encodeURIComponent(query)}\`
  );
  const json = await res.json();
  return json.extract || '';
}

app.listen(PORT, () => {
  console.log('Running on port ' + PORT);
});
