-- Local dev seed data for an example deployment
-- This runs after all migrations during `npx supabase db reset`.

begin;

set search_path = public;

-- -----------------------------------------------------------------------------
-- Sources (use deterministic IDs for stable local dev)
-- NOTE: sources.url is not UNIQUE in the schema, so we replace by URL explicitly.
-- -----------------------------------------------------------------------------
delete from public.sources
where url in (
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews',
  'https://feeds.feedburner.com/securityweek',
  'https://www.darkreading.com/rss.xml',
  'https://gdprhub.eu/index.php?title=Special:RecentChanges&feed=rss',
  'https://noyb.eu/en/rss.xml'
);

insert into public.sources (id, name, url, type, fetch_config, is_active)
values
  ('a0000000-0000-0000-0000-000000000001', 'BleepingComputer', 'https://www.bleepingcomputer.com/feed/', 'rss'::source_type, '{}'::jsonb, true),
  ('a0000000-0000-0000-0000-000000000002', 'The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'rss'::source_type, '{}'::jsonb, true),
  ('a0000000-0000-0000-0000-000000000003', 'SecurityWeek', 'https://feeds.feedburner.com/securityweek', 'rss'::source_type, '{}'::jsonb, true),
  ('a0000000-0000-0000-0000-000000000004', 'Dark Reading', 'https://www.darkreading.com/rss.xml', 'rss'::source_type, '{}'::jsonb, true),
  ('a0000000-0000-0000-0000-000000000005', 'GDPRHub', 'https://gdprhub.eu/index.php?title=Special:RecentChanges&feed=rss', 'rss'::source_type, '{}'::jsonb, true),
  ('a0000000-0000-0000-0000-000000000006', 'NOYB', 'https://noyb.eu/en/rss.xml', 'rss'::source_type, '{}'::jsonb, true)
on conflict (id) do update
set name = excluded.name,
    url = excluded.url,
    type = excluded.type,
    fetch_config = excluded.fetch_config,
    is_active = excluded.is_active;

-- -----------------------------------------------------------------------------
-- Articles (40-ish) across many categories, spread over the last ~2 weeks.
-- Some include legal metadata + brief. Mix approved/pending/rejected.
-- -----------------------------------------------------------------------------
insert into public.articles (
  id,
  title,
  url,
  summary,
  ai_summary,
  brief,
  source_id,
  category_id,
  status,
  relevance_score,
  jurisdiction,
  regulation,
  fine_amount,
  published_at,
  ingested_at
)
values
  -- Vulnerabilities / zero-days
  ('c0000000-0000-0000-0000-000000000001',
   'Critical RCE in Apache Struts Exploited in the Wild',
   'https://example.com/struts-rce',
   'Apache Struts vulnerability CVE-2026-1234 allows remote code execution.',
   'A critical remote code execution vulnerability in Apache Struts (CVE-2026-1234) is being actively exploited. The flaw impacts multiple versions and enables unauthenticated attackers to execute arbitrary commands via crafted OGNL expressions. Organizations should patch immediately and review exposure.',
   'Critical Apache Struts RCE actively exploited in the wild.',
   'a0000000-0000-0000-0000-000000000001',
   (select id from public.categories where slug = 'vulnerabilities' limit 1),
   'approved'::article_status,
   9,
   null, null, null,
   now() - interval '2 hours',
   now() - interval '2 hours'),

  ('c0000000-0000-0000-0000-000000000002',
   'Microsoft Patches Exchange Zero-Day Used in Targeted Intrusions',
   'https://example.com/exchange-zero-day',
   'Emergency updates address a zero-day chain impacting on-prem Exchange deployments.',
   'Microsoft released out-of-band security updates for an actively exploited Exchange Server vulnerability chain enabling credential theft and remote code execution. Defenders should prioritize patching, hunt for suspicious OWA activity, and rotate affected secrets.',
   'Out-of-band Exchange patches fix an actively exploited zero-day chain.',
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'zero-day' limit 1),
   'approved'::article_status,
   10,
   null, null, null,
   now() - interval '6 hours',
   now() - interval '6 hours'),

  (gen_random_uuid(),
   'New Linux Kernel Privilege Escalation Bug Triggers Widespread PoC Sharing',
   'https://example.com/linux-kernel-privesc',
   'Researchers publish proof-of-concept for a Linux kernel privilege escalation flaw.',
   'A privilege escalation vulnerability in the Linux kernel has led to a publicly available proof-of-concept exploit. While exploitation requires local access, the issue is high impact for shared environments and container hosts.',
   null,
   'a0000000-0000-0000-0000-000000000001',
   (select id from public.categories where slug = 'vulnerabilities' limit 1),
   'approved'::article_status,
   7,
   null, null, null,
   now() - interval '12 hours',
   now() - interval '12 hours'),

  (gen_random_uuid(),
   'Active Exploitation Reported for Ivanti Gateway Authentication Bypass',
   'https://example.com/ivanti-auth-bypass',
   'Attackers are exploiting an authentication bypass affecting edge gateways.',
   'An authentication bypass affecting popular edge gateways is being leveraged by threat actors for initial access. Guidance includes patching, restricting admin interfaces, and reviewing logs for anomalous sessions.',
   'Auth bypass on edge gateways seeing exploitation—patch and audit now.',
   'a0000000-0000-0000-0000-000000000004',
   (select id from public.categories where slug = 'vulnerabilities' limit 1),
   'approved'::article_status,
   8,
   null, null, null,
   now() - interval '20 hours',
   now() - interval '20 hours'),

  -- Supply chain / OSS
  ('c0000000-0000-0000-0000-000000000003',
   'Compromised npm Package Steals AWS Credentials from CI/CD Pipelines',
   'https://example.com/npm-supply-chain',
   'Malicious npm package discovered exfiltrating cloud credentials.',
   'Security researchers discovered a malicious npm package that exfiltrated AWS credentials from CI/CD environments by reading common environment variables and uploading them to attacker-controlled endpoints. The package typosquatted a popular utility and impacted thousands of downstream projects before removal.',
   'Malicious npm package steals cloud creds from CI/CD environments.',
   'a0000000-0000-0000-0000-000000000002',
   (select id from public.categories where slug = 'supply-chain' limit 1),
   'approved'::article_status,
   8,
   null, null, null,
   now() - interval '1 day 3 hours',
   now() - interval '1 day 3 hours'),

  (gen_random_uuid(),
   'GitHub Action Abuse Campaign Targets Repos with Poisoned Workflow Inputs',
   'https://example.com/github-actions-abuse',
   'Researchers warn about a campaign abusing GitHub Actions to steal tokens.',
   'Attackers are using poisoned inputs and social engineering to trigger workflows that leak secrets. Mitigations include pinning actions, limiting permissions, and disabling untrusted PR workflow execution.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'supply-chain' limit 1),
   'approved'::article_status,
   7,
   null, null, null,
   now() - interval '3 days 4 hours',
   now() - interval '3 days 4 hours'),

  (gen_random_uuid(),
   'PyPI Removes Credential Harvester Masquerading as Popular HTTP Client',
   'https://example.com/pypi-harvester',
   'A malicious Python package imitating a popular library was removed from PyPI.',
   'The package attempted to collect API keys and session cookies from local developer environments. Maintain least privilege for tokens, use dependency allowlists, and monitor for unexpected outbound traffic in CI.',
   null,
   'a0000000-0000-0000-0000-000000000001',
   (select id from public.categories where slug = 'open-source' limit 1),
   'approved'::article_status,
   6,
   null, null, null,
   now() - interval '6 days',
   now() - interval '6 days'),

  -- Ransomware
  ('c0000000-0000-0000-0000-000000000004',
   'LockBit 4.0 Ransomware Variant Targets Healthcare Sector',
   'https://example.com/lockbit4',
   'New LockBit variant specifically targeting healthcare organizations.',
   'A new variant of LockBit ransomware (4.0) has been identified targeting healthcare organizations across Europe and North America. The variant uses updated evasion techniques and exploits weaknesses in exposed services for initial access.',
   'LockBit 4.0 targets healthcare; defenders urged to harden perimeter services.',
   'a0000000-0000-0000-0000-000000000002',
   (select id from public.categories where slug = 'ransomware' limit 1),
   'approved'::article_status,
   9,
   null, null, null,
   now() - interval '8 hours',
   now() - interval '8 hours'),

  (gen_random_uuid(),
   'Ransomware Crew Uses Stolen SSO Tokens to Bypass MFA in Cloud Tenants',
   'https://example.com/ransomware-sso-tokens',
   'Incident response teams report MFA bypass via stolen SSO refresh tokens.',
   'A ransomware affiliate program has been observed using stolen refresh tokens and consent grants to gain persistent access to cloud environments. Recommendations include conditional access hardening, token protection, and rapid revocation procedures.',
   null,
   'a0000000-0000-0000-0000-000000000004',
   (select id from public.categories where slug = 'identity-access' limit 1),
   'approved'::article_status,
   8,
   null, null, null,
   now() - interval '2 days 6 hours',
   now() - interval '2 days 6 hours'),

  (gen_random_uuid(),
   'Akira Affiliates Shift to ESXi Encryption After VPN Exploit Wave',
   'https://example.com/akira-esxi',
   'Akira operators increase focus on ESXi targets during a new intrusion wave.',
   'Threat intelligence reports show Akira affiliates accelerating ESXi-focused ransomware deployments following a surge in VPN compromises. Defenders should prioritize patching, segmentation, and immutable backups.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'ransomware' limit 1),
   'pending'::article_status,
   7,
   null, null, null,
   now() - interval '4 days 2 hours',
   now() - interval '4 days 2 hours'),

  -- Breaches
  (gen_random_uuid(),
   'Customer Support Portal Breach Exposes Ticket Attachments and API Keys',
   'https://example.com/support-portal-breach',
   'A breach of a support portal exposed files, attachments, and API tokens.',
   'Investigators report unauthorized access to a customer support portal that led to exposure of ticket attachments and API tokens. The incident highlights the need for secret scanning, scoped tokens, and least-privilege integrations.',
   null,
   'a0000000-0000-0000-0000-000000000001',
   (select id from public.categories where slug = 'breaches' limit 1),
   'approved'::article_status,
   6,
   null, null, null,
   now() - interval '5 days 10 hours',
   now() - interval '5 days 10 hours'),

  (gen_random_uuid(),
   'SaaS Vendor Reports Unauthorized Access to Customer Data via Misconfigured S3 Bucket',
   'https://example.com/saas-s3-exposure',
   'A misconfigured object storage bucket exposed customer exports.',
   'A SaaS vendor disclosed that a public-facing S3 bucket led to exposure of customer exports. Organizations should audit storage permissions and enable continuous configuration monitoring.',
   'Misconfigured S3 bucket led to customer data exposure—audit storage policies.',
   'a0000000-0000-0000-0000-000000000004',
   (select id from public.categories where slug = 'cloud-security' limit 1),
   'approved'::article_status,
   5,
   null, null, null,
   now() - interval '9 days 7 hours',
   now() - interval '9 days 7 hours'),

  -- Malware / nation-state / threat intel
  (gen_random_uuid(),
   'New Backdoor Uses DNS-over-HTTPS for Stealthy C2 Communications',
   'https://example.com/doh-backdoor',
   'Analysts detail a new backdoor that uses DoH to hide command-and-control.',
   'A newly documented backdoor family uses DNS-over-HTTPS to blend into normal traffic and evade basic network monitoring. Detection guidance includes endpoint telemetry and DoH policy enforcement.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'malware' limit 1),
   'approved'::article_status,
   7,
   null, null, null,
   now() - interval '7 days 4 hours',
   now() - interval '7 days 4 hours'),

  (gen_random_uuid(),
   'APT Group Targets Telecoms with SIM-Swap Toolkit and New Loader',
   'https://example.com/apt-telecom-simswap',
   'Nation-state group targets telecoms using bespoke tooling and loaders.',
   'Researchers attributed a campaign against telecom operators to a nation-state aligned group. The intrusion chain includes credential theft, SIM-swap tooling, and a custom loader to deploy implants.',
   null,
   'a0000000-0000-0000-0000-000000000004',
   (select id from public.categories where slug = 'nation-state' limit 1),
   'approved'::article_status,
   6,
   null, null, null,
   now() - interval '10 days',
   now() - interval '10 days'),

  (gen_random_uuid(),
   'Threat Intel: New Phishing Kit Targets OAuth Consent Flows',
   'https://example.com/oauth-consent-phish',
   'A phishing kit abuses OAuth consent to gain persistent access.',
   'Analysts observed a phishing kit that tricks users into granting OAuth permissions rather than stealing passwords. Defenders should restrict third-party app consent and review high-risk grants.',
   null,
   'a0000000-0000-0000-0000-000000000002',
   (select id from public.categories where slug = 'threat-intelligence' limit 1),
   'approved'::article_status,
   7,
   null, null, null,
   now() - interval '11 days 8 hours',
   now() - interval '11 days 8 hours'),

  -- AI security
  (gen_random_uuid(),
   'Prompt Injection Hits Internal Support Bot via Retrieved Knowledge Base',
   'https://example.com/prompt-injection-rag',
   'A security report shows prompt injection via RAG documents in a support bot.',
   'A red team report demonstrates prompt injection against an internal support bot by embedding adversarial instructions inside retrieved documents. Mitigations include content sanitization, tool gating, and strict allowlists for actions.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'ai-security' limit 1),
   'approved'::article_status,
   6,
   null, null, null,
   now() - interval '13 days 2 hours',
   now() - interval '13 days 2 hours'),

  -- Policy / compliance / NIS2
  ('c0000000-0000-0000-0000-000000000005',
   'EU Member States Struggle with NIS2 Implementation Deadline',
   'https://example.com/nis2-deadline',
   'Multiple EU countries miss the NIS2 transposition deadline.',
   'Several EU member states missed the deadline for transposing the NIS2 Directive into national law. The European Commission has initiated infringement procedures and urged faster implementation.',
   'Multiple EU states miss NIS2 transposition deadline and face infringement.',
   'a0000000-0000-0000-0000-000000000004',
   (select id from public.categories where slug = 'nis2' limit 1),
   'approved'::article_status,
   7,
   'EU',
   'NIS2',
   null,
   now() - interval '1 day',
   now() - interval '1 day'),

  (gen_random_uuid(),
   'US SEC Charges CISO Over Disclosure Controls After Breach',
   'https://example.com/sec-ciso-disclosure',
   'SEC enforcement highlights disclosure and internal control expectations.',
   'The SEC announced charges related to disclosure controls after a breach event, emphasizing governance and incident reporting timelines. Organizations should review disclosure playbooks and cross-functional escalation paths.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'sec-cyber' limit 1),
   'pending'::article_status,
   6,
   'US',
   'SEC Cyber Rules',
   null,
   now() - interval '6 days 9 hours',
   now() - interval '6 days 9 hours'),

  -- GDPR / fines
  ('c0000000-0000-0000-0000-000000000006',
   'French DPA Fines Retailer €2.3M for GDPR Consent Violations',
   'https://example.com/cnil-fine',
   'CNIL fines a retailer for inadequate cookie consent mechanisms.',
   'France''s CNIL imposed a €2.3 million fine for GDPR violations related to cookie consent and delayed responses to data subject requests. The decision reiterates expectations for consent UX and timely DSAR handling.',
   'CNIL fines a retailer €2.3M for cookie consent and DSAR failures.',
   'a0000000-0000-0000-0000-000000000005',
   (select id from public.categories where slug = 'privacy-fines' limit 1),
   'approved'::article_status,
   8,
   'France',
   'GDPR',
   '€2.3M',
   now() - interval '5 hours',
   now() - interval '5 hours'),

  (gen_random_uuid(),
   'NOYB Files Complaint Over Dark Patterns in Cookie Banner Design',
   'https://example.com/noyb-dark-patterns',
   'NOYB submits a complaint alleging manipulative consent banner patterns.',
   'Privacy group NOYB filed a complaint arguing that cookie banners use dark patterns to steer users into accepting tracking. The complaint calls for stronger enforcement against non-compliant consent interfaces.',
   null,
   'a0000000-0000-0000-0000-000000000006',
   (select id from public.categories where slug = 'gdpr' limit 1),
   'approved'::article_status,
   5,
   'EU',
   'GDPR',
   null,
   now() - interval '3 days 1 hour',
   now() - interval '3 days 1 hour'),

  (gen_random_uuid(),
   'UK ICO Issues Enforcement Notice for Unlawful Employee Monitoring',
   'https://example.com/ico-employee-monitoring',
   'UK regulator issues an enforcement notice over unlawful employee monitoring.',
   'The UK ICO issued an enforcement notice requiring a company to stop certain employee monitoring practices and improve transparency. The case reinforces proportionality and lawful basis requirements.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'uk-data-protection' limit 1),
   'approved'::article_status,
   6,
   'UK',
   'UK GDPR',
   null,
   now() - interval '12 days 6 hours',
   now() - interval '12 days 6 hours'),

  -- Cloud security
  (gen_random_uuid(),
   'AWS Warns of Exposed Access Keys in Public Docker Images',
   'https://example.com/aws-docker-keys',
   'Researchers identify public container images leaking long-lived credentials.',
   'A report highlights public Docker images that accidentally embed AWS keys and config files. Guidance includes secret scanning in CI, short-lived credentials, and image build hardening.',
   'Public container images keep leaking AWS keys—scan builds and rotate creds.',
   'a0000000-0000-0000-0000-000000000001',
   (select id from public.categories where slug = 'cloud-security' limit 1),
   'approved'::article_status,
   7,
   null, null, null,
   now() - interval '14 days 1 hour',
   now() - interval '14 days 1 hour'),

  (gen_random_uuid(),
   'Kubernetes Admission Controller Bypass Leads to Cluster-Wide Policy Evasion',
   'https://example.com/k8s-admission-bypass',
   'A bypass enables policy evasion in clusters with certain admission configurations.',
   'A vulnerability in a popular admission controller configuration can allow attackers to bypass enforcement policies under specific conditions. Mitigations include patching, configuration review, and audit logging.',
   null,
   'a0000000-0000-0000-0000-000000000004',
   (select id from public.categories where slug = 'cloud-security' limit 1),
   'approved'::article_status,
   8,
   null, null, null,
   now() - interval '9 days 1 hour',
   now() - interval '9 days 1 hour'),

  -- Tools / IR
  (gen_random_uuid(),
   'New Open Source Tool Automates Detection of OAuth Token Replay in Logs',
   'https://example.com/tool-oauth-replay',
   'A new tool helps detect suspicious OAuth token reuse patterns.',
   'An open source detection utility scans common log formats for OAuth token replay indicators and suspicious client IDs. It aims to reduce time-to-detection for consent-phishing intrusions.',
   null,
   'a0000000-0000-0000-0000-000000000002',
   (select id from public.categories where slug = 'tools' limit 1),
   'approved'::article_status,
   4,
   null, null, null,
   now() - interval '8 days 3 hours',
   now() - interval '8 days 3 hours'),

  (gen_random_uuid(),
   'Incident Response Lessons Learned: Containing a Multi-Region Cloud Intrusion',
   'https://example.com/ir-lessons-cloud',
   'A post-incident report describes containing a cloud intrusion across regions.',
   'A detailed incident response write-up covers token revocation, forensic capture, and rebuilding IAM in a compromised multi-region environment. It includes checklists for containment and recovery.',
   null,
   'a0000000-0000-0000-0000-000000000003',
   (select id from public.categories where slug = 'incident-response' limit 1),
   'approved'::article_status,
   5,
   null, null, null,
   now() - interval '2 days 21 hours',
   now() - interval '2 days 21 hours'),

  -- Fillers (still realistic) to reach 40 total
  (gen_random_uuid(), 'Massive Credential Stuffing Campaign Targets SaaS Login Portals', 'https://example.com/credential-stuffing-saas',
   'A spike in credential stuffing attempts is impacting multiple SaaS providers.',
   'Multiple SaaS vendors report increased credential stuffing targeting customer admin portals. Recommended mitigations include MFA enforcement, bot protection, and rate limiting.',
   null,
   'a0000000-0000-0000-0000-000000000002', (select id from public.categories where slug = 'identity-access' limit 1),
   'approved'::article_status, 6, null, null, null,
   now() - interval '4 days 18 hours', now() - interval '4 days 18 hours'),

  (gen_random_uuid(), 'Researchers Uncover Malware That Disables EDR via Driver Abuse', 'https://example.com/edr-driver-abuse',
   'A malware loader abuses signed drivers to tamper with endpoint defenses.',
   'Researchers describe a malware family using vulnerable signed drivers to disable EDR components. Guidance includes driver blocklists and kernel telemetry monitoring.',
   null,
   'a0000000-0000-0000-0000-000000000003', (select id from public.categories where slug = 'malware' limit 1),
   'approved'::article_status, 7, null, null, null,
   now() - interval '5 days 1 hour', now() - interval '5 days 1 hour'),

  (gen_random_uuid(), 'CISA Adds Exploited Auth Bypass to KEV Catalog', 'https://example.com/cisa-kev-auth-bypass',
   'CISA adds an actively exploited authentication bypass to its KEV list.',
   'CISA updated the Known Exploited Vulnerabilities catalog with an authentication bypass affecting widely deployed appliances. Agencies are urged to patch within mandated timelines.',
   null,
   'a0000000-0000-0000-0000-000000000001', (select id from public.categories where slug = 'policy' limit 1),
   'approved'::article_status, 6, null, null, null,
   now() - interval '6 days 2 hours', now() - interval '6 days 2 hours'),

  (gen_random_uuid(), 'Data Broker Agrees to Delete Location Data Following Regulatory Pressure', 'https://example.com/data-broker-location',
   'A data broker agrees to delete location datasets following regulatory action.',
   'Regulators pushed a data broker to delete certain location datasets and adopt stronger data minimization practices. The case underscores scrutiny of sensitive data handling.',
   null,
   'a0000000-0000-0000-0000-000000000005', (select id from public.categories where slug = 'privacy' limit 1),
   'approved'::article_status, 4, 'EU', 'GDPR', null,
   now() - interval '7 days 10 hours', now() - interval '7 days 10 hours'),

  (gen_random_uuid(), 'New “ShadowPad” Cluster Tied to Software Supply Chain Breach', 'https://example.com/shadowpad-supply-chain',
   'Analysts connect a ShadowPad cluster to a suspected supplier compromise.',
   'Threat intelligence links a ShadowPad activity cluster to a supplier compromise affecting multiple downstream victims. Recommendations include validating update channels and monitoring signed binary execution.',
   null,
   'a0000000-0000-0000-0000-000000000004', (select id from public.categories where slug = 'threat-intelligence' limit 1),
   'approved'::article_status, 7, null, null, null,
   now() - interval '8 days 22 hours', now() - interval '8 days 22 hours'),

  (gen_random_uuid(), 'Healthcare Provider Notifies Patients After Ransomware Incident', 'https://example.com/healthcare-notification',
   'A healthcare provider reports a ransomware incident impacting patient services.',
   'A healthcare provider disclosed a ransomware incident that disrupted operations and may have exposed patient data. The statement outlines containment steps and recommends credit monitoring for impacted individuals.',
   null,
   'a0000000-0000-0000-0000-000000000002', (select id from public.categories where slug = 'breaches' limit 1),
   'pending'::article_status, 5, 'US', 'HIPAA', null,
   now() - interval '9 days 18 hours', now() - interval '9 days 18 hours'),

  (gen_random_uuid(), 'Researchers Detail Browser Extension Hijacking Technique via OAuth Grant', 'https://example.com/extension-oauth-hijack',
   'Attackers abuse OAuth grants to hijack browser extension sync flows.',
   'A new technique abuses OAuth grants and extension sync flows to deploy malicious updates to targeted users. Mitigations include narrowing OAuth scopes and monitoring extension install events.',
   null,
   'a0000000-0000-0000-0000-000000000003', (select id from public.categories where slug = 'identity-access' limit 1),
   'approved'::article_status, 6, null, null, null,
   now() - interval '10 days 4 hours', now() - interval '10 days 4 hours'),

  (gen_random_uuid(), 'Cloud Provider Introduces New Default for Private Buckets After Abuse Reports', 'https://example.com/cloud-private-default',
   'A provider changes defaults to reduce accidental public exposure.',
   'Following repeated abuse and exposure reports, a cloud provider introduced private-by-default bucket policies and improved warnings for public access. Teams should still enforce guardrails via policy-as-code.',
   null,
   'a0000000-0000-0000-0000-000000000004', (select id from public.categories where slug = 'cloud-security' limit 1),
   'approved'::article_status, 4, null, null, null,
   now() - interval '10 days 20 hours', now() - interval '10 days 20 hours'),

  (gen_random_uuid(), 'EU Publishes Draft Guidance on EU AI Act Security Requirements', 'https://example.com/eu-ai-act-guidance',
   'Draft guidance highlights security controls expected for high-risk AI systems.',
   'A draft guidance document outlines expected security controls for high-risk AI systems under the EU AI Act, including logging, access controls, and resilience testing.',
   null,
   'a0000000-0000-0000-0000-000000000004', (select id from public.categories where slug = 'eu-ai-act' limit 1),
   'approved'::article_status, 5, 'EU', 'EU AI Act', null,
   now() - interval '11 days 2 hours', now() - interval '11 days 2 hours'),

  (gen_random_uuid(), 'PCI Council Updates PCI-DSS Guidance for Tokenization Providers', 'https://example.com/pci-tokenization',
   'Updated guidance clarifies obligations for tokenization service providers.',
   'An update to PCI-DSS guidance clarifies responsibilities for tokenization and payment service providers, emphasizing logging and key management controls.',
   null,
   'a0000000-0000-0000-0000-000000000003', (select id from public.categories where slug = 'pci-dss' limit 1),
   'approved'::article_status, 4, 'International', 'PCI-DSS', null,
   now() - interval '12 days 3 hours', now() - interval '12 days 3 hours'),

  (gen_random_uuid(), 'Researchers Release Free YARA Rules for New Loader Family', 'https://example.com/yara-loader-rules',
   'New YARA rules target a loader family used in multiple intrusions.',
   'A set of YARA rules aims to help defenders detect a loader family observed in multiple campaigns. The rules cover both packed and unpacked samples.',
   null,
   'a0000000-0000-0000-0000-000000000001', (select id from public.categories where slug = 'tools' limit 1),
   'approved'::article_status, 4, null, null, null,
   now() - interval '12 days 20 hours', now() - interval '12 days 20 hours'),

  (gen_random_uuid(), 'Phishing Campaign Uses QR Codes to Evade Email Filters', 'https://example.com/qr-phishing',
   'Attackers use QR codes in emails to redirect victims to credential harvest pages.',
   'A phishing campaign uses QR codes embedded in PDFs to evade URL scanning. Recommendations include user training and disabling automatic link previews.',
   null,
   'a0000000-0000-0000-0000-000000000002', (select id from public.categories where slug = 'threat-intelligence' limit 1),
   'approved'::article_status, 5, null, null, null,
   now() - interval '13 days 9 hours', now() - interval '13 days 9 hours'),

  (gen_random_uuid(), 'New “StealC” Variant Adds Chrome Cookie Decryption Module', 'https://example.com/stealc-cookie',
   'An infostealer variant adds new modules for browser data extraction.',
   'A StealC infostealer variant adds a Chrome cookie decryption module and improved persistence. Defenders should prioritize endpoint hardening and credential rotation.',
   null,
   'a0000000-0000-0000-0000-000000000003', (select id from public.categories where slug = 'malware' limit 1),
   'approved'::article_status, 6, null, null, null,
   now() - interval '14 days', now() - interval '14 days'),

  -- Pending & rejected examples
  (gen_random_uuid(), 'Unconfirmed: New Router Exploit Claimed on Underground Forum', 'https://example.com/unconfirmed-router-claim',
   'A forum post claims a new router exploit; details remain unverified.',
   'An underground forum post claims a new router exploit chain. No independent validation has been provided. Treat as unconfirmed and monitor vendor advisories.',
   null,
   'a0000000-0000-0000-0000-000000000004', (select id from public.categories where slug = 'vulnerabilities' limit 1),
   'pending'::article_status, 3, null, null, null,
   now() - interval '15 hours', now() - interval '15 hours'),

  (gen_random_uuid(), 'Clickbait: “Hackers Can Instantly Break Any Password” Claim Debunked', 'https://example.com/clickbait-debunked',
   'A sensational claim about password cracking is misleading and lacks evidence.',
   'A widely shared post claims attackers can instantly break any password. Security researchers debunked the claim as misleading and technically inaccurate.',
   null,
   'a0000000-0000-0000-0000-000000000002', (select id from public.categories where slug = 'policy' limit 1),
   'rejected'::article_status, 2, null, null, null,
   now() - interval '2 days 1 hour', now() - interval '2 days 1 hour')
on conflict (url) do nothing;

-- -----------------------------------------------------------------------------
-- IoCs for a few known articles (used to test IoC UI pages)
-- -----------------------------------------------------------------------------
insert into public.article_iocs (article_id, type, value, context)
values
  ('c0000000-0000-0000-0000-000000000001', 'cve', 'CVE-2026-1234', 'Referenced as the tracked Struts RCE'),
  ('c0000000-0000-0000-0000-000000000001', 'ip', '198.51.100.42', 'Observed scanning source in honeypot telemetry'),
  ('c0000000-0000-0000-0000-000000000001', 'domain', 'struts-update-check.example', 'Fake C2 domain used in example telemetry'),
  ('c0000000-0000-0000-0000-000000000003', 'url', 'https://exfil.example/upload', 'Exfil endpoint embedded in malicious npm package'),
  ('c0000000-0000-0000-0000-000000000003', 'hash_sha256', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Example package tarball sha256'),
  ('c0000000-0000-0000-0000-000000000002', 'mitre_attack', 'T1190', 'Exploit Public-Facing Application (example mapping)')
on conflict (article_id, type, value) do nothing;

-- -----------------------------------------------------------------------------
-- Podcast episodes (2 editions for today)
-- -----------------------------------------------------------------------------
insert into public.podcast_episodes (
  id,
  date,
  edition,
  title,
  duration_seconds,
  audio_url,
  article_count,
  article_ids,
  article_text
)
values
  (gen_random_uuid(),
   current_date,
   'morning',
	   'Morning Brief — ' || to_char(current_date, 'Mon DD'),
   245,
   'https://example.com/podcast/morning.mp3',
   4,
   array[
     'c0000000-0000-0000-0000-000000000001'::uuid,
     'c0000000-0000-0000-0000-000000000004'::uuid,
     'c0000000-0000-0000-0000-000000000006'::uuid,
     'c0000000-0000-0000-0000-000000000005'::uuid
   ],
   '# Morning Brief\n\n## Apache Struts RCE\n\nA critical Struts vulnerability is being exploited...\n\n## LockBit Targets Healthcare\n\nRansomware operators continue targeting healthcare...'),

  (gen_random_uuid(),
   current_date,
   'afternoon',
	   'Afternoon Brief — ' || to_char(current_date, 'Mon DD'),
   220,
   'https://example.com/podcast/afternoon.mp3',
   3,
   array[
     'c0000000-0000-0000-0000-000000000003'::uuid,
     'c0000000-0000-0000-0000-000000000002'::uuid,
     'c0000000-0000-0000-0000-000000000006'::uuid
   ],
   '# Afternoon Brief\n\n## npm Supply Chain\n\nA malicious npm package stole cloud credentials...\n\n## Exchange Zero-Day\n\nEmergency patches were released...')
on conflict (date, edition) do nothing;

-- -----------------------------------------------------------------------------
-- Test subscriber + preferences (notification UI testing)
-- -----------------------------------------------------------------------------
insert into public.subscribers (id, email, name, verified, verify_token)
values
  ('b0000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User', true, 'test-token-123')
on conflict (email) do update
set name = excluded.name,
    verified = excluded.verified,
    verify_token = excluded.verify_token;

insert into public.subscriber_preferences (subscriber_id, preference_type, preference_value)
values
  ('b0000000-0000-0000-0000-000000000001', 'category'::preference_type, 'vulnerabilities'),
  ('b0000000-0000-0000-0000-000000000001', 'category'::preference_type, 'ransomware'),
  ('b0000000-0000-0000-0000-000000000001', 'regulation'::preference_type, 'GDPR'),
  ('b0000000-0000-0000-0000-000000000001', 'jurisdiction'::preference_type, 'EU')
on conflict (subscriber_id, preference_type, preference_value) do nothing;

insert into public.subscriber_channels (subscriber_id, channel_type, channel_config, is_active, verified)
values
  ('b0000000-0000-0000-0000-000000000001', 'email'::channel_type, '{}'::jsonb, true, true)
on conflict do nothing;

commit;
