function openFullTruthTable(){
  if(!state.truthTableModel){
    const ast=tryParseCurrent(); if(!ast) return;
    const vars=extractVars(ast,VAR_ORDER);
    state.truthTableModel=buildTruthTableModel(ast,vars);
  }
  state.truthTableFilter='all';
  state.page='truthTable';
  state.overlay=null;
  render();
}

function backToResult(){
  state.page='result';
  state.overlay=null;
  render();
}

function filterTruthTable(id){
  state.truthTableFilter=id;
  render();
}

function scrollTruthTableFilters(event){
  const filters=event.currentTarget;
  if(filters.scrollWidth<=filters.clientWidth || Math.abs(event.deltaY)<=Math.abs(event.deltaX)) return;
  filters.scrollLeft+=event.deltaY;
  event.preventDefault();
}

function selectedTruthColumns(model){
  if(state.truthTableFilter==='all'){
    return model.columns.filter(c=>c.isVariable || c.type!=='VAR' || c.isResult);
  }
  const filter=model.analysis.filters.find(f=>f.id===state.truthTableFilter) || model.analysis.filters[0];
  const deps=new Set(filter.dependencies);
  const nodeIds=filter.nodeIds || (filter.nodeId ? [filter.nodeId] : []);
  const byId=new Map(model.columns.map(c=>[c.nodeId,c]));
  return nodeIds.map(id=>byId.get(id)).filter(Boolean);
}

function renderTruthTableColumns(model){
  const cols=selectedTruthColumns(model);
  return cols;
}

function renderFullTruthTablePage(){
  const model=state.truthTableModel;
  if(!model) return `<div class="full-page"><div class="page-header"><button onclick="backToResult()">&#8592;</button><h1>Full Truth Table</h1></div><div class="page-empty">No truth table data.</div></div>`;
  const filters=model.analysis.filters;
  const cols=renderTruthTableColumns(model);
  const expr=formatAstDisplay(model.ast);
  return `<div class="full-page">
    <div class="page-header">
      <button class="back-btn" onclick="backToResult()">&#8592;</button>
      <div><div class="page-title">Full Truth Table</div><div class="page-subtitle">${esc(expr)}</div></div>
    </div>
    <div class="filter-wrap">
      <div class="filter-scroll" onwheel="scrollTruthTableFilters(event)">
        ${filters.map(f=>`<button class="filter-pill ${state.truthTableFilter===f.id?'active':''}" onclick="filterTruthTable('${f.id}')">${esc(f.kind==='all'?f.label:formatAstDisplay(model.analysis.byId.get(f.nodeId)))}</button>`).join('')}
      </div>
    </div>
    <div class="table-page-scroll">
      <table class="tt full-tt">
        <thead><tr>${cols.map(c=>`<th>${esc(c.isVariable?c.label:formatAstDisplay(model.analysis.byId.get(c.nodeId)))}</th>`).join('')}</tr></thead>
        <tbody>
          ${model.rows.map(r=>`<tr>${cols.map(c=>`<td class="${c.isResult?'result-col':''}">${r.values[c.nodeId]}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="table-footer">${model.rows.length} row${model.rows.length===1?'':'s'} · ${cols.length} column${cols.length===1?'':'s'}</div>
  </div>`;
}
