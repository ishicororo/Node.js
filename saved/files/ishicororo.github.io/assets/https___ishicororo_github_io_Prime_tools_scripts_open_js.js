//ここからコンテンツの表示
const tools={
     home : document.getElementById("home"),
     prime_check : document.getElementById("prime_check"),
     prime_create : document.getElementById("prime_create"),
     prime_code : document.getElementById("prime_code"),
}
function show(content){
     document.getElementsByClassName("open")[0].classList.add("close");
     document.getElementsByClassName("open")[0].classList.remove("open");
     content.classList.add("open");
     content.classList.remove("close");
}