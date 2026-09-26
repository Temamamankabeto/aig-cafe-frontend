"use client";
import {Languages} from "lucide-react";
import {useLanguage} from "@/lib/i18n/LanguageProvider";
export function LanguageSwitcher(){const {locale,setLocale,languages}=useLanguage();return <label className="inline-flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-sm"><Languages className="h-4 w-4"/><select className="bg-transparent outline-none" value={locale} onChange={e=>setLocale(e.target.value)} aria-label="Language">{languages.map(l=><option key={l.code} value={l.code}>{l.native_name}</option>)}</select></label>}
export default LanguageSwitcher;
