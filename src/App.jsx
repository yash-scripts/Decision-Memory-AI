import { useState, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');`;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #f0f0f0; overflow: hidden; }
textarea { font-family: 'Inter', sans-serif; }
textarea:focus { outline: none; }
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes dot    { 0%,100% { transform:translateY(0); opacity:0.4; } 50% { transform:translateY(-3px); opacity:1; } }
@keyframes pulse  { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
@keyframes slideIn { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:translateX(0); } }
.fade-up   { animation: fadeUp  0.3s ease forwards; }
.slide-in  { animation: slideIn 0.35s ease forwards; }
.tl-row:hover  { background: #161616 !important; }
.pill-btn:hover { opacity: 0.85; }
.sb-row:hover { background: #161616 !important; }
`;

/* ─── DECISION FORK LOGO ────────────────────────────────────────── */
const ForkLogo = ({ size = 42, dark = true }) => {
  const bg    = dark ? "#141414" : "#f5f0e8";
  const bord  = dark ? "#2a2a2a" : "#ddd5c8";
  const line  = dark ? "#3a3a3a" : "#c8bfb2";
  const r     = Math.round(size * 0.26);
  const s     = size;
  return (
    <div style={{
      width: s, height: s, borderRadius: r,
      background: bg, border: `1px solid ${bord}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <svg width={s * 0.64} height={s * 0.64} viewBox="0 0 28 28" fill="none">
        {/* stem */}
        <line x1="14" y1="22" x2="14" y2="28" stroke={line} strokeWidth="2.2" strokeLinecap="round"/>
        {/* left branch */}
        <line x1="14" y1="22" x2="7"  y2="13" stroke={line} strokeWidth="2.2" strokeLinecap="round"/>
        {/* right branch */}
        <line x1="14" y1="22" x2="21" y2="13" stroke={line} strokeWidth="2.2" strokeLinecap="round"/>
        {/* red top-left node */}
        <circle cx="7"  cy="10" r="4.5" fill="#c0392b" opacity="0.95"/>
        <circle cx="7"  cy="10" r="1.8" fill="white"   opacity="0.4"/>
        {/* amber top-right node */}
        <circle cx="21" cy="10" r="4.5" fill="#d4a017" opacity="0.95"/>
        <circle cx="21" cy="10" r="1.8" fill="white"   opacity="0.4"/>
        {/* green bottom node */}
        <circle cx="14" cy="26" r="3.5" fill="#2d7a45" opacity="0.95"/>
        <circle cx="14" cy="26" r="1.4" fill="white"   opacity="0.4"/>
      </svg>
    </div>
  );
};

/* ─── BACKEND ───────────────────────────────────────────────────── */
const OLLAMA_URL = "http://localhost:11434";
const MODEL      = "llama3.2";

const SYSTEM_PROMPT = `You are a compassionate behavioral analyst. Analyze the decision log and respond ONLY with a single valid JSON object. No markdown, no code fences, no extra text.

{
  "type": "<Emotional|Rational|Reactive|Instinctive|Social|Avoidance-based>",
  "pattern": "<Avoidance|Impulsive|Overthinking|Reactive|Habitual|Deliberate|Fear-based|Optimistic|Boundary-setting>",
  "risk": "<Low|Medium|High>",
  "emotion": "<primary emotion 2-3 words>",
  "trigger": "<main trigger word>",
  "regretScore": <integer 0-100>,
  "insight": "<2 thoughtful non-judgmental sentences>",
  "warning": <null or "1 sentence pattern warning">,
  "reflection": "<a thoughtful question for the user>",
  "similarDecision": <null or "1 sentence describing a similar past pattern">
}`;

async function checkOllama() {
  try { const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

async function runAnalysis(entry, onStream) {
  const msg = `Decision: "${entry.decision}"
Reason: "${entry.reason}"
Feelings: ${(entry.emotions||[]).join(", ")||"not specified"}
Triggers: ${(entry.triggers||[]).join(", ")||"not specified"}
Expected outcome: "${entry.outcome||"not specified"}"
Faced before: ${entry.facedBefore ? "Yes" : "No"}
Sacrificed: "${entry.sacrificed||"not specified"}"

Return ONLY the JSON.`;

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: msg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value).split("\n").filter(Boolean)) {
      try {
        const c = JSON.parse(line);
        if (c.message?.content) { full += c.message.content; onStream(full); }
      } catch {}
    }
  }
  const m = full.match(/\{[\s\S]*?\}/);
  if (!m) throw new Error("No JSON found");
  return JSON.parse(m[0]);
}

/* ─── SEEDS ─────────────────────────────────────────────────────── */
const SEEDS = [
  { id:1, decision:"Said yes to extra project", mood:"Stressed", date:"Today", risk:"High",
    analysis:{ type:"Social", pattern:"Boundary-setting", risk:"High", emotion:"Obligation",
      trigger:"Guilt", regretScore:74,
      insight:"Guilt-driven decisions sacrifice your capacity to protect yourself — rarely sustainable long term.",
      warning:"You've made similar choices 3 times this month when stressed.",
      reflection:"What would you tell a close friend who made this same choice?",
      similarDecision:"You agreed to extra tasks when stressed on Mar 5 and Mar 18. Both led to burnout." }},
  { id:2, decision:"Skipped gym again", mood:"Tired", date:"Today", risk:"Medium",
    analysis:{ type:"Avoidance-based", pattern:"Avoidance", risk:"Medium", emotion:"Fatigue",
      trigger:"Avoidance", regretScore:48,
      insight:"Rest is valid, but postponing consistently may signal deeper resistance worth examining.",
      warning:"This mirrors 2 earlier choices this month.",
      reflection:"What is the gym representing beyond just exercise for you?",
      similarDecision:null }},
  { id:3, decision:"Started journaling daily", mood:"Motivated", date:"Yesterday", risk:"Low",
    analysis:{ type:"Rational", pattern:"Deliberate", risk:"Low", emotion:"Clarity",
      trigger:"Curiosity", regretScore:8,
      insight:"A calm, intentional choice — your future self will likely thank you for this one.",
      warning:null,
      reflection:"How might you protect this habit when motivation dips?",
      similarDecision:null }},
];

const TRIGGERS_LIST = ["Guilt","Fear","Social pressure","Excitement","Obligation","Curiosity","Avoidance","Habit"];

const EMOTION_PILLS = [
  { label:"Anxious",   ubg:"#1c1010", ubord:"#5a1a1a", utext:"#cd6060", sbg:"#7f1d1d", sbord:"#dc2626", stext:"#fca5a5" },
  { label:"Regretful", ubg:"#1c1508", ubord:"#5a3a10", utext:"#c08040", sbg:"#78350f", sbord:"#d97706", stext:"#fde68a" },
  { label:"Calm",      ubg:"#0d1c10", ubord:"#1a4520", utext:"#4a9060", sbg:"#14532d", sbord:"#16a34a", stext:"#86efac" },
  { label:"Confident", ubg:"#0d1520", ubord:"#1a2a45", utext:"#4a7090", sbg:"#1e3a5f", sbord:"#2563eb", stext:"#93c5fd" },
  { label:"Relieved",  ubg:"#0d1a1c", ubord:"#1a3a45", utext:"#4a8090", sbg:"#164e63", sbord:"#0284c7", stext:"#7dd3fc" },
  { label:"Numb",      ubg:"#141414", ubord:"#2e2e2e", utext:"#707070", sbg:"#374151", sbord:"#6b7280", stext:"#d1d5db" },
];

const RISK_COLORS = {
  Low:    { bg:"#0f2820", bord:"#1a4731", text:"#4ade80", dot:"#22c55e" },
  Medium: { bg:"#2a1f0a", bord:"#4a3510", text:"#fbbf24", dot:"#f59e0b" },
  High:   { bg:"#2a0f0f", bord:"#5a1a1a", text:"#f87171", dot:"#ef4444" },
};

/* ─── LIVE INSIGHT PANEL ────────────────────────────────────────── */
function InsightPanel({ analysis, streaming, rawStream, seedAnalysis, dark }) {
  const a = analysis || seedAnalysis;

  // AI Insight Panel Theming Colors
  const emptyIconBg = dark ? "#1a1a1a" : "#EAF4FF";
  const emptyIconBd = dark ? "#2a2a2a" : "#C7E0FF";
  const emptyIconCol = dark ? "#404040" : "#5a7a9a";
  
  const iconBg = dark ? "#1a1a1a" : "#EAF4FF";
  const iconBd = dark ? "#2a2a2a" : "#C7E0FF";
  const titleCol = dark ? "#e2e8f0" : "#1e3a5f";

  const defCardBg = dark ? "#141414" : "#EAF4FF";
  const defCardBd = dark ? "#1f1f1f" : "#C7E0FF";
  const defLabelCol = dark ? "#404040" : "#6080a0";
  const defValCol = dark ? "#e2e8f0" : "#1e3a5f";

  // The risk and special highlighted cards keep their thematic background or adapt for light mode slightly
  // Wait, let's just apply petal blue to the generic dark cards
  const textQuoteCol = dark ? "#909090" : "#305070";

  if (!a && !streaming) return (
    <div style={{ padding:"32px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:emptyIconBg,
          border:`1px solid ${emptyIconBd}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke={emptyIconCol} strokeWidth="1.2"/>
            <circle cx="6" cy="6" r="2" fill={emptyIconCol} opacity="0.6"/>
          </svg>
        </div>
        <span style={{ fontSize:11, fontWeight:600, color:emptyIconCol, letterSpacing:"0.1em", textTransform:"uppercase" }}>AI Insight</span>
      </div>
      <p style={{ fontSize:13, color:dark?"#2a2a2a":"#607080", lineHeight:1.7 }}>
        Complete the entry form and your behavioral analysis will appear here.
      </p>
    </div>
  );

  if (streaming && !a) return (
    <div style={{ padding:"32px 24px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <div style={{ display:"flex", gap:5 }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:titleCol,
              animation:`dot 1.1s ease-in-out infinite`, animationDelay:`${i*0.18}s` }}/>
          ))}
        </div>
        <span style={{ fontSize:11, color:titleCol, fontStyle:"italic" }}>Analyzing…</span>
      </div>
      {rawStream && (
        <div style={{ fontFamily:"monospace", fontSize:10, color:dark?"#303030":"#507090", lineHeight:1.8,
          maxHeight:120, overflow:"hidden",
          maskImage:"linear-gradient(to bottom, black 50%, transparent 100%)" }}>
          {rawStream.slice(-300)}
        </div>
      )}
    </div>
  );

  const risk = RISK_COLORS[a.risk] || RISK_COLORS.Medium;
  const regret = Math.min(100, Math.max(0, Math.round(a.regretScore || 0)));

  const LIGHT_RISK = {
    Low:    { bg:"#f0fdf4", bord:"#bbf7d0", text:"#16a34a" },
    Medium: { bg:"#fffbeb", bord:"#fde68a", text:"#d97706" },
    High:   { bg:"#fef2f2", bord:"#fecaca", text:"#dc2626" },
  };
  const activeRiskCols = dark ? risk : (LIGHT_RISK[a.risk] || LIGHT_RISK.Medium);

  return (
    <div className="slide-in" style={{ padding:"24px 20px", display:"flex", flexDirection:"column", gap:12 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:iconBg,
          border:`1px solid ${iconBd}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke={titleCol} strokeWidth="1.2"/>
            <circle cx="6" cy="6" r="2" fill={titleCol} opacity="0.7"/>
          </svg>
        </div>
        <span style={{ fontSize:11, fontWeight:600, color:titleCol, letterSpacing:"0.1em", textTransform:"uppercase" }}>AI Insight</span>
      </div>

      {/* 2x2 grid — pattern, regret %, trigger, risk */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <div style={{ background:defCardBg, border:`1px solid ${defCardBd}`, borderRadius:12, padding:"13px 14px" }}>
          <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:defLabelCol, marginBottom:6 }}>Pattern</div>
          <div style={{ fontSize:15, fontWeight:500, color:defValCol }}>{a.pattern||"—"}</div>
        </div>
        <div style={{ background:dark?"#2a0f0f":"#ffeaf0", border:dark?"1px solid #5a1a1a":"1px solid #ffc2d1", borderRadius:12, padding:"13px 14px",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:28, fontWeight:700, color:dark?"#f87171":"#e11d48" }}>{regret}%</span>
        </div>
        <div style={{ background:defCardBg, border:`1px solid ${defCardBd}`, borderRadius:12, padding:"13px 14px" }}>
          <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:defLabelCol, marginBottom:6 }}>Trigger</div>
          <div style={{ fontSize:15, fontWeight:500, color:defValCol }}>{a.trigger||a.emotion||"—"}</div>
        </div>
        <div style={{ background:activeRiskCols.bg, border:`1px solid ${activeRiskCols.bord}`, borderRadius:12, padding:"13px 14px",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:20, fontWeight:700, color:activeRiskCols.text }}>{a.risk||"—"}</span>
        </div>
      </div>

      {/* Insight quote */}
      {a.insight && (
        <div style={{ background:defCardBg, border:`1px solid ${defCardBd}`, borderRadius:12, padding:"16px 16px" }}>
          <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:textQuoteCol, lineHeight:1.85, fontStyle:"italic", margin:0 }}>
            {a.insight}
          </p>
        </div>
      )}

      {/* Similar past decision */}
      {a.similarDecision && (
        <div style={{ background:dark?"#1a1408":"#fffbeb", border:dark?"1px solid #3d2a10":"1px solid #fde68a", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
            color:dark?"#d97706":"#b45309", marginBottom:6 }}>Similar Past Decision</div>
          <p style={{ fontSize:13, color:dark?"#a07030":"#92400e", lineHeight:1.65, margin:0 }}>{a.similarDecision}</p>
        </div>
      )}

      {/* Warning */}
      {a.warning && (
        <div style={{ background:dark?"#1a0f0f":"#fef2f2", border:dark?"1px solid #4a1a1a":"1px solid #fecaca", borderRadius:12, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
            color:dark?"#ef4444":"#dc2626", marginBottom:5 }}>Pattern Warning</div>
          <p style={{ fontSize:12.5, color:dark?"#904040":"#991b1b", lineHeight:1.6, margin:0 }}>{a.warning}</p>
        </div>
      )}

      {/* Reflection */}
      {a.reflection && (
        <div style={{ background:defCardBg, border:`1px solid ${defCardBd}`, borderRadius:12, padding:"12px 14px" }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase",
            color:defLabelCol, marginBottom:5 }}>Sit With This</div>
          <p style={{ fontFamily:"'Lora',serif", fontSize:13, color:textQuoteCol, lineHeight:1.7, fontStyle:"italic", margin:0 }}>
            "{a.reflection}"
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── SIDEBAR ───────────────────────────────────────────────────── */
function Sidebar({ history, activeId, onSelect, onNew, ollamaOk, dark, setDark }) {
  const groups = [
    { label:"Today",     items: history.filter(h=>h.date==="Today") },
    { label:"Yesterday", items: history.filter(h=>h.date==="Yesterday") },
    { label:"This Week", items: history.filter(h=>!["Today","Yesterday"].includes(h.date)) },
  ];

  /* theme-aware colours */
  const sb    = dark ? "#161410"   : "#F5F0E8";
  const sbBd  = dark ? "#2E2820"   : "#E8E0D0";
  const txt   = dark ? "#F0EAE0"   : "#251808";
  const dim   = dark ? "#605040"   : "#b5a898";
  const grpDim= dark ? "#3A3228"   : "#c8bfb2";
  const newBg = dark ? "#C07830"   : "#E8E0D0";
  const newBd = dark ? "#E0A060"   : "#ddd5c8";
  const newTx = dark ? "#161410"   : "#5a4a35";
  const actBg = dark ? "#2A1E0E"   : "#fef3e2";
  const actBd = dark ? "#4A3018"   : "#e8c98a";
  const actTx = dark ? "#F0EAE0"   : "#2c2416";
  const rowTx = dark ? "#A09080"   : "#a09080";
  const moodC = dark ? "#605040"   : "#b5a898";

  return (
    <div style={{ width:210, flexShrink:0, background:sb, borderRight:`1px solid ${sbBd}`,
      display:"flex", flexDirection:"column", height:"100%", overflow:"hidden",
      transition:"background 0.3s, border-color 0.3s" }}>

      {/* Brand */}
      <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${sbBd}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <ForkLogo size={44} dark={dark}/>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:txt, letterSpacing:"-0.01em" }}>Decision Memory</div>
            <div style={{ fontSize:10, color:dim, letterSpacing:"0.1em", textTransform:"uppercase" }}>AI</div>
          </div>
        </div>
        <button onClick={onNew} style={{
          width:"100%", background:newBg, border:`1px solid ${newBd}`,
          borderRadius:12, padding:"11px 16px", display:"flex", alignItems:"center", gap:10,
          cursor:"pointer", transition:"all 0.15s",
        }}
          onMouseEnter={e=>{ e.currentTarget.style.opacity="0.8"; }}
          onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="7" y1="1" x2="7" y2="13" stroke={newTx} strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="1" y1="7" x2="13" y2="7" stroke={newTx} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize:14, fontWeight:600, color:newTx }}>New Decision</span>
        </button>
      </div>

      {/* History list */}
      <div style={{ flex:1, overflowY:"auto", padding:"14px 12px" }}>
        {groups.map(g => g.items.length > 0 && (
          <div key={g.label} style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase",
              color:grpDim, marginBottom:6, paddingLeft:8 }}>{g.label}</div>
            {g.items.map(item => {
              const r = RISK_COLORS[item.risk] || RISK_COLORS.Medium;
              const active = activeId === item.id;
              return (
                <div key={item.id} onClick={()=>onSelect(item.id)} style={{
                  padding:"10px 12px", borderRadius:10, cursor:"pointer", marginBottom:3,
                  background: active ? actBg : "transparent",
                  border: active ? `1px solid ${actBd}` : "1px solid transparent",
                  transition:"all 0.15s",
                }}
                  onMouseEnter={e=>{ if(!active) e.currentTarget.style.background = dark?"#161616":"#f5f0e8"; }}
                  onMouseLeave={e=>{ if(!active) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ fontSize:13, fontWeight:active?500:400, color:active?actTx:rowTx,
                    marginBottom:4, lineHeight:1.35,
                    display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                    {item.decision}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:r.dot }}/>
                    <span style={{ fontSize:11, color:moodC }}>{item.mood} · {item.risk} Risk</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Theme toggle ─────────────────────────────────────────── */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${sbBd}`, flexShrink:0 }}>
        <button onClick={()=>setDark(d=>!d)} style={{
          width:"100%", background:"transparent", border:`1px solid ${dark?"#2a2a2a":"#e0d8cc"}`,
          borderRadius:10, padding:"10px 14px", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          transition:"all 0.2s",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            {/* sun / moon icon */}
            {dark ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="3" stroke="#e2e8f0" strokeWidth="1.3"/>
                <line x1="7.5" y1="1"   x2="7.5" y2="3"   stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="7.5" y1="12"  x2="7.5" y2="14"  stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="1"   y1="7.5" x2="3"   y2="7.5" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="12"  y1="7.5" x2="14"  y2="7.5" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="2.9" y1="2.9" x2="4.3" y2="4.3" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="10.7" y1="10.7" x2="12.1" y2="12.1" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="2.9" y1="12.1" x2="4.3" y2="10.7" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="10.7" y1="4.3" x2="12.1" y2="2.9" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M12.5 8.5A5.5 5.5 0 1 1 6.5 2.5a4 4 0 0 0 6 6z" fill="#5a4a35" opacity="0.85"/>
              </svg>
            )}
            <span style={{ fontSize:12, fontWeight:500, color: dark?"#909090":"#7a6e5f" }}>
              {dark ? "Light mode" : "Dark mode"}
            </span>
          </div>
          {/* pill toggle */}
          <div style={{
            width:38, height:21, borderRadius:11,
            background: dark ? "#2a2a2a" : "#d4c9a8",
            position:"relative", transition:"background 0.25s", flexShrink:0,
          }}>
            <div style={{
              position:"absolute", top:3, left: dark ? 18 : 3,
              width:15, height:15, borderRadius:"50%", background:"#fff",
              boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
              transition:"left 0.25s cubic-bezier(0.34,1.4,0.64,1)",
            }}/>
          </div>
        </button>
      </div>

      {/* Ollama status */}
      <div style={{ padding:"0 16px 14px", flexShrink:0 }}>
        {ollamaOk === null && (
          <div style={{ background:dark?"#111":"#f8f4ef", border:`1px solid ${dark?"#1f1f1f":"#e8e0d4"}`,
            borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:dark?"#404040":"#b5a898", animation:"pulse 1.2s infinite" }}/>
            <span style={{ fontSize:11, color:dark?"#404040":"#a09080" }}>Connecting to Ollama…</span>
          </div>
        )}
        {ollamaOk === false && (
          <div style={{ background:"#1a1408", border:"1px solid #3d2a10",
            borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#f59e0b" }}/>
            <span style={{ fontSize:11, color:"#f59e0b" }}>Run: ollama serve</span>
          </div>
        )}
        {ollamaOk === true && (
          <div style={{ background:"#0f2820", border:"1px solid #1a4731",
            borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 6px #22c55e" }}/>
            <span style={{ fontSize:11, color:"#22c55e" }}>llama3.2 connected</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ENTRY STEPS ───────────────────────────────────────────────── */
const STEP_LABELS = ["Your Decision","Your Reason","How You Feel","Expected Outcome","Done Before?","What You Gave Up"];

function EntryStep({ step, T, data, onChange }) {
  const { decision, reason, emotions, triggers, outcome, faced, sacrifice } = data;

  const toggle = (key, val) => {
    const arr = data[key];
    onChange(key, arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val]);
  };

  const taStyle = {
    width:"100%", background:"transparent", border:"none",
    color:"#d0ccc8", fontSize:14, padding:"16px 18px",
    lineHeight:1.75, resize:"none",
  };
  const wrapStyle = {
    background:"#141414", border:"1px solid #252525", borderRadius:14, overflow:"hidden",
  };

  if (step === 0) return (
    <div style={wrapStyle}>
      <textarea rows={5} value={decision}
        onChange={e=>onChange("decision",e.target.value)}
        placeholder="e.g. I said yes to leading the new project even though I'm already overwhelmed..."
        style={taStyle}/>
    </div>
  );

  if (step === 1) return (
    <>
      <div style={{...wrapStyle, marginBottom:14}}>
        <textarea rows={3} value={reason}
          onChange={e=>onChange("reason",e.target.value)}
          placeholder="e.g. I didn't want to disappoint my team and felt guilty saying no..."
          style={taStyle}/>
      </div>
      <div style={{ background:"#111", border:"1px solid #1f1f1f", borderRadius:14, padding:16 }}>
        <div style={{ fontSize:11, color:"#404040", letterSpacing:"0.06em", textTransform:"uppercase",
          fontWeight:600, marginBottom:10 }}>What triggered this?</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {TRIGGERS_LIST.map(t => {
            const sel = triggers.includes(t);
            return (
              <button key={t} className="pill-btn" onClick={()=>toggle("triggers",t)} style={{
                padding:"7px 14px", borderRadius:20, cursor:"pointer", fontSize:13, fontWeight:500,
                transition:"all 0.15s",
                background: sel ? "#e2e8f0"  : "#181818",
                border:`1.5px solid ${sel ? "#e2e8f0" : "#2a2a2a"}`,
                color:       sel ? "#0a0a0a" : "#606060",
              }}>{t}</button>
            );
          })}
        </div>
      </div>
    </>
  );

  if (step === 2) return (
    <div style={{ background:"#111", border:"1px solid #1f1f1f", borderRadius:14, padding:18 }}>
      <div style={{ fontSize:11, color:"#404040", letterSpacing:"0.06em", textTransform:"uppercase",
        fontWeight:600, marginBottom:12 }}>How do you feel right now?</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {EMOTION_PILLS.map(e => {
          const sel = emotions.includes(e.label);
          return (
            <button key={e.label} className="pill-btn" onClick={()=>toggle("emotions",e.label)} style={{
              padding:"7px 16px", borderRadius:20, cursor:"pointer", fontSize:13, fontWeight:500,
              transition:"all 0.15s",
              background: sel ? e.sbg  : e.ubg,
              border:`1.5px solid ${sel ? e.sbord : e.ubord}`,
              color:       sel ? e.stext: e.utext,
            }}>{e.label}</button>
          );
        })}
        <button className="pill-btn" style={{
          padding:"7px 14px", borderRadius:20, cursor:"pointer", fontSize:13,
          background:"#141414", border:"1.5px solid #2a2a2a", color:"#505050",
        }}>+ Add</button>
      </div>
    </div>
  );

  if (step === 3) return (
    <div style={wrapStyle}>
      <textarea rows={4} value={outcome}
        onChange={e=>onChange("outcome",e.target.value)}
        placeholder="e.g. I think I'll manage, but I'll probably be exhausted by the end..."
        style={taStyle}/>
    </div>
  );

  if (step === 4) return (
    <div style={{ display:"flex", gap:12 }}>
      {[{val:true,label:"Yes, I have"},{val:false,label:"No, first time"}].map(opt => {
        const sel = faced === opt.val;
        return (
          <button key={String(opt.val)} onClick={()=>onChange("faced",opt.val)} style={{
            flex:1, padding:"24px 16px", borderRadius:14, cursor:"pointer",
            fontSize:14, fontWeight:500, textAlign:"center", transition:"all 0.18s",
            background: sel ? "#1a1a1a" : "#111",
            border:`1.5px solid ${sel ? "#e2e8f0" : "#1f1f1f"}`,
            color: sel ? "#e2e8f0" : "#505050",
          }}>{opt.label}</button>
        );
      })}
    </div>
  );

  if (step === 5) return (
    <div style={wrapStyle}>
      <textarea rows={4} value={sacrifice}
        onChange={e=>onChange("sacrifice",e.target.value)}
        placeholder="e.g. My weekend, my peace of mind, the chance to finally say no..."
        style={taStyle}/>
    </div>
  );

  return null;
}

/* ─── MAIN APP ──────────────────────────────────────────────────── */
export default function App() {
  const [dark,      setDark]      = useState(true);
  const [history,   setHistory]   = useState(SEEDS);
  const [activeId,  setActiveId]  = useState(1);
  const [ollamaOk,  setOllamaOk]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [streaming, setStreaming]  = useState(false);
  const [rawStream, setRawStream]  = useState("");
  const [analysis,  setAnalysis]  = useState(null);
  const [mode,      setMode]      = useState("view"); // "entry" | "view"

  /* entry state */
  const [step, setStep] = useState(0);
  const [entryData, setEntryData] = useState({
    decision:"", reason:"", emotions:[], triggers:[],
    outcome:"", faced:null, sacrifice:"",
  });

  useEffect(()=>{ checkOllama().then(ok=>setOllamaOk(ok)); },[]);
  useEffect(()=>{
    document.body.style.background = dark ? "#0a0a0a" : "#f2ede4";
    document.body.style.color      = dark ? "#f0f0f0" : "#2c2416";
  },[dark]);

  const activeItem = history.find(h=>h.id===activeId);
  const liveAnalysis = analysis || (mode==="view" ? activeItem?.analysis : null);

  const updateEntry = (key, val) => setEntryData(prev=>({...prev,[key]:val}));

  const canAdvance = [
    entryData.decision.trim().length > 0,
    entryData.reason.trim().length > 0,
    entryData.emotions.length > 0,
    entryData.outcome.trim().length > 0,
    entryData.faced !== null,
    entryData.sacrifice.trim().length > 0,
  ];

  const handleNew = () => {
    setMode("entry"); setStep(0); setAnalysis(null); setRawStream("");
    setActiveId(null);
    setEntryData({ decision:"", reason:"", emotions:[], triggers:[], outcome:"", faced:null, sacrifice:"" });
  };

  const handleSelect = (id) => {
    setActiveId(id); setMode("view"); setAnalysis(null); setRawStream("");
  };

  const handleSubmit = async () => {
    setLoading(true); setStreaming(true); setRawStream(""); setAnalysis(null);
    try {
      const result = await runAnalysis(entryData, raw=>setRawStream(raw));
      const newItem = {
        id: Date.now(),
        decision: entryData.decision,
        mood: entryData.emotions[0] || "Calm",
        date: "Today",
        risk: result.risk || "Medium",
        analysis: result,
      };
      setHistory(prev=>[newItem,...prev]);
      setActiveId(newItem.id);
      setAnalysis(result);
      setMode("view");
    } catch(e) {
      console.error(e);
      setAnalysis({
        type:"Error", pattern:"Unknown", risk:"Medium", emotion:"Unknown",
        trigger:"Unknown", regretScore:0,
        insight:`Analysis failed: ${e.message}. Make sure Ollama is running: OLLAMA_ORIGINS=* ollama serve`,
        warning:null, reflection:null, similarDecision:null,
      });
    } finally {
      setStreaming(false); setLoading(false);
    }
  };

  /* Active button style — adapts to theme */
  const btnActive  = dark ? { bg:"#e2e8f0", text:"#0a0a0a" } : { bg:"#8b5e2a", text:"#ffffff" };
  const btnDisable = dark ? { bg:"#161616", text:"#303030" } : { bg:"#e8e0d4", text:"#b5a898" };

  /* main area theme tokens */
  const mainBg   = dark ? "#0E0D0B" : "#FAF7F2";
  const progBg   = dark ? "#161410" : "#FFFEFB";
  const progFill = dark ? "#C07830" : "#96601A";
  const stepDim  = dark ? "#605040" : "#b5a898";
  const headCol  = dark ? "#F0EAE0" : "#251808";
  const divLine  = dark ? "#3A3228" : "#E8E0D0";
  const rightBg  = dark ? "#161410" : "#FAF7F2";
  const backBtn  = dark
    ? { bg:"#1E1B16", bord:"#2E2820", col:"#A09080" }
    : { bg:"#f0ece6", bord:"#ddd5c8", col:"#7a6e5f" };

  return (
    <>
      <style>{FONTS}{CSS}</style>
      <div style={{ display:"flex", height:"100vh", background:mainBg, overflow:"hidden", transition:"background 0.3s" }}>

        <Sidebar history={history} activeId={activeId}
          onSelect={handleSelect} onNew={handleNew} ollamaOk={ollamaOk}
          dark={dark} setDark={setDark}/>

        {/* Main area */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, background:mainBg, transition:"background 0.3s" }}>

          {/* Progress bar + step counter */}
          <div style={{ padding:"18px 32px 0", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ flex:1, height:2, background:progBg, borderRadius:2, overflow:"hidden" }}>
                {mode==="entry" && (
                  <div style={{ width:`${((step+1)/6)*100}%`, height:"100%",
                    background:progFill, borderRadius:2, transition:"width 0.4s ease" }}/>
                )}
                {mode==="view" && (
                  <div style={{ width:"100%", height:"100%", background:progBg, borderRadius:2 }}/>
                )}
              </div>
              <span style={{ fontSize:12, color:stepDim, whiteSpace:"nowrap", fontWeight:500 }}>
                {mode==="entry" ? `${step+1} / 6` : "View"}
              </span>
            </div>
          </div>

          {/* Content split */}
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

            {/* Left — input / view */}
            <div style={{ flex:1, padding:"28px 32px 32px", overflowY:"auto", minWidth:0 }}>

              {mode==="entry" && (
                <div className="fade-up" key={step}>
                  {/* Step label */}
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em",
                    textTransform:"uppercase", color:stepDim, marginBottom:8 }}>
                    Step {step+1} of 6 — {STEP_LABELS[step].toUpperCase()}
                  </div>

                  {/* Question */}
                  <div style={{ fontFamily:"'Lora',serif", fontSize:32, color:headCol,
                    fontWeight:400, lineHeight:1.2, marginBottom:24 }}>
                    {[
                      "What decision did you make?",
                      "Why did you make this decision?",
                      "How do you feel right now?",
                      "What outcome are you expecting?",
                      "Have you faced this before?",
                      "What did you give up?",
                    ][step]}
                  </div>

                  {/* Step content */}
                  <div style={{ marginBottom:24 }}>
                    <EntryStep step={step} T={{dark}} data={entryData} onChange={updateEntry}/>
                  </div>

                  {/* Nav buttons */}
                  <div style={{ display:"flex", gap:10 }}>
                    {step > 0 && (
                      <button onClick={()=>setStep(s=>s-1)} style={{
                        padding:"12px 22px", borderRadius:10, cursor:"pointer",
                        fontSize:13, fontWeight:500, transition:"all 0.15s",
                        background:backBtn.bg, border:`1px solid ${backBtn.bord}`, color:backBtn.col,
                      }}>← Back</button>
                    )}
                    {step < 5 ? (
                      <button onClick={()=>{ if(canAdvance[step]) setStep(s=>s+1); }} style={{
                        flex:1, padding:"12px", borderRadius:10, fontSize:13, fontWeight:600,
                        border:"none", cursor: canAdvance[step] ? "pointer" : "not-allowed",
                        background: canAdvance[step] ? btnActive.bg  : btnDisable.bg,
                        color:       canAdvance[step] ? btnActive.text: btnDisable.text,
                        transition:"all 0.18s",
                      }}>Continue →</button>
                    ) : (
                      <button onClick={()=>{ if(canAdvance[5]&&!loading) handleSubmit(); }} style={{
                        flex:1, padding:"12px", borderRadius:10, fontSize:13, fontWeight:600,
                        border:"none", transition:"all 0.18s",
                        cursor: (canAdvance[5]&&!loading) ? "pointer" : "not-allowed",
                        background: (canAdvance[5]&&!loading) ? btnActive.bg  : btnDisable.bg,
                        color:       (canAdvance[5]&&!loading) ? btnActive.text: btnDisable.text,
                      }}>
                        {loading
                          ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                              <span style={{width:12,height:12,border:"2px solid rgba(0,0,0,0.2)",
                                borderTopColor:"#0a0a0a",borderRadius:"50%",display:"inline-block",
                                animation:"spin 0.7s linear infinite"}}/>
                              Analyzing…
                            </span>
                          : "Analyze Decision →"
                        }
                      </button>
                    )}
                  </div>
                </div>
              )}

              {mode==="view" && activeItem && (
                <div className="fade-up">
                  <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em",
                    textTransform:"uppercase", color:stepDim, marginBottom:8 }}>Decision</div>
                  <div style={{ fontFamily:"'Lora',serif", fontSize:26, color:headCol,
                    fontWeight:400, lineHeight:1.3, marginBottom:20 }}>
                    {activeItem.decision}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:20 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%",
                      background:(RISK_COLORS[activeItem.risk]||RISK_COLORS.Medium).dot }}/>
                    <span style={{ fontSize:13, color:stepDim }}>
                      {activeItem.mood} · {activeItem.risk} Risk · {activeItem.date}
                    </span>
                  </div>
                  <button onClick={handleNew} style={{
                    padding:"10px 20px", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:500,
                    background:backBtn.bg, border:`1px solid ${backBtn.bord}`, color:backBtn.col,
                  }}>+ Log a new decision</button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ width:1, background:divLine, flexShrink:0 }}/>

            {/* Right — AI insight */}
            <div style={{ width:256, flexShrink:0, overflowY:"auto", background:rightBg, transition:"background 0.3s" }}>
              <InsightPanel
                analysis={liveAnalysis}
                streaming={streaming}
                rawStream={rawStream}
                seedAnalysis={mode==="view" ? activeItem?.analysis : null}
                dark={dark}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
