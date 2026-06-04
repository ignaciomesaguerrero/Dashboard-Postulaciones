import { useState, useEffect, useRef } from "react";

const ESTADOS = ["Postulado", "En proceso", "Entrevista", "Oferta", "Rechazado"];
const ESTADO_COLORS = {
  "Postulado":  { bg: "#1e3a5f", text: "#60a5fa", border: "#2563eb" },
  "En proceso": { bg: "#1e3a2f", text: "#34d399", border: "#059669" },
  "Entrevista": { bg: "#3b2a1a", text: "#fbbf24", border: "#d97706" },
  "Oferta":     { bg: "#1a2e1a", text: "#4ade80", border: "#16a34a" },
  "Rechazado":  { bg: "#2d1a1a", text: "#f87171", border: "#dc2626" },
};
const EMPTY_FORM = { empresa: "", cargo: "", fecha: "", estado: "Postulado", plataforma: "", contacto: "", link: "", notas: "" };

const DEFAULT_TRAINING = `# Instrucciones de reconocimiento de postulaciones

Detecta correos relacionados con búsqueda de empleo. Ejemplos de patrones:

## Confirmación de recepción → estado: "Postulado"
- "Gracias por postular", "Hemos recibido tu solicitud", "Application received", "Thank you for applying"

## En proceso → estado: "En proceso"  
- "Estamos revisando tu perfil", "Tu candidatura está en evaluación", "We are reviewing your application"

## Entrevista → estado: "Entrevista"
- "Te invitamos a una entrevista", "Queremos conocerte", "We'd like to schedule an interview", "Interview invitation"

## Oferta → estado: "Oferta"
- "Nos complace ofrecerte", "Job offer", "We'd like to offer you the position"

## Rechazado → estado: "Rechazado"
- "No continuaremos con tu candidatura", "We've decided to move forward with other candidates", "No has sido seleccionado"

## Extracción de campos
- empresa: nombre de la empresa remitente o mencionada en el correo
- cargo: posición o rol mencionado
- fecha: fecha del correo en formato YYYY-MM-DD
- plataforma: LinkedIn, Portal Empleo, trabajando.com, etc. si se menciona
- notas: resumen breve del correo en 1 línea`;

const SK = "postulaciones_v1";
const TK = "gmail_training_v1";

function load(key, def) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem("auth") === "ok");
  const [pwd, setPwd] = useState("");
  const [pwdErr, setPwdErr] = useState(false);
  const [posts, setPosts] = useState(() => load(SK, []));
  const [filtro, setFiltro] = useState("Todos");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [importOk, setImportOk] = useState("");
  const [search, setSearch] = useState("");
  const [training, setTraining] = useState(() => load(TK, DEFAULT_TRAINING));
  const [trainingSaved, setTrainingSaved] = useState(false);
  const [gmailStatus, setGmailStatus] = useState("idle");
  const [gmailLog, setGmailLog] = useState([]);
  const [gmailSummary, setGmailSummary] = useState(null);
  const nextId = useRef(Date.now());

  useEffect(() => { save(SK, posts); }, [posts]);

  function handleLogin() {
    if (pwd === "Anto_2026") { sessionStorage.setItem("auth","ok"); setAuth(true); }
    else { setPwdErr(true); setTimeout(()=>setPwdErr(false), 1500); }
  }

  if (!auth) return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#0f0f1a", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#13131f", border:"1px solid #2d2d4e", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:360, textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:12 }}>🎯</div>
        <h1 style={{ margin:"0 0 4px", fontSize:20, fontWeight:700, color:"#a78bfa" }}>Mis Postulaciones</h1>
        <p style={{ margin:"0 0 28px", fontSize:13, color:"#475569" }}>Acceso privado</p>
        <input
          type="password"
          placeholder="Contraseña"
          value={pwd}
          onChange={e=>setPwd(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleLogin()}
          style={{ width:"100%", boxSizing:"border-box", background:"#1a1a2e", border:`1px solid ${pwdErr?"#dc2626":"#2d2d4e"}`, borderRadius:10, padding:"11px 14px", color:"#e2e8f0", fontSize:14, outline:"none", marginBottom:12, textAlign:"center", letterSpacing:2, transition:"border-color .2s" }}
          autoFocus
        />
        {pwdErr && <div style={{ color:"#f87171", fontSize:12, marginBottom:10 }}>Contraseña incorrecta</div>}
        <button onClick={handleLogin} style={{ width:"100%", background:"#6366f1", border:"none", color:"white", padding:"11px", borderRadius:10, cursor:"pointer", fontSize:14, fontWeight:600 }}>
          Entrar
        </button>
      </div>
    </div>
  );

  const stats = {
    total: posts.length,
    activas: posts.filter(p => !["Rechazado","Oferta"].includes(p.estado)).length,
    entrevistas: posts.filter(p => p.estado === "Entrevista").length,
    ofertas: posts.filter(p => p.estado === "Oferta").length,
    rechazados: posts.filter(p => p.estado === "Rechazado").length,
  };

  const filtered = posts.filter(p => {
    const mf = filtro === "Todos" || p.estado === filtro;
    const ms = !search || [p.empresa, p.cargo, p.plataforma].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return mf && ms;
  }).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setModal("add"); }
  function openEdit(p) { setForm({...p}); setEditId(p.id); setModal("edit"); }
  function closeModal() { setModal(null); setImportText(""); setImportErr(""); setImportOk(""); }

  function saveForm() {
    if (!form.empresa || !form.cargo) return;
    if (editId !== null) setPosts(prev => prev.map(p => p.id === editId ? {...form, id: editId} : p));
    else setPosts(prev => [...prev, {...form, id: nextId.current++}]);
    closeModal();
  }

  function deletePost(id) {
    if (confirm("¿Eliminar esta postulación?")) setPosts(prev => prev.filter(p => p.id !== id));
  }

  function mergePostulaciones(arr) {
    let added = 0, updated = 0;
    setPosts(prev => {
      const list = [...prev];
      for (const item of arr) {
        const emp = item.empresa || item.company || item.Company || "";
        const car = item.cargo || item.position || item.role || item.Position || "";
        const est = item.estado || item.status || item.Status || "Postulado";
        const fec = item.fecha || item.date || item.Date || new Date().toISOString().split("T")[0];
        const plt = item.plataforma || item.platform || "";
        const con = item.contacto || item.contact || "";
        const lnk = item.link || item.url || "";
        const not = item.notas || item.notes || "";
        const estN = ESTADOS.find(e => e.toLowerCase() === est.toLowerCase()) || "Postulado";
        const idx = list.findIndex(p => p.empresa.toLowerCase()===emp.toLowerCase() && p.cargo.toLowerCase()===car.toLowerCase());
        if (idx >= 0) { list[idx] = {...list[idx], estado: estN, notas: not||list[idx].notas}; updated++; }
        else if (emp && car) { list.push({id: nextId.current++, empresa: emp, cargo: car, estado: estN, fecha: fec, plataforma: plt, contacto: con, link: lnk, notas: not}); added++; }
      }
      return list;
    });
    return { added, updated };
  }

  function handleImport() {
    setImportErr(""); setImportOk("");
    let data;
    try { data = JSON.parse(importText); } catch { setImportErr("JSON inválido. Revisa el formato."); return; }
    const arr = Array.isArray(data) ? data : [data];
    const { added, updated } = mergePostulaciones(arr);
    setImportOk(`✓ ${added} agregadas, ${updated} actualizadas.`);
    setImportText("");
  }

  function saveTraining() {
    save(TK, training);
    setTrainingSaved(true);
    setTimeout(() => setTrainingSaved(false), 2000);
  }

  async function syncGmail() {
    setGmailStatus("loading"); setGmailLog([]); setGmailSummary(null);
    const log = msg => setGmailLog(prev => [...prev, msg]);
    try {
      log("🔍 Conectando con Gmail...");
      const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split("T")[0];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: `Eres un asistente que analiza correos de Gmail para detectar postulaciones laborales.
Busca correos desde ${sevenDaysAgo} hasta hoy (últimos 7 días).
Busca términos: postulación, aplicación, candidatura, entrevista, proceso de selección, oferta laboral, thank you for applying, application received, we received your application, interview, job offer, hiring, recruitment, selección, reclutamiento.
Recupera hasta 20 correos relevantes.

INSTRUCCIONES DE RECONOCIMIENTO PERSONALIZADAS:
${training}

Responde ÚNICAMENTE con un JSON array (sin markdown, sin texto extra) con objetos:
{ "empresa": "", "cargo": "", "estado": "Postulado|En proceso|Entrevista|Oferta|Rechazado", "fecha": "YYYY-MM-DD", "notas": "", "plataforma": "" }
Si no hay postulaciones responde: []`,
          messages: [{ role: "user", content: "Busca y analiza mis correos de postulaciones de los últimos 7 días y devuelve el JSON." }],
          mcp_servers: [{ type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail-mcp" }]
        })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      log("📨 Correos analizados, procesando...");
      const fullText = data.content.filter(b => b.type==="text").map(b => b.text).join("\n");
      const match = fullText.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No se encontró JSON en la respuesta.");
      const detected = JSON.parse(match[0]);
      log(`✅ ${detected.length} postulaciones detectadas.`);
      const { added, updated } = mergePostulaciones(detected);
      setGmailSummary({ added, updated });
      setGmailStatus("done");
    } catch(err) {
      log(`❌ Error: ${err.message}`);
      setGmailStatus("error");
    }
  }

  // Stat card click sets filter
  const statCards = [
    { label: "Total",       value: stats.total,       color: "#a78bfa", filtro: "Todos" },
    { label: "Activas",     value: stats.activas,      color: "#60a5fa", filtro: null, activasFiltro: true },
    { label: "Entrevistas", value: stats.entrevistas,  color: "#fbbf24", filtro: "Entrevista" },
    { label: "Ofertas",     value: stats.ofertas,      color: "#4ade80", filtro: "Oferta" },
    { label: "Rechazados",  value: stats.rechazados,   color: "#f87171", filtro: "Rechazado" },
  ];

  function handleStatClick(card) {
    if (card.activasFiltro) {
      // cycle through active states
      const activos = ["Postulado","En proceso","Entrevista"];
      const idx = activos.indexOf(filtro);
      setFiltro(activos[(idx+1) % activos.length]);
    } else {
      setFiltro(card.filtro);
    }
  }

  const inp = (extra={}) => ({ background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", ...extra });

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: "#0f0f1a", minHeight: "100vh", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ background: "#13131f", borderBottom: "1px solid #1e1e35", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#a78bfa" }}>🎯 Mis Postulaciones</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b", marginTop: 2 }}>Seguimiento personal de búsqueda laboral</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setModal("training")} style={{ background: "#1e2535", border: "1px solid #334155", color: "#94a3b8", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>⚙️ Entrenar</button>
          <button onClick={() => setModal("gmail")} style={{ background: "#1a2e1a", border: "1px solid #166534", color: "#4ade80", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>📧 Gmail</button>
          <button onClick={() => setModal("import")} style={{ background: "#1e1e35", border: "1px solid #3b3b5c", color: "#a78bfa", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>⬆ JSON</button>
          <button onClick={openAdd} style={{ background: "#6366f1", border: "none", color: "white", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Stat Cards — clickeable */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          {statCards.map(s => {
            const active = s.filtro === filtro || (s.activasFiltro && ["Postulado","En proceso","Entrevista"].includes(filtro));
            return (
              <div key={s.label} onClick={() => handleStatClick(s)} style={{ background: active ? "#1e1e35" : "#13131f", border: `1px solid ${active ? s.color+"55" : "#1e1e35"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all .15s", boxShadow: active ? `0 0 12px ${s.color}22` : "none", userSelect: "none" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = s.color+"88"}
                onMouseLeave={e => e.currentTarget.style.borderColor = active ? s.color+"55" : "#1e1e35"}>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{s.label}</div>
                {s.activasFiltro && <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>clic para filtrar</div>}
              </div>
            );
          })}
        </div>

        {/* Filters + Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar empresa, cargo..." style={{ ...inp(), flex: 1, minWidth: 180 }} />
          {["Todos", ...ESTADOS].map(e => {
            const ec = ESTADO_COLORS[e];
            const active = filtro === e;
            return (
              <button key={e} onClick={() => setFiltro(e)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400, background: active ? (ec ? ec.bg : "#6366f1") : "transparent", color: active ? (ec ? ec.text : "white") : "#64748b", borderColor: active ? (ec ? ec.border : "#6366f1") : "#1e1e35", transition: "all .15s" }}>
                {e}
              </button>
            );
          })}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#3b3b5c" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15 }}>{posts.length === 0 ? "Aún no hay postulaciones. ¡Agrega la primera!" : "Sin resultados para el filtro seleccionado."}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(p => {
              const ec = ESTADO_COLORS[p.estado] || ESTADO_COLORS["Postulado"];
              return (
                <div key={p.id} onClick={() => openEdit(p)} style={{ background: "#13131f", border: "1px solid #1e1e35", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", cursor: "pointer", transition: "border-color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#2d2d4e"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e35"}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.empresa}</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{p.cargo}</div>
                    {p.plataforma && <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>📌 {p.plataforma}</div>}
                  </div>
                  <div style={{ textAlign: "center", minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: "#475569" }}>{p.fecha}</div>
                    {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "#6366f1" }}>🔗 Ver oferta</a>}
                  </div>
                  {p.notas && <div style={{ fontSize: 12, color: "#64748b", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.notas}>💬 {p.notas}</div>}
                  <span style={{ background: ec.bg, color: ec.text, border: `1px solid ${ec.border}`, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{p.estado}</span>
                  <button onClick={e => { e.stopPropagation(); deletePost(p.id); }} style={{ background: "#2d1a1a", border: "1px solid #7f1d1d", color: "#f87171", padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>🗑️</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {(modal==="add"||modal==="edit") && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
          <div style={{ background:"#13131f",border:"1px solid #2d2d4e",borderRadius:16,padding:24,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto" }}>
            <h2 style={{ margin:"0 0 20px",fontSize:17,color:"#a78bfa" }}>{modal==="add"?"➕ Nueva Postulación":"✏️ Editar Postulación"}</h2>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {[["empresa","Empresa *"],["cargo","Cargo / Posición *"],["fecha","Fecha","date"],["plataforma","Plataforma"],["contacto","Contacto / Reclutador"],["link","Link de la oferta"]].map(([k,l,t])=>(
                <div key={k}>
                  <label style={{ fontSize:12,color:"#64748b",display:"block",marginBottom:4 }}>{l}</label>
                  <input type={t||"text"} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp()} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:12,color:"#64748b",display:"block",marginBottom:4 }}>Estado</label>
                <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))} style={inp()}>
                  {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12,color:"#64748b",display:"block",marginBottom:4 }}>Notas</label>
                <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={3} style={inp({resize:"vertical"})} />
              </div>
            </div>
            <div style={{ display:"flex",gap:10,marginTop:20,justifyContent:"flex-end" }}>
              <button onClick={closeModal} style={{ background:"transparent",border:"1px solid #2d2d4e",color:"#94a3b8",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:13 }}>Cancelar</button>
              <button onClick={saveForm} style={{ background:"#6366f1",border:"none",color:"white",padding:"9px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>{modal==="add"?"Agregar":"Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Training */}
      {modal==="training" && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
          <div style={{ background:"#13131f",border:"1px solid #334155",borderRadius:16,padding:24,width:"100%",maxWidth:620,maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
            <h2 style={{ margin:"0 0 6px",fontSize:17,color:"#94a3b8" }}>⚙️ Entrenar reconocimiento de correos</h2>
            <p style={{ fontSize:12,color:"#475569",margin:"0 0 14px",lineHeight:1.6 }}>
              Escribe instrucciones en texto libre para enseñarle a Claude cómo interpretar los correos de tus postulaciones. Puedes incluir ejemplos de frases, formatos especiales o empresas específicas.
            </p>
            <textarea value={training} onChange={e=>setTraining(e.target.value)} rows={16} style={{ ...inp({resize:"vertical",flex:1,fontFamily:"monospace",fontSize:12,lineHeight:1.6}), minHeight:300 }} />
            <div style={{ display:"flex",gap:10,marginTop:16,justifyContent:"flex-end",alignItems:"center" }}>
              {trainingSaved && <span style={{ fontSize:12,color:"#4ade80" }}>✓ Guardado</span>}
              <button onClick={closeModal} style={{ background:"transparent",border:"1px solid #2d2d4e",color:"#94a3b8",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:13 }}>Cancelar</button>
              <button onClick={saveTraining} style={{ background:"#334155",border:"1px solid #475569",color:"white",padding:"9px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>💾 Guardar instrucciones</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gmail */}
      {modal==="gmail" && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
          <div style={{ background:"#13131f",border:"1px solid #166534",borderRadius:16,padding:24,width:"100%",maxWidth:500 }}>
            <h2 style={{ margin:"0 0 8px",fontSize:17,color:"#4ade80" }}>📧 Sincronizar con Gmail</h2>
            <p style={{ fontSize:12,color:"#64748b",margin:"0 0 20px",lineHeight:1.6 }}>
              Buscará correos de los últimos <b style={{ color:"#94a3b8" }}>7 días</b> usando tus instrucciones de entrenamiento. Nuevas postulaciones se agregan y las existentes se actualizan.
            </p>
            {gmailStatus==="idle" && (
              <button onClick={syncGmail} style={{ width:"100%",background:"#166534",border:"1px solid #4ade80",color:"#4ade80",padding:12,borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:600 }}>
                🔍 Iniciar búsqueda en Gmail
              </button>
            )}
            {gmailStatus==="loading" && (
              <div style={{ background:"#0f0f1a",borderRadius:10,padding:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                  <div style={{ width:16,height:16,border:"2px solid #4ade80",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite" }} />
                  <span style={{ fontSize:13,color:"#4ade80" }}>Analizando correos...</span>
                </div>
                {gmailLog.map((l,i)=><div key={i} style={{ fontSize:12,color:"#64748b",marginBottom:4 }}>{l}</div>)}
              </div>
            )}
            {(gmailStatus==="done"||gmailStatus==="error") && (
              <div style={{ background:"#0f0f1a",borderRadius:10,padding:16,marginBottom:16 }}>
                {gmailLog.map((l,i)=><div key={i} style={{ fontSize:12,color:"#64748b",marginBottom:4 }}>{l}</div>)}
                {gmailSummary && (
                  <div style={{ marginTop:12,padding:"10px 14px",background:"#1a2e1a",borderRadius:8,border:"1px solid #166534" }}>
                    <span style={{ color:"#4ade80",fontSize:13,fontWeight:600 }}>✓ {gmailSummary.added} nuevas · {gmailSummary.updated} actualizadas</span>
                  </div>
                )}
              </div>
            )}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ display:"flex",gap:10,marginTop:16,justifyContent:"flex-end" }}>
              {(gmailStatus==="done"||gmailStatus==="error") && (
                <button onClick={()=>{setGmailStatus("idle");setGmailLog([]);setGmailSummary(null);}} style={{ background:"transparent",border:"1px solid #166534",color:"#4ade80",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13 }}>🔄 Volver a buscar</button>
              )}
              <button onClick={()=>{closeModal();setGmailStatus("idle");setGmailLog([]);setGmailSummary(null);}} style={{ background:"transparent",border:"1px solid #2d2d4e",color:"#94a3b8",padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal JSON Import */}
      {modal==="import" && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
          <div style={{ background:"#13131f",border:"1px solid #2d2d4e",borderRadius:16,padding:24,width:"100%",maxWidth:560 }}>
            <h2 style={{ margin:"0 0 8px",fontSize:17,color:"#a78bfa" }}>⬆ Importar JSON</h2>
            <p style={{ fontSize:12,color:"#64748b",margin:"0 0 12px",lineHeight:1.6 }}>
              Pega el JSON de ChatGPT u otra fuente. Campos: <code style={{ color:"#a78bfa" }}>empresa, cargo, estado, fecha, plataforma, contacto, link, notas</code>
            </p>
            <div style={{ background:"#0f0f1a",border:"1px solid #1e1e35",borderRadius:8,padding:12,marginBottom:10,fontSize:11,color:"#475569" }}>
              <div style={{ color:"#64748b",marginBottom:4 }}>Ejemplo:</div>
              <pre style={{ margin:0,color:"#6366f1",fontSize:11 }}>{`[{"empresa":"Acme","cargo":"Dev","estado":"Entrevista","fecha":"2024-06-01","notas":"Llamada el jueves"}]`}</pre>
            </div>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} rows={7} placeholder='Pega tu JSON aquí...' style={inp({resize:"vertical",fontFamily:"monospace"})} />
            {importErr && <div style={{ color:"#f87171",fontSize:12,marginTop:6 }}>❌ {importErr}</div>}
            {importOk && <div style={{ color:"#4ade80",fontSize:12,marginTop:6 }}>{importOk}</div>}
            <div style={{ display:"flex",gap:10,marginTop:16,justifyContent:"flex-end" }}>
              <button onClick={closeModal} style={{ background:"transparent",border:"1px solid #2d2d4e",color:"#94a3b8",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontSize:13 }}>Cerrar</button>
              <button onClick={handleImport} style={{ background:"#6366f1",border:"none",color:"white",padding:"9px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>Importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
