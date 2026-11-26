import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
const ticker=z.string().regex(/^[A-Z]{1,5}$/);
export const readCollections=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const [w,p]=await Promise.all([context.supabase.from('watchlist_entries').select('id,ticker').eq('user_id',context.userId).order('created_at').limit(100),context.supabase.from('portfolio_holdings').select('id,ticker,shares,cost_basis').eq('user_id',context.userId).order('created_at').limit(100)]);
 if(w.error||p.error)throw new Error('Unable to load your saved research.');
 return {watchlist:w.data??[],holdings:p.data??[]};
});
export const saveWatchlist=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({ticker,remove:z.boolean().default(false)})).handler(async({data,context})=>{
 const result=data.remove?await context.supabase.from('watchlist_entries').delete().eq('user_id',context.userId).eq('ticker',data.ticker):await context.supabase.from('watchlist_entries').upsert({user_id:context.userId,ticker:data.ticker},{onConflict:'user_id,ticker'});
 if(result.error)throw new Error('Unable to save your watchlist.');return {ok:true};
});
export const saveHolding=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({ticker,shares:z.number().positive(),cost_basis:z.number().positive(),remove:z.boolean().default(false)})).handler(async({data,context})=>{
 const result=data.remove?await context.supabase.from('portfolio_holdings').delete().eq('user_id',context.userId).eq('ticker',data.ticker):await context.supabase.from('portfolio_holdings').upsert({user_id:context.userId,ticker:data.ticker,shares:data.shares,cost_basis:data.cost_basis},{onConflict:'user_id,ticker'});
 if(result.error)throw new Error('Unable to save this holding.');return {ok:true};
});
