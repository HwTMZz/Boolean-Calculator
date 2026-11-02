// ---------------- Result window (Boolean mode) ----------------
function openResultWindow(){
  const ast=tryParseCurrent();
  if(!ast) return;
  const vars=extractVars(ast,VAR_ORDER);
  state.truthTableModel=buildTruthTableModel(ast,vars);
  state.truthTableFilter='all';
  state.page='result';
  state.overlay=null;
  render();
}
function closeOverlay(){
  state.page='main';
  state.truthTableModel=null;
  state.truthTableFilter='all';
  state.overlay=null;
  render();
}

function resultContext(){
  const ast=tryParseCurrent();
  if(!ast) return null;
  const vars=extractVars(ast, VAR_ORDER);
  const bindings={};
  vars.forEach(v=>{ const a=state.assignments[v]; bindings[v]=(a==='0'||a==='1')?Number(a):0; });
  const {value:calcResult, trace:calcTrace}=evalBooleanWithTrace(ast, bindings);
  const model=state.truthTableModel || buildTruthTableModel(ast,vars);
  const simp=simplifyExpression(ast,vars);
  return {ast,vars,bindings,calcResult,calcTrace,model,simp,displayExpr:buildDisplayHTML(),canonical:formatAstDisplay(ast)};
}

function renderResultOverlay(){
  const root=document.getElementById('overlay-root');
  const ctx=resultContext();
  if(!ctx){ state.page='main'; state.truthTableModel=null; root.innerHTML=''; return; }
  const {vars,bindings,calcResult,calcTrace,model,simp,displayExpr,canonical}=ctx;
  const rows=model.rows;
  const previewRows=rows.slice(0,Math.min(8,rows.length));
  const assignLine=vars.map(v=>`${v}:${bindings[v]}`).join(', ');
  const hasAssignedVariable=vars.some(v=>state.assignments[v]==='0'||state.assignments[v]==='1');

  let kmapHtml='';
  if(vars.length>=2 && vars.length<=4){
    const km=buildKMap(ctx.ast,vars);
    const rowLabel=km.rowVars.join('');
    const colLabel=km.colVars.join('');
    kmapHtml=`<div class="card">
      <h3>K-Map</h3>
      <table class="kmap">
        <tr><th class="corner">${esc(rowLabel)}\\${esc(colLabel)}</th>${km.colCodes.map(c=>`<th>${c}</th>`).join('')}</tr>
        ${km.grid.map((row,ri)=>`<tr><th>${km.rowCodes[ri]}</th>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}
      </table>
    </div>`;
  }

  root.innerHTML=`<div class="overlay">
    <div class="overlay-header">
      <h1 class="overlay-title">Result</h1>
      <div class="overlay-close" onclick="closeOverlay()">&#10005;</div>
    </div>
    <div class="overlay-scroll">
      ${hasAssignedVariable ? `<div class="card">
          <h3>Calculate Expressions</h3>
          <div class="sub">${esc(assignLine)}</div>
          <div class="expr-line">${displayExpr} = ${calcResult}</div>
          <button class="card-btn" onclick="openTraceSolve()">Show Solving Steps</button>
        </div>` : ''}

      <div class="card">
        <h3>Full Truth Table</h3>
        <table class="tt">
          <tr>${vars.map(v=>`<th>${esc(v)}</th>`).join('')}<th>F</th></tr>
          ${previewRows.map(r=>`<tr>${r.bits.map(b=>`<td>${b}</td>`).join('')}<td class="result-col">${r.result}</td></tr>`).join('')}
        </table>
        <button class="card-btn" onclick="openFullTruthTable()">Show Full Table</button>
        <button class="card-btn capsule-secondary" onclick="openHowCome()">How'd it come? <span>&#8594;</span></button>
      </div>

      <div class="card">
        <h3>Simplify Expressions</h3>
        <div class="expr-line">${esc(canonical)}<br>&#8595;<br>${esc(formatBooleanNotation(simp.expr))}</div>
        <button class="card-btn" onclick="openSimplifySolve()">Show Solving Steps</button>
      </div>

      ${kmapHtml}
    </div>
  </div>`;
}
