const defaults={
  ticket:220,salesDay:4.65,salesDayLow:4.3,salesDayHigh:5,daysWeek:5,completionRate:100,d2dRaiseSalesThreshold:4.3,
  detailerPay:17,detailerRaise:1,detailerRaiseMonths:6,
  managerPay:22,managerRaise:1,managerRaiseMonths:6,
  adminPay:24,adminRaise:0,adminRaiseMonths:12,
  recruiterPay:24,recruitersPerOffice:0.5,
  d2dBase:300,d2dCommission:10,d2dRaise:1,d2dRaiseMonths:3,d2dCap:15,
  hoursWeek:40,weeksYear:52,
  vanPurchase:3000,vanSetup:2000,vanMonthly:1200,
  ipadPurchase:500,ipadService:40,hotspot:50,
  payrollTax:7.65,workersComp:2.0,paymentProcessing:3.0,
  recruitCost:150,
  officeSmall:1000,officeMedium:2200,officeLarge:3500,
  officeSetup:3500,otherOverhead:1500
};

const labels={
  ticket:'Average detail ($)',salesDay:'Planning avg details / day',salesDayLow:'Low target details / day',salesDayHigh:'High target details / day',daysWeek:'Selling days / week',completionRate:'Completed jobs %',d2dRaiseSalesThreshold:'D2D sales/day required for raises',
  detailerPay:'Detailer starting $/hr',detailerRaise:'Detailer raise ($)',detailerRaiseMonths:'Detailer raise every (months)',
  managerPay:'Manager starting $/hr',managerRaise:'Manager raise ($)',managerRaiseMonths:'Manager raise every (months)',
  adminPay:'Admin starting $/hr',adminRaise:'Admin raise ($)',adminRaiseMonths:'Admin raise every (months)',
  recruiterPay:'Recruiter $/hr',recruitersPerOffice:'Recruiters per office',
  d2dBase:'D2D base $/week',d2dCommission:'D2D starting commission %',d2dRaise:'D2D raise (percentage points)',d2dRaiseMonths:'D2D raise every (months)',d2dCap:'D2D commission cap %',
  hoursWeek:'Hourly staff hours / week',weeksYear:'Weeks / year',
  vanPurchase:'Average van purchase ($)',vanSetup:'Van equipment/setup ($)',vanMonthly:'Van monthly operating ($)',
  ipadPurchase:'iPad purchase ($)',ipadService:'iPad service / month ($)',hotspot:'Hotspot / van / month ($)',
  payrollTax:'Employer payroll tax %',workersComp:'Workers comp / payroll %',paymentProcessing:'Card processing % of sales',
  recruitCost:'Recruiting / new hire ($)',officeSmall:'Small office / month ($)',officeMedium:'Medium office / month ($)',officeLarge:'Large office / month ($)',officeSetup:'New office setup ($)',otherOverhead:'Other overhead / month ($)'
};

let s={...defaults,...JSON.parse(localStorage.getItem('nsPlanner')||'{}')};
const inputBox=document.querySelector('#inputs');
Object.keys(defaults).forEach(k=>{
  const d=document.createElement('div');d.className='field';
  d.innerHTML=`<label>${labels[k]}</label><input type="number" step="0.01" data-k="${k}" value="${s[k]}">`;
  inputBox.appendChild(d);
});
inputBox.addEventListener('input',e=>{if(!e.target.dataset.k)return;s[e.target.dataset.k]=+e.target.value;localStorage.setItem('nsPlanner',JSON.stringify(s));render()});
document.querySelector('#reset').onclick=()=>{localStorage.removeItem('nsPlanner');location.reload()};

const months=[];
for(let y=2027;y<=2028;y++){const start=y===2027?3:0;for(let m=start;m<12;m++)months.push({y,m});}

// Growth plan agreed in the conversation: 50 detailers by Dec 2027, 100 by Dec 2028.
const targetDetailers=[2,8,14,20,26,32,38,44,50,50,54,58,62,66,70,75,80,85,90,95,100];
const targetOffices=[0,1,1,1,1,1,1,1,1, 1,1,1,2,2,2,2,3,3,3,3,4];

const money=n=>`${n<0?'-$':'$'}${Math.abs(Math.round(n)).toLocaleString()}`;
const pct=n=>`${Number(n).toFixed(1)}%`;
const monthName=x=>`${new Date(x.y,x.m).toLocaleString('en',{month:'short'})} ${x.y}`;

function addCohort(cohorts,count,monthIndex){if(count>0)cohorts.push({count,monthIndex});}
function cohortHourlyPayroll(cohorts,monthIndex,startPay,raiseAmt,raiseMonths){
  const monthlyHours=s.hoursWeek*s.weeksYear/12;
  return cohorts.reduce((sum,c)=>{
    const tenure=monthIndex-c.monthIndex;
    const raises=raiseMonths>0?Math.floor(tenure/raiseMonths):0;
    return sum+c.count*(startPay+raises*raiseAmt)*monthlyHours;
  },0);
}
function cohortD2DPayroll(cohorts,monthIndex,revenuePerRep){
  const baseMonthly=s.d2dBase*s.weeksYear/12;
  return cohorts.reduce((sum,c)=>{
    const tenure=monthIndex-c.monthIndex;
    const eligible=s.salesDay>=s.d2dRaiseSalesThreshold;
    const steps=eligible&&s.d2dRaiseMonths>0?Math.floor(tenure/s.d2dRaiseMonths):0;
    const commission=Math.min(s.d2dCap,s.d2dCommission+steps*s.d2dRaise);
    return sum+c.count*(baseMonthly+revenuePerRep*commission/100);
  },0);
}
function avgD2DCommission(cohorts,monthIndex){
  const total=cohorts.reduce((a,c)=>a+c.count,0); if(!total)return 0;
  return cohorts.reduce((sum,c)=>{
    const tenure=monthIndex-c.monthIndex;
    const eligible=s.salesDay>=s.d2dRaiseSalesThreshold;
    const steps=eligible&&s.d2dRaiseMonths>0?Math.floor(tenure/s.d2dRaiseMonths):0;
    return sum+c.count*Math.min(s.d2dCap,s.d2dCommission+steps*s.d2dRaise);
  },0)/total;
}
function officeRent(offices){
  if(offices<=1)return offices*s.officeSmall;
  if(offices===2)return offices*s.officeMedium;
  return offices*s.officeLarge;
}

function render(){
  let rows='',totals={2027:{rev:0,op:0,cash:0},2028:{rev:0,op:0,cash:0}};
  let prev={det:0,d2d:0,mgr:0,vans:0,off:0,admin:0,recruiter:0};
  const cohorts={det:[],d2d:[],mgr:[],admin:[],recruiter:[]};

  months.forEach((x,i)=>{
    const det=targetDetailers[i];
    const d2d=Math.ceil(det/2);
    const vans=Math.ceil(det/2);
    const mgr=Math.floor(vans/5); // owner manages until 5 vans, then 1 manager per 5 vans
    const off=targetOffices[i];
    const admin=off; // one admin per office
    const recruiter=x.y===2027&&x.m===3?0:Math.max(1,Math.ceil(off*s.recruitersPerOffice)); // starts May 2027

    const newDet=Math.max(0,det-prev.det),newD=Math.max(0,d2d-prev.d2d),newMgr=Math.max(0,mgr-prev.mgr),newAdmin=Math.max(0,admin-prev.admin),newRecruiter=Math.max(0,recruiter-prev.recruiter),newV=Math.max(0,vans-prev.vans),newOff=Math.max(0,off-prev.off);
    addCohort(cohorts.det,newDet,i);addCohort(cohorts.d2d,newD,i);addCohort(cohorts.mgr,newMgr,i);addCohort(cohorts.admin,newAdmin,i);addCohort(cohorts.recruiter,newRecruiter,i);

    const revenuePerRep=s.salesDay*s.daysWeek*s.ticket*s.weeksYear/12*(s.completionRate/100);
    const rev=d2d*revenuePerRep;

    // Raises are cohort-based: each employee's raise clock begins on their hire month.
    const detPayroll=cohortHourlyPayroll(cohorts.det,i,s.detailerPay,s.detailerRaise,s.detailerRaiseMonths);
    const mgrPayroll=cohortHourlyPayroll(cohorts.mgr,i,s.managerPay,s.managerRaise,s.managerRaiseMonths);
    const adminPayroll=cohortHourlyPayroll(cohorts.admin,i,s.adminPay,s.adminRaise,s.adminRaiseMonths);
    const recruiterPayroll=cohortHourlyPayroll(cohorts.recruiter,i,s.recruiterPay,0,12);
    const d2dPayroll=cohortD2DPayroll(cohorts.d2d,i,revenuePerRep);
    const wages=detPayroll+mgrPayroll+adminPayroll+recruiterPayroll+d2dPayroll;

    const payrollTaxes=wages*s.payrollTax/100;
    const workersComp=(detPayroll+mgrPayroll+adminPayroll+recruiterPayroll)*s.workersComp/100;
    const processing=rev*s.paymentProcessing/100;
    const recurring=vans*(s.vanMonthly+s.hotspot)+d2d*s.ipadService+officeRent(off)+s.otherOverhead;
    const recruiting=(newDet+newD+newMgr+newAdmin+newRecruiter)*s.recruitCost;

    // Operating profit excludes purchases of long-lived assets (vans/iPads/office setup).
    const opExpenses=wages+payrollTaxes+workersComp+processing+recurring+recruiting;
    const opProfit=rev-opExpenses;

    // Cash flow shows the actual cash hit from growth capital separately.
    const growthCapex=newV*(s.vanPurchase+s.vanSetup)+newD*s.ipadPurchase+newOff*s.officeSetup;
    const netCash=opProfit-growthCapex;

    totals[x.y].rev+=rev;totals[x.y].op+=opProfit;totals[x.y].cash+=netCash;
    const avgComm=avgD2DCommission(cohorts.d2d,i);
    rows+=`<tr><td>${monthName(x)}</td><td>${det}</td><td>${d2d}</td><td>${vans}</td><td>${mgr}</td><td>${off}</td><td>${money(rev)}</td><td>${pct(avgComm)}</td><td class="${opProfit>=0?'positive':'negative'}">${money(opProfit)}</td><td class="${netCash>=0?'positive':'negative'}">${money(netCash)}</td></tr>`;
    prev={det,d2d,mgr,vans,off,admin,recruiter};
  });

  document.querySelector('#projection').innerHTML=rows;
  document.querySelector('#r27').textContent=money(totals[2027].rev);
  document.querySelector('#p27').textContent=money(totals[2027].op);
  document.querySelector('#c27').textContent=money(totals[2027].cash);
  document.querySelector('#r28').textContent=money(totals[2028].rev);
  document.querySelector('#p28').textContent=money(totals[2028].op);
  document.querySelector('#c28').textContent=money(totals[2028].cash);
  document.querySelector('#heroTicket').textContent=money(s.ticket);
  const heroVolume=document.querySelector('#heroVolume'); if(heroVolume) heroVolume.textContent=`${s.salesDayLow.toFixed(1)}–${s.salesDayHigh.toFixed(1)}`;

  const unitRev=s.salesDay*s.daysWeek*s.ticket*s.weeksYear/12*(s.completionRate/100);
  const detStart=2*s.detailerPay*s.hoursWeek*s.weeksYear/12;
  const d2dStart=s.d2dBase*s.weeksYear/12+unitRev*s.d2dCommission/100;
  const d2dCapPay=s.d2dBase*s.weeksYear/12+unitRev*s.d2dCap/100;
  const units=[
    ['1 D2D monthly revenue',unitRev],['2 detailers starting payroll',detStart],['1 D2D starting pay',d2dStart],['1 D2D pay at cap',d2dCapPay],
    ['1 van operations',s.vanMonthly+s.hotspot],['1 manager starting payroll',s.managerPay*s.hoursWeek*s.weeksYear/12],['1 admin starting payroll',s.adminPay*s.hoursWeek*s.weeksYear/12],['New van + setup',s.vanPurchase+s.vanSetup],['Recruiting per hire',s.recruitCost]
  ];
  document.querySelector('#unitCosts').innerHTML=units.map(a=>`<div class="unit"><span>${a[0]}</span><b>${money(a[1])}</b></div>`).join('');
}

function exportCSV(){
  const headers=['Month','Detailers','D2D','Vans','Managers','Offices','Revenue','Avg D2D Commission','Operating Profit','Net Cash Flow'];
  const trs=[...document.querySelectorAll('#projection tr')];
  const lines=[headers.join(','),...trs.map(tr=>[...tr.children].map(td=>`"${td.textContent.replaceAll('"','""')}"`).join(','))];
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='north-splash-projection.csv';a.click();URL.revokeObjectURL(a.href);
}
document.querySelector('#export').onclick=exportCSV;
render();
