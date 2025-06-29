function create(){
     const method=document.getElementById("createMethod").value;
     let number=Number(document.getElementById("create").value);
     let number2=Number(document.getElementById("newInput").value)
     const result=document.getElementById("created");
     let result_number;
     if(method==="digit"){
          for(let test=10**number-3;String(test).length===number;test-=2){
               if(foundation.check(test)){
                    result_number=test;
                    break;
               }
          }
          result.textContent=`${number}桁：`+result_number;
     }
     else if(method==="max"){
          if(number!==2){
          if(number%2===0){
               number=number-1;
          }
     }
          for(let test=number;test>=0;test-=2){
               if(foundation.check(test)){
                    result_number=test;
                    break;
               }
          }
          result.textContent=`${number}以下の素数：`+result_number;
     }
     else if(method==="primesCreate"){
          let newPrimes=foundation.create(number,number2);
          if(newPrimes.length<=100){
               result.textContent="ダウンロード期限は5分です。\n"+`${number}から${number2}:\n`+newPrimes;
          }
          else{
               result.textContent="素数配列が長いため、ダウンロードしてご使用ください。ダウンロード期限は5分です。"
          }
          const blob=new Blob([newPrimes],{type:"text/plain"});
          const url=URL.createObjectURL(blob);
          CPvariable.downloadLink.href=url;
          CPvariable.downloadLink.classList.remove("close");
          setTimeout(()=>URL.revokeObjectURL(url),300000);
     }
     }
