export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`https://ignaciomesaguerrero.github.io/Dashboard-Postulaciones/?auth=error`);
  }

  try {
    // Intercambia el código por un access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: "https://dashboard-postulaciones.vercel.app/api/auth/callback",
        grant_type: "authorization_code"
      })
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      return res.redirect(`https://ignaciomesaguerrero.github.io/Dashboard-Postulaciones/?auth=error`);
    }

    // Redirige al dashboard con el token en la URL
    // El token se guarda en localStorage del dashboard
    res.redirect(
      `https://ignaciomesaguerrero.github.io/Dashboard-Postulaciones/?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token || ""}`
    );

  } catch (err) {
    res.redirect(`https://ignaciomesaguerrero.github.io/Dashboard-Postulaciones/?auth=error`);
  }
}
