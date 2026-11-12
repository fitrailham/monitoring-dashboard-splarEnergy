import assert from "node:assert/strict";
import {test} from "node:test";
import {getPortfolioSummary, summaryAlarms, summaryMetric, getRankings} from "../src/services/portfolio.ts";
import {savePlant} from "../src/services/plantAdmin.ts";

function mock(t, handler) {
  const previous=globalThis.fetch;
  t.after(()=>{globalThis.fetch=previous;});
  globalThis.fetch=async(url,init)=>new Response(JSON.stringify(await handler(new URL(url),init)));
}
const coverage={expected:10,valid:8,missing:1,stale:1,unverified:0,not_applicable:0,partial:true};
const summary=()=>({total_plants:10,kpis:{current_power_kw:0},coverage:{pv_power_kw:coverage},
  plant_status:{normal:8,faulty:0,disconnected:1,unknown:1},
  active_alarms:{configured:false,total:null,severity:{},coverage:{expected_plants:10,valid_plants:0,complete:false}}});
test("portfolio summary uses server scope and coverage rather than the table's page", async(t)=>{
  mock(t,url=>{assert.equal(url.pathname,"/api/portfolio/summary");assert.equal(url.searchParams.get("time_zone"),"Asia/Jakarta");return {success:true,data:summary()};});
  const result=await getPortfolioSummary();
  const metric=summaryMetric(result,"current_power_kw",{value:999,expected:1},"pv_power_kw");
  assert.equal(metric.value,0);assert.equal(metric.expected,10);assert.equal(metric.valid,8);assert.equal(metric.partial,true);
  assert.equal(summaryAlarms(result).available,false);
});
test("configured empty alarms remain verified zero while incomplete coverage stays partial",()=>{
  const data=summary();data.active_alarms={configured:true,total:0,severity:{critical:0},coverage:{expected_plants:10,valid_plants:8,complete:false}};
  const alarms=summaryAlarms(data);assert.equal(alarms.available,true);assert.equal(alarms.complete,false);
  assert.deepEqual(alarms.counts,[0,0,0,0,0]);
});
test("ranking sends an explicit date and timezone and does not replace an empty ranking with local guesses",async(t)=>{
  mock(t,url=>{assert.equal(url.searchParams.get("date"),"2026-11-12");assert.equal(url.searchParams.get("metric"),"specific_energy");return{success:true,data:[]};});
  assert.deepEqual((await getRankings("2026-11-12","Asia/Makassar")).rows,[]);
});
const form={code:"P/1",name:"Plant",capacity:"10.5",zone:"Asia/Makassar",country:"id",region:"",city:"",address:"Example",latitude:"0",longitude:"100"};
test("plant registration sends bearer token only as a header and preserves zero coordinates",async(t)=>{
  mock(t,(url,init)=>{
    assert.equal(url.pathname,"/api/database/plants");assert.equal(init.method,"POST");
    assert.equal(init.headers.Authorization,"Bearer test-token");
    const body=JSON.parse(init.body);assert.equal(body.latitude,0);assert.equal(body.country_code,"ID");
    assert.equal(body.plant_code,"P/1");assert.equal(body.capacity_kwp,10.5);assert.equal(body.token,undefined);
    assert.equal(url.search," ".trim());return{success:true,data:{plant_code:"P/1"}};
  });
  await savePlant(form,"test-token");
});
test("metadata patch sends only fields allowed by backend and never sends telemetry or a name rename",async(t)=>{
  mock(t,(url,init)=>{
    assert.equal(decodeURIComponent(url.pathname),"/api/database/plants/P/1");assert.equal(init.method,"PATCH");
    const body=JSON.parse(init.body);assert.equal(body.plant_code,undefined);assert.equal(body.plant_name,undefined);
    assert.equal(body.address,undefined);assert.equal(body.pv_power_kw,undefined);return{success:true,data:{}};
  });
  await savePlant(form,"test-token","P/1");
});
test("invalid coordinates, empty tokens and nonpositive capacity are rejected before any write",async(t)=>{
  mock(t,()=>assert.fail("No write is allowed for an invalid form"));
  await assert.rejects(savePlant(form,""),/token/);
  await assert.rejects(savePlant({...form,capacity:"0"},"token"),/Kapasitas/);
  await assert.rejects(savePlant({...form,latitude:""},"token"),/koordinat/);
});
