//ここからコンテンツの表示
const variables={
     primesSet:new Set(primes),
     lodeContens:document.getElementById("loadingMenu"),
     loadBar:document.getElementById("loadBar"),
     loadpercentage:document.getElementById("loadPercentage"),
}
//ここからメイン関数
const foundation={
     addPrimes:function(max){
          for(let test=primes[primes.length-1]+2;test<=max;test+=2){
               if(this.check(test)){
                    primes.push(test);
                    variables.primesSet.add(test);
               }
          }
     },
     check:function(number){
           let isprime=true;
           if(number<2){return false;}
           else if(number<=primes[primes.length-1]){
               if(variables.primesSet.has(number)){
                    return true;
               }
           }
           else if(Math.sqrt(number)<=primes[primes.length-1]){
           for(let prime of primes){
                if(prime<=Math.sqrt(number)){
                     if(number%prime===0){
                          isprime=false;
                          break;
                     }
                }
                else{
                     break;
                }
           }
           return isprime;
      }
      else{
          this.addPrimes(Math.ceil(Math.sqrt(number)));
          return this.check(number);
      }
     },
     create:function(bigin,end){
          let newPrimes=[];
               if(end%2===0){
                    end-=1;
               }
          for(let addNumber=end;addNumber>=bigin;addNumber-=2){
               if(this.check(addNumber)){
                    newPrimes.push(addNumber);
               }
          }
          if(bigin<=2&&end>=2){
               newPrimes.push(2);
          }
          return newPrimes.reverse();
     },
     nextPrime:function(number,order){
          let nowOrder=0;
          if(number%2===0){
               number+=1;
          }
          else{
               number+=2;
          }
          for(let i=number;i>=0;i+=2){
               if(this.check(i)){
                    nowOrder+=1;
                    if(nowOrder===order){
                         return i;
                    }                    
               }
          }
     },
     percentage:function(percentage){
          variables.lodeContens.classList.remove("close");
          variables.loadBar.style.width=`${percentage}%`;
          variables.loadpercentage.textContent=`現在：${percentage}%です`;
          //実行後のcloseを忘れないように
     },
     };