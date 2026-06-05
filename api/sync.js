export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    // Parsear body manualmente si llega como string
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body) body = {};

    const training = body.training || "";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        system: `Eres un asistente que analiza correos de Gmail para detectar postulaciones laborales.
Busca correos desde ${sevenDaysAgo} hasta hoy (últimos 7 días).
Busca términos: postulación, aplicación, candidatura, entrevista, proceso de selección, oferta laboral, thank you for applying, application received, interview, job offer, hiring, recruitment, selección, reclutamiento.
Recupera hasta 20 correos relevantes.

INSTRUCCIONES PERSONALIZADAS:
${training}

Responde ÚNICAMENTE con un JSON array (sin markdown, sin texto extra):
[{"empresa":"","cargo":"","estado":"Postulado|En proceso|Entrevista|Oferta|Rechazado","fecha":"YYYY-MM-DD","notas":"","plataforma":""}]
Si no hay postulaciones responde: []`,
        messages: [{ role: "user", content: "Busca y analiza mis correos de postulaciones de los últimos 7 días y devuelve el JSON." }],
        mcp_servers: [{ type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail-mcp" }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || "Error en API Anthropic", detail: data });
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
