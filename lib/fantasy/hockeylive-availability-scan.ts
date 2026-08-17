import {fetchNifMatchBundle} from "./nif-client";

export type FantasyRosterPlayer={id:string;external_id?:string|null;name:string;team:string};
export type AvailabilityGame={id:string;game_date:string;home_team:string;away_team:string;match_id:number|null;source_url?:string|null;game_type:"preseason"|"regular"};
type Row=Record<string,unknown>;

const text=(v:unknown)=>v==null?"":String(v).trim();
const ascii=(v:unknown)=>text(v).toLocaleLowerCase("nb-NO").replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"aa").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const norm=(v:unknown)=>ascii(v).replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const canonicalTeam=(v:unknown)=>{const s=ascii(v);if(s.includes("nidaros"))return"nidaros";if(s.includes("lorenskog"))return"lorenskog";if(s.includes("storhamar"))return"storhamar";if(s.includes("stavanger")||s.includes("oilers"))return"oilers";if(s.includes("valerenga")||s.includes("vaalerenga"))return"valerenga";if(s.includes("frisk"))return"frisk";if(s.includes("sparta"))return"sparta";if(s.includes("narvik"))return"narvik";if(s.includes("stjernen"))return"stjernen";if(s.includes("lillehammer"))return"lillehammer";if(s.includes("ringerike"))return"ringerike";return norm(v).replace(/ /g,"")};
const rowTeam=(r:Row)=>text(r.teamName??r.TeamName??r.team??r.Team??r.clubName??r.ClubName??r.orgName??r.OrgName??r.organizationName??r.OrganizationName??r.teamShortName??r.TeamShortName);
const rowName=(r:Row)=>{const direct=text(r.playerName??r.PlayerName??r.name??r.Name??r.fullName??r.FullName??r.personName??r.PersonName??r.memberName??r.MemberName);if(direct)return direct;return[text(r.firstName??r.FirstName??r.givenName),text(r.lastName??r.LastName??r.familyName)].filter(Boolean).join(" ").trim()};
const rowPersonId=(r:Row)=>text(r.personId??r.PersonId??r.playerId??r.PlayerId??r.person_id??r.id??r.Id);
function inLineup(player:FantasyRosterPlayer,members:Row[]){const ext=String(player.external_id||"").replace(/^nif:/,"");if(ext&&members.some(m=>rowPersonId(m)===ext))return true;const nk=norm(player.name);return members.some(m=>norm(rowName(m))===nk)}
function distinctTeamValues(rows:Row[]){return [...new Set(rows.map(rowTeam).filter(Boolean))].slice(0,8)}
function structureDiagnostic(rows:Row[]){
 const keys=[...new Set(rows.slice(0,8).flatMap(r=>Object.keys(r)))].sort().slice(0,80);
 const teamFields=keys.filter(k=>/(team|club|org|association|side|home|away)/i.test(k));
 const teamFieldValues:Record<string,string[]>=Object.fromEntries(teamFields.map(k=>[k,[...new Set(rows.map(r=>text(r[k])).filter(Boolean))].slice(0,8)]).filter(([,v])=>v.length));
 return{keys,teamFieldValues};
}

export async function scanHockeyLiveMatchSquads(games:AvailabilityGame[],players:FantasyRosterPlayer[]){
 const findings:{sourceKind:"hockeylive";sourceLabel:string;sourceUrl:string;sourcePublishedAt:string;rawPlayerName:string;rawTeam:string;rawStatus:"not_in_lineup";rawNote:string;proposedPlayerId:string;matchMethod:"external_id"|"exact_name_team";matchConfidence:number;matchReason:string;reviewStatus:"pending"}[]=[];
 const diagnostics:{gameId:string;gameType:string;game:string;matchId:number|null;status:string;rawMembers?:number;rawTeams?:string[];keys?:string[];teamFieldValues?:Record<string,string[]>;homeMembers?:number;awayMembers?:number;missing?:number;error?:string}[]=[];
 for(const game of games){const matchId=Number(game.match_id);if(!Number.isInteger(matchId)||matchId<=0){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId:null,status:"skipped-no-match-id"});continue}
  try{const bundle=await fetchNifMatchBundle(matchId);if(!bundle.availability.teamMembers){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,status:"skipped-team-members-unavailable"});continue}
   const rawMembers=bundle.teamMembers.length,rawTeams=distinctTeamValues(bundle.teamMembers),structure=structureDiagnostic(bundle.teamMembers),hk=canonicalTeam(game.home_team),ak=canonicalTeam(game.away_team),homeMembers=bundle.teamMembers.filter(m=>canonicalTeam(rowTeam(m))===hk),awayMembers=bundle.teamMembers.filter(m=>canonicalTeam(rowTeam(m))===ak);
   if(homeMembers.length<10||awayMembers.length<10){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,status:rawMembers===0?"skipped-empty-team-members":"skipped-incomplete-lineup",rawMembers,rawTeams,keys:structure.keys,teamFieldValues:structure.teamFieldValues,homeMembers:homeMembers.length,awayMembers:awayMembers.length});continue}
   const sourceUrl=game.source_url||`https://live.hockey.no/match?matchId=${matchId}`,published=new Date(`${game.game_date}T12:00:00+02:00`).toISOString();let missing=0;
   for(const [team,members] of [[game.home_team,homeMembers],[game.away_team,awayMembers]] as const){const roster=players.filter(p=>canonicalTeam(p.team)===canonicalTeam(team));for(const p of roster){if(inLineup(p,members))continue;missing++;const ext=String(p.external_id||"").replace(/^nif:/,"");findings.push({sourceKind:"hockeylive",sourceLabel:"HockeyLive kamptropp",sourceUrl,sourcePublishedAt:published,rawPlayerName:p.name,rawTeam:p.team,rawStatus:"not_in_lineup",rawNote:`Ikke registrert i HockeyLive MatchTeamMembers for ${game.home_team} – ${game.away_team} ${game.game_date} (${game.game_type}). Dette sier ikke hvorfor spilleren mangler.`,proposedPlayerId:p.id,matchMethod:ext?"external_id":"exact_name_team",matchConfidence:ext?1:0.99,matchReason:`Strukturert HockeyLive-kontroll mot aktiv roster for matchId ${matchId}. Fravær fra kamptropp tolkes kun som not_in_lineup.`,reviewStatus:"pending"})}}
   diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,status:"scanned",rawMembers,rawTeams,homeMembers:homeMembers.length,awayMembers:awayMembers.length,missing});
  }catch(e:any){diagnostics.push({gameId:game.id,gameType:game.game_type,game:`${game.home_team} – ${game.away_team}`,matchId,status:"error",error:e?.message||String(e)})}}
 return{findings,diagnostics};
}
