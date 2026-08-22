import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const SEASON="2026/27";

async function clients(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey=process.env.SUPABASE_SECRET_KEY;
  if(!url||!publicKey||!secretKey)throw new Error("Supabase-konfigurasjon mangler");
  const header=request.headers.get("authorization");
  const token=header?.startsWith("Bearer ")?header.slice(7):null;
  if(!token)return {error:NextResponse.json({ok:false,error:"Mangler innlogging."},{status:401})};
  const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:userData,error:userError}=await auth.auth.getUser(token);
  if(userError||!userData.user)return {error:NextResponse.json({ok:false,error:"Ugyldig innlogging."},{status:401})};
  const {data:admin}=await auth.from("players").select("admin").eq("id",userData.user.id).maybeSingle();
  if(!admin?.admin)return {error:NextResponse.json({ok:false,error:"Kun admin kan åpne priskalibreringen."},{status:403})};
  const server=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return {auth,server};
}

function percentile(values:number[],q:number){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return 0;
  const i=(a.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);
}

export async function GET(request:NextRequest){
  try{
    const c=await clients(request);if("error" in c)return c.error;
    const {auth,server}=c;
    const [{data:players,error:playersError},{data:features,error:featureError},{data:preseason,error:preseasonError},{data:publication,error:publicationError}]=await Promise.all([
      server.from("fantasy_players").select("id,name,team,position,price,active,on_current_roster,available_for_purchase").eq("active",true).eq("on_current_roster",true).order("team").order("name"),
      auth.rpc("get_fantasy_analysis_features_admin_v1",{p_season:SEASON}),
      auth.rpc("get_fantasy_preseason_xfp_preview_admin_v2",{p_season:SEASON}),
      server.from("fantasy_price_publications").select("id,model_version,published_at,player_count").eq("season",SEASON).order("published_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(playersError)throw playersError;if(featureError)throw featureError;if(preseasonError)throw preseasonError;if(publicationError)throw publicationError;
    const pubId=publication?.id;
    const [{data:seasonPrices,error:seasonPriceError},{data:pubRows,error:pubRowsError}]=await Promise.all([
      server.from("fantasy_player_season_prices").select("player_id,price,locked_at").eq("season",SEASON),
      pubId?server.from("fantasy_price_publication_rows").select("player_id,player_name,old_price,new_price,routing,confidence,source").eq("publication_id",pubId):Promise.resolve({data:[],error:null} as any),
    ]);
    if(seasonPriceError)throw seasonPriceError;if(pubRowsError)throw pubRowsError;

    const priceMap=new Map((seasonPrices||[]).map((x:any)=>[x.player_id,x]));
    const featureMap=new Map((features||[]).map((x:any)=>[x.player_id,x]));
    const preseasonMap=new Map((preseason||[]).map((x:any)=>[x.player_id,x]));
    const publicationMap=new Map((pubRows||[]).map((x:any)=>[x.player_id,x]));
    const byPos=new Map<string,number[]>();
    for(const f of features||[]){const pos=String(f.player_position||"");const v=Number(f.observed_value_per_million);if(!Number.isFinite(v))continue;const a=byPos.get(pos)||[];a.push(v);byPos.set(pos,a)}
    const thresholds=new Map<string,{p10:number;p90:number}>();
    for(const [pos,values] of byPos)thresholds.set(pos,{p10:percentile(values,.10),p90:percentile(values,.90)});

    const rows=(players||[]).map((p:any)=>{
      const sp:any=priceMap.get(p.id),f:any=featureMap.get(p.id),ps:any=preseasonMap.get(p.id),pr:any=publicationMap.get(p.id);
      const price=sp?.price==null?null:Number(sp.price),value=f?.observed_value_per_million==null?null:Number(f.observed_value_per_million),games=Number(f?.historical_games||0),pos=String(p.position||f?.player_position||""),t=thresholds.get(pos);
      const preseasonGames=Number(ps?.preseason_games||0),baseline=Number(ps?.baseline_xfp||0),preview=Number(ps?.preview_xfp||0),preseasonPct=baseline>0?100*(preview-baseline)/baseline:0;
      let suggestedDelta=0,action="Behold",reason="Ingen sterk nok kalibreringsindikasjon";
      if(price==null){action="Mangler pris";reason="Aktiv current-roster-spiller uten 2026/27-pris";}
      else if(games>=20&&value!=null&&t&&value>=t.p90){suggestedDelta=price<=2.5?1:0.5;action="Kontroller opp";reason=`Topp 10 % verdi per million i ${pos} med ${games} historiske kamper`;}
      else if(games>=20&&value!=null&&t&&value<=t.p10&&price>=12){suggestedDelta=-0.5;action="Kontroller ned";reason=`Bunn 10 % verdi per million i ${pos} med premiumpris og ${games} historiske kamper`;}
      if(price!=null&&preseasonGames>=2&&Math.abs(preseasonPct)>=12){reason+=`; preseason ${preseasonPct>0?"+":""}${preseasonPct.toFixed(1)} % mot baseline (${preseasonGames} kamper)`;}
      return {player_id:p.id,name:p.name,team:p.team,position:pos,price,available_for_purchase:p.available_for_purchase,model_version:publication?.model_version||null,publication_price:pr?.new_price==null?null:Number(pr.new_price),routing:pr?.routing||null,confidence:pr?.confidence||f?.data_confidence||null,source:pr?.source||null,historical_games:games,season_ppg:f?.season_ppg==null?null:Number(f.season_ppg),observed_value_per_million:value,preseason_games:preseasonGames,baseline_xfp:ps?.baseline_xfp==null?null:Number(ps.baseline_xfp),preseason_xfp:ps?.preview_xfp==null?null:Number(ps.preview_xfp),preseason_delta_pct:Number(preseasonPct.toFixed(1)),action,suggested_delta:suggestedDelta,suggested_price:price==null?null:Math.max(1,Math.min(20,price+suggestedDelta)),reason};
    });
    const priced=rows.filter((r:any)=>r.price!=null);
    const average=priced.length?priced.reduce((s:number,r:any)=>s+r.price,0)/priced.length:0;
    return NextResponse.json({ok:true,season:SEASON,generated_at:new Date().toISOString(),publication,summary:{roster:rows.length,priced:priced.length,missing:rows.length-priced.length,review_up:rows.filter((r:any)=>r.action==="Kontroller opp").length,review_down:rows.filter((r:any)=>r.action==="Kontroller ned").length,average_price:Number(average.toFixed(2))},position_value_thresholds:Object.fromEntries(thresholds),rows});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Ukjent feil i priskalibrering"},{status:500})}
}
