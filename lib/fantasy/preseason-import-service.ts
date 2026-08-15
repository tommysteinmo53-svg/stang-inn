import {createClient} from "@supabase/supabase-js";
import {fetchNifMatchBundle} from "./nif-client";

type Row=Record<string,any>;

function first(...values:any[]){return values.find(v=>v!==undefined&&v!==null&&v!=="")??null}
function n(v:any,fallback=0){const x=Number(v);return Number.isFinite(x)?x:fallback}
function text(v:any){return v==null?"":String(v).trim()}
function ascii(v:any){return text(v).toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function norm(v:any){return ascii(v).replace(/[^a-z0-9]+/g,"").trim()}
function nameTokens(v:any){return ascii(v).replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean)}
function canonicalTeam(value:any){const s=ascii(value);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return norm(value)}
function fullName(raw:Row){const direct=text(first(raw.playerName,raw.PlayerName,raw.name,raw.Name,raw.fullName,raw.FullName,raw.personName,raw.PersonName,raw.memberName,raw.MemberName));if(direct)return direct;return [text(first(raw.firstName,raw.FirstName,raw.givenName)),text(first(raw.lastName,raw.LastName,raw.familyName))].filter(Boolean).join(" ").trim()}
function team(raw:Row){return text(first(raw.teamName,raw.TeamName,raw.team,raw.Team,raw.clubName,raw.ClubName,raw.orgName,raw.OrgName,raw.organizationName,raw.OrganizationName,raw.teamShortName,raw.TeamShortName))}
function externalPerson(raw:Row){return text(first(raw.personId,raw.PersonId,raw.playerId,raw.PlayerId,raw.person_id,raw.id,raw.Id))}
function pos(raw:Row,goalie=false){if(goalie)return"G";const s=text(first(raw.position,raw.Position,raw.playerPosition,raw.positionCode,raw.pos,raw.roleName,raw.RoleName)).toLowerCase();if(s==="g"||s.includes("goal")||s.includes("keeper"))return"G";if(s==="d"||s.includes("def")||s.includes("back"))return"D";if(s==="c"||s.includes("cent"))return"C";if(s==="rw"||s==="lw"||s==="f"||s.includes("wing")||s.includes("ving")||s.includes("forward"))return"W";return null}
function serverClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase server-variabler mangler");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

function skaterStat(raw:Row){const seconds=first(raw.playerTimeSeconds,raw.PlayerTimeSeconds);return{goals:n(first(raw.goalsScored,raw.GoalsScored,raw.goals,raw.Goals,raw.g)),assists:n(first(raw.assists,raw.Assists,raw.a)),shots:n(first(raw.shots,raw.Shots,raw.shotsOnGoal,raw.ShotsOnGoal,raw.sog,raw.SOG)),plus_minus:n(first(raw.plusMinus,raw.PlusMinus,raw.plusminus,raw.pm)),pim:n(first(raw.pim,raw.PIM,raw.penaltyMinutes,raw.PenaltyMinutes)),minutes_played:seconds!=null?n(seconds)/60:n(first(raw.playerTime,raw.PlayerTime,raw.timeOnIce,raw.TimeOnIce,raw.toi,raw.TOI,raw.minutesPlayed)),powerplay_goals:n(first(raw.powerPlayGoals,raw.PowerPlayGoals,raw.ppg,raw.PPG)),powerplay_assists:n(first(raw.powerPlayAssists,raw.PowerPlayAssists,raw.ppa,raw.PPA)),shorthanded_goals:n(first(raw.shortHandedGoals,raw.ShortHandedGoals,raw.shg,raw.SHG)),shorthanded_assists:n(first(raw.shortHandedAssists,raw.ShortHandedAssists,raw.sha,raw.SHA))}}
function goalieStat(raw:Row){const seconds=first(raw.playerTimeSeconds,raw.PlayerTimeSeconds);return{saves:n(first(raw.saves,raw.Saves,raw.saveCount,raw.SaveCount,raw.savedShots,raw.SavedShots)),goals_against:n(first(raw.goalsAgainst,raw.GoalsAgainst,raw.ga,raw.GA)),minutes_played:seconds!=null?n(seconds)/60:n(first(raw.playerTime,raw.PlayerTime,raw.timeOnIce,raw.TimeOnIce,raw.toi,raw.TOI,raw.minutesPlayed))}}
function goalieActive(raw:Row){const s=goalieStat(raw);return s.saves>0||s.goals_against>0||s.minutes_played>0}

async function loadFantasyPlayers(sb:any){const rows:any[]=[];for(let from=0;;from+=1000){const{data,error}=await sb.from("fantasy_players").select("id,external_id,name,team,position,on_current_roster").range(from,from+999);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)break}return rows}
function findPlayer(raw:Row,players:any[]){const ext=externalPerson(raw),name=fullName(raw),tm=team(raw);if(ext){const exactId=players.filter(p=>String(p.external_id||"")===`nif:${ext}`||String(p.external_id||"")===ext);if(exactId.length===1)return exactId[0]}
 const nk=norm(name),tk=canonicalTeam(tm);let candidates=tk?players.filter(p=>canonicalTeam(p.team)===tk):players;
 const exact=candidates.filter(p=>norm(p.name)===nk);if(exact.length===1)return exact[0];
 const st=nameTokens(name),firstName=st[0]||"",lastName=st[st.length-1]||"";const firstLast=candidates.filter(p=>{const t=nameTokens(p.name);return t.length>=2&&t[0]===firstName&&t[t.length-1]===lastName});if(firstLast.length===1)return firstLast[0];
 if(!tk){const globalExact=players.filter(p=>norm(p.name)===nk);if(globalExact.length===1)return globalExact[0]}
 return null}

function personKey(raw:Row){const ext=externalPerson(raw);return ext?`id:${ext}`:`name:${norm(fullName(raw))}`}
function mergedLineup(teamMembers:Row[],statPlayers:Row[]){const map=new Map<string,Row>();for(const raw of teamMembers){const name=fullName(raw);if(!name)continue;map.set(personKey(raw),{...raw,__source:"team-members"})}for(const raw of statPlayers){const name=fullName(raw);if(!name)continue;const key=personKey(raw),existing=map.get(key)||{};map.set(key,{...existing,...raw,__source:existing.__source?"team-members+players":"players"})}return[...map.values()]}
function goalTeamCounts(goals:Row[]){const counts=new Map<string,number>();for(const g of goals){const key=canonicalTeam(first(g.teamName,g.TeamName,g.teamShortName,g.TeamShortName));if(key)counts.set(key,(counts.get(key)||0)+1)}return counts}

export async function importPreseasonHockeyLiveMatch(preseasonGameId:number){
 const sb=serverClient();
 const{data:game,error:gameError}=await sb.from("fantasy_preseason_games").select("*").eq("id",preseasonGameId).single();if(gameError)throw gameError;
 const matchId=Number(game.hockeylive_match_id);if(!Number.isInteger(matchId)||matchId<=0)throw new Error("Treningskampen mangler gyldig HockeyLive matchId");
 const bundle=await fetchNifMatchBundle(matchId);
 const players=await loadFantasyPlayers(sb);
 const goalieIds=new Set(bundle.goalies.map(r=>externalPerson(r)).filter(Boolean));
 const lineup=mergedLineup(bundle.teamMembers,bundle.players);
 let imported=0,matched=0,unmatched=0,skippedStaff=0;

 for(const raw of lineup){
  if(goalieIds.has(externalPerson(raw))||pos(raw,false)==="G")continue;
  const name=fullName(raw);if(!name)continue;
  const player=findPlayer(raw,players);const rawTeam=team(raw);const tm=rawTeam||player?.team||"Ukjent";const inferredPos=player?.position||pos(raw,false);
  // MatchTeamMembers can contain coaches/staff. Without a fantasy-player match or player-like position, do not create a stat row.
  if(!player&&!inferredPos){skippedStaff++;continue}
  const stat=skaterStat(raw);
  const row={preseason_game_id:game.id,player_id:player?.id||null,raw_player_name:name,team:tm,position:inferredPos,did_play:true,...stat,source_type:"hockeylive",source_quality:bundle.players.some(p=>personKey(p)===personKey(raw))?0.95:0.90,raw:{source:raw.__source||"hockeylive-lineup",matchId,availability:bundle.availability,...raw},updated_at:new Date().toISOString()};
  const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;imported++;if(player)matched++;else unmatched++;
 }

 const activePerTeam=new Map<string,number>();for(const raw of bundle.goalies){if(!goalieActive(raw))continue;const key=canonicalTeam(team(raw));activePerTeam.set(key,(activePerTeam.get(key)||0)+1)}
 for(const raw of bundle.goalies){const name=fullName(raw);if(!name)continue;const player=findPlayer(raw,players);const tm=team(raw)||player?.team||"Ukjent";const stat=goalieStat(raw);const active=goalieActive(raw);const wins=n(first(raw.wins,raw.Wins,raw.win,raw.Win),0)>0;const shutout=active&&stat.goals_against===0&&(activePerTeam.get(canonicalTeam(tm))||0)===1;
  const row={preseason_game_id:game.id,player_id:player?.id||null,raw_player_name:name,team:tm,position:"G",did_play:active,goals:0,assists:0,shots:0,plus_minus:0,pim:0,...stat,win:wins,shutout,powerplay_goals:0,powerplay_assists:0,shorthanded_goals:0,shorthanded_assists:0,source_type:"hockeylive",source_quality:0.95,raw:{source:"hockeylive-goalie-leaders",matchId,availability:bundle.availability,...raw},updated_at:new Date().toISOString()};
  const{error}=await sb.from("fantasy_preseason_player_stats").upsert(row,{onConflict:"preseason_game_id,raw_player_name,team"});if(error)throw error;imported++;if(player)matched++;else unmatched++;
 }

 const counts=goalTeamCounts(bundle.goals),homeKey=canonicalTeam(game.home_team),awayKey=canonicalTeam(game.away_team);const home=counts.get(homeKey),away=counts.get(awayKey);const patch:any={source_type:"hockeylive",source_quality:0.95,updated_at:new Date().toISOString()};if(home!==undefined&&away!==undefined&&home+away===bundle.goals.length){patch.home_score=home;patch.away_score=away;patch.status="finished"}
 const{error:updateError}=await sb.from("fantasy_preseason_games").update(patch).eq("id",game.id);if(updateError)throw updateError;
 return{preseasonGameId:game.id,matchId,rows:imported,matched,unmatched,skippedStaff,lineupCandidates:lineup.length,players:bundle.players.length,teamMembers:bundle.teamMembers.length,goalies:bundle.goalies.length,goals:bundle.goals.length,penalties:bundle.penalties.length,availability:bundle.availability};
}

export async function importAllPreseasonHockeyLive(){
 const sb=serverClient();const{data,error}=await sb.from("fantasy_preseason_games").select("id,hockeylive_match_id,home_team,away_team").eq("season","2026/27").not("hockeylive_match_id","is",null).order("game_date");if(error)throw error;
 const results:any[]=[];for(const g of data||[]){try{results.push({ok:true,...await importPreseasonHockeyLiveMatch(Number(g.id))})}catch(error:any){results.push({ok:false,preseasonGameId:g.id,matchId:g.hockeylive_match_id,game:`${g.home_team} - ${g.away_team}`,error:error?.message||String(error)})}}
 return{attempted:results.length,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
}
