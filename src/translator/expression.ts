// Deliberately small integer language. No JS evaluation, property access, calls or ambient globals.
export type Variables = Record<string, number>
export function evaluate(source:string, variables:Variables):number {
  if(source.length>512)throw Error('Expression too long')
  const tokens=source.match(/0x[0-9a-f]+|\d+|[a-z][a-z0-9_]*|>>>|>>|<<|==|!=|<=|>=|&&|\|\||[()+\-*/%&|^~!<>]/gi)??[]
  if(tokens.join('')!==source.replace(/\s/g,'')||tokens.length>128)throw Error('Invalid expression')
  let index=0,depth=0
  const priority:Record<string,number>={'||':1,'&&':2,'|':3,'^':4,'&':5,'==':6,'!=':6,'<':7,'>':7,'<=':7,'>=':7,'<<':8,'>>':8,'>>>':8,'+':9,'-':9,'*':10,'/':10,'%':10}
  const expr=(minimum=0):number=>{
    if(++depth>32)throw Error('Expression nesting limit')
    const t=tokens[index++];let left:number
    if(t==='('){left=expr();if(tokens[index++]!==')')throw Error('Missing parenthesis')}
    else if(['-','+','~','!'].includes(t)){const v=expr(11);left=t==='-'?-v:t==='~'?~v:t==='!'?Number(!v):v}
    else if(t&&/^(0x[0-9a-f]+|\d+)$/i.test(t))left=Number(t)
    else if(t&&/^[a-z][a-z0-9_]*$/i.test(t)&&Object.hasOwn(variables,t))left=variables[t]
    else throw Error(`Unknown value: ${t??'end'}`)
    while(index<tokens.length&&(priority[tokens[index]]??-1)>=minimum){const op=tokens[index++],right=expr(priority[op]+1)
      if((op==='/'||op==='%')&&right===0)throw Error('Division by zero')
      switch(op){case '+':left=(left+right)|0;break;case '-':left=(left-right)|0;break;case '*':left=Math.imul(left,right);break;case '/':left=Math.trunc(left/right)|0;break;case '%':left=left%right;break;case '&':left&=right;break;case '|':left|=right;break;case '^':left^=right;break;case '<<':left<<=right;break;case '>>':case '>>>':left>>>=right;break;case '==':left=Number(left===right);break;case '!=':left=Number(left!==right);break;case '<':left=Number(left<right);break;case '>':left=Number(left>right);break;case '<=':left=Number(left<=right);break;case '>=':left=Number(left>=right);break;case '&&':left=Number(!!left&&!!right);break;case '||':left=Number(!!left||!!right);break}
    }
    depth--;return left|0
  }
  const value=expr();if(index!==tokens.length)throw Error('Unexpected expression token');return value
}
