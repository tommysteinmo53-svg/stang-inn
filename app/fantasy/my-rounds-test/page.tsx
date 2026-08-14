"use client";

import RoundPointsView,{type RoundDetail} from "../my-rounds/RoundPointsView";
import "../fantasy.css";

const base={round_id:"visual-round-1",round_no:1,round_name:"Fantasy-runde 1",deadline_at:"2026-09-12T16:00:00Z",team_round_points_id:"visual-team-round-1",team_id:"visual-team-1",team_name:"Stang Inn Test XI",base_points:63,captain_bonus:8,vice_captain_bonus:2.5,round_points:73.5,calculated_at:"2026-09-13T21:00:00Z"};
const players=[
 ["g1","Testkeeper A","G","Frisk Asker Elite",false,false,true,1,9,1,0,9],
 ["g2","Testkeeper B","G","Narvik",false,false,false,0,0,1,0,0],
 ["d1","Testback A","D","Storhamar Elite",false,false,true,1,7,1,0,7],
 ["d2","Testback B","D","Sparta Elite",false,true,true,1,5,1.5,2.5,7.5],
 ["d3","Testback C","D","Vålerenga",false,false,true,1,4,1,0,4],
 ["d4","Testback D","D","Stjernen Elite",false,false,true,1,3,1,0,3],
 ["f1","Testforward A","C","Stavanger Oilers",true,false,true,1,8,2,8,16],
 ["f2","Testforward B","W","Lillehammer Elite",false,false,true,1,7,1,0,7],
 ["f3","Testforward C","C","Lørenskog Elite",false,false,true,2,6,1,0,6],
 ["f4","Testforward D","W","Nidaros Ishockeyklubb",false,false,true,1,5,1,0,5],
 ["f5","Testforward E","W","Frisk Asker Elite",false,false,true,1,4,1,0,4],
 ["f6","Testforward F","C","Narvik",false,false,true,1,5,1,0,5]
] as const;
const rows:RoundDetail[]=players.map(([player_id,player_name,player_position,player_team,is_captain,is_vice_captain,played,games_played,raw_points,multiplier,bonus_points,player_total_points])=>({...base,player_id,player_name,player_position,player_team,is_captain,is_vice_captain,played,games_played,raw_points,multiplier,bonus_points,player_total_points}));

export default function MyRoundsVisualTestPage(){return <RoundPointsView rows={rows} title="Rundepoeng · visuell test" intro="Isolert testvisning med C ×2 og VC ×1,5. Ingen Supabase-data leses eller endres." testMode/>}
