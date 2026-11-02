// ================================================================
// APPLICATION STATE + UI
// ================================================================
const VAR_ORDER = ['W','X','Y','Z','A','B','C','D','P','Q','R','S','X1','X2','X3','X4'];
const VARSETS = { WXYZ:['W','X','Y','Z'], ABCD:['A','B','C','D'], PQRS:['P','Q','R','S'], X1234:['X1','X2','X3','X4'] };
const VARSET_KEYS = Object.keys(VARSETS);
const OP_SUBTITLE = { AND:'Boolean Product', OR:'Boolean Sum', NOT:'Boolean Complement', XOR:'Boolean XOR', NAND:'Boolean NAND', NOR:'Boolean NOR', XNOR:'Boolean XNOR' };

const state = {
  mode:'boolean',
  varset:'WXYZ',
  notation:'word',
  advanced:false,
  tokens:[],
  expressionCursorIndex:null,
  expressionSelection:null,
  assignments:{},
  error:null,
  page:'main', // main | result | truthTable | howCome
  truthTableModel:null,
  truthTableFilter:'all',
  howComeProgress:null,
  overlay:null, // {type:'solve', ...}
};
