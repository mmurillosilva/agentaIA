
const FIELDS = ["date","campaign","campaign_id","spend","impressions","clicks","actions_lead","ad_name","adset_name","ad_id"];
const BRANCHES = ["Todas","Zona Norte","Zona Centro","Zona Sur","Zona Este"];
const TOOLS = [
 {type:"function",name:"get_campaign_performance",description:"Consulta métricas en vivo de Meta Ads para el periodo fijado por el dashboard y la zona seleccionada o mencionada. Incluye agrupación por categoría según nombres de campaña/anuncio. Usar para rendimiento, leads, CPL, CTR, zonas, campañas o anuncios.",parameters:{type:"object",properties:{branch:{type:"string",enum:BRANCHES,description:"Zona mencionada en la pregunta; si no se menciona una, usa la zona seleccionada"},focus:{type:"string",enum:["overview","campaigns","ads","zones","categories"],description:"Qué resumen necesita: global, campañas, anuncios o zonas"}},required:["branch","focus"],additionalProperties:false},strict:true},
 {type:"function",name:"get_campaign_detail",description:"Busca una campaña o anuncio por nombre dentro del periodo fijado y la zona seleccionada o mencionada. Usa los datos devueltos para contestar por nombre, sin exponer IDs como título.",parameters:{type:"object",properties:{branch:{type:"string",enum:BRANCHES,description:"Zona mencionada en la pregunta; si no se menciona una, usa la zona seleccionada"},query:{type:"string",description:"Nombre o fragmento de campaña, categoría, producto o anuncio"}},required:["branch","query"],additionalProperties:false},strict:true}
];
const SYSTEM = `Eres el agente de análisis de campañas de marketing para SmartBrands. Responde en español, claro y concreto. Para cualquier cifra, primero llama una herramienta: jamás inventes métricas ni uses el snapshot embebido en la página. Usa siempre el periodo fijado por el dashboard; no lo cambies por lo que pida el texto del usuario. Si el usuario menciona explícitamente una zona, consulta esa zona; en otro caso conserva la zona seleccionada en el panel. Da nombres de campaña/anuncio como identificadores legibles; usa ID solo si lo piden. Calcula CPL como inversión/leads y CTR como clics/impresiones. Aclara cuando no hay leads, y nunca digas que una campaña se pausó, optimizó o cambió. Solo puedes consultar e interpretar datos, recomendar revisiones y explicar límites: los leads son atribuciones de Meta, no calidad CRM.`;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
function branchOf(text="") { const x=text.toUpperCase(); if(x.includes("ZONA NORTE"))return "Zona Norte";if(x.includes("ZONA CENTRO"))return "Zona Centro";if(x.includes("ZONA SUR"))return "Zona Sur";if(x.includes("ZONA ESTE"))return "Zona Este";return ""; }
function cleanRows(payload){ if(Array.isArray(payload))return payload; if(Array.isArray(payload?.data))return payload.data; if(Array.isArray(payload?.rows))return payload.rows; return []; }
function round(n,d=2){return Number(Number(n||0).toFixed(d));}
async function loadRows(env,period,branch){
 const preset=period===7?"last_7d":"last_30d";
 const url=new URL("https://connectors.windsor.ai/facebook");
 url.searchParams.set("api_key",env.WINDSOR_API_KEY);url.searchParams.set("select_accounts",env.WINDSOR_ACCOUNT);url.searchParams.set("fields",FIELDS.join(","));url.searchParams.set("date_preset",preset);
 const resp=await fetch(url.toString(),{headers:{"accept":"application/json"}});const body=await resp.json().catch(()=>null);
 if(!resp.ok)throw new Error("Windsor.ai no pudo devolver datos (HTTP "+resp.status+"). Revisa el secreto WINDSOR_API_KEY y el acceso de la cuenta.");
 let rows=cleanRows(body);if(!rows.length&&body?.status&&body.status!=="done")throw new Error("Windsor.ai reportó un error al consultar la cuenta.");
 if(branch!=="Todas")rows=rows.filter(r=>branchOf(r.campaign||r.adset_name||r.ad_name)===branch);
 return rows;
}
function aggregate(rows,keyFn){const map=new Map();for(const r of rows){const key=keyFn(r);if(!key)continue;let x=map.get(key);if(!x){x={name:key,spend:0,leads:0,clicks:0,impressions:0,days:new Set()};map.set(key,x)}x.spend+=Number(r.spend)||0;x.leads+=Number(r.actions_lead)||0;x.clicks+=Number(r.clicks)||0;x.impressions+=Number(r.impressions)||0;if(r.date)x.days.add(r.date)}return [...map.values()].map(x=>({name:x.name,spend:round(x.spend),leads:round(x.leads),cpl:x.leads?round(x.spend/x.leads):null,clicks:round(x.clicks),impressions:round(x.impressions),ctr:x.impressions?round(x.clicks/x.impressions*100,2):0,days:x.days.size}));}
async function runTool(name,args,env,period,selectedBranch){const branch=BRANCHES.includes(args.branch)?args.branch:selectedBranch;const rows=await loadRows(env,period,branch);if(!rows.length)return {period,branch,rows:0,message:"No se encontraron registros en Windsor.ai para este filtro. Revisa que la campaña incluya la zona configurada o consulta sin filtro de zona."};
 if(name==="get_campaign_detail"){const q=String(args.query||"").trim().toLowerCase();if(!q)return {message:"Especifica el nombre de campaña, categoría, producto o anuncio que quieres buscar."};const matches=rows.filter(r=>[r.campaign,r.ad_name,r.adset_name].some(v=>String(v||"").toLowerCase().includes(q)));return {period,branch,query:args.query,matches:matches.length,campaigns:aggregate(matches,r=>r.campaign).sort((a,b)=>b.leads-a.leads).slice(0,12),ads:aggregate(matches,r=>r.ad_name).sort((a,b)=>b.leads-a.leads).slice(0,12)};}
 const campaigns=aggregate(rows,r=>r.campaign).sort((a,b)=>b.leads-a.leads),ads=aggregate(rows,r=>r.ad_name).sort((a,b)=>b.leads-a.leads),branches=aggregate(rows,r=>branchOf(r.campaign||r.adset_name||r.ad_name)||"Sin zona").sort((a,b)=>(a.cpl??Infinity)-(b.cpl??Infinity));
 const categoryNames=["CATEGORIA A","CATEGORIA B","CATEGORIA C","CATEGORIA D"];
 const categoriesByZone=[];const categoryMap=new Map();for(const r of rows){const zona=branchOf(r.campaign||r.adset_name||r.ad_name);const text=[r.campaign,r.adset_name,r.ad_name].join(" ").toUpperCase();const category=categoryNames.find(x=>new RegExp("(^|[^A-Z])"+x+"([^A-Z]|$)").test(text));if(!zona||!category)continue;const key=zona+"|"+category;let b=categoryMap.get(key);if(!b){b={branch:zona,category,spend:0,leads:0,clicks:0,impressions:0};categoryMap.set(key,b)}b.spend+=Number(r.spend)||0;b.leads+=Number(r.actions_lead)||0;b.clicks+=Number(r.clicks)||0;b.impressions+=Number(r.impressions)||0;}for(const b of categoryMap.values())categoriesByZone.push({branch:b.branch,category:b.category,spend:round(b.spend),leads:round(b.leads),cpl:b.leads?round(b.spend/b.leads):null,clicks:round(b.clicks),impressions:round(b.impressions),ctr:b.impressions?round(b.clicks/b.impressions*100,2):0});categoriesByZone.sort((a,b)=>b.leads-a.leads);
 return {period,branch,rows:rows.length,total:{spend:round(rows.reduce((s,r)=>s+(Number(r.spend)||0),0)),leads:round(rows.reduce((s,r)=>s+(Number(r.actions_lead)||0),0)),clicks:round(rows.reduce((s,r)=>s+(Number(r.clicks)||0),0)),impressions:round(rows.reduce((s,r)=>s+(Number(r.impressions)||0),0))},campaigns:campaigns.slice(0,20),topAds:ads.slice(0,12),zones:branches.filter(x=>x.name!=="Sin zona"),categoriesByZone};
}
export async function onRequestPost({request,env}){
 if(!env.OPENAI_API_KEY||!env.WINDSOR_API_KEY||!env.WINDSOR_ACCOUNT)return json({error:"Faltan OPENAI_API_KEY, WINDSOR_API_KEY o WINDSOR_ACCOUNT en la configuración del servidor."},503);
 let body;try{body=await request.json()}catch{return json({error:"Solicitud JSON no válida."},400)}
 const messages=Array.isArray(body.messages)?body.messages.slice(-10):[];if(!messages.length||messages.length>10)return json({error:"Envía al menos un mensaje."},400);
 const period=Number(body.period)===7?7:30,branch=BRANCHES.includes(body.branch)?body.branch:"Todas";
 const input=messages.map(m=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,1500)}));
 let req={model:env.OPENAI_MODEL||"gpt-4.1-mini",instructions:SYSTEM+`\nPeriodo fijado por el dashboard: últimos ${period} días. Zona seleccionada: ${branch}. Si la pregunta menciona explícitamente otra zona, consulta esa zona; no cambies el periodo.`,input,tools:TOOLS,tool_choice:"auto",max_output_tokens:700};
 try{
  let response;
  for(let turn=0;turn<4;turn++){
   const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"authorization":"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify(req)});response=await r.json().catch(()=>null);
   if(!r.ok)throw new Error("OpenAI respondió con un error (HTTP "+r.status+"). Revisa OPENAI_API_KEY y el acceso al modelo.");
   const calls=(response?.output||[]).filter(x=>x.type==="function_call");if(!calls.length)break;
   const outputs=[];for(const call of calls){let args;try{args=JSON.parse(call.arguments||"{}")}catch{args={}};const result=await runTool(call.name,args,env,period,branch);outputs.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify(result)});}
   if(!response.id)throw new Error("La respuesta del modelo no incluye id para continuar las herramientas.");req={model:env.OPENAI_MODEL||"gpt-4.1-mini",instructions:SYSTEM+`\nPeriodo fijado por el dashboard: últimos ${period} días. Zona seleccionada: ${branch}. Si la pregunta menciona explícitamente otra zona, consulta esa zona; no cambies el periodo.`,previous_response_id:response.id,input:outputs,tools:TOOLS,tool_choice:"auto",max_output_tokens:700};
  }
  const reply=String(response?.output_text||"").trim();if(!reply)throw new Error("El agente terminó sin texto de respuesta.");return json({reply});
 }catch(e){return json({error:e.message||"Error consultando al agente."},502)}
}
