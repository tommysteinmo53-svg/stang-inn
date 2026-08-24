import {redirect} from "next/navigation";

export default async function FantasyLeaguePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  redirect(`/leagues/${id}?view=fantasy`);
}
