const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(express.json());

const RELATIONS = {
  platform: {
    label: 'comparte plataforma con',
    instruction: 'Indica la plataforma del vehículo y con qué marcas o modelos la comparte. Priorizá el nombre concreto de la plataforma si existe.'
  },
  based_on: {
    label: 'está basado en',
    instruction: 'Indica la plataforma o arquitectura técnica específica del vehículo. Priorizá nombres concretos de plataforma o arquitectura. No respondas con relaciones indirectas, históricas o vagas si no contestan la pregunta.'
  },
  engine: {
    label: 'motor',
    instruction: 'Resume el motor o familia de motores más representativa del vehículo consultado. Si hay varias motorizaciones importantes, mencioná las principales de forma breve y concreta.'
  },
  highlights: {
    label: 'highlights',
    instruction: 'Devuelve highlights técnicos concretos y breves: plataforma o chasis, layout o tracción, motor y rasgo distintivo de diseño o generación.'
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
    :root {
      --bg: #0a0d12;
      --bg-2: #0f141c;
      --card: rgba(19, 24, 33, 0.92);
      --line: rgba(255, 255, 255, 0.08);
      --text: #edf2f7;
      --muted: #99a4b3;
      --accent: #9fc3ff;
      --accent-2: #5e8fff;
      --chip-bg: rgba(159, 195, 255, 0.10);
      --chip-line: rgba(159, 195, 255, 0.22);
      --shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
      --radius: 20px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(94, 143, 255, 0.18), transparent 26%),
        radial-gradient(circle at top right, rgba(255, 255, 255, 0.05), transparent 20%),
        linear-gradient(180deg, #090c11 0%, #0c1017 40%, #0a0d12 100%);
      padding: 20px 14px 36px;
    }

    .shell {
      width: 100%;
      max-width: 920px;
      margin: 0 auto;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }

    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05));
      border: 1px solid rgba(255,255,255,0.10);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.10);
      font-size: 18px;
    }

    .brand h1 {
      margin: 0;
      font-size: clamp(34px, 7vw, 56px);
      line-height: 0.95;
      letter-spacing: -0.04em;
      font-weight: 800;
    }

    .brand p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 14px;
    }

    .panel {
      background: linear-gradient(180deg, rgba(18,23,31,0.96), rgba(14,19,27,0.96));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 14px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      margin-bottom: 16px;
    }

    .controls {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.10em;
      padding-left: 2px;
    }

    .input,
    .select,
    .button {
      width: 100%;
      border-radius: 16px;
      border: 1px solid var(--line);
      min-height: 58px;
      font-size: 18px;
    }

    .input,
    .select {
      background: rgba(255,255,255,0.03);
      color: var(--text);
      padding: 0 18px;
      outline: none;
      transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;
    }

    .input::placeholder {
      color: #7e8896;
    }

    .input:focus,
    .select:focus {
      border-color: rgba(159, 195, 255, 0.42);
      background: rgba(255,255,255,0.045);
      transform: translateY(-1px);
    }

    .button {
      border: none;
      color: #06111f;
      font-weight: 800;
      letter-spacing: 0.01em;
      background: linear-gradient(180deg, #d9e7ff 0%, #8fb7ff 48%, #6b9cff 100%);
      box-shadow: 0 10px 24px rgba(94, 143, 255, 0.28);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: transform 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
    }

    .button:hover {
      transform: translateY(-1px);
      filter: brightness(1.02);
    }

    .button:disabled {
      cursor: wait;
      opacity: 0.92;
    }

    .ring {
      width: 20px;
      height: 20px;
      border-radius: 999px;
      border: 2px solid rgba(6, 17, 31, 0.22);
      border-top-color: rgba(6, 17, 31, 0.88);
      animation: spin 0.7s linear infinite;
      display: none;
    }

    .button.loading .ring {
      display: inline-block;
    }

    .button.loading .button-text::after {
      content: '...';
    }

    .result {
      background: linear-gradient(180deg, rgba(16,21,29,0.98), rgba(12,17,24,0.98));
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 18px 16px 20px;
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }

    .result::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(159,195,255,0.85), transparent);
      opacity: 0.9;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 14px;
    }

    .eyebrow-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #7db0ff;
      box-shadow: 0 0 16px rgba(125,176,255,0.8);
    }

    .answer {
      font-size: clamp(27px, 7vw, 38px);
      line-height: 1.04;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin: 0 0 14px;
      text-wrap: balance;
    }

    .summary {
      color: #d5dce6;
      font-size: clamp(17px, 3.8vw, 20px);
      line-height: 1.62;
      margin-bottom: 16px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      background: var(--chip-bg);
      border: 1px solid var(--chip-line);
      color: #e9f0ff;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.2;
    }

    .chip::before {
      content: '◦';
      color: #9fc3ff;
      font-size: 16px;
      line-height: 1;
    }

    .source {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .source a {
      color: var(--accent);
    }

    .error {
      color: #ff9d9d;
      font-size: 14px;
      margin-top: 12px;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (min-width: 760px) {
      body {
        padding: 34px 22px 50px;
      }

      .panel {
        padding: 16px;
      }

      .controls {
        grid-template-columns: 1.35fr 1fr auto;
        align-items: end;
      }

      .button {
        min-width: 200px;
        padding: 0 22px;
      }

      .result {
        padding: 24px 24px 24px;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="brand">
      <div class="brand-mark">✦</div>
      <div>
        <h1>AutoFacts</h1>
        <p>Relaciones técnicas entre autos, con foco en plataforma, arquitectura y motorización.</p>
      </div>
    </div>

    <section class="panel">
      <div class="controls">
        <div class="field">
          <label for="q">Modelo o marca</label>
          <input id="q" class="input" placeholder="Ej: Audi A3, Jeep Renegade, Nissan Skyline R34" />
        </div>

        <div class="field">
          <label for="r">Consulta</label>
          <select id="r" class="select">
            <option value="platform">comparte plataforma con</option>
            <option value="based_on">está basado en</option>
            <option value="engine">motor</option>
            <option value="highlights">highlights</option>
          </select>
        </div>

        <div class="field">
          <label>&nbsp;</label>
          <button id="btn" type="button" class="button">
            <span class="ring" aria-hidden="true"></span>
            <span class="button-text">Consultar</span>
          </button>
        </div>
      </div>
    </section>

    <section class="result">
      <div class="eyebrow"><span class="eyebrow-dot"></span><span>Consulta automotriz</span></div>
      <div id="answer" class="answer">Listo para consultar</div>
      <div id="summary" class="summary">Elegí un modelo, hacé una pregunta y te devuelvo una respuesta breve con highlights.</div>
      <div id="chips" class="chips"></div>
      <div id="source" class="source"></div>
      <div id="error" class="error"></div>
    </section>
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
      btn.classList.add('loading');
      answerEl.textContent = 'Consultando…';
      summaryEl.textContent = 'Buscando contexto y armando respuesta…';

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
          sourceEl.innerHTML = 'Fuente: <a href="' + data.source + '" target="_blank" rel="noopener noreferrer">' + data.source + '</a>';
        }
      } catch (err) {
        answerEl.textContent = 'No se pudo resolver';
        summaryEl.textContent = 'La consulta falló antes de devolver una respuesta válida.';
        errorEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
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
      'Sos un asistente experto en autos. Respondés en español claro, corto y preciso.\n' +
      'Tenés que responder únicamente con información respaldada por el contexto provisto.\n' +
      'Si no hay dato suficiente, lo decís explícitamente sin rellenar.\n' +
      'Priorizá nombres concretos de plataformas, arquitecturas, layouts y familias de motores cuando existan.\n' +
      'Evitá respuestas vagas, históricas o indirectas si no contestan exactamente lo preguntado.\n\n' +
      'Consulta: ' + query + '\n' +
      'Tipo: ' + RELATIONS[relation].label + '\n' +
      'Instrucción específica: ' + RELATIONS[relation].instruction + '\n\n' +
      'Contexto:\n' + wikiText + '\n\n' +
      'Reglas de salida:\n' +
      '- Respondé SOLO en JSON válido.\n' +
      '- answer: una frase corta y concreta.\n' +
      '- summary: 2 o 3 líneas claras, sin repetir literal el answer.\n' +
      '- highlights: 2 a 4 puntos concretos y útiles.\n' +
      '- Si existe un nombre específico de plataforma o arquitectura (ej: MQB, FCA Small Wide, CMF, etc.), priorizalo.\n' +
      '- Si la pregunta es sobre motor, priorizá familias o códigos de motor relevantes.\n' +
      '- Si la pregunta es sobre “está basado en”, no respondas con relaciones genéricas; apuntá a la base técnica o decí que no está claro.\n\n' +
      '{\n' +
      '  "answer": "respuesta corta",\n' +
      '  "summary": "resumen breve",\n' +
      '  "highlights": ["dato 1", "dato 2", "dato 3"]\n' +
      '}';

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
  const searchUrl =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(query) +
    '&utf8=1&format=json&origin=*';

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) return '';

  const searchJson = await searchResponse.json();
  const first = searchJson?.query?.search?.[0];
  if (!first?.title) return '';

  const title = first.title;

  const extractUrl =
    'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=0&explaintext=1&titles=' +
    encodeURIComponent(title) +
    '&format=json&origin=*';

  const extractResponse = await fetch(extractUrl);
  if (!extractResponse.ok) return '';

  const extractJson = await extractResponse.json();
  const pages = extractJson?.query?.pages || {};
  const page = Object.values(pages)[0];
  const extract = page?.extract || '';

  const parseUrl =
    'https://en.wikipedia.org/w/api.php?action=parse&page=' +
    encodeURIComponent(title) +
    '&prop=text&formatversion=2&format=json&origin=*';

  const parseResponse = await fetch(parseUrl);
  let html = '';
  if (parseResponse.ok) {
    const parseJson = await parseResponse.json();
    html = parseJson?.parse?.text || '';
  }

  const infoboxText = extractInfoboxText(html);
  const trimmedExtract = extract.slice(0, 6000);
  const trimmedInfobox = infoboxText.slice(0, 2200);

  return [
    'Título: ' + title,
    trimmedInfobox ? 'Infobox:\n' + trimmedInfobox : '',
    trimmedExtract ? 'Contenido:\n' + trimmedExtract : ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

function extractInfoboxText(html) {
  if (!html) return '';

  const wantedLabels = [
    'Engine',
    'Engines',
    'Powertrain',
    'Transmission',
    'Layout',
    'Platform',
    'Related',
    'Body style',
    'Production',
    'Model code',
    'Chassis'
  ];

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const thMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const tdMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);

    if (!thMatch || !tdMatch) continue;

    const rawLabel = stripHtml(thMatch[1]).trim();
    const rawValue = stripHtml(tdMatch[1]).trim();

    if (!rawLabel || !rawValue) continue;

    const normalized = rawLabel.toLowerCase();
    const isWanted = wantedLabels.some(function(label) {
      return normalized === label.toLowerCase();
    });

    if (isWanted) {
      rows.push(rawLabel + ': ' + rawValue);
    }
  }

  return rows.join('\n');
}

function stripHtml(text) {
  return text
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

app.listen(PORT, () => {
  console.log('Running on port ' + PORT);
});
