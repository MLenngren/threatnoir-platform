-- Expand regulation categories to cover full EU/US/international landscape

INSERT INTO categories (id, name, slug, description, sort_order) VALUES
  (gen_random_uuid(), 'EU AI Act', 'eu-ai-act', 'EU AI Act — artificial intelligence regulation and compliance', 38),
  (gen_random_uuid(), 'Cyber Resilience Act', 'eu-cyber-resilience-act', 'EU Cyber Resilience Act (CRA) — product cybersecurity requirements', 39),
  (gen_random_uuid(), 'EU Cybersecurity Act', 'eu-cybersecurity-act', 'EU Cybersecurity Act — ENISA mandate and certification schemes', 40),
  (gen_random_uuid(), 'DSA/DMA', 'dsa-dma', 'EU Digital Services Act / Digital Markets Act', 41),
  (gen_random_uuid(), 'NIST', 'nist', 'NIST CSF, 800-series, US federal cybersecurity standards', 42),
  (gen_random_uuid(), 'SEC Cyber Rules', 'sec-cyber', 'SEC cyber disclosure rules and enforcement', 43)
ON CONFLICT (slug) DO NOTHING;
