const required=["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_ACCESS_TOKEN"];
for(const name of required){if(!process.env[name]){console.error(`Missing ${name}`);process.exit(2)}}
if(process.env.MP01_LOADTEST_NONPROD!=="true"){
 console.error("Refusing to run. Set MP01_LOADTEST_NONPROD=true only for an isolated non-production Supabase branch/project.");
 process.exit(3);
}

const base=process.env.SUPABASE_URL.replace(/\/$/,"");
const anon=process.env.SUPABASE_ANON_KEY;
const token=process.env.SUPABASE_ACCESS_TOKEN;
const season=process.env.MP01_LOADTEST_SEASON||"2026/27";
const stages=(process.env.MP01_LOADTEST_STAGES||"100,250,500,1000").split(",").map(Number).filter(n=>Number.isInteger(n)&&n>0);
const timeoutMs=Number(process.env.MP01_LOADTEST_TIMEOUT_MS||10000);

const targets=[
 {name:"tipping-home",path:"get_my_tipping_home_summary_v1",body:{}},
 {name:"fantasy-home",path:"get_my_fantasy_home_summary_v1",body:{p_season:season}},
 {name:"tipping-leaderboard",path:"get_tipping_leaderboard_v1",body:{}},
];

const headers={
 apikey:anon,
 authorization:`Bearer ${token}`,
 "content-type":"application/json",
};

function percentile(values,p){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);const idx=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));return sorted[idx]}
async function once(target){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 const started=performance.now();
 try{
  const res=await fetch(`${base}/rest/v1/rpc/${target.path}`,{method:"POST",headers,body:JSON.stringify(target.body),signal:controller.signal});
  const ms=performance.now()-started;
  if(!res.ok){const text=await res.text();return{ok:false,ms,status:res.status,error:text.slice(0,180)}}
  await res.arrayBuffer();
  return{ok:true,ms,status:res.status};
 }catch(error){return{ok:false,ms:performance.now()-started,status:0,error:error?.name||String(error)}}finally{clearTimeout(timer)}
}

console.log(`MP-01 read-path load harness · NON-PRODUCTION ONLY · ${base}`);
console.log(`Stages: ${stages.join(" -> ")} concurrent calls per target`);

let overallFailed=false;
for(const concurrency of stages){
 console.log(`\n=== concurrency ${concurrency} ===`);
 for(const target of targets){
  const started=performance.now();
  const results=await Promise.all(Array.from({length:concurrency},()=>once(target)));
  const elapsed=performance.now()-started;
  const ok=results.filter(x=>x.ok),failed=results.filter(x=>!x.ok),latencies=ok.map(x=>x.ms);
  const row={
   target:target.name,
   concurrency,
   ok:ok.length,
   failed:failed.length,
   error_rate:Number((failed.length/results.length*100).toFixed(2)),
   p50_ms:Number(percentile(latencies,50).toFixed(1)),
   p95_ms:Number(percentile(latencies,95).toFixed(1)),
   p99_ms:Number(percentile(latencies,99).toFixed(1)),
   burst_ms:Number(elapsed.toFixed(1)),
  };
  console.log(JSON.stringify(row));
  if(failed.length){overallFailed=true;console.log("sample_error",failed[0])}
 }
}

if(overallFailed){console.error("One or more load stages returned errors/timeouts.");process.exit(1)}
console.log("All configured read-path bursts completed without request errors.");
