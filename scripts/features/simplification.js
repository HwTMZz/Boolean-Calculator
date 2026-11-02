function combineTerms(a,b){
  if(a.length!==b.length) return null;
  let diff=0,res='';
  for(let i=0;i<a.length;i++){
    if(a[i]===b[i]) res+=a[i];
    else if(a[i]==='-'||b[i]==='-') return null;
    else { diff++; res+='-'; }
  }
  return diff===1?res:null;
}

function quineMcCluskey(minterms, numVars){
  if(minterms.length===0) return {primeImplicants:[], essential:[], steps:[]};
  let currentLevel=[...new Set(minterms.map(m=>m.toString(2).padStart(numVars,'0')))];
  const primeImplicants=new Set(); const steps=[];
  let level=1;
  while(currentLevel.length>0){
    const used=new Set(); const next=new Set();
    for(let i=0;i<currentLevel.length;i++){
      for(let j=i+1;j<currentLevel.length;j++){
        const combined=combineTerms(currentLevel[i],currentLevel[j]);
        if(combined!==null){ next.add(combined); used.add(currentLevel[i]); used.add(currentLevel[j]); }
      }
    }
    currentLevel.forEach(t=>{ if(!used.has(t)) primeImplicants.add(t); });
    steps.push(`Round ${level}: combined ${currentLevel.length} term(s) -> ${next.size} new term(s), ${currentLevel.filter(t=>!used.has(t)).length} could not combine further.`);
    currentLevel=[...next]; level++;
  }
  function covers(pi,minterm){
    const bits=minterm.toString(2).padStart(numVars,'0');
    for(let i=0;i<pi.length;i++){ if(pi[i]!=='-' && pi[i]!==bits[i]) return false; }
    return true;
  }
  const piList=[...primeImplicants];
  const chart=piList.map(pi=>minterms.filter(m=>covers(pi,m)));
  const essential=new Set(); const covered=new Set();
  minterms.forEach(m=>{
    const coveringPis=piList.filter(pi=>covers(pi,m));
    if(coveringPis.length===1) essential.add(coveringPis[0]);
  });
  essential.forEach(pi=>{ chart[piList.indexOf(pi)].forEach(m=>covered.add(m)); });
  let remaining=minterms.filter(m=>!covered.has(m));
  const chosen=new Set(essential);
  while(remaining.length>0){
    let best=null,bestCount=-1;
    piList.forEach((pi,idx)=>{
      if(chosen.has(pi)) return;
      const c=chart[idx].filter(m=>remaining.includes(m)).length;
      if(c>bestCount){bestCount=c;best=pi;}
    });
    if(!best||bestCount===0) break;
    chosen.add(best);
    remaining=remaining.filter(m=>!chart[piList.indexOf(best)].includes(m));
  }
  return {primeImplicants:piList, essential:[...chosen], steps};
}

function piToExpression(pi, vars){
  const parts=[];
  for(let i=0;i<pi.length;i++){ if(pi[i]==='1') parts.push(vars[i]); else if(pi[i]==='0') parts.push(`!${vars[i]}`); }
  return parts.length? parts.join(' & ') : '1';
}

function simplifyExpression(ast, vars){
  const rows=generateTruthTable(ast, vars);
  const minterms=[]; rows.forEach((r,i)=>{ if(r.result===1) minterms.push(i); });
  if(minterms.length===0) return {expr:'0', minterms, essential:[], steps:[]};
  if(minterms.length===(1<<vars.length)) return {expr:'1', minterms, essential:[], steps:[]};
  const {essential, steps}=quineMcCluskey(minterms, vars.length);
  const expr=essential.map(pi=>piToExpression(pi,vars)).join(' | ');
  return {expr, minterms, essential, steps};
}
