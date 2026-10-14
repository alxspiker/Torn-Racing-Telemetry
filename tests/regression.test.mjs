import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const part = file => readFileSync(resolve(root, 'src/userscript', file), 'utf8');
const moduleObj = (file, names, context = {}) => new Function(...names, part(file) + `\nreturn ${file.startsWith('40-') ? 'Telemetry' : file.startsWith('60-') ? 'APIManager' : file.startsWith('70-') ? 'StatsCalculator' : file.startsWith('80-') ? 'DataExporter' : file.startsWith('96-') ? 'DriverInspector' : 'Utils'};`)(...names.map(n => context[n]));

const config = values => ({ get: key => ({ minUpdateInterval: 300, speedSmoothingFactor: .7, lapEstimateSmoothingFactor: .15, speedUnit: 'mph', ...values })[key] });
const state = () => ({ previousMetrics: {}, trackInfo: { laps: 5, length: 3.4, get total() { return this.laps * this.length; } }, trackNameMap: null });
const utils = moduleObj('30-utils.js', []);

test('single bundle parses and release retains published identity and update URLs', () => {
    const bundle = readFileSync(resolve(root, 'tornracingtelemetry.js'), 'utf8');
    assert.ok(bundle.startsWith('// ==UserScript=='));
    assert.match(bundle, /@version\s+4\.0\.0\s*\n/);
    assert.match(bundle, /@name\s+Torn Racing Telemetry\s*\n/);
    assert.match(bundle, /@namespace\s+https:\/\/www\.torn\.com\/profiles\.php\?XID=2782979\s*\n/);
    assert.ok(bundle.includes('// @downloadURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.user.js'));
    assert.ok(bundle.includes('// @updateURL https://update.greasyfork.org/scripts/522245/Torn%20Racing%20Telemetry.meta.js'));
    assert.ok(bundle.includes('const DriverInspector ='));
    new vm.Script(bundle);
});

test('new progress after a 2-second gap produces a positive speed estimate', () => {
    const s = state();
    const t = moduleObj('40-telemetry.js', ['State','Config'], { State: s, Config: config() });
    t.calculateDriverMetrics('1', 0, 1000);
    const sample = t.calculateDriverMetrics('1', 1, 3000);
    assert.ok(sample.speed > 0, `speed should be positive: ${sample.speed}`);
    assert.equal(s.previousMetrics['1'].progress, 1);
    assert.ok(s.previousMetrics['1'].totalDistanceTraveled > 0);
});

test('no-progress stall decays uncertainty without fabricating brake acceleration', () => {
    const s = state();
    const t = moduleObj('40-telemetry.js', ['State','Config'], { State: s, Config: config() });
    t.calculateDriverMetrics('1', 0, 1000);
    const before = t.calculateDriverMetrics('1', 1, 3000);
    const after = t.calculateDriverMetrics('1', 1, 6000);
    assert.ok(after.speed < before.speed);
    assert.equal(after.acceleration, 0);
    assert.equal(s.previousMetrics['1'].wasStale, true);
});

test('backwards progress resets a driver sample instead of generating impossible negative distance', () => {
    const s = state();
    const t = moduleObj('40-telemetry.js', ['State','Config'], { State: s, Config: config() });
    t.calculateDriverMetrics('1', 35, 1000);
    const sample = t.calculateDriverMetrics('1', 4, 3000);
    assert.equal(sample.speed, 0);
    assert.equal(s.previousMetrics['1'].progress, 4);
});

test('win/podium rates include crashes; numeric-string positions remain numeric', () => {
    const s = state();
    const calc = moduleObj('70-stats-calculator.js', ['State'], {State:s});
    const races = [
        {status:'finished',track_id:1, results:[{driver_id:'1',position:'1',has_crashed:false,car_item_name:'Volt'}]},
        {status:'finished',track_id:1, results:[{driver_id:'1',position:3,has_crashed:true,car_item_name:'Volt'}]},
        {status:'finished',track_id:1, results:[{driver_id:'1',position:1,has_crashed:false,car_item_name:'Volt'}]}
    ];
    const out = calc.processRaceData(races, '1');
    assert.ok(Math.abs(out.overall.winRate - 200 / 3) < 1e-9);
    assert.ok(Math.abs(out.overall.podiumRate - 200 / 3) < 1e-9);
    assert.ok(Math.abs(out.overall.crashRate - 100 / 3) < 1e-9);
    assert.equal(out.overall.avgPosition, 1);
});

test('pagination does not follow previous-page links and rejects outside hosts', async () => {
    const api = moduleObj('60-api-manager.js', ['Utils','Config'], {Utils:{sleep: async()=>{}},Config:config()});
    assert.equal(api.normalizeApiUrl('https://example.com/steal'), null);
    assert.equal(api.normalizeApiUrl('http://api.torn.com/v2/user/races'), null);
    assert.equal(api.normalizeApiUrl('https://api.torn.com/v2/user/races?limit=20')?.startsWith('https://api.torn.com/'), true);
    const visited = [];
    api.fetchWithAuthHeader = async url => {
        visited.push(url);
        return { races:[{id:visited.length}], _metadata:{ links:{ prev:'https://api.torn.com/v2/user/races?page=0' } } };
    };
    const races = await api.fetchHistoricalRaceData('KEY','1',40);
    assert.equal(races.length, 1);
    assert.equal(visited.length, 1);
});

test('API merge does not turn missing timing into a bogus zero-second lap', () => {
    const api = moduleObj('60-api-manager.js', ['Utils','Config'], {Utils:{formatTime:()=>''},Config:config()});
    const rows = new Map([['1',{userId:'1',position:2,bestLap:null,raceTime:null}]]);
    const official = new Map([['1',{position:null,best_lap_time:null,race_time:null,has_crashed:false}]]);
    api.raceData.mergeApiRaceResults(rows,official);
    assert.equal(rows.get('1').bestLap,null);
    assert.equal(rows.get('1').raceTime,null);
    assert.equal(rows.get('1').position,2);
});

test('HTML export escapes user-supplied track and driver text', () => {
    const s={currentRaceId:'20', trackInfo:{name:'A <script>alert(1)</script>',laps:5,length:3.4},finalRaceData:[{name:'<img onerror=evil>',userId:'1',carTitle:'Car & Bike',statusClass:'finished',originalStatusText:'2:30.000'}]};
    const exp = moduleObj('80-data-exporter.js', ['State','Utils','ScriptInfo'], {State:s,Utils:utils,ScriptInfo:{version:'test'}});
    const html=exp.formatAsHTML();
    assert.match(html,/&lt;img onerror=evil&gt;/);
    assert.match(html,/Car &amp; Bike/);
    assert.doesNotMatch(html,/<img onerror=evil>/);
    assert.match(exp.formatAsMarkdown(),/Car & Bike/);
});

test('mobile inspector assembles Race and Telemetry separately, without inserting names as HTML', () => {
    class El {
        constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};this.dataset={};}
        append(...parts){this.children.push(...parts);}
        setAttribute(n,v){this.attributes[n]=v;}
        set textContent(x){this.text=x;}
        get textContent(){return this.text??'';}
    }
    const U={createElement:(tag,options={})=>{const el=new El(tag);el.className=options.className||'';if(options.text!==undefined)el.textContent=options.text;return el;},formatTime:utils.formatTime, convertSpeed:utils.convertSpeed, isApiKeyAvailable:()=>false};
    const row = {id:'lbr-1'};
    const S={userId:'1',currentRaceId:'23',trackInfo:{name:'Uptown',laps:5,length:3.4},originalLeaderboard:{children:[row]},previousMetrics:{'1':{reportedSpeed:120,acceleration:.4,currentLap:2,progressInLap:60,smoothedLapEstimate:31,wasStale:false}}};
    const c=config();
    const Inspector = moduleObj('96-driver-inspector.js', ['Utils','State','Config','RaceManager','APIManager','document'], { Utils:U,State:S,Config:c,RaceManager:{},APIManager:{raceData:{getSkillGainDisplay:()=> 'N/A'}},document:{getElementById:()=>row} });
    Inspector.selectedUserId='1'; Inspector.selectedOriginalId='lbr-1';Inspector.selectedRaceId='23';
    const driver={userId:'1',name:'<h1>Oops</h1>',carTitle:'Volt GT',statusClass:'racing',progress:23,originalStatusText:'23%'};
    const flatten=el=>(el.textContent || '') + (el.children||[]).map(flatten).join(' ');
    const race=flatten(Inspector.raceContent(driver));
    const live=flatten(Inspector.telemetryContent(driver));
    const career=flatten(Inspector.careerContent(driver));
    assert.match(race,/Uptown/);
    assert.doesNotMatch(race,/Racing points/);
    assert.match(live,/120\.0 mph/);
    assert.match(live,/31:00|0:31/);
    assert.match(career,/Add a Torn API key/);
});

test('legacy history is not automatically purged at initialization', () => {
    assert.doesNotMatch(part('110-main.js'), /purgeHistoryStorageIfNeeded|HistoryStore.clearEntries/);
    assert.equal(existsSync(resolve(root,'src/userscript/95-history-store.js')),false);
});


test('ready state does not invent a first lap, racing time or estimated speed', () => {
    class El {
        constructor(tag) { this.tag=tag; this.children=[]; this.attributes={}; this.style={}; }
        append(...x) { this.children.push(...x); }
        setAttribute(k,v) { this.attributes[k]=v; }
        set textContent(x) { this.text=x; }
        get textContent() { return this.text||''; }
    }
    const U={createElement:(tag,o={})=>{const e=new El(tag); e.className=o.className; if (o.text!==undefined)e.textContent=o.text;return e;},formatTime:utils.formatTime,convertSpeed:utils.convertSpeed,isApiKeyAvailable:()=>false};
    const row={id:'lbr-1'};
    const S={userId:'1',currentRaceId:'21086093',trackInfo:{name:'Stone Park',laps:8,length:2.08},originalLeaderboard:{children:[row]},previousMetrics:{}};
    const inspector=moduleObj('96-driver-inspector.js',['Utils','State','Config','RaceManager','APIManager','document'],{Utils:U,State:S,Config:config(),RaceManager:{},APIManager:{raceData:{getSkillGainDisplay:()=> 'N/A'}},document:{getElementById:()=>row}});
    inspector.selectedRaceId='21086093';inspector.selectedOriginalId='lbr-1';inspector.selectedUserId='1';
    const flatten=e=>(e.textContent||'')+' '+(e.children||[]).map(flatten).join(' ');
    const driver={userId:'1',statusClass:'ready',progress:0,carTitle:'Volt GT'};
    const race=flatten(inspector.raceContent(driver));
    assert.match(race,/0 \/ 8/);
    assert.match(race,/Waiting to start/);
    assert.match(race,/Starting grid/);
    assert.doesNotMatch(race,/1 \/ 8|In progress|Live race order/);
    const telemetry=flatten(inspector.telemetryContent(driver));
    assert.match(telemetry,/has not started/);
    assert.doesNotMatch(telemetry,/Speed · estimated/);
});

test('Torn page snapshot car ID is extracted from the current car image path', () => {
    const carImage={getAttribute:()=>'/images/items/85/large.png'};
    const carDiv={querySelector:selector=>selector.startsWith('.model p')?{textContent:'Volt GT'}:selector.startsWith('.model .img')?carImage:null,querySelectorAll:()=>[
        {querySelector:selector=>selector==='.title'?{textContent:'Top Speed'}:{title:'107 (50 + 57)'}}
    ]};
    const doc={querySelector:selector=>selector==='div.car-selected.left'?carDiv:null,querySelectorAll:()=>[]};
    const ui=new Function('document',part('50-ui.js')+'\nreturn UI;')(doc);
    const car=ui.parseCurrentUserCarStats();
    assert.equal(car.id,85);
    assert.equal(car.name,'Volt GT');
    assert.equal(car.stats['Top Speed'],107);
});

test('panel section controls activate correct content without recreating nodes', () => {
    class El {
        constructor(tag) { this.tag=tag; this.children=[];this.attributes={};this.events={};this.dataset={};this.hidden=false; }
        append(...x) { this.children.push(...x); }
        setAttribute(k,v) { this.attributes[k]=v; }
        addEventListener(k,fn) { this.events[k]=fn; }
    }
    const U={createElement:(tag,o={})=>{const e=new El(tag); e.className=o.className;e.textContent=o.text;return e;}};
    const ui=new Function('Utils',part('50-ui.js')+'\nreturn UI;')(U);
    const a=new El('div'),b=new El('div');
    const workspace=ui.buildPanelSections([{key:'overview',title:'Overview',content:a},{key:'races',title:'All races',content:b}], 'overview');
    const nav=workspace.children[0],views=workspace.children[1];
    assert.equal(views.children[0].children[0],a);
    assert.equal(views.children[1].children[0],b);
    assert.equal(views.children[0].hidden,false);
    assert.equal(views.children[1].hidden,true);
    nav.children[1].events.click();
    assert.equal(views.children[0].hidden,true);
    assert.equal(views.children[1].hidden,false);
    assert.equal(nav.children[1].attributes['aria-selected'],'true');
});

test('waiting list displays Waiting instead of misleading zero-speed estimates', () => {
    assert.match(part('90-race-manager.js'),/telemetryText = 'Waiting'/);
    assert.doesNotMatch(part('50-ui.js'),/ID: \${currentUserCar\.id}/);
});


test('all five utility panels autosize rather than filling the mobile viewport', () => {
    const base = part('106-ui-overhaul.js');
    const responsive = part('107-beta2-interface.js');
    const panels = ['settings-popup-content', 'stats-panel-content', 'history-panel-content', 'info-panel-content', 'download-popup-content'];
    const mobileStyles = responsive.split('@media (max-width: 600px) {')[1]?.split('@media (prefers-reduced-motion: reduce)')[0] || '';
    const mobileBase = base.split('@media (max-width: 600px) {')[1]?.split('/* Touch layout:')[0] || '';
    for (const panel of panels) {
        assert.ok(mobileStyles.includes(`.${panel}`), `Responsive rules should include ${panel}`);
        assert.ok(mobileBase.includes(`.${panel}`), `Base rules should include ${panel}`);
    }
    assert.match(mobileStyles, /height: auto; max-height: 94dvh/);
    assert.match(mobileBase, /height: auto; max-height: 94dvh/);
    assert.doesNotMatch(mobileStyles, /height: min\(91dvh/);
    assert.doesNotMatch(mobileBase, /height: min\(90dvh/);
    assert.match(responsive, /overflow: hidden; display: flex; flex-direction: column/);
    assert.match(responsive, /flex: 1 1 auto; overflow-y: auto/);
});

test('Race menu extracts Torn post-race event details without losing fields', () => {
    const expected = {
        'ID':'21086093', 'Name':'Off race by 3979732', 'Type':'Official',
        'Time created':'2026-10-09 12:11:55', 'Time started':'2026-10-09 13:13:06',
        'Time ended':'2026-10-09 13:24:28', 'Track':'Stone Park', 'Laps':'8',
        'Participants':'6', 'Drivers required':'3', 'Maximum Drivers':'6',
        'Cars allowed':'Any Class', 'Upgrades allowed':'Yes', 'Bet amount':'$0'
    };
    const titleEls = Object.entries(expected).map(([k,v]) => ({textContent:`${k}: ${v}`}));
    const info = {querySelector:() => ({textContent:'Race info'}), querySelectorAll:()=>titleEls};
    const wrap = {querySelector:() => info};
    const root = {querySelector:selector => selector === '.car-selected-wrap' ? wrap : null};
    const integration = new Function(part('97-race-info-integration.js')+'\nreturn RaceInfoIntegration;')();
    const result = integration.readNative(root);
    assert.equal(result.wrap, wrap);
    assert.equal(result.fields.length,14);
    assert.equal(result.fields.find(f=>f.label==='Race ID').value,'21086093');
    assert.equal(result.fields.find(f=>f.label==='Maximum drivers').value,'6');
    assert.equal(result.fields.find(f=>f.label==='Bet amount').value,'$0');
});

test('Car menu captures waiting car, performance bars and original Torn actions', () => {
    const stats = [
        ['Top Speed', '107 (50 + 57)', '88.5%', '46.3276836158%', false],
        ['Acceleration', '104 (45 + 59)', '86.166666666667%', '42.9400386847%', false],
        ['Braking', '75 (55 + 20)', '61.666666666667%', '72.972972973%', false],
        ['Tarmac', '49 (50 - 1)', '40%', '97.9166666667%', true]
    ];
    const rows = stats.map(([label,tip,total,base,negative]) => {
        const baseline={style:{width:base}};
        const bar={style:{width:total},querySelector:()=>baseline};
        return {querySelector:s=>{
            if (s === '.properties > .title') return {textContent:label};
            if (s === '.properties .bar-tpl-wrap') return {classList:{contains:v=>v==='negative'&&negative}};
            if (s === '.progressbar-bg') return {querySelector:()=>bar};
            if (s === '.progressbar-wrap') return {getAttribute:()=>tip};
            return null;
        }};
    });
    const leave={textContent:'Leave this race',href:'https://www.torn.com/page.php?sid=racing&tab=customrace&section=leaveCurrentRace',classList:new Set(['need-confirmation','btn-action-tab'])};
    const change={textContent:'Change Car',href:'https://www.torn.com/page.php?sid=racing&tab=cars&section=changeRacingCar',classList:new Set(['need-confirmation','btn-action-tab'])};
    const model={querySelectorAll:()=>[{textContent:'Volt GT'},{textContent:'Tarmac/Speed'}]};
    const image={getAttribute:name=>name==='src'?'/images/items/85/large.png':''};
    const car={
        querySelector:s=>s==='.title-black'?{textContent:'Current car'}:s==='.model-wrap .img img'?image:s==='.model-wrap .model'?model:null,
        querySelectorAll:s=>s==='.properties-wrap > li'?rows:s==='.model-wrap .link-wrap a[href]'?[leave,change]:[]
    };
    const wrap={querySelector:()=>car};
    const root={querySelector:s=>s==='.car-selected-wrap'?wrap:null};
    const integration=new Function(part('97-race-info-integration.js')+'\nreturn RaceInfoIntegration;')();
    const result=integration.readCar(root);
    assert.equal(result.name,'Volt GT');
    assert.equal(result.category,'Tarmac/Speed');
    assert.equal(result.imageSrc,'/images/items/85/large.png');
    assert.equal(result.stats.length,4);
    assert.equal(result.stats[0].percent,88.5);
    assert.equal(result.stats[0].baseline,46.3276836158);
    assert.equal(result.stats[3].negative,true);
    assert.deepEqual(result.links.map(x=>x.label),['Leave this race','Change Car']);
    assert.equal(result.links[0].anchor,leave);
});

test('Car panel replaces native car only when data and Car button exist; Race info remains safe', () => {
    const css = new Set();
    const buttons={car:{style:{display:'none'},setAttribute(){}}};
    const state={controlsContainer:{querySelector:s=>s==='.telemetry-car-button'?buttons.car:null}};
    const map={hasInfoButton:()=>true,sync:()=>{}};
    const integration = new Function('State','LiveMapIntegration',part('97-race-info-integration.js')+'\nreturn RaceInfoIntegration;')(state,map);
    const makeRoot = (heading, values) => {
        const classes = new Set();
        const card = {querySelector:()=>({textContent:heading}),querySelectorAll:()=>values.map(text=>({textContent:text}))};
        const wrap = {querySelector:()=>card,classList:{toggle:(name,visible)=>visible?classes.add(name):classes.delete(name)}};
        return {root:{isConnected:true,querySelector:s=>s==='.car-selected-wrap'?wrap:null},classes};
    };
    const incompleteCar=makeRoot('Current car',['Top Speed: 70']);
    assert.equal(integration.readCar(incompleteCar.root),null);
    const incompleteInfo=makeRoot('Race info',['Track: Stone Park','Laps: 8']);
    const completeInfo=makeRoot('Race info',['ID: 21086093','Track: Stone Park','Laps: 8']);
    for (const entry of [incompleteCar,incompleteInfo,completeInfo]) {integration.root=entry.root;integration.sync();}
    assert.equal(incompleteCar.classes.size,0);
    assert.equal(incompleteInfo.classes.size,0);
    assert.equal(completeInfo.classes.has('rtt-race-info-integrated'),true);
    assert.equal(buttons.car.style.display,'none');
});

test('Race button is removed and map info owns race dialog; cleanup preserved', () => {
    const ui = part('50-ui.js');
    const main = part('110-main.js');
    const join = part('109-compact-leaderboard-join.js');
    assert.doesNotMatch(ui,/raceButton\.className = 'telemetry-race-button'/);
    assert.doesNotMatch(ui,/RaceInfoIntegration\.open\(raceButton\)/);
    assert.match(part('98-live-map-integration.js'),/RaceInfoIntegration\.open\(info\)/);
    assert.match(join,/flex: 1 1 0 !important/);
    assert.match(main,/UI\.initializeControls\(\);\s+RaceInfoIntegration\.install\(\)/);
    assert.match(main,/RaceInfoIntegration\.disconnect\(\)/);
});

test('Car navigation switches inline tabs while preserving native Torn confirmation actions', () => {
    const ui=part('50-ui.js');
    const modal=part('97-race-info-integration.js');
    assert.match(ui,/carButton\.className = 'telemetry-car-button'/);
    assert.match(ui,/TabWorkspace\.activate\('car'\)/);
    assert.match(modal,/link\.href = action\.anchor\.href/);
    assert.match(modal,/cls === 'need-confirmation'/);
    assert.doesNotMatch(modal,/link\.addEventListener\('click'/);
    assert.match(modal,/rtt-race-info-integrated/);
    assert.match(modal,/carButton\.style\.display = car \? 'inline-block' : 'none'/);
});

test('Car dialog preserves the seven native stats and confirmation-enabled Torn links', () => {
    class El {
        constructor(tag) { this.tag=tag;this.children=[];this.attributes={};this.style={};this.className='';this._classes=new Set();this.classList={add:(x)=>this._classes.add(x)}; }
        append(...nodes){this.children.push(...nodes);}
        setAttribute(name,value){this.attributes[name]=value;}
        set textContent(value){this.text=value;}
        get textContent(){return this.text||'';}
    }
    const doc={createElement:tag=>new El(tag)};
    const integration=new Function('document',part('97-race-info-integration.js')+'\nreturn RaceInfoIntegration;')(doc);
    const native={href:'https://www.torn.com/page.php?sid=racing&tab=customrace&section=leaveCurrentRace',classList:new Set(['link','btn-action-tab','need-confirmation'])};
    const car={name:'Volt GT',imageSrc:'/images/items/85/large.png',imageAlt:'Volt GT',category:'Tarmac/Speed',links:[{label:'Leave this race',anchor:native}],
        stats:['Top Speed','Acceleration','Braking','Handling','Dirt','Tarmac','Safety'].map((name,index)=>({name,tooltip:'107 (50 + 57)',percent:88.5,baseline:46.3,negative:index===5}))};
    const body=new El('div');
    integration.renderCar(body,car);
    assert.equal(body.children.length,9); // heading, seven performance bars, actions
    assert.equal(body.children[0].children[1].children[0].textContent,'Volt GT');
    const bar=body.children[1].children[1];
    assert.equal(bar.children[0].style.width,'88.5%');
    assert.match(bar.children[1].style.width,/40\.9755/);
    assert.equal(bar.attributes['aria-label'],'Top Speed: 107 (50 + 57)');
    const link=body.children[8].children[0];
    assert.equal(link.href,native.href);
    assert.equal(link._classes.has('need-confirmation'),true);
    assert.equal(link._classes.has('btn-action-tab'),true);
    assert.equal(link._classes.has('link'),false);
});

test('Original map is always inline above the leaderboard, no Map popup/button remains', () => {
    const ui = part('50-ui.js');
    const main = part('110-main.js');
    const map = part('98-live-map-integration.js');
    const car = part('97-race-info-integration.js');
    assert.doesNotMatch(ui, /telemetry-map-button|LiveMapIntegration\.open/);
    assert.match(main, /LiveMapIntegration\.install\(\)/);
    assert.match(main, /LiveMapIntegration\.disconnect\(\)/);
    assert.match(map, /\.drivers-list \.track-wrap/);
    assert.match(map, /#raceCanvas/);
    assert.doesNotMatch(map, /canvas\.remove|cloneNode\(|toDataURL\(|drawImage\(|document\.body\.append\(popup\)/);
    assert.doesNotMatch(map, /left: -10000px|visibility: hidden !important/);
    assert.match(map, /\.rtt-track-more/);
    assert.match(car, /LiveMapIntegration\.hasActionMenu\(\)/);
});

function makeInlineMapFixture() {
    class Node {
        constructor(tag = 'div') {
            this.tag = tag;
            this.children = [];
            this.parentNode = null;
            this.style = {};
            this.attributes = {};
            this.hidden = false;
            this.classes = new Set();
            this.listeners = new Map();
            this.classList = {
                add: n => this.classes.add(n),
                remove: n => this.classes.delete(n),
                contains: n => this.classes.has(n),
                toggle: (n, force) => {
                    if (force === undefined) force = !this.classes.has(n);
                    if (force) this.classes.add(n);
                    else this.classes.delete(n);
                    return force;
                }
            };
        }
        get isConnected() { return this === title || this.parentNode != null; }
        append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
        replaceChildren(...nodes) { for (const n of this.children) n.parentNode = null; this.children = []; this.append(...nodes); }
        remove() {
            if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
            this.parentNode = null;
        }
        setAttribute(k, v) { this.attributes[k] = v; }
        addEventListener(type, listener) {
            const listeners = this.listeners.get(type) || [];
            this.listeners.set(type, [...listeners, listener]);
        }
        removeEventListener(type, listener) {
            this.listeners.set(type, (this.listeners.get(type) || []).filter(l => l !== listener));
        }
        fire(type, extras = {}) {
            const ev = {target: this,stopPropagation() {},preventDefault(){this.prevented=true;}, ...extras};
            for (const listener of this.listeners.get(type) || []) listener(ev);
            return ev;
        }
        click() { this.clicks = (this.clicks || 0) + 1; this.fire('click'); }
        contains(node) { return node === this || this.children.some(c => c.contains(node)); }
        focus() { this.focused = true; }
    }
    const root = new Node();
    const map = new Node();
    const canvas = new Node('canvas');
    map.append(canvas);
    map.querySelector = selector => selector === '#raceCanvas' ? canvas : null;
    const title = new Node();
    title.append(new Node('span'));
    const carCard = new Node();
    carCard.querySelector = s => s === '.title-black' ? {textContent:'Current car'} : null;
    const nativeLeave = new Node('a');
    nativeLeave.textContent = 'Leave this race';
    nativeLeave.href = 'https://www.torn.com/page.php?sid=racing&tab=customrace&section=leaveCurrentRace';
    const nativeChange = new Node('a');
    nativeChange.textContent = 'Change Car';
    nativeChange.href = 'https://www.torn.com/page.php?sid=racing&tab=cars&section=changeRacingCar';
    carCard.append(nativeLeave, nativeChange);
    let nativeLinks = [nativeLeave, nativeChange];
    carCard.querySelectorAll = s => s === '.model-wrap .link-wrap a[href]' ? nativeLinks : [];
    const board = new Node();
    root.querySelector = s => ({
        '.drivers-list .track-wrap': map,
        '.drivers-list > .title-black': title,
        '#leaderBoard': board,
        '.car-selected-wrap > .car-selected': carCard
    })[s] || null;
    const doc = new Node('document');
    doc.getElementById = id => id === 'racingupdates' ? root : null;
    doc.createElement = tag => new Node(tag);
    const styles = [];
    const modalTriggers=[];
    const raceDialog={open: trigger => modalTriggers.push(trigger)};
    const integration = new Function('document','GM_addStyle','RaceInfoIntegration',part('98-live-map-integration.js')+'\nreturn LiveMapIntegration;')(doc, css => styles.push(css), raceDialog);
    return {integration,root,map,canvas,title,board,carCard,nativeLeave,nativeChange,doc,styles,modalTriggers,setLinks: links => {nativeLinks = links;}};
}

test('Inline map preserves Torn canvas, track header and leaderboard identity through cleanup', () => {
    const f = makeInlineMapFixture();
    const initialCanvasParent = f.canvas.parentNode;
    const initialMapParent = f.map.parentNode;
    const initialTitleChildren = [...f.title.children];
    f.integration.install();
    assert.ok(f.root.classes.has('rtt-map-integrated'));
    assert.equal(f.map.parentNode, initialMapParent);
    assert.equal(f.canvas.parentNode, initialCanvasParent);
    assert.equal(f.integration.title, f.title);
    assert.equal(f.root.querySelector('#leaderBoard'), f.board);
    assert.ok(f.title.children.includes(f.integration.menu));
    assert.match(f.styles[0], /aspect-ratio: 520 \/ 243/);
    f.integration.disconnect();
    assert.equal(f.integration.menu, null);
    assert.deepEqual(f.title.children, initialTitleChildren);
    assert.equal(f.map.parentNode, initialMapParent);
    assert.equal(f.canvas.parentNode, initialCanvasParent);
    assert.equal(f.root.classes.has('rtt-map-integrated'),false);
});

test('Track header overflow opens and triggers original Torn car action and leave confirmation anchors', () => {
    const f = makeInlineMapFixture();
    f.integration.install();
    assert.equal(f.integration.hasActionMenu(), true);
    assert.equal(f.integration.menu.hidden,false);
    assert.equal(f.integration.list.children.length,2);
    assert.equal(f.integration.button.attributes['aria-expanded'],'false');
    f.integration.button.click();
    assert.equal(f.integration.isOpen(),true);
    assert.equal(f.integration.button.attributes['aria-expanded'],'true');
    const leave = f.integration.list.children.find(c => c.textContent === 'Leave this race');
    assert.match(leave.className, /rtt-track-action-danger/);
    leave.click();
    assert.equal(f.nativeLeave.clicks,1);
    assert.equal(f.integration.isOpen(),false);
    f.integration.button.click();
    const change = f.integration.list.children.find(c => c.textContent === 'Change Car');
    change.click();
    assert.equal(f.nativeChange.clicks,1);
    f.integration.button.click();
    f.doc.fire('keydown',{key:'Escape'});
    assert.equal(f.integration.isOpen(),false);
    assert.equal(f.integration.button.focused,true);
    f.integration.disconnect();
    assert.equal((f.doc.listeners.get('click') || []).length,0);
    assert.equal((f.doc.listeners.get('keydown') || []).length,0);
});

test('Map controls follow Torn race refresh without stale confirmation token', () => {
    const f = makeInlineMapFixture();
    f.integration.install();
    const nextLeave = Object.assign(Object.create(Object.getPrototypeOf(f.nativeLeave)),f.nativeLeave);
    nextLeave.parentNode = f.carCard;
    nextLeave.clicks = 0;
    nextLeave.href = '/page.php?sid=racing&tab=customrace&section=leaveCurrentRace&rfcv=updated';
    f.setLinks([nextLeave, f.nativeChange]);
    f.integration.sync();
    f.integration.button.click();
    f.integration.list.children.find(c => c.textContent === 'Leave this race').click();
    assert.equal(nextLeave.clicks,1);
    assert.equal(f.nativeLeave.clicks || 0,0);
    f.setLinks([]);
    f.integration.sync();
    assert.equal(f.integration.hasActionMenu(),false);
    assert.equal(f.integration.button.hidden,true);
    assert.equal(f.integration.menu.hidden,false);
    assert.equal(f.integration.hasInfoButton(),true);
    f.integration.disconnect();
});

test('Inline integration leaves incomplete Torn maps untouched', () => {
    const f = makeInlineMapFixture();
    f.map.querySelector = () => null;
    f.integration.install();
    assert.equal(f.integration.menu,null);
    assert.equal(f.root.classes.has('rtt-map-integrated'),false);
    assert.equal(f.canvas.parentNode,f.map);
});


test('Native map track tooltip content is added to race information before and after a race', () => {
    const race = new Function(part('97-race-info-integration.js')+'\nreturn RaceInfoIntegration;')();
    const props={title:'Hammerhead','data-length':'1.16mi','data-desc':"This large track with soft bends will favour those with better braking and handling. It's feature piece is a small island in the middle of a lake which is connected by two rickety old bridges."};
    const tooltip={getAttribute:name=>props[name] || null};
    const root={
        querySelector:sel=>({'.drivers-list .track-info':tooltip,'.drivers-list > .title-black':{textContent:'Hammerhead - 14 laps - 49 minutes, 18 seconds'},'#infoSpot':{textContent:'49 minutes, 18 seconds'},'.car-selected-wrap':null})[sel] || null,
        querySelectorAll:sel=>sel==='#leaderBoard > li' ? Array(6).fill({}) : []
    };
    const fields=race.getFields(root);
    assert.equal(fields.find(x=>x.label==='Track').value,'Hammerhead');
    assert.equal(fields.find(x=>x.label==='Laps').value,'14');
    assert.equal(fields.find(x=>x.label==='Participants').value,'6');
    assert.equal(fields.find(x=>x.label==='Track length').value,'1.16mi');
    assert.match(fields.find(x=>x.label==='Track description').value,/rickety old bridges/);
    delete props['data-desc'];
    assert.equal(race.getFields(root).some(x=>x.label==='Track description'),false);
});

test('The track information icon opens the race dialog even without leave/change actions', () => {
    const f=makeInlineMapFixture();
    f.setLinks([]);
    f.integration.install();
    assert.equal(f.integration.hasInfoButton(),true);
    assert.equal(f.integration.button.hidden,true);
    f.integration.infoButton.click();
    assert.deepEqual(f.modalTriggers,[f.integration.infoButton]);
    assert.match(f.styles[0],/\.track-info-wrap \{\s*display: none !important/);
    assert.equal(f.integration.isOpen(),false);
    f.integration.disconnect();
    assert.equal(f.integration.infoButton,null);
});

test('Racing controls navigate persistent inline tabs, not overlay popup handlers', () => {
    const ui=part('50-ui.js');
    const workspace=part('99-tab-workspace.js');
    const main=part('110-main.js');
    assert.match(main,/LiveMapIntegration\.install\(\);\s+TabWorkspace\.install\(\)/);
    assert.match(main,/TabWorkspace\.disconnect\(\)/);
    for (const tab of ['car','info','history','stats','export','settings']) {
        assert.match(ui,new RegExp(`TabWorkspace\\.activate\\('\\b${tab}\\b'\\)`));
    }
    assert.match(workspace,/drivers:\s*'Drivers'/);
    assert.match(workspace,/setAttribute\('role', 'tablist'\)/);
    assert.match(workspace,/setAttribute\('role', 'tabpanel'\)/);
    assert.match(workspace,/this\.panes\.get\('drivers'\)\.append\(driverList, scrollbar\)/);
    assert.match(workspace,/pane\.hidden = !selected/);
    assert.match(workspace,/pane\.append\(instance\)/);
    assert.doesNotMatch(workspace,/raceCanvas\.remove\(|raceCanvas\.replaceWith\(/);
});

test('Settings/Export actions reopen their own tab instead of leaving an empty pane', () => {
    const ui=part('50-ui.js');
    assert.match(ui,/restoreAfterAction\('settings'\)/);
    assert.match(ui,/restoreAfterAction\('export'\)/);
    assert.match(part('99-tab-workspace.js'),/restoreAfterAction\(key\)/);
});

test('Change Car and Leave this race resolve to direct Torn URLs and use RaceInfoIntegration confirmation popup', () => {
    const integration = new Function(part('97-race-info-integration.js') + '\nreturn RaceInfoIntegration;')();
    assert.equal(
        integration.resolveActionUrl('Change Car'),
        'https://www.torn.com/page.php?sid=racing&tab=cars&section=changeRacingCar'
    );
    assert.equal(
        integration.resolveActionUrl('Leave this race'),
        'https://www.torn.com/page.php?sid=racing&tab=customrace&section=leaveCurrentRace&step=leaveCurrentRace'
    );
    assert.match(part('97-race-info-integration.js'), /confirmAction\(action/);
    assert.match(part('98-live-map-integration.js'), /RaceInfoIntegration\.confirmAction\(live/);
});

test('Inline tab panels ignore backdrop clicks and invalidate stale race-bound views', () => {
    const ui = part('50-ui.js');
    const workspace = part('99-tab-workspace.js');
    const statePart = part('20-state-and-styles.js');
    const raceMgr = part('90-race-manager.js');
    assert.match(ui, /!popup\.classList\.contains\('rtt-inline-tab-content'\)/);
    assert.match(workspace, /invalidateRaceBoundViews\(\)/);
    assert.match(statePart, /TabWorkspace\.invalidateRaceBoundViews\(\)/);
    assert.match(raceMgr, /TabWorkspace\.invalidateRaceBoundViews\(\)/);
    assert.match(workspace, /#telemetryControlsContainer\[role="tablist"\]/);
});

test('Driver inspector header stacks eyebrow, driver name, and subtitle without h2 height collapse', () => {
    const inspector = part('96-driver-inspector.js');
    const overhaul = part('106-ui-overhaul.js');
    const beta2 = part('107-beta2-interface.js');
    assert.match(inspector, /this\.element\('div', 'rtt-inspector-name'/);
    assert.match(overhaul, /\.rtt-inspector-identity \{[^}]*flex-direction: column/);
    assert.match(beta2, /\.rtt-inspector-name \{[^}]*height: auto !important/);
    assert.match(beta2, /\.rtt-inspector-name \{[^}]*line-height: 1\.25 !important/);
});

test('executeConfirmedAction strips need-confirmation so Torn btn-action-tab AJAX handler fires immediately', () => {
    const integration = new Function('document', part('97-race-info-integration.js') + '\nreturn RaceInfoIntegration;')({
        querySelector: () => null,
        getElementById: () => null
    });
    const classes = new Set(['link', 'btn-action-tab', 'need-confirmation']);
    let clickedWithConfirmation = null;
    const anchor = {
        isConnected: true,
        href: '/page.php?sid=racing&tab=customrace&section=leaveCurrentRace&step=leaveCurrentRace',
        classList: {
            contains: c => classes.has(c),
            remove: c => classes.delete(c),
            add: c => classes.add(c)
        },
        click() {
            clickedWithConfirmation = classes.has('need-confirmation');
        }
    };
    integration.executeConfirmedAction({ label: 'Leave this race', anchor });
    assert.equal(clickedWithConfirmation, false);
});

test('Car tab and map action menu disappear when race finishes in-place even before Torn swaps Current car DOM', () => {
    const buttons = { car: { style: { display: 'inline-block' }, setAttribute() {} } };
    const state = {
        raceFinished: true,
        controlsContainer: { querySelector: s => s === '.telemetry-car-button' ? buttons.car : null }
    };
    let activated = null;
    const workspace = {
        refreshVisibility: () => { if (buttons.car.style.display === 'none') activated = 'drivers'; },
        refreshCar: () => {}
    };
    const map = { hasInfoButton: () => true, sync: () => {} };
    const integration = new Function('State', 'LiveMapIntegration', 'TabWorkspace', part('97-race-info-integration.js') + '\nreturn RaceInfoIntegration;')(state, map, workspace);
    const classes = new Set();
    const card = {
        querySelector: s => s === '.title-black' ? { textContent: 'Current car' } : null,
        querySelectorAll: () => []
    };
    const wrap = {
        querySelector: s => s === ':scope > .car-selected' ? card : s === ':scope > .car-selected .title-black' ? { textContent: 'Current car' } : null,
        classList: { toggle: (name, force) => force ? classes.add(name) : classes.delete(name) }
    };
    integration.root = {
        isConnected: true,
        querySelector: s => s === '.car-selected-wrap' ? wrap : s === '#infoSpot' ? { textContent: 'Race finished' } : null
    };
    integration.sync();
    assert.equal(buttons.car.style.display, 'none');
    assert.equal(classes.has('rtt-race-info-integrated'), true);
    assert.equal(activated, 'drivers');
});

test('API rejects malformed JSON and non-object success payloads, preserving HTTP failures', async () => {
    const api = moduleObj('60-api-manager.js', ['Utils','Config'], {Utils:{},Config:config()});
    const cause = new SyntaxError('Unexpected token');
    await assert.rejects(api.parseJsonResponse({ok:true,json:async()=>{throw cause;}}), error => error.message.includes('invalid JSON') && error.cause === cause);
    for (const value of [null, [], 'text', 42]) {
        await assert.rejects(api.parseJsonResponse({ok:true,json:async()=>value}), /expected a JSON object/);
    }
    await assert.rejects(api.parseJsonResponse({ok:false,status:429,statusText:'Too Many Requests',json:async()=>{throw cause;}}), error => error.statusCode === 429);
    await assert.rejects(api.parseJsonResponse({ok:true,json:async()=>({error:{code:2,error:'Rate limit'}})}), error => error.apiCode === 2);
    assert.deepEqual(await api.parseJsonResponse({ok:true,json:async()=>({races:[]})}),{races:[]});
});

const runSettingsSave = async (overrides = {}) => {
    const controls = Object.fromEntries(Object.entries({speedSmoothingFactor:'0.7',maxAnimationDurationMs:'1000',lapEstimateSmoothingFactor:'0.15',historicalRaceLimit:'20',apiKey:'',speedUnit:'mph',...overrides}).map(([key,value])=>[key,{value,checked:true,focus(){this.focused=true;}}]));
    const content = {querySelector(selector) { const id=selector.slice(1); return controls[id] ||= {checked:true}; }};
    const source = part('50-ui.js');
    const start = source.indexOf("content.querySelector('#saveSettings').addEventListener('click', async () => {") + "content.querySelector('#saveSettings').addEventListener('click', async () => {".length;
    const end = source.indexOf("\n            });",start);
    const writes = [], notices = [];
    let closed=0, invalidated=0;
    const execute = new Function('content','Config','Utils','TabWorkspace','UI','RaceManager','closePopup',`return (async()=>{${source.slice(start,end)}})();`);
    await execute(content,{set:(...args)=>writes.push(args)},{showNotification:(...args)=>notices.push(args)}, {invalidateRaceBoundViews(){invalidated++;},restoreAfterAction(){}},{updateControlButtonsVisibility(){}},{stableUpdateCustomList(){}},()=>closed++);
    return {writes,notices,closed,invalidated,controls};
};

test('invalid settings never partially save, report success, or close the view', async () => {
    for (const input of [
        {speedSmoothingFactor:''}, {speedSmoothingFactor:'0.7junk'}, {speedSmoothingFactor:'Infinity'},
        {maxAnimationDurationMs:'100.5'}, {historicalRaceLimit:'20oops'}, {historicalRaceLimit:'9'},
        {lapEstimateSmoothingFactor:'1.1'}, {apiKey:'short'}, {speedUnit:'knots'}
    ]) {
        const result = await runSettingsSave(input);
        assert.equal(result.writes.length,0,JSON.stringify(input));
        assert.equal(result.closed,0);
        assert.equal(result.invalidated,0);
        assert.equal(result.notices.length,1);
        assert.equal(result.notices[0][1],'error');
        assert.equal(result.controls[Object.keys(input)[0]].focused,true);
    }
});

test('valid settings save typed values and invalidate cached API views', async () => {
    for (const apiKey of ['', '1234567890abcdef', '###PDA-APIKEY###']) {
        const result = await runSettingsSave({apiKey});
        const saved = Object.fromEntries(result.writes);
        assert.equal(saved.speedSmoothingFactor,0.7);
        assert.equal(saved.maxAnimationDurationMs,1000);
        assert.equal(saved.apiKey,apiKey);
        assert.deepEqual(saved.telemetryDisplayOptions,['speed','acceleration','progress']);
        assert.equal(result.invalidated,1);
        assert.deepEqual(result.notices,[['Settings saved!','success']]);
    }
});

test('hidden native car actions signal completion before race state or status text updates', () => {
    const state = {raceFinished:false};
    const integration = new Function('State',part('97-race-info-integration.js')+'\nreturn RaceInfoIntegration;')(state);
    let title='Current car', display='inline-block';
    const card={querySelector:s=>s==='.title-black'?{textContent:title}:s==='.model-wrap .link-wrap'?{style:{display}}:null};
    const root={querySelector:s=>s==='#infoSpot'?{textContent:'Race started'}:s==='.car-selected-wrap > .car-selected'?card:null};
    assert.equal(integration.isRaceFinished(root),false);
    display='none';
    assert.equal(integration.isRaceFinished(root),true);
    display='inline-block'; title='Race info';
    assert.equal(integration.isRaceFinished(root),true);
});

test('finish hides Car and returns its active pane to Drivers without moving other active tabs', () => {
    let finished=false;
    const integration={isRaceFinished:()=>finished};
    const workspace=new Function('RaceInfoIntegration',part('99-tab-workspace.js')+'\nreturn TabWorkspace;')(integration);
    const car={style:{display:'inline-block'},setAttribute(name,value){this[name]=value;}};
    const drivers={style:{},setAttribute(){}};
    const stats={style:{},setAttribute(){}};
    const panes=new Map(['drivers','car','stats'].map(key=>[key,{hidden:true}]));
    workspace.host={isConnected:true};workspace.buttons=new Map([['car',car],['drivers',drivers],['stats',stats]]);workspace.panes=panes;
    workspace.renderView=()=>{};
    workspace.activate('car');assert.equal(workspace.active,'car');
    finished=true;workspace.refreshVisibility();
    assert.equal(car.style.display,'none');assert.equal(car['aria-hidden'],'true');
    assert.equal(workspace.active,'drivers');assert.equal(panes.get('car').hidden,true);assert.equal(panes.get('drivers').hidden,false);
    workspace.activate('car');assert.equal(workspace.active,'drivers');
    workspace.activate('stats');workspace.refreshVisibility();assert.equal(workspace.active,'stats');
});
