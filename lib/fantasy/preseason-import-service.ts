import {createClient} from "@supabase/supabase-js";
import {fetchNifMatchBundle} from "./nif-client";

type Row=Record<string,any>;

function first(...values:any[]){return values.find(v=>v!==undefined&&v!==null&&v!=="")??null}
function n(v:any,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}
function text(v:any){return v==null?"":String(v).trim()}
function norm(v:any){return text(v).toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"").trim()}
function canonicalTeam(value:any){const s=text(value).toLocaleLowerCase("nb-NO");if(s.includes("nidaros"))return"nidaros";if(s.includes("lørenskog")||s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("vålerenga")||s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return norm(value)}
function fullName(raw:Row){const direct=text(first(raw.playerName,raw.PlayerName,raw.name,raw.Name,raw.fullName,raw.personName));if(direct)return direct;return [text(first(raw.firstName,raw.FirstName)),text(first(raw.lastName,raw.LastName))].filter(Boolean).join(" ").trim()}
function team(raw:Row){return text(first(raw.teamName,raw.TeamName,raw.team,raw.Team,raw.clubName,raw.orgName,raw.teamShortName,raw.TeamShortName))}
function externalPerson(raw:Row){return text(first(raw.personId,raw.PersonId,raw.playerId,raw.PlayerId,raw.id,raw.Id))}
function pos(raw:Row,goalie=false){if(goalie)return"G";const s=text(first(raw.position,raw.Position,raw.playerPosition,raw.positionCode,raw.pos)).toLowerCase();if(s==="d"||s.includes("def")||s.includes("back"))return"D";if(s==="c"||s.includes("cent"))return"C";if(s==="rw"||s==="lw"||s.includes("wing")||s.includes("ving"))return"W";return null}
function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

function skaterStat(raw:Row){const seconds=first(raw.playerTimeSeconds,raw.PlayerTimeSeconds);return{goals:n(first(raw.goalsScored,raw.GoalsScored,raw.goals,raw.Goals,raw.g)),assists:n(first(raw.assists,raw.Assists,raw.a)),shots:n(first(raw.shots,raw.Shots,raw.shotsOnGoal,raw.ShotsOnGoal,raw.sog,raw.SOG)),plus_minus:n(first(raw.plusMinus,raw.PlusMinus,raw.plusminus,raw.pm)),pim:n(first(raw.pim,raw.PIM,raw.penaltyMinutes,raw.PenaltyMinutes)),minutes_played:seconds!=null?n(seconds)/60:n(first(raw.playerTime,raw.PlayerTime,raw.timeOnIce,raw.TimeOnIce,raw.toi,raw.TOI,raw.minutesPlayed)),powerplay_goals:n(first(raw.powerPlayGoals,raw.PowerPlayGoals,raw.ppg,raw.PPG)),powerplay_assists:n(first(raw.powerPlayAssists,raw.PowerPlayAssists,raw.ppa,raw.PPA)),shorthanded_goals:n(first(raw.shortHandedGoals,raw.ShortHandedGoals,raw.shg,raw.SHG)),shorthanded_assists:n(first(raw.shortHandedAssists,raw.ShortHandedAssists,raw.sha,raw.SHA))}}
function goalieStat(raw:Row){const seconds=first(raw.playerTimeSeconds,raw.PlayerTimeSeconds);return{saves:n(first(raw.saves,raw.Saves,raw.saveCount,raw.SaveCount,raw.savedShots,raw.SavedShots)),goals_against:n(first(raw.goalsAgainst,raw.GoalsAgainst,raw.ga,raw.GA)),minutes_played:seconds!=null?n(seconds)/60:n(first(raw.playerTime,raw.PlayerTime,raw.timeOnIce,raw.TimeOnIce,raw.toi,raw.TOI,raw.minutesPlayed))}}
function goalieActive(raw:Row){const s=goalieStat(raw);return s.saves>0||s.goals_against>0||s.minutes_played>0}

async function loadFantasyPlayers(sb:any){const rows:any[]=[];for(let from=0;;from+=1000){const{data,error}=await sb.from("fantasy_players").select("id,external_id,name,team,position,on_current_roster").range(from,from+999);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)break}return rows}
function findPlayer(raw:Row,players:any[]){const ext=externalPerson(raw),name=fullName(raw),tm=team(raw);if(ext){const hit=players.find(p=>String(p.external_id||"")===`nif:${ext}`||String(p.external_id||"")===ext);if(hit)return hit}const nk=norm(name),tk=canonicalTeam(tm);const byName=players.filter(p=>norm(p.name)===nk);if(byName.length===1)return byName[0];const byTeam=byName.find(p=>canonicalTeam(p.team)===tk);return byTeam||null}

function goalTeamCounts(goals:Row[]){const counts=new Map<string,number>();for(const g of goals){const key=canonicalTeam(first(g.teamName,g.TeamName,g.teamShortName,g.TeamShortName));if(key)counts.set(key,(counts.get(key)||0)+1)}return counts}

export async function importPreseasonHockeyLiveMatch(preseasonGameId:number){
 const sb=serverClient();
 const{data:game,error:gameError}=await sb.from("fantasy_preseason_games").select("*").eq("id",preseasonGameId).single();if(gameError)throw gameError;
 const matchId=Number(game.hockeylive_match_id);if(!Number.isInteger(matchId)||matchId<=0)throw new Error("Treningskampen mangler gyldig HockeyLive matchId");
 const bundle=await fetchNifMatchBundle(matchId);
 const players=await loadFantasyPlayers(sb);
 const goalieIds=new Set(bundle.goalies.map(r=>externalPerson(r)).filter(Boolean));
 let imported=0,matched=0,unmatched=0;

 for(const raw of bundle.players){
  if(goalieIds.has(externalPerson(raw)))continue;
  const name=fullName(raw);if(!name)continue;
  const tm=team(raw)||"Ukjent";const player=findPlayer(raw,players);const stat=skaterStat(raw);
  const row={preseason_game_id:game.id,player_id:player?.id||null,raw_player_name:name,team:tm,position:player?.position||pos(raw,false),did_play:true,...stat,source_type:"hockeylive",source_quality:0.95,raw:{source:"hockeylive-match-players",matchId,...raw},updated_at:new Date().toISOString()};
  const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;imported++;if(player)matched++;else unmatched++;
 }

 const activePerTeam=new Map<string,number>();for(const raw of bundle.goalies){if(!goalieActive(raw))continue;const key=canonicalTeam(team(raw));activePerTeam.set(key,(activePerTeam.get(key)||0)+1)}
 for(const raw of bundle.goalies){const name=fullName(raw);if(!name)continue;const tm=team(raw)||"Ukjent";const player=findPlayer(raw,players);const stat=goalieStat(raw);const active=goalieActive(raw);const wins=n(first(raw.wins,raw.Wins,raw.win,raw.Win),0)>0;const shutout=active&&stat.goals_against===0&&(activePerTeam.get(canonicalTeam(tm))||0)===1;
  const row={preseason_game_id:game.id,player_id:player?.id||null,raw_player_name:name,team:tm,position:"G",did_play:active,goals:0,assists:0,shots:0,plus_minus:0,pim:0,...stat,win:wins,shutout,powerplay_goals:0,powerplay_assists:0,shorthanded_goals:0,shorthanded_assists:0,source_type:"hockeylive",source_quality:0.95,raw:{source:"hockeylive-goalie-leaders",matchId,...raw},updated_at:new Date().toISOString()};
  const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;imported++;if(player)matched++;else unmatched++;
 }

 const counts=goalTeamCounts(bundle.goals),homeKey=canonicalTeam(game.home_team),awayKey=canonicalTeam(game.away_team);const home=counts.get(homeKey),away=counts.get(awayKey);const patch:any={source_type:"hockeylive",source_quality:0.95,updated_at:new Date().toISOString()};if(home!==undefined&&away!==undefined&&home+away===bundle.goals.length){patch.home_score=home;patch.away_score=away;patch.status="finished"}
 const{error:updateError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",game.id);if(updateError)throw updateError;
 return{preseasonGameId:game.id,matchId,rows:imported,matched,unmatched,players:bundle.players.length,goalies:bundle.goalies.length,goals:bundle.goals.length};
}

export async function importAllPreseasonHockeyLive(){
 const sb=serverClient();const{data,error}=await sb.from("fantasy_preseason_games").select("id,hockeylive_match_id,home_team,away_team").eq("season","2026/27").not("hockeylive_match_id","is",null).order("game_date");if(error)throw error;
 const results:any[]=[];for(const g of data||[]){try{results.push({ok:true,...await importPreseasonHockeyLiveMatch(Number(g.id))})}catch(error:any){results.push({ok:false,preseasonGameId:g.id,matchId:g.hockeylive_match_id,game:`${g.home_team} - ${g.away_team}`,error:error?.message||String(error)})}}
 return{attempted:results.length,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
}
