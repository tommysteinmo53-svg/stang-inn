export type AvailabilityRosterPlayer={id:string;name:string;team:string};

export type AvailabilityMatch={
  proposedPlayerId:string|null;
  matchMethod:"exact_name_team"|"exact_name"|"normalized_name_team"|null;
  matchConfidence:number|null;
  matchReason:string;
  reviewStatus:"pending"|"needs_review";
};

function normalize(value:string){
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim()
    .replace(/\s+/g," ");
}

export function matchAvailabilityFinding(rawName:string,rawTeam:string|null|undefined,players:AvailabilityRosterPlayer[]):AvailabilityMatch{
  const name=normalize(rawName);
  const team=normalize(rawTeam||"");
  if(!name)return{proposedPlayerId:null,matchMethod:null,matchConfidence:null,matchReason:"Mangler spillernavn.",reviewStatus:"needs_review"};

  const sameName=players.filter(p=>normalize(p.name)===name);
  if(team){
    const sameNameTeam=sameName.filter(p=>normalize(p.team)===team);
    if(sameNameTeam.length===1){
      const p=sameNameTeam[0];
      const exact=p.name.trim().toLowerCase()===rawName.trim().toLowerCase()&&p.team.trim().toLowerCase()===(rawTeam||"").trim().toLowerCase();
      return{proposedPlayerId:p.id,matchMethod:exact?"exact_name_team":"normalized_name_team",matchConfidence:exact?1:0.99,matchReason:`Entydig navn + klubb: ${p.name} (${p.team}).`,reviewStatus:"pending"};
    }
    if(sameNameTeam.length>1)return{proposedPlayerId:null,matchMethod:null,matchConfidence:null,matchReason:"Flere aktive roster-spillere matcher både navn og klubb. Må kontrolleres manuelt.",reviewStatus:"needs_review"};
    if(sameName.length===1){
      const p=sameName[0];
      return{proposedPlayerId:p.id,matchMethod:"exact_name",matchConfidence:0.6,matchReason:`Navnet matcher ${p.name}, men kildeklubb '${rawTeam}' avviker fra rosterklubb '${p.team}'.`,reviewStatus:"needs_review"};
    }
    return{proposedPlayerId:null,matchMethod:null,matchConfidence:null,matchReason:"Ingen sikker roster-match på navn + klubb.",reviewStatus:"needs_review"};
  }

  if(sameName.length===1){
    const p=sameName[0];
    return{proposedPlayerId:p.id,matchMethod:"exact_name",matchConfidence:0.85,matchReason:`Entydig navn i aktiv roster: ${p.name} (${p.team}), men kilden mangler klubb.`,reviewStatus:"needs_review"};
  }
  if(sameName.length>1)return{proposedPlayerId:null,matchMethod:null,matchConfidence:null,matchReason:"Flere aktive roster-spillere har samme navn. Klubb eller sikker ID kreves.",reviewStatus:"needs_review"};
  return{proposedPlayerId:null,matchMethod:null,matchConfidence:null,matchReason:"Ingen sikker roster-match på spillernavn.",reviewStatus:"needs_review"};
}
