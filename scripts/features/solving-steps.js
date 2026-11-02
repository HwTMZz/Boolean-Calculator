// ---- Solving steps: animated Boolean expression evaluation ----
let traceSolveTimer=null;

function openTraceSolve(){
  const ast=tryParseCurrent(); if(!ast) return;
  const vars=extractVars(ast, VAR_ORDER);
  const bindings={};
  vars.forEach(v=>{ const a=state.assignments[v]; bindings[v]=(a==='0'||a==='1')?Number(a):0; });
  const model=state.truthTableModel || buildTruthTableModel(ast,vars);
  const rowIndex=model.rows.findIndex(row=>vars.every(variable=>row.bindings[variable]===bindings[variable]));
  const selectedRow=model.rows[rowIndex];
  const operations=orderedHowComeOperations(model.analysis.opNodes);
  const steps=operations.length
    ? operations.map(node=>({rowIndex,nodeId:node.id,result:selectedRow.values[node.id],type:node.type}))
    : [{rowIndex,nodeId:null,result:selectedRow.result,type:'RESULT'}];
  clearTraceSolveTimer();
  state.overlay={
    type:'solve',
    kind:'trace',
    model,
    steps,
    cursor:0,
    active:null,
    pendingSteps:0,
    completedNodesByRow:model.rows.map(()=>new Set()),
    subtitle:formatAstDisplay(ast)
  };
  render();
}

function clearTraceSolveTimer(){
  if(traceSolveTimer!==null){
    clearTimeout(traceSolveTimer);
    traceSolveTimer=null;
  }
}

function nextTraceSolveStep(){
  const progress=state.overlay;
  if(progress.cursor>=progress.steps.length) return;
  if(progress.active && (progress.active.phase<3 || progress.active.resizing)){
    if(progress.active.index+1+progress.pendingSteps<progress.steps.length){
      progress.pendingSteps++;
      updateTraceSolveControls();
    }
    return;
  }
  clearTraceSolveTimer();
  startTraceSolveAnimation(progress.cursor);
}

function prevTraceSolveStep(){
  const progress=state.overlay;
  if(!progress || progress.cursor===0 ||
    (progress.active && (progress.active.phase<3 || progress.active.resizing))) return;
  clearTraceSolveTimer();
  progress.pendingSteps=0;
  if(progress.cursor===1){
    progress.cursor=0;
    progress.active=null;
    restoreTraceSolveOperations(0);
    renderSolveOverlay();
    return;
  }
  const index=progress.cursor-2;
  progress.cursor=index;
  progress.active=null;
  restoreTraceSolveOperations(index);
  renderSolveOverlay();
  startTraceSolveAnimation(index);
}

function restoreTraceSolveOperations(cursor){
  const progress=state.overlay;
  progress.completedNodesByRow.forEach(completed=>completed.clear());
  for(let index=0;index<cursor;index++){
    const step=progress.steps[index];
    if(step.nodeId) progress.completedNodesByRow[step.rowIndex].add(step.nodeId);
  }
}

function startTraceSolveAnimation(index){
  const progress=state.overlay;
  const step=progress.steps[index];
  if(!step) return;
  progress.active={index,phase:1};
  updateTraceSolveExpression(index);
  updateTraceSolveControls();
  traceSolveTimer=setTimeout(()=>{
    traceSolveTimer=null;
    if(state.overlay!==progress) return;
    progress.active.phase=2;
    const active=document.querySelector('#trace-solve-expression [data-active-operation]');
    if(active) active.classList.add('how-operation-active');
    updateTraceSolveControls();
    traceSolveTimer=setTimeout(()=>{
      traceSolveTimer=null;
      if(state.overlay!==progress) return;
      progress.active.phase=3;
      progress.cursor=index+1;
      progress.active.resizing=true;
      if(step.nodeId) progress.completedNodesByRow[step.rowIndex].add(step.nodeId);
      animateTraceSolveResult(step.result,()=>{
        if(state.overlay!==progress) return;
        progress.active.resizing=false;
        updateTraceSolveControls();
        startQueuedTraceSolveStep(progress);
      });
      updateTraceSolveControls();
    },520);
  },320);
}

function updateTraceSolveExpression(index){
  const progress=state.overlay;
  const step=progress.steps[index];
  const row=progress.model.rows[step.rowIndex];
  const container=document.getElementById('trace-solve-expression');
  const status=document.getElementById('trace-solve-status');
  if(!container || !status) return;
  container.innerHTML=renderHowComeExpression(progress.model,progress,step,row);
  status.textContent=`Operation ${index+1} of ${progress.steps.length} · ${step.type==='RESULT'?'Evaluate expression':opDisplay(step.type)}`;
}

function animateTraceSolveResult(result,onComplete){
  const active=document.querySelector('#trace-solve-expression [data-active-operation]');
  if(!active){ onComplete(); return; }
  const current=active.getBoundingClientRect();
  active.style.transition='none';
  active.style.width=`${current.width}px`;
  active.style.height=`${current.height}px`;
  active.style.boxSizing='border-box';
  active.offsetWidth;
  active.textContent=String(result);
  active.classList.remove('how-operation-active');
  active.classList.add('how-operation-result');
  const measure=active.cloneNode(true);
  measure.className='how-operation-result';
  measure.style.position='absolute';
  measure.style.visibility='hidden';
  measure.style.width='auto';
  measure.style.height='auto';
  measure.style.transition='none';
  active.parentElement.appendChild(measure);
  const target=measure.getBoundingClientRect();
  measure.remove();
  let completed=false;
  const finish=()=>{
    if(completed) return;
    completed=true;
    active.removeEventListener('transitionend',onTransitionEnd);
    clearTraceSolveTimer();
    onComplete();
  };
  const onTransitionEnd=event=>{
    if(event.propertyName==='width') finish();
  };
  active.addEventListener('transitionend',onTransitionEnd);
  active.style.transition='';
  active.offsetWidth;
  active.style.width=`${target.width}px`;
  active.style.height=`${target.height}px`;
  traceSolveTimer=setTimeout(finish,600);
}

function startQueuedTraceSolveStep(progress){
  if(state.overlay!==progress || progress.pendingSteps===0 || progress.cursor>=progress.steps.length) return;
  progress.pendingSteps--;
  startTraceSolveAnimation(progress.cursor);
}

function updateTraceSolveControls(){
  const progress=state.overlay;
  if(!progress) return;
  const previous=document.getElementById('trace-solve-previous');
  const next=document.getElementById('trace-solve-next');
  const note=document.getElementById('trace-solve-note');
  const animating=!!progress.active && (progress.active.phase<3 || progress.active.resizing);
  const complete=progress.cursor>=progress.steps.length;
  if(previous) previous.disabled=progress.cursor===0||animating;
  if(next){
    const queuedIndex=progress.active?progress.active.index+1+progress.pendingSteps:progress.cursor;
    next.disabled=!complete&&queuedIndex>=progress.steps.length;
    next.textContent=complete?'Done →':progress.pendingSteps?`Next (${progress.pendingSteps} queued) →`:'Next →';
    next.onclick=complete?closeSolve:nextSolveStep;
  }
  if(note){
    if(animating) note.textContent=`Evaluating operation ${progress.active.index+1} of ${progress.steps.length}${progress.pendingSteps?` · ${progress.pendingSteps} queued`:''}`;
    else if(complete) note.textContent=`All ${progress.steps.length} operations completed`;
    else if(progress.cursor===0) note.textContent=`Ready · ${progress.steps.length} operation${progress.steps.length===1?'':'s'}`;
    else note.textContent=`${progress.cursor} of ${progress.steps.length} operations completed`;
  }
}
function openSimplifySolve(){
  const ast=tryParseCurrent(); if(!ast) return;
  const steps=buildIdentitySimplificationSteps(ast);
  state.overlay={type:'solve', kind:'simplify', steps, step:1, subtitle:'Boolean Identities'};
  render();
}

function booleanNodeKey(node){
  if(node.type==='VAR') return `VAR:${node.name}`;
  if(node.type==='NUM') return `NUM:${node.value}`;
  return `${node.type}(${(node.children||[]).map(booleanNodeKey).join(',')})`;
}

function makeBooleanNode(type,children){
  return {type,children};
}

function booleanFactors(node,type){
  if(node.type!==type) return [node];
  return [...booleanFactors(node.children[0],type),...booleanFactors(node.children[1],type)];
}

function combineBooleanFactors(factors,type){
  if(factors.length===0) return {type:'NUM',value:type==='AND'?'1':'0'};
  return factors.slice(1).reduce((left,right)=>makeBooleanNode(type,[left,right]),factors[0]);
}

function sameBooleanNode(a,b){
  return booleanNodeKey(a)===booleanNodeKey(b);
}

function isBooleanComplement(a,b){
  return (a.type==='NOT' && sameBooleanNode(a.children[0],b)) ||
    (b.type==='NOT' && sameBooleanNode(b.children[0],a));
}

function booleanIdentityRewrite(node){
  const type=node.type;
  if(type==='NOT' && node.children[0].type==='NOT'){
    return {node:node.children[0].children[0],law:'Involution Law',identity:'NOT (NOT X) = X'};
  }
  if(type!=='AND'&&type!=='OR') return null;

  const [left,right]=node.children;
  const identity=type==='AND'?'1':'0';
  const annihilator=type==='AND'?'0':'1';
  const identityResult=type==='AND'?'X AND 1 = X':'X OR 0 = X';
  const annihilatorResult=type==='AND'?'X AND 0 = 0':'X OR 1 = 1';
  if(left.type==='NUM'&&left.value===identity) return {node:right,law:'Identity Law',identity:identityResult};
  if(right.type==='NUM'&&right.value===identity) return {node:left,law:'Identity Law',identity:identityResult};
  if(left.type==='NUM'&&left.value===annihilator) return {node:left,law:'Null Law',identity:annihilatorResult};
  if(right.type==='NUM'&&right.value===annihilator) return {node:right,law:'Null Law',identity:annihilatorResult};
  if(isBooleanComplement(left,right)){
    return {
      node:{type:'NUM',value:type==='AND'?'0':'1'},
      law:'Complement Law',
      identity:type==='AND'?'NOT X AND X = 0':'NOT X OR X = 1'
    };
  }
  if(sameBooleanNode(left,right)){
    return {node:left,law:'Idempotent Law',identity:type==='AND'?'X AND X = X':'X OR X = X'};
  }

  if(type==='OR'){
    if(left.type==='AND'&&booleanFactors(left,'AND').some(factor=>sameBooleanNode(factor,right))){
      return {node:right,law:'Absorption Law',identity:'X OR (X AND Y) = X'};
    }
    if(right.type==='AND'&&booleanFactors(right,'AND').some(factor=>sameBooleanNode(factor,left))){
      return {node:left,law:'Absorption Law',identity:'X OR (X AND Y) = X'};
    }
  }else{
    if(left.type==='OR'&&booleanFactors(left,'OR').some(factor=>sameBooleanNode(factor,right))){
      return {node:right,law:'Absorption Law',identity:'X AND (X OR Y) = X'};
    }
    if(right.type==='OR'&&booleanFactors(right,'OR').some(factor=>sameBooleanNode(factor,left))){
      return {node:left,law:'Absorption Law',identity:'X AND (X OR Y) = X'};
    }
  }

  if(type==='OR'){
    const leftTerms=booleanFactors(left,'AND');
    const rightTerms=booleanFactors(right,'AND');
    const commonIndex=leftTerms.findIndex(a=>rightTerms.some(b=>sameBooleanNode(a,b)));
    if(commonIndex>=0){
      const common=leftTerms.splice(commonIndex,1)[0];
      const otherIndex=rightTerms.findIndex(b=>sameBooleanNode(common,b));
      rightTerms.splice(otherIndex,1);
      const factored=makeBooleanNode('AND',[
        common,
        makeBooleanNode('OR',[
          combineBooleanFactors(leftTerms,'AND'),
          combineBooleanFactors(rightTerms,'AND')
        ])
      ]);
      return {node:factored,law:'Distributive Law',identity:'(X AND Y) OR (X AND Z) = X AND (Y OR Z)'};
    }

    let single=null,product=null;
    if(left.type!=='AND'&&right.type==='AND'){single=left;product=right;}
    else if(right.type!=='AND'&&left.type==='AND'){single=right;product=left;}
    if(single&&product){
      const factors=booleanFactors(product,'AND');
      if(factors.length>1){
        return {
          node:combineBooleanFactors(factors.map(factor=>makeBooleanNode('OR',[single,factor])),'AND'),
          law:'Distributive Law',
          identity:'X OR (Y AND Z) = (X OR Y) AND (X OR Z)'
        };
      }
    }

  }else{
    const leftTerms=booleanFactors(left,'OR');
    const rightTerms=booleanFactors(right,'OR');
    const commonIndex=leftTerms.findIndex(a=>rightTerms.some(b=>sameBooleanNode(a,b)));
    if(commonIndex>=0){
      const common=leftTerms.splice(commonIndex,1)[0];
      const otherIndex=rightTerms.findIndex(b=>sameBooleanNode(common,b));
      rightTerms.splice(otherIndex,1);
      return {
        node:makeBooleanNode('OR',[
          common,
          makeBooleanNode('AND',[
            combineBooleanFactors(leftTerms,'OR'),
            combineBooleanFactors(rightTerms,'OR')
          ])
        ]),
        law:'Distributive Law',
        identity:'(X OR Y) AND (X OR Z) = X OR (Y AND Z)'
      };
    }
  }

  return null;
}

function findBooleanIdentityRewrite(node){
  if(node.children){
    for(let index=0;index<node.children.length;index++){
      const childRewrite=findBooleanIdentityRewrite(node.children[index]);
      if(childRewrite){
        const children=[...node.children];
        children[index]=childRewrite.node;
        return {...childRewrite,node:{...node,children}};
      }
    }
  }
  return booleanIdentityRewrite(node);
}

function formatIdentityExpression(node,parentPrecedence=0){
  const precedence={OR:1,AND:2,NOT:3,VAR:4,NUM:4};
  let text;
  if(node.type==='VAR') text=node.name;
  else if(node.type==='NUM') text=node.value;
  else if(node.type==='NOT'){
    const child=node.children[0];
    text=child.type==='VAR'?`NOT ${child.name}`:`NOT (${formatIdentityExpression(child)})`;
  }else if(node.type==='AND'){
    text=`${formatIdentityExpression(node.children[0],precedence.AND)} AND ${formatIdentityExpression(node.children[1],precedence.AND)}`;
  }else if(node.type==='OR'){
    text=`${formatIdentityExpression(node.children[0],precedence.OR)} OR ${formatIdentityExpression(node.children[1],precedence.OR)}`;
  }else{
    text=serializeCanonical(node);
  }
  return formatBooleanNotation(precedence[node.type]<parentPrecedence?`(${text})`:text);
}

function buildIdentitySimplificationSteps(ast){
  let current=ast;
  const steps=[{expression:formatIdentityExpression(current),law:'',identity:''}];
  const seen=new Set([booleanNodeKey(current)]);
  for(let count=0;count<64;count++){
    const rewrite=findBooleanIdentityRewrite(current);
    if(!rewrite) break;
    const key=booleanNodeKey(rewrite.node);
    if(seen.has(key)) break;
    current=rewrite.node;
    seen.add(key);
    steps.push({
      expression:formatIdentityExpression(current),
      law:rewrite.law,
      identity:formatBooleanNotation(rewrite.identity)
    });
  }
  return steps;
}

// ---- Solving steps: binary / decimal bitwise, revealed column by column ----
function openBinaryDecimalSolve(){
  const ast=tryParseCurrent(); if(!ast) return;
  try{
    const res=evalBitwiseWithTrace(ast, state.mode);
    const rootType = ast.type;
    state.overlay={type:'solve', kind:'bitwise', mode:state.mode, opType: rootType, res, step:0};
    render();
  }catch(e){ state.error=e.message; render(); }
}

function nextSolveStep(){
  const o=state.overlay;
  if(o.kind==='trace'){ nextTraceSolveStep(); return; }
  else if(o.kind==='text'){ if(o.step < o.lines.length-1) o.step++; }
  else if(o.kind==='simplify'){ if(o.step < o.steps.length) o.step++; }
  else if(o.kind==='bitwise'){ if(o.step < o.res.width) o.step++; }
  renderSolveOverlay();
}

function prevSolveStep(){
  const o=state.overlay;
  if(o.kind==='trace'){ prevTraceSolveStep(); return; }
  else if(o.kind==='text'){ if(o.step > 0) o.step--; }
  else if(o.kind==='simplify'){ if(o.step > 1) o.step--; }
  else if(o.kind==='bitwise'){ if(o.step > 0) o.step--; }
  renderSolveOverlay();
}

function renderSolveOverlay(){
  const root=document.getElementById('overlay-root');
  const o=state.overlay;
  let subtitle='', body='', footerNote='';

  if(o.kind==='trace'){
    subtitle=o.subtitle;
    const activeStep=o.active && o.active.index<o.steps.length?o.steps[o.active.index]:null;
    const row=activeStep?o.model.rows[activeStep.rowIndex]:o.model.rows[o.steps[0].rowIndex];
    body=`<section class="how-expression trace-solve-animation" aria-live="polite">
      <div class="how-expression-label">Expression</div>
      <div class="how-expression-text" id="trace-solve-expression">${activeStep
        ?renderHowComeExpression(o.model,o,activeStep,row)
        :renderInitialHowComeExpression(o.model.ast,row.bindings)}</div>
      <div class="how-expression-status" id="trace-solve-status">${activeStep
        ?`Operation ${activeStep.index+1} of ${o.steps.length} · ${activeStep.type==='RESULT'?'Evaluate expression':opDisplay(activeStep.type)}`
        :'Press Next to evaluate the expression'}</div>
    </section>`;
    footerNote=o.cursor>=o.steps.length
      ?`All ${o.steps.length} operations completed`
      :o.cursor===0?`Ready · ${o.steps.length} operation${o.steps.length===1?'':'s'}`
        :`${o.cursor} of ${o.steps.length} operations completed`;
  } else if(o.kind==='text'){
    subtitle=o.subtitle;
    body = `<div class="solve-eq" style="text-align:left; font-size:16px; line-height:1.8;">${esc(o.lines[o.step])}</div>`;
    footerNote = `Step ${o.step+1} of ${o.lines.length}`;
  } else if(o.kind==='simplify'){
    subtitle=o.subtitle;
    body=`<div class="identity-steps">
      ${o.steps.slice(0,o.step).map((step,index)=>`<div class="identity-step">
        <div class="identity-expression">${esc(step.expression)}</div>
        <div class="identity-law">${esc(step.law)}</div>
        <div class="identity-rule">${esc(step.identity)}</div>
      </div>`).join('')}
    </div>`;
    footerNote=`Line ${o.step} of ${o.steps.length}`;
  } else if(o.kind==='bitwise'){
    subtitle = OP_SUBTITLE[o.opType] || 'Boolean Operation';
    const res=o.res;
    const width=res.width;
    const revealed=o.step;
    const operands=res.leavesBits;
    const renderOperand=(bits)=> bits.join('');
    let resultDisplay='';
    if(revealed===0){
      resultDisplay = `<span style="color:#c7c7cc;">${'?'.repeat(width)}</span>`;
    } else {
      const known=res.bits.slice(0, revealed).join('');
      const unknown='?'.repeat(width-revealed);
      resultDisplay = `${known}<span style="color:#c7c7cc;">${unknown}</span>`;
    }
    if(operands.length===2){
      body = `<div class="solve-eq">
        <div class="row">${renderOperand(operands[0])}</div>
        <div class="row"><span class="op">${esc(opDisplay(o.opType))}</span></div>
        <div class="row result-row">${renderOperand(operands[1])}</div>
        <div class="row" style="margin-top:18px;">= ${resultDisplay}${(state.mode==='decimal'&&revealed===width)?`, ${res.decimal}`:''}</div>
      </div>`;
    } else {
      body = `<div class="solve-eq">
        <div class="row"><span class="op">${esc(opDisplay(o.opType))}</span> ${renderOperand(operands[0])}</div>
        <div class="row result-row">= ${resultDisplay}${(state.mode==='decimal'&&revealed===width)?`, ${res.decimal}`:''}</div>
      </div>`;
    }
    footerNote = revealed===0 ? 'Tap next to reveal the result bit by bit' : `Revealed ${revealed} of ${width} bit(s)`;
  }

  const isLast = (o.kind==='trace' && o.cursor>=o.steps.length) ||
                 (o.kind==='text' && o.step>=o.lines.length-1) ||
                 (o.kind==='simplify' && o.step>=o.steps.length) ||
                 (o.kind==='bitwise' && o.step>=o.res.width);
  const canPrevious=o.kind==='trace'?o.cursor>0:o.kind==='simplify'?o.step>1:o.step>0;

  if(o.kind==='trace'){
    root.innerHTML=`<div class="full-page solve-page">
      <div class="page-header">
        <button class="back-btn" onclick="closeSolve()">&#8592;</button>
        <div><div class="page-title">Solving Steps</div><div class="page-subtitle">${esc(o.subtitle)}</div></div>
      </div>
      <div class="solve-body">${body}</div>
      <div class="solve-footer">
        <div class="solve-step-note" id="trace-solve-note">${esc(footerNote)}</div>
        <div class="step-nav solve-nav">
          <button class="nav-step" id="trace-solve-previous" onclick="prevSolveStep()" ${canPrevious?'':'disabled'}>&#8592; Previous</button>
          <button class="nav-step" id="trace-solve-next" onclick="${isLast?'closeSolve()':'nextSolveStep()'}">${isLast?'Done':'Next'} &#8594;</button>
        </div>
      </div>
    </div>`;
    return;
  }

  root.innerHTML = `<div class="solve-screen ${o.kind==='simplify'?'identity-solve-screen':''}">
    <div class="solve-top">
      <div class="overlay-close" style="margin:0;" onclick="closeSolve()">&#10005;</div>
      <div class="solve-title">${o.kind==='simplify'?'Simplify Expressions':'Solving steps'}</div>
    </div>
    <div class="solve-sub">${esc(subtitle)}</div>
    <div class="solve-body">${body}</div>
    <div class="solve-footer">
      <div class="solve-step-note">${esc(footerNote)}</div>
      <div class="step-nav solve-nav">
        <button class="nav-step" onclick="prevSolveStep()" ${canPrevious?'':'disabled'}>&#8592; Previous</button>
        <button class="nav-step" onclick="${isLast?'closeSolve()':'nextSolveStep()'}">${isLast?'Done':'Next'} &#8594;</button>
      </div>
    </div>
  </div>`;
}
function closeSolve(){
  clearTraceSolveTimer();
  if(state.mode==='boolean'){
    state.page='result';
    state.overlay=null;
    render();
  } else {
    state.overlay=null;
    render();
  }
}
//Hi
