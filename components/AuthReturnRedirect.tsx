"use client";

import {useEffect} from "react";
import {getSupabaseBrowserClient,isSupabaseConfigured} from "../lib/supabase";

const KEY="stanginn_auth_return";

function safePath(value:string|null){
 if(!value||!value.startsWith("/")||value.startsWith("//"))return null;
 return value;
}

export default function AuthReturnRedirect(){
 useEffect(()=>{
  if(!isSupabaseConfigured)return;
  const path=window.location.pathname;
  if(path!=="/")return;
  const stored=safePath(window.localStorage.getItem(KEY));
  const query=safePath(new URLSearchParams(window.location.search).get("next"));
  const target=query||stored;
  if(!target||target==="/")return;
  const sb=getSupabaseBrowserClient();
  if(!sb)return;
  sb.auth.getSession().then(({data})=>{
   if(!data.session)return;
   window.localStorage.removeItem(KEY);
   window.location.replace(target);
  });
 },[]);
 return null;
}

export {KEY as AUTH_RETURN_KEY};
