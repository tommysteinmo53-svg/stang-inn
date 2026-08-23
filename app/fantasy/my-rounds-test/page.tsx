"use client";

import RoundPointsView,{type RoundDetail} from "../my-rounds/RoundPointsView";
import "../fantasy.css";

const base={
 round_id:"visual-round-1",
 round_no:1,
 round_name:"Fantasy-runde 1",
 deadline_at:"2026-09-12T16:00:00Z",
 snapshot_id:"visual-snapshot-1",
 captured_at:"2026-09-12T16:00:00Z",
 team_round_points_id:"visual-team-round-1",
 team_id:"visual-team-1",
 team_name:"Stang Inn Test XI",
 squad_value:99.4,
 is_scored:true,
 base_points:63,
 captain_bonus:8,
 vice_captain_bonus:2.5,
 round_points:73.5,
 calculated_at:"2026-09-13T21:00:00Z",
 transfer_count:2,
 transfers:[{
  batch_id:"visual-transfer-1",
  created_at:"2026-09-11T18:00:00Z",
  transfer_count:2,
  before_cost:98.8,
  after_cost:99.4,
  outgoing:[
   {player_id:"out-1",name:"Tidligere spiller A",team:"Narvik",position:"W",price:7.5},
   {player_id:"out-2",name:"Tidligere spiller B",team:"Sparta Elite",position:"D",price:8.0}
  ],
  incoming:[
   {player_id:"in-1",name:"Ny spiller A",team:"Stavanger Oilers",position:"W",price:8.1},
   {player_id:"in-2",name:"Ny spiller B",team:"Storhamar Elite",position:"D",price:8.0}
  ]
 }]
};

const players=[
 ["g1","Testkeeper A","G","Frisk Asker Elite",9.0,1,false,false,true,1,9,1,1,0,9],
 ["d1","Testback A","D","Storhamar Elite",8.0,1,false,false,true,1,7,1,1,0,7],
 ["d2","Testback B","D","Sparta Elite",7.7,1,false,true,true,1,5,1,1.5,2.5,7.5],
 ["f1","Testforward A","C","Stavanger Oilers",9.2,1,true,false,true,1,8,1,2,8,16],
 ["f2","Testforward B","W","Lillehammer Elite",8.4,1,false,false,true,1,7,1,1,0,7],
 ["f4","Testforward D","W","Nidaros Ishockeyklubb",7.9,1,false,false,true,1,5,1,1,0,5],
 ["g2","Testkeeper B","G","Narvik",7.0,2,false,false,false,0,0,.5,.5,0,0],
 ["d3","Testback C","D","Vålerenga",7.6,2,false,false,true,1,4,.5,.5,0,2],
 ["d4","Testback D","D","Stjernen Elite",7.4,2,false,false,true,1,3,.5,.5,0,1.5],
 ["f3","Testforward C","C","Ringerike",7.8,2,false,false,true,1,6,.5,.5,0,3],
 ["f5","Testforward E","W","Frisk Asker Elite",8.0,2,false,false,true,1,4,.5,.5,0,2],
 ["f6","Testforward F","C","Narvik",8.4,2,false,false,true,1,5,.5,.5,0,2.5]
] as const;

const rows:RoundDetail[]=players.map(([player_id,player_name,player_position,player_team,player_price,line_no,is_captain,is_vice_captain,played,games_played,raw_points,line_multiplier,multiplier,bonus_points,player_total_points])=>({
 ...base,
 player_id,player_name,player_position,player_team,player_price,line_no,is_captain,is_vice_captain,played,games_played,raw_points,line_multiplier,
 role_multiplier:Number(multiplier)/Number(line_multiplier),
 multiplier,bonus_points,player_total_points
}));

export default function MyRoundsVisualTestPage(){return <RoundPointsView rows={rows} title="Rundehistorikk · visuell test" intro="Isolert snapshot-test med to rekker, C/VC, score og transfers. Ingen Supabase-data leses eller endres." testMode/>}
