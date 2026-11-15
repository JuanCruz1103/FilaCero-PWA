// Codificador QR autónomo (ISO/IEC 18004), versión 4, corrección L, máscara 0.
// Capacidad: 78 bytes en modo byte. Sin CDNs para que el ticket siga visible offline.
const SIZE=33;
function gfMultiply(a,b){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((b>>>i)&1)*a;}return z;}
function reedSolomon(data,degree=20){
  const div=Array(degree).fill(0);div[degree-1]=1;
  let root=1;
  for(let i=0;i<degree;i++){
    for(let j=0;j<degree;j++){div[j]=gfMultiply(div[j],root);if(j+1<degree)div[j]^=div[j+1];}
    root=gfMultiply(root,2);
  }
  const result=Array(degree).fill(0);
  for(const b of data){const factor=b^result.shift();result.push(0);for(let i=0;i<degree;i++)result[i]^=gfMultiply(div[i],factor);}
  return result;
}
export function qrMatrix(value){
  const bytes=new TextEncoder().encode(value);
  if(bytes.length>78)throw new Error('Los datos son demasiado largos para el QR.');
  const bits=[];
  const append=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};
  append(4,4);append(bytes.length,8);for(const b of bytes)append(b,8);
  for(let i=0;i<Math.min(4,640-bits.length);i++)bits.push(0);
  while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8){let n=0;for(let j=0;j<8;j++)n=n<<1|bits[i+j];data.push(n);}
  const startPad=data.length;for(let i=startPad;i<80;i++)data.push((i-startPad)%2===0?0xec:0x11);
  const ecc=reedSolomon(data),code=[...data,...ecc];
  const matrix=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
  const reserved=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
  function set(x,y,dark){if(x<0||y<0||x>=SIZE||y>=SIZE)return;matrix[y][x]=!!dark;reserved[y][x]=true;}
  function finder(cx,cy){for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){
    const inside=dx>=0&&dx<=6&&dy>=0&&dy<=6;
    const black=inside&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4));
    set(cx+dx,cy+dy,black);
  }}
  finder(0,0);finder(SIZE-7,0);finder(0,SIZE-7);
  for(let i=8;i<SIZE-8;i++){set(i,6,i%2===0);set(6,i,i%2===0);}
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(26+dx,26+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  // Reservar ambos bloques de información de formato antes de escribir los datos.
  for(let i=0;i<=5;i++)set(8,i,false);
  set(8,7,false);set(8,8,false);set(7,8,false);
  for(let i=9;i<15;i++)set(14-i,8,false);
  for(let i=0;i<8;i++)set(SIZE-1-i,8,false);
  for(let i=8;i<15;i++)set(8,SIZE-15+i,false);
  set(8,SIZE-8,true);
  let index=0;
  for(let right=SIZE-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<SIZE;vert++){
      const y=(((right+1)&2)===0)?SIZE-1-vert:vert;
      for(let j=0;j<2;j++){
        const x=right-j;if(reserved[y][x])continue;
        const b=index<code.length*8?((code[index>>>3]>>>(7-(index&7)))&1):0;
        matrix[y][x]=!!(b^((x+y)%2===0?1:0));index++;
      }
    }
  }
  // ECL=L (1), mask=0; código BCH con XOR 0x5412.
  const eclMask=1<<3;let rem=eclMask;
  for(let i=0;i<10;i++)rem=(rem<<1)^(((rem>>>9)&1)*0x537);
  const fmt=((eclMask<<10)|rem)^0x5412;
  const bit=i=>!!((fmt>>>i)&1);
  for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));
  for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(SIZE-1-i,8,bit(i));
  for(let i=8;i<15;i++)set(8,SIZE-15+i,bit(i));
  set(8,SIZE-8,true);
  return matrix;
}
export function qrSvg(value){
  const matrix=qrMatrix(value), margin=4, total=SIZE+2*margin;let path='';
  matrix.forEach((line,y)=>line.forEach((dark,x)=>{if(dark)path+=`M${x+margin} ${y+margin}h1v1h-1z`;}));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="Código QR del turno"><path fill="#ffffff" d="M0 0h${total}v${total}H0z"/><path fill="#12243f" d="${path}"/></svg>`;
}
