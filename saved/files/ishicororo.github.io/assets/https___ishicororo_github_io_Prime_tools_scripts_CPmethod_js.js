const CPvariable={
    input:document.getElementById("create"),
    newInput:document.getElementById("newInput"),
    downloadLink:document.getElementById("downloadLink"),
}
function method(){
     const CreateMethod=document.getElementById("createMethod").value;
     if(CreateMethod==="primesCreate"){
          CPvariable.newInput.classList.remove("close");
          CPvariable.input.value="1";
          CPvariable.input.placeholder="開始値を入力";
     }
     else if(CreateMethod==="max"){
          CPvariable.input.placeholder="最大値を入力";
          CPvariable.newInput.classList.add("close");
          CPvariable.input.value="";
          CPvariable.downloadLink.classList.add("close");
     }
     else{
          CPvariable.newInput.classList.add("close");
          CPvariable.input.placeholder="生成したい桁数を入力"
          CPvariable.input.value="";
          CPvariable.downloadLink.classList.add("close");
     }
}