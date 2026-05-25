-- Tips & Tricks (LEN-1191)

-- Categories for tips
create table if not exists public.tip_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  icon        text,
  color       text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- Tips
create table if not exists public.tips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null, -- markdown
  category_id uuid references public.tip_categories(id) on delete set null,
  tags        text[] default '{}',
  author_name text not null,
  author_id   uuid references auth.users(id) on delete set null,
  status      text default 'draft' check (status in ('draft', 'published')),
  featured    boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Indexes
create index if not exists idx_tips_status on public.tips(status);
create index if not exists idx_tips_category_id on public.tips(category_id);
create index if not exists idx_tips_featured_created_at on public.tips(featured desc, created_at desc);

-- Keep updated_at fresh
drop trigger if exists set_tips_updated_at on public.tips;
create trigger set_tips_updated_at
  before update on public.tips
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.tip_categories enable row level security;
alter table public.tips enable row level security;

-- Public read for published tips and all categories
drop policy if exists tip_categories_public_read on public.tip_categories;
create policy tip_categories_public_read
  on public.tip_categories
  for select
  using (true);

drop policy if exists tips_public_read on public.tips;
create policy tips_public_read
  on public.tips
  for select
  using (status = 'published');

-- Service role full access (cron/admin API routes)
drop policy if exists tip_categories_service_all on public.tip_categories;
create policy tip_categories_service_all
  on public.tip_categories
  for all
  using (auth.role() = 'service_role');

drop policy if exists tips_service_all on public.tips;
create policy tips_service_all
  on public.tips
  for all
  using (auth.role() = 'service_role');

-- Grants for direct client reads (optional but aligns with "public read")
grant select on table public.tip_categories to anon;
grant select on table public.tips to anon;

-- Seed categories
insert into public.tip_categories (name, slug, description, icon, color, sort_order)
values
  (
    'AI & Prompt Engineering',
    'ai-prompt-engineering',
    'Practical prompt patterns and AI workflows for security research, triage, and detection engineering.',
    'smart_toy',
    'cyan',
    10
  ),
  (
    'Frameworks & Compliance',
    'frameworks-compliance',
    'Short, high-signal guidance for mapping controls to real-world evidence (NIST CSF, ISO 27001, SOC 2, etc.).',
    'gavel',
    'purple',
    20
  ),
  (
    'Operational Tactics',
    'operational-tactics',
    'Hardening, incident response, and day-to-day security operations tactics that reduce time-to-detect and time-to-contain.',
    'military_tech',
    'orange',
    30
  )
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order;

-- Seed tips (published) — sets the quality bar for future user submissions

-- AI & Prompt Engineering
insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'Triage a security alert in 5 minutes with a structured LLM prompt',
  $$### Goal
Turn noisy alerts into an actionable next step (escalate, suppress, or request more telemetry) without hallucinating.

### Prompt
**Role:** You are a SOC analyst. Be concise. If you need more data, ask for it explicitly.

**Inputs:**
- Alert summary: {{alert_summary}}
- Raw fields: {{json_fields}}
- Environment: {{env_context}}

**Output format (must follow):**
1) **Likely cause (1–2 sentences)**
2) **Confidence (low/med/high) + why**
3) **Most important missing data (max 5 bullets)**
4) **Immediate actions (max 6 bullets)**
5) **Detection improvements** (1–3 bullets)

### Guardrails
- If evidence is insufficient, say so.
- Do not invent hostnames, user names, IPs, or process trees.
- Prefer: “collect X from Y” over generic advice.
$$,
  (select id from public.tip_categories where slug = 'ai-prompt-engineering'),
  array['triage','soc','prompt','llm'],
  'ThreatNoir',
  'published',
  true
where not exists (select 1 from public.tips where title = 'Triage a security alert in 5 minutes with a structured LLM prompt');

insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'Generate KQL / SPL safely: force the model to show assumptions + fields',
  $$### Pattern
When you ask for SIEM queries, make the LLM **declare its assumptions** about table names and field names.

### Prompt
"Write the query, but first list the exact fields you assume exist. If you are unsure, output multiple query variants and label them."

### Example output structure
1) **Assumed data model**
- Table(s): ...
- Required fields: ...

2) **Query (Variant A)**
3) **Query (Variant B)**
4) **How to validate** (2–4 steps)

### Why this helps
It prevents silent failure where the query returns 0 rows because the schema doesn’t match reality.
$$,
  (select id from public.tip_categories where slug = 'ai-prompt-engineering'),
  array['kql','spl','siem','detection-engineering'],
  'ThreatNoir',
  'published',
  false
where not exists (select 1 from public.tips where title = 'Generate KQL / SPL safely: force the model to show assumptions + fields');

insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'Use an LLM as a “translation layer” between a CVE and your asset inventory',
  $$### Workflow
1) Paste the CVE advisory text (or vendor bulletin).
2) Ask the model to extract **affected product names + version ranges**.
3) Ask it to generate **inventory matching rules** (package names, CPE hints, file paths, service names).
4) Validate those rules against **one known affected host** before running at scale.

### Prompt
"Extract affected products and version ranges. Then propose 5–10 concrete ways to identify exposure in an enterprise (package names, registry keys, service names, binary versions, config flags)."

### Caution
Always treat the output as a hypothesis—verify against authoritative sources and a known host.
$$,
  (select id from public.tip_categories where slug = 'ai-prompt-engineering'),
  array['cve','vulnerability-management','inventory'],
  'ThreatNoir',
  'published',
  false
where not exists (select 1 from public.tips where title = 'Use an LLM as a “translation layer” between a CVE and your asset inventory');

-- Frameworks & Compliance
insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'ISO 27001 evidence: prefer “live artifacts” over policy PDFs',
  $$### Principle
Auditors trust **evidence you can replay** more than static documents.

### High-signal evidence examples
- Change management: ticket + PR link + CI logs + deployment record
- Access control: IdP group membership export + RBAC mapping + sample access review
- Logging: SIEM onboarding list + retention settings + a real detection alert timeline

### Tip
For each control, keep a **one-page “evidence map”**: what system, what screenshot/export, who owns it, and how often it’s updated.
$$,
  (select id from public.tip_categories where slug = 'frameworks-compliance'),
  array['iso27001','evidence','audit'],
  'ThreatNoir',
  'published',
  true
where not exists (select 1 from public.tips where title = 'ISO 27001 evidence: prefer “live artifacts” over policy PDFs');

insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'NIST CSF mapping: build a 2-column control matrix first',
  $$### Fast mapping method
Before you build a giant spreadsheet, start with just:

| CSF Subcategory | “We do this via…” |
|---|---|

Populate the second column with **systems and processes**, not prose.

### Example
- **PR.AC-1** → Okta groups + Terraform IAM + quarterly access review
- **DE.CM-7** → EDR + DNS logs + cloud audit logs + alert routing

### Outcome
Once the "We do this via…" column is real, documentation becomes an output—not the starting point.
$$,
  (select id from public.tip_categories where slug = 'frameworks-compliance'),
  array['nist-csf','controls','governance'],
  'ThreatNoir',
  'published',
  false
where not exists (select 1 from public.tips where title = 'NIST CSF mapping: build a 2-column control matrix first');

insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'SOC 2 “change management” quick win: make CI logs exportable',
  $$### What to do
If you use GitHub Actions / GitLab CI, ensure you can export:
- Build logs
- Deployment approvals
- Protected branch rules
- Artifact hashes (or image digests)

### Why it matters
SOC 2 evidence often fails because the team can’t *produce* historical records quickly.

### Implementation hint
Store build metadata (commit SHA → environment → timestamp) in a simple table or log stream.
$$,
  (select id from public.tip_categories where slug = 'frameworks-compliance'),
  array['soc2','ci-cd','audit'],
  'ThreatNoir',
  'published',
  false
where not exists (select 1 from public.tips where title = 'SOC 2 “change management” quick win: make CI logs exportable');

-- Operational Tactics
insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'Incident response: always capture the “first seen” timeline from multiple clocks',
  $$### Why
One clock lies. Combine timestamps from:
- SIEM event time
- EDR detection time
- Cloud audit log time
- Email gateway time
- System clock on the affected host

### Practice
During the first 30 minutes, write down **three timestamps**:
1) First suspicious event
2) First confirmed malicious event
3) Containment time

### Outcome
Your post-incident narrative is defensible, and your containment KPI becomes measurable.
$$,
  (select id from public.tip_categories where slug = 'operational-tactics'),
  array['incident-response','timeline','forensics'],
  'ThreatNoir',
  'published',
  true
where not exists (select 1 from public.tips where title = 'Incident response: always capture the “first seen” timeline from multiple clocks');

insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'Hardening baseline: block outbound DNS-over-HTTPS unless you run it',
  $$### Rationale
DoH can blind traditional DNS monitoring. If you don’t explicitly operate/allow it, treat it as a controlled egress path.

### Practical steps
- Inventory approved resolvers / DoH endpoints
- Block known DoH endpoints at proxy/firewall (start with high-risk segments)
- Alert on unexpected DoH client behavior (browser flags, known binaries)

### Caveat
Some browsers and security tools may rely on DoH—pilot before broad enforcement.
$$,
  (select id from public.tip_categories where slug = 'operational-tactics'),
  array['hardening','dns','egress'],
  'ThreatNoir',
  'published',
  false
where not exists (select 1 from public.tips where title = 'Hardening baseline: block outbound DNS-over-HTTPS unless you run it');

insert into public.tips (title, body, category_id, tags, author_name, status, featured)
select
  'Detection engineering: add a “negative control” alert for your top 10 data sources',
  $$### Idea
If a critical log source goes dark, your detection pipeline silently degrades.

### Implementation
For each top source (EDR, IdP, cloud audit logs, DNS, proxy):
- Create an alert when **event volume drops below baseline** for N minutes.
- Route it like a P1 reliability issue (because it is).

### Result
You catch ingestion failures before you miss an incident.
$$,
  (select id from public.tip_categories where slug = 'operational-tactics'),
  array['detection','logging','reliability'],
  'ThreatNoir',
  'published',
  false
where not exists (select 1 from public.tips where title = 'Detection engineering: add a “negative control” alert for your top 10 data sources');
