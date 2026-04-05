import { useState, useRef, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600&display=swap');`;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #1a1d23; font-family: 'Inter', sans-serif; min-height: 100vh; color: #e2e8f0; }
::selection { background: #3b82f6; color: #fff; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 4px; }
textarea, select, input { font-family: 'Inter', sans-serif; }
select option { background: #242830; color: #e2e8f0; }
@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes popIn { 0% { opacity:0; transform:scale(0.97); } 100% { opacity:1; transform:scale(1); } }
@keyframes spin { to { transform:rotate(360deg); } }
@keyframes floatDot { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
@keyframes shimmerPulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
.fade-up { animation: fadeUp 0.38s ease forwards; }
.pop-in { animation: popIn 0.3s cubic-bezier(0.34,1.4,0.64,1) forwards; }
.btn-main:hover { transform:translateY(-1px); box-shadow: 0 6px 24px rgba(96,165,250,0.22) !important; }
.btn-main:active { transform:translateY(0); }
.tl-row:hover { background: #272b34 !important; }
`;

const T = {
  bg:       "#1a1d23",
  surface:  "#20242c",
  card:     "#242830",
  border:   "#2a2f3a",
  text:     "#e2e8f0",
  muted:    "#8892a4",
  dim:      "#4a5568",
  blue:     "#60a5fa",
  blueDim:  "#1e3a5f",
  blueGlow: "rgba(96,165,250,0.12)",
};

const RISK = {
  Low:    { bg:"#0f2820", border:"#1a4731", color:"#4ade80", label:"Low Risk"    },
  Medium: { bg:"#2a1f0e", border:"#4a3510", color:"#fbbf24", label:"Medium Risk" },
  High:   { bg:"#2a1020", border:"#4a1a30", color:"#f87171", label:"High Risk"   },
};

const MOODS = ["Calm","Motivated","Curious","Tired","Stressed","Anxious","Impulsive","Overconfident","Lazy","Reflective"];
const OLLAMA_URL = "http://localhost:11434";
const MODEL = "llama3.2";

const SYSTEM_PROMPT = `You are a compassionate behavioral analyst. When given a decision, reason, and mood, respond ONLY with a valid JSON object — no markdown, no explanation, no preamble.

JSON structure:
{
  "type": "<one of: Emotional | Rational | Reactive | Instinctive | Social | Avoidance-based>",
  "pattern": "<one of: Avoidance | Impulsive | Overthinking | Reactive | Habitual | Deliberate | Fear-based | Optimistic | Boundary-setting>",
  "risk": "<one of: Low | Medium | High>",
  "emotion": "<detected emotion in 1-2 words>",
  "insight": "<1-2 sentence thoughtful, non-judgmental behavioral insight>",
  "warning": "<null if risk is Low, otherwise 1 sentence pattern warning>"
}`;

async function checkOllama() {
  try { const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

async function analyzeWithOllama(decision, reason, mood, onStream) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Decision: "${decision}"\nReason: "${reason}"\nMood: ${mood}\n\nReturn ONLY the JSON object.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    for (const line of dec.decode(value).split("\n").filter(Boolean)) {
      try { const c = JSON.parse(line); if (c.message?.content) { full += c.message.content; onStream(full); } } catch {}
    }
  }
  const m = full.match(/\{[\s\S]*\}/); if (!m) throw new Error("No JSON in response");
  return JSON.parse(m[0]);
}

const Tag = ({ label, color, bg, border }) => (
  <span style={{ fontSize:10, fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase", padding:"3px 8px", borderRadius:5, color, background:bg, border:`1px solid ${border}` }}>{label}</span>
);

const Card = ({ children, style={}, className="" }) => (
  <div className={className} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:22, ...style }}>{children}</div>
);

const SLabel = ({ children }) => (
  <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:T.dim, marginBottom:9 }}>{children}</div>
);

function StreamDots() {
  return (
    <div style={{ display:"flex", gap:5 }}>
      {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.blue, animation:`floatDot 1.1s ease-in-out infinite`, animationDelay:`${i*0.16}s`, opacity:0.7 }} />)}
    </div>
  );
}

function InsightPanel({ analysis, streaming, rawStream }) {
  const risk = RISK[analysis?.risk] || RISK.Low;
  if (streaming) return (
    <Card style={{ borderColor:T.blueDim }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}><StreamDots /><span style={{ fontSize:13, color:T.muted, fontStyle:"italic" }}>Analyzing your decision…</span></div>
      {rawStream && <div style={{ fontFamily:"monospace", fontSize:10.5, color:"#3b5a8a", background:T.bg, borderRadius:8, padding:"9px 12px", lineHeight:1.9, maxHeight:80, overflow:"hidden", maskImage:"linear-gradient(to bottom, black 50%, transparent 100%)" }}>{rawStream.slice(-200)}</div>}
    </Card>
  );
  if (!analysis) return null;
  return (
    <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <Card style={{ borderColor:T.blueDim, background:"#1c2130" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
          <div style={{ width:26, height:26, borderRadius:8, background:T.blueDim, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={T.blue} strokeWidth="1.2"/><circle cx="6" cy="6" r="2" fill={T.blue} opacity="0.8"/></svg>
          </div>
          <span style={{ fontSize:11, fontWeight:600, color:T.blue, letterSpacing:"0.08em", textTransform:"uppercase" }}>AI Insight</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:18 }}>
          {[
            { label:"Decision Type", value:analysis.type,    bg:"#1a2535", border:"#1e3a5f", color:"#93c5fd" },
            { label:"Emotion",       value:analysis.emotion, bg:"#1e1a2e", border:"#2d1f4a", color:"#c084fc" },
            { label:"Pattern",       value:analysis.pattern, bg:"#1a2535", border:"#1e3a5f", color:"#93c5fd" },
            { label:"Risk Level",    value:risk.label,       bg:risk.bg,   border:risk.border, color:risk.color },
          ].map(({ label, value, bg, border, color }) => (
            <div key={label} style={{ background:bg, border:`1px solid ${border}`, borderRadius:9, padding:"11px 12px" }}>
              <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:T.dim, marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:13, fontWeight:500, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ borderLeft:`2px solid ${T.blueDim}`, paddingLeft:14 }}>
          <p style={{ fontFamily:"'DM Serif Display', serif", fontSize:14.5, color:"#94a3b8", lineHeight:1.8, fontStyle:"italic" }}>{analysis.insight}</p>
        </div>
      </Card>
      {analysis.warning && (
        <div className="pop-in" style={{ background:"#1f1510", border:"1px solid #4a2510", borderRadius:12, padding:"14px 16px", display:"flex", gap:12, alignItems:"flex-start", animationDelay:"0.1s", opacity:0 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:"#2a1a0e", border:"1px solid #4a2510", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5L12.5 12H0.5L6.5 1.5Z" stroke="#fbbf24" strokeWidth="1.2" fill="rgba(251,191,36,0.07)" strokeLinejoin="round"/><line x1="6.5" y1="5" x2="6.5" y2="8" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/><circle cx="6.5" cy="9.5" r="0.7" fill="#fbbf24"/></svg>
          </div>
          <div>
            <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#fbbf24", marginBottom:5 }}>Pattern Warning</div>
            <p style={{ fontSize:12.5, color:"#92724a", lineHeight:1.65 }}>{analysis.warning}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ item, index }) {
  const risk = RISK[item.analysis?.risk] || RISK.Low;
  return (
    <div className="tl-row fade-up" style={{ display:"flex", gap:12, padding:"12px 12px", borderRadius:10, transition:"background 0.15s", animationDelay:`${index*0.05}s`, opacity:0 }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:5, gap:3 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:risk.color, flexShrink:0, boxShadow:`0 0 5px ${risk.color}55` }} />
        <div style={{ width:1, flex:1, background:T.border, minHeight:12 }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.55, marginBottom:7 }}>{item.decision}</div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
          {item.analysis?.pattern && <Tag label={item.analysis.pattern} color="#93c5fd" bg="#1a2535" border="#1e3a5f" />}
          <Tag label={item.mood} color={T.muted} bg={T.surface} border={T.border} />
          <span style={{ fontSize:10.5, color:T.dim, marginLeft:"auto" }}>{item.date}</span>
        </div>
      </div>
    </div>
  );
}

function PatternSummary({ decisions }) {
  if (decisions.length < 2) return null;
  const count = (arr, key) => arr.reduce((a,d) => { const v=d.analysis?.[key]||d[key]; a[v]=(a[v]||0)+1; return a; }, {});
  const top = obj => Object.entries(obj).sort((a,b)=>b[1]-a[1])[0];
  const tp = top(count(decisions,"pattern")), tm = top(count(decisions,"mood"));
  const hr = decisions.filter(d=>d.analysis?.risk==="High").length;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
      {[
        { label:"Top Pattern",  value:tp?.[0]||"—", sub:`${tp?.[1]||0} times`, color:"#60a5fa", bg:"#1a2535", border:"#1e3a5f" },
        { label:"Common Mood",  value:tm?.[0]||"—", sub:`${tm?.[1]||0} entries`,color:"#a78bfa", bg:"#1e1a2e", border:"#2d1f4a" },
        { label:"High Risk",    value:hr,            sub:"decisions",           color:"#f87171", bg:"#2a1020", border:"#4a1a30" },
      ].map(({ label, value, sub, color, bg, border }) => (
        <div key={label} style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"13px 11px" }}>
          <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:T.dim, marginBottom:6 }}>{label}</div>
          <div style={{ fontSize:18, fontWeight:600, color, marginBottom:1 }}>{value}</div>
          <div style={{ fontSize:10.5, color:T.dim }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

const SEEDS = [
  { decision:"Skipped the gym — told myself I'd go tomorrow", mood:"Tired", date:"Apr 2", analysis:{ type:"Avoidance-based", pattern:"Avoidance", risk:"Medium", emotion:"Fatigue", insight:"Rest is valid, but a pattern of postponing may signal a deeper resistance worth examining.", warning:"This mirrors 2 earlier choices this month." } },
  { decision:"Agreed to a project I didn't have bandwidth for", mood:"Stressed", date:"Mar 31", analysis:{ type:"Social", pattern:"Boundary-setting", risk:"High", emotion:"Obligation", insight:"Saying yes under pressure often costs more than the discomfort of saying no.", warning:"High-stress decisions like this tend to lead to regret." } },
  { decision:"Started journaling every morning", mood:"Motivated", date:"Mar 28", analysis:{ type:"Rational", pattern:"Deliberate", risk:"Low", emotion:"Clarity", insight:"A calm, intentional choice — your future self will likely thank you for this one.", warning:null } },
];

export default function App() {
  const [decision, setDecision]   = useState("");
  const [reason, setReason]       = useState("");
  const [mood, setMood]           = useState("Calm");
  const [ollamaOk, setOllamaOk]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [streaming, setStreaming]  = useState(false);
  const [rawStream, setRawStream]  = useState("");
  const [analysis, setAnalysis]   = useState(null);
  const [error, setError]         = useState(null);
  const [history, setHistory]     = useState(SEEDS);
  const insightRef = useRef(null);

  useEffect(() => { checkOllama().then(ok => setOllamaOk(ok)); }, []);

  const handleAnalyze = async () => {
    if (!decision.trim()) return;
    setLoading(true); setStreaming(true); setAnalysis(null); setError(null); setRawStream("");
    setTimeout(() => insightRef.current?.scrollIntoView({ behavior:"smooth", block:"nearest" }), 120);
    try {
      const result = await analyzeWithOllama(decision, reason, mood, raw => setRawStream(raw));
      const dateStr = new Date().toLocaleDateString("en-US", { month:"short", day:"numeric" });
      setHistory(prev => [{ decision, mood, date:dateStr, analysis:result }, ...prev]);
      setAnalysis(result); setDecision(""); setReason("");
    } catch(e) { setError(e.message); }
    finally { setStreaming(false); setLoading(false); }
  };

  const inputStyle = {
    width:"100%", background:T.surface, border:`1px solid ${T.border}`,
    borderRadius:9, color:T.text, fontSize:13.5, padding:"11px 13px",
    outline:"none", lineHeight:1.6, transition:"border-color 0.18s, box-shadow 0.18s",
  };

  return (
    <>
      <style>{FONTS}{CSS}</style>
      <div style={{ minHeight:"100vh", background:T.bg }}>
        <div style={{ position:"fixed", top:0, left:"50%", transform:"translateX(-50%)", width:700, height:320, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(59,130,246,0.05) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }} />

        {/* Header */}
        <div style={{ position:"relative", zIndex:1, textAlign:"center", padding:"50px 24px 38px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:T.surface, border:`1px solid ${T.border}`, borderRadius:30, padding:"5px 14px", marginBottom:20, boxShadow:"0 1px 8px rgba(0,0,0,0.3)" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:T.blue, boxShadow:`0 0 7px ${T.blue}` }} />
            <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:T.muted }}>Decision Memory AI</span>
          </div>
          <h1 style={{ fontFamily:"'DM Serif Display', serif", fontSize:"clamp(26px,5vw,44px)", color:T.text, fontWeight:400, letterSpacing:"-0.02em", lineHeight:1.2, marginBottom:12 }}>
            Understand your past.<br />
            <span style={{ color:T.blue, fontStyle:"italic" }}>Improve your future.</span>
          </h1>
          <p style={{ fontSize:13.5, color:T.muted, maxWidth:330, margin:"0 auto", lineHeight:1.75 }}>
            A calm space to examine choices, surface patterns, and reflect without judgment.
          </p>
          <div style={{ marginTop:16 }}>
            {ollamaOk === null && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:T.surface, border:`1px solid ${T.border}`, borderRadius:7, padding:"6px 12px" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:T.dim, animation:"shimmerPulse 1.2s ease infinite" }} />
                <span style={{ fontSize:11, color:T.dim }}>Connecting to Ollama…</span>
              </div>
            )}
            {ollamaOk === false && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"#2a1a0e", border:"1px solid #4a2510", borderRadius:7, padding:"6px 12px" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#fbbf24" }} />
                <span style={{ fontSize:11, color:"#92724a" }}>Ollama not detected — run <code style={{ background:"rgba(255,255,255,0.06)", padding:"1px 5px", borderRadius:3, fontSize:10.5 }}>ollama serve</code></span>
              </div>
            )}
            {ollamaOk === true && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"#0f2820", border:"1px solid #1a4731", borderRadius:7, padding:"6px 12px" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", boxShadow:"0 0 6px #4ade80" }} />
                <span style={{ fontSize:11, color:"#4ade80" }}>Ollama connected · {MODEL}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ position:"relative", zIndex:1, maxWidth:610, margin:"0 auto", padding:"0 18px 80px", display:"flex", flexDirection:"column", gap:12 }}>

          <Card>
            <div style={{ marginBottom:14 }}>
              <SLabel>What decision did you make?</SLabel>
              <textarea value={decision} onChange={e=>setDecision(e.target.value)}
                placeholder="e.g. I skipped the meeting to avoid a difficult conversation…" rows={2}
                style={{ ...inputStyle, resize:"none" }}
                onFocus={e=>{ e.target.style.borderColor=T.blue; e.target.style.boxShadow=`0 0 0 3px ${T.blueGlow}`; }}
                onBlur={e=>{ e.target.style.borderColor=T.border; e.target.style.boxShadow="none"; }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <SLabel>Why did you make it?</SLabel>
              <textarea value={reason} onChange={e=>setReason(e.target.value)}
                placeholder="What was going through your mind at the time?" rows={2}
                style={{ ...inputStyle, resize:"none" }}
                onFocus={e=>{ e.target.style.borderColor=T.blue; e.target.style.boxShadow=`0 0 0 3px ${T.blueGlow}`; }}
                onBlur={e=>{ e.target.style.borderColor=T.border; e.target.style.boxShadow="none"; }} />
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <SLabel>Mood</SLabel>
                <select value={mood} onChange={e=>setMood(e.target.value)} style={{ ...inputStyle, padding:"10px 13px", cursor:"pointer", appearance:"none" }}>
                  {MOODS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button className="btn-main" onClick={handleAnalyze} disabled={loading||!decision.trim()} style={{
                background: decision.trim()&&!loading ? "#3b82f6" : T.surface,
                border:`1px solid ${decision.trim()&&!loading ? "#2563eb" : T.border}`,
                borderRadius:9, color: decision.trim()&&!loading ? "#fff" : T.dim,
                fontSize:13, fontWeight:600, padding:"10px 20px",
                cursor: decision.trim()&&!loading ? "pointer" : "default",
                fontFamily:"'Inter', sans-serif", transition:"all 0.18s",
                whiteSpace:"nowrap", letterSpacing:"0.01em",
                boxShadow: decision.trim()&&!loading ? "0 2px 12px rgba(59,130,246,0.22)" : "none",
              }}>
                {loading ? (
                  <span style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ display:"inline-block", width:11, height:11, border:"2px solid rgba(255,255,255,0.25)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                    Thinking…
                  </span>
                ) : "Analyze →"}
              </button>
            </div>
          </Card>

          {error && (
            <div style={{ background:"#2a1020", border:"1px solid #4a1a30", borderRadius:12, padding:"12px 15px" }}>
              <div style={{ fontSize:10, fontWeight:600, color:"#f87171", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.07em" }}>Ollama Error</div>
              <div style={{ fontSize:12.5, color:"#9a6060", lineHeight:1.6 }}>{error}</div>
              <div style={{ fontSize:11, color:"#7a5050", marginTop:5 }}>Run: <code style={{ background:"rgba(255,255,255,0.05)", padding:"1px 6px", borderRadius:3 }}>OLLAMA_ORIGINS=* ollama serve</code></div>
            </div>
          )}

          <div ref={insightRef}>
            {(streaming||analysis) && <InsightPanel analysis={analysis} streaming={streaming} rawStream={rawStream} />}
          </div>

          {history.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 0" }}>
              <div style={{ flex:1, height:"1px", background:`linear-gradient(to right, transparent, ${T.border})` }} />
              <span style={{ fontSize:9, fontWeight:600, color:T.dim, letterSpacing:"0.14em", textTransform:"uppercase" }}>Timeline</span>
              <div style={{ flex:1, height:"1px", background:`linear-gradient(to left, transparent, ${T.border})` }} />
            </div>
          )}

          {history.length >= 2 && <PatternSummary decisions={history} />}

          {history.length === 0 ? (
            <div style={{ textAlign:"center", padding:"56px 0" }}>
              <p style={{ fontSize:13, color:T.dim, lineHeight:1.75 }}>Add your first decision to begin.<br/>Patterns emerge over time.</p>
            </div>
          ) : (
            <Card style={{ padding:"6px 8px" }}>
              <div style={{ maxHeight:400, overflowY:"auto", paddingRight:3 }}>
                {history.map((item,i) => <TimelineItem key={i} item={item} index={i} />)}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
