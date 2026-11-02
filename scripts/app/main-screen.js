// ---------------- Rendering ----------------
function render(){
  const app=document.getElementById('app');
  if(state.page==='truthTable'){
    app.innerHTML=renderFullTruthTablePage();
    return;
  }
  if(state.page==='howCome'){
    app.innerHTML=renderHowComePage();
    return;
  }
  app.innerHTML = renderShell();
  restoreExpressionInput();
  if(state.page==='result') renderResultOverlay();
  if(state.overlay && state.overlay.type==='solve') renderSolveOverlay();
}

function renderShell(){
  const ast = state.tokens.length ? tryParseCurrent() : (state.error=null, null);
  return `
    <div class="status-spacer"></div>
    ${renderModeRow()}
    ${renderExprArea()}
    ${renderAnswerArea(ast)}
    <div class="main-action-wrap">${renderMainButton(ast)}</div>
    ${renderBottomPanel()}
    <div id="overlay-root"></div>
  `;
}

function renderModeRow(){
  const modes=[ /*['boolean','Boolean']*//*,['binary','Binary'],['decimal','Decimal']*/];
  return `<div class="mode-row">
    ${modes.map(([id,label])=>`<div class="mode-btn ${state.mode===id?'active':''}" onclick="switchMode('${id}')">${label}</div>`).join('')}
  </div>`;
}

function renderExprArea(){
  const placeholder=state.tokens.length===0?'placeholder':'';
  const body=`<textarea id="expression-input" class="expr-text ${placeholder}" rows="1" readonly inputmode="none" spellcheck="false" aria-label="Boolean expression" placeholder="Type an Expressions..." onselect="captureExpressionCursor()" onclick="captureExpressionCursor()" onkeyup="captureExpressionCursor()">${esc(buildExpressionText())}</textarea>`;
  return `<div class="expr-wrap">
      ${body}
      <div id="expression-caret" class="expr-caret" aria-hidden="true"></div>
      <div class="clear-btn" onclick="clearExpr()">&#10005;</div>
    </div>
    <div class="error-text">${state.error ? esc(state.error) : ''}</div>`;
}

function renderAnswerArea(ast){
  if(state.tokens.length===0) return `<div class="answer-wrap"></div>`;
  if(!ast) return `<div class="answer-wrap"></div>`;
  if(state.mode==='boolean'){
    const vars=extractVars(ast, VAR_ORDER);
    if(!vars.some(v=>state.assignments[v]==='0'||state.assignments[v]==='1')) return `<div class="answer-wrap"></div>`;
    const bindings={};
    vars.forEach(v=>{ const a=state.assignments[v]; bindings[v] = (a==='0'||a==='1') ? Number(a) : 0; });
    const {value}=evalBooleanWithTrace(ast, bindings);
    const tuple=vars.map(v=>bindings[v]).join(', ');
    return `<div class="answer-wrap"><div class="answer-bar"></div><div class="answer-text">Answer (${tuple}) = <b>${value}</b></div></div>`;
  } else {
    try{
      const {bits, decimal}=evalBitwiseWithTrace(ast, state.mode);
      if(state.mode==='binary'){
        return `<div class="answer-wrap"><div class="answer-bar"></div><div class="answer-text">Answer = <b>${bits.join('')}</b></div></div>`;
      } else {
        return `<div class="answer-wrap"><div class="answer-bar"></div><div class="answer-text">Answer = <b>${bits.join('')}, ${decimal}</b></div></div>`;
      }
    }catch(e){ return `<div class="answer-wrap"></div>`; }
  }
}

function renderMainButton(ast){
  const enabled = !!ast;
  if(state.mode==='boolean'){
    if(!enabled) return '';
    return `<button class="main-action" onclick="openResultWindow()">Show Full Table &#8618;</button>`;
  }
  return `<button class="main-action" ${enabled?'':'disabled'} onclick="openBinaryDecimalSolve()">Show Solving Steps &#8618;</button>`;
}

function renderBottomPanel(){
  return `<div class="bottom-panel">
    ${state.mode==='boolean' ? renderAssignRow() : ''}
    ${renderControlRow()}
    ${renderKeyboard()}
  </div>`;
}

function renderAssignRow(){
  const vars=currentVars();
  return `<div class="assign-row">
    <div class="grow">
    ${vars.map(v=>{
      const val=state.assignments[v] || '*';
      return `<div class="assign-var">${esc(v)} <div class="toggle-btn" onclick="cycleAssignment('${v}')">${val}</div></div>`;
    }).join('')}
    </div>
    <div class="reset-btn" onclick="resetAssignments()">Reset</div>
  </div>`;
}

function renderControlRow(){
  const varsetBtn = state.mode==='boolean' ? `<div class="ctrl-btn" onclick="cycleVarset()">${state.varset}</div>` : '';
  return `<div class="control-row">
    ${varsetBtn}
    <div class="ctrl-btn" onclick="toggleNotation()">${state.notation==='word'?'AND OR NOT':'* + !'}</div>
    <div class="ctrl-btn ${state.advanced?'active':''}" onclick="toggleAdvanced()">Advance</div>
    <div class="del-btn" onclick="deleteToken()">${deleteIcon()}</div>
  </div>`;
}
function deleteIcon(){
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-6-7 6-7z"/><path d="M13 10l4 4M17 10l-4 4"/></svg>`;
}
