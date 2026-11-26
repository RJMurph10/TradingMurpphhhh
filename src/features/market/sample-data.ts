// Explicitly illustrative fixtures. Never a market data feed or a real forecast.
export type Stock = { ticker: string; name: string; price: number; change: number; volume: number; cap: number; sector: string; score: number };
export const stocks: Stock[] = [
 {ticker:'NVDA',name:'NVIDIA Corporation',price:142.87,change:3.42,volume:218.4,cap:3500,sector:'Technology',score:92},
 {ticker:'AAPL',name:'Apple Inc.',price:237.49,change:1.18,volume:54.2,cap:3600,sector:'Technology',score:78},
 {ticker:'MSFT',name:'Microsoft Corporation',price:428.76,change:1.64,volume:22.8,cap:3190,sector:'Technology',score:85},
 {ticker:'AMZN',name:'Amazon.com Inc.',price:213.44,change:2.31,volume:38.7,cap:2250,sector:'Consumer cyclical',score:87},
 {ticker:'META',name:'Meta Platforms Inc.',price:589.12,change:2.87,volume:17.6,cap:1480,sector:'Communication',score:89},
 {ticker:'TSLA',name:'Tesla Inc.',price:248.50,change:-2.14,volume:89.3,cap:798,sector:'Consumer cyclical',score:38},
 {ticker:'JPM',name:'JPMorgan Chase & Co.',price:245.31,change:0.84,volume:8.9,cap:690,sector:'Financials',score:74},
 {ticker:'UNH',name:'UnitedHealth Group',price:521.62,change:-1.38,volume:4.2,cap:480,sector:'Healthcare',score:42},
 {ticker:'XOM',name:'Exxon Mobil Corporation',price:117.21,change:-0.76,volume:13.1,cap:520,sector:'Energy',score:46},
 {ticker:'SPY',name:'SPDR S&P 500 ETF',price:598.45,change:1.24,volume:48.6,cap:620,sector:'ETF',score:80},
 {ticker:'QQQ',name:'Invesco QQQ Trust',price:512.18,change:1.87,volume:31.2,cap:310,sector:'ETF',score:86},
 {ticker:'AMD',name:'Advanced Micro Devices',price:137.64,change:4.26,volume:46.8,cap:224,sector:'Technology',score:90},
];
export const indices = [
 {name:'S&P 500',symbol:'SPX',price:5987.37,change:1.24},
 {name:'NASDAQ',symbol:'IXIC',price:19286.78,change:1.87},
 {name:'Dow Jones',symbol:'DJI',price:44296.51,change:0.82},
 {name:'Russell 2000',symbol:'RUT',price:2389.42,change:1.56},
 {name:'VIX',symbol:'VIX',price:14.52,change:-4.23},
];
export const sectors = [
 {name:'Technology',change:2.41},{name:'Financials',change:1.18},{name:'Healthcare',change:-0.62},
 {name:'Consumer cyclical',change:1.87},{name:'Communication',change:1.56},{name:'Energy',change:-0.84},
 {name:'Industrials',change:0.93},{name:'Real estate',change:0.24},{name:'Utilities',change:-0.31},
];
export const money = (n:number) => n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export const number = (n:number) => n.toLocaleString('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});
export const percent = (n:number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
export const signal = (score:number) => score >= 65 ? 'Bullish' : score <= 45 ? 'Bearish' : 'Neutral';
export function getStock(ticker:string) { return stocks.find(s => s.ticker === ticker.toUpperCase()); }
export type PricePoint = { date:string; price:number; benchmark:number; volume:number };
export function sampleHistory(ticker:string, count=252): PricePoint[] {
 const stock = getStock(ticker); const end = stock?.price ?? 5987.37;
 const seed = [...ticker].reduce((s,c)=>s+c.charCodeAt(0),0);
 const raw = Array.from({length:count},(_,i)=> 100 + i*.075 + 2.5*Math.sin(i*.08+seed) + 1.4*Math.sin(i*.39) + .8*Math.sin(i*1.7+seed));
 const last = raw.at(-1) ?? 100;
 return raw.map((p,i)=>({date:new Date(Date.UTC(2025,0,2+i)).toISOString().slice(0,10),price:+(p/last*end).toFixed(2),benchmark:100+i*.043+Math.sin(i*.1),volume:Math.round(20+12*Math.abs(Math.sin(i*.41+seed)))}));
}
export const periodCount: Record<string,number> = {'1D':40,'1W':60,'1M':90,'3M':120,'6M':180,'1Y':252,'Day':40,'Week':60,'Month':90,'Year':252};
