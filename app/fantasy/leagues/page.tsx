import {redirect} from "next/navigation";

export default function FantasyLeaguesPage(){
  redirect("/leagues?view=fantasy");
}
