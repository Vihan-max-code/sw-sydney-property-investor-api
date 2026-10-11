var RENT = {
  intercept: 497.4,
  beds: 68.6, baths: 59.9, cars: 11.8,
  is_unit: -42.8, is_townhouse: -50.4,
  suburbs: {"Macquarie Fields":-153.4,"Minto":-156.2,"Leumeah":-198.8,"Glenfield":-155.8,"Holsworthy":-75.0,"East Hills":0}
};
var GROWTH = {"Macquarie Fields":7.52,"Minto":7.83,"Leumeah":7.76,"Glenfield":9.56,"Holsworthy":2.00,"East Hills":6.31};

function cap(s){if(!s)return"";return s.split(" ").map(function(w){return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()}).join(" ")}

function predictRent(beds,baths,cars,pt,sub){
  var b=Math.min(Math.max(beds||3,1),6);
  var bt=Math.min(Math.max(baths||1,1),4);
  var c=Math.min(Math.max(cars||1,0),4);
  var r=RENT.intercept + b*RENT.beds + bt*RENT.baths + c*RENT.cars;
  if(pt&&/unit|apartment|studio/i.test(pt))r+=RENT.is_unit;
  if(pt&&/townhouse|villa/i.test(pt))r+=RENT.is_townhouse;
  var sa=RENT.suburbs[cap(sub)];
  if(sa!==undefined)r+=sa;
  r=r*1.05*1.03;
  return Math.round(Math.max(r,250));
}

function analyseProperty(price,beds,baths,landSize,pt,sd,priceLow,priceHigh){
  if(!price||price<50000||price>10000000)return null;
  var sub=(sd&&sd.name)?sd.name:"Macquarie Fields";
  var iu=pt&&/unit|apartment|studio/i.test(pt);
  var dom=15;
  if(sd){if(iu&&sd.unit)dom=sd.unit.daysOnMarket||20;else if(sd.house)dom=sd.house.daysOnMarket||15}

  var modelPrice=price;
  if(priceLow&&priceHigh&&priceHigh>priceLow){
    var spread=(priceHigh-priceLow)/priceLow;
    if(spread<0.20){
      var pos=0.5;
      if((beds||3)>=5)pos+=0.15;else if((beds||3)>=4)pos+=0.10;else if((beds||3)<=2)pos-=0.10;
      if((baths||1)>=3)pos+=0.10;else if((baths||1)>=2)pos+=0.05;
      if(landSize&&landSize>=600)pos+=0.10;else if(landSize&&landSize>=400)pos+=0.05;
      if(iu)pos-=0.10;
      pos=Math.min(0.90,Math.max(0.10,pos));
      modelPrice=Math.round((priceLow+(priceHigh-priceLow)*pos)/5000)*5000;
      modelPrice=Math.min(Math.max(modelPrice,priceLow),priceHigh);
    }
  }

  var rent=predictRent(beds,baths,1,pt,sub);
  var grossYield=(rent*52/modelPrice)*100;

  var growth=GROWTH[cap(sub)]||6.0;
  if(modelPrice>2000000)growth=Math.min(growth,3.0);
  else if(modelPrice>1500000)growth=Math.min(growth,4.5);
  else if(modelPrice>1200000)growth=Math.min(growth,6.0);

  var proj5=Math.round(modelPrice*Math.pow(1+growth/100,5));
  if(proj5>modelPrice*1.50)proj5=Math.round(modelPrice*1.50);
  var equity5=proj5-modelPrice;

  var median=1000000;
  if(sd&&sd.house)median=sd.house.medianPrice||1000000;
  if(iu&&sd&&sd.unit)median=sd.unit.medianPrice||688000;
  var vsMedian=((modelPrice-median)/median)*100;

  var score=40,reasons=[];
  if(grossYield>=5){score+=25;reasons.push("Excellent yield")}
  else if(grossYield>=4.5){score+=20;reasons.push("Strong yield")}
  else if(grossYield>=4){score+=16;reasons.push("Good yield")}
  else if(grossYield>=3.5){score+=12;reasons.push("Solid yield")}
  else if(grossYield>=3){score+=8;reasons.push("Average yield")}
  else if(grossYield>=2.5){score+=4;reasons.push("Below-avg yield")}
  if(vsMedian<-30){score+=15;reasons.push("Deep value")}
  else if(vsMedian<-15){score+=12;reasons.push("Well below median")}
  else if(vsMedian<-5){score+=8;reasons.push("Below median")}
  else if(vsMedian<5){score+=5;reasons.push("At median")}
  if(landSize>=700){score+=10;reasons.push("Large land")}
  else if(landSize>=500){score+=7;reasons.push("Good land")}
  else if(landSize>=300)score+=4;
  if((beds||3)>=3&&(beds||3)<=4){score+=5;reasons.push("High-demand config")}
  else if((beds||3)>=5){score+=3;reasons.push("Large home")}
  else if((beds||3)===2)score+=3;
  if((baths||1)>=2&&(beds||3)>=3)score+=3;
  score=Math.min(Math.max(score,10),98);
  var verdict=score>=80?"STRONG BUY":score>=65?"BUY":score>=50?"HOLD":"WEAK";
  var color=score>=80?"#10b981":score>=65?"#22c55e":score>=50?"#f59e0b":"#ef4444";

  return{score:score,verdict:verdict,color:color,reasons:reasons,grossYield:grossYield.toFixed(2),rent:rent,dom:dom,growth:growth.toFixed(2),proj5:proj5,equity5:equity5,modelPrice:modelPrice};
}

module.exports={analyseProperty:analyseProperty,predictRent:predictRent};
