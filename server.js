const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

const BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

async function fetchJSON(url, options={}){
  const r = await fetch(url, {headers:{"User-Agent":"XAU-Fundamental-AI/1.0",...(options.headers||{})},...options});
  if(!r.ok) throw new Error(`Upstream ${r.status}`);
  return r.json();
}

function pct(v){ return v==null ? null : Number(v); }

async function getBLS(series){
  const body = {seriesid:series,startyear:String(new Date().getFullYear()-1),endyear:String(new Date().getFullYear())};
  const d = await fetchJSON(BLS_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const out={};
  for(const s of d.Results?.series||[]){
    const rows=s.data||[];
    out[s.seriesID]=rows.map(x=>({year:x.year,period:x.period,value:Number(x.value)}));
  }
  return out;
}

function latestYoY(rows){
  if(!rows?.length) return {yoy:null,latest:null};
  const monthly=rows.filter(x=>/^M(0[1-9]|1[0-2])$/.test(x.period));
  const a=monthly[0];
  if(!a) return {yoy:null,latest:null};
  const prev=monthly.find(x=>x.year===String(Number(a.year)-1) && x.period===a.period);
  return {yoy:prev?((a.value/prev.value-1)*100):null,latest:a};
}

async function macro(){
  const series = await getBLS(["CUUR0000SA0","CUUR0000SA0L1E","WPUFD4"]);
  return {
    cpi:latestYoY(series["CUUR0000SA0"]),
    coreCpi:latestYoY(series["CUUR0000SA0L1E"]),
    ppi:latestYoY(series["WPUFD4"])
  };
}

function scoreEngine(m){
  let score=0, reasons=[];
  const add=(n,r)=>{score+=n;reasons.push(r)};
  if(m.cpi?.yoy!=null){
    if(m.cpi.yoy>=3.5)add(-24,`CPI is ${m.cpi.yoy.toFixed(2)}%, keeping inflation pressure elevated.`);
    else if(m.cpi.yoy<=2.5)add(20,`CPI is ${m.cpi.yoy.toFixed(2)}%, supporting a softer inflation backdrop.`);
    else reasons.push(`CPI is ${m.cpi.yoy.toFixed(2)}%, giving a mixed inflation signal.`);
  }
  if(m.coreCpi?.yoy!=null){
    if(m.coreCpi.yoy>=3.5)add(-24,`Core CPI is ${m.coreCpi.yoy.toFixed(2)}%, a persistent inflation risk.`);
    else if(m.coreCpi.yoy<=2.5)add(20,`Core CPI is ${m.coreCpi.yoy.toFixed(2)}%, reducing inflation pressure.`);
    else reasons.push(`Core CPI is ${m.coreCpi.yoy.toFixed(2)}%, still above a very low-inflation regime.`);
  }
  if(m.ppi?.yoy!=null){
    if(m.ppi.yoy>=4)add(-14,`PPI is ${m.ppi.yoy.toFixed(2)}%, adding upstream price pressure.`);
    else if(m.ppi.yoy<=2)add(12,`PPI is ${m.ppi.yoy.toFixed(2)}%, consistent with softer producer inflation.`);
    else reasons.push(`PPI is ${m.ppi.yoy.toFixed(2)}%, a moderate signal.`);
  }
  score=Math.max(-100,Math.min(100,Math.round(score)));
  let direction=score>=15?"BUY":score<=-15?"SELL":"NEUTRAL";
  let confidence=Math.min(95,Math.max(50,Math.round(50+Math.abs(score)*0.42)));
  return {direction,score,confidence,reasons};
}

async function getNews(){
  const q=encodeURIComponent('(gold OR XAU OR inflation OR CPI OR Federal Reserve OR FOMC OR Treasury yields OR dollar)');
  const url=`${GDELT_URL}?query=${q}&mode=artlist&format=json&maxrecords=20&sort=datedesc&timespan=7d`;
  const d=await fetchJSON(url);
  return (d.articles||[]).map(a=>({title:a.title,url:a.url,domain:a.domain,date:a.seendate}));
}

function scenario(body){
  const vals=[body.cpi,body.coreCpi,body.ppi];
  let s=0,reasons=[];
  for(const x of vals){
    if(!x) continue;
    if(x.actual!=null && x.forecast!=null){
      const surprise=x.actual-x.forecast;
      if(surprise>0.15){s-=15;reasons.push(`Actual ${x.actual} came above forecast ${x.forecast}, a hawkish inflation surprise.`)}
      if(surprise<-0.15){s+=15;reasons.push(`Actual ${x.actual} came below forecast ${x.forecast}, a dovish inflation surprise.`)}
    }
    if(x.actual!=null && x.previous!=null){
      const change=x.actual-x.previous;
      if(change>0.15){s-=8;reasons.push(`The release increased versus the previous reading (${x.previous}).`)}
      if(change<-0.15){s+=8;reasons.push(`The release decreased versus the previous reading (${x.previous}).`)}
    }
  }
  if(body.fedTone==="hawkish"){s-=20;reasons.push("Hawkish Fed tone increases expected policy restrictiveness.")}
  if(body.fedTone==="dovish"){s+=20;reasons.push("Dovish Fed tone reduces expected policy restrictiveness.")}
  s=Math.max(-100,Math.min(100,Math.round(s)));
  const direction=s>=15?"BUY":s<=-15?"SELL":"NEUTRAL";
  const confidence=Math.min(95,Math.max(50,Math.round(50+Math.abs(s)*.45)));
  return {direction,score:s,confidence,reasons,interpretation:direction==="BUY"?"The scenario is fundamentally supportive for gold through softer inflation and/or easier policy expectations.":direction==="SELL"?"The scenario is fundamentally negative for gold through hotter inflation and/or tighter policy expectations.":"The scenario is mixed and does not produce a strong fundamental directional edge."};
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"xau-fundamental-ai",time:new Date().toISOString()}));

app.get("/api/macro",async(req,res)=>{
  try{res.json(await macro())}catch(e){res.status(502).json({error:"Macro provider unavailable",detail:e.message})}
});

app.get("/api/bias",async(req,res)=>{
  try{
    const m=await macro(), r=scoreEngine(m);
    res.json({instrument:"XAUUSD",mode:"fundamental",...r,macro:m,interpretation:r.direction==="BUY"?"The current inflation profile is relatively supportive of gold through lower expected policy pressure.":r.direction==="SELL"?"The current inflation profile is relatively negative for gold because persistent inflation can keep policy restrictive.":"Current inflation signals are mixed, so the model does not have a strong fundamental edge."});
  }catch(e){res.status(502).json({error:"Bias engine unavailable",detail:e.message})}
});

app.get("/api/news",async(req,res)=>{
  try{res.json({articles:await getNews()})}catch(e){res.status(502).json({error:"News provider unavailable",detail:e.message})}
});

app.get("/api/calendar",async(req,res)=>{
  const month=String(req.query.month||"").match(/^\d{4}-\d{2}$/)?.[0]||new Date().toISOString().slice(0,7);
  res.json({month,events:[],note:"Configure CALENDAR_API_URL and CALENDAR_API_KEY for a live provider with forecast/actual/previous values."});
});

app.post("/api/bias/scenario",(req,res)=>{
  try{res.json(scenario(req.body||{}))}catch(e){res.status(400).json({error:"Invalid scenario",detail:e.message})}
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`XAU Fundamental AI running on port ${PORT}`));
