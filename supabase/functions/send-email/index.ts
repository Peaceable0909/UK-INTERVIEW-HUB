import { createClient } from 'jsr:@supabase/supabase-js@2';

const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL')!;
const APPS_SCRIPT_SECRET = Deno.env.get('APPS_SCRIPT_SECRET')!;
const HUB_URL = 'https://peaceable0909.github.io/UK-INTERVIEW-HUB';
const ADMIN_EMAIL = 'applications.whiterock@gmail.com';

const SCHOOL_LABELS: Record<string,string> = {
  regent:'Regent College', bpp:'BPP', yorkstjohn:'York St John',
  ukvi:'UKVI', netherlands:'Netherlands', nursing:'BSc Nursing'
};
function sl(s: string){ return SCHOOL_LABELS[s] || s; }

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors() });
  try {
    const body = await req.json();
    switch (body.type) {
      case 'interview':                return await handleInterview(body);
      case 'session':                  return await handleSession(body);
      case 'notification':             return await handleNotification(body);
      case 'question_reply':           return await handleQuestionReply(body);
      case 'session_reset':            return await handleSessionReset(body);
      case 'ready_report':             return await handleReadyReport(body);
      case 'video_interview_submitted':return await handleVideoInterviewSubmitted(body);
      case 'video_interview_reviewed': return await handleVideoInterviewReviewed(body);
      default:               return jsonError('Unknown type: ' + body.type, 400);
    }
  } catch (e) {
    console.error('send-email error:', e);
    return jsonError('Internal error: ' + String(e), 500);
  }
});

async function handleInterview(body: Record<string,string>) {
  const { user_id, student_name, interview_date, notes } = body;
  const email = await getEmail(user_id);
  if (!email) return jsonError('Student email not found', 404);
  const dateStr = fmt(interview_date);
  const firstName = (student_name || 'there').split(' ')[0];
  const html = shell('Interview Confirmed', '#1e3a8a', '#f59e0b',
    hero('&#128197;', 'Your Interview Is Booked!', '#fef3c7', '#92400e') +
    `<p style="font-size:16px;color:#1e293b;margin:0 0 6px">Hey <strong>${esc(firstName)}!</strong> Your credibility interview has been scheduled.</p>` +
    card('#fef3c7','#f59e0b', label('&#128204; Date &amp; Time','#92400e') +
      `<p style="margin:0;font-size:24px;font-weight:900;color:#1e3a8a">${esc(dateStr)}</p>` +
      (notes ? `<p style="margin:10px 0 0;font-size:14px;color:#475569"><strong>Note:</strong> ${esc(notes)}</p>` : '')) +
    tips(['Practise on the Hub every day until your interview','Review your weakest questions first','Get a good night&rsquo;s sleep before the big day']) +
    cta('Keep Preparing', HUB_URL, '#1e3a8a') + footer());
  const r = await send([email], 'Interview Scheduled - ' + dateStr, html);
  return jsonOk({ sent:1, to:email, result:r });
}

async function handleSession(body: Record<string,unknown>) {
  const { target, title, start_time, duration_minutes, zoom_link } =
    body as { target:string; title:string; start_time:string; duration_minutes:number; zoom_link?:string };
  const emails = await emailsForTarget(target);
  if (!emails.length) return jsonOk({ sent:0, message:'No students found for: '+target });
  const dateStr = fmt(start_time); const titleStr = String(title);
  const html = shell('Live Training Session', '#7c3aed', '#10b981',
    hero('&#127919;', 'Live Training Session', '#f0fdf4', '#14532d') +
    `<p style="font-size:16px;color:#1e293b;margin:0 0 24px">You&rsquo;ve been invited to a <strong>live interview training session</strong>!</p>` +
    card('#f0fdf4','#16a34a', label('&#128204; Session Details','#14532d') +
      `<p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#14532d">${esc(titleStr)}</p>` +
      `<p style="margin:0;font-size:15px;color:#166534">${esc(dateStr)}</p>` +
      chips([`&#9201; ${duration_minutes} minutes`,'Live Q&amp;A','Mock interview'])) +
    (zoom_link ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td align="center"><a href="${esc(String(zoom_link))}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:900;font-size:16px;padding:16px 36px;border-radius:14px">Join the Session</a></td></tr></table>` : '') +
    tips(['Check your mic 10 minutes before','Have your research notes ready','Ask questions - the team is here to help']) +
    cta('Open Interview Hub', HUB_URL, '#7c3aed') + footer());
  let sent=0;
  for (const addr of emails) { try { await send([addr],'Live Training: '+titleStr+' - '+dateStr, html); sent++; } catch(e){ console.error(e); } }
  return jsonOk({ sent, total:emails.length });
}

async function handleNotification(body: Record<string,unknown>) {
  const { target, title, message, type: nt } = body as { target:string; title:string; message:string; type:string };
  const emails = await emailsForTarget(target);
  if (!emails.length) return jsonOk({ sent:0, message:'No students found for: '+target });
  const themes: Record<string,{hdr:string;acc:string;bg:string;text:string;emoji:string}> = {
    success:{hdr:'#16a34a',acc:'#86efac',bg:'#f0fdf4',text:'#14532d',emoji:'&#127881;'},
    warning:{hdr:'#d97706',acc:'#fcd34d',bg:'#fffbeb',text:'#92400e',emoji:'&#9888;'},
    error:  {hdr:'#dc2626',acc:'#fca5a5',bg:'#fef2f2',text:'#7f1d1d',emoji:'&#128680;'},
    info:   {hdr:'#1e3a8a',acc:'#93c5fd',bg:'#eff6ff',text:'#1e3a8a',emoji:'&#128226;'},
  };
  const t = themes[String(nt)] || themes.info;
  const html = shell(esc(String(title)), t.hdr, t.acc,
    hero(t.emoji, esc(String(title)), t.bg, t.text) +
    `<p style="font-size:15px;color:#1e293b;margin:0 0 24px;line-height:1.7">${esc(String(message))}</p>` +
    cta('Open Interview Hub', HUB_URL, t.hdr) + footer());
  let sent=0;
  for (const addr of emails) { try { await send([addr], String(title), html); sent++; } catch(e){ console.error(e); } }
  return jsonOk({ sent, total:emails.length });
}

async function handleQuestionReply(body: Record<string,string>) {
  const { student_email, student_name, question_text, reply_text } = body;
  if (!student_email) return jsonError('student_email required',400);
  if (!reply_text) return jsonError('reply_text required',400);
  const firstName = (student_name || 'there').split(' ')[0];
  const html = shell('You Got a Reply!', '#0891b2', '#6366f1',
    hero('&#128172;', 'New Reply From WhiteRock', '#eff6ff', '#1e40af') +
    `<p style="font-size:16px;color:#1e293b;margin:0 0 24px">Hey <strong>${esc(firstName)}</strong>! The WhiteRock team has replied to your question.</p>` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td style="background:#f1f5f9;border-radius:16px 16px 16px 4px;padding:16px 20px"><p style="margin:0 0 8px"><span style="background:#cbd5e1;color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;padding:3px 10px;border-radius:99px">Your question</span></p><p style="margin:0;font-size:14px;color:#334155;line-height:1.7">${esc(question_text||'')}</p></td></tr></table>` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px"><tr><td style="background:#eff6ff;border:2px solid #3b82f6;border-radius:4px 16px 16px 16px;padding:16px 20px"><p style="margin:0 0 8px"><span style="background:#3b82f6;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 10px;border-radius:99px">WhiteRock reply</span></p><p style="margin:0;font-size:15px;color:#1e293b;line-height:1.8;font-weight:500">${esc(reply_text)}</p></td></tr></table>` +
    cta('Ask Another Question', HUB_URL+'/dashboard.html', '#0891b2') + footer());
  const r = await send([student_email], 'WhiteRock replied to your question', html);
  return jsonOk({ sent:1, to:student_email, result:r });
}

async function handleSessionReset(body: Record<string,string>) {
  const { student_email, student_name, from_school, from_course, to_school, to_course } = body;
  if (!student_email) return jsonError('student_email required',400);
  const firstName = (student_name||'there').split(' ')[0];
  const fromLabel = sl(from_school)+(from_course?` &mdash; ${from_course}`:'');
  const toLabel   = sl(to_school)  +(to_course  ?` &mdash; ${to_course}`  :'');
  const toLabelPlain = sl(to_school)+(to_course?` - ${to_course}`:'');
  const html = shell('Session Switched','#dc2626','#f97316',
    hero('&#128260;','Your Session Was Reset','#fff7ed','#9a3412') +
    `<p style="font-size:16px;color:#1e293b;margin:0 0 24px">Hey <strong>${esc(firstName)}</strong>! Your session has been reset because you switched programme.</p>` +
    card('#fef2f2','#dc2626',label('Cleared from your record','#7f1d1d')+row('Practice responses &amp; AI scores',esc(fromLabel))+row('Checklist progress',esc(fromLabel))+row('Readiness submission','Reset')) +
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 28px"><tr><td style="background:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:20px"><p style="margin:0 0 4px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#16a34a">You are now working on</p><p style="margin:0;font-size:22px;font-weight:900;color:#14532d">${esc(toLabel)}</p></td></tr></table>` +
    `<p style="font-size:13px;color:#64748b;background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 28px"><strong>Not you?</strong> Contact your counsellor immediately.</p>` +
    cta('Start Preparing', HUB_URL, '#16a34a') + footer());
  const r = await send([student_email], 'Your WhiteRock session has been reset - '+toLabelPlain, html);
  return jsonOk({ sent:1, to:student_email, result:r });
}

async function handleReadyReport(body: Record<string,unknown>) {
  const { student_name, student_id, student_email, university, course_name,
          passed_count, total_count, percent_score, readiness_level,
          avg_score, passed_questions, failed_questions, checklist_done,
          checklist_total } = body as Record<string,unknown>;

  const pct = Number(percent_score)||0;
  const emoji = pct >= 90 ? '&#9989;' : pct >= 70 ? '&#9888;' : '&#10060;';
  const levelColor = pct >= 90 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
  const levelBg   = pct >= 90 ? '#f0fdf4' : pct >= 70 ? '#fffbeb' : '#fef2f2';
  const levelBorder= pct >= 90 ? '#86efac' : pct >= 70 ? '#fcd34d' : '#fca5a5';

  const passedRows = Array.isArray(passed_questions)
    ? (passed_questions as Array<{q:string;score:number;answer:string;attempts:number}>).map((q,i)=>
        `<tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1e293b">Q${i+1}: ${esc(q.q||'')}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#475569;line-height:1.5">${esc((q.answer||'').substring(0,180))}${(q.answer||'').length>180?'...':''}</p>
        </td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:top;white-space:nowrap">
          <span style="background:#dcfce7;color:#16a34a;font-size:13px;font-weight:800;padding:4px 10px;border-radius:8px">${q.score||0}/10</span><br>
          <span style="font-size:10px;color:#94a3b8;margin-top:3px;display:block">${q.attempts||1} attempt${(q.attempts||1)>1?'s':''}</span>
        </td></tr>`
      ).join('')
    : '<tr><td colspan="2" style="padding:12px;color:#94a3b8;font-size:13px">No questions passed yet.</td></tr>';

  const failedRows = Array.isArray(failed_questions)
    ? (failed_questions as Array<{q:string;score:number;attempts:number}>).map((q,i)=>
        `<tr><td style="padding:10px 12px;border-bottom:1px solid #fef2f2">
          <p style="margin:0;font-size:13px;color:#374151">${esc(q.q||'')}</p>
        </td><td style="padding:10px 12px;border-bottom:1px solid #fef2f2;text-align:center;white-space:nowrap">
          <span style="background:#fee2e2;color:#dc2626;font-size:13px;font-weight:800;padding:4px 10px;border-radius:8px">${q.score||0}/10</span>
        </td></tr>`
      ).join('')
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%">

<!-- HEADER -->
<tr><td style="background:#1a1a2e;border-radius:20px 20px 0 0;padding:28px 32px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="font-size:22px;font-weight:900;color:#fff">White<span style="color:#c41230">Rock</span></span>
      <span style="display:block;font-size:10px;color:rgba(255,255,255,.5);font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-top:2px">Interview Hub — Student Readiness Report</span></td>
    <td style="text-align:right"><span style="font-size:28px">${emoji}</span></td>
  </tr></table>
</td></tr>

<!-- READINESS BADGE -->
<tr><td style="background:${levelBg};border:2px solid ${levelBorder};padding:24px 32px;text-align:center">
  <p style="margin:0 0 4px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${levelColor}">Interview Readiness</p>
  <p style="margin:0;font-size:36px;font-weight:900;color:${levelColor};line-height:1">${esc(String(readiness_level||''))}</p>
  <p style="margin:8px 0 0;font-size:16px;color:#475569">${Number(passed_count)||0} of ${Number(total_count)||0} questions passed &mdash; <strong>${pct}%</strong> &mdash; Avg score: <strong>${Number(avg_score)||0}/10</strong></p>
</td></tr>

<!-- STUDENT DETAILS -->
<tr><td style="background:#fff;padding:24px 32px;border-bottom:1px solid #f1f5f9">
  <p style="margin:0 0 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8">Student Details</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#64748b;padding:4px 0;width:120px">Name</td><td style="font-size:14px;font-weight:700;color:#1e293b">${esc(String(student_name||''))}</td></tr>
    <tr><td style="font-size:13px;color:#64748b;padding:4px 0">Student ID</td><td style="font-size:14px;font-weight:700;color:#1e293b">${esc(String(student_id||'N/A'))}</td></tr>
    <tr><td style="font-size:13px;color:#64748b;padding:4px 0">Email</td><td style="font-size:14px;font-weight:700;color:#1e293b">${esc(String(student_email||''))}</td></tr>
    <tr><td style="font-size:13px;color:#64748b;padding:4px 0">University</td><td style="font-size:14px;font-weight:700;color:#1e293b">${esc(String(university||''))}</td></tr>
    <tr><td style="font-size:13px;color:#64748b;padding:4px 0">Course</td><td style="font-size:14px;font-weight:700;color:#1e293b">${esc(String(course_name||''))}</td></tr>
    <tr><td style="font-size:13px;color:#64748b;padding:4px 0">Checklist</td><td style="font-size:14px;font-weight:700;color:#1e293b">${Number(checklist_done)||0} / ${Number(checklist_total)||0} items completed</td></tr>
  </table>
</td></tr>

<!-- PASSED QUESTIONS -->
<tr><td style="background:#fff;padding:24px 32px 8px">
  <p style="margin:0 0 12px;font-size:13px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:.06em">&#9989; Passed Questions (${Number(passed_count)||0})</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dcfce7;border-radius:10px;overflow:hidden">
    ${passedRows}
  </table>
</td></tr>

${failedRows ? `<!-- FAILED QUESTIONS -->
<tr><td style="background:#fff;padding:20px 32px 24px">
  <p style="margin:0 0 12px;font-size:13px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:.06em">&#10060; Needs More Practice</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fee2e2;border-radius:10px;overflow:hidden">${failedRows}</table>
</td></tr>` : ''}

<!-- FOOTER -->
<tr><td style="background:#1a1a2e;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center">
  <p style="margin:0;font-size:12px;color:rgba(255,255,255,.4);line-height:1.6">WhiteRock Interview Hub &mdash; Student Readiness Report<br>Sent automatically when student marks themselves as ready for interview.</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;

  const r = await send([ADMIN_EMAIL], `${emoji} Interview Readiness Report: ${String(student_name||'')} (${pct}%)`, html);
  return jsonOk({ sent:1, to:ADMIN_EMAIL, result:r });
}

async function handleVideoInterviewSubmitted(body: Record<string,string>) {
  const { user_id, student_name } = body;
  const email = await getEmail(user_id);
  if (!email) return jsonError('Student email not found', 404);
  const firstName = (student_name || 'there').split(' ')[0];
  const html = shell('Interview Submitted', '#1e3a8a', '#60a5fa',
    hero('&#127909;', 'Interview Submitted Successfully', '#eff6ff', '#1e3a8a') +
    `<p style="font-size:16px;color:#1e293b;margin:0 0 24px">Hey <strong>${esc(firstName)}</strong>! Your recorded video interview has been saved successfully.</p>` +
    card('#eff6ff','#93c5fd', label('Current Status','#1e3a8a') +
      `<p style="margin:0;font-size:24px;font-weight:900;color:#1e3a8a">Awaiting Review</p>` +
      `<p style="margin:10px 0 0;font-size:14px;color:#475569">Your recorded answers will now be reviewed by our admissions team. You&rsquo;ll receive another email as soon as the review is complete.</p>`) +
    cta('View Your Progress', HUB_URL, '#1e3a8a') + footer());
  const r = await send([email], 'Your interview has been submitted — Awaiting Review', html);
  return jsonOk({ sent:1, to:email, result:r });
}

async function handleVideoInterviewReviewed(body: Record<string,string>) {
  const { user_id, student_name, result } = body;
  const email = await getEmail(user_id);
  if (!email) return jsonError('Student email not found', 404);
  const firstName = (student_name || 'there').split(' ')[0];
  const passed = result === 'passed';
  const html = shell(passed ? 'Interview Passed' : 'Review Complete', passed ? '#16a34a' : '#dc2626', passed ? '#86efac' : '#fca5a5',
    hero(passed ? '&#9989;' : '&#128221;', passed ? 'Congratulations — You Passed!' : 'Your Interview Has Been Reviewed', passed ? '#f0fdf4' : '#fef2f2', passed ? '#14532d' : '#7f1d1d') +
    `<p style="font-size:16px;color:#1e293b;margin:0 0 24px">Hey <strong>${esc(firstName)}</strong>! Your recorded interview has been reviewed by our admissions team.</p>` +
    card(passed ? '#f0fdf4' : '#fef2f2', passed ? '#16a34a' : '#dc2626', label('Result', passed ? '#14532d' : '#7f1d1d') +
      `<p style="margin:0;font-size:24px;font-weight:900;color:${passed ? '#14532d' : '#7f1d1d'}">${passed ? 'Passed' : 'Not Successful'}</p>`) +
    (passed
      ? tips(['Keep an eye on your email for next steps','Continue preparing any outstanding documents','Reach out to your counsellor with any questions'])
      : `<p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 28px">Don&rsquo;t be discouraged — reach out to your counsellor to discuss next steps and how you can strengthen future opportunities.</p>`) +
    cta('Open Interview Hub', HUB_URL, passed ? '#16a34a' : '#dc2626') + footer());
  const r = await send([email], passed ? 'Your interview result: Passed' : 'Your interview result: Review Complete', html);
  return jsonOk({ sent:1, to:email, result:r });
}

async function send(to: string[], subject: string, html: string): Promise<unknown> {
  const res = await fetch(APPS_SCRIPT_URL, {
    method:'POST', redirect:'follow',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ secret:APPS_SCRIPT_SECRET, to, subject, html })
  });
  let data: Record<string,unknown> = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (data.error) throw new Error(String(data.error));
  return data;
}

async function getEmail(user_id: string): Promise<string|null> {
  const { data, error } = await supabase.auth.admin.getUserById(user_id);
  if (error) console.error('getEmail error:', error.message);
  return data?.user?.email ?? null;
}
async function emailsForTarget(target: string): Promise<string[]> {
  const { data: users, error } = await supabase.auth.admin.listUsers({ perPage:1000 });
  if (error || !users) return [];
  if (target === 'all') return users.users.map((u:{email?:string}) => u.email).filter(Boolean) as string[];
  const { data: progress } = await supabase.from('student_progress').select('user_id').eq('selected_university', target);
  if (!progress?.length) return [];
  const ids = new Set(progress.map((p:{user_id:string}) => p.user_id));
  return users.users.filter((u:{id:string;email?:string}) => ids.has(u.id) && u.email).map((u:{email:string}) => u.email);
}

function fmt(iso: string) { return new Date(iso).toLocaleString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}); }
function shell(title:string,hdr:string,acc:string,body:string):string{
  const t=title.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/gu,'').trim();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td style="background:${hdr};border-radius:20px 20px 0 0;padding:24px 32px 20px"><span style="font-size:22px;font-weight:900;color:#fff">White<span style="color:${acc}">Rock</span></span><span style="display:block;font-size:10px;color:rgba(255,255,255,.6);font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:2px">Interview Hub</span><span style="display:inline-block;margin-top:12px;background:${acc};color:${hdr};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;padding:5px 14px;border-radius:99px">${t}</span></td></tr><tr><td style="background:#fff;border-radius:0 0 20px 20px;padding:36px 32px">${body}</td></tr></table></td></tr></table></body></html>`;
}
function hero(emoji:string,text:string,bg:string,color:string):string{
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px"><tr><td align="center" style="background:${bg};border-radius:16px;padding:28px 20px"><div style="font-size:52px;line-height:1;margin-bottom:10px;font-family:'Segoe UI Emoji','Apple Color Emoji',sans-serif">${emoji}</div><div style="font-size:20px;font-weight:900;color:${color}">${text}</div></td></tr></table>`;
}
function card(bg:string,border:string,content:string):string{
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="background:${bg};border:2px solid ${border};border-radius:14px;padding:20px 22px">${content}</td></tr></table>`;
}
function label(text:string,color:string):string{
  return `<p style="margin:0 0 12px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:${color}">${text}</p>`;
}
function chips(items:string[]):string{
  return `<p style="margin:12px 0 0">${items.map(i=>`<span style="display:inline-block;background:#fff;border:1.5px solid #d1d5db;border-radius:99px;font-size:12px;font-weight:700;color:#374151;padding:4px 12px;margin:3px 4px 3px 0">${i}</span>`).join('')}</p>`;
}
function row(l:string,v:string):string{
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0"><tr><td style="font-size:13px;color:#64748b;width:55%">${l}</td><td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right">${v}</td></tr></table>`;
}
function tips(items:string[]):string{
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background:#f8fafc;border-radius:12px;padding:16px 20px"><tr><td style="padding:0 0 10px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b">Tips for success</td></tr>${items.map(t=>`<tr><td style="padding:6px 0;font-size:13px;color:#374151;line-height:1.5">&#10024; ${t}</td></tr>`).join('')}</table>`;
}
function cta(text:string,url:string,color:string):string{
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td align="center"><a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:900;font-size:16px;padding:16px 40px;border-radius:14px">${text}</a></td></tr></table>`;
}
function footer():string{
  return `<p style="font-size:11px;color:#94a3b8;margin:28px 0 0;text-align:center;line-height:1.7">You received this because you are registered on the WhiteRock Interview Hub.<br>Questions? Reply to this email.</p>`;
}
function esc(s:string){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cors(){return{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type'};}
function jsonOk(d:unknown){return new Response(JSON.stringify(d),{status:200,headers:{'Content-Type':'application/json',...cors()}});}
function jsonError(msg:string,s=400){return new Response(JSON.stringify({error:msg}),{status:s,headers:{'Content-Type':'application/json',...cors()}});}
