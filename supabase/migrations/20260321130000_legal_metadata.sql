-- LEN-1130: Legal metadata tagging
-- Adds structured fields for jurisdiction/regulation/fine amounts and introduces regulation-specific categories.

-- New columns on articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS jurisdiction text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS regulation text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS fine_amount text;

COMMENT ON COLUMN articles.jurisdiction IS 'Country or region (e.g. EU, US, UK, France, Germany). Null if not regulatory.';
COMMENT ON COLUMN articles.regulation IS 'Regulation/standard name (e.g. GDPR, CCPA, HIPAA, NIS2, PCI-DSS). Null if not regulatory.';
COMMENT ON COLUMN articles.fine_amount IS 'Fine/penalty amount if enforcement action (e.g. €1.2M, $500K). Null if not a fine.';

-- New categories for regulatory content
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
  (gen_random_uuid(), 'GDPR', 'gdpr', 'EU General Data Protection Regulation', 30),
  (gen_random_uuid(), 'CCPA/CPRA', 'ccpa-cpra', 'California Consumer Privacy Act', 31),
  (gen_random_uuid(), 'HIPAA', 'hipaa', 'US Health Insurance Portability and Accountability Act', 32),
  (gen_random_uuid(), 'NIS2', 'nis2', 'EU Network and Information Security Directive', 33),
  (gen_random_uuid(), 'PCI-DSS', 'pci-dss', 'Payment Card Industry Data Security Standard', 34),
  (gen_random_uuid(), 'DORA', 'dora', 'Digital Operational Resilience Act', 35),
  (gen_random_uuid(), 'Privacy Fines', 'privacy-fines', 'DPA enforcement actions and penalties', 36),
  (gen_random_uuid(), 'UK Data Protection', 'uk-data-protection', 'UK GDPR and Data Protection Act 2018', 37)
ON CONFLICT (slug) DO NOTHING;

