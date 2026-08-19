import {fetchNifMatchBundle} from "./nif-client";

const PUBLIC_ROOT="https://sf34-terminlister-prod-app.azurewebsites.net";
const REQUEST_TIMEOUT_MS=10_000;

export type FantasyRosterPlayer={id:string;external_id?:string|null;name:string;team:string};
export type AvailabilityGame={id:string;game_date:string;home_team:string;away_team:string;match_id:number|null;tournament_id:number|null;source_url?:string|null;game_type:"preseason"|"regular"};
type Row=Record<string,unknown>;

type TeamOrgResolution={homeOrgId:string;awayOrgId:string;teamRows:number};

const text=(v:unknown)=>v==null?"":String(v).trim();
const ascii=(v:unknown)=>text(v).toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const norm=(v:unknown)=>ascii(v).replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const canonicalTeam=(v:unknown)=>{const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike")||s.includes("panthers"))return"ringerike";return norm(v).replace(/ /g,"")};
const rowName=(r:Row)=>{const direct=text(r.playerName??r.PlayerName??r.name??r.Name??r.fullName??r.FullName??r.personName??r.PersonName??r.memberName??r.MemberName);if(direct)return direct;return[text(r.firstName??r.FirstName??r.givenName),text(r.lastName??r.LastName??r.familyName)].filter(Boolean).join(" ").trim()};
const rowPersonId=(r:Row)=>text(r.personId??r.PersonId??r.playerId??r.PlayerId??r.person_id??r.id??r.Id);
const rowTeamOrgId=(r:Row)=>text(r.teamOrgId??r.TeamOrgId??r.orgId??r.OrgId??r.organizationId??r.OrganizationId??r.teamId??r.TeamId);
function inLineup(player:FantasyRosterPlayer,members:Row[]){const ext=String(player.external_id||"").replace(/^nif:/,"");if(ext&&members.some(m=>rowPersonId(m)===ext))return true;const nk=norm(player.name);return members.some(m=>norm(rowName(m))===nk)}
function structureDiagnostic(rows:Row[]){const keys=[...new Set(rows.slice(0,8).flatMap(r=>Object.keys(r)))].sort().slice(0,80);const teamFields=keys.filter(k=>/(team|club|org|association|side|home|away)/i.test(k));const teamFieldValues:Record<string,string[]>=Object.fromEntries(teamFields.map(k=>[k,[...new Set(rows.map(r=>text(r[k])).filter(Boolean))].slice(0,8)]).filter(([,v])=>v.length));return{keys,teamFieldValues}}
function rowsFrom(payload:unknown):Row[]{if(Array.isArray(payload))return payload as Row[];if(!payload||typeof payload!=="object")return[];const v=payload as Record<string,unknown>;for(const key of ["data","items","teams","result","results"]){if(Array.isArray(v[key]))return v[key] as Row[]}return[]}
function first(...values:unknown[]){return values.find(v=>v!==undefined&&v!==null&&v!=="")??null}
function teamName(r:Row){return text(first(r.teamName,r.tournamentTeamName,r.teamOverriddenName,r.orgName,r.name,r.clubName,r.team,(r.team as any)?.name,(r.organization as any)?.name))}
function teamOrgId(r:Row){return text(first(r.orgId,r.organizationId,r.clubId,r.teamOrgId,r.teamId,(r.team as any)?.orgId,(r.team as any)?.id,(r.organization as any)?.id,(r.organization as any)?.orgId))}
async function loadTournamentTeamResolution(tournamentId:number,homeTeam:string,awayTeam:string):Promise<TeamOrgResolution>{
 const url=`${PUBLIC_ROOT}/ta/TournamentTeams/?tournamentId=${encodeURIComponent(String(tournamentId))}`;
 const response=await fetch(url,{headers:{Accept:"application/json,text/plain,*/*","User-Agent":"StangInn/1.0 availability-team-org"},cache:"no-store",signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
 if(!response.ok)throw new Error(`TournamentTeams svarte ${response.status}`);
 const rows=rowsFrom(await response.json()),hk=canonicalTeam(homeTeam),ak=canonicalTeam(awayTeam);
 const homeIds=[...new Set(rows.filter(r=>canonicalTeam(teamName(r))===hk).map(teamOrgId).filter(Boolean))];
 const awayIds=[...new Set(rows.filter(r=>canonicalTeam(teamName(r))===ak).map(teamOrgId).filter(Boolean))];
 if(homeIds.length!==1||awayIds.length!==1||homeIds[0]===awayIds[0])throw new Error(`Entydig teamOrgId mangler (H ${homeIds.length}, B ${awayIds.length})`);
 return{homeOrgId:homeIds[0],awayOrgId:awayIds[0],teamRows:rows.length};
}

export async function scanHockeyLiveMatchSquads(games:AvailabilityGame[],players:FantasyRosterPlayer[]){
 const findings:{sourceKind:"hockeylive";sourceLabel:string;sourceUrl:string;sourcePublishedAt:string;rawPlayerName:string;rawTeam:string;rawStatus:"not_in_lineup";rawNote:string;proposedPlayerId:string;matchMethod:"external_id"|"exact_name_team";matchConfidence:number;matchReason:string;reviewStatus:"pending"}[]=[];
 const diagnostics:{gameId:string;gameType:string;game:string;matchId:number|null;tournamentId?:number|null;status:string;rawMembers?:number;keys?:string[];teamFieldValues?:Record<string,string[]>;teamRows?:number;homeOrgId?:string;awayOrgId?:string;homeMembers?:number;awayMembers?:number;missing?:number;error?:string}[]=[];
 const teamResolutionCache=new Map<string,Promise<TeamOrgResolution>>();
 for(const game of games){const matchId=Number(game.match_id),tournamentId=Number(game.tournament_id);if(!Number.isInteger(matchId)||matchId<=0){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId:null,tournamentId:game.tournament_id,status:"skipped-no-match-id"});continue}if(!Number.isInteger(tournamentId)||tournamentId<=0){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,tournamentId:game.tournament_id,status:"skipped-no-tournament-id"});continue}
  try{
   const bundle=await fetchNifMatchBundle(matchId);if(!bundle.availability.teamMembers){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,tournamentId,status:"skipped-team-members-unavailable"});continue}
   const rawMembers=bundle.teamMembers.length,structure=structureDiagnostic(bundle.teamMembers),cacheKey=`${tournamentId}|${canonicalTeam(game.home_team)}|${canonicalTeam(game.away_team)}`;
   let resolutionPromise=teamResolutionCache.get(cacheKey);if(!resolutionPromise){resolutionPromise=loadTournamentTeamResolution(tournamentId,game.home_team,game.away_team);teamResolutionCache.set(cacheKey,resolutionPromise)}
   let resolution:TeamOrgResolution;try{resolution=await resolutionPromise}catch(e:any){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,tournamentId,status:"skipped-team-org-unresolved",rawMembers,keys:structure.keys,teamFieldValues:structure.teamFieldValues,error:e?.message||String(e)});continue}
   const homeMembers=bundle.teamMembers.filter(m=>rowTeamOrgId(m)===resolution.homeOrgId),awayMembers=bundle.teamMembers.filter(m=>rowTeamOrgId(m)===resolution.awayOrgId);
   if(homeMembers.length<10||awayMembers.length<10){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,tournamentId,status:rawMembers===0?"skipped-empty-team-members":"skipped-incomplete-lineup",rawMembers,keys:structure.keys,teamFieldValues:structure.teamFieldValues,teamRows:resolution.teamRows,homeOrgId:resolution.homeOrgId,awayOrgId:resolution.awayOrgId,homeMembers:homeMembers.length,awayMembers:awayMembers.length});continue}
   const sourceUrl=game.source_url||`https://live.hockey.no/match?matchId=${matchId}`,published=new Date(`${game.game_date}T12:00:00+02:00`).toISOString();let missing=0;
   for(const [team,members] of [[game.home_team,homeMembers],[game.away_team,awayMembers]] as const){const roster=players.filter(p=>canonicalTeam(p.team)===canonicalTeam(team));for(const p of roster){if(inLineup(p,members))continue;missing++;const ext=String(p.external_id||"").replace(/^nif:/,"");findings.push({sourceKind:"hockeylive",sourceLabel:"HockeyLive kamptropp",sourceUrl,sourcePublishedAt:published,rawPlayerName:p.name,rawTeam:p.team,rawStatus:"not_in_lineup",rawNote:`Ikke registrert i HockeyLive MatchTeamMembers for ${game.home_team} – ${game.away_team} ${game.game_date} (${game.game_type}). Dette sier ikke hvorfor spilleren mangler.`,proposedPlayerId:p.id,matchMethod:ext?"external_id":"exact_name_team",matchConfidence:ext?1:0.99,matchReason:`Strukturert HockeyLive-kontroll mot aktiv roster for matchId ${matchId}; kamptropp fordelt med verifisert TournamentTeams teamOrgId. Fravær tolkes kun som not_in_lineup.`,reviewStatus:"pending"})}}
   diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,tournamentId,status:"scanned",rawMembers,teamRows:resolution.teamRows,homeOrgId:resolution.homeOrgId,awayOrgId:resolution.awayOrgId,homeMembers:homeMembers.length,awayMembers:awayMembers.length,missing});
  }catch(e:any){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,tournamentId:game.tournament_id,status:"error",error:e?.message||String(e)})}}
 return{findings,diagnostics};
}
