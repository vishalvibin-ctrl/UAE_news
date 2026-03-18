import { useState, useEffect, useCallback, useRef } from "react";

// ─── Feed URLs ───
const FEEDS = {
  finance: [
    "https://news.google.com/rss/search?q=UAE+banking+finance&hl=en-AE&gl=AE&ceid=AE:en",
    "https://news.google.com/rss/search?q=Dubai+stock+market+economy&hl=en-AE&gl=AE&ceid=AE:en",
  ],
  general: [
    "https://news.google.com/rss/search?q=UAE+news&hl=en-AE&gl=AE&ceid=AE:en",
    "https://news.google.com/rss/search?q=Dubai+Abu+Dhabi+news&hl=en-AE&gl=AE&ceid=AE:en",
  ],
};

const REEL_GRADIENTS = [
  "linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)",
  "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)",
  "linear-gradient(135deg, #232526 0%, #414345 100%)",
  "linear-gradient(135deg, #0D1B2A 0%, #1B2838 50%, #2D4059 100%)",
  "linear-gradient(135deg, #141E30 0%, #243B55 100%)",
  "linear-gradient(135deg, #1F1C2C 0%, #928DAB 100%)",
  "linear-gradient(135deg, #0B0C10 0%, #1F2833 50%, #2D3A4A 100%)",
  "linear-gradient(135deg, #2C3E50 0%, #3498DB 100%)",
  "linear-gradient(135deg, #0C0C1D 0%, #1A1A3E 50%, #2E2E5E 100%)",
  "linear-gradient(135deg, #1E3C72 0%, #2A5298 100%)",
  "linear-gradient(135deg, #0F0C29 0%, #302B63 50%, #24243E 100%)",
  "linear-gradient(135deg, #283048 0%, #859398 100%)",
  "linear-gradient(135deg, #16222A 0%, #3A6073 100%)",
  "linear-gradient(135deg, #1D1F20 0%, #3D4142 100%)",
  "linear-gradient(135deg, #2B5876 0%, #4E4376 100%)",
  "linear-gradient(135deg, #0D324D 0%, #7F5A83 100%)",
  "linear-gradient(135deg, #1A2980 0%, #26D0CE 100%)",
  "linear-gradient(135deg, #0B486B 0%, #F56217 100%)",
  "linear-gradient(135deg, #333333 0%, #0D0D0D 100%)",
  "linear-gradient(135deg, #1D2B64 0%, #F8CDDA 100%)",
];

// ─── Helpers ───
const timeAgo = (d) => {
  try {
    const s = Math.floor((new Date() - new Date(d)) / 1000);
    if (s < 0 || s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    if (s < 604800) return `${Math.floor(s/86400)}d ago`;
    return new Date(d).toLocaleDateString("en-AE",{month:"short",day:"numeric"});
  } catch { return ""; }
};

const cleanTitle = (t) => {
  if (!t) return "";
  if (t.includes(" - ")) { const p = t.split(" - "); p.pop(); return p.join(" - ").trim(); }
  return t.trim();
};

const extractSource = (title, source) => {
  if (source) return source;
  if (title?.includes(" - ")) { const p = title.split(" - "); return p[p.length-1].trim(); }
  return "News";
};

const srcColor = (s) => {
  const l = (s||"").toLowerCase();
  if (l.includes("gulf news")) return "#C41E3A";
  if (l.includes("khaleej")) return "#0066B3";
  if (l.includes("national")) return "#1A6B4A";
  if (l.includes("arabian")) return "#D4A843";
  if (l.includes("reuters")) return "#FF6600";
  if (l.includes("bloomberg")) return "#472A91";
  if (l.includes("cnbc")) return "#005594";
  if (l.includes("zawya")) return "#0A4DA2";
  if (l.includes("wam")) return "#006633";
  let h=0; for(let i=0;i<l.length;i++) h=l.charCodeAt(i)+((h<<5)-h);
  return `hsl(${Math.abs(h)%360},45%,55%)`;
};

// ─── Cache ───
const CACHE = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Fetch via own serverless API ───
const fetchFeed = async (feedUrl) => {
  const cacheKey = feedUrl;
  if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].ts < CACHE_TTL) {
    return CACHE[cacheKey].data;
  }

  // Try own API first (fast, no CORS)
  try {
    const res = await fetch(`/api/feed?url=${encodeURIComponent(feedUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok" && data.items?.length > 0) {
        const items = data.items.map(item => ({
          title: cleanTitle(item.title),
          description: (item.description || "").slice(0, 300),
          link: item.link,
          pubDate: item.pubDate,
          image: item.image || null,
          source: extractSource(item.title, item.source),
        }));
        CACHE[cacheKey] = { data: items, ts: Date.now() };
        return items;
      }
    }
  } catch (e) { console.warn("Own API failed, trying fallback:", e); }

  // Fallback: rss2json
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=20`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok" && data.items?.length > 0) {
        const items = data.items.map(item => ({
          title: cleanTitle((item.title||"").replace(/<[^>]*>/g,"")),
          description: (item.description||item.content||"").replace(/<[^>]*>/g,"").slice(0,300),
          link: item.link,
          pubDate: item.pubDate,
          image: item.thumbnail || null,
          source: extractSource(item.title, item.author),
        }));
        CACHE[cacheKey] = { data: items, ts: Date.now() };
        return items;
      }
    }
  } catch (e) { console.warn("rss2json fallback failed:", e); }

  return [];
};

const fetchAll = async (category) => {
  const results = await Promise.allSettled(FEEDS[category].map(fetchFeed));
  const all = results.filter(r=>r.status==="fulfilled").flatMap(r=>r.value).filter(i=>i.title?.length>10);
  const seen = new Set();
  const unique = all.filter(i => { const k=i.title.toLowerCase().slice(0,50); if(seen.has(k))return false; seen.add(k); return true; });
  unique.sort((a,b) => new Date(b.pubDate)-new Date(a.pubDate));
  return unique.slice(0,20);
};

// ─── REEL SLIDE ───
const ReelSlide = ({ item, index, total, gradient }) => {
  const [imgErr, setImgErr] = useState(false);
  const sc = srcColor(item.source);

  return (
    <div style={{
      height: "100dvh", width: "100%", scrollSnapAlign: "start",
      position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {item.image && !imgErr ? (
        <>
          <img src={item.image} alt="" onError={()=>setImgErr(true)}
            style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",filter:"blur(2px) brightness(0.3)",transform:"scale(1.1)" }}/>
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0.95) 100%)" }}/>
        </>
      ) : (
        <div style={{ position:"absolute",inset:0,background:gradient }}/>
      )}

      <div style={{
        position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",
        padding:"70px 24px 110px",
      }}>
        {/* Top bar */}
        <div style={{ position:"absolute",top:16,left:24,right:24,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ padding:"5px 12px",borderRadius:20,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(10px)",fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:500 }}>
            {index+1} / {total}
          </div>
          <div style={{ padding:"5px 12px",borderRadius:20,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(10px)",fontSize:11,color:"#C8A050",fontWeight:500 }}>
            {timeAgo(item.pubDate)}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position:"absolute",top:52,left:24,right:24,display:"flex",gap:3 }}>
          {Array.from({length:Math.min(total,20)},(_,i)=>(
            <div key={i} style={{ flex:1,height:2.5,borderRadius:2,background:i<index?"#C8A050":i===index?"rgba(200,160,80,0.7)":"rgba(255,255,255,0.15)",transition:"background 0.3s" }}/>
          ))}
        </div>

        {/* Source */}
        <div style={{ display:"inline-flex",alignItems:"center",gap:8,marginBottom:16,alignSelf:"flex-start" }}>
          <div style={{ width:8,height:8,borderRadius:"50%",background:sc,boxShadow:`0 0 12px ${sc}` }}/>
          <span style={{ fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600,letterSpacing:0.5 }}>{item.source}</span>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize:26,fontWeight:700,lineHeight:1.25,color:"#FFF",margin:"0 0 16px",
          fontFamily:"'Newsreader', Georgia, serif",letterSpacing:-0.3,
          textShadow:"0 2px 20px rgba(0,0,0,0.5)",
        }}>{item.title}</h2>

        {/* Description */}
        {item.description?.length > 20 && (
          <p style={{
            fontSize:15,lineHeight:1.55,color:"rgba(255,255,255,0.75)",margin:"0 0 20px",
            display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical",overflow:"hidden",
            textShadow:"0 1px 8px rgba(0,0,0,0.3)",
          }}>{item.description}</p>
        )}

        {/* CTA */}
        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{
          display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",borderRadius:28,
          background:"rgba(200,160,80,0.15)",border:"1px solid rgba(200,160,80,0.3)",
          backdropFilter:"blur(10px)",color:"#C8A050",fontSize:14,fontWeight:600,
          textDecoration:"none",alignSelf:"flex-start",
        }}>
          Read full article <span style={{fontSize:16}}>↗</span>
        </a>
      </div>

      {index===0 && (
        <div style={{ position:"absolute",bottom:55,left:"50%",transform:"translateX(-50%)",zIndex:3,textAlign:"center",animation:"bounce 2s ease infinite" }}>
          <div style={{fontSize:20,marginBottom:4}}>⌃</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:1.5,textTransform:"uppercase"}}>Swipe up</div>
        </div>
      )}
    </div>
  );
};

const ReelsView = ({ news, loading }) => {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const fin = news.finance || [], gen = news.general || [];
  const stories = [];
  const mx = Math.max(fin.length, gen.length);
  for (let i=0;i<mx;i++) { if(i<fin.length) stories.push(fin[i]); if(i<gen.length) stories.push(gen[i]); }
  const items = stories.slice(0,20);

  useEffect(()=>{
    const c=ref.current; if(!c)return;
    const h=()=>setIdx(Math.round(c.scrollTop/c.clientHeight));
    c.addEventListener("scroll",h,{passive:true});
    return ()=>c.removeEventListener("scroll",h);
  },[]);

  if(loading.finance&&loading.general) return (
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080C14",flexDirection:"column",gap:16}}>
      <div style={{fontSize:40,animation:"pulse 1.5s ease infinite"}}>📰</div>
      <div style={{color:"#5A6475",fontSize:14}}>Loading stories...</div>
    </div>
  );

  if(!items.length) return (
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080C14",flexDirection:"column",gap:16,padding:40}}>
      <div style={{fontSize:48}}>📡</div>
      <div style={{color:"#E8E4DC",fontSize:18,fontFamily:"'Newsreader',serif"}}>No stories yet</div>
      <div style={{color:"#5A6475",fontSize:13}}>Switch to a list tab or try again later</div>
    </div>
  );

  return (
    <div ref={ref} style={{ height:"100dvh",overflowY:"scroll",scrollSnapType:"y mandatory",WebkitOverflowScrolling:"touch" }}>
      {items.map((item,i)=>(
        <ReelSlide key={`r-${i}`} item={item} index={i} total={items.length} gradient={REEL_GRADIENTS[i%REEL_GRADIENTS.length]}/>
      ))}
    </div>
  );
};

// ─── NEWS CARD ───
const NewsCard = ({ item, index, category }) => {
  const [imgErr, setImgErr] = useState(false);
  const sc = srcColor(item.source);
  const hero = index===0;
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none",color:"inherit",animation:`slideUp 0.4s ease ${index*0.06}s both`}}>
      <div style={{
        background:hero?"linear-gradient(145deg,#1C2333 0%,#0F1724 100%)":"rgba(255,255,255,0.02)",
        border:hero?"1px solid rgba(200,160,80,0.15)":"1px solid rgba(255,255,255,0.05)",
        borderRadius:16,overflow:"hidden",marginBottom:14,
      }}>
        {item.image&&!imgErr?(
          <div style={{width:"100%",height:hero?200:160,overflow:"hidden",position:"relative"}}>
            <img src={item.image} alt="" onError={()=>setImgErr(true)} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,background:"linear-gradient(transparent,rgba(15,23,36,0.9))"}}/>
            <div style={{position:"absolute",top:12,left:12,padding:"4px 10px",borderRadius:8,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",fontSize:11,color:"#C8A050",letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>
              {category==="finance"?"📊 Finance":"🌍 UAE"}
            </div>
          </div>
        ):(
          <div style={{height:4,background:`linear-gradient(90deg,${sc},transparent)`}}/>
        )}
        <div style={{padding:"16px 18px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/>
              <span style={{fontSize:11,color:"#8B95A5",letterSpacing:0.5,fontWeight:500}}>{item.source}</span>
            </div>
            <span style={{fontSize:11,color:"#5A6475",flexShrink:0}}>{timeAgo(item.pubDate)}</span>
          </div>
          <h3 style={{fontSize:hero?19:16,fontWeight:600,lineHeight:1.35,color:"#E8E4DC",margin:0,marginBottom:item.description?.length>20?8:0,fontFamily:"'Newsreader','Georgia',serif",letterSpacing:-0.2}}>{item.title}</h3>
          {item.description?.length>20&&(
            <p style={{fontSize:13,lineHeight:1.5,color:"#7A8494",margin:0,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.description}</p>
          )}
          <div style={{marginTop:12,fontSize:12,color:"#C8A050",fontWeight:500,display:"flex",alignItems:"center",gap:4}}>
            Read full story <span style={{fontSize:14}}>↗</span>
          </div>
        </div>
      </div>
    </a>
  );
};

const Skeleton = ({hero})=>(
  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,overflow:"hidden",marginBottom:14,animation:"pulse 1.5s ease infinite"}}>
    {hero&&<div style={{width:"100%",height:200,background:"rgba(255,255,255,0.04)"}}/>}
    <div style={{padding:"16px 18px 18px"}}>
      <div style={{height:10,width:80,background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:12}}/>
      <div style={{height:16,width:"90%",background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:8}}/>
      <div style={{height:16,width:"65%",background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:8}}/>
      <div style={{height:12,width:"100%",background:"rgba(255,255,255,0.04)",borderRadius:4}}/>
    </div>
  </div>
);

// ─── MAIN APP ───
export default function App(){
  const [tab,setTab]=useState("reels");
  const [news,setNews]=useState({finance:[],general:[]});
  const [ld,setLd]=useState({finance:true,general:true});
  const [err,setErr]=useState({finance:null,general:null});
  const [lastR,setLastR]=useState(null);
  const [rfr,setRfr]=useState(false);
  const sr=useRef(null);

  const load=useCallback(async(cat)=>{
    setLd(p=>({...p,[cat]:true})); setErr(p=>({...p,[cat]:null}));
    try{
      const items=await fetchAll(cat);
      setNews(p=>({...p,[cat]:items}));
      if(!items.length) setErr(p=>({...p,[cat]:"No stories found."}));
      setLastR(new Date());
    }catch(e){ setErr(p=>({...p,[cat]:"Failed to load."})); }
    setLd(p=>({...p,[cat]:false}));
  },[]);

  useEffect(()=>{load("finance");load("general");},[load]);

  const refresh=async()=>{
    setRfr(true);
    // Clear cache on manual refresh
    Object.keys(CACHE).forEach(k=>delete CACHE[k]);
    if(tab==="reels") await Promise.all([load("finance"),load("general")]);
    else await load(tab);
    setRfr(false);
    if(sr.current) sr.current.scrollTop=0;
  };

  const cur=news[tab]||[];
  const isLd=ld[tab]||false;
  const isReels=tab==="reels";

  const TabBar=({floating})=>(
    <div style={{
      display:"flex",borderRadius:floating?16:12,
      background:floating?"rgba(20,24,36,0.88)":"rgba(255,255,255,0.03)",
      backdropFilter:floating?"blur(20px)":"none",
      border:floating?"1px solid rgba(255,255,255,0.06)":"none",
      padding:floating?4:3,
    }}>
      {[{id:"reels",label:"Reels",icon:"▶"},{id:"finance",label:"Finance",icon:"📊"},{id:"general",label:"UAE News",icon:"🌍"}].map(t=>(
        <button key={t.id} onClick={()=>{setTab(t.id);if(sr.current)sr.current.scrollTop=0;}} style={{
          flex:1,padding:"10px 0",background:tab===t.id?"rgba(200,160,80,0.12)":"transparent",
          border:"none",borderRadius:floating?12:10,cursor:"pointer",
          fontSize:12,fontWeight:tab===t.id?600:400,
          color:tab===t.id?"#C8A050":"#5A6475",
          fontFamily:"'Outfit',sans-serif",transition:"all 0.2s",
          display:"flex",alignItems:"center",justifyContent:"center",gap:4,
        }}><span style={{fontSize:floating?14:13}}>{t.icon}</span>{t.label}</button>
      ))}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#080C14",color:"#E8E4DC",fontFamily:"'Outfit',-apple-system,sans-serif",maxWidth:520,margin:"0 auto",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500;6..72,600;6..72,700&family=Outfit:wght@300;400;500;600;700&display=swap');
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:.3}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes bounce{0%,20%,50%,80%,100%{transform:translateX(-50%) translateY(0)}40%{transform:translateX(-50%) translateY(-8px)}60%{transform:translateX(-50%) translateY(-4px)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{margin:0;padding:0;background:#080C14;overscroll-behavior:none}
        ::-webkit-scrollbar{width:0}
      `}</style>

      {isReels?(
        <div style={{position:"relative"}}>
          <ReelsView news={news} loading={ld}/>
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:520,zIndex:200,background:"linear-gradient(transparent,rgba(0,0,0,0.9) 30%)",padding:"30px 16px 12px"}}>
            <TabBar floating/>
          </div>
        </div>
      ):(
        <div style={{background:"linear-gradient(180deg,#0C1220 0%,#0A0F1A 50%,#080C14 100%)",minHeight:"100vh"}}>
          <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(12,18,32,0.85)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.04)",padding:"16px 20px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#C8A050",fontWeight:500,marginBottom:2}}>UAE Daily</div>
                <h1 style={{fontSize:24,fontWeight:300,margin:0,fontFamily:"'Newsreader',Georgia,serif",color:"#E8E4DC",letterSpacing:-0.5}}>News Briefing</h1>
              </div>
              <button onClick={refresh} disabled={rfr} style={{width:36,height:36,borderRadius:"50%",background:"rgba(200,160,80,0.08)",border:"1px solid rgba(200,160,80,0.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#C8A050",animation:rfr?"spin 1s linear infinite":"none"}}>↻</button>
            </div>
            <TabBar/>
          </div>

          <div ref={sr} style={{padding:"16px 16px 100px",minHeight:"60vh"}}>
            <div style={{fontSize:12,color:"#5A6475",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16,padding:"0 4px"}}>
              {tab==="finance"?"Banking & Finance":"General News"} · {isLd?"Loading...":`${cur.length} stories`}
            </div>

            {isLd&&!cur.length&&<>{[1,0,0,0].map((h,i)=><Skeleton key={i} hero={h}/>)}</>}

            {!isLd&&!cur.length&&(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:16}}>📡</div>
                <div style={{fontSize:18,fontFamily:"'Newsreader',serif",color:"#E8E4DC",marginBottom:8}}>{err[tab]||"No stories loaded"}</div>
                <div style={{fontSize:13,color:"#5A6475",marginBottom:24}}>Tap refresh to try again.</div>
                <button onClick={refresh} style={{padding:"12px 32px",background:"#C8A050",color:"#0C1220",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"}}>Refresh</button>
              </div>
            )}

            {cur.map((item,i)=><NewsCard key={`${tab}-${i}`} item={item} index={i} category={tab}/>)}

            {!isLd&&cur.length>0&&<div style={{textAlign:"center",padding:"24px 0",color:"#3A4455",fontSize:12}}>— End of today's briefing —</div>}
          </div>
        </div>
      )}
    </div>
  );
}
