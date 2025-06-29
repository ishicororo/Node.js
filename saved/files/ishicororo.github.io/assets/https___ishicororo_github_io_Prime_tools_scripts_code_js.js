const codeVariables={
    codeText:document.getElementById("code_text"),
    codeKey:document.getElementById("code_key"),
    codeResult:document.getElementById("code_result"),
}
function execute(){
     const encoder=new TextEncoder();
     const decoder=new TextDecoder();
     const stringBinaryArrayBuffer=Array.from(codeVariables.codeText.value).map(i=>i.codePointAt(0).toString(0));
     const keyBinaryArrayBuffer=encoder.encode(codeVariables.codeKey.value);
     let correspondenceTable=[[0,0]];
     let newStringArray=[];
     let finalStringBinaryArarry={
          index:[],
          body:[],
     };
     for(let i=0;i<keyBinaryArrayBuffer.length;i++){
          for(let j=Math.floor(65535/keyBinaryArrayBuffer.length)*i,k=keyBinaryArrayBuffer[i];j<=Math.floor(65535/keyBinaryArrayBuffer.length)*(i+1);j++,k=foundation.nextPrime(k,1)){
               correspondenceTable.push([i,k+keyBinaryArrayBuffer[i]]);
          }
     }
     console.log(keyBinaryArrayBuffer);
     console.log(correspondenceTable);
     for(let i of stringBinaryArrayBuffer){
          finalStringBinaryArarry.index.push(correspondenceTable[i][0]);
          finalStringBinaryArarry.body.push(correspondenceTable[i][1]);
     }
     for(let i=0;i<=finalStringBinaryArarry.body.length-1;i++){
          newStringArray.push(String.fromCodePoint(finalStringBinaryArarry.body[i]));
     }
     const newString=newStringArray.join("");
     console.log(newString);
     for(let i=1;i<=Math.ceil(finalStringBinaryArarry.index.length/8);i++){
          for(let j=0;j<=7;j++){
          }
     }
}
function returnCode(){
}