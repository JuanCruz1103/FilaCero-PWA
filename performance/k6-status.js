// Prueba k6 orientativa (NO ejecutarla sobre clínicas reales).
// k6 run -e BASE_URL=http://localhost:3000 -e COOKIE='fc_session=...' performance/k6-status.js
// Se mide la consulta REST /api/turns/mine con 100 VUs; el objetivo de 200 ms es un criterio pendiente.
import http from 'k6/http';
import {check, sleep} from 'k6';
import {Trend,Rate} from 'k6/metrics';
const timing=new Trend('queue_api_latency_ms');
const errors=new Rate('queue_api_errors');
export const options={vus:100,duration:'30s',thresholds:{queue_api_latency_ms:['p(95)<200'],queue_api_errors:['rate<0.01']}};
export default function(){
  const url=__ENV.BASE_URL||'http://localhost:3000';
  const response=http.get(`${url}/api/turns/mine`,{headers:{Cookie:__ENV.COOKIE||''}});
  timing.add(response.timings.duration);errors.add(response.status!==200);
  check(response,{'HTTP 200':r=>r.status===200});sleep(0.2);
}
