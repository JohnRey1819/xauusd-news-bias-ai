import express from 'express';
import { XMLParser } from 'fast-xml-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;
const CAL_URL = process.env.CALENDAR_URL || 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const usdEvents = new Set(['CPI m/m','Core CPI m/m','PPI m/m','Core PPI m/m','Non-Farm Employment Change','Unemployment Rate','Average Hourly Earnings m/m','GDP q/q','Retail Sales m/m','Core Retail Sales m/m','ISM Manufacturing PMI','ISM Services PMI','CB Consumer Confidence','JOLTS Job Openings','ADP Non-Farm Employment Change','Federal Funds Rate','FOMC Statement','FOMC Press Conference','Powell Speaks','Fed Chair Powell Testifies','FOMC Member Waller Speaks','FOMC Member Bowman Speaks','FOMC Member Goolsbee Speaks','FOMC Member Barkin Speaks','FOMC Member Logan Speaks','FOMC Member Schmid Speaks','FOMC Member Daly Speaks','FOMC Member Williams Speaks','FOMC Member Jefferson Speaks','FOMC Member Collins Speaks','FOMC Member Hammack Speaks','FOMC Member Barr Speaks','Core PCE Price Index m/m','PCE Price Index m/m','Unemployment Claims']);

function num(v){ const n = parseFloat(String(v ?? '').replace('%','').replace(',','')); return Number.isFinite(n)?n:null; }
function directionFor(event){
  const title = event.title || '';
  const actual = num(event.actual), forecast = num(event.forecast), previous = num(event.previous);
  if(actual===null || forecast===null) return {dir:'neutral', strength:0, reason:'No actual/forecast surprise yet'};
  const inflation = /CPI|PPI|PCE|inflation/i.test(title);
  const jobsStrong = /Non-Farm|ADP|Retail Sales|GDP|ISM|JOLTS|Average Hourly|Consumer Confidence/i.test(title);
  const laborWeak = /Unemployment Rate|Unemployment Claims/i.test(title);
  const surprise = actual - forecast;
  let bullish = false;
  if(inflation) bullish = surprise < 0; else if(laborWeak) bullish = surprise > 0; else if(jobsStrong) bullish = surprise < 0;
  const magnitude = Math.min(100, Math.round(Math.abs(surprise) / Math.max(Math.abs(forecast||1),0.1) * 100));
  return {dir: bullish?'bullish':'bearish', strength:Math.max(25, Math.min(100, magnitude)), reason:`Actual ${event.actual} vs forecast ${event.forecast}`};
}

function normalize(raw){
  const arr = Array.isArray(raw)?raw:[raw];
  return arr.map((e,i)=>{
    const x = directionFor(e);
    const impact = String(e.impact||'').toLowerCase();
    const title = String(e.title||'');
    const relevant = String(e.country||'').toUpperCase()==='USD' && (impact==='high' || usdEvents.has(title));
    return {id:i+1,title,country:e.country||'',date:e.date||'',time:e.time||'',impact:e.impact||'',forecast:e.forecast||'',previous:e.previous||'',actual:e.actual||'',relevant,...x};
  });
}

app.get('/api/health',(req,res)=>res.json({ok:true,time:new Date().toISOString()}));
app.get('/api/calendar', async (req,res)=>{
  try{
    const r = await fetch(CAL_URL,{headers:{'User-Agent':'XAUUSD-News-Bias-AI/1.0'}});
    if(!r.ok) throw new Error(`Calendar HTTP ${r.status}`);
    const xml = await r.text();
    const parser = new XMLParser({ignoreAttributes:false});
    const parsed = parser.parse(xml);
    let events = parsed?.weeklyevents?.event || parsed?.calendar?.event || [];
    events = normalize(events).filter(e=>e.relevant);
    res.set('Cache-Control','public,max-age=60');
    res.json({source:'Forex Factory calendar feed',updatedAt:new Date().toISOString(),events});
  }catch(err){
    res.status(502).json({error:'Calendar feed unavailable',detail:err.message,events:[]});
  }
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`XAUUSD News Bias AI running on ${PORT}`));
