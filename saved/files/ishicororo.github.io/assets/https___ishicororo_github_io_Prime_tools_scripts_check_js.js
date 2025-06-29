function check(){
     const number=Number(document.getElementById("check").value);
     const result=document.getElementById("checked");
     if(foundation.check(number)){
          result.textContent=number+":素数です。";
     }
     else{
          result.textContent=number+":素数ではありません。";
     }
}