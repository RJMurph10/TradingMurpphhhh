import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {supabase} from '@/integrations/supabase/client';
import {readCollections,saveHolding,saveWatchlist} from './collections.functions';
import {isTicker} from '@/features/market/universe';
export type Holding={ticker:string;shares:number;cost_basis:number};
const initialHoldings:Holding[]=[{ticker:'AAPL',shares:40,cost_basis:220},{ticker:'NVDA',shares:65,cost_basis:125},{ticker:'MSFT',shares:20,cost_basis:400},{ticker:'SPY',shares:30,cost_basis:565}];
const Context=createContext<{email:string|null;authOpen:boolean;openAuth:()=>void;closeAuth:()=>void;watchlist:string[];holdings:Holding[];toggleWatch:(t:string)=>Promise<void>;addHolding:(h:Holding)=>Promise<void>;removeHolding:(t:string)=>Promise<void>;error:string;loading:boolean}|null>(null);
export function ResearchProvider({children}:{children:ReactNode}) {
 const [email,setEmail]=useState<string|null>(null);const [authOpen,setAuthOpen]=useState(false);const [watchlist,setWatchlist]=useState(['NVDA','AAPL','MSFT','AMZN','META']);const [holdings,setHoldings]=useState(initialHoldings);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const read=useServerFn(readCollections);const saveW=useServerFn(saveWatchlist);const saveP=useServerFn(saveHolding);
 useEffect(()=>{let active=true;let identity:string|null=null;
  const sync=async(userEmail:string|null,userId:string|null)=>{if(!active||identity===userId)return;identity=userId;setEmail(userEmail);setError('');if(!userId){setWatchlist(['NVDA','AAPL','MSFT','AMZN','META']);setHoldings(initialHoldings);return;}setLoading(true);setWatchlist([]);setHoldings([]);try{const c=await read();if(active){setWatchlist(c.watchlist.map(w=>w.ticker));setHoldings(c.holdings.map(h=>({ticker:h.ticker,shares:Number(h.shares),cost_basis:Number(h.cost_basis)})));setAuthOpen(false);}}catch{if(active)setError('Your saved research could not be loaded. Please try again.');}finally{if(active)setLoading(false);}};
  supabase.auth.getSession().then(({data})=>{identity='initial';void sync(data.session?.user.email??null,data.session?.user.id??null);});
  const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED')setTimeout(()=>void sync(session?.user.email??null,session?.user.id??null),0);});
  return()=>{active=false;data.subscription.unsubscribe();};
 },[read]);
 const toggleWatch=async(ticker:string)=>{if(!isTicker(ticker)){setError('Enter a valid US stock or ETF ticker symbol.');return;}setError('');const remove=watchlist.includes(ticker);try{if(email)await saveW({data:{ticker,remove}});setWatchlist(w=>remove?w.filter(t=>t!==ticker):[...w,ticker]);}catch{setError('Watchlist could not be saved.');}};
 const addHolding=async(h:Holding)=>{setError('');try{if(email)await saveP({data:{...h,remove:false}});setHoldings(p=>[...p.filter(x=>x.ticker!==h.ticker),h]);}catch{setError('Holding could not be saved.');}};
 const removeHolding=async(ticker:string)=>{const h=holdings.find(x=>x.ticker===ticker);if(!h)return;try{if(email)await saveP({data:{...h,remove:true}});setHoldings(p=>p.filter(x=>x.ticker!==ticker));}catch{setError('Holding could not be removed.');}};
 return <Context.Provider value={{email,authOpen,openAuth:()=>setAuthOpen(true),closeAuth:()=>setAuthOpen(false),watchlist,holdings,toggleWatch,addHolding,removeHolding,error,loading}}>{children}</Context.Provider>;
}
export function useResearch(){const c=useContext(Context);if(!c)throw new Error('ResearchProvider is required');return c;}
