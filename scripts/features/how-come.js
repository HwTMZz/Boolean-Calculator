function openHowCome(){
  if(!state.truthTableModel){
    const ast=tryParseCurrent(); if(!ast) return;
    const vars=extractVars(ast,VAR_ORDER);
    state.truthTableModel=buildTruthTableModel(ast,vars);
  }
  clearHowComeTimer();
  state.howComeProgress=createHowComeProgress(state.truthTableModel);
  state.page='howCome';
  state.overlay=null;
  render();
}

let howComeTimer=null;

function clearHowComeTimer(){
  if(howComeTimer!==null){
    clearTimeout(howComeTimer);
    howComeTimer=null;
  }
}

function createHowComeProgress(model){
  const operations=orderedHowComeOperations(model.analysis.opNodes);
  const steps=[];
  const rowRanges=[];
  model.rows.forEach((row,rowIndex)=>{
    const start=steps.length;
    if(operations.length===0){
      steps.push({rowIndex,nodeId:null,result:row.result,type:'RESULT'});
    }else{
      operations.forEach(node=>{
        steps.push({rowIndex,nodeId:node.id,result:row.values[node.id],type:node.type});
      });
    }
    rowRanges.push({start,end:steps.length});
  });
  return {
    steps,
    operationOrder:operations,
    rowRanges,
    cursor:0,
    active:null,
    activeRow:null,
    pendingSteps:0,
    completedNodesByRow:model.rows.map(()=>new Set())
  };
}

function orderedHowComeOperations(nodes){
  const precedence={NOT:0,AND:1,NAND:1,XOR:2,XNOR:2,OR:3,NOR:3};
  const order=new Map(nodes.map((node,index)=>[node.id,index]));
  const groups=howComeParenthesisRanges();
  const completed=new Set();
  const result=[];
  while(result.length<nodes.length){
    const available=nodes.filter(node=>
      !completed.has(node.id) &&
      node.children.every(child=>!child.children || completed.has(child.id))
    );
    if(available.length===0) throw new Error('Unable to determine Boolean operation order.');
    available.sort((a,b)=>{
      const aGroup=operationGroup(a,groups);
      const bGroup=operationGroup(b,groups);
      return bGroup.depth-aGroup.depth ||
        aGroup.start-bGroup.start ||
        precedence[a.type]-precedence[b.type] ||
        order.get(a.id)-order.get(b.id);
    });
    const next=available[0];
    result.push(next);
    completed.add(next.id);
  }
  return result;
}

function operationGroup(node,groups){
  const containing=groups.filter(group=>node.pos>group.start && node.pos<group.end);
  const inner=containing.sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
  return {depth:containing.length,start:inner?inner.start:Number.POSITIVE_INFINITY};
}

function howComeParenthesisRanges(){
  const source=buildParseString();
  const stack=[];
  const groups=[];
  for(let index=0;index<source.length;index++){
    if(source[index]==='(') stack.push(index);
    if(source[index]===')' && stack.length) groups.push({start:stack.pop(),end:index});
  }
  return groups;
}

function renderHowComePage(){
  const model=state.truthTableModel;
  const progress=state.howComeProgress;
  if(!model || !progress) return `<div class="full-page"><div class="page-header"><button class="back-btn" onclick="closeHowCome()">&#8592;</button><div class="page-title">How'd it come?</div></div><div class="page-empty">No explanation data.</div></div>`;

  const vars=model.vars;
  const combinations=model.rows.length;
  const evalSteps=progress.operationOrder.length
    ? progress.operationOrder.map((node,index)=>`<li><b>${index+1}.</b> ${renderInitialHowComeExpression(node)}</li>`).join('')
    : '<li>This expression contains no Boolean operation, so each row maps directly to its variable value.</li>';
  const parenthesizedGroups=howComeParenthesizedGroups();
  const parenthesized=parenthesizedGroups
    .map(group=>`<code>${esc(group)}</code>`)
    .join(', ');
  const expressionHTML=buildDisplayHTML() || esc(formatAstDisplay(model.ast));
  return `<div class="full-page how-page">
    <div class="page-header">
      <button class="back-btn" onclick="closeHowCome()">&#8592;</button>
      <div><div class="page-title">Truth Table Solving</div><div class="page-subtitle">${esc(formatAstDisplay(model.ast))}</div></div>
    </div>
    <section class="how-introduction" id="how-introduction">
      <h2>Before we begin</h2>
      <div class="how-intro-expression">${expressionHTML}</div>
      <p>This expression contains <b>${vars.length}</b> unique variable${vars.length===1?'':'s'} (${esc(vars.join(', '))}), so it has 2<sup>${vars.length}</sup> = <b>${combinations}</b> possible Boolean combination${combinations===1?'':'s'}.</p>
      ${parenthesized?`<p>Evaluate parenthesized portions from the innermost outward, starting with ${parenthesized}.</p>`:''}
      <p>${esc(howComePrecedenceSummary(progress.operationOrder,parenthesizedGroups.length>0))}</p>
      <ol class="how-operation-order">${evalSteps}</ol>
    </section>
    <section class="how-expression" id="how-expression-section" aria-live="polite" hidden>
      <div class="how-expression-label">Expression</div>
      <div class="how-expression-text" id="how-expression-text"></div>
      <div class="how-expression-status" id="how-expression-status"></div>
    </section>
    <section class="how-table-section">
      <div class="how-table-title">Truth Table</div>
      <div class="how-table-viewport" id="how-table-viewport">
        <table class="tt full-tt how-table">
          <thead><tr>${vars.map(variable=>`<th>${esc(variable)}</th>`).join('')}<th>Result</th></tr></thead>
          <tbody id="how-table-body"></tbody>
        </table>
      </div>
    </section>
    <div class="how-footer">
      <div class="solve-step-note" id="how-step-note">Introduction · ${progress.steps.length} operation${progress.steps.length===1?'':'s'} across ${combinations} rows</div>
      <div class="step-nav">
        <button class="nav-step" id="how-previous" onclick="prevHowCome()" disabled>&#8592; Previous</button>
        <button class="nav-step" id="how-next" onclick="nextHowCome()">Next Step &#8594;</button>
      </div>
    </div>
  </div>`;
}

function howComePrecedenceSummary(operations,hasParentheses){
  if(!operations.length) return 'There are no operations to order.';
  const levels=[
    {types:['NOT'],label:opDisplay('NOT')},
    {types:['AND','NAND'],label:`${opDisplay('AND')} / NAND`},
    {types:['XOR','XNOR'],label:'XOR / XNOR'},
    {types:['OR','NOR'],label:`${opDisplay('OR')} / NOR`}
  ];
  const order=levels
    .filter(level=>operations.some(node=>level.types.includes(node.type)))
    .map(level=>level.label);
  const samePrecedence=levels.some(level=>operations.filter(node=>level.types.includes(node.type)).length>1);
  const opening=hasParentheses
    ? 'Evaluate parenthesized groups from the innermost outward, then follow this precedence: '
    : 'The parser follows this precedence: ';
  const associativity=samePrecedence
    ? ' Operations with equal precedence follow the parser’s left-to-right associativity.'
    : '';
  return `${opening}${order.join(' → ')}.${associativity}`;
}

function howComeParenthesizedGroups(){
  const stack=[];
  const groups=[];
  state.tokens.forEach((token,index)=>{
    if(token.kind==='LPAREN') stack.push(index);
    if(token.kind==='RPAREN' && stack.length){
      const start=stack.pop();
      const contents=state.tokens.slice(start+1,index);
      if(contents.some(item=>item.kind!=='LPAREN' && item.kind!=='RPAREN' && item.kind!=='VAR' && item.kind!=='NUM')){
        groups.push({
          start,
          length:index-start,
          text:state.tokens.slice(start,index+1).map(item=>{
            if(item.kind==='LPAREN') return '(';
            if(item.kind==='RPAREN') return ')';
            if(item.kind==='VAR'||item.kind==='NUM') return item.value;
            return opDisplay(item.kind);
          }).join(' ').replace(/\s+\)/g,')').replace(/\(\s+/g,'(')
        });
      }
    }
  });
  return groups.sort((a,b)=>a.length-b.length || a.start-b.start).map(group=>group.text);
}

function prevHowCome(){
  const progress=state.howComeProgress;
  if(!progress || progress.cursor===0 || (progress.active && (progress.active.phase<3 || progress.active.resizing))) return;
  clearHowComeTimer();
  if(progress.cursor===1){
    progress.cursor=0;
    progress.active=null;
    progress.activeRow=null;
    progress.pendingSteps=0;
    restoreCompletedHowComeOperations(0);
    const body=document.getElementById('how-table-body');
    if(body) body.replaceChildren();
    const intro=document.getElementById('how-introduction');
    const expression=document.getElementById('how-expression-section');
    if(intro) intro.hidden=false;
    if(expression) expression.hidden=true;
    updateHowComeControls();
    return;
  }
  const index=progress.cursor-2;
  progress.cursor=index;
  progress.pendingSteps=0;
  restoreCompletedHowComeOperations(index);
  restoreHowComeTable(index);
  startHowComeAnimation(index);
}

function nextHowCome(){
  const progress=state.howComeProgress;
  if(!progress || progress.cursor>=progress.steps.length) return;
  if(progress.active && (progress.active.phase<3 || progress.active.resizing)){
    const queuedIndex=progress.active.index+1+progress.pendingSteps;
    if(queuedIndex<progress.steps.length){
      progress.pendingSteps++;
      updateHowComeControls();
    }
    return;
  }
  clearHowComeTimer();
  startHowComeAnimation(progress.cursor);
}

function startHowComeAnimation(index){
  const progress=state.howComeProgress;
  const model=state.truthTableModel;
  const step=progress.steps[index];
  if(!step) return;
  const previousRow=progress.activeRow;
  progress.active={index,phase:1};
  progress.activeRow=step.rowIndex;
  const intro=document.getElementById('how-introduction');
  const expressionSection=document.getElementById('how-expression-section');
  if(intro) intro.hidden=true;
  if(expressionSection) expressionSection.hidden=false;
  revealHowComeRow(step.rowIndex,index);
  updateHowComeExpression(index);
  updateHowComeControls();
  if(previousRow!==step.rowIndex) scrollHowComeActiveRow(step.rowIndex);

  howComeTimer=setTimeout(()=>{
    howComeTimer=null;
    if(state.page!=='howCome' || state.howComeProgress!==progress) return;
    progress.active.phase=2;
    const active=document.querySelector('#how-expression-text [data-active-operation]');
    if(active) active.classList.add('how-operation-active');
    updateHowComeControls();
    howComeTimer=setTimeout(()=>{
      howComeTimer=null;
      if(state.page!=='howCome' || state.howComeProgress!==progress) return;
      progress.active.phase=3;
      progress.cursor=index+1;
      progress.active.resizing=true;
      if(step.nodeId) progress.completedNodesByRow[step.rowIndex].add(step.nodeId);
      animateHowComeResult(step.result,()=>{
        if(state.howComeProgress!==progress) return;
        progress.active.resizing=false;
        updateHowComeControls();
        startQueuedHowComeStep(progress);
      });
      const rowRange=progress.rowRanges[step.rowIndex];
      if(index+1===rowRange.end) updateHowComeRowResult(step.rowIndex,model.rows[step.rowIndex].result);
      updateHowComeControls();
    },520);
  },320);
}

function renderInitialHowComeExpression(ast,bindings){
  function renderNode(node,parentType,isRight){
    if(node.type==='VAR') return esc(bindings && Object.prototype.hasOwnProperty.call(bindings,node.name)?String(bindings[node.name]):node.name);
    if(node.type==='NUM') return esc(node.value);
    const precedence={OR:1,NOR:1,XOR:2,XNOR:2,AND:3,NAND:3,NOT:4};
    let text;
    if(node.type==='NOT'){
      text=`${state.notation==='symbol'?'!':'NOT '}${renderNode(node.children[0],node.type,false)}`;
    }else{
      text=`${renderNode(node.children[0],node.type,false)} ${opDisplay(node.type)} ${renderNode(node.children[1],node.type,true)}`;
    }
    const needsWrap=precedence[node.type]<(precedence[parentType]||0) ||
      (isRight && precedence[node.type]===precedence[parentType] && node.type!=='NOT');
    return needsWrap?`(${text})`:text;
  }
  return renderNode(ast,null,false);
}

function updateHowComeExpression(index){
  const model=state.truthTableModel;
  const progress=state.howComeProgress;
  const step=progress.steps[index];
  const container=document.getElementById('how-expression-text');
  const status=document.getElementById('how-expression-status');
  if(!container || !status) return;
  container.innerHTML=renderHowComeExpression(model,progress,step,model.rows[step.rowIndex]);
  status.textContent=`Row ${step.rowIndex+1} of ${model.rows.length} · ${step.type==='RESULT'?'Evaluate expression':opDisplay(step.type)}`;
}

function renderHowComeExpression(model,progress,activeStep,row){
  if(activeStep.type==='RESULT'){
    return `<span data-active-operation>${renderInitialHowComeExpression(model.ast,row.bindings)}</span>`;
  }
  const completedNodes=progress.completedNodesByRow[activeStep.rowIndex];
  function renderNode(node,parentType,isRight){
    if(node.type==='VAR') return esc(String(row.bindings[node.name]));
    if(node.type==='NUM') return esc(node.value);
    const precedence={OR:1,NOR:1,XOR:2,XNOR:2,AND:3,NAND:3,NOT:4};
    if(completedNodes.has(node.id)) return String(row.values[node.id]);
    let text;
    if(node.type==='NOT'){
      text=`${state.notation==='symbol'?'!':'NOT '}${renderNode(node.children[0],node.type,false)}`;
    }else{
      text=`${renderNode(node.children[0],node.type,false)} ${opDisplay(node.type)} ${renderNode(node.children[1],node.type,true)}`;
    }
    const needsWrap=precedence[node.type]<(precedence[parentType]||0) ||
      (isRight && precedence[node.type]===precedence[parentType] && node.type!=='NOT');
    if(needsWrap) text=`(${text})`;
    if(node.id===activeStep.nodeId) return `<span data-active-operation>${text}</span>`;
    return text;
  }
  return renderNode(model.ast,null,false);
}

function revealHowComeRow(activeRow,cursor){
  const model=state.truthTableModel;
  const progress=state.howComeProgress;
  const body=document.getElementById('how-table-body');
  if(!body) return;
  for(let index=body.rows.length;index<=activeRow;index++){
    const truthRow=model.rows[index];
    const tableRow=body.insertRow();
    tableRow.dataset.howRow=String(index);
    truthRow.bits.forEach(bit=>{
      const cell=tableRow.insertCell();
      cell.textContent=String(bit);
    });
    const resultCell=tableRow.insertCell();
    resultCell.className='result-col';
    const range=progress.rowRanges[index];
    if(range.end<=cursor) resultCell.textContent=String(truthRow.result);
  }
  Array.from(body.rows).forEach((row,index)=>{
    row.classList.toggle('how-active-row',index===activeRow);
  });
}

function restoreHowComeTable(cursor){
  const progress=state.howComeProgress;
  const body=document.getElementById('how-table-body');
  if(!body) return;
  const targetRow=progress.steps[cursor].rowIndex;
  while(body.rows.length>targetRow+1) body.deleteRow(body.rows.length-1);
  Array.from(body.rows).forEach((row,index)=>{
    row.classList.toggle('how-active-row',index===targetRow);
    const resultCell=row.cells[row.cells.length-1];
    const range=progress.rowRanges[index];
    resultCell.textContent=range.end<=cursor?String(state.truthTableModel.rows[index].result):'';
  });
}

function restoreCompletedHowComeOperations(cursor){
  const progress=state.howComeProgress;
  progress.completedNodesByRow.forEach(completed=>completed.clear());
  for(let index=0;index<cursor;index++){
    const step=progress.steps[index];
    if(step.nodeId) progress.completedNodesByRow[step.rowIndex].add(step.nodeId);
  }
}

function startQueuedHowComeStep(progress){
  if(state.howComeProgress!==progress || progress.pendingSteps===0 || progress.cursor>=progress.steps.length) return;
  progress.pendingSteps--;
  startHowComeAnimation(progress.cursor);
}

function updateHowComeRowResult(rowIndex,result){
  const row=document.querySelector(`#how-table-body [data-how-row="${rowIndex}"]`);
  if(row) row.cells[row.cells.length-1].textContent=String(result);
}

function scrollHowComeActiveRow(rowIndex){
  const viewport=document.getElementById('how-table-viewport');
  const row=viewport && viewport.querySelector(`[data-how-row="${rowIndex}"]`);
  if(!viewport || !row) return;
  const viewportRect=viewport.getBoundingClientRect();
  const rowRect=row.getBoundingClientRect();
  const rowBottom=rowRect.bottom-viewportRect.top+viewport.scrollTop;
  const target=rowBottom-viewport.clientHeight+18;
  const maxScroll=viewport.scrollHeight-viewport.clientHeight;
  viewport.scrollTop=Math.max(0,Math.min(target,maxScroll));
}

function animateHowComeResult(result,onComplete){
  const active=document.querySelector('#how-expression-text [data-active-operation]');
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
    clearTimeout(howComeTimer);
    howComeTimer=null;
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
  howComeTimer=setTimeout(finish,600);
}

function updateHowComeControls(){
  const progress=state.howComeProgress;
  if(!progress) return;
  const previous=document.getElementById('how-previous');
  const next=document.getElementById('how-next');
  const note=document.getElementById('how-step-note');
  const animating=!!progress.active && (progress.active.phase<3 || progress.active.resizing);
  const complete=progress.cursor>=progress.steps.length;
  if(previous) previous.disabled=progress.cursor===0||animating;
  if(next){
    const queuedIndex=progress.active ? progress.active.index+1+progress.pendingSteps : progress.cursor;
    next.disabled=complete||queuedIndex>=progress.steps.length;
    next.textContent=progress.pendingSteps?`Next Step (${progress.pendingSteps} queued) →`:'Next Step →';
  }
  if(note){
    if(animating){
      note.textContent=`Evaluating operation ${progress.active.index+1} of ${progress.steps.length}${progress.pendingSteps?` · ${progress.pendingSteps} queued`:''}`;
    }else if(progress.cursor===0){
      note.textContent=`Introduction · ${progress.steps.length} operation${progress.steps.length===1?'':'s'} across ${state.truthTableModel.rows.length} rows`;
    }else if(complete){
      note.textContent=`All ${progress.steps.length} operations completed`;
    }else{
      note.textContent=`${progress.cursor} of ${progress.steps.length} operations completed`;
    }
  }
}

function closeHowCome(){
  clearHowComeTimer();
  state.howComeProgress=null;
  state.page='result';
  render();
}
