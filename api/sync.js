export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body) body = {};

    const { training = "", access_token } = body;

    if (!access_token) {
      return res.status(401).json({ error: "No hay token de Gmail. Debes conectar tu cuenta Google primero." });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    // Busca correos en Gmail directamente con el token de Google
    const query = encodeURIComponent(
      `after:${sevenDaysAgo.replace(/-/g,"//")} subject:(postulacion OR aplicacion OR entrevista OR "thank you for applying" OR "application received" OR "job offer" OR reclutamiento OR seleccion OR candidatura)`
    );

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!gmailRes.ok) {
      const err = await gmailRes.json();
      return res.status(401).json({ error: "Token de Gmail inválido o expirado. Reconecta tu cuenta.", detail: err });
    }

    const gmailData = await gmailRes.json();
    const messages = gmailData.messages || [];

    if (messages.length === 0) {
      return res.status(200).json({ postulaciones: [] });
    }

    // Obtiene el contenido de cada correo
    const emailContents = await Promise.all(
      messages.slice(0, 15).map(async (msg) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        const d = await r.json();
        const headers = d.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "";
        const from = headers.find(h => h.name === "From")?.value || "";
        const date = headers.find(h => h.name === "Date")?.value || "";
        return `De: ${from}\nFecha: ${date}\nAsunto: ${subject}`;
      })
    );

    // Envía los correos a Claude para análisis
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: `Eres un asistente que analiza correos para detectar postulaciones laborales.

INSTRUCCIONES PERSONALIZADAS:
${training}

Analiza los correos y extrae postulaciones. Para cada una responde ÚNICAMENTE con un JSON array (sin markdown, sin texto extra):
[{"empresa":"","cargo":"","estado":"Postulado|En proceso|Entrevista|Oferta|Rechazado","fecha":"YYYY-MM-DD","notas":"","plataforma":""}]
Si no hay postulaciones responde: []`,
        messages: [{
          role: "user",
          content: `Analiza estos correos y detecta postulaciones laborales:\n\n${emailContents.join("\n---\n")}`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || "Error en API Anthropic" });
    }

    const text = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    const match = text.match(/\[[\s\S]*\]/);
    const postulaciones = match ? JSON.parse(match[0]) : [];

    res.status(200).json({ postulaciones });

  } catch (err) {
    console.error("Handler error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
