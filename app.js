let events=[]; let targetTime=null;
const $=s=>document.querySelector(s);
function cls(dir){return dir==='bullish'?'bullish':dir==='bearish'?'bearish':'neutral'}
function compute(){
 let score=0,total=0;
 events.forEach(e=>{const w=e.impact.toLowerCase()==='high'?3:1; if(e.dir==='bullish')score+=e.strength*w; if(e.dir==='bearish')score-=e.strength*w; total+=e.strength*w;});
 let pct=total?Math.round(50+(score/total)*50):50; pct=Math.max(5,Math.min(95,pct));
 const bias=pct>58?'bullish':pct<42?'bearish':'neutral'; const confidence=events.length?Math.min(96,Math.max(48,Math.round(Math.abs(pct-50)*1.7+55))):50;
 $('#score').textContent=confidence; $('#confLabel').textContent=confidence>78?'High':'Moderate'; $('#meterFill').style.width=pct+'%';
 $('#biasBadge').textContent=bias==='bullish'?'BUY BIAS':bias==='bearish'?'SELL BIAS':'NEUTRAL'; $('#biasBadge').className='badge '+bias;
 $('#headline').textContent=bias==='bullish'?'XAUUSD has a bullish macro bias':bias==='bearish'?'XAUUSD has a bearish macro bias':'XAUUSD macro bias is mixed';
 $('#summary').textContent=events.length?`${events.length} relevant USD catalyst${events.length>1?'s':''} scored. Higher inflation/rate pressure generally weighs on gold; softer pressure generally supports it.`:'No relevant events loaded yet.';
 $('#usdPressure').textContent=score>0?'Negative':'Positive'; $('#rateTone').textContent=score<0?'Hawkish':'Dovish / mixed'; $('#risk').textContent=events.some(e=>e.impact.toLowerCase()==='high')?'HIGH':'MEDIUM';
}
function render(){
 $('#eventCount').textContent=`${events.length} event${events.length===1?'':'s'}`;
 if(!events.length){$('#eventsList').innerHTML='<div class="error">No calendar events returned. Try refresh, or check the Render server logs.</div>';return;}
 $('#eventsList').innerHTML=events.slice(0,12).map(e=>`<div class="event"><div class="event-main"><b>${e.title}</b><span>${e.date||''} ${e.time||''} · Forecast ${e.forecast||'—'} · Previous ${e.previous||'—'}${e.actual?` · Actual ${e.actual}`:''}</span></div><span class="impact ${e.impact.toLowerCase()}">${e.impact||'USD'}</span><span class="signal ${cls(e.dir)}">${e.actual?e.dir.toUpperCase():'WAIT'}</span></div>`).join('');
 const next=events.find(e=>!e.actual)||events[0]; $('#nextEvent').textContent=next?next.title:'No upcoming event';
 targetTime=parseDate(next?.date,next?.time);
}
function parseDate(d,t){if(!d||!t)return null; const x=new Date(`${d} ${t}`); return isNaN(x)?null:x}
function tick(){if(!targetTime){$('#countdown').textContent='—';return} let s=Math.max(0,Math.floor((targetTime-Date.now())/1000));const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;$('#countdown').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
async function load(){try{const r=await fetch('/api/calendar?ts='+Date.now());const j=await r.json();if(!r.ok)throw new Error(j.detail||j.error);events=j.events||[];render();compute();$('#updated').textContent='Updated '+new Date().toLocaleTimeString();}catch(e){$('#eventsList').innerHTML=`<div class="error">Feed error: ${e.message}</div>`;$('#headline').textContent='Calendar feed unavailable';}}
$('#refresh').onclick=load;load();setInterval(load,120000);setInterval(tick,1000);
