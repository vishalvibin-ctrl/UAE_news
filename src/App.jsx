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
  security: [
    "https://news.google.com/rss/search?q=UAE+security+defense+military&hl=en-AE&gl=AE&ceid=AE:en",
    "https://news.google.com/rss/search?q=UAE+MOI+ministry+interior+safety&hl=en-AE&gl=AE&ceid=AE:en",
    "https://news.google.com/rss/search?q=Middle+East+war+conflict+Iran+UAE&hl=en-AE&gl=AE&ceid=AE:en",
  ],
};

const GRADIENTS = [
  "linear-gradient(135deg,#0F2027,#203A43,#2C5364)","linear-gradient(135deg,#1A1A2E,#16213E,#0F3460)",
  "linear-gradient(135deg,#232526,#414345)","linear-gradient(135deg,#0D1B2A,#1B2838,#2D4059)",
  "linear-gradient(135deg,#141E30,#243B55)","linear-gradient(135deg,#1F1C2C,#928DAB)",
  "linear-gradient(135deg,#0B0C10,#1F2833,#2D3A4A)","linear-gradient(135deg,#2C3E50,#3498DB)",
  "linear-gradient(135deg,#0C0C1D,#1A1A3E,#2E2E5E)","linear-gradient(135deg,#1E3C72,#2A5298)",
  "linear-gradient(135deg,#0F0C29,#302B63,#24243E)","linear-gradient(135deg,#283048,#859398)",
  "linear-gradient(135deg,#16222A,#3A6073)","linear-gradient(135deg,#2B5876,#4E4376)",
  "linear-gradient(135deg,#0D324D,#7F5A83)","linear-gradient(135deg,#1A2980,#26D0CE)",
  "linear-gradient(135deg,#0B486B,#F56217)","linear-gradient(135deg,#333333,#0D0D0D)",
  "linear-gradient(135deg,#1D2B64,#F8CDDA)","linear-gradient(135deg,#1D1F20,#3D4142)",
];

// ─── Helpers ───
const timeAgo=(d)=>{try{const s=Math.floor((new Date()-new Date(d))/1000);if(s<0||s<60)return"just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;if(s<604800)return`${Math.floor(s/86400)}d ago`;return new Date(d).toLocaleDateString("en-AE",{month:"short",day:"numeric"});}catch{return"";}};

// Robust HTML + entity cleaning
const cleanText = (str) => {
  if (!str) return "";
  // First decode HTML entities
  let t = str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/").replace(/&apos;/g, "'");
  // Strip all HTML tags
  t = t.replace(/<[^>]*>/g, "");
  // Clean up whitespace
  t = t.replace(/\s+/g, " ").trim();
  // Remove any remaining raw URLs that look ugly
  t = t.replace(/https?:\/\/\S+/g, "").trim();
  return t;
};

const cleanTitle=(t)=>{
  if(!t)return"";
  let c=cleanText(t);
  if(c.includes(" - ")){const p=c.split(" - ");p.pop();return p.join(" - ").trim();}
  return c.trim();
};
const extractSource=(title,source)=>{if(source)return cleanText(source);const raw=cleanText(title);if(raw?.includes(" - ")){const p=raw.split(" - ");return p[p.length-1].trim();}return"News";};
const srcColor=(s)=>{const l=(s||"").toLowerCase();if(l.includes("gulf news"))return"#C41E3A";if(l.includes("khaleej"))return"#0066B3";if(l.includes("national"))return"#1A6B4A";if(l.includes("arabian"))return"#D4A843";if(l.includes("reuters"))return"#FF6600";if(l.includes("bloomberg"))return"#472A91";if(l.includes("cnbc"))return"#005594";if(l.includes("zawya"))return"#0A4DA2";if(l.includes("wam"))return"#006633";let h=0;for(let i=0;i<l.length;i++)h=l.charCodeAt(i)+((h<<5)-h);return`hsl(${Math.abs(h)%360},45%,55%)`;};

// ─── Cache + Fetch ───
const CACHE={};const CACHE_TTL=5*60*1000;

const fetchFeed=async(feedUrl)=>{
  const ck=feedUrl;
  if(CACHE[ck]&&Date.now()-CACHE[ck].ts<CACHE_TTL)return CACHE[ck].data;
  try{
    const res=await fetch(`/api/feed?url=${encodeURIComponent(feedUrl)}`);
    if(res.ok){const data=await res.json();if(data.status==="ok"&&data.items?.length>0){
      const items=data.items.map(item=>({
        title:cleanTitle(item.title),
        description:cleanText(item.description||"").slice(0,300),
        link:item.link,pubDate:item.pubDate,image:item.image||null,
        source:extractSource(item.title,item.source),
      }));
      CACHE[ck]={data:items,ts:Date.now()};return items;
    }}
  }catch(e){console.warn("API failed:",e);}
  try{
    const res=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=20`);
    if(res.ok){const data=await res.json();if(data.status==="ok"&&data.items?.length>0){
      const items=data.items.map(item=>({
        title:cleanTitle(item.title||""),
        description:cleanText(item.description||item.content||"").slice(0,300),
        link:item.link,pubDate:item.pubDate,image:item.thumbnail||null,
        source:extractSource(item.title,item.author),
      }));
      CACHE[ck]={data:items,ts:Date.now()};return items;
    }}
  }catch(e){console.warn("rss2json failed:",e);}
  return[];
};

const fetchAll=async(cat)=>{
  const results=await Promise.allSettled(FEEDS[cat].map(fetchFeed));
  const all=results.filter(r=>r.status==="fulfilled").flatMap(r=>r.value).filter(i=>i.title?.length>10);
  const seen=new Set();
  const unique=all.filter(i=>{const k=i.title.toLowerCase().slice(0,50);if(seen.has(k))return false;seen.add(k);return true;});
  unique.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
  return unique.slice(0,20);
};

// ═══════════════════════════════════════════
// SECURITY TAB COMPONENTS
// ═══════════════════════════════════════════

const ThreatGauge=({newsCount})=>{
  const level=newsCount>=15?4:newsCount>=10?3:newsCount>=5?2:1;
  const labels=["","LOW","GUARDED","ELEVATED","HIGH"];
  const colors=["","#4CAF50","#FFC107","#FF9800","#F44336"];
  const descs=["","Situation is stable. No immediate threats reported.","Some regional activity. Standard precautions advised.","Increased regional tensions. Stay informed and vigilant.","Significant conflict activity. Monitor official channels closely."];
  const segs=20;const filled=Math.round((level/4)*segs);
  return(
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 20px",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:"#8B95A5",fontWeight:500}}>Regional Threat Level</div>
        <div style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:700,letterSpacing:1,background:`${colors[level]}20`,color:colors[level],border:`1px solid ${colors[level]}40`}}>{labels[level]}</div>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:12}}>
        {Array.from({length:segs},(_,i)=><div key={i} style={{flex:1,height:8,borderRadius:4,background:i<filled?colors[level]:"rgba(255,255,255,0.06)",opacity:i<filled?(0.5+(i/filled)*0.5):1,transition:"all 0.5s"}}/>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
        {["Low","Guarded","Elevated","High"].map((l,i)=><span key={l} style={{fontSize:9,color:i+1===level?colors[level]:"#3A4455",letterSpacing:0.5,textTransform:"uppercase",fontWeight:i+1===level?700:400}}>{l}</span>)}
      </div>
      <p style={{fontSize:13,lineHeight:1.5,color:"#7A8494",margin:0}}>{descs[level]}</p>
    </div>
  );
};

// Topic Breakdown — categorize security news by keywords
const TopicBreakdown=({news})=>{
  const topics={
    "Military & Defense":{keywords:["military","defense","army","navy","air force","armed"],color:"#F44336",count:0},
    "MOI & Public Safety":{keywords:["moi","ministry","interior","police","safety","civil defense"],color:"#FF9800",count:0},
    "Regional Conflict":{keywords:["war","conflict","iran","strike","missile","attack","houthi"],color:"#E91E63",count:0},
    "Diplomacy & Peace":{keywords:["peace","diplomacy","ceasefire","talks","negotiate","treaty"],color:"#4CAF50",count:0},
    "Cyber & Intel":{keywords:["cyber","intelligence","espionage","hack","surveillance"],color:"#2196F3",count:0},
    "Other Security":{keywords:[],color:"#9E9E9E",count:0},
  };
  (news||[]).forEach(item=>{
    const txt=(item.title+" "+item.description).toLowerCase();
    let matched=false;
    for(const[,topic] of Object.entries(topics)){
      if(topic.keywords.some(k=>txt.includes(k))){topic.count++;matched=true;break;}
    }
    if(!matched)topics["Other Security"].count++;
  });
  const entries=Object.entries(topics).filter(([,v])=>v.count>0).sort((a,b)=>b[1].count-a[1].count);
  const total=entries.reduce((s,[,v])=>s+v.count,0)||1;
  if(!entries.length)return null;

  return(
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 20px",marginBottom:16}}>
      <div style={{fontSize:13,color:"#8B95A5",fontWeight:500,marginBottom:16}}>Topic Breakdown</div>
      {/* Stacked bar */}
      <div style={{display:"flex",height:12,borderRadius:6,overflow:"hidden",marginBottom:16}}>
        {entries.map(([name,v])=>(
          <div key={name} style={{width:`${(v.count/total)*100}%`,background:v.color,transition:"width 0.5s"}} title={name}/>
        ))}
      </div>
      {/* Legend */}
      <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
        {entries.map(([name,v])=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:2,background:v.color,flexShrink:0}}/>
            <span style={{fontSize:11,color:"#8B95A5"}}>{name}</span>
            <span style={{fontSize:11,color:"#5A6475",fontWeight:600}}>{v.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Key Regions Impact
const RegionImpact=({news})=>{
  const regions=[
    {name:"Abu Dhabi",keywords:["abu dhabi","adnoc","musaffah"],icon:"🏛"},
    {name:"Dubai",keywords:["dubai","jebel ali","dxb"],icon:"🏙"},
    {name:"Strait of Hormuz",keywords:["hormuz","strait","shipping","naval"],icon:"🚢"},
    {name:"Iran Border",keywords:["iran","tehran","persian gulf"],icon:"⚠️"},
    {name:"Yemen / Houthi",keywords:["yemen","houthi","aden","sanaa"],icon:"🎯"},
    {name:"Saudi Border",keywords:["saudi","riyadh","gcc"],icon:"🤝"},
  ];
  regions.forEach(r=>{
    r.mentions=0;
    (news||[]).forEach(item=>{
      const txt=(item.title+" "+item.description).toLowerCase();
      if(r.keywords.some(k=>txt.includes(k)))r.mentions++;
    });
  });
  const active=regions.filter(r=>r.mentions>0).sort((a,b)=>b.mentions-a.mentions);
  if(!active.length)return null;

  return(
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 20px",marginBottom:16}}>
      <div style={{fontSize:13,color:"#8B95A5",fontWeight:500,marginBottom:16}}>Key Regions in Coverage</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {active.map(r=>(
          <div key={r.name} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:24,flexShrink:0}}>{r.icon}</div>
            <div>
              <div style={{fontSize:13,color:"#E8E4DC",fontWeight:600}}>{r.name}</div>
              <div style={{fontSize:11,color:"#5A6475"}}>{r.mentions} mention{r.mentions!==1?"s":""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Source Coverage Bar Chart
const StoryChart=({news})=>{
  const counts={};(news||[]).forEach(i=>{const s=i.source||"Other";counts[s]=(counts[s]||0)+1;});
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max=sorted.length?sorted[0][1]:1;
  if(!sorted.length)return null;
  return(
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 20px",marginBottom:16}}>
      <div style={{fontSize:13,color:"#8B95A5",fontWeight:500,marginBottom:16}}>Coverage by Source</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {sorted.map(([src,cnt])=>(
          <div key={src}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,color:"#8B95A5",fontWeight:500}}>{src}</span>
              <span style={{fontSize:12,color:"#5A6475"}}>{cnt}</span>
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:3,width:`${(cnt/max)*100}%`,background:`linear-gradient(90deg,${srcColor(src)},${srcColor(src)}88)`,transition:"width 0.6s"}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Hourly Activity — when were stories published
const HourlyActivity=({news})=>{
  const hours=Array(24).fill(0);
  (news||[]).forEach(item=>{
    try{const h=new Date(item.pubDate).getHours();hours[h]++;}catch{}
  });
  const max=Math.max(...hours,1);
  if(!hours.some(h=>h>0))return null;
  return(
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"24px 20px",marginBottom:16}}>
      <div style={{fontSize:13,color:"#8B95A5",fontWeight:500,marginBottom:16}}>Hourly News Activity (UTC)</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:2,height:60}}>
        {hours.map((count,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{
              width:"100%",borderRadius:3,
              height:count>0?`${Math.max((count/max)*50,4)}px`:"2px",
              background:count>0?"linear-gradient(180deg,#F44336,#F4433666)":"rgba(255,255,255,0.04)",
              transition:"height 0.4s",
            }}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
        {[0,6,12,18,23].map(h=><span key={h} style={{fontSize:9,color:"#3A4455"}}>{h}:00</span>)}
      </div>
    </div>
  );
};

// Timeline
const Timeline=({items})=>{
  if(!items?.length)return null;
  return(
    <div style={{position:"relative",paddingLeft:20,marginBottom:20}}>
      <div style={{position:"absolute",left:5,top:8,bottom:8,width:2,background:"rgba(244,67,54,0.15)",borderRadius:1}}/>
      {items.slice(0,10).map((item,i)=>(
        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none",color:"inherit",position:"relative",paddingBottom:20,animation:`slideUp 0.4s ease ${i*0.05}s both`}}>
          <div style={{position:"absolute",left:-18,top:6,width:10,height:10,borderRadius:"50%",background:i===0?"#F44336":"rgba(244,67,54,0.3)",boxShadow:i===0?"0 0 10px rgba(244,67,54,0.4)":"none",border:"2px solid #0C1220"}}/>
          <div style={{fontSize:11,color:"#5A6475",marginBottom:4}}>{timeAgo(item.pubDate)}</div>
          <div style={{fontSize:15,fontWeight:600,lineHeight:1.35,color:"#E8E4DC",fontFamily:"'Newsreader',Georgia,serif",marginBottom:4}}>{item.title}</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:srcColor(item.source)}}/>
            <span style={{fontSize:11,color:"#8B95A5"}}>{item.source}</span>
          </div>
        </a>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// REEL SLIDE
// ═══════════════════════════════════════════

const ReelSlide=({item,index,total,gradient})=>{
  const[imgErr,setImgErr]=useState(false);
  const sc=srcColor(item.source);
  return(
    <div style={{height:"100dvh",width:"100%",scrollSnapAlign:"start",position:"relative",overflow:"hidden"}}>
      {item.image&&!imgErr?(
        <>
          <img src={item.image} alt="" onError={()=>setImgErr(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",filter:"blur(2px) brightness(0.3)",transform:"scale(1.1)"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(0,0,0,0.5) 0%,rgba(0,0,0,0.15) 40%,rgba(0,0,0,0.6) 70%,rgba(0,0,0,0.95) 100%)"}}/>
        </>
      ):(<div style={{position:"absolute",inset:0,background:gradient}}/>)}

      {/* Progress bar */}
      <div style={{position:"absolute",top:12,left:20,right:20,zIndex:10,display:"flex",gap:3}}>
        {Array.from({length:Math.min(total,20)},(_,i)=>(
          <div key={i} style={{flex:1,height:2.5,borderRadius:2,background:i<index?"#C8A050":i===index?"rgba(200,160,80,0.7)":"rgba(255,255,255,0.15)",transition:"background 0.3s"}}/>
        ))}
      </div>

      {/* Counter + time */}
      <div style={{position:"absolute",top:24,left:20,right:20,zIndex:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{padding:"4px 12px",borderRadius:20,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(10px)",fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:500}}>{index+1} / {total}</div>
        <div style={{padding:"4px 12px",borderRadius:20,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(10px)",fontSize:11,color:"#C8A050",fontWeight:500}}>{timeAgo(item.pubDate)}</div>
      </div>

      {/* Content — starts near top */}
      <div style={{position:"absolute",top:70,left:0,right:0,bottom:80,zIndex:5,display:"flex",flexDirection:"column",justifyContent:"flex-start",padding:"20px 24px 0",overflow:"hidden"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:14,alignSelf:"flex-start"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:sc,boxShadow:`0 0 12px ${sc}`}}/>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600,letterSpacing:0.5}}>{item.source}</span>
        </div>
        <h2 style={{fontSize:28,fontWeight:700,lineHeight:1.22,color:"#FFF",margin:"0 0 18px",fontFamily:"'Newsreader',Georgia,serif",letterSpacing:-0.3,textShadow:"0 2px 20px rgba(0,0,0,0.5)"}}>{item.title}</h2>
        <div style={{width:40,height:3,borderRadius:2,background:"rgba(200,160,80,0.4)",marginBottom:18}}/>
        {item.description?.length>20&&(
          <p style={{fontSize:15,lineHeight:1.6,color:"rgba(255,255,255,0.7)",margin:"0 0 24px",display:"-webkit-box",WebkitLineClamp:5,WebkitBoxOrient:"vertical",overflow:"hidden",textShadow:"0 1px 8px rgba(0,0,0,0.3)"}}>{item.description}</p>
        )}
        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",borderRadius:28,background:"rgba(200,160,80,0.15)",border:"1px solid rgba(200,160,80,0.3)",backdropFilter:"blur(10px)",color:"#C8A050",fontSize:14,fontWeight:600,textDecoration:"none",alignSelf:"flex-start"}}>
          Read full article <span style={{fontSize:16}}>↗</span>
        </a>
      </div>

      {index===0&&(
        <div style={{position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",zIndex:10,textAlign:"center",animation:"bounce 2s ease infinite"}}>
          <div style={{fontSize:20,marginBottom:2}}>⌃</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1.5,textTransform:"uppercase"}}>Swipe up</div>
        </div>
      )}
    </div>
  );
};

const ReelsView=({news,loading})=>{
  const ref=useRef(null);
  const fin=news.finance||[],gen=news.general||[];
  const stories=[];const mx=Math.max(fin.length,gen.length);
  for(let i=0;i<mx;i++){if(i<fin.length)stories.push(fin[i]);if(i<gen.length)stories.push(gen[i]);}
  const items=stories.slice(0,20);

  if(loading.finance&&loading.general)return(
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080C14",flexDirection:"column",gap:16}}>
      <div style={{fontSize:40,animation:"pulse 1.5s ease infinite"}}>📰</div>
      <div style={{color:"#5A6475",fontSize:14}}>Loading stories...</div>
    </div>
  );
  if(!items.length)return(
    <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080C14",flexDirection:"column",gap:16,padding:40}}>
      <div style={{fontSize:48}}>📡</div>
      <div style={{color:"#E8E4DC",fontSize:18,fontFamily:"'Newsreader',serif"}}>No stories yet</div>
    </div>
  );
  return(
    <div ref={ref} style={{height:"100dvh",overflowY:"scroll",scrollSnapType:"y mandatory",WebkitOverflowScrolling:"touch"}}>
      {items.map((item,i)=><ReelSlide key={`r-${i}`} item={item} index={i} total={items.length} gradient={GRADIENTS[i%GRADIENTS.length]}/>)}
    </div>
  );
};

// ═══════════════════════════════════════════
// NEWS CARD
// ═══════════════════════════════════════════

const NewsCard=({item,index,category})=>{
  const[imgErr,setImgErr]=useState(false);
  const sc=srcColor(item.source);const hero=index===0;
  const catLabel={finance:"📊 Finance",general:"🌍 UAE",security:"🛡 Security"}[category]||"🌍 UAE";
  const accent=category==="security"?"#F44336":"#C8A050";
  return(
    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none",color:"inherit",animation:`slideUp 0.4s ease ${index*0.06}s both`}}>
      <div style={{background:hero?"linear-gradient(145deg,#1C2333,#0F1724)":"rgba(255,255,255,0.02)",border:hero?`1px solid ${accent}25`:"1px solid rgba(255,255,255,0.05)",borderRadius:16,overflow:"hidden",marginBottom:14}}>
        {item.image&&!imgErr?(
          <div style={{width:"100%",height:hero?200:160,overflow:"hidden",position:"relative"}}>
            <img src={item.image} alt="" onError={()=>setImgErr(true)} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,background:"linear-gradient(transparent,rgba(15,23,36,0.9))"}}/>
            <div style={{position:"absolute",top:12,left:12,padding:"4px 10px",borderRadius:8,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",fontSize:11,color:accent,letterSpacing:1,textTransform:"uppercase",fontWeight:600}}>{catLabel}</div>
          </div>
        ):(<div style={{height:4,background:`linear-gradient(90deg,${sc},transparent)`}}/>)}
        <div style={{padding:"16px 18px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/><span style={{fontSize:11,color:"#8B95A5",letterSpacing:0.5,fontWeight:500}}>{item.source}</span></div>
            <span style={{fontSize:11,color:"#5A6475",flexShrink:0}}>{timeAgo(item.pubDate)}</span>
          </div>
          <h3 style={{fontSize:hero?19:16,fontWeight:600,lineHeight:1.35,color:"#E8E4DC",margin:0,marginBottom:item.description?.length>20?8:0,fontFamily:"'Newsreader','Georgia',serif",letterSpacing:-0.2}}>{item.title}</h3>
          {item.description?.length>20&&<p style={{fontSize:13,lineHeight:1.5,color:"#7A8494",margin:0,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.description}</p>}
          <div style={{marginTop:12,fontSize:12,color:accent,fontWeight:500,display:"flex",alignItems:"center",gap:4}}>Read full story <span style={{fontSize:14}}>↗</span></div>
        </div>
      </div>
    </a>
  );
};

const Skeleton=({hero})=>(<div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,overflow:"hidden",marginBottom:14,animation:"pulse 1.5s ease infinite"}}>{hero&&<div style={{width:"100%",height:200,background:"rgba(255,255,255,0.04)"}}/>}<div style={{padding:"16px 18px 18px"}}><div style={{height:10,width:80,background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:12}}/><div style={{height:16,width:"90%",background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:8}}/><div style={{height:16,width:"65%",background:"rgba(255,255,255,0.06)",borderRadius:4}}/></div></div>);

// ═══════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════

const TABS=[{id:"reels",label:"Reels",icon:"▶"},{id:"finance",label:"Finance",icon:"📊"},{id:"general",label:"UAE",icon:"🌍"},{id:"security",label:"Security",icon:"🛡"}];

const TabBar=({tab,setTab,floating,sr})=>(
  <div style={{display:"flex",gap:3,borderRadius:floating?16:12,background:floating?"rgba(20,24,36,0.9)":"rgba(255,255,255,0.03)",backdropFilter:floating?"blur(20px)":"none",border:floating?"1px solid rgba(255,255,255,0.06)":"none",padding:4}}>
    {TABS.map(t=>{
      const active=tab===t.id;const isRed=t.id==="security"&&active;
      return(
        <button key={t.id} onClick={()=>{setTab(t.id);if(sr?.current)sr.current.scrollTop=0;}} style={{
          flex:1,padding:floating?"10px 2px":"10px 2px",background:active?(isRed?"rgba(244,67,54,0.12)":"rgba(200,160,80,0.12)"):"transparent",
          border:"none",borderRadius:floating?12:10,cursor:"pointer",fontSize:11,fontWeight:active?600:400,
          color:active?(isRed?"#F44336":"#C8A050"):"#5A6475",fontFamily:"'Outfit',sans-serif",transition:"all 0.2s",
          display:"flex",alignItems:"center",justifyContent:"center",gap:3,whiteSpace:"nowrap",
        }}>
          <span style={{fontSize:12}}>{t.icon}</span>{t.label}
        </button>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════

export default function App(){
  const[tab,setTab]=useState("reels");
  const[news,setNews]=useState({finance:[],general:[],security:[]});
  const[ld,setLd]=useState({finance:true,general:true,security:true});
  const[err,setErr]=useState({finance:null,general:null,security:null});
  const[rfr,setRfr]=useState(false);
  const sr=useRef(null);

  const load=useCallback(async(cat)=>{
    setLd(p=>({...p,[cat]:true}));setErr(p=>({...p,[cat]:null}));
    try{const items=await fetchAll(cat);setNews(p=>({...p,[cat]:items}));if(!items.length)setErr(p=>({...p,[cat]:"No stories found."}));}
    catch(e){setErr(p=>({...p,[cat]:"Failed to load."}));}
    setLd(p=>({...p,[cat]:false}));
  },[]);

  useEffect(()=>{load("finance");load("general");load("security");},[load]);

  const refresh=async()=>{
    setRfr(true);Object.keys(CACHE).forEach(k=>delete CACHE[k]);
    if(tab==="reels")await Promise.all([load("finance"),load("general")]);
    else await load(tab);
    setRfr(false);if(sr.current)sr.current.scrollTop=0;
  };

  const cur=news[tab]||[];const isLd=ld[tab]||false;
  const isReels=tab==="reels";const isSec=tab==="security";
  const secLabel={finance:"Banking & Finance",general:"General News",security:"Security & Defense"};

  return(
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
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:520,zIndex:200,background:"linear-gradient(transparent,rgba(0,0,0,0.9) 40%)",padding:"40px 12px 10px"}}>
            <TabBar tab={tab} setTab={setTab} floating sr={sr}/>
          </div>
        </div>
      ):(
        <div style={{background:"linear-gradient(180deg,#0C1220 0%,#0A0F1A 50%,#080C14 100%)",minHeight:"100vh"}}>
          <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(12,18,32,0.88)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.04)",padding:"14px 20px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#C8A050",fontWeight:500,marginBottom:2}}>News Briefing — Vishal</div>
                <h1 style={{fontSize:22,fontWeight:300,margin:0,fontFamily:"'Newsreader',Georgia,serif",color:"#E8E4DC",letterSpacing:-0.5}}>UAE Daily</h1>
              </div>
              <button onClick={refresh} disabled={rfr} style={{width:36,height:36,borderRadius:"50%",background:"rgba(200,160,80,0.08)",border:"1px solid rgba(200,160,80,0.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#C8A050",animation:rfr?"spin 1s linear infinite":"none"}}>↻</button>
            </div>
            <TabBar tab={tab} setTab={setTab} sr={sr}/>
          </div>

          <div ref={sr} style={{padding:"16px 16px 80px",minHeight:"60vh"}}>
            {isSec?(
              <>
                <div style={{fontSize:12,color:"#5A6475",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16,padding:"0 4px"}}>
                  Security & Defense · {isLd?"Loading...":`${cur.length} updates`}
                </div>
                {isLd&&!cur.length&&<>{[1,0,0,0].map((h,i)=><Skeleton key={i} hero={h}/>)}</>}
                {!isLd&&cur.length>0&&(
                  <>
                    <ThreatGauge newsCount={cur.length}/>
                    <TopicBreakdown news={cur}/>
                    <RegionImpact news={cur}/>
                    <StoryChart news={cur}/>
                    <HourlyActivity news={cur}/>
                    <div style={{fontSize:13,color:"#8B95A5",fontWeight:500,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:"#F44336"}}>●</span> Latest Updates Timeline
                    </div>
                    <Timeline items={cur}/>
                  </>
                )}
                {!isLd&&!cur.length&&(
                  <div style={{textAlign:"center",padding:"60px 20px"}}>
                    <div style={{fontSize:48,marginBottom:16}}>🛡</div>
                    <div style={{fontSize:18,fontFamily:"'Newsreader',serif",color:"#E8E4DC",marginBottom:8}}>{err.security||"No security updates"}</div>
                    <button onClick={refresh} style={{padding:"12px 32px",background:"#F44336",color:"#FFF",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",marginTop:16}}>Refresh</button>
                  </div>
                )}
              </>
            ):(
              <>
                <div style={{fontSize:12,color:"#5A6475",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16,padding:"0 4px"}}>
                  {secLabel[tab]} · {isLd?"Loading...":`${cur.length} stories`}
                </div>
                {isLd&&!cur.length&&<>{[1,0,0,0].map((h,i)=><Skeleton key={i} hero={h}/>)}</>}
                {!isLd&&!cur.length&&(
                  <div style={{textAlign:"center",padding:"60px 20px"}}>
                    <div style={{fontSize:48,marginBottom:16}}>📡</div>
                    <div style={{fontSize:18,fontFamily:"'Newsreader',serif",color:"#E8E4DC",marginBottom:8}}>{err[tab]||"No stories loaded"}</div>
                    <button onClick={refresh} style={{padding:"12px 32px",background:"#C8A050",color:"#0C1220",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",marginTop:16}}>Refresh</button>
                  </div>
                )}
                {cur.map((item,i)=><NewsCard key={`${tab}-${i}`} item={item} index={i} category={tab}/>)}
                {!isLd&&cur.length>0&&<div style={{textAlign:"center",padding:"24px 0",color:"#3A4455",fontSize:12}}>— End of today's briefing —</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
