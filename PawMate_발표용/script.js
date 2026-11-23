/*
 * PawMate · 2026 university project (v2)
 * Korean text extraction and recommendations are deterministic LOCAL rules.
 * This app DOES NOT call an AI model, process real bookings/payments, perform
 * identity verification, send notifications, or query live availability.
 * All sitter names, metrics, fees and care statuses are demonstrative.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'pawmate_prototype_v2';
  const OLD_STORAGE_KEY = 'pawmate_prototype_v1';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const examples = {
    cat: '내일 오후 6시에 성북구 안암동에서 고양이 모모의 사료와 물을 챙겨줄 분을 찾아요. 모모는 낯선 사람을 무서워해요. 예산은 2만원이고 사진도 보내주세요.',
    dog: '모레 오후 3시에 성북구 종암동에서 강아지 코코를 30분 동안 산책시켜 줄 분을 구합니다. 예산은 15000원입니다.',
    urgent: '오늘 저녁 7시에 성북구 길음동에서 강아지 보리에게 사료를 주고 한 시간 정도 돌봐줄 분이 급하게 필요해요. 예산은 25000원입니다.'
  };
  const sitters = [
    {id:'minji',name:'김민지',initial:'민',avatar:1,petTypes:['cat'],services:['visit','feed'],area:'성북구',near:'안암동',distance:1.2,price:18000,years:5,rating:4.9,completed:62,tags:['shy','photo','medication'],bio:'고양이의 성향을 먼저 살피고 천천히 교감하는 돌봄을 중요하게 생각합니다. 급식과 기본 생활 돌봄을 중심으로 활동합니다.'},
    {id:'junho',name:'이준호',initial:'준',avatar:2,petTypes:['dog'],services:['walk','visit','feed'],area:'성북구',near:'종암동',distance:2.3,price:15000,years:4,rating:4.7,completed:38,tags:['walk','photo'],bio:'반려견 산책과 일상적인 돌봄을 주로 맡습니다. 산책 전후 컨디션을 확인하고 보호자의 요청을 기록합니다.'},
    {id:'seoyeon',name:'박서연',initial:'서',avatar:3,petTypes:['cat','dog','rabbit'],services:['visit','feed','walk'],area:'성북구',near:'정릉동',distance:1.8,price:20000,years:3,rating:4.8,completed:41,tags:['shy','photo'],bio:'고양이와 강아지의 일상 돌봄 경험이 있습니다. 사진과 짧은 기록을 남기는 것을 선호합니다.'},
    {id:'jiho',name:'최지호',initial:'지',avatar:4,petTypes:['dog'],services:['walk','visit','feed'],area:'성북구',near:'길음동',distance:2.9,price:22000,years:7,rating:4.9,completed:88,tags:['walk','medication','photo'],bio:'소형견부터 중형견까지 산책 경험이 있습니다. 요청된 산책 시간과 유의사항을 꼼꼼하게 확인합니다.'},
    {id:'yujin',name:'한유진',initial:'유',avatar:2,petTypes:['cat','dog'],services:['visit','feed'],area:'성북구',near:'보문동',distance:2.0,price:17000,years:2,rating:4.6,completed:24,tags:['shy','photo'],bio:'식사와 물 교체, 생활 공간 점검을 중심으로 돌봄을 진행합니다. 낯을 가리는 반려동물에게 차분히 다가갑니다.'}
  ];
  const emptyState = () => ({
    request:null, booking:null, history:[], tab:'request',
    guideChecks:[], reviewRating:5, careLogs:[], favorites:[],
    filters:{sort:'score',underBudget:false,highRating:false,withPhotos:false}
  });
  const defaults = emptyState();
  let state = loadState();
  let selectedId = null;
  let toastTimer;

  function loadState() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data) data = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || 'null');
    } catch (_) { /* Browsing with storage disabled is still possible. */ }
    if (!data || typeof data !== 'object') return emptyState();
    return {
      ...emptyState(), ...data,
      filters:{...defaults.filters, ...(data.filters || {})},
      history:Array.isArray(data.history) ? data.history.slice(0,30) : [],
      favorites:Array.isArray(data.favorites) ? data.favorites : [],
      careLogs:Array.isArray(data.careLogs) ? data.careLogs.slice(0,40) : [],
      guideChecks:Array.isArray(data.guideChecks) ? data.guideChecks : []
    };
  }
  function save() {try {localStorage.setItem(STORAGE_KEY, JSON.stringify(state));} catch (_) {}}
  function esc(value) {return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function money(value) {return Number(value || 0).toLocaleString('ko-KR')+'원';}
  function dateOf(offset=0) {let d=new Date();d.setDate(d.getDate()+offset);return localYMD(d);}
  function localYMD(d) {return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function readableDate(value) {if(!value)return '날짜 미지정';const d=value.split('-');return d.length===3?`${Number(d[1])}월 ${Number(d[2])}일`:value;}
  function showToast(message) {const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300);}
  function petLabel(t) {return ({cat:'고양이',dog:'강아지',rabbit:'토끼',other:'기타'})[t] || '반려동물';}
  function serviceLabel(t) {return ({visit:'방문 돌봄',feed:'급식 및 물 교체',walk:'산책',other:'기타 돌봄'})[t] || '서비스 미지정';}
  function bookingLabel(t) {return ({matched:'매칭 완료',ongoing:'돌봄 진행 중',finished:'돌봄 완료',cancelled:'예약 취소'})[t] || '기록';}
  function petType(text) {
    if(/고양이|반려묘|냥이|猫/.test(text))return 'cat';
    if(/강아지|반려견|댕댕|狗/.test(text))return 'dog';
    if(/토끼/.test(text))return 'rabbit';
    return '';
  }
  function getDate(text) {
    if(/모레/.test(text)) return dateOf(2);
    if(/내일/.test(text)) return dateOf(1);
    if(/오늘|금일/.test(text)) return dateOf(0);
    const exact=text.match(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if(exact){
      let year=exact[1]?Number(exact[1]):new Date().getFullYear();
      const month=Number(exact[2]),day=Number(exact[3]);
      const dt=new Date(year,month-1,day);
      if(dt.getFullYear()===year&&dt.getMonth()+1===month&&dt.getDate()===day){
        if(!exact[1]&&localYMD(dt)<dateOf(0))year++;
        return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      }
    }
    const week=text.match(/(이번\s*주|다음\s*주|이번주|다음주)?\s*(월|화|수|목|금|토|일)요일/);
    if(week){
      const days={일:0,월:1,화:2,수:3,목:4,금:5,토:6};
      const now=new Date(), target=days[week[2]];
      let offset=(target-now.getDay()+7)%7;
      if((week[1]||'').includes('다음')) offset+=offset===0?7:7;
      else if(!week[1]&&offset===0) offset=7;
      return dateOf(offset);
    }
    return '';
  }
  function getTime(text) {
    const plain=text.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$|[.,])/);
    if(plain)return `${plain[1].padStart(2,'0')}:${plain[2]}`;
    const m=text.match(/(오전|오후|아침|낮|저녁|밤|새벽)?\s*(\d{1,2})\s*시(?!간)(?:\s*(반|\d{1,2}\s*분))?/);
    if(!m)return '';
    let h=Number(m[2]);const minute=m[3]==='반'?30:parseInt(m[3]||'0',10);
    if(['오후','저녁','밤'].includes(m[1])&&h<12)h+=12;
    if(['오전','새벽'].includes(m[1])&&h===12)h=0;
    if(h>23||minute>59)return '';
    return `${String(h).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  function getBudget(text) {
    let m=text.match(/(\d+(?:\.\d+)?)\s*만\s*원/);
    if(m)return Math.round(Number(m[1])*10000);
    m=text.match(/(\d[\d,]*)\s*원/);
    return m?Number(m[1].replaceAll(',','')):0;
  }
  function getDuration(text){
    const hour=text.match(/(\d{1,2})\s*시간/);
    const mins=text.match(/(\d{1,3})\s*분/);
    // Only explicit duration is extracted; exact clock time is handled separately.
    const minuteIsClock=mins && /시\s*$/.test(text.slice(Math.max(0,mins.index-5),mins.index));
    const result=(hour?Number(hour[1])*60:0)+(mins&&!minuteIsClock?Number(mins[1]):0);
    return result>0&&result<=480?result:60;
  }
  function getName(text,pet){
    const species=pet==='cat'?'(?:고양이|반려묘)':pet==='dog'?'(?:강아지|반려견)':pet==='rabbit'?'토끼':'반려동물';
    const m=text.match(new RegExp(species+'\\s+([가-힣]{1,7}?)(?=의|를|에게|가|와|이|은|는|\\s|[,.])'));
    if(!m)return '';
    if(/^(?:산책|방문|급식|밥|사료|물|돌봄|케어|종류|먹이|하루|오늘|내일|모레)$/.test(m[1]))return '';
    return m[1];
  }
  function getArea(text) {
    const districts=['성북구','강남구','마포구','서대문구','동대문구','종로구','중구','송파구','관악구'];
    const dongs=['안암동','종암동','정릉동','길음동','돈암동','보문동','동선동'];
    const district=districts.find(x=>text.includes(x));const dong=dongs.find(x=>text.includes(x));
    return [district,dong].filter(Boolean).join(' ') || (text.includes('서울')?'서울':'');
  }
  function parse(text) {
    const x=text.replace(/\s+/g,' ').trim();
    const pet=petType(x);
    let service='';
    if(/산책|워킹/.test(x))service='walk';
    else if(/밥|사료|급식|물\s*(?:교체|갈아)|먹이/.test(x))service='feed';
    else if(/돌봄|돌봐|방문|케어/.test(x))service='visit';
    const notes=[];
    if(/낯선|겁이\s*많|낯가림|무서워|예민/.test(x))notes.push('낯가림이 있어 천천히 접근해 주세요');
    if(/약|투약|복용/.test(x))notes.push('투약 여부와 방법을 확인해 주세요');
    if(/알레르기/.test(x))notes.push('알레르기 관련 주의사항을 확인해 주세요');
    if(/사진|메시지|상태.*알려/.test(x))notes.push('사진 또는 돌봄 기록을 남겨 주세요');
    if(/긴급|급하게|빨리/.test(x))notes.push('긴급 요청');
    return {raw:x,pet,petName:getName(x,pet),service,area:getArea(x),date:getDate(x),time:getTime(x),duration:getDuration(x),budget:getBudget(x),notes:notes.join(' · ')};
  }
  function option(value,label,selected){return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;}
  function resultHTML(r){return `<div class="result-heading"><strong>확인된 요청 조건</strong><span>직접 수정 가능</span></div>
    <div class="result-fields">
      <div class="result-field"><label for="field-pet">반려동물 종류 *</label><select id="field-pet">${option('','선택하세요',r.pet)}${option('cat','고양이',r.pet)}${option('dog','강아지',r.pet)}${option('rabbit','토끼',r.pet)}${option('other','기타',r.pet)}</select></div>
      <div class="result-field"><label for="field-name">반려동물 이름</label><input id="field-name" maxlength="18" value="${esc(r.petName)}" placeholder="예: 모모"></div>
      <div class="result-field"><label for="field-service">서비스 종류 *</label><select id="field-service">${option('','선택하세요',r.service)}${option('visit','방문 돌봄',r.service)}${option('feed','급식 및 물 교체',r.service)}${option('walk','산책',r.service)}${option('other','기타 돌봄',r.service)}</select></div>
      <div class="result-field"><label for="field-area">지역 *</label><input id="field-area" maxlength="40" value="${esc(r.area)}" placeholder="예: 성북구 안암동"></div>
      <div class="result-field"><label for="field-date">날짜 *</label><input id="field-date" type="date" min="${dateOf(0)}" value="${esc(r.date)}"></div>
      <div class="result-field"><label for="field-time">시간 *</label><input id="field-time" type="time" value="${esc(r.time)}"></div>
      <div class="result-field"><label for="field-duration">돌봄 시간(분)</label><input id="field-duration" type="number" min="15" max="480" step="15" value="${Number(r.duration)||60}"></div>
      <div class="result-field"><label for="field-budget">예산(원) · 선택</label><input id="field-budget" type="number" inputmode="numeric" min="0" max="1000000" step="1000" value="${Number(r.budget)||''}" placeholder="예: 20000"></div>
      <div class="result-field wide"><label for="field-notes">주의사항 및 요청</label><input id="field-notes" maxlength="250" value="${esc(r.notes)}" placeholder="돌봄 시 유의할 점"></div>
    </div>
    <p class="result-help">분석 결과는 일부 표현에서 누락되거나 잘못 추출될 수 있습니다. 등록 전에 모든 내용을 확인해 주세요.</p>
    <button type="button" id="register-btn" class="btn btn-primary btn-register">요청 등록하고 제공자 찾기 <svg class="icon"><use href="#i-arrow"/></svg></button>`;}
  function readForm(){
    return {raw:$('#request-text').value.trim(),pet:$('#field-pet').value,petName:$('#field-name').value.trim(),service:$('#field-service').value,
      area:$('#field-area').value.trim(),date:$('#field-date').value,time:$('#field-time').value,
      duration:Number($('#field-duration').value),budget:Number($('#field-budget').value||0),notes:$('#field-notes').value.trim()};
  }
  function score(s,r) {
    if(!s.petTypes.includes(r.pet)||!s.services.includes(r.service))return null;
    // Only Seongbuk-gu is covered by the fictional demo profiles.
    if(!/성북|안암|종암|정릉|길음|돈암|보문|동선/.test(r.area))return null;
    const within=!r.budget||s.price<=r.budget;
    const shy=/낯가림|낯선|겁이|무서워/.test(r.notes);
    const photo=/사진|기록/.test(r.notes);
    const medication=/약|투약/.test(r.notes);
    let value=55+Math.min(12,s.years*2)+Math.round(s.rating*2)+Math.max(0,12-Math.round(s.distance*2));
    value+=within?7:0;
    if(shy&&s.tags.includes('shy'))value+=4;
    if(photo&&s.tags.includes('photo'))value+=3;
    if(medication&&s.tags.includes('medication'))value+=2;
    value=Math.min(97,value);
    const why=[`${petLabel(r.pet)} 돌봄 경험 ${s.years}년`,`${s.near} 활동`];
    if(r.budget)why.push(within?'설정 예산 이내':'설정 예산 초과');
    if(shy&&s.tags.includes('shy'))why.push('낯가림 관련 요청에 적합');
    if(photo&&s.tags.includes('photo'))why.push('돌봄 기록 요청에 적합');
    return {...s,score:value,within,why};
  }
  function matchList(){
    if(!state.request)return [];
    let list=sitters.map(x=>score(x,state.request)).filter(Boolean);
    const f=state.filters;
    if(f.underBudget&&state.request.budget)list=list.filter(x=>x.within);
    if(f.highRating)list=list.filter(x=>x.rating>=4.8);
    if(f.withPhotos)list=list.filter(x=>x.tags.includes('photo'));
    list.sort((a,b)=>{
      if(f.sort==='price')return a.price-b.price||b.score-a.score;
      if(f.sort==='rating')return b.rating-a.rating||b.score-a.score;
      if(f.sort==='distance')return a.distance-b.distance||b.score-a.score;
      return b.score-a.score||a.distance-b.distance;
    });
    return list;
  }
  function requestSummary(r){return `<div class="match-summary"><span><strong>${esc(r.petName||petLabel(r.pet))}</strong> · ${esc(serviceLabel(r.service))}</span><span><svg class="icon"><use href="#i-map"/></svg>${esc(r.area)}</span><span><svg class="icon"><use href="#i-calendar"/></svg>${esc(readableDate(r.date))} ${esc(r.time)}</span><span>${esc(r.duration)}분</span><span><strong>${r.budget?money(r.budget):'예산 제한 없음'}</strong></span></div>`;}
  function sitterHTML(s,index) {
    const heart=state.favorites.includes(s.id);
    return `<article class="sitter-card ${index===0?'top-pick':''}">${index===0&&state.filters.sort==='score'?'<span class="recommend-tag">추천 순위 1위</span>':''}
    <div class="sitter-top"><span class="avatar avatar-${s.avatar}">${esc(s.initial)}</span><div class="sitter-name"><strong>${esc(s.name)}</strong><small><svg class="icon"><use href="#i-star"/></svg> ${s.rating.toFixed(1)} · 시연용 완료 기록 ${s.completed}건</small></div><button class="favorite-btn ${heart?'is-favorite':''}" type="button" data-favorite="${s.id}" aria-pressed="${heart}" aria-label="${esc(s.name)} ${heart?'관심 해제':'관심 등록'}" title="관심 제공자 저장"><svg class="icon"><use href="#i-heart"/></svg></button></div>
    <div><div class="match-percentage">${s.score}점 <small>매칭 점수 / 100</small></div><div class="score-track"><span style="width:${s.score}%"></span></div></div>
    <div class="sitter-facts"><span>활동 지역 <strong>${esc(s.area)} ${esc(s.near)}</strong></span><span>예시 거리 <strong>${s.distance.toFixed(1)}km</strong> · 돌봄 경력 <strong>${s.years}년</strong></span><span>시연용 요금 <strong>${money(s.price)}</strong> ${!s.within&&state.request.budget?'<em class="over-budget">예산 초과</em>':''}</span></div>
    <div class="sitter-reason">${esc(s.why.join(' · '))}</div><button class="sitter-select" type="button" data-pick="${s.id}">프로필 확인하기 <span aria-hidden="true">→</span></button></article>`;
  }
  function renderMatches() {
    const el=$('#match-content');
    if(!state.request){el.innerHTML=`<div class="care-empty"><svg class="icon"><use href="#i-message"/></svg><h4>아직 등록된 요청이 없습니다</h4><p>먼저 요청을 작성해 주세요.</p><button class="btn btn-primary" type="button" data-tab="request">요청 작성하기</button></div>`;return;}
    const list=matchList();const f=state.filters;
    el.innerHTML=requestSummary(state.request)+`<div class="filter-toolbar">
      <div><label for="sort-filter">정렬</label><select id="sort-filter">${option('score','추천 순',f.sort)}${option('price','가격 낮은 순',f.sort)}${option('rating','평점 높은 순',f.sort)}${option('distance','거리 가까운 순',f.sort)}</select></div>
      <label class="filter-check"><input type="checkbox" id="budget-only" ${f.underBudget?'checked':''} ${!state.request.budget?'disabled':''}> 예산 이내</label>
      <label class="filter-check"><input type="checkbox" id="high-rating" ${f.highRating?'checked':''}> 평점 4.8 이상</label>
      <label class="filter-check"><input type="checkbox" id="photo-only" ${f.withPhotos?'checked':''}> 사진 기록 가능</label>
      <button class="filter-reset" id="clear-filters" type="button">필터 초기화</button></div>
      <div class="match-caption"><strong>검색 결과 ${list.length}명</strong><small>가상 프로필 · 실시간 예약 가능 여부 미확인</small></div>
      ${list.length?`<div class="sitter-list">${list.map(sitterHTML).join('')}</div>`:`<div class="no-match"><strong>조건에 맞는 시연용 제공자가 없습니다</strong><p>현재 예시 데이터는 성북구 중심으로 구성되어 있습니다. 지역 또는 필터를 바꿔 보세요.</p><button class="btn btn-outline" id="clear-filters" type="button">필터 초기화</button> <button class="btn btn-outline" type="button" data-tab="request">요청 수정하기</button></div>`}
      <p class="care-note">매칭 점수는 조건별 규칙으로 계산한 시연용 점수(100점 만점)입니다. 실제 AI 예측이나 검증된 신뢰도 평가가 아닙니다.</p>`;
  }
  function careTasks(r) {
    const name=r.petName||'반려동물';const result=[`${name}의 상태와 주의사항 확인`];
    if(r.service==='walk')result.push('목줄과 하네스 착용 확인','산책 전후 물과 발 상태 확인');
    else if(r.service==='feed')result.push('지정된 사료와 급여량 확인','물을 깨끗하게 교체');
    else result.push('방문 전 입실 방법 확인','사료·물·생활 공간 점검');
    if(r.pet==='cat')result.push('화장실과 모래 상태 점검');
    if(/낯가림|낯선|무서워|겁이/.test(r.notes))result.push('낯가림을 고려해 천천히 접근');
    if(/약|투약/.test(r.notes))result.push('투약 관련 내용은 보호자 지시와 전문가 안내 확인');
    result.push('보호자에게 돌봄 결과 전달');return result;
  }
  function feeHTML(s){const commission=Math.round(s.price*.10);return `<div class="fee-box"><div><span>시연용 서비스 요금</span><strong>${money(s.price)}</strong></div><div><span>플랫폼 수수료 예시 (10%)</span><strong>${money(commission)}</strong></div><div><span>제공자 정산 예시</span><strong>${money(s.price-commission)}</strong></div><p>가정한 수익 모델을 보여주는 예시이며 실제 결제나 정산은 없습니다.</p></div>`;}
  function logItemHTML(log){
    return `<li class="log-item"><span class="log-mark">${log.kind==='note'?'●':'✓'}</span><div><small>${esc(new Date(log.at).toLocaleString('ko-KR'))}</small><p>${esc(log.text)}</p>${log.photo?`<img class="log-photo" src="${log.photo==='dog'?'assets/image-10-1.webp':'assets/cat-close.webp'}" alt="시연용 반려동물 사진">`:''}</div></li>`;
  }
  function renderCare() {
    const el=$('#care-content'), b=state.booking,r=state.request;
    if(!r||!b){el.innerHTML=`<div class="care-empty"><svg class="icon"><use href="#i-heart"/></svg><h4>진행 중인 예약이 없습니다</h4><p>요청을 등록하고 돌봄 제공자를 선택하면<br>이곳에서 진행 상황을 관리할 수 있습니다.</p><button class="btn btn-primary" type="button" data-tab="${r?'match':'request'}">${r?'돌봄 제공자 선택하기':'요청 작성하기'}</button></div>`;return;}
    const s=sitters.find(x=>x.id===b.sitterId);if(!s){el.innerHTML='<p>제공자 정보를 찾을 수 없습니다. 시연 데이터를 초기화해 주세요.</p>';return;}
    const phases=['matched','ongoing','finished'];const current=phases.indexOf(b.status);
    const progressHTML=phases.map((code,i)=>`<div class="progress-row ${current===i?'current':current>i?'complete':''}"><span class="progress-bullet">${current>i?'✓':i+1}</span><span><strong>${bookingLabel(code)}</strong><small>${['시연용 예약 생성','돌봄 진행 상태 업데이트','후기 등록 가능'][i]}</small></span></div>`).join('');
    const tasks=careTasks(r),done=tasks.filter((_,i)=>state.guideChecks.includes(i)).length;
    const taskHTML=tasks.map((item,i)=>`<label><input type="checkbox" data-guide="${i}" ${state.guideChecks.includes(i)?'checked':''} ${b.status!=='ongoing'?'disabled':''}><span>${esc(item)}</span></label>`).join('');
    let buttons='';
    if(b.status==='matched')buttons=`<button class="btn btn-primary" type="button" id="start-care">돌봄 시작 시연하기</button><button class="btn btn-outline" id="cancel-care" type="button">예약 취소</button>`;
    if(b.status==='ongoing')buttons=`<button class="btn btn-primary" type="button" id="finish-care">돌봄 완료 시연하기</button><button class="btn btn-outline" id="cancel-care" type="button">예약 취소</button>`;
    if(b.status==='finished')buttons=`<span class="booking-status">돌봄이 완료되었습니다</span><button class="btn btn-outline" data-action="new-request" type="button">새 요청 작성하기</button>`;
    let report='';
    if(b.status==='ongoing'||b.status==='finished'){
      const logs=state.careLogs.slice(-15).reverse().map(logItemHTML).join('');
      report=`<div class="care-box care-timeline"><h4>돌봄 기록</h4><ul class="log-list">${logs||'<li>아직 등록된 기록이 없습니다.</li>'}</ul>
      ${b.status==='ongoing'?`<label class="field-label" for="care-message">진행 상황 기록하기</label><textarea id="care-message" maxlength="300" placeholder="예: 사료와 물을 챙겼고, 모모는 편안하게 쉬고 있습니다."></textarea><label class="filter-check photo-demo-check"><input id="attach-demo-photo" type="checkbox"> 시연용 사진 함께 첨부</label><button type="button" class="btn btn-outline" id="add-care-log">기록 추가하기</button>`:''}
      <p class="care-note">이 기록은 브라우저 안에서만 저장되는 예시입니다. 실제로 보호자에게 전송되지 않습니다.</p></div>`;
    }
    let review='';
    if(b.status==='finished'){
      if(b.review)review=`<div class="review-box"><div class="review-done"><strong>후기가 저장되었습니다</strong><p>${'★'.repeat(b.review.rating)}${'☆'.repeat(5-b.review.rating)} · ${esc(b.review.text)}</p></div></div>`;
      else review=`<div class="review-box"><h4>돌봄 서비스에 대한 평가</h4><div class="review-stars" role="group" aria-label="별점 선택">${[1,2,3,4,5].map(n=>`<button type="button" class="star-button ${n<=state.reviewRating?'selected':''}" data-star="${n}" aria-pressed="${n<=state.reviewRating}" aria-label="${n}점"><svg class="icon"><use href="#i-star"/></svg></button>`).join('')}</div><label class="field-label" for="review-text">후기 내용</label><textarea id="review-text" maxlength="300" placeholder="예: 요청한 내용을 꼼꼼하게 확인해 주셨어요."></textarea><button class="btn btn-primary" type="button" id="submit-review">후기 저장하기</button></div>`;
    }
    el.innerHTML=`<div class="booking-hero"><div><span class="booking-status">${bookingLabel(b.status)} · 시연용</span><strong>${esc(r.petName||petLabel(r.pet))}의 돌봄 예약</strong><p>예약번호 ${esc(b.number||'PM-DEMO')} · ${esc(s.name)}<br>${esc(readableDate(r.date))} ${esc(r.time)} · ${esc(r.area)}<br>${esc(serviceLabel(r.service))} / ${esc(r.duration)}분</p></div><svg class="icon"><use href="#i-paw"/></svg></div>
      <div class="booking-grid"><div class="care-box"><h4>예약 진행 단계</h4>${progressHTML}</div><div class="care-box"><h4>맞춤 돌봄 체크리스트 <span class="task-progress">${done}/${tasks.length}</span></h4><div class="score-track tasks-track"><span style="width:${Math.round(done/tasks.length*100)}%"></span></div><div class="guide-list">${taskHTML}</div></div></div>
      <div class="care-actions">${buttons}</div>${report}${review}${feeHTML(s)}
      <p class="care-note">예약 상태, 체크리스트, 기록과 후기는 사용자가 직접 조작하는 시연 기능입니다. 실제 돌봄과는 연결되어 있지 않습니다.</p>`;
  }
  function archivedCards(){
    const entries=[];
    if(state.booking&&state.request)entries.push({booking:state.booking,request:state.request,current:true});
    for(const item of state.history)entries.push({...item,current:false});
    return entries.slice(0,30);
  }
  function renderHistory(){
    const el=$('#history-content'),items=archivedCards();
    if(!items.length){el.innerHTML=`<div class="care-empty"><svg class="icon"><use href="#i-calendar"/></svg><h4>아직 이용 내역이 없습니다</h4><p>돌봄 서비스를 체험하면 이곳에 기록이 표시됩니다.</p><button class="btn btn-primary" type="button" data-tab="request">첫 요청 작성하기</button></div>`;return;}
    el.innerHTML=`<div class="history-header"><span>총 ${items.length}건의 시연 기록</span><button data-action="new-request" type="button" class="btn btn-outline">새 요청 작성</button></div><div class="history-list">${items.map(({booking:b,request:r,current})=>{
      const s=sitters.find(x=>x.id===b.sitterId);return `<article class="history-card"><div><span class="booking-status">${bookingLabel(b.status)}${current?' · 현재 예약':''}</span><h4>${esc(r.petName||petLabel(r.pet))} · ${esc(serviceLabel(r.service))}</h4><p>${esc(readableDate(r.date))} ${esc(r.time)} · ${esc(r.area)}<br>담당자: ${esc(s?.name||'제공자 미상')} · ${esc(b.number||'PM-DEMO')}</p>${b.review?`<p class="history-review">${'★'.repeat(b.review.rating)}${'☆'.repeat(5-b.review.rating)} · ${esc(b.review.text)}</p>`:''}</div><div class="history-right"><strong>${money(s?.price||0)}</strong>${current?'<button class="text-button" type="button" data-tab="care">예약 보기</button>':''}</div></article>`;
    }).join('')}</div><p class="care-note">이용 내역은 해당 브라우저에만 저장됩니다. 실제 거래 기록이 아닙니다.</p>`;
  }
  function switchTab(tab,scroll=false) {
    if(!['request','match','care','history'].includes(tab))return;
    state.tab=tab;save();
    $$('.app-step').forEach(el=>{const on=el.dataset.tab===tab;el.classList.toggle('active',on);el.classList.toggle('done',(el.dataset.tab==='request'&&!!state.request)||(el.dataset.tab==='match'&&!!state.booking)||(el.dataset.tab==='care'&&state.booking?.status==='finished'));el.setAttribute('aria-selected',String(on));el.tabIndex=on?0:-1;});
    $$('.tab-panel').forEach(el=>el.classList.toggle('hidden',el.id!==`panel-${tab}`));
    if(tab==='match')renderMatches();
    if(tab==='care')renderCare();
    if(tab==='history')renderHistory();
    if(scroll)$('#workspace').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function analyze() {
    const content=$('#request-text').value.trim();
    if(content.length<8){showToast('돌봄 상황을 조금 더 자세히 입력해 주세요.');$('#request-text').focus();return;}
    $('#analysis-box').innerHTML=resultHTML(parse(content));showToast('요청 조건을 정리했습니다. 내용을 확인해 주세요.');
  }
  function archiveCurrent(){
    if(state.booking&&state.request)state.history.unshift({booking:structuredClone(state.booking),request:structuredClone(state.request)});
    state.history=state.history.slice(0,30);
    state.booking=null;state.careLogs=[];state.guideChecks=[];state.reviewRating=5;
  }
  function register() {
    const r=readForm();
    const validations=[['pet','반려동물 종류를 선택해 주세요.'],['service','서비스 종류를 선택해 주세요.'],['area','지역을 입력해 주세요.'],['date','날짜를 입력해 주세요.'],['time','시간을 입력해 주세요.']];
    for(const [field,msg] of validations)if(!r[field]){showToast(msg);$('#field-'+field).focus();return;}
    if(r.date<dateOf(0)){showToast('오늘 이후의 날짜를 선택해 주세요.');$('#field-date').focus();return;}
    if(!Number.isFinite(r.duration)||r.duration<15||r.duration>480){showToast('돌봄 시간을 15~480분으로 입력해 주세요.');$('#field-duration').focus();return;}
    if(!Number.isFinite(r.budget)||r.budget<0||r.budget>1000000){showToast('예산은 0~1,000,000원 사이로 입력해 주세요.');$('#field-budget').focus();return;}
    if(state.booking&&['matched','ongoing'].includes(state.booking.status)){
      showToast('진행 중인 예약을 완료하거나 취소한 다음 새 요청을 등록해 주세요.');switchTab('care',true);return;
    }
    if(state.booking)archiveCurrent();
    state.request=r;state.filters={...defaults.filters};save();switchTab('match',true);showToast('시연용 요청이 등록되었습니다. 제공자를 비교해 보세요.');
  }
  function showProfile(id){
    const s=matchList().find(x=>x.id===id);
    if(!s)return;
    selectedId=id;
    const dlg=$('#profile-dialog');
    $('#dialog-content').innerHTML=`<span class="panel-kicker">돌봄 제공자 프로필 · 시연용</span><h3 id="dialog-title" class="dialog-title">${esc(s.name)}</h3>
      <div class="dialog-meta"><span>평점 ${s.rating.toFixed(1)}</span><span>경력 ${s.years}년</span><span>${esc(s.near)}</span><span>${money(s.price)}</span></div>
      <p class="dialog-description">${esc(s.bio)}</p><div class="dialog-highlight"><strong>매칭 근거</strong><br>${esc(s.why.join(' · '))}<br><small>매칭 점수 ${s.score}점 / 100 · 시연용 규칙 기반 계산</small></div>
      ${state.request?.budget&&!s.within?`<p class="dialog-warning">설정한 예산(${money(state.request.budget)})을 초과합니다.</p>`:''}
      ${feeHTML(s)}<p class="dialog-description">실제 활동, 인증, 예약 가능 여부를 확인한 정보가 아닙니다.</p>
      <div class="dialog-buttons"><button class="btn btn-outline" type="button" id="cancel-profile">다시 비교하기</button><button class="btn btn-primary" type="button" id="confirm-pick">시연용 매칭 확정</button></div>`;
    if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
  }
  function closeDialog(){const dlg=$('#profile-dialog');if(typeof dlg.close==='function')dlg.close();else dlg.removeAttribute('open');}
  function confirmPick(){
    if(!state.request||!selectedId)return;
    if(state.booking&&['matched','ongoing'].includes(state.booking.status)){closeDialog();switchTab('care',true);showToast('현재 예약을 먼저 완료하거나 취소해 주세요.');return;}
    if(state.booking)archiveCurrent();
    state.booking={sitterId:selectedId,number:'PM-'+Date.now().toString().slice(-9),status:'matched',createdAt:new Date().toISOString(),review:null};
    state.careLogs=[{at:new Date().toISOString(),kind:'system',text:'시연용 돌봄 예약을 생성했습니다.'}];
    state.guideChecks=[];state.reviewRating=5;
    selectedId=null;save();closeDialog();switchTab('care',true);showToast('시연용 매칭이 완료되었습니다.');
  }
  function addLog(text,photo=false,kind='note'){
    state.careLogs.push({at:new Date().toISOString(),kind,text,photo:photo?(state.request?.pet==='dog'?'dog':'cat'):false});
    state.careLogs=state.careLogs.slice(-40);save();renderCare();
  }
  function startCare(){if(!state.booking||state.booking.status!=='matched')return;state.booking.status='ongoing';addLog('돌봄이 시작되었습니다. (시연용 상태 변경)',false,'system');showToast('돌봄 진행 중으로 상태를 변경했습니다.');}
  function finishCare(){if(!state.booking||state.booking.status!=='ongoing')return;state.booking.status='finished';addLog('돌봄이 완료되었습니다. (시연용 상태 변경)',false,'system');showToast('서비스 완료 상태입니다. 후기를 남겨 보세요.');}
  function cancelCare(){
    if(!state.booking||!['matched','ongoing'].includes(state.booking.status))return;
    state.booking.status='cancelled';archiveCurrent();save();switchTab('history',true);showToast('시연용 예약을 취소하고 이용 내역에 저장했습니다.');
  }
  function newRequest(){
    if(state.booking&&['matched','ongoing'].includes(state.booking.status)){switchTab('care',true);showToast('진행 중인 예약을 먼저 완료하거나 취소해 주세요.');return;}
    if(state.booking)archiveCurrent();
    state.request=null;save();$('#request-text').value=examples.cat;
    $('#analysis-box').innerHTML=emptyAnalysisHTML();switchTab('request',true);showToast('새 돌봄 요청을 작성할 수 있습니다.');
  }
  function emptyAnalysisHTML(){return `<div class="empty-analysis"><div class="empty-orbit"><svg class="icon"><use href="#i-spark"/></svg></div><strong>요청 내용을 입력해 주세요</strong><p>왼쪽의 문장을 분석해<br>돌봄 조건을 정리합니다.</p></div>`;}
  function exportRecords(){
    const data={project:'PawMate demo',version:2,exportedAt:new Date().toISOString(),notice:'실제 거래가 없는 시연용 데이터입니다.',current:state.booking?{booking:state.booking,request:state.request}:null,history:state.history};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PawMate_Demo_Records.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('시연용 이용 기록을 저장했습니다.');
  }
  function handleClick(e) {
    const target=e.target.closest('[data-target]');if(target){e.preventDefault();switchTab('request',true);return;}
    const tab=e.target.closest('[data-tab]');if(tab){e.preventDefault();switchTab(tab.dataset.tab,true);return;}
    const example=e.target.closest('[data-example]');if(example){$('#request-text').value=examples[example.dataset.example];$('#analysis-box').innerHTML=emptyAnalysisHTML();$('#request-text').focus();return;}
    const fav=e.target.closest('[data-favorite]');if(fav){const id=fav.dataset.favorite;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();renderMatches();showToast(state.favorites.includes(id)?'관심 제공자로 저장했습니다.':'관심 제공자에서 해제했습니다.');return;}
    const pick=e.target.closest('[data-pick]');if(pick){showProfile(pick.dataset.pick);return;}
    const star=e.target.closest('[data-star]');if(star){state.reviewRating=Number(star.dataset.star);save();$$('.star-button').forEach(el=>{let active=Number(el.dataset.star)<=state.reviewRating;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});return;}
    if(e.target.closest('#analyze-btn')){analyze();return;}
    if(e.target.closest('#register-btn')){register();return;}
    if(e.target.closest('#clear-filters')){state.filters={...defaults.filters};save();renderMatches();return;}
    if(e.target.closest('#close-dialog')||e.target.closest('#cancel-profile')){closeDialog();return;}
    if(e.target.closest('#confirm-pick')){confirmPick();return;}
    if(e.target.closest('#start-care')){startCare();return;}
    if(e.target.closest('#finish-care')){finishCare();return;}
    if(e.target.closest('#cancel-care')){cancelCare();return;}
    if(e.target.closest('[data-action="new-request"]')){newRequest();return;}
    if(e.target.closest('#add-care-log')){
      const input=$('#care-message');const message=input?.value.trim();
      if(!message||message.length<3){showToast('돌봄 기록을 3자 이상 입력해 주세요.');input?.focus();return;}
      addLog(message,$('#attach-demo-photo')?.checked);showToast('시연용 돌봄 기록을 추가했습니다.');return;
    }
    if(e.target.closest('#submit-review')){
      const el=$('#review-text');const content=el?.value.trim();if(!content||content.length<3){showToast('후기를 3자 이상 입력해 주세요.');el?.focus();return;}
      if(!state.booking||state.booking.status!=='finished')return;
      state.booking.review={rating:state.reviewRating,text:content};save();renderCare();showToast('시연용 후기를 저장했습니다.');return;
    }
    if(e.target.closest('#export-btn')){exportRecords();return;}
    if(e.target.closest('#reset-btn')){
      if(!window.confirm('브라우저에 저장된 모든 PawMate 시연 데이터를 지울까요?'))return;
      state=emptyState();save();$('#request-text').value=examples.cat;$('#analysis-box').innerHTML=emptyAnalysisHTML();switchTab('request',true);showToast('시연 데이터를 초기화했습니다.');
    }
  }
  function handleChange(e){
    const task=e.target.closest('[data-guide]');
    if(task){let n=Number(task.dataset.guide);state.guideChecks=task.checked?[...new Set([...state.guideChecks,n])]:state.guideChecks.filter(x=>x!==n);save();renderCare();return;}
    if(e.target.matches('#sort-filter'))state.filters.sort=e.target.value;
    else if(e.target.matches('#budget-only'))state.filters.underBudget=e.target.checked;
    else if(e.target.matches('#high-rating'))state.filters.highRating=e.target.checked;
    else if(e.target.matches('#photo-only'))state.filters.withPhotos=e.target.checked;
    else return;
    save();renderMatches();
  }
  function init(){
    $('#request-text').value=state.request?.raw || examples.cat;
    $('#analysis-box').innerHTML=state.request?resultHTML(state.request):emptyAnalysisHTML();
    document.addEventListener('click',handleClick);
    document.addEventListener('change',handleChange);
    $('#profile-dialog').addEventListener('click',e=>{if(e.target===$('#profile-dialog'))closeDialog();});
    document.addEventListener('keydown',e=>{
      if(!e.target.matches('.app-step'))return;
      if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();const tabs=['request','match','care','history'];const idx=tabs.indexOf(e.target.dataset.tab);const next=tabs[(idx+(e.key==='ArrowRight'?1:3))%4];switchTab(next);$(`#tab-${next}`).focus();
    });
    switchTab(state.tab||'request');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
