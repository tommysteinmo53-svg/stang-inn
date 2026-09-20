"use client";
import {useEffect,useRef} from "react";

/** Refresh read-only data while visible, and immediately on returning to the app. */
export function useVisibleRefresh(refresh:()=>Promise<unknown>,enabled=true){
 const latest=useRef(refresh);
 useEffect(()=>{latest.current=refresh},[refresh]);
 useEffect(()=>{
  if(!enabled)return;
  let pending=false,stopped=false;
  const run=async()=>{
   if(stopped||pending||document.visibilityState!=="visible")return;
   pending=true;
   try{await latest.current()}catch(error){console.error("Result refresh failed",error)}finally{pending=false}
  };
  const timer=window.setInterval(run,30_000);
  window.addEventListener("focus",run);
  document.addEventListener("visibilitychange",run);
  return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener("focus",run);document.removeEventListener("visibilitychange",run)};
 },[enabled]);
}
