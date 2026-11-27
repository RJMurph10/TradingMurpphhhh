import { sampleHistory, type PricePoint } from './sample-data';
export const mean = (a:number[]) => a.length ? a.reduce((s,n)=>s+n,0)/a.length : 0;
export function indicators(history:PricePoint[]) {
 const prices=history.map(p=>p.price); const last=prices.at(-1) ?? 0;
 const returns=prices.slice(1).map((p,i)=>p/(prices[i] ?? p)-1);
 const avg=mean(returns); const vol=Math.sqrt(mean(returns.map(r=>(r-avg)**2)))*Math.sqrt(252);
 const changes=prices.slice(-15).slice(1).map((p,i)=>p-(prices.slice(-15)[i] ?? p));
 const gain=mean(changes.map(c=>Math.max(c,0))); const loss=mean(changes.map(c=>Math.max(-c,0)));
 const ma=(n:number)=>mean(prices.slice(-n)); const std=Math.sqrt(mean(prices.slice(-20).map(p=>(p-ma(20))**2)));
 return {last,ma20:ma(20),ma50:ma(50),ma100:ma(100),ma200:ma(200),rsi:loss ? 100-100/(1+gain/loss) : gain ? 100 : 50,macd:ma(12)-ma(26),upper:ma(20)+2*std,lower:ma(20)-2*std,volatility:vol*100,sharpe:vol ? avg*252/vol : 0,atr:mean(changes.map(Math.abs))};
}
export type ModelResult = { name:string; direction:number; expected:number|null; note:string; available:boolean };
export function models(ticker:string):ModelResult[] {
 const h=sampleHistory(ticker); const x=indicators(h); const last=h.at(-1)?.price ?? 1; const prev=h.at(-21)?.price ?? last;
 const momentum=(last/prev-1)*100; const trend=(last/x.ma50-1)*100;
 return [
 {name:'Momentum',direction:Math.sign(momentum),expected:momentum/4,note:'20-session price momentum',available:true},
 {name:'Mean reversion',direction:Math.sign(x.ma20-last),expected:(x.ma20/last-1)*100,note:'Distance from the 20-session average',available:true},
 {name:'Trend following',direction:Math.sign(trend),expected:trend/3,note:'Price relative to the 50-session average',available:true},
 {name:'Volatility',direction:0,expected:null,note:`Annualized sample volatility: ${x.volatility.toFixed(1)}% · nondirectional`,available:true},
 {name:'Statistical regression',direction:Math.sign(momentum),expected:momentum/5,note:'Illustrative linear momentum proxy; not a fitted model',available:true},
 {name:'Machine learning',direction:0,expected:null,note:'Not available. Requires training data and out-of-sample validation.',available:false},
 ];
}
export function composite(results:ModelResult[],weights:number[]) {
 const active=results.map((r,i)=>({r,w:weights[i] ?? 0})).filter(({r})=>r.available&&r.expected!==null);
 const total=active.reduce((s,{w})=>s+w,0);
 if(!total) return {direction:'Neutral',expected:0};
 const score=active.reduce((s,{r,w})=>s+r.direction*w,0)/total;
 return {direction:score>.2?'Bullish':score<-.2?'Bearish':'Neutral',expected:active.reduce((s,{r,w})=>s+(r.expected ?? 0)*w,0)/total};
}
export type Opportunity = ReturnType<typeof rankOpportunities>[number];
export function rankOpportunities(universe=sampleUniverse()) {
 const benchmark=sampleHistory('SPY');
 const benchmarkMomentum=(benchmark.at(-1)!.price/benchmark.at(-21)!.price-1)*100;
 return universe.map(stock=>{
  const h=sampleHistory(stock.ticker);const x=indicators(h);const last=h.at(-1)!;
  const momentum=(last.price/h.at(-21)!.price-1)*100;
  const relativeStrength=momentum-benchmarkMomentum;
  const averageVolume=mean(h.slice(-21,-1).map(p=>p.volume));
  const volumeAnomaly=averageVolume?(last.volume/averageVolume-1)*100:0;
  const trendPoints=(x.last>x.ma20?5:-5)+(x.last>x.ma50?5:-5);
  const score=Math.max(0,Math.min(100,Math.round(50+Math.max(-20,Math.min(20,momentum*2))+Math.max(-15,Math.min(15,relativeStrength))+Math.max(-10,Math.min(10,volumeAnomaly/5))+trendPoints-Math.max(0,Math.min(10,(x.volatility-25)/5)))));
  const explanation=`${momentum>=0?'Positive':'Negative'} 20-session momentum of ${momentum.toFixed(1)}%, ${relativeStrength>=0?'outperforming':'underperforming'} the sample SPY proxy by ${Math.abs(relativeStrength).toFixed(1)} points. Volume is ${Math.abs(volumeAnomaly).toFixed(0)}% ${volumeAnomaly>=0?'above':'below'} its 20-session average; price is ${x.last>x.ma20?'above':'below'} the 20-session average.`;
  return {...stock,momentum,relativeStrength,volumeAnomaly,volatility:x.volatility,score,explanation};
 }).sort((a,b)=>b.score-a.score);
}
function sampleUniverse(){return stocks.filter(s=>s.sector!=='ETF');}
export type BacktestOptions={ticker:string;strategy:string;capital:number;allocation:number;cost:number;slippage:number;fast:number;slow:number;start:string;end:string};
export function backtest(o:BacktestOptions) {
 if(o.capital<=0 || o.allocation<=0 || o.allocation>100 || o.fast>=o.slow || o.start>=o.end) throw new Error('Check capital, position sizing, dates, and moving-average periods.');
 const h=sampleHistory(o.ticker).filter(p=>p.date>=o.start&&p.date<=o.end);
 if(h.length<o.slow+2) throw new Error('Select a sample period with enough sessions for the slow average.');
 let cash=o.capital,shares=0,entry=0,trades=0,wins=0,grossProfit=0,grossLoss=0,peak=o.capital,maxDrawdown=0;
 const initial=h[0]?.price ?? 1;
 const curve=h.map((p,i)=>{
  if(i>=o.slow) {
   const x=indicators(h.slice(0,i)); const prior=h.slice(0,i).map(v=>v.price);
   const buy=o.strategy==='RSI mean reversion'?x.rsi<35:mean(prior.slice(-o.fast))>mean(prior.slice(-o.slow));
   const sell=o.strategy==='RSI mean reversion'?x.rsi>65:!buy;
   // All signals use prior closes; orders fill on the next sample close, including costs.
   if(buy&&!shares){const fill=p.price*(1+o.slippage/100); const budget=Math.max(0,cash*o.allocation/100-o.cost); shares=budget/fill; entry=budget+o.cost; cash-=entry;}
   else if(sell&&shares){const proceeds=shares*p.price*(1-o.slippage/100)-o.cost;const pnl=proceeds-entry;cash+=proceeds;shares=0;trades++;if(pnl>0){wins++;grossProfit+=pnl;}else grossLoss-=pnl;}
  }
  const price=cash+shares*p.price; peak=Math.max(peak,price);maxDrawdown=Math.max(maxDrawdown,(peak-price)/peak*100);
  return {...p,price,benchmark:o.capital*p.price/initial};
 });
 const end=curve.at(-1)?.price ?? o.capital; const stats=indicators(curve);
 return {curve,totalReturn:(end/o.capital-1)*100,annualized:((end/o.capital)**(252/h.length)-1)*100,maxDrawdown,sharpe:stats.sharpe,winRate:trades?wins/trades*100:0,profitFactor:grossLoss?grossProfit/grossLoss:null,trades,benchmark:((h.at(-1)?.price ?? initial)/initial-1)*100};
}
