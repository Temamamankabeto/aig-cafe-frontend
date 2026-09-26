"use client";
import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import api from "@/lib/api";
import {Locale,locales,translate,translateUiText} from "./translations";
const STORAGE_KEY="aig_locale";
export type ManagedLanguage={id:number;code:string;name:string;native_name:string;is_default:boolean;is_active:boolean};
type Ctx={locale:string;setLocale:(l:string)=>void;t:(key:string)=>string;languages:ManagedLanguage[];refreshLanguages:()=>Promise<void>};
const fallback:ManagedLanguage[]=[{id:0,code:"en",name:"English",native_name:"English",is_default:true,is_active:true},{id:0,code:"om",name:"Afaan Oromoo",native_name:"Afaan Oromoo",is_default:false,is_active:true},{id:0,code:"am",name:"Amharic",native_name:"አማርኛ",is_default:false,is_active:true}];
const LanguageContext=createContext<Ctx>({locale:"en",setLocale:()=>{},t:k=>k,languages:fallback,refreshLanguages:async()=>{}});
const ATTRS=["placeholder","title","aria-label"] as const;
function translated(locale:string,remote:Record<string,string>,raw:string){
 const lead=raw.match(/^\s*/)?.[0]??"",trail=raw.match(/\s*$/)?.[0]??"",core=raw.trim();if(!core)return raw;
 const direct=remote[core];if(direct!==undefined)return lead+direct+trail;
 if(locales.includes(locale as Locale))return translateUiText(locale as Locale,raw);
 return raw;
}
function applyLocale(root:ParentNode,locale:string,remote:Record<string,string>){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n:Node|null;
 while((n=walker.nextNode())){const el=n.parentElement;if(!el||["SCRIPT","STYLE","CODE","PRE"].includes(el.tagName)||el.closest("[data-no-translate]"))continue;const raw=n.nodeValue||"";if(!/[A-Za-z]/.test(raw.trim()))continue;const next=translated(locale,remote,raw);if(next!==raw)n.nodeValue=next;}
 const els=(root instanceof Element?[root,...Array.from(root.querySelectorAll("*"))]:Array.from(root.querySelectorAll("*"))) as Element[];
 for(const el of els){if(el.closest("[data-no-translate]"))continue;for(const a of ATTRS){const v=el.getAttribute(a);if(v&&/[A-Za-z]/.test(v))el.setAttribute(a,translated(locale,remote,v));}}
}
export function LanguageProvider({children}:{children:React.ReactNode}){
 const[locale,setLocaleState]=useState<string>("en");const[languages,setLanguages]=useState<ManagedLanguage[]>(fallback);const[remote,setRemote]=useState<Record<string,string>>({});
 const refreshLanguages=useCallback(async()=>{try{const r=await api.get('/languages/active');const ls=r.data?.data??[];if(ls.length){setLanguages(ls);const stored=localStorage.getItem(STORAGE_KEY);if(!stored||!ls.some((x:ManagedLanguage)=>x.code===stored)){const d=ls.find((x:ManagedLanguage)=>x.is_default)?.code||ls[0].code;setLocaleState(d);localStorage.setItem(STORAGE_KEY,d);}}}catch{}},[]);
 useEffect(()=>{const v=localStorage.getItem(STORAGE_KEY);if(v)setLocaleState(v);refreshLanguages();},[refreshLanguages]);
 useEffect(()=>{let cancelled=false;document.documentElement.lang=locale;api.get(`/languages/${encodeURIComponent(locale)}/dictionary`).then(r=>{if(!cancelled)setRemote(r.data?.data??{})}).catch(()=>{if(!cancelled)setRemote({})});return()=>{cancelled=true}},[locale]);
 useEffect(()=>{document.documentElement.lang=locale;applyLocale(document.body,locale,remote);const o=new MutationObserver(ms=>{for(const m of ms){if(m.type==="characterData"&&m.target.parentNode)applyLocale(m.target.parentNode as ParentNode,locale,remote);for(const node of Array.from(m.addedNodes))if(node.nodeType===1)applyLocale(node as Element,locale,remote);}});o.observe(document.body,{subtree:true,childList:true,characterData:true});return()=>o.disconnect();},[locale,remote]);
 const setLocale=useCallback((l:string)=>{localStorage.setItem(STORAGE_KEY,l);document.documentElement.lang=l;location.reload();},[]);
 const t=useCallback((key:string)=>remote[key]??(locales.includes(locale as Locale)?translate(locale as Locale,key):key),[locale,remote]);
 const value=useMemo(()=>({locale,setLocale,t,languages,refreshLanguages}),[locale,setLocale,t,languages,refreshLanguages]);return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
